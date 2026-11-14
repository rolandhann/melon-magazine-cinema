# 🎬 멜론 매거진 시네마

멜론 매거진의 최신 기사를 **영화관 상영관**처럼 걸어 다니며 보는 3D 공간입니다.
상영관(1관~12관)마다 기사 포스터와 안내 모니터가 걸려 있고, 입장하면 기사의 사진과 글을 읽을 수 있습니다.
같은 주소로 들어온 관객끼리는 **아바타가 실시간으로 보이고** 👏 ❤️ 😂 🍿 리액션을 주고받을 수 있습니다.

## 조작
| 키 | 동작 |
|---|---|
| W A S D / ↑ ↓ | 걷기 (Shift: 빠르게) |
| ← → / 드래그 | 둘러보기 |
| 상영관 클릭 / Enter | 입장해서 기사 보기 |
| V | 1인칭 ↔ 3인칭 |
| 1 2 3 4 | 리액션 |

## 구조
```
public/            웹 화면 (three.js)
  index.html
  space.js         영화관 공간·아바타·실시간 동기화
  magazine.js      기사 데이터 (fetch_magazine.py 가 생성)
src/worker.js      Cloudflare Worker + Durable Object (아바타 위치 중계)
fetch_magazine.py  멜론 매거진 최신 기사 가져오기
wrangler.jsonc     Cloudflare 배포 설정
```

## 로컬 실행
```bash
python3 fetch_magazine.py      # (선택) 최신 기사로 갱신, 기본 12편
npx wrangler dev --port 8766   # 또는 start.command 더블클릭
```

## 배포
```bash
npx wrangler deploy
```
GitHub 저장소를 Cloudflare Workers Builds 에 연결해 두면 `main` 에 push 할 때마다 자동 배포됩니다.

> 기사 글·사진의 저작권은 멜론(카카오엔터테인먼트)에 있으며, 각 기사 하단에 원문 링크를 제공합니다.
