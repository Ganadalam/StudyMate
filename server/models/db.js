'use strict';
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const DB_PATH = path.join(__dirname, '../studymate.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

/* ════════════════════════════════════════════════
   TABLES
════════════════════════════════════════════════ */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'user',
    team         TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    capacity     INTEGER NOT NULL DEFAULT 10,
    description  TEXT NOT NULL DEFAULT '',
    amenities    TEXT NOT NULL DEFAULT '',
    is_active    INTEGER NOT NULL DEFAULT 1,
    color        TEXT NOT NULL DEFAULT '#3b82f6',
    sort_order   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    room_name    TEXT NOT NULL,
    date         TEXT NOT NULL,
    start_time   TEXT NOT NULL,
    end_time     TEXT NOT NULL,
    headcount    INTEGER NOT NULL,
    purpose      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'confirmed',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    label       TEXT NOT NULL,
    room_name   TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    headcount   INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL,
    target     TEXT NOT NULL DEFAULT 'all',
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'info',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id         INTEGER NOT NULL,
    notification_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, notification_id)
  );

  /* ── 자료(파일) ────────────────────────────── */
  CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id  INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    original_name   TEXT NOT NULL,
    stored_name     TEXT NOT NULL UNIQUE,
    file_type       TEXT NOT NULL,
    file_size       INTEGER NOT NULL DEFAULT 0,
    scope           TEXT NOT NULL DEFAULT 'team',
    tags            TEXT NOT NULL DEFAULT '[]',
    version         INTEGER NOT NULL DEFAULT 1,
    download_count  INTEGER NOT NULL DEFAULT 0,
    expires_at      TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ── 파일 버전 이력 ─────────────────────────── */
  CREATE TABLE IF NOT EXISTS file_versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id      INTEGER NOT NULL,
    version      INTEGER NOT NULL,
    stored_name  TEXT NOT NULL,
    file_size    INTEGER NOT NULL,
    uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ── 세션 메모 ──────────────────────────────── */
  CREATE TABLE IF NOT EXISTS session_notes (
    reservation_id INTEGER PRIMARY KEY,
    user_id        INTEGER NOT NULL,
    content        TEXT NOT NULL DEFAULT '',
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ── 외부 링크 자료 ─────────────────────────── */
  CREATE TABLE IF NOT EXISTS file_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    user_id        INTEGER NOT NULL,
    title          TEXT NOT NULL,
    url            TEXT NOT NULL,
    link_type      TEXT NOT NULL DEFAULT 'general',
    scope          TEXT NOT NULL DEFAULT 'team',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  /* ── 파일 접근 로그 ─────────────────────────── */
  CREATE TABLE IF NOT EXISTS file_access_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id   INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    action    TEXT NOT NULL DEFAULT 'download',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ════════════════════════════════════════════════
   MIGRATIONS (idempotent)
════════════════════════════════════════════════ */
const safeAlter = sql => { try { db.exec(sql); } catch (_) {} };
safeAlter(`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`);
safeAlter(`ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''`);
safeAlter(`ALTER TABLE reservations ADD COLUMN purpose TEXT NOT NULL DEFAULT ''`);
safeAlter(`ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'info'`);
safeAlter(`ALTER TABLE files ADD COLUMN expires_at TEXT`);
safeAlter(`ALTER TABLE files ADD COLUMN description TEXT NOT NULL DEFAULT ''`);

/* ════════════════════════════════════════════════
   SEED ROOMS
════════════════════════════════════════════════ */
if (db.prepare('SELECT COUNT(*) as c FROM rooms').get().c === 0) {
  const roomData = [
    { name:'Room A', display_name:'Room A — 포커스룸', capacity:4,  description:'집중 학습을 위한 소형 스터디룸. 조용한 환경.',      amenities:'화이트보드,모니터,USB 충전포트',        color:'#818cf8', sort_order:1 },
    { name:'Room B', display_name:'Room B — 팀룸',     capacity:8,  description:'팀 회의·발표 연습에 최적화된 중형 스터디룸.',        amenities:'화이트보드,프로젝터,HDMI,USB 충전포트',  color:'#38bdf8', sort_order:2 },
    { name:'Room C', display_name:'Room C — 세미나룸', capacity:16, description:'강의·세미나·그룹 스터디 전용 대형 룸.',             amenities:'빔프로젝터,마이크,화이트보드,에어컨',    color:'#fb923c', sort_order:3 },
    { name:'Room D', display_name:'Room D — 프리미엄', capacity:10, description:'편안한 인테리어의 프리미엄 다목적 스터디룸.',        amenities:'55인치 TV,소파,화이트보드,커피머신',    color:'#f472b6', sort_order:4 },
  ];
  const ins = db.prepare('INSERT INTO rooms(name,display_name,capacity,description,amenities,color,sort_order) VALUES(?,?,?,?,?,?,?)');
  roomData.forEach(r => ins.run(r.name,r.display_name,r.capacity,r.description,r.amenities,r.color,r.sort_order));
}

/* ════════════════════════════════════════════════
   SEED USERS
════════════════════════════════════════════════ */
const seedUser = (username, pw, role, team, display_name) => {
  if (!db.prepare('SELECT id FROM users WHERE username=?').get(username))
    db.prepare('INSERT INTO users(username,password,role,team,display_name) VALUES(?,?,?,?,?)')
      .run(username, bcrypt.hashSync(pw, 10), role, team, display_name);
};
seedUser('admin',  'admin123', 'admin', '운영팀',   '관리자');
seedUser('user1',  'user123',  'user',  '개발팀',   '김개발');
seedUser('user2',  'user123',  'user',  '디자인팀', '이디자인');
seedUser('user3',  'user123',  'user',  '기획팀',   '박기획');

/* ════════════════════════════════════════════════
   SEED RESERVATIONS
════════════════════════════════════════════════ */
if (db.prepare('SELECT COUNT(*) as c FROM reservations').get().c === 0) {
  const users    = db.prepare('SELECT id, team FROM users WHERE role=?').all('user');
  const rooms    = ['Room A','Room B','Room C','Room D'];
  const slots    = [['09:00','10:00'],['10:00','11:00'],['11:00','12:00'],['13:00','14:00'],['14:00','15:00'],['15:00','16:00'],['16:00','17:00'],['17:00','18:00']];
  const purposes = ['팀 주간 회의','프로젝트 기획','발표 연습','코드 리뷰','스터디','디자인 리뷰','1on1 미팅',''];
  const today    = new Date();
  const insertRes = db.prepare('INSERT INTO reservations(user_id,room_name,date,start_time,end_time,headcount,purpose) VALUES(?,?,?,?,?,?,?)');
  for (let offset = -14; offset <= 14; offset++) {
    const dt = new Date(today); dt.setDate(today.getDate() + offset);
    const ds = dt.toISOString().split('T')[0];
    const cnt = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < cnt; i++) {
      const user    = users[Math.floor(Math.random() * users.length)];
      const slot    = slots[Math.floor(Math.random() * slots.length)];
      const room    = rooms[Math.floor(Math.random() * rooms.length)];
      const hc      = 1 + Math.floor(Math.random() * 8);
      const purpose = purposes[Math.floor(Math.random() * purposes.length)];
      try { insertRes.run(user.id, room, ds, slot[0], slot[1], hc, purpose); } catch (_) {}
    }
  }
}

/* ════════════════════════════════════════════════
   SEED NOTIFICATIONS
════════════════════════════════════════════════ */
if (db.prepare('SELECT COUNT(*) as c FROM notifications').get().c === 0) {
  const aid = db.prepare('SELECT id FROM users WHERE username=?').get('admin').id;
  const ins = db.prepare('INSERT INTO notifications(admin_id,target,title,body,type) VALUES(?,?,?,?,?)');
  ins.run(aid,'all','🎉 StudyMate v3.0 오픈!','자료 공유·세션 메모·통합 검색 기능이 추가됐습니다!','success');
  ins.run(aid,'all','📎 자료 공유 안내','예약 완료 후 세션 상세에서 파일·링크를 첨부할 수 있습니다.','info');
}

/* ════════════════════════════════════════════════
   SEED FILES (샘플 자료 - 자료함 동작 확인용)
════════════════════════════════════════════════ */
if (db.prepare('SELECT COUNT(*) as c FROM files').get().c === 0) {
  const firstRes = db.prepare("SELECT id FROM reservations WHERE status='confirmed' ORDER BY id ASC LIMIT 1").get();
  if (firstRes) {
    const users = db.prepare('SELECT id, team FROM users WHERE role=?').all('user');
    const insFile = db.prepare(
      'INSERT INTO files(reservation_id,user_id,title,description,original_name,stored_name,file_type,file_size,scope,tags,version) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
    );
    const sampleFiles = [
      { title:'팀 주간 회의록', desc:'2025년 1분기 주간 회의 요약', fname:'meeting_notes.txt', type:'txt', size:2048, scope:'team' },
      { title:'프로젝트 기획서', desc:'신규 서비스 기획 초안', fname:'project_plan.txt', type:'txt', size:4096, scope:'team' },
      { title:'스터디 자료 모음', desc:'공개 스터디 자료', fname:'study_material.txt', type:'txt', size:1024, scope:'public' },
    ];
    sampleFiles.forEach((f, i) => {
      const user = users[i % users.length];
      const storedName = `seed_${Date.now()}_${i}.txt`;
      // 실제 파일 생성
      const path = require('path');
      const fs   = require('fs');
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(
        path.join(uploadDir, storedName),
        `[샘플 자료] ${f.title}\n\n${f.desc}\n\n이 파일은 StudyMate 시연용 샘플 데이터입니다.`
      );
      try {
        insFile.run(firstRes.id, user.id, f.title, f.desc, f.fname, storedName, f.type, f.size, f.scope, '[]', 1);
      } catch(_) {}
    });
    console.log('[SEED] 샘플 파일 데이터 생성 완료');
  }
}


module.exports = db;
