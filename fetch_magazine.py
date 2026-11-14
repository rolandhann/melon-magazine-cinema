#!/usr/bin/env python3
"""멜론 매거진 최신 글을 가져와 magazine.js 로 저장합니다.

사용법:  python3 fetch_magazine.py [가져올 글 수, 기본 12]
결과:    magazine.js  (전시관이 이 파일을 읽어 사진·글을 보여 줍니다)
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://www.melon.com/musicstory/inform.htm?mstorySeq="
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
OUT = Path(__file__).parent / "public" / "magazine.js"
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 12
MAX_PHOTOS = 40   # 글 하나당 최대 사진 수


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="ignore")


def home_seqs():
    """멜론 메인에 걸린 매거진 링크들의 글 번호."""
    seqs = sorted({int(x) for x in re.findall(r"musicstory/inform\.htm\?mstorySeq=(\d+)", get("https://www.melon.com/"))}, reverse=True)
    if not seqs:
        raise SystemExit("멜론 메인에서 매거진 링크를 찾지 못했어요.")
    return seqs


def article_list(page):
    """글 상세 페이지의 '글 선택' 드롭다운 = 최신순 전체 목록."""
    sel = re.search(r'id="detailSel".*?</select>', page, re.S)
    out = []
    for seq, label in re.findall(r'<option[^>]*value="(\d+)"[^>]*>(.*?)</option>', sel.group(0) if sel else "", re.S):
        label = html.unescape(re.sub(r"\s+", " ", label)).strip()
        m = re.match(r"(\d{4}\.\d{2}\.\d{2})\s*-\s*(.*)", label)
        out.append({"seq": int(seq), "date": m.group(1) if m else ""})
    return out


def clean_text(fragment):
    t = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    t = re.sub(r"</(p|div|li)>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    t = "\n".join(line.strip() for line in t.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def meta(page, prop):
    m = re.search(rf'<meta property="og:{prop}" content="([^"]*)"', page)
    return html.unescape(m.group(1)) if m else ""


def img_url(u):
    u = html.unescape(u)
    return "https:" + u if u.startswith("//") else u


def parse_article(seq, date):
    page = get(BASE + str(seq))
    start = page.find("medLib start")
    if start < 0:
        start = page.find('class="relatelk2"')
    end = min([i for i in (page.find('id="eventFrame"', start), page.find('class="wrap_reply', start),
                           page.find('id="footer"', start)) if i > 0] or [len(page)])
    body = re.sub(r"<!--.*?-->", "", page[start:end], flags=re.S)
    body = re.sub(r"<script.*?</script>|<form.*?</form>", "", body, flags=re.S)

    blocks, photos = [], 0
    token = re.compile(
        r'<h(\d)[^>]*>(?P<h>.*?)</h\1>'
        r'|<div class="text">(?P<t>.*?)</div>'
        r'|<div class="(?:album_image|image|photo[^"]*)">\s*<img[^>]*src="(?P<img>[^"]+)"'
        r'|<div class="insdc_album">.*?<img[^>]*src="(?P<alb>[^"]+)"',
        re.S)
    for m in token.finditer(body):
        if m.group("h") is not None:
            label = re.search(r"<span>(.*?)</span>", m.group("h"))
            text = clean_text(re.sub(r"<span>.*?</span>", "", m.group("h"), count=1))
            if text:
                blocks.append({"type": "h", "label": clean_text(label.group(1)) if label else "", "text": text})
        elif m.group("t") is not None:
            text = clean_text(m.group("t"))
            if text:
                blocks.append({"type": "p", "text": text})
        elif m.group("img") and photos < MAX_PHOTOS:
            blocks.append({"type": "img", "src": img_url(m.group("img"))}); photos += 1
        elif m.group("alb"):
            blocks.append({"type": "album", "src": img_url(m.group("alb"))})

    imgs = [b["src"] for b in blocks if b["type"] == "img"]
    return {
        "seq": seq,
        "date": date,
        "title": meta(page, "title"),
        "url": BASE + str(seq),
        # 상단 reg_image 는 공용 '매거진 이벤트' 배너라서, 글 고유의 SNS 대표 이미지(og:image)를 표지로 씁니다
        "cover": img_url(meta(page, "image")) or (imgs[0] if imgs else ""),
        "blocks": blocks,
    }


def main():
    # 매거진은 시리즈(스페셜·빌보드 소식 등)마다 목록이 따로라서, 메인에 걸린 글들의 목록을 모두 합쳐 최신순으로 고릅니다
    merged, seen_lists = {}, set()
    for seq in home_seqs():
        if seq in merged and merged[seq]["listed"]:
            continue   # 이미 다른 목록에서 본 글 → 같은 시리즈
        lst = article_list(get(BASE + str(seq)))
        key = tuple(a["seq"] for a in lst[:3])
        if key in seen_lists:
            continue
        seen_lists.add(key)
        for a in lst:
            merged.setdefault(a["seq"], {**a, "listed": True})
        merged.setdefault(seq, {"seq": seq, "date": "", "listed": True})
        time.sleep(0.3)
    listing = sorted(merged.values(), key=lambda a: (a["date"], a["seq"]), reverse=True)[:COUNT]
    articles = []
    for i, a in enumerate(listing, 1):
        try:
            art = parse_article(a["seq"], a["date"])
            n_img = sum(b["type"] == "img" for b in art["blocks"])
            print(f"[{i}/{len(listing)}] {art['date']} {art['title'][:40]}  (사진 {n_img}장)")
            if art["cover"]:
                articles.append(art)
        except Exception as e:  # 한 글이 실패해도 나머지는 계속
            print(f"[{i}/{len(listing)}] {a['seq']} 건너뜀: {e}")
        time.sleep(0.4)   # 멜론 서버에 부담 주지 않게 천천히

    data = {"fetchedAt": time.strftime("%Y-%m-%d %H:%M"), "articles": articles}
    OUT.write_text(
        "// fetch_magazine.py 가 자동으로 만든 파일입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
        f"export const MAGAZINE = {json.dumps(data, ensure_ascii=False, indent=1)};\n",
        encoding="utf-8")
    print(f"\n완료: {len(articles)}개 글 → {OUT}")


if __name__ == "__main__":
    main()
