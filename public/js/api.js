'use strict';

/* ── AUTH ──────────────────────────────────────────────── */
const auth = {
  _k: { t:'sm_token', r:'sm_role', u:'sm_user', g:'sm_team', n:'sm_name' },
  save(token, role, username, team, displayName='') {
    localStorage.setItem(this._k.t, token);
    localStorage.setItem(this._k.r, role);
    localStorage.setItem(this._k.u, username);
    localStorage.setItem(this._k.g, team || '');
    localStorage.setItem(this._k.n, displayName || username);
  },
  clear()       { Object.values(this._k).forEach(k => localStorage.removeItem(k)); },
  token()       { return localStorage.getItem(this._k.t); },
  role()        { return localStorage.getItem(this._k.r); },
  username()    { return localStorage.getItem(this._k.u); },
  team()        { return localStorage.getItem(this._k.g) || ''; },
  displayName() { return localStorage.getItem(this._k.n) || this.username(); },
  loggedIn()    { return !!this.token(); },
  isAdmin()     { return this.role() === 'admin'; },
  guard(role) {
    if (!this.loggedIn()) { location.href = '/pages/index.html'; return false; }
    if (role && this.role() !== role) {
      location.href = this.isAdmin() ? '/pages/admin.html' : '/pages/user.html';
      return false;
    }
    return true;
  },
  logout() { this.clear(); location.href = '/pages/index.html'; }
};

/* ── API CLIENT ────────────────────────────────────────── */
const api = {
  async _req(method, path, body) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth.token() ? { 'Authorization': `Bearer ${auth.token()}` } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
    } catch { throw new Error('네트워크 연결을 확인해주세요.'); }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      console.error(`[API] Non-JSON ${res.status} ${method} ${path}:`, text.slice(0,200));
      throw new Error(`서버 오류 (${res.status})`);
    }
    if (res.status === 401 && auth.loggedIn()) {
      toast(data.error || '세션이 만료됐습니다.', 'warning');
      setTimeout(() => auth.logout(), 1500);
      throw new Error(data.error || '세션 만료');
    }
    if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
    return data;
  },

  // Auth
  login:         b  => api._req('POST',  '/auth/login', b),
  register:      b  => api._req('POST',  '/auth/register', b),
  me:            () => api._req('GET',   '/auth/me'),
  updateProfile: b  => api._req('PATCH', '/auth/profile', b),

  // Rooms
  rooms:         () => api._req('GET',   '/rooms'),
  roomsAll:      () => api._req('GET',   '/rooms/all'),
  updateRoom:    (id,b) => api._req('PATCH', `/rooms/${id}`, b),

  // Reservations
  createReservation:  b  => api._req('POST',  '/reservations', b),
  myReservations:     () => api._req('GET',   '/reservations/mine'),
  teamReservations:   () => api._req('GET',   '/reservations/team'),
  cancelReservation:  id => api._req('PATCH', `/reservations/${id}/cancel`),
  calendarAll:        () => api._req('GET',   '/reservations/calendar'),
  allReservations:    (q='') => api._req('GET', `/reservations/all${q}`),
  stats:              () => api._req('GET',   '/reservations/stats'),
  publicStats:        () => api._req('GET',   '/reservations/public-stats'),
  roomStatus:         (q='') => api._req('GET', `/reservations/room-status${q}`),

  // Favorites
  favorites:        () => api._req('GET',    '/favorites'),
  addFavorite:      b  => api._req('POST',   '/favorites', b),
  removeFavorite:   id => api._req('DELETE', `/favorites/${id}`),

  // Users (admin)
  userList:         () => api._req('GET',    '/users'),
  userStats:        () => api._req('GET',    '/users/stats'),
  updateUser:       (id,b) => api._req('PATCH', `/users/${id}`, b),
  resetUserPw:      (id,b) => api._req('POST',  `/users/${id}/reset-password`, b),
  deleteUser:       id => api._req('DELETE', `/users/${id}`),
  exportCSV:        () => fetch('/api/users/export-csv', {
    headers: { 'Authorization': `Bearer ${auth.token()}` }
  }),

  // Notifications
  notifList:         () => api._req('GET',    '/notifications'),
  notifUnread:       () => api._req('GET',    '/notifications/unread-count'),
  notifRead:         id => api._req('PATCH',  `/notifications/${id}/read`),
  notifReadAll:      () => api._req('PATCH',  '/notifications/read-all'),
  notifCreate:       b  => api._req('POST',   '/notifications', b),
  notifAdminList:    () => api._req('GET',    '/notifications/admin'),
  notifDelete:       id => api._req('DELETE', `/notifications/${id}`),
};

/* ── TOAST ─────────────────────────────────────────────── */
function toast(msg, type='success', duration=3500) {
  const PAL={ success:'#22c55e', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
  const stack=document.getElementById('toast-stack');
  if (!stack) return;
  const el=document.createElement('div');
  el.className='toast';
  el.setAttribute('role','alert');
  el.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${PAL[type]};flex-shrink:0;"></span><span style="flex:1;">${msg}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--txt3);cursor:pointer;padding:0 0 0 8px;font-size:16px;line-height:1;">×</button>`;
  stack.appendChild(el);
  const t=setTimeout(()=>{ el.classList.add('removing'); el.addEventListener('animationend',()=>el.remove(),{once:true}); }, duration);
  el.querySelector('button').addEventListener('click',()=>clearTimeout(t));
}

/* ── HELPERS ────────────────────────────────────────────── */
function fmtDate(ds) {
  const d=new Date(ds+'T00:00:00');
  const M=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const W=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${M[d.getMonth()]} ${d.getDate()}일 (${W[d.getDay()]})`;
}
function relTime(dt) {
  const diff=Date.now()-new Date(dt).getTime(), m=Math.floor(diff/60000), h=Math.floor(m/60), dd=Math.floor(h/24);
  if(m<1)  return '방금 전';
  if(m<60) return `${m}분 전`;
  if(h<24) return `${h}시간 전`;
  if(dd<7) return `${dd}일 전`;
  return new Date(dt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
}
/* CSV 다운로드 트리거 */
async function downloadCSV() {
  try {
    const res = await api.exportCSV();
    if (!res.ok) throw new Error('다운로드 실패');
    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `studymate_reservations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch(e) { toast(e.message,'error'); }
}

window.auth=auth; window.api=api; window.toast=toast;
window.fmtDate=fmtDate; window.relTime=relTime; window.downloadCSV=downloadCSV;

/* ── FILE / SESSION API (append) ─────────── */
Object.assign(api, {
  // 세션 타임라인
  sessions:        (q='') => api._req('GET',  `/files/sessions${q}`),
  session:         id     => api._req('GET',  `/files/sessions/${id}`),
  saveNote:        (id,b) => api._req('PUT',  `/files/sessions/${id}/note`, b),

  // 파일
  filesByRes:      id     => api._req('GET',  `/files/by-reservation/${id}`),
  uploadFile:      fd     => {
    return fetch('/api/files/upload', {
      method:'POST',
      headers:{ Authorization:`Bearer ${auth.token()}` },
      body: fd
    }).then(async r=>{ const t=await r.text(); let d; try{d=JSON.parse(t);}catch{throw new Error(`서버 오류 (${r.status})`);} if(!r.ok) throw new Error(d.error||`오류`); return d; });
  },
  downloadFile:    id     => fetch(`/api/files/${id}/download`, { headers:{ Authorization:`Bearer ${auth.token()}` }}),
  updateFile:      (id,b) => api._req('PATCH', `/files/${id}`, b),
  deleteFile:      id     => api._req('DELETE',`/files/${id}`),

  // 팀 자료함 + 검색
  teamFiles:       (q='') => api._req('GET',  `/files/team${q}`),
  searchFiles:     (q='') => api._req('GET',  `/files/search${q}`),

  // 링크
  addLink:         b      => api._req('POST',  '/files/links', b),
  removeLink:      id     => api._req('DELETE',`/files/links/${id}`),

  // Admin 스토리지
  storageStats:    ()     => api._req('GET',   '/files/storage-stats'),
});
