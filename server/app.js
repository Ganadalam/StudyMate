'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

/* ── uploads 디렉토리 보장 */
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

try { const h=require('helmet'); app.use(h({contentSecurityPolicy:false})); } catch(_){}
try { const m=require('morgan'); app.use(m('[:date[clf]] :method :url :status :response-time ms')); } catch(_){}
try {
  const rL = require('express-rate-limit');
  app.use('/api', rL({ windowMs:15*60*1000, max:600, standardHeaders:true, legacyHeaders:false,
    message:{error:'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'} }));
  app.use('/api/auth/login',    rL({ windowMs:15*60*1000, max:20,
    message:{error:'로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'} }));
  app.use('/api/auth/register', rL({ windowMs:60*60*1000, max:10,
    message:{error:'회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.'} }));
} catch(_){}

/* ── CORS: 환경변수로 Origin 제한 (보안 수정) */
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  exposedHeaders: ['Content-Disposition'],
  ...(corsOrigin ? { origin: corsOrigin, credentials: true } : {})
};
app.use(cors(corsOptions));

app.use(express.json({ limit:'2mb' }));
app.use(express.urlencoded({ extended:false }));
app.use(express.static(path.join(__dirname,'../public'),{ maxAge:'1h', etag:true }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/rooms',         require('./routes/room'));
app.use('/api/favorites',     require('./routes/favorite'));
app.use('/api/users',         require('./routes/user'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/reservations',  require('./routes/reservation'));
app.use('/api/files',         require('./routes/file'));
app.use('/api',               require('./routes/task'));

const { router: eventsRouter, broadcast } = require('./routes/events');
app.use('/api/events', eventsRouter);
/* broadcast를 reservation controller에서 쓸 수 있도록 app에 주입 */
app.set('broadcast', broadcast);

const send = (f)=>(_,res)=>res.sendFile(path.join(__dirname,'../public/pages',f));
app.get('/',      send('index.html'));
app.get('/user',  send('user.html'));
app.get('/admin', send('admin.html'));

app.use((req,res)=>{
  if(req.path.startsWith('/api/'))
    return res.status(404).json({error:`Not found: ${req.method} ${req.path}`});
  res.status(404).sendFile(path.join(__dirname,'../public/pages/index.html'));
});

/* #11 에러 핸들러: 특수 케이스 → 일반 500 순으로 */
app.use((err,req,res,next)=>{
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: '파일 크기는 50MB 이하여야 합니다.' });
  if (err.message && err.message.includes('허용되지 않는'))
    return res.status(400).json({ error: err.message });
  const status = err.status || 500;
  const msg = process.env.NODE_ENV === 'production' && status === 500
    ? '서버 오류가 발생했습니다.' : (err.message || '알 수 없는 오류');
  if (status >= 500) console.error('[ERROR]', err.stack || err.message);
  res.status(status).json({ error: msg });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[StudyMate] http://localhost:${PORT}`));

/* ── 예약 리마인더 (30분 전 SSE + DB 알림) ──────────────── */
(function startReminder() {
  const db = require('./models/db');

  setInterval(() => {
    try {
      const bc = app.get('broadcast');
      if (!bc) return;

      const kst    = new Date(Date.now() + 9 * 3600 * 1000);
      const today  = kst.toISOString().split('T')[0];
      const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();

      /* #7 reminder_sent=0 인 것만 조회 → 서버 재시작 후 중복 방지 */
      const rows = db.prepare(`
        SELECT r.id, r.user_id, r.room_name, r.date, r.start_time, r.purpose
        FROM reservations r
        WHERE r.status='confirmed' AND r.date=? AND r.reminder_sent=0
      `).all(today);

      for (const row of rows) {
        const [h, m]   = row.start_time.split(':').map(Number);
        const startMin = h * 60 + m;
        const diff     = startMin - nowMin;
        if (diff < 29 || diff > 31) continue;

        /* DB 플래그 먼저 세팅 → 중복 발송 원천 차단 */
        db.prepare('UPDATE reservations SET reminder_sent=1 WHERE id=?').run(row.id);

        bc('reservation_reminder', {
          reservation_id: row.id,
          user_id:        row.user_id,
          room_name:      row.room_name,
          date:           row.date,
          start_time:     row.start_time,
          purpose:        row.purpose || '',
        });

        try {
          const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
          if (admin) {
            db.prepare(`
              INSERT INTO notifications(admin_id,target,title,body,type) VALUES(?,?,?,?,?)
            `).run(
              admin.id,
              `user_${row.user_id}`,
              `⏰ 예약 30분 전: ${row.room_name}`,
              `${row.date} ${row.start_time} 예약이 30분 후 시작됩니다.${row.purpose ? ' (' + row.purpose + ')' : ''}`,
              'info'
            );
          }
        } catch(_) {}
      }
    } catch(e) { console.error('[Reminder]', e.message); }
  }, 60 * 1000);
})();
