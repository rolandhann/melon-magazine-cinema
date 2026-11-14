import * as THREE from 'three';
import { MAGAZINE } from './magazine.js';

const ARTICLES = MAGAZINE.articles;
await Promise.race([
  Promise.all([
    document.fonts.load("900 40px 'Noto Sans KR'"), document.fonts.load("500 40px 'Noto Sans KR'"),
    document.fonts.load("40px 'Bebas Neue'"),
  ]),
  new Promise((r) => setTimeout(r, 2500)),
]);

// ---------- 기본 설정 ----------
const EYE = 1.6;
const GAP = 6.4;              // 상영관 간격
const HALL_W = 12, HALL_H = 5.5;
const PER_SIDE = Math.ceil(ARTICLES.length / 2);
const HALL_L = PER_SIDE * GAP + 12;
const VIEW_DIST = 2.6;        // 상영관 앞에 서는 거리
const GOLD = 0xe8b45a, RED = 0xb3122e;
const SQ = '#e8b45a';
const AVATAR_COLORS = ['#00cd3c', '#ff4d6d', '#4d9fff', '#ffb020', '#a66bff', '#20c4c4', '#ff7a3d', '#f4efe8'];

const qs = new URLSearchParams(location.search);
document.getElementById('ex-meta').textContent = `상영작 ${ARTICLES.length}편 · ${MAGAZINE.fetchedAt} 기준`;

// ---------- 렌더러·장면 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070607);
scene.fog = new THREE.Fog(0x070607, 34, 95);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 200);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xffe2d0, 0x1a0d10, 0.75));
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
for (let z = -5; z > -HALL_L; z -= 9) {
  const p = new THREE.PointLight(0xffc89a, 14, 15, 1.6);
  p.position.set(0, HALL_H - 0.5, z); scene.add(p);
}

// ---------- 도우미 ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
  return t;
}
function wrapLines(g, text, maxW, maxLines) {
  const src = text.replace(/\s+/g, ' ').trim();
  const lines = []; let cur = ''; let used = 0;
  for (const ch of src) {
    if (g.measureText(cur + ch).width > maxW) {
      lines.push(cur); used += cur.length; cur = ch === ' ' ? '' : ch;
      if (lines.length === maxLines) break;
    } else cur += ch;
  }
  if (lines.length < maxLines && cur) { lines.push(cur); used += cur.length; }
  if (used < src.length - 1) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + '…';
  return lines;
}
const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}
function drawCover(g, im, x, y, w, h) {
  const a = im.width / im.height, b = w / h;
  let sw = im.width, sh = im.height, sx = 0, sy = 0;
  if (a > b) { sw = im.height * b; sx = (im.width - sw) / 2; } else { sh = im.width / b; sy = (im.height - sh) * 0.3; }
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
function drawContain(g, im, x, y, w, h) {
  const s = Math.min(w / im.width, h / im.height);
  const dw = im.width * s, dh = im.height * s;
  g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
const photosOf = (a) => a.blocks.filter((b) => b.type === 'img').map((b) => b.src);
const readMin = (a) => {
  const chars = a.blocks.reduce((n, b) => n + (b.text ? b.text.length : 0), 0);
  return Math.max(1, Math.round(chars / 500 + photosOf(a).length * 0.15));
};

// ---------- 건물 ----------
const carpetTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3b0b16'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 60},0,${10 + Math.random() * 20},${Math.random() * 0.35})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  // 극장 카펫 무늬 (원 + 마름모)
  const cell = 128;
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    g.strokeStyle = 'rgba(232,180,90,.55)'; g.lineWidth = 4;
    g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(232,180,90,.35)';
    g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 10, y); g.lineTo(x, y + 10); g.lineTo(x - 10, y); g.fill();
    g.fillStyle = 'rgba(20,60,120,.45)'; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 9, 0, Math.PI * 2); g.fill();
  }
});
carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
carpetTex.repeat.set(HALL_W / 2, HALL_L / 2);

const panelTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#231b1e'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) {
    const grd = g.createLinearGradient(x, 0, x + 64, 0);
    grd.addColorStop(0, 'rgba(255,255,255,.04)'); grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = grd; g.fillRect(x, 0, 64, h);
  }
});
panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
panelTex.repeat.set(HALL_L / 2, 1);

const wallMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.9 });
const endMat = new THREE.MeshStandardMaterial({ color: 0x140f11, roughness: 1 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_L), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -HALL_L / 2); scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_L), new THREE.MeshBasicMaterial({ color: 0x050405 }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HALL_H, -HALL_L / 2); scene.add(ceil);

function wall(w, h, x, z, ry, mat = wallMat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m);
}
wall(HALL_L, HALL_H, -HALL_W / 2, -HALL_L / 2, Math.PI / 2);
wall(HALL_L, HALL_H, HALL_W / 2, -HALL_L / 2, -Math.PI / 2);
wall(HALL_W, HALL_H, 0, -HALL_L, 0, endMat);
wall(HALL_W, HALL_H, 0, 0, Math.PI, endMat);

// 천장 다운라이트 + 바닥 통로 유도등
const dotMat = new THREE.MeshBasicMaterial({ color: 0xffe6c4, toneMapped: false });
const dotGeo = new THREE.CircleGeometry(0.07, 12);
for (let z = -2; z > -HALL_L + 1; z -= 2) for (const x of [-3.5, 0, 3.5]) {
  const d = new THREE.Mesh(dotGeo, dotMat); d.rotation.x = Math.PI / 2; d.position.set(x, HALL_H - 0.01, z); scene.add(d);
}
const stripMat = new THREE.MeshBasicMaterial({ color: 0xffa64d, toneMapped: false });
for (const x of [-HALL_W / 2 + 0.12, HALL_W / 2 - 0.12]) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, HALL_L - 1), stripMat);
  s.position.set(x, 0.03, -HALL_L / 2); scene.add(s);
}

// 로비 입구 쪽 네온 간판
const lobbySign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({
  transparent: true, toneMapped: false,
  map: canvasTex(1600, 400, (g, w) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#00ff55'; g.shadowBlur = 30; g.fillStyle = '#7dffa6';
    g.font = "150px 'Bebas Neue', sans-serif"; g.fillText('MELON MAGAZINE CINEMA', w / 2, 170);
    g.shadowColor = '#ffb347'; g.shadowBlur = 20; g.fillStyle = '#ffd9a0';
    g.font = "700 54px 'Noto Sans KR', sans-serif"; g.fillText('오늘의 상영작을 골라 입장하세요', w / 2, 310);
  }),
}));
lobbySign.position.set(0, 3.6, -0.03); lobbySign.rotation.y = Math.PI; scene.add(lobbySign);

// ---------- 상영관 (기사 부스) ----------
const clickables = [];
const doorAnchors = [];
const spots = [];
const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a0f1f, roughness: 0.55 });
const brassMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.8 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0b0c, roughness: 0.6 });
const glowTex = canvasTex(256, 256, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,200,140,.9)'); grd.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

let loaded = 0;
const enterBtn = document.getElementById('enter');
const progressEl = document.getElementById('progress');
function onLoaded() {
  loaded++;
  progressEl.textContent = `상영관 준비 ${loaded} / ${ARTICLES.length}`;
  if (loaded === ARTICLES.length) {
    enterBtn.disabled = false; enterBtn.textContent = '🎟 티켓 확인 · 입장하기'; progressEl.textContent = '';
    if (qs.has('enter')) enterBtn.click();
  }
}
if (!ARTICLES.length) enterBtn.textContent = '상영작이 없어요 — fetch_magazine.py 를 먼저 실행하세요';

// 포스터: 기사 속 사진 + 제목으로 영화 포스터처럼 합성
function makePoster(a, k, mat) {
  const W = 700, H = 1000;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAX_ANISO;
  const paint = (im) => {
    g.fillStyle = '#120d10'; g.fillRect(0, 0, W, H);
    if (im) drawCover(g, im, 0, 0, W, H * 0.78);
    const grd = g.createLinearGradient(0, H * 0.45, 0, H);
    grd.addColorStop(0, 'rgba(18,13,16,0)'); grd.addColorStop(0.45, 'rgba(18,13,16,.92)'); grd.addColorStop(1, '#120d10');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = "34px 'Bebas Neue', sans-serif";
    g.fillText('MELON MAGAZINE PRESENTS', W / 2, 26);
    g.fillStyle = '#ffffff'; g.font = "900 54px 'Noto Sans KR', sans-serif";
    const lines = wrapLines(g, a.title, W - 80, 3);
    const top = H - 150 - lines.length * 66;
    lines.forEach((ln, i) => g.fillText(ln, W / 2, top + i * 66));
    g.fillStyle = SQ; g.font = "36px 'Bebas Neue', sans-serif";
    g.fillText(`${a.date} 개봉 · 상영시간 약 ${readMin(a)}분`, W / 2, H - 120);
    g.fillStyle = '#8f8388'; g.font = "500 22px 'Noto Sans KR', sans-serif";
    g.fillText(`사진 ${photosOf(a).length}장 · 전체관람가 · THEATER ${k + 1}`, W / 2, H - 70);
    tex.needsUpdate = true;
  };
  paint(null);
  loadImg(photosOf(a)[0] || a.cover).then(paint);
  mat.map = tex; mat.needsUpdate = true;
}

// 출입문 위 상영 안내 모니터: 대표 이미지 + NOW SHOWING
function makeMonitor(a, k, mat) {
  const W = 1280, H = 720;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAX_ANISO;
  const paint = (im) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (im) drawCover(g, im, 0, 0, W, H);
    const grd = g.createLinearGradient(0, H * 0.5, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.88)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e0142e'; g.beginPath(); g.arc(56, 56, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = "44px 'Bebas Neue', sans-serif"; g.textBaseline = 'middle';
    g.fillText('NOW SHOWING', 82, 58);
    g.font = "900 52px 'Noto Sans KR', sans-serif"; g.textBaseline = 'alphabetic';
    wrapLines(g, a.title, W - 100, 2).reverse().forEach((ln, i) => g.fillText(ln, 50, H - 50 - i * 66));
    tex.needsUpdate = true;
  };
  paint(null);
  loadImg(a.cover).then((im) => { paint(im); onLoaded(); });
  mat.map = tex; mat.needsUpdate = true;
}

function theaterSign(k) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0b0809'; g.fillRect(0, 0, w, h);
    g.strokeStyle = SQ; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.shadowColor = '#ffb347'; g.shadowBlur = 24; g.fillStyle = '#ffe1ae';
    g.font = "900 140px 'Noto Sans KR', sans-serif"; g.fillText(`${k + 1}관`, 60, h / 2 + 6);
    g.shadowBlur = 0; g.textAlign = 'right'; g.fillStyle = '#bfb0b5';
    g.font = "64px 'Bebas Neue', sans-serif"; g.fillText(`THEATER ${String(k + 1).padStart(2, '0')}`, w - 60, h / 2 - 28);
    g.fillStyle = '#ff4060'; g.font = "700 40px 'Noto Sans KR', sans-serif"; g.fillText('● 상영중', w - 60, h / 2 + 44);
  });
}

ARTICLES.forEach((a, k) => {
  const left = k % 2 === 0;
  const z = -6 - Math.floor(k / 2) * GAP;
  const wallX = left ? -HALL_W / 2 : HALL_W / 2;
  const g = new THREE.Group();
  g.position.set(wallX + (left ? 0.01 : -0.01), 0, z);
  g.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
  const tag = (m) => { m.userData.index = k; clickables.push(m); return m; };

  // 출입문 (문틀 + 두 짝 + 손잡이)
  const DX = 0.9, DW = 1.9, DH = 2.6;
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(DW + 0.24, 0.12, 0.14), brassMat);
  frameTop.position.set(DX, DH + 0.06, 0.07); g.add(frameTop);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, DH, 0.14), brassMat);
    post.position.set(DX + s * (DW / 2 + 0.06), DH / 2, 0.07); g.add(post);
    const leaf = tag(new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.02, DH - 0.02, 0.06), doorMat));
    leaf.position.set(DX + s * DW / 4, DH / 2, 0.04); g.add(leaf);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 10), brassMat);
    bar.position.set(DX + s * 0.12, 1.1, 0.1); g.add(bar);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), darkMat);
    win.position.set(DX + s * DW / 4, 1.85, 0.072); g.add(win);
  }
  // 관 번호 라이트박스
  const sign = tag(new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.52), new THREE.MeshBasicMaterial({ map: theaterSign(k), toneMapped: false })));
  sign.position.set(DX, DH + 0.5, 0.06); g.add(sign);
  // 상영 안내 모니터 (16:9)
  const monBox = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.33, 0.08), darkMat);
  monBox.position.set(DX, 4.15, 0.06); g.add(monBox);
  const monMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mon = tag(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.24), monMat));
  mon.position.set(DX, 4.15, 0.102); g.add(mon);
  makeMonitor(a, k, monMat);
  // 포스터 라이트박스
  const PX = -1.75;
  const pGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  pGlow.position.set(PX, 1.95, 0.01); g.add(pGlow);
  const pFrame = new THREE.Mesh(new THREE.BoxGeometry(1.58, 2.22, 0.1), brassMat);
  pFrame.position.set(PX, 1.95, 0.05); g.add(pFrame);
  const posterMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const poster = tag(new THREE.Mesh(new THREE.PlaneGeometry(1.44, 2.06), posterMat));
  poster.position.set(PX, 1.95, 0.102); g.add(poster);
  makePoster(a, k, posterMat);
  // 문 앞 바닥 조명
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.012, 1.0); g.add(pool);

  scene.add(g);
  doorAnchors.push(mon);
  spots.push({ x: wallX + (left ? VIEW_DIST : -VIEW_DIST), z, yaw: left ? Math.PI / 2 : -Math.PI / 2, pitch: -0.12 });
});

// ---------- 메인 스크린 (안쪽 벽) : 모든 기사 사진 슬라이드 ----------
const SW = 9.2, SH = SW / 2.39, SY = 0.9 + SH / 2;
const scrCanvas = document.createElement('canvas'); scrCanvas.width = 1912; scrCanvas.height = 800;
const scrG = scrCanvas.getContext('2d');
const scrTex = new THREE.CanvasTexture(scrCanvas); scrTex.colorSpace = THREE.SRGBColorSpace;
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false, fog: false }));
screen.position.set(0, SY, -HALL_L + 0.12); scene.add(screen);
clickables.push(screen);
const screenBorder = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.3, SH + 0.3), new THREE.MeshBasicMaterial({ color: 0x000000 }));
screenBorder.position.set(0, SY, -HALL_L + 0.1); scene.add(screenBorder);
// 커튼
const curtainTex = canvasTex(512, 512, (g, w, h) => {
  for (let x = 0; x < w; x++) {
    const v = 0.55 + 0.45 * Math.sin(x / w * Math.PI * 10);
    g.fillStyle = `rgb(${Math.round(70 + 110 * v)},${Math.round(8 + 10 * v)},${Math.round(18 + 18 * v)})`;
    g.fillRect(x, 0, 1, h);
  }
});
const curtainMat = new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.8 });
for (const s of [-1, 1]) {
  const c = new THREE.Mesh(new THREE.PlaneGeometry(1.25, HALL_H - 0.3), curtainMat);
  c.position.set(s * (SW / 2 + 0.55), (HALL_H - 0.3) / 2, -HALL_L + 0.2); scene.add(c);
}
const valance = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, 0.7), curtainMat);
valance.position.set(0, HALL_H - 0.35, -HALL_L + 0.22); scene.add(valance);
// 영사기 빛줄기
const beamLen = HALL_L - 1;
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.4, beamLen, 32, 1, true), new THREE.MeshBasicMaterial({
  color: 0xcfe0ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
beam.position.set(0, (HALL_H - 0.4 + SY) / 2, -beamLen / 2 - 0.5);
beam.lookAt(0, SY, -HALL_L); beam.rotateX(-Math.PI / 2);   // 좁은 쪽이 영사기(입구) 쪽
scene.add(beam);

// 슬라이드: 기사마다 사진 3장씩, 기사를 번갈아 가며
const slides = [];
for (let i = 0; i < 3; i++) ARTICLES.forEach((a, k) => { const p = photosOf(a)[i]; if (p) slides.push({ src: p, k }); });
const scr = { cur: null, next: null, fade: 1, i: -1, timer: 0, k: 0 };
function paintScreen() {
  const W = scrCanvas.width, H = scrCanvas.height, g = scrG;
  const layer = (s, alpha) => {
    if (!s || !s.im) return;
    g.globalAlpha = alpha;
    g.filter = 'blur(28px) brightness(.45)'; drawCover(g, s.im, -40, -40, W + 80, H + 80); g.filter = 'none';
    drawContain(g, s.im, 0, 0, W, H);
  };
  g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  layer(scr.cur, 1);
  if (scr.next) layer(scr.next, scr.fade);
  g.globalAlpha = 1;
  const show = scr.next && (scr.fade > 0.5 || !scr.cur) ? scr.next : scr.cur;
  if (show) {
    const a = ARTICLES[show.k];
    const grd = g.createLinearGradient(0, H - 170, 0, H); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.8)');
    g.fillStyle = grd; g.fillRect(0, H - 170, W, 170);
    g.fillStyle = SQ; g.font = "44px 'Bebas Neue', sans-serif"; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText(`THEATER ${show.k + 1}  ·  ${a.date}`, 60, H - 92);
    g.fillStyle = '#fff'; g.font = "700 46px 'Noto Sans KR', sans-serif";
    g.fillText(wrapLines(g, a.title, W - 120, 1)[0], 60, H - 36);
  } else {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "160px 'Bebas Neue', sans-serif"; g.fillText('MELON MAGAZINE', W / 2, H / 2);
  }
  scrTex.needsUpdate = true;
}
async function nextSlide() {
  if (!slides.length) return;
  scr.i = (scr.i + 1) % slides.length;
  const s = slides[scr.i];
  const im = await loadImg(s.src);
  if (!im) { scr.timer = 0.5; return; }
  if (scr.next) scr.cur = scr.next;
  scr.next = { im, k: s.k }; scr.fade = 0;
}
paintScreen();
nextSlide();

// ---------- 아바타 ----------
function nameTex(name, status, color) {
  return canvasTex(512, 160, (g, w) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "700 46px 'Noto Sans KR', sans-serif";
    const tw = Math.min(w - 20, g.measureText(name).width + 50);
    g.fillStyle = 'rgba(10,8,9,.72)';
    g.beginPath(); g.roundRect((w - tw) / 2, 74, tw, 64, 32); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc((w - tw) / 2 + 22, 106, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.fillText(name, w / 2 + 8, 107);
    if (status) {
      g.font = "500 32px 'Noto Sans KR', sans-serif"; g.fillStyle = '#ffd9a0';
      g.fillText(status, w / 2, 36);
    }
  });
}
function makeAvatar(name, color) {
  const root = new THREE.Group();
  const col = new THREE.Color(color);
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf6eee6, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 14), bodyMat);
  body.position.y = 0.92; root.add(body);
  const head = new THREE.Group(); head.position.y = 1.48; root.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 22, 16), skin));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), black);
    eye.position.set(s * 0.075, 0.03, -0.19); head.add(eye);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), bodyMat);   // 헤드폰
    cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.215, 0, 0); head.add(cup);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 24, Math.PI), black);
  band.position.y = 0.01; head.add(band);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.1, 0.56, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 10), black);
    leg.position.y = -0.26; pivot.add(leg); root.add(pivot);
    return pivot;
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; root.add(shadow);

  const tagMat = new THREE.SpriteMaterial({ map: nameTex(name, '', color), depthWrite: false });
  const tagSprite = new THREE.Sprite(tagMat);
  tagSprite.scale.set(1.15, 0.36, 1); tagSprite.position.y = 2.0; root.add(tagSprite);

  const av = { root, legs, head, phase: 0, name, color, status: '', tagMat };
  av.setTag = (n, status) => {
    if (n === av.name && status === av.status) return;
    av.name = n; av.status = status;
    tagMat.map.dispose(); tagMat.map = nameTex(n, status, av.color); tagMat.needsUpdate = true;
  };
  av.animate = (speed, dt) => {
    const moving = speed > 0.15;
    av.phase += dt * (moving ? Math.min(speed, 6) * 3.2 : 0);
    const amp = moving ? 0.55 : 0;
    legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, Math.sin(av.phase) * amp, 0.3);
    legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, -Math.sin(av.phase) * amp, 0.3);
    body.position.y = 0.92 + (moving ? Math.abs(Math.sin(av.phase)) * 0.04 : Math.sin(performance.now() / 600) * 0.008);
    head.position.y = body.position.y + 0.56;
  };
  scene.add(root);
  return av;
}

// 리액션 이모지 (머리 위로 떠오름)
const floating = [];
function emoteAt(av, e) {
  const tex = canvasTex(128, 128, (g) => { g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.5, 0.5, 1); s.position.set((Math.random() - 0.5) * 0.3, 2.3, 0);
  av.root.add(s); floating.push({ s, t: 0, av });
}

// ---------- 나 (플레이어) ----------
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const nickEl = document.getElementById('nick');
nickEl.value = qs.get('name') || store.get('mm-cinema-name', '') || `관객${Math.floor(100 + Math.random() * 900)}`;
let myColor = store.get('mm-cinema-color', AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
const sw = document.getElementById('swatches');
AVATAR_COLORS.forEach((c) => {
  const b = document.createElement('button'); b.style.background = c; b.title = c;
  b.classList.toggle('on', c === myColor);
  b.onclick = () => { myColor = c; sw.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  sw.append(b);
});

const START = { x: 0, z: -2.5, yaw: 0, pitch: 0 };
const me = { x: START.x, z: START.z, yaw: START.yaw, av: null, speed: 0 };
let pitch = 0;
let thirdPerson = qs.get('view') !== '1';
const viewBtn = document.getElementById('btn-view');
function setView(tp) {
  thirdPerson = tp; viewBtn.textContent = tp ? '👁 3인칭' : '👁 1인칭';
  if (me.av) me.av.root.visible = tp;
}
viewBtn.onclick = () => setView(!thirdPerson);

// ---------- 이동·시점 ----------
const keys = new Set();
const RUN = 2.0, SPEED = 3.2, TURN = 1.9;
const BOUND_X = HALL_W / 2 - 0.6, BOUND_ZMIN = -HALL_L + 1.2, BOUND_ZMAX = -0.6;
let fly = null, tour = null, readerOpen = false, entered = false;

addEventListener('keydown', (e) => {
  if (!entered || (e.target.closest && e.target.closest('input, textarea'))) return;
  if (readerOpen) {
    if (e.key === 'Escape') closeReader();
    if (e.key === 'ArrowLeft') openReader(cur - 1);
    if (e.key === 'ArrowRight') openReader(cur + 1);
    return;
  }
  if (e.key === 'Enter') { const n = nearestTheater(); if (n) { stopTour(); openReader(n.k); } return; }
  if (e.code === 'KeyV') { setView(!thirdPerson); return; }
  const em = { Digit1: '👏', Digit2: '❤️', Digit3: '😂', Digit4: '🍿' }[e.code];
  if (em) { sendEmote(em); return; }
  keys.add(e.code);
  if (e.code.startsWith('Key') || e.code.startsWith('Arrow')) { stopTour(); fly = null; }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let drag = null;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.moved > 6) {
    stopTour(); fly = null;
    me.yaw += dx * 0.0035;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0025, -0.7, 0.7);
  }
});
cvs.addEventListener('pointerup', (e) => { if (drag && drag.moved <= 6) pick(e.clientX, e.clientY); drag = null; });

const ray = new THREE.Raycaster();
function pick(cx, cy) {
  ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(clickables)[0];
  if (!hit) return;
  const k = hit.object === screen ? (scr.next || scr.cur || { k: 0 }).k : hit.object.userData.index;
  stopTour();
  const s = spots[k];
  if (Math.hypot(me.x - s.x, me.z - s.z) < 0.5) openReader(k);
  else flyTo(s, Math.max(1.2, Math.hypot(me.x - s.x, me.z - s.z) / 4), () => openReader(k));
}

function angleLerp(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function flyTo(s, dur, done) {
  fly = { fx: me.x, fz: me.z, fyaw: me.yaw, fpitch: pitch, tx: s.x, tz: s.z, tyaw: s.yaw, tpitch: s.pitch || 0, t: 0, dur, done };
}

document.querySelectorAll('#pad button').forEach((b) => {
  const code = { fwd: 'KeyW', back: 'KeyS', left: 'ArrowLeft', right: 'ArrowRight' }[b.dataset.k];
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(code); stopTour(); fly = null; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => keys.delete(code)));
});
document.querySelectorAll('#emotes button').forEach((b) => (b.onclick = () => sendEmote(b.dataset.e)));

// ---------- 자동 관람 ----------
const tourBtn = document.getElementById('btn-tour');
tourBtn.onclick = () => (tour ? stopTour() : startTour());
document.getElementById('btn-home').onclick = () => { stopTour(); flyTo(START, 1.8); };
function startTour() {
  const n = nearestTheater();
  tour = { k: n ? n.k : 0, wait: 0 };
  tourBtn.classList.add('on'); tourBtn.textContent = '■ 관람 멈춤';
  tourStep();
}
function tourStep() {
  if (!tour) return;
  const s = spots[tour.k];
  flyTo(s, Math.max(1.6, Math.hypot(me.x - s.x, me.z - s.z) / 1.8), () => { if (tour) tour.wait = 6; });
}
function stopTour() {
  if (!tour) return;
  tour = null; fly = null;
  tourBtn.classList.remove('on'); tourBtn.textContent = '▶ 자동 관람';
}

// ---------- 상영 안내 (기사 읽기) ----------
const reader = document.getElementById('reader');
const sheet = reader.querySelector('.sheet');
const art = reader.querySelector('article');
let cur = 0;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
function openReader(k) {
  if (!ARTICLES.length) return;
  cur = (k + ARTICLES.length) % ARTICLES.length;
  const a = ARTICLES[cur];
  art.replaceChildren();
  const hero = el('div', 'hero'); const hi = el('img'); hi.src = a.cover; hi.alt = a.title; hero.append(hi); art.append(hero);
  const head = el('div', 'head');
  const no = el('div', 'no', `THEATER ${String(cur + 1).padStart(2, '0')} · ${cur + 1}관`); no.append(el('em', null, '상영중'));
  const facts = el('div', 'facts');
  const fact = (label, val) => { const s = el('span', null, label); s.append(el('b', null, val)); facts.append(s); };
  fact('개봉', a.date); fact('상영시간', `약 ${readMin(a)}분`); fact('스틸컷', `${photosOf(a).length}장`);
  const rate = el('span'); rate.append(el('span', 'rate', 'ALL'), document.createTextNode(' 전체관람가')); facts.append(rate);
  head.append(no, el('h1', null, a.title), facts);
  art.append(head);

  const body = el('div', 'body');
  a.blocks.forEach((b, i) => {
    if (b.type === 'h') {
      if (i === 0 && b.text === a.title) return;
      const isQ = /^Q[.\s]/.test(b.text);
      const h = el('h2', isQ ? 'q' : null);
      if (b.label && !isQ) h.append(el('span', 'tag', b.label));
      h.append(document.createTextNode(b.text));
      body.append(h);
    } else if (b.type === 'p') body.append(el('p', null, b.text));
    else if (b.type === 'img') {
      const f = el('figure'); const im = el('img'); im.loading = 'lazy'; im.src = b.src; im.alt = ''; f.append(im); body.append(f);
    } else if (b.type === 'album') {
      const d = el('div', 'album'); const im = el('img'); im.src = b.src; im.alt = '앨범 커버'; d.append(im); body.append(d);
    }
  });
  art.append(body);
  const src = el('div', 'src');
  src.append(el('span', null, '출처: 멜론 매거진'));
  const link = el('a', null, '멜론에서 원문 보기 ↗'); link.href = a.url; link.target = '_blank'; link.rel = 'noopener';
  src.append(link); art.append(src);

  sheet.scrollTop = 0;
  reader.classList.add('open'); readerOpen = true; keys.clear();
  labelEl.classList.remove('show'); lastLabel = -2;
  netDirty = true;
}
function closeReader() {
  reader.classList.remove('open'); readerOpen = false; netDirty = true;
  if (spots[cur]) flyTo(spots[cur], 0.9);
}
reader.querySelector('.close').onclick = closeReader;
reader.querySelector('.prev').onclick = () => openReader(cur - 1);
reader.querySelector('.next').onclick = () => openReader(cur + 1);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeReader(); });

// ---------- 근처 상영관 안내 ----------
const labelEl = document.getElementById('label');
function nearestTheater() {
  const fwd = new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
  let best = null;
  doorAnchors.forEach((m, k) => {
    const p = m.getWorldPosition(new THREE.Vector3());
    const to = new THREE.Vector3(p.x - me.x, 0, p.z - me.z);
    const d = to.length();
    if (d > 5.5 || to.normalize().dot(fwd) < 0.5) return;
    if (!best || d < best.d) best = { k, d };
  });
  return best;
}
let lastLabel = -1;
function updateLabel() {
  if (readerOpen || !entered) return;
  const n = nearestTheater();
  const k = n ? n.k : -1;
  if (k === lastLabel) return;
  lastLabel = k;
  if (k < 0) { labelEl.classList.remove('show'); return; }
  const a = ARTICLES[k];
  const viewers = [...others.values()].filter((o) => o.r === k).length;
  labelEl.replaceChildren(el('div', 'no', `THEATER ${String(k + 1).padStart(2, '0')} · ${k + 1}관`), el('b', null, a.title),
    el('small', null, `${a.date} 개봉 · 상영시간 약 ${readMin(a)}분${viewers ? ` · ${viewers}명 관람 중` : ''}`));
  const btn = el('button', null, '🎟 입장하기');
  btn.onclick = () => { stopTour(); openReader(k); };
  labelEl.append(document.createElement('br'), btn);
  labelEl.classList.add('show');
}

// ---------- 실시간 동기화 (다른 관객) ----------
const others = new Map();   // id → { av, x, z, yaw, tx, tz, tyaw, r }
const onlineEl = document.getElementById('online');
let ws = null, myId = null, netDirty = true, lastSent = 0, retry = 1000, pingTimer = null;
const statusOf = (r) => (r >= 0 && r < ARTICLES.length ? `🎬 ${r + 1}관 관람 중` : '');
function setOnline() {
  const n = others.size + 1;
  const live = ws && ws.readyState === 1 && myId;
  onlineEl.classList.toggle('live', !!live);
  onlineEl.querySelector('span').textContent = live ? `지금 ${n}명 관람 중` : '혼자 관람 중 · 서버 연결 대기';
}
function upsert(p) {
  let o = others.get(p.id);
  if (o && o.color !== p.color) { scene.remove(o.av.root); o = null; }
  if (!o) {
    o = { av: makeAvatar(p.name, p.color), color: p.color, x: p.x, z: p.z, yaw: p.yaw };
    others.set(p.id, o);
  }
  Object.assign(o, { tx: p.x, tz: p.z, tyaw: p.yaw, r: p.r ?? -1, name: p.name });
  o.av.setTag(p.name, statusOf(o.r));
  lastLabel = -2;
}
function removeOther(id) {
  const o = others.get(id);
  if (o) { scene.remove(o.av.root); others.delete(id); lastLabel = -2; }
}
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function connect() {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room`;
  try { ws = new WebSocket(url); } catch { ws = null; setOnline(); return; }
  ws.onopen = () => {
    retry = 1000;
    send({ t: 'hello', name: me.av.name, color: me.av.color, x: me.x, z: me.z, yaw: me.yaw });
    clearInterval(pingTimer);
    pingTimer = setInterval(() => ws && ws.readyState === 1 && ws.send('ping'), 25000);
  };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'welcome') { myId = m.id; m.players.forEach(upsert); netDirty = true; }
    else if (m.t === 'join' || m.t === 'upd') upsert(m.p);
    else if (m.t === 'pos') {
      const o = others.get(m.id);
      if (o) { o.tx = m.x; o.tz = m.z; o.tyaw = m.yaw; if (o.r !== m.r) { o.r = m.r; o.av.setTag(o.name, statusOf(o.r)); lastLabel = -2; } }
    } else if (m.t === 'leave') removeOther(m.id);
    else if (m.t === 'emote') { const o = others.get(m.id); if (o) emoteAt(o.av, m.e); }
    setOnline();
  };
  ws.onclose = () => {
    myId = null; clearInterval(pingTimer);
    [...others.keys()].forEach(removeOther);
    setOnline();
    setTimeout(connect, retry); retry = Math.min(retry * 2, 30000);
  };
  setOnline();
}
let lastNet = { x: 0, z: 0, yaw: 0, r: -1 };
function netTick(now) {
  if (!myId || now - lastSent < 100) return;
  const r = readerOpen ? cur : -1;
  if (!netDirty && Math.abs(me.x - lastNet.x) < 0.01 && Math.abs(me.z - lastNet.z) < 0.01 &&
      Math.abs(me.yaw - lastNet.yaw) < 0.01 && r === lastNet.r) return;
  lastNet = { x: me.x, z: me.z, yaw: me.yaw, r };
  send({ t: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), r });
  lastSent = now; netDirty = false;
}
function sendEmote(e) {
  if (!me.av) return;
  emoteAt(me.av, e);
  send({ t: 'emote', e });
}

// ---------- 입장 ----------
document.getElementById('enter').onclick = () => {
  const name = nickEl.value.trim().slice(0, 12) || '관객';
  store.set('mm-cinema-name', name); store.set('mm-cinema-color', myColor);
  document.getElementById('intro').classList.add('hide');
  entered = true;
  me.av = makeAvatar(name, myColor);
  setView(thirdPerson);
  const spot = spots[+qs.get('spot')];
  if (qs.has('spot') && spot) { me.x = spot.x; me.z = spot.z; me.yaw = spot.yaw; pitch = spot.pitch; }
  const at = (qs.get('at') || '').split(',').map(Number);   // ?at=x,z,yaw (테스트용 위치 지정)
  if (at.length === 3 && at.every(Number.isFinite)) { me.x = at[0]; me.z = at[1]; me.yaw = at[2]; }
  if (qs.has('read')) openReader(+qs.get('read') || 0);
  camSnap = true;
  connect();
};

// ---------- 카메라 ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camSnap = true;
function updateCamera(dt) {
  if (!thirdPerson || !me.av) {
    camera.position.set(me.x, EYE + (me.speed > 0.2 ? Math.sin(performance.now() / 160) * 0.015 : 0), me.z);
    camera.rotation.set(-pitch, me.yaw, 0);
    camSnap = true;
    return;
  }
  const back = 3.3, up = 2.5;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  const want = new THREE.Vector3(
    THREE.MathUtils.clamp(me.x - fx * back, -HALL_W / 2 + 0.25, HALL_W / 2 - 0.25),
    up,
    THREE.MathUtils.clamp(me.z - fz * back, -HALL_L + 0.3, -0.25));
  const look = new THREE.Vector3(me.x + fx * 4, 1.7 - Math.tan(pitch) * 4.5, me.z + fz * 4);
  const t = camSnap ? 1 : 1 - Math.exp(-dt * 9);
  camPos.lerp(want, t); camLook.lerp(look, t);
  if (camSnap) { camPos.copy(want); camLook.copy(look); camSnap = false; }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------- 루프 ----------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const px = me.x, pz = me.z;
  if (fly) {
    fly.t += dt / fly.dur;
    const t = ease(Math.min(fly.t, 1));
    me.x = THREE.MathUtils.lerp(fly.fx, fly.tx, t);
    me.z = THREE.MathUtils.lerp(fly.fz, fly.tz, t);
    me.yaw = angleLerp(fly.fyaw, fly.tyaw, t);
    pitch = THREE.MathUtils.lerp(fly.fpitch, fly.tpitch, t);
    if (fly.t >= 1) { const done = fly.done; fly = null; done && done(); }
  } else if (tour && tour.wait > 0) {
    tour.wait -= dt;
    if (tour.wait <= 0) { tour.k++; if (tour.k >= ARTICLES.length) { stopTour(); flyTo(START, 2); } else tourStep(); }
  } else if (!readerOpen && entered) {
    const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : 1) * SPEED * dt;
    if (keys.has('ArrowLeft')) me.yaw += TURN * dt;
    if (keys.has('ArrowRight')) me.yaw -= TURN * dt;
    let f = 0, s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA')) s -= 1;
    if (keys.has('KeyD')) s += 1;
    if (f || s) {
      const len = Math.hypot(f, s); f /= len; s /= len;
      me.x += (-Math.sin(me.yaw) * f + Math.cos(me.yaw) * s) * sp;
      me.z += (-Math.cos(me.yaw) * f - Math.sin(me.yaw) * s) * sp;
    }
  }
  me.x = THREE.MathUtils.clamp(me.x, -BOUND_X, BOUND_X);
  me.z = THREE.MathUtils.clamp(me.z, BOUND_ZMIN, BOUND_ZMAX);
  me.speed = Math.hypot(me.x - px, me.z - pz) / Math.max(dt, 1e-3);
  if (me.av) { me.av.root.position.set(me.x, 0, me.z); me.av.root.rotation.y = me.yaw; me.av.animate(me.speed, dt); }

  // 다른 관객 보간
  const k = 1 - Math.exp(-dt * 10);
  for (const o of others.values()) {
    const ox = o.x, oz = o.z;
    o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.yaw = angleLerp(o.yaw, o.tyaw, k);
    o.av.root.position.set(o.x, 0, o.z); o.av.root.rotation.y = o.yaw;
    o.av.animate(Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-3), dt);
  }
  for (let i = floating.length - 1; i >= 0; i--) {
    const f = floating[i]; f.t += dt / 1.8;
    f.s.position.y = 2.3 + f.t * 1.0; f.s.material.opacity = 1 - f.t;
    if (f.t >= 1) { f.av.root.remove(f.s); f.s.material.map.dispose(); floating.splice(i, 1); }
  }

  // 스크린 슬라이드
  if (scr.next && scr.fade < 1) { scr.fade = Math.min(1, scr.fade + dt / 1.2); paintScreen(); }
  else { scr.timer += dt; if (scr.timer > 6) { scr.timer = 0; nextSlide(); } }

  updateCamera(dt);
  updateLabel();
  netTick(performance.now());
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
