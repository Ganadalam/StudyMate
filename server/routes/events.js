'use strict';
/**
 * SSE (Server-Sent Events) — 실시간 예약 현황 업데이트
 * GET /api/events  (인증 필요)
 */
const express = require('express');
const router  = express.Router();
const { verify } = require('../controllers/authController');

/* 연결된 클라이언트 집합 */
const clients = new Set();

/* 외부에서 이벤트 발송 호출 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch (_) { clients.delete(res); }
  }
}

router.get('/', verify, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx 버퍼링 비활성화
  res.flushHeaders();

  /* 연결 확인 ping */
  res.write(`event: connected\ndata: {"uid":${req.user.id}}\n\n`);

  clients.add(res);

  /* keepalive 30s */
  const timer = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (_) { clearInterval(timer); clients.delete(res); }
  }, 30000);

  req.on('close', () => { clearInterval(timer); clients.delete(res); });
});

module.exports = { router, broadcast };
