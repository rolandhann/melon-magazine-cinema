// 매거진 시네마: 정적 파일 + 실시간 아바타 동기화 (Cloudflare Worker + Durable Object)
// /api/room  → WebSocket. 같은 방(lobby)에 들어온 사람끼리 위치·상태를 주고받습니다.
// 그 외 경로 → public/ 정적 파일
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 60;
const MAX_MSG = 600;      // 바이트
const COLORS = /^#[0-9a-f]{6}$/i;

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, max);
const num = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

export class Lounge extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 연결 유지용 ping 은 깨우지 않고 자동 응답
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), joined: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  players(except) {
    return this.ctx.getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment())
      .filter((p) => p && p.joined);
  }

  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const p = ws.deserializeAttachment();
      if (!p || !p.joined) continue;
      try { ws.send(s); } catch {}
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const p = ws.deserializeAttachment();
    if (!p) return;

    if (m.t === 'hello') {
      p.name = clean(m.name, 12) || '관객';
      p.color = COLORS.test(m.color) ? m.color : '#00cd3c';
      p.x = num(m.x, 200); p.z = num(m.z, 200); p.yaw = num(m.yaw, 100); p.r = -1;
      const first = !p.joined;
      p.joined = true;
      ws.serializeAttachment(p);
      ws.send(JSON.stringify({ t: 'welcome', id: p.id, players: this.players(ws) }));
      this.broadcast({ t: first ? 'join' : 'upd', p }, ws);
    } else if (m.t === 'pos' && p.joined) {
      p.x = num(m.x, 200); p.z = num(m.z, 200); p.yaw = num(m.yaw, 100);
      if (Number.isInteger(m.r)) p.r = Math.max(-1, Math.min(999, m.r));
      ws.serializeAttachment(p);
      this.broadcast({ t: 'pos', id: p.id, x: p.x, z: p.z, yaw: p.yaw, r: p.r }, ws);
    } else if (m.t === 'emote' && p.joined) {
      const e = clean(m.e, 4);
      if (e) this.broadcast({ t: 'emote', id: p.id, e }, ws);
    }
  }

  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }
  leave(ws) {
    const p = ws.deserializeAttachment();
    if (p && p.joined) { p.joined = false; ws.serializeAttachment(p); this.broadcast({ t: 'leave', id: p.id }, ws); }
    try { ws.close(1000, 'bye'); } catch {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/room') {
      const stub = env.ROOM.get(env.ROOM.idFromName('lobby'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
