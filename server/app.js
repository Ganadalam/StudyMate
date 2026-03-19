'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

try { const h=require('helmet'); app.use(h({contentSecurityPolicy:false})); } catch(_){}
try { const m=require('morgan'); app.use(m('[:date[clf]] :method :url :status :response-time ms')); } catch(_){}
try {
  const rL = require('express-rate-limit');
  app.use('/api', rL({ windowMs:15*60*1000, max:600, standardHeaders:true, legacyHeaders:false,
    message:{error:'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'} }));
  app.use('/api/auth/login', rL({ windowMs:15*60*1000, max:20,
    message:{error:'로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'} }));
} catch(_){}

app.use(cors());
app.use(express.json({ limit:'2mb' }));
app.use(express.urlencoded({ extended:false }));
app.use(express.static(path.join(__dirname,'../public'),{ maxAge:'1h', etag:true }));

/* ── ROUTES ────────────────────────────────────────────── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/rooms',         require('./routes/room'));
app.use('/api/favorites',     require('./routes/favorite'));
app.use('/api/users',         require('./routes/user'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/reservations',  require('./routes/reservation'));
app.use('/api/files',         require('./routes/file'));

/* ── SPA ───────────────────────────────────────────────── */
const send = (f)=>(_,res)=>res.sendFile(path.join(__dirname,'../public/pages',f));
app.get('/',      send('index.html'));
app.get('/user',  send('user.html'));
app.get('/admin', send('admin.html'));

/* ── MULTER ERROR ──────────────────────────────────────── */
app.use((err,req,res,next)=>{
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: '파일 크기는 50MB 이하여야 합니다.' });
  if (err.message && err.message.includes('허용되지 않는'))
    return res.status(400).json({ error: err.message });
  next(err);
});

/* ── ERROR HANDLERS ────────────────────────────────────── */
app.use((req,res)=>{
  if(req.path.startsWith('/api/'))
    return res.status(404).json({error:`Not found: ${req.method} ${req.path}`});
  res.status(404).sendFile(path.join(__dirname,'../public/pages/index.html'));
});
app.use((err,req,res,_next)=>{
  const status=err.status||500;
  const msg=process.env.NODE_ENV==='production'&&status===500
    ?'서버 오류가 발생했습니다.':(err.message||'알 수 없는 오류');
  if(status>=500) console.error('[ERROR]',err.stack||err.message);
  res.status(status).json({error:msg});
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`\n🚀 StudyMate v3.0  →  http://localhost:${PORT}`);
  console.log(`   admin/admin123  |  user1~3/user123\n`);
});
module.exports=app;
