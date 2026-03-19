'use strict';
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const { verify, requireAdmin } = require('../controllers/authController');
const ctrl     = require('../controllers/fileController');

/* ── Multer 설정 ──────────────────────────── */
const UPLOAD_DIR   = path.join(__dirname, '../uploads');
const MAX_SIZE     = 50 * 1024 * 1024;
const ALLOWED_EXTS = new Set(['.pdf','.ppt','.pptx','.doc','.docx','.xls','.xlsx','.zip','.jpg','.jpeg','.png','.gif','.txt','.md','.hwp']);

/* uploads 디렉토리가 없으면 생성 — multer storage 초기화 전에 위치해야 함 */
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('[BOOT] uploads 디렉토리 생성:', UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.has(ext)) return cb(null, true);
    cb(new Error(`허용되지 않는 파일 형식입니다: ${ext}`));
  }
});

/* ── ROUTES ───────────────────────────────── */
router.get('/search',                   verify, ctrl.search);
router.get('/team',                     verify, ctrl.teamFiles);
router.get('/storage-stats',            verify, requireAdmin, ctrl.storageStats);

router.get('/sessions',                 verify, ctrl.timeline);
router.get('/sessions/:resId',          verify, ctrl.session);
router.put('/sessions/:resId/note',     verify, ctrl.saveNote);

router.get('/by-reservation/:resId',    verify, ctrl.listByReservation);

router.post('/upload',                  verify, upload.single('file'), ctrl.upload);
router.get('/:id/download',             verify, ctrl.download);
router.patch('/:id',                    verify, ctrl.update);
router.delete('/:id',                   verify, ctrl.remove);

router.post('/links',                   verify, ctrl.addLink);
router.delete('/links/:id',             verify, ctrl.removeLink);

module.exports = router;
