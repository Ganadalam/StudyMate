'use strict';
/* ══════════════════════════════════════════════════════
   user-actions.js — 비동기 액션 · API 호출 · 이벤트 디스패처
   user.html 에서 분리됨 
══════════════════════════════════════════════════════ */

async function cancelFromPopup(id){
  const r=allCalData.find(x=>x.id===id)||myResData.find(x=>x.id===id);
  const detail=r?`\n\n${r.room_name} · ${r.date} · ${r.start_time}~${r.end_time}`:'';
  const hasRecur = r&&(r.recurrence_rule||r.recurrence_parent_id);
  let cancelSeries=false;
  if(hasRecur){
    const ans=confirm(`반복 예약입니다.\n\n[확인] 이 예약만 취소\n[취소] 취소 안 함\n\n시리즈 전체 취소는 아래 별도 버튼을 이용하세요.${detail}`);
    if(!ans) return;
  } else {
    if(!confirm(`예약을 취소하시겠습니까?${detail}`)) return;
  }
  try{await api.cancelReservation(id,cancelSeries);toast('취소됐습니다.','warning');await refreshAllData();renderPopupBody();renderTeamPanel();renderCal();renderTodayWidget();updatePreview();}
  catch(e){toast(e.message,'error');}
}

async function cancelSeriesFromPopup(id){
  const r=allCalData.find(x=>x.id===id)||myResData.find(x=>x.id===id);
  const detail=r?`\n\n${r.room_name} 시리즈 전체`:'';
  if(!confirm(`반복 예약 시리즈를 전체 취소하시겠습니까? (오늘 이후 모두)${detail}`)) return;
  try{await api.cancelReservation(id,true);toast('시리즈 전체 취소됐습니다.','warning');await refreshAllData();renderPopupBody();renderTeamPanel();renderCal();renderTodayWidget();updatePreview();}
  catch(e){toast(e.message,'error');}
}
window.cancelSeriesFromPopup=cancelSeriesFromPopup;

async function setTeamPeriod(period,btn){
  teamPeriod=period;
  document.querySelectorAll('[id^="tp-"]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  try{
    teamStatusData=await api.roomStatus(`?period=${period}`);
    renderTeamPanel();
  }catch(e){toast(e.message,'error');}
}
async function refreshTeamStatus(){
  try{
    const [td,sd]=await Promise.all([api.teamReservations(),api.roomStatus(`?period=${teamPeriod}`)]);
    teamData=td; teamStatusData=sd;
    renderTeamPanel();
    toast('새로고침 완료','info',2000);
  }catch(e){toast(e.message,'error');}
}

async function cancelTeamRes(id){
  const r=teamData.find(x=>x.id===id)||(teamStatusData?.reservations||[]).find(x=>x.id===id);
  const detail=r?`\n\n${r.room_name} · ${r.date} · ${r.start_time}~${r.end_time}`:'';
  if(!confirm(`예약을 취소하시겠습니까?${detail}`)) return;
  try{await api.cancelReservation(id);toast('취소됐습니다.','warning');await refreshAllData();renderTeamPanel();renderCal();if(popupDate)renderPopupBody();renderTodayWidget();updatePreview();}
  catch(e){toast(e.message,'error');}
}

/* ── PREVIEW ─────────────────────────────────────────── */

async function submitRes(){
  const s=document.getElementById('f-start').value,e=document.getElementById('f-end').value;
  const purpose=document.getElementById('f-purpose').value.trim();
  const ruleEl=document.getElementById('f-recurrence');
  const recurRule = ruleEl ? ruleEl.value : '';
  if(!selectedDate){toast('캘린더에서 날짜를 선택해주세요.','warning');return;}
  if(!s||!e){toast('시작 및 종료 시간을 선택해주세요.','warning');return;}
  if(s>=e){toast('종료 시간은 시작 시간보다 늦어야 합니다.','error');return;}
  const btn=document.getElementById('submit-btn');
  btn.disabled=true;btn.innerHTML='<span class="spin spin-sm"></span> 처리 중...';
  try{
    const payload={room_name:selectedRoom,date:selectedDate,start_time:s,end_time:e,headcount:hc,purpose};
    if(recurRule) payload.recurrence_rule=recurRule;
    const result=await api.createReservation(payload);
    const msg = result.message || `✅ ${selectedRoom} ${s}~${e} 예약됐습니다!`;
    toast(msg,'success',6000);
    if(result.skipped&&result.skipped.length)
      toast(`⚠️ ${result.skipped.length}건은 충돌로 건너뜀`,'warning',5000);
    document.getElementById('f-start').value='';document.getElementById('f-end').value='';document.getElementById('f-purpose').value='';
    if(ruleEl) ruleEl.value='';
    toggleRecurrenceCount();
    await refreshAllData();renderCal();renderTeamPanel();renderTodayWidget();
    if(selectedDate)renderPrediction(selectedDate);updatePreview();
    if(popupDate&&document.getElementById('popup').style.display==='flex')renderPopupBody();
  }catch(err){toast(err.message,'error',5000);}
  finally{btn.disabled=false;btn.innerHTML='<i class="bi bi-check2-circle"></i> 예약 확정';}
}

/* 반복 횟수 입력 표시/숨김 */
function toggleRecurrenceCount(){
  const ruleEl=document.getElementById('f-recurrence');
  const cntEl=document.getElementById('f-recurrence-count');
  const labelEl=document.getElementById('f-recurrence-count-label');
  const label2El=document.getElementById('f-recurrence-count-label2');
  if(!ruleEl||!cntEl) return;
  const show = !!ruleEl.value;
  cntEl.style.display=show?'inline-block':'none';
  if(labelEl) labelEl.style.display=show?'inline-block':'none';
  if(label2El) label2El.style.display=show?'inline-block':'none';
  /* recurrence_rule에 횟수 붙이기 */
  ruleEl.dataset.type = ruleEl.value;
  updateRecurrenceRule();
}

function updateRecurrenceRule(){
  const ruleEl=document.getElementById('f-recurrence');
  const cntEl=document.getElementById('f-recurrence-count');
  if(!ruleEl||!cntEl) return;
  const type=ruleEl.dataset.type||'';
  if(type) ruleEl.value=type+':'+cntEl.value;
}
async function refreshAllData(){
  const [r0,r1,r2,r3,r4,r5]=await Promise.allSettled([
    api.publicStats(),api.myReservations(),api.calendarAll(),
    api.teamReservations(),api.favorites(),api.roomStatus(`?period=${teamPeriod}`)
  ]);
  if(r0.status==='fulfilled') predStats      =r0.value;
  if(r1.status==='fulfilled') myResData      =r1.value?.data??r1.value;
  if(r2.status==='fulfilled') allCalData     =r2.value;
  if(r3.status==='fulfilled') teamData       =r3.value;
  if(r4.status==='fulfilled'){ favData=r4.value; updateFavBadge(); }
  if(r5.status==='fulfilled') teamStatusData =r5.value;
}

/* ── HISTORY ─────────────────────────────────────────── */
/* ── 예약 내역 CSV 다운로드 */
async function downloadReservationsCsv(){
  try{
    const res=await api.exportReservationsCsv();
    if(!res.ok){toast('CSV 다운로드 실패','error');return;}
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='reservations_'+new Date().toISOString().split('T')[0]+'.csv';
    a.click();URL.revokeObjectURL(url);
    toast('CSV 다운로드 완료','success');
  }catch(e){toast(e.message,'error');}
}
window.downloadReservationsCsv=downloadReservationsCsv;
window.toggleRecurrenceCount=toggleRecurrenceCount;
window.updateRecurrenceRule=updateRecurrenceRule;

/* ── SSE 실시간 연결 */
(function initSSE(){
  if(!auth||!auth.token()) return;
  function connect(){
    const es=new EventSource('/api/events',{});
    // EventSource doesn't support custom headers — use URL param workaround
    // We pass token as query param instead
    return es;
  }
  /* Token-auth workaround: use a thin fetch-based SSE client */
  let _sseRetries=0;
  function sseConnect(){
    const ctrl=new AbortController();
    fetch('/api/events',{headers:{'Authorization':'Bearer '+auth.token()},signal:ctrl.signal})
      .then(async res=>{
        _sseRetries=0; // 연결 성공 시 재시도 카운터 초기화
        if(res.status===401){
          /* 토큰 만료 → silentRefresh 후 재연결, 실패 시 중단 */
          try{ await auth.silentRefresh(); setTimeout(sseConnect,1000); }
          catch{ console.warn('[SSE] 토큰 갱신 실패, 재연결 중단'); }
          return;
        }
        if(!res.ok||!res.body){console.warn('[SSE] connection failed');return;}
        const reader=res.body.getReader();const dec=new TextDecoder();
        let buf='';
        while(true){
          const {done,value}=await reader.read();
          if(done) break;
          buf+=dec.decode(value,{stream:true});
          const parts=buf.split('\n\n');buf=parts.pop()||'';
          for(const chunk of parts){
            const evMatch=chunk.match(/^event:\s*(.+)/m);
            const dataMatch=chunk.match(/^data:\s*(.+)/m);
            if(!evMatch||!dataMatch) continue;
            const evName=evMatch[1].trim();
            const data=JSON.parse(dataMatch[1]);
            if(evName==='reservation_created'||evName==='reservation_cancelled'||evName==='reservation_updated'){
              /* 실시간 캘린더 업데이트 */
              refreshAllData().then(()=>{renderCal();renderTeamPanel();renderTodayWidget();
                if(selectedDate)renderPrediction(selectedDate);
                if(popupDate&&document.getElementById('popup').style.display==='flex')renderPopupBody();
              });
              if(evName==='reservation_created')
                toast(`🔴 새 예약: ${data.room_name} ${data.date} ${data.start_time}~${data.end_time}`,'info',4000);
            }
            if(evName==='reservation_reminder'){
              /* 내 예약에만 리마인더 표시 */
              const myId=parseInt(localStorage.getItem('sm_uid')||'0');
              if(!myId||data.user_id===myId){
                toast(`⏰ 30분 후 예약: ${data.room_name} ${data.start_time}${data.purpose?' — '+data.purpose:''}`,'warning',8000);
                loadNotifCount();
              }
            }
          }
        }
      })
      .catch(e=>{
        if(e.name==='AbortError') return;
        _sseRetries++;
        /* 5회 이상 실패 시 30초 대기 후 재시도 (폭주 방지) */
        const delay=_sseRetries>5?30000:5000;
        setTimeout(sseConnect,delay);
      });
    return ctrl;
  }
  let sseCtrl=null;
  document.addEventListener('DOMContentLoaded',()=>{
    if(typeof auth!=='undefined'&&auth.loggedIn()) sseCtrl=sseConnect();
  });
})();

async function loadHist(){
  const tbody=document.getElementById('hist-tbody');
  tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:36px;"><span class="spin"></span></td></tr>`;
  try{const res=await api.myReservations();histData=res?.data??res;renderHist();}catch(e){toast(e.message,'error');}
}

async function cancelSeriesRes(id){
  const r=myResData.find(x=>x.id===id);
  const detail=r?`\n\n${r.room_name} 시리즈`:'';
  if(!confirm(`반복 예약 시리즈 전체를 취소하시겠습니까? (오늘 이후)${detail}`)) return;
  try{await api.cancelReservation(id,true);toast('시리즈 전체 취소됐습니다.','warning');await refreshAllData();renderCal();renderTeamPanel();renderTodayWidget();loadHist();}
  catch(e){toast(e.message,'error');}
}
window.cancelSeriesRes=cancelSeriesRes;


async function editRes(id){
  const r=histData.find(x=>x.id===id);
  if(!r){toast('예약 정보를 찾을 수 없습니다.','error');return;}

  /* 간단 인라인 모달 */
  const existing=document.getElementById('edit-res-modal');
  if(existing) existing.remove();

  const modal=document.createElement('div');
  modal.id='edit-res-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);';
  modal.innerHTML=`
    <div style="background:var(--bg-surface);border-radius:16px;padding:28px 28px 22px;width:360px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <span style="font-size:15px;font-weight:700;">예약 수정</span>
        <button id="edit-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt3);line-height:1;">×</button>
      </div>
      <div style="font-size:12.5px;color:var(--txt2);margin-bottom:16px;padding:10px 12px;background:var(--bg);border-radius:8px;">
        <strong>${r.room_name}</strong> · ${r.date} · ${r.start_time}~${r.end_time}
      </div>
      <label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px;">목적</label>
      <input id="edit-purpose" type="text" maxlength="200" value="${(r.purpose||'').replace(/"/g,'&quot;')}"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--txt);font-size:13.5px;box-sizing:border-box;margin-bottom:12px;">
      <label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px;">인원</label>
      <input id="edit-headcount" type="number" min="1" max="20" value="${r.headcount}"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--txt);font-size:13.5px;box-sizing:border-box;margin-bottom:20px;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="edit-cancel-btn" style="padding:8px 18px;border:1px solid var(--border);border-radius:8px;background:none;color:var(--txt);cursor:pointer;font-size:13px;">취소</button>
        <button id="edit-save-btn" style="padding:8px 20px;border:none;border-radius:8px;background:var(--blue);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">저장</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close=()=>modal.remove();
  document.getElementById('edit-modal-close').onclick=close;
  document.getElementById('edit-cancel-btn').onclick=close;
  modal.addEventListener('click',e=>{if(e.target===modal)close();});

  document.getElementById('edit-save-btn').onclick=async()=>{
    const purpose=document.getElementById('edit-purpose').value.trim();
    const headcount=parseInt(document.getElementById('edit-headcount').value,10);
    if(isNaN(headcount)||headcount<1){toast('인원을 올바르게 입력해주세요.','error');return;}
    try{
      await api.updateReservation(id,{purpose,headcount});
      toast('예약이 수정됐습니다.','success');
      close();
      await refreshAllData();
      renderCal();renderHist();renderTodayWidget();
    }catch(e){toast(e.message,'error');}
  };
}

async function cancelRes(id){
  const r=histData.find(x=>x.id===id);
  const detail=r?`\n\n${r.room_name} · ${r.date} · ${r.start_time}~${r.end_time}`:'';
  if(!confirm(`예약을 취소하시겠습니까?${detail}`)) return;
  try{await api.cancelReservation(id);toast('취소됐습니다.','warning');await refreshAllData();renderCal();renderTeamPanel();renderTodayWidget();loadHist();}
  catch(e){toast(e.message,'error');}
}

/* ── FAVORITES ───────────────────────────────────────── */
/* ── FAVORITES ───────────────────────────────────────── */
let favHc = 1;

async function loadFavorites(){ try{ favData=await api.favorites(); updateFavBadge(); renderFavorites(); renderFavDropdown(); }catch(e){ toast(e.message,'error'); } }

/* 즐겨찾기 드롭다운 (예약하기 탭) */

async function saveFavFromReserve(){
  const s=document.getElementById('f-start').value, e=document.getElementById('f-end').value;
  if(!s||!e){ toast('시간을 먼저 선택해주세요.','warning'); closeFavDropdown(); return; }
  const label=prompt(`즐겨찾기 이름을 입력하세요 (최대 30자)
예: 매주 월요일 팀 미팅`,'');
  if(!label?.trim()) return;
  if(label.trim().length>30){ toast('이름은 30자 이하로 입력해주세요.','error'); return; }
  try{
    await api.addFavorite({label:label.trim(),room_name:selectedRoom,start_time:s,end_time:e,headcount:hc});
    favData=await api.favorites(); updateFavBadge(); renderFavDropdown();
    toast(`⭐ "${label.trim()}" 저장됐습니다!`,'success',3000);
    closeFavDropdown();
  }catch(err){ toast(err.message,'error'); }
}

/* 즐겨찾기 탭에서 직접 추가 */
async function saveFavoriteDirect(){
  const label=(document.getElementById('fav-label')?.value||'').trim();
  if(!label){ toast('이름을 입력해주세요.','warning'); return; }
  const room  = document.getElementById('fav-room')?.value || 'Room A';
  const s     = document.getElementById('fav-start')?.value || '09:00';
  const e     = document.getElementById('fav-end')?.value || '10:00';
  if(s>=e){ toast('종료 시간은 시작 시간보다 늦어야 합니다.','error'); return; }
  try{
    await api.addFavorite({label, room_name:room, start_time:s, end_time:e, headcount:favHc});
    const labelEl=document.getElementById('fav-label'); if(labelEl) labelEl.value='';
    favHc=1; const hcEl=document.getElementById('fav-hc-val'); if(hcEl) hcEl.textContent='1';
    favData=await api.favorites(); updateFavBadge(); renderFavorites(); renderFavDropdown();
    toast(`⭐ "${label}" 저장됐습니다!`,'success',3000);
    document.getElementById('fav-add-card').style.display='none';
  }catch(err){ toast(err.message,'error'); }
}


async function deleteFav(id){
  if(!confirm('즐겨찾기를 삭제하시겠습니까?')) return;
  try{
    await api.removeFavorite(id);
    favData=await api.favorites(); updateFavBadge(); renderFavorites(); renderFavDropdown();
    toast('삭제됐습니다.','info');
  }catch(e){ toast(e.message,'error'); }
}

/* ── SESSIONS ────────────────────────────────────────── */

async function loadSessions(){
  sessionPage=1;
  const scope=sessionTab==='team'?'team':'mine';
  const withFiles=sessionTab==='files'?'&only_with_files=1':'';
  const list=document.getElementById('session-list');
  list.innerHTML=`<div style="text-align:center;padding:36px;"><span class="spin"></span></div>`;
  try{
    const d=await api.sessions(`?scope=${scope}&page=1&limit=15${withFiles}`);
    sessionHasMore=(d.page*d.limit)<d.total;
    document.getElementById('session-more').style.display=sessionHasMore?'':'none';
    list.innerHTML='';
    if(!d.sessions.length){list.innerHTML=emptyState('journal-x','활동 기록이 없습니다','예약 후 자료와 메모를 기록하면 여기에 표시됩니다');return;}
    d.sessions.forEach(s=>list.appendChild(buildSessionCard(s)));
  }catch(e){toast(e.message,'error');}
}
async function loadMoreSessions(){
  sessionPage++;
  const scope=sessionTab==='team'?'team':'mine';
  const withFiles=sessionTab==='files'?'&only_with_files=1':'';
  try{
    const d=await api.sessions(`?scope=${scope}&page=${sessionPage}&limit=15${withFiles}`);
    sessionHasMore=(d.page*d.limit)<d.total;
    document.getElementById('session-more').style.display=sessionHasMore?'':'none';
    d.sessions.forEach(s=>document.getElementById('session-list').appendChild(buildSessionCard(s)));
  }catch(e){toast(e.message,'error');}
}

async function openSessionModal(resId, triggerEl){
  window._lastSessionTrigger = triggerEl || document.activeElement;
  currentResId=resId; uploadFiles=[]; uploadTags=[];
  document.getElementById('session-modal').style.display='flex';
  document.body.style.overflow='hidden';
  document.getElementById('sm-note').value='';
  document.getElementById('sm-note-char').textContent='0 / 2000';
  document.getElementById('sm-attendees').value='';
  document.getElementById('sm-decisions').value='';
  document.getElementById('sm-action-items').value='';
  document.getElementById('sm-task-list').innerHTML='';
  document.getElementById('sm-task-title').value='';
  document.getElementById('sm-task-assignee').value='';
  document.getElementById('sm-task-due').value='';
  document.getElementById('sm-upload-area').style.display='none';
  document.getElementById('sm-img-preview-wrap').style.display='none';
  document.getElementById('sm-img-preview').src='';
  document.getElementById('sm-files-list').innerHTML=`<div style="text-align:center;padding:14px;"><span class="spin"></span></div>`;
  document.getElementById('sm-links-list').innerHTML='';
  document.getElementById('sm-tags-preview').innerHTML='';
  try{
    const [d, taskRes] = await Promise.all([api.session(resId), api.tasks(resId)]);
    const r=d.reservation;
    document.getElementById('sm-title').textContent=`${r.date} · ${r.room_name}`;
    document.getElementById('sm-sub').textContent=`${r.start_time}~${r.end_time} · ${r.headcount}명${r.purpose?' · '+r.purpose:''}`;
    if(d.note){
      document.getElementById('sm-note').value=d.note.content||'';
      document.getElementById('sm-note-char').textContent=`${(d.note.content||'').length} / 2000`;
      document.getElementById('sm-attendees').value=d.note.attendees||'';
      document.getElementById('sm-decisions').value=d.note.decisions||'';
      document.getElementById('sm-action-items').value=d.note.action_items||'';
    }
    renderSessionFiles(d.files, d.links);
    renderTaskList(taskRes.tasks||[]);
  }catch(e){toast(e.message,'error');}
}

async function loadImageThumbnails(files){
  for(const f of files){
    if(!isImageFile(f.original_name)) continue;
    const el=document.getElementById('thumb-'+f.id); if(!el) continue;
    try{
      const res=await api.downloadFile(f.id);
      if(!res.ok) continue;
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const imgEl=new Image();
      imgEl.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
      imgEl.alt='';
      imgEl.onload=()=>URL.revokeObjectURL(url);
      imgEl.onerror=()=>{URL.revokeObjectURL(url);el.textContent=f.icon;};
      imgEl.src=url;
      el.innerHTML='';
      el.appendChild(imgEl);
    }catch(e){}
  }
}


async function doUpload(){
  if(!uploadFiles.length){toast('파일을 선택해주세요.','warning');return;}
  if(!currentResId){toast('예약을 먼저 선택해주세요.','warning');return;}
  const btn=document.getElementById('sm-do-upload');
  btn.disabled=true; btn.innerHTML='<span class="spin spin-sm"></span>';
  const fd=new FormData();
  fd.append('file',uploadFiles[0]);
  fd.append('reservation_id',currentResId);
  fd.append('title',document.getElementById('sm-upload-title').value.trim()||uploadFiles[0].name);
  fd.append('description',document.getElementById('sm-upload-desc').value.trim());
  fd.append('scope',document.getElementById('sm-upload-scope').value);
  fd.append('tags',JSON.stringify(uploadTags));
  try{
    await api.uploadFile(fd);
    toast('자료가 업로드됐습니다! 📎','success');
    uploadFiles=[]; uploadTags=[];
    document.getElementById('sm-upload-area').style.display='none';
    document.getElementById('sm-upload-title').value='';
    document.getElementById('sm-upload-desc').value='';
    document.getElementById('sm-tags-preview').innerHTML='';
    document.getElementById('sm-img-preview-wrap').style.display='none';
    document.getElementById('sm-img-preview').src='';
    const d=await api.session(currentResId);
    renderSessionFiles(d.files,d.links);
    loadImageThumbnails(d.files);
  loadImageThumbnails(d.files);
    // 팀자료함 뱃지 업데이트
    const ld=await api.teamFiles('?page=1&limit=1');
    const badge=document.getElementById('lib-badge');
    if(badge&&ld.total){badge.textContent=ld.total;badge.style.display='';}
  }catch(e){toast(e.message,'error');}
  finally{btn.disabled=false;btn.innerHTML='<i class="bi bi-upload"></i> 업로드';}
}
async function downloadFile(id,name){
  try{
    const res=await api.downloadFile(id);
    if(!res.ok){const t=await res.text();let d;try{d=JSON.parse(t);}catch{}throw new Error(d?.error||'다운로드 실패');}
    // 서버 Content-Disposition 헤더에서 원본 파일명 추출 (우선)
    const disp=res.headers.get('content-disposition')||'';    let fname=name||'file';    const utf8Match=disp.match(/filename\*=UTF-8''([^;\s]+)/i);    if(utf8Match) fname=decodeURIComponent(utf8Match[1]);    else { const plain=disp.match(/filename="([^"]+)"/i)||disp.match(/filename=([^;\s]+)/i);    if(plain) fname=plain[1]; }    const blob=await res.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=fname;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  }catch(e){toast(e.message,'error');}
}
async function deleteFile(id){
  if(!confirm('이 파일을 삭제하시겠습니까?')) return;
  try{await api.deleteFile(id);toast('삭제됐습니다.','warning');const d=await api.session(currentResId);renderSessionFiles(d.files,d.links);}
  catch(e){toast(e.message,'error');}
}
async function saveNote(){
  if(!currentResId) return;
  const content=document.getElementById('sm-note').value.trim();
  const attendees=document.getElementById('sm-attendees').value.trim();
  const decisions=document.getElementById('sm-decisions').value.trim();
  const action_items=document.getElementById('sm-action-items').value.trim();
  try{await api.saveNote(currentResId,{content,attendees,decisions,action_items});toast('일지가 저장됐습니다.','success');}
  catch(e){toast(e.message,'error');}
}

/* ── TASKS ───────────────────────────────────────────── */

async function addTask(){
  if(!currentResId) return;
  const title=document.getElementById('sm-task-title').value.trim();
  if(!title){toast('할 일 제목을 입력해주세요.','warning');return;}
  const assignee=document.getElementById('sm-task-assignee').value.trim();
  const due_date=document.getElementById('sm-task-due').value||null;
  try{
    await api.createTask(currentResId,{title,assignee,due_date});
    document.getElementById('sm-task-title').value='';
    document.getElementById('sm-task-assignee').value='';
    document.getElementById('sm-task-due').value='';
    const res=await api.tasks(currentResId);
    renderTaskList(res.tasks||[]);
    document.getElementById('sm-task-title').focus();
  }catch(e){toast(e.message,'error');}
}
async function doToggleTask(id,btn){
  try{
    btn.disabled=true;
    await api.toggleTask(id);
    const res=await api.tasks(currentResId);
    renderTaskList(res.tasks||[]);
  }catch(e){toast(e.message,'error');btn.disabled=false;}
}
async function doDeleteTask(id,btn){
  try{
    btn.disabled=true;
    await api.deleteTask(id);
    const row=document.querySelector(`[data-task-id="${id}"]`);
    if(row) row.remove();
    const list=document.getElementById('sm-task-list');
    if(!list.children.length) renderTaskList([]);
  }catch(e){toast(e.message,'error');btn.disabled=false;}
}
async function addLink(){
  const title=document.getElementById('sm-link-title').value.trim();
  const url=document.getElementById('sm-link-url').value.trim();
  const link_type=document.getElementById('sm-link-type').value;
  const scope=document.getElementById('sm-link-scope').value;
  if(!title||!url){toast('제목과 URL을 입력해주세요.','warning');return;}
  try{
    await api.addLink({reservation_id:currentResId,title,url,link_type,scope});
    toast('링크가 추가됐습니다.','success');
    document.getElementById('sm-link-title').value='';document.getElementById('sm-link-url').value='';
    const d=await api.session(currentResId);renderSessionFiles(d.files,d.links);
  }catch(e){toast(e.message,'error');}
}
async function deleteLink(id){
  if(!confirm('링크를 삭제하시겠습니까?')) return;
  try{await api.removeLink(id);toast('삭제됐습니다.','warning');const d=await api.session(currentResId);renderSessionFiles(d.files,d.links);}
  catch(e){toast(e.message,'error');}
}

/* ── LIBRARY ─────────────────────────────────────────── */

async function loadLibrary(){
  libPage=1;
  const q=document.getElementById('lib-search').value.trim();
  const type=document.getElementById('lib-type-filter').value;
  let qs=`?page=1&limit=24`;
  if(q)    qs+=`&q=${encodeURIComponent(q)}`;
  if(type) qs+=`&type=${type}`;
  if(libScope==='mine')        qs+=`&scope=private`;
  else if(libScope==='team')   qs+=`&scope=team`;
  else if(libScope==='public') qs+=`&scope=public`;
  const grid=document.getElementById('lib-grid');
  grid.innerHTML=`<div style="text-align:center;padding:36px;grid-column:1/-1;"><span class="spin"></span></div>`;
  try{
    const d=await api.teamFiles(qs);
    libHasMore=(d.page*d.limit)<d.total;
    document.getElementById('lib-more').style.display=libHasMore?'':'none';
    const badge=document.getElementById('lib-badge');
    badge.style.display=d.total?'':'none'; badge.textContent=d.total;
    grid.innerHTML='';
    if(!d.files.length){grid.innerHTML=`<div style='grid-column:1/-1;'>${emptyState('folder2-open','자료가 없습니다','팀원이 공유한 자료가 여기에 표시됩니다')}</div>`;return;}
    d.files.forEach(f=>grid.appendChild(buildFileCard(f)));
  }catch(e){toast(e.message,'error');}
}
async function loadMoreLib(){
  libPage++;
  const q=document.getElementById('lib-search').value.trim();
  const type=document.getElementById('lib-type-filter').value;
  let qs=`?page=${libPage}&limit=24`;
  if(q) qs+=`&q=${encodeURIComponent(q)}`;
  if(type) qs+=`&type=${type}`;
  if(libScope==='mine')        qs+=`&scope=private`;
  else if(libScope==='team')   qs+=`&scope=team`;
  else if(libScope==='public') qs+=`&scope=public`;
  try{
    const d=await api.teamFiles(qs);
    libHasMore=(d.page*d.limit)<d.total;
    document.getElementById('lib-more').style.display=libHasMore?'':'none';
    d.files.forEach(f=>document.getElementById('lib-grid').appendChild(buildFileCard(f)));
  }catch(e){toast(e.message,'error');}
}

async function doSearch(){
  const q=document.getElementById('srch-q').value.trim();
  const fromFp=window._fpFrom&&window._fpFrom.selectedDates[0];
  const toFp  =window._fpTo  &&window._fpTo.selectedDates[0];
  const from=fromFp?fromFp.toISOString().split('T')[0]:(document.getElementById('srch-from').value||'');
  const to  =toFp  ?toFp.toISOString().split('T')[0]  :(document.getElementById('srch-to').value||'');
  const room =document.getElementById('srch-room').value;
  const type =document.getElementById('srch-type').value;
  if(!q&&!from&&!to){toast('검색어 또는 날짜를 입력해주세요.','warning');return;}
  let qs='?';
  if(q)    qs+=`q=${encodeURIComponent(q)}&`;
  if(from) qs+=`date_from=${from}&`;
  if(to)   qs+=`date_to=${to}&`;
  if(room) qs+=`room=${encodeURIComponent(room)}&`;
  if(type) qs+=`file_type=${type}&`;
  const container=document.getElementById('srch-results');
  container.innerHTML=`<div style="text-align:center;padding:36px;"><span class="spin"></span></div>`;
  try{
    const d=await api.searchFiles(qs);
    if(!d.total){container.innerHTML=`<div class="empty"><i class="bi bi-search"></i><p>검색 결과가 없습니다</p></div>`;return;}
    let html=`<div style="font-size:12.5px;color:var(--txt3);margin-bottom:14px;font-weight:500;">총 <strong style="color:var(--txt);">${d.total}</strong>건 — 파일 ${d.files.length}건 · 세션 ${d.sessions.length}건 · 링크 ${d.links.length}건</div>`;
    if(d.files.length){
      html+=`<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">📎 파일 (${d.files.length})</div>`;
      html+=d.files.map(f=>{
        const col=ROOM_COL[f.room_name]||'var(--blue)',scopeColor=SCOPE_COLORS[f.scope]||'var(--txt3)';
        const highlight=q?f.title.replace(new RegExp(q,'gi'),m=>`<mark style="background:rgba(251,191,36,.3);color:var(--orange);border-radius:2px;">${m}</mark>`):f.title;
        return `<div class="card fade-in" style="padding:12px 16px;margin-bottom:8px;cursor:pointer;transition:border-color .15s,transform .1s;" onclick="openSessionModal(${f.res_id})" onmouseover="this.style.borderColor='${col}';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='';this.style.transform=''">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;flex-shrink:0;">${f.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">${highlight}</div>
              <div style="font-size:11px;color:var(--txt3);margin-top:3px;display:flex;flex-wrap:wrap;gap:8px;">
                <span style="color:${col};">${f.room_name} · ${f.date}</span>
                <span>${f.display_name||f.username}${f.team?' · '+f.team:''}</span>
                <span style="color:${scopeColor};">${SCOPE_LABELS[f.scope]}</span>
              </div>
            </div>
            <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px;flex-shrink:0;" onclick="event.stopPropagation();downloadFile(${f.id},'${f.original_name}')"><i class="bi bi-download"></i></button>
          </div>
        </div>`;
      }).join('');
    }
    if(d.sessions.length){
      html+=`<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;margin-top:18px;">📅 세션 (${d.sessions.length})</div>`;
      html+=d.sessions.map(s=>{
        const col=ROOM_COL[s.room_name]||'var(--blue)';
        const dt=new Date(s.date+'T00:00:00');
        const pH=q&&s.purpose?s.purpose.replace(new RegExp(q,'gi'),m=>`<mark style="background:rgba(251,191,36,.3);color:var(--orange);border-radius:2px;">${m}</mark>`):s.purpose;
        return `<div class="card fade-in" style="padding:12px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid ${col};transition:transform .1s;" onclick="openSessionModal(${s.id})" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span>${s.date} (${WDS[dt.getDay()]})</span>
                <span class="room-tag" style="border-color:${col}30;color:${col};">${s.room_name}</span>
                <span style="font-family:var(--font-mono);font-size:11.5px;color:var(--txt3);">${s.start_time}~${s.end_time}</span>
              </div>
              ${pH?`<div style="font-size:11.5px;color:var(--txt2);margin-top:3px;">목적: ${pH}</div>`:''}
            </div>
            ${s.file_count?`<span class="badge badge-blue" style="flex-shrink:0;"><i class="bi bi-paperclip"></i>${s.file_count}개</span>`:''}
          </div>
        </div>`;
      }).join('');
    }
    if(d.links.length){
      html+=`<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;margin-top:18px;">🔗 링크 (${d.links.length})</div>`;
      html+=d.links.map(l=>{
        const col=ROOM_COL[l.room_name]||'var(--blue)',icon=LINK_ICONS[l.link_type]||'🔗';
        return `<div class="card fade-in" style="padding:12px 16px;margin-bottom:8px;cursor:pointer;transition:border-color .15s,transform .1s;" onclick="openSessionModal(${l.reservation_id})" onmouseover="this.style.borderColor='var(--border-hover)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='';this.style.transform=''">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:22px;flex-shrink:0;">${icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--blue);">${l.title}</div>
              <div style="font-size:11px;color:var(--txt3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.url}</div>
              <div style="font-size:11px;color:var(--txt3);margin-top:2px;"><span style="color:${col};">${l.room_name} · ${l.date}</span> · ${l.display_name||l.username}</div>
            </div>
            <a href="${l.url}" target="_blank" rel="noopener" class="btn btn-ghost" style="font-size:11px;padding:5px 10px;flex-shrink:0;" onclick="event.stopPropagation()"><i class="bi bi-box-arrow-up-right"></i></a>
          </div>
        </div>`;
      }).join('');
    }
    container.innerHTML=html;
  }catch(e){toast(e.message,'error');}
}

function openProfile(){
  const uname=auth.username(),name=auth.displayName(),team=auth.team();
  document.getElementById('prof-username').textContent=uname;
  document.getElementById('prof-av').textContent=(name||uname||'U')[0].toUpperCase();
  document.getElementById('prof-role').textContent=auth.isAdmin()?'관리자':'일반 사용자';
  document.getElementById('prof-display-name').value=name===uname?'':name;
  document.getElementById('prof-team').value=team;
  const today=todayStr();
  document.getElementById('prof-total-res').textContent=myResData.length;
  document.getElementById('prof-upcoming').textContent=myResData.filter(r=>r.status==='confirmed'&&r.date>=today).length;
  document.getElementById('prof-fav-count').textContent=favData.length;
  document.getElementById('profile-modal').style.display='flex';
  document.body.style.overflow='hidden';
}

async function saveProfile(){
  const displayName=document.getElementById('prof-display-name').value.trim();
  const team=document.getElementById('prof-team').value.trim();
  try{
    const result=await api.updateProfile({team,display_name:displayName||undefined});
    auth.save(result.token||auth.token(),auth.role(),auth.username(),result.team||team,displayName||auth.username());
    document.getElementById('sb-uname').textContent=auth.displayName();
    document.getElementById('sb-av').textContent=auth.displayName()[0].toUpperCase();
    document.getElementById('sb-team-lbl').textContent=team?`📌 ${team}`:'소속팀 없음';
    document.getElementById('team-name-lbl').textContent=team?`${team} · 오늘 이후`:'소속팀 없음';
    toast('프로필이 저장됐습니다.','success'); closeProfile();
    await refreshAllData(); renderTeamPanel();
  }catch(e){toast(e.message,'error');}
}
async function changePw(){
  const cur=document.getElementById('prof-cur-pw').value;
  const nw=document.getElementById('prof-new-pw').value;
  const nw2=document.getElementById('prof-new-pw2').value;
  if(!cur||!nw||!nw2){toast('모든 항목을 입력해주세요.','warning');return;}
  if(nw!==nw2){toast('새 비밀번호가 일치하지 않습니다.','error');return;}
  if(nw.length<6){toast('비밀번호는 6자 이상이어야 합니다.','error');return;}
  try{await api.updateProfile({currentPassword:cur,newPassword:nw});['prof-cur-pw','prof-new-pw','prof-new-pw2'].forEach(id=>document.getElementById(id).value='');toast('비밀번호가 변경됐습니다.','success');}
  catch(e){toast(e.message,'error');}
}

/* ── NOTIFICATIONS ───────────────────────────────────── */

async function loadNotifCount(){
  try{
    const d=await api.notifUnread(); const show=d.count>0;
    ['notif-dot','notif-dot2'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=show?'':'none';});
    const b=document.getElementById('notif-unread-badge');if(b){b.textContent=d.count;b.style.display=show?'':'none';}
  }catch{}
}

async function loadNotifList(){
  const list=document.getElementById('notif-list');
  list.innerHTML=`<div style="text-align:center;padding:28px;"><span class="spin"></span></div>`;
  try{
    const data=await api.notifList();list.innerHTML='';
    if(!data.length){list.innerHTML=`<div style="text-align:center;padding:36px 0;color:var(--txt3);"><i class="bi bi-bell-slash" style="font-size:28px;display:block;margin-bottom:10px;opacity:.18;"></i><p style="font-size:13px;">알림이 없습니다</p></div>`;return;}
    data.forEach(n=>list.appendChild(buildNotifItem(n)));loadNotifCount();
  }catch(e){list.innerHTML=`<div style="padding:16px;color:var(--red);font-size:13px;">${e.message||'오류'}</div>`;}
}
async function readNotif(id,el){el.classList.remove('unread');try{await api.notifRead(id);loadNotifCount();}catch{}}
async function markAllRead(){try{await api.notifReadAll();await loadNotifList();toast('모두 읽음 처리됐습니다','info');}catch(e){toast(e.message,'error');}}

/* ═══════════════════════════════════════════════════════
   이벤트 디스패처
════════════════════════════════════════════════════════ */
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const val    = el.dataset.val;
  switch (action) {
    /* 사이드바 */
    case 'toggleSb':          toggleSb(); break;
    case 'openMobileSidebar': openMobileSidebar(); break;
    case 'closeMobileSidebar':closeMobileSidebar(); break;
    case 'logout':            auth.logout(); break;
    case 'themeToggle':       theme.toggle(); break;
    case 'openProfile':       openProfile(); break;
    /* 네비게이션 */
    case 'goPage':
      goPage(val, document.querySelector(`.sb-item[data-val="${val}"]`) || el);
      break;
    case 'goFavoritesPage':
      goPage('favorites', document.querySelector('.sb-item[data-val="favorites"]'));
      closeFavDropdown();
      break;
    /* 캘린더 */
    case 'setView':    setView(val); break;
    case 'moveMonth':  moveMonth(parseInt(val)); break;
    case 'toggleFP':   toggleFP(val); break;
    /* 예약 */
    case 'selectRoom': selectRoom(el); break;
    case 'changeHc':   changeHc(parseInt(val)); break;
    case 'submitRes':  submitRes(); break;
    /* 즐겨찾기 */
    case 'toggleFavDropdown': toggleFavDropdown(e); break;
    case 'saveFavFromReserve':saveFavFromReserve(); break;
    case 'loadFavorites': loadFavorites(); break;
    case 'toggleFavAdd':  toggleFavAdd(); break;
    case 'changeFavHc':   changeFavHc(parseInt(val)); break;
    case 'saveFavoriteDirect': saveFavoriteDirect(); break;
    /* 예약 내역 */
    case 'loadHist': loadHist(); break;
    case 'setHF':    setHF(val, el); break;
    /* 팀 현황 */
    case 'setTeamPeriod':   setTeamPeriod(val, el); break;
    case 'setTF':           setTF(val, el); break;
    case 'refreshTeamStatus': refreshTeamStatus(); break;
    case 'setPopTab':       setPopTab(val, el); break;
    case 'quickReserve':    quickReserve(); break;
    case 'hidePopup':       hidePopup(); break;
    case 'closePopupOutside': closePopupOutside(e); break;
    /* 세션 */
    case 'loadSessions':    loadSessions(); break;
    case 'loadMoreSessions':loadMoreSessions(); break;
    case 'setSessionTab':   setSessionTab(val, el); break;
    case 'switchSessionTab':switchSessionTab(val, el); break;
    case 'closeSessionModal':   closeSessionModal(); break;
    case 'closeSessionOutside': closeSessionOutside(e); break;
    case 'saveNote':        saveNote(); break;
    /* 자료함 */
    case 'loadLibrary':  loadLibrary(); break;
    case 'loadMoreLib':  loadMoreLib(); break;
    case 'setLibScope':  setLibScope(val, el); break;
    case 'doUpload':     doUpload(); break;
    case 'cancelUpload': cancelUpload(); break;
    case 'addLink':      addLink(); break;
    case 'triggerFileInput': document.getElementById('sm-file-input').click(); break;
    /* 검색 */
    case 'doSearch':   doSearch(); break;
    case 'clearSearch':clearSearch(); break;
    /* 알림 */
    case 'toggleNotifDrawer': toggleNotifDrawer(); break;
    case 'closeNotifDrawer':  closeNotifDrawer(); break;
    case 'markAllRead':       markAllRead(); break;
    /* 프로필 */
    case 'saveProfile':       saveProfile(); break;
    case 'closeProfile':      closeProfile(); break;
    case 'closeProfileOutside':closeProfileOutside(e); break;
    case 'changePw':          changePw(); break;
    case 'pickTeamProf':      pickTeamProf(val); break;
    /* tasks */
    case 'addTask':           addTask(); break;
    case 'taskKeydown':       if(e.key==='Enter') addTask(); break;
  }
});

/* ── keydown 위임 (인라인 onkeydown 대체) ── */
document.addEventListener('keydown', function(e) {
  const el = e.target;
  const action = el.dataset.action;
  if (!action) return;
  if (action === 'srchKeydown' && e.key === 'Enter') doSearch();
  if (action === 'tagKeydown')  handleTagInput(e);
});

/* ── file input change (인라인 onchange 대체) ── */
document.getElementById('sm-file-input').addEventListener('change', function(){
  handleFileSelect(this.files);
});

/* ── dropzone 이벤트 (인라인 ondragover 대체) ── */
document.addEventListener('dragover', function(e) {
  if (!e.target.closest('[data-dropzone]')) return;
  e.preventDefault();
  const dz = e.target.closest('[data-dropzone]');
  dz.style.borderColor = 'var(--blue)';
  dz.style.backgroundColor = 'var(--blue-light)';
});
document.addEventListener('dragleave', function(e) {
  const dz = e.target.closest('[data-dropzone]');
  if (!dz) return;
  dz.style.borderColor = '';
  dz.style.backgroundColor = '';
});
document.addEventListener('drop', function(e) {
  const dz = e.target.closest('[data-dropzone]');
  if (!dz) return;
  dz.style.borderColor = '';
  dz.style.backgroundColor = '';
  handleDrop(e);
});


/* ── select change 위임 (인라인 onchange 대체) ── */
document.addEventListener('change', function(e) {
  const el = e.target;
  const fn = el.dataset.fn;
  if (!fn) return;
  if (fn === 'updatePreview') updatePreview();
  if (fn === 'loadLibrary')   loadLibrary();
});
