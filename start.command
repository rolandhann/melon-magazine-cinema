#!/bin/bash
# 더블클릭하면 매거진 시네마 서버를 켜고 브라우저로 엽니다. 이 창을 닫으면 서버도 꺼집니다.
# 최신 기사로 바꾸려면 먼저:  python3 fetch_magazine.py
cd "$(dirname "$0")"
(sleep 4 && open "http://localhost:8766/") &
if command -v npx >/dev/null; then
  npx -y wrangler@4 dev --port 8766      # 아바타 실시간 동기화까지 동작
else
  echo "Node.js 가 없어 아바타 동기화 없이 혼자 보기 모드로 엽니다."
  cd public && python3 -m http.server 8766
fi
