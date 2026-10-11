import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const root = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const planned = [['숙박비',480000],['식비',800000],['현지 교통비',240000],['선교 교제비',320000],['전도 물품',720000],['기타 공동경비',240000],['비상금',400000]];
const TOTAL = planned.reduce((sum, [,amount]) => sum + amount, 0);
const AIRFARE = 3440000; // 개인 부담, 공동예산에서 제외
const DEFAULT_AUDIO_URL = 'https://martys-with-jesus.github.io/martys-with-Jesus/audio/' + encodeURIComponent('TalkFile_花も 꽃도 Hanamo_ (Coverd by ANNA) (1).mp3.mp3');

// 처음 관리자 접속 시, 아직 해당 문서가 없는 경우에만 등록합니다.
const initialExpenses = [
  ['martys-2026-initial-outreach', '전도 물품', '전도 물품 구입', 653300],
  ['martys-2026-initial-shared', '기타 공동경비', '기타 공동경비 사용', 534100]
];
const initialSchedule = [
  ['2026-10-16','14:25','16:00','인천공항 제2터미널 출발 → 후쿠오카 도착','',''],
  ['2026-10-16','16:30','17:00','국제선에서 국내선으로 이동 및 숙소 이동','','도보 이동'],
  ['2026-10-16','17:10','20:30','선교사님과 저녁식사 및 생필품 구매','Marushoku Airport East',''],
  ['2026-10-16','21:00','23:00','버스킹 연습 · 저녁모임 · 전도물품 포장','',''],
  ['2026-10-16','23:00','24:00','개인 정비 · 취침','',''],
  ['2026-10-17','08:00','09:00','아침식사 · 말씀나눔 · 개인 정비','',''],
  ['2026-10-17','09:30','11:00','선교사님과 오하시 이동 · 버스킹 · 전도물품 나눔','오하시',''],
  ['2026-10-17','11:10','17:00','캠프장 이동 · 워십네이션스팀과 교제 및 나눔','캠프장','캠프장까지 약 30분 소요'],
  ['2026-10-17','17:10','19:00','텐진 이동 · 버스킹 · 전도물품 나눔','텐진',''],
  ['2026-10-17','19:00','21:00','저녁식사 · 숙소 복귀','',''],
  ['2026-10-17','21:00','23:00','주일 특송 연습(꽃들도) · 저녁모임','',''],
  ['2026-10-17','23:00','24:00','개인 정비 · 취침','',''],
  ['2026-10-18','08:00','09:00','아침식사 · 말씀나눔','',''],
  ['2026-10-18','09:00','10:00','체크아웃 준비','',''],
  ['2026-10-18','10:45','12:00','현지 교회 주일예배 참석','현지 교회',''],
  ['2026-10-18','12:00','13:00','점심식사','',''],
  ['2026-10-18','13:00','16:00','자유시간','',''],
  ['2026-10-18','17:00','18:35','후쿠오카 공항 출발 → 귀국','후쿠오카 공항','']
];

let auth, db, user, profile, active='home', selectedSong=null, lyricTab='japanese';
let items={expenses:[],schedule:[],songs:[]}, unsubs=[], busy=false;
const admin=()=>profile?.role==='admin';
const btn=(name,act,cls='secondary')=>`<button class="btn ${cls}" data-action="${act}">${esc(name)}</button>`;
const notice=message=>{const e=document.getElementById('flash');if(e){e.textContent=message;e.hidden=false;setTimeout(()=>{if(e)e.hidden=true},5500)}else alert(message)};
function cleanSubs(){unsubs.forEach(f=>f());unsubs=[]}
function loginPage(error=''){
  root.innerHTML=`<main class="login-wrap"><section class="login-card"><span class="eyebrow">MARTYS · ADMIN</span><h1>관리자 로그인</h1><p>관리자만 로그인해 주세요.</p><form id="login-form"><label class="field">이메일<input type="email" name="email" required autocomplete="username"></label><label class="field">비밀번호<input type="password" name="password" required autocomplete="current-password"></label><button class="btn full" type="submit">로그인</button></form><p class="error" id="login-error">${esc(error)}</p>${btn('홈페이지로 돌아가기','public')}</section></main>`;
  bindActions();
  document.getElementById('login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await signInWithEmailAndPassword(auth,f.get('email'),f.get('password'))}catch(err){document.getElementById('login-error').textContent='로그인에 실패했습니다. 계정 정보를 확인해 주세요.'}};
}
function shell(){
  const who=admin()?`${esc(profile.name||user.email)} · 관리자`:'팀원 열람용';
  root.innerHTML=`<div class="shell"><header class="topbar"><div class="logo">MARTYS<small>JAPAN MISSION 2026</small></div><div class="header-actions"><span class="muted" style="font-size:12px">${who}</span>${admin()?btn('로그아웃','logout'):btn('관리자 로그인','admin-login')}</div></header><div id="flash" class="notice" hidden></div><nav class="nav" id="navigation">${[['home','홈'],['purpose','선교 목적'],['schedule','일정'],['budget','예산'],['songs','찬양 연습실']].map(([k,v])=>`<button data-tab="${k}" class="${active===k?'active':''}">${v}</button>`).join('')}</nav><main id="content"></main><footer class="footer">MARTYS · 주안감리교회 참청년부 · 2026.10.16–18</footer></div>`;
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.tab;selectedSong=null;render()});bindActions();render();
}
function bindActions(){
  root.querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=()=>signOut(auth));
  root.querySelectorAll('[data-action="admin-login"]').forEach(b=>b.onclick=()=>loginPage());
  root.querySelectorAll('[data-action="public"]').forEach(b=>b.onclick=()=>shell());
}
function section(title,sub='',action=''){return `<div class="section-head"><div><h2>${esc(title)}</h2><span class="sub">${esc(sub)}</span></div>${action}</div>`}
function render(){const c=document.getElementById('content');if(!c)return;root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===active));c.innerHTML=({home:home,purpose:purpose,schedule:scheduleView,budget:budget,songs:songsView}[active]||home)();bindContent(c)}
function totalSpent(){return items.expenses.reduce((s,e)=>s+Number(e.amount||0),0)}
function home(){const spent=totalSpent();return `<section class="hero"><span class="eyebrow">WE ARE HIS WITNESSES · ACTS 1:8</span><h1>일본 땅에<br>찬양을 흘려보내다.</h1><p>하나님께 시간을 드리고 물질을 드리는 기쁨을 누리며<br>생명 되신 예수님을 전합니다.</p><span class="pill">2026.10.16 — 10.18 · 후쿠오카 텐진 · 8명</span></section><div class="grid"><article class="card"><h3>찬양 연습</h3><div class="stat">${items.songs.length}곡</div><p class="sub">가사 · 한글 발음 · 음원 · 악보</p>${btn('연습실 열기','goto:songs')}</article><article class="card"><h3>남은 공동 예산</h3><div class="stat">${won(TOTAL-spent)}</div><p class="sub">총 계획 ${won(TOTAL)} · 등록 지출 ${won(spent)}</p>${btn('예산 보기','goto:budget')}</article><article class="card"><h3>선교 일정</h3><div class="stat">2박 3일</div><p class="sub">10월 16일(금) – 18일(일)</p>${btn('일정 보기','goto:schedule')}</article><article class="card"><h3>선교 비전</h3><p>우리는 예수 그리스도의 증인입니다.</p>${btn('목적 보기','goto:purpose')}</article></div>`}
function purpose(){return `${section('우리의 선교 목적','WHY WE GO')}<article class="card"><span class="eyebrow">OUR VISION</span><h2>삶으로 복음을 증언하는 공동체</h2><p style="line-height:2">하나님께 시간을 드리고 물질을 드리는 기쁨을 누리며 생명 되신 예수님을 전합니다.</p><div class="line"></div><h3>우리가 가는 이유</h3><p style="line-height:2">직장인 청년들이 자신의 시간과 물질을 하나님께 드리는 기쁨을 배우고, 일본 땅에 찬양과 예배를 흘려보내며 예수 그리스도의 사랑을 전하기 위해 떠납니다.</p><p class="admin-note">“오직 성령이 너희에게 임하시면 … 땅 끝까지 이르러 내 증인이 되리라” · 사도행전 1:8</p></article><article class="card"><h3>함께 기억할 기도제목</h3><p>① 일본 땅의 사람들이 복음을 들을 수 있는 마음을 갖도록</p><p>② 선교팀이 하나님을 기대하고 경험하도록</p><p>③ 현지 교회 및 선교사님과 좋은 동역이 이루어지도록</p></article>`}
function scheduleView(){const days=[['2026-10-16','DAY 1 · 10월 16일 (금)'],['2026-10-17','DAY 2 · 10월 17일 (토)'],['2026-10-18','DAY 3 · 10월 18일 (일)']];return `${section('선교 일정','현장 상황에 따라 변경될 수 있습니다',admin()?btn('일정 추가','form:schedule'):'')}${days.map(([d,label])=>`<article class="card"><h3>${label}</h3>${items.schedule.filter(x=>x.date===d).sort((a,b)=>String(a.time).localeCompare(String(b.time))).map(x=>`<div class="list-row"><div><strong>${esc(x.time||'시간 미정')}${x.endTime?'–'+esc(x.endTime):''} · ${esc(x.title)}</strong><p>${esc(x.place||'')}${x.memo?' · '+esc(x.memo):''}</p></div>${admin()?`<div class="row-actions">${btn('수정','edit:schedule:'+x.id,'tiny secondary')}${btn('삭제','delete:schedule:'+x.id,'tiny danger')}</div>`:''}</div>`).join('')||'<div class="empty">등록된 일정이 없습니다.</div>'}</article>`).join('')}${admin()?formArea():''}`}
function budget(){const spent=totalSpent(),pct=Math.min(100,Math.max(0,spent/TOTAL*100));return `${section('공동 예산 사용 현황','8명 · 1인 공동회비 400,000원 · 항공권 개인 부담',admin()?btn('지출 등록','form:expenses'):'')}<div class="grid"><div class="card"><h3>공동 계획 예산</h3><div class="stat">${won(TOTAL)}</div><p class="sub">항공권 제외 · 공동회비 8명 × 400,000원</p></div><div class="card"><h3>남은 공동 예산</h3><div class="stat">${won(TOTAL-spent)}</div><p class="sub">등록 지출 ${won(spent)}</p></div></div><article class="card"><strong>예산 집행률 ${pct.toFixed(1)}%</strong><div class="progress"><span style="width:${pct}%"></span></div><p class="sub">계획 금액은 지출로 계산하지 않습니다. 등록한 지출만 잔액에 반영됩니다.</p></article><article class="card"><h3>항목별 공동 예산</h3>${planned.map(([name,v])=>{const used=items.expenses.filter(x=>x.category===name).reduce((s,x)=>s+Number(x.amount||0),0);return `<div class="list-row"><span>${esc(name)}<p class="sub">사용 ${won(used)} · 잔액 ${won(v-used)}</p></span><strong class="money">${won(v)}</strong></div>`}).join('')}</article><article class="card"><h3>항공권 · 개인 부담 (공동예산 제외)</h3><div class="list-row"><span>항공권 총액 (8명)</span><strong class="money">${won(AIRFARE)}</strong></div><p class="sub">1인 430,000원 · 공동예산 및 지출 합계에 포함되지 않습니다.</p></article><article class="card"><h3>지출 내역</h3>${items.expenses.map(x=>`<div class="list-row"><div><strong>${esc(x.category)} · ${esc(x.title)}</strong><p>${esc(x.date||'')}${x.memo?' · '+esc(x.memo):''}</p></div><div style="text-align:right"><strong>${won(x.amount)}</strong>${admin()?`<div class="row-actions">${btn('수정','edit:expenses:'+x.id,'tiny secondary')}${btn('삭제','delete:expenses:'+x.id,'tiny danger')}</div>`:''}</div></div>`).join('')||'<div class="empty">아직 등록된 지출이 없습니다.</div>'}</article>${admin()?formArea():''}`}
function safeUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function alignedLyrics(x){
  // 절 제목과 빈 줄은 각 언어에서 독립적으로 처리하여 줄 밀림을 방지합니다.
  const heading = t => /^(?:\d+\s*절|후렴|코러스|브릿지|브리지|전주|간주|마지막\s*후렴|반복|verse\s*\d+|chorus|bridge|intro|outro)(?:\s*[:：-])?$/i.test(t.trim());
  const clean = key => String(x[key]||'').replace(/\r\n?/g,'\n').split('\n').map(t=>t.trim());
  const arrays=[clean('japanese'),clean('pronunciation'),clean('korean')];
  if(!arrays.some(a=>a.some(t=>t)))return '<p class="sub">아직 등록된 가사가 없습니다.</p>';
  const parse = lines => {
    const groups=[];let current={name:'',lines:[]};
    for(const line of lines){
      if(heading(line)){
        if(current.name||current.lines.some(Boolean))groups.push(current);
        current={name:line,lines:[]};
      }else if(line){current.lines.push(line)}
    }
    if(current.name||current.lines.some(Boolean))groups.push(current);
    return groups;
  };
  const parsed=arrays.map(parse);
  const labels=parsed.find(groups=>groups.some(g=>g.name))||parsed[0];
  const total=Math.max(...parsed.map(g=>g.length));
  let out='';
  for(let g=0;g<total;g++){
    const groups=parsed.map(p=>p[g]||{name:'',lines:[]});
    const label=(labels[g]&&labels[g].name)||groups.find(v=>v.name)?.name||'';
    if(label)out+=`<div class="lyric-section-title"><span>${esc(label)}</span></div>`;
    const n=Math.max(...groups.map(v=>v.lines.length));
    for(let i=0;i<n;i++){
      const [a,b,c]=groups.map(v=>v.lines[i]||'');
      out+=`<div class="lyric-verse">${a?`<div class="lyric-jp">${esc(a)}</div>`:''}${b?`<div class="lyric-pr">${esc(b)}</div>`:''}${c?`<div class="lyric-ko">${esc(c)}</div>`:''}</div>`;
    }
  }
  return out;
}
function songsView(){
  if(selectedSong){
    const x=items.songs.find(s=>s.id===selectedSong);
    if(!x){selectedSong=null;return songsView()}
    return `<button class="back" data-action="back">← 찬양 목록</button>${section(x.title,x.artist||'')}${admin()?`<div class="row-actions">${btn('찬양 수정','edit:songs:'+x.id)}${btn('찬양 삭제','delete:songs:'+x.id,'danger')}</div>`:''}<article class="card song-detail">${safeUrl(x.audioURL)?`<div class="song-player"><span class="eyebrow">LISTEN & PRACTICE</span><h3>연습 음원</h3><audio class="media" controls preload="none" src="${esc(safeUrl(x.audioURL))}"></audio></div>`:'<p class="sub">음원 미등록</p>'}<div class="lyric-head"><h3>찬양 가사</h3><span class="sub">일본어 · 한글 발음 · 한국어 뜻</span></div><div class="aligned-lyrics">${alignedLyrics(x)}</div>${safeUrl(x.youtube)?`<p><a href="${esc(safeUrl(x.youtube))}" target="_blank" rel="noopener noreferrer">참고 영상 열기 ↗</a></p>`:''}<div class="file-links">${safeUrl(x.scoreURL)?`<a href="${esc(safeUrl(x.scoreURL))}" target="_blank" rel="noopener noreferrer">악보 열기 / 다운로드 ↗</a>`:'<span class="sub">악보 미등록</span>'}</div></article>${admin()?formArea():''}`;
  }
  return `${section('찬양 연습실','일본어 · 한글 발음 · 뜻을 한눈에',admin()?btn('찬양 등록','form:songs'):'')}${items.songs.map(x=>`<article class="card"><div class="song"><div class="song-icon">♫</div><div class="song-info"><h3>${esc(x.title)}</h3><p>${esc(x.artist||'')} · ${x.audioURL?'음원 있음':'음원 없음'} · ${x.scoreURL?'악보 있음':'악보 없음'}</p></div>${btn('연습하기','song:'+x.id)}</div></article>`).join('')||'<div class="card empty">아직 등록된 찬양이 없습니다.<br>관리자가 첫 찬양을 추가해 주세요.</div>'}${admin()?formArea():''}`;
}

function formArea(){return '<div id="form-area"></div>'}
function field(label,name,type='text',value='',required=false){return `<label class="field">${esc(label)}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${required?'required':''}></label>`}
function textarea(label,name,value=''){return `<label class="field wide">${esc(label)}<textarea name="${esc(name)}">${esc(value)}</textarea></label>`}
function openForm(kind,id){const data=id?items[kind].find(x=>x.id===id):{},x=data||{};let content='';
if(kind==='expenses')content=`<div class="form-grid">${field('날짜','date','date',x.date||new Date().toISOString().slice(0,10),true)}<label class="field">항목<select name="category">${planned.map(([k])=>`<option ${x.category===k?'selected':''}>${esc(k)}</option>`).join('')}</select></label>${field('사용 내역','title','text',x.title,true)}${field('금액 (원)','amount','number',x.amount||'',true)}${textarea('메모','memo',x.memo)}</div>`;
if(kind==='schedule')content=`<div class="form-grid"><label class="field">날짜<select name="date">${['2026-10-16','2026-10-17','2026-10-18'].map(d=>`<option value="${d}" ${x.date===d?'selected':''}>${d}</option>`).join('')}</select></label>${field('시작 시간','time','text',x.time||'09:00',true)}${field('종료 시간','endTime','text',x.endTime||'')}${field('일정명','title','text',x.title,true)}${field('장소','place','text',x.place)}${textarea('상세 안내','memo',x.memo)}</div>`;
if(kind==='songs')content=`${field('찬양 제목','title','text',x.title,true)}${field('가수 / 원곡','artist','text',x.artist)}${textarea('일본어 가사','japanese',x.japanese)}${textarea('한글 발음','pronunciation',x.pronunciation)}${textarea('한국어 뜻','korean',x.korean)}${field('유튜브 참고 링크 (선택)','youtube','url',x.youtube)}${field('연습 음원 URL (GitHub Pages MP3 주소)','audioURL','url',x.audioURL||(!id?'':''))}${field('악보 URL (PDF 또는 이미지 주소)','scoreURL','url',x.scoreURL)}<p class="sub">음원·악보 파일은 GitHub 등에 올린 후 공개 주소를 입력해 주세요. 비워두면 연결이 해제됩니다. 공유 허가받은 자료만 사용하세요.</p><p class="sub">꽃들도 음원 URL 예시: <button type="button" class="btn tiny secondary" data-action="example-audio">주소 자동 입력</button></p>`;
const target=document.getElementById('form-area');if(!target)return;target.innerHTML=`<article class="card"><h3>${id?'수정':'새로 등록'}</h3><form id="edit-form">${content}<div class="row-actions"><button class="btn" type="submit">저장하기</button>${btn('취소','cancel')}</div><p class="error" id="form-error"></p></form></article>`;target.scrollIntoView({behavior:'smooth',block:'nearest'});document.getElementById('edit-form').onsubmit=e=>saveForm(e,kind,id);const example=target.querySelector('[data-action="example-audio"]');if(example)example.onclick=()=>{target.querySelector('[name="audioURL"]').value=DEFAULT_AUDIO_URL};target.querySelector('[data-action="cancel"]').onclick=()=>target.innerHTML='';}
async function saveForm(e,kind,id){e.preventDefault();if(busy)return;busy=true;const form=e.target,button=form.querySelector('[type=submit]');button.disabled=true;const f=new FormData(form),payload={};for(const [k,v] of f.entries())payload[k]=String(v).trim();
try{
  if(kind==='expenses'){payload.amount=Number(payload.amount);if(!Number.isFinite(payload.amount)||payload.amount<=0)throw Error('금액은 0보다 커야 합니다.');}
  if(kind==='songs'){for(const key of ['audioURL','scoreURL','youtube'])if(payload[key]&&!safeUrl(payload[key]))throw Error('링크는 https:// 로 시작하는 올바른 주소여야 합니다.');}
  if(id)await updateDoc(doc(db,kind,id),{...payload,updatedAt:serverTimestamp()});else await addDoc(collection(db,kind),{...payload,createdAt:serverTimestamp(),createdBy:user.uid});
  document.getElementById('form-area').innerHTML='';notice('저장되었습니다.');
}catch(err){const el=document.getElementById('form-error');if(el)el.textContent='저장 실패: '+(err.message||err)}finally{busy=false;button.disabled=false}}
async function remove(kind,id){if(!admin())return;if(!confirm('정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;try{await deleteDoc(doc(db,kind,id));if(selectedSong===id)selectedSong=null;notice('삭제되었습니다.')}catch(e){notice('삭제 실패: '+e.message)}}
function bindContent(c){c.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const [cmd,kind,id]=b.dataset.action.split(':');if(cmd==='goto'){active=kind;render()}if(cmd==='form'&&admin())openForm(kind);if(cmd==='edit'&&admin())openForm(kind,id);if(cmd==='delete'&&admin())remove(kind,id);if(cmd==='song'){selectedSong=kind;lyricTab='japanese';render()}if(cmd==='back'){selectedSong=null;render()}if(cmd==='cancel'){const el=document.getElementById('form-area');if(el)el.innerHTML=''}});c.querySelectorAll('[data-lyric]').forEach(b=>b.onclick=()=>{lyricTab=b.dataset.lyric;render()})}
function listen(){cleanSubs();for(const name of ['expenses','schedule','songs']){const unsub=onSnapshot(collection(db,name),snap=>{items[name]=snap.docs.map(d=>({id:d.id,...d.data()}));render()},err=>notice(name+' 불러오기 실패: '+err.message));unsubs.push(unsub)}}
async function seedInitialData(){
  if(!admin())return;
  // 컬렉션이 완전히 비어 있을 때만 초기 데이터를 입력합니다.
  // 이후 개별 항목을 삭제하거나 수정해도 다시 생성되지 않습니다.
  const tasks=[];
  const expenseSnapshot=await getDocs(collection(db,'expenses'));
  if(expenseSnapshot.empty){
    for(const [id,category,title,amount] of initialExpenses){
      tasks.push(setDoc(doc(db,'expenses',id),{category,title,amount,date:'',memo:'초기 예산표 반영',createdBy:user.uid,createdAt:serverTimestamp()}));
    }
  }
  const scheduleSnapshot=await getDocs(collection(db,'schedule'));
  if(scheduleSnapshot.empty){
    initialSchedule.forEach(([date,time,endTime,title,place,memo],i)=>{
      tasks.push(setDoc(doc(db,'schedule',`martys-2026-plan-${String(i+1).padStart(2,'0')}`),{date,time,endTime,title,place,memo,createdBy:user.uid,createdAt:serverTimestamp()}));
    });
  }
  const results=await Promise.allSettled(tasks);
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length){console.error('초기 데이터 등록 실패',failed);notice(`일정/예산 초기 등록 중 ${failed.length}건 실패: Firestore 권한을 확인해 주세요.`)}
}

async function start(){
  if(firebaseConfig.apiKey==='REPLACE_ME'){root.innerHTML='<main class="login-wrap"><div class="login-card"><h1>MARTYS</h1><p>Firebase 설정이 필요합니다.</p></div></main>';return}
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async u=>{
    cleanSubs();user=u;profile=null;
    if(u){try{const p=await getDoc(doc(db,'users',u.uid));if(p.exists()&&p.data().active===true&&p.data().role==='admin')profile=p.data();else{await signOut(auth);return}}catch(e){console.error('관리자 권한 확인 실패',e);await signOut(auth);return}}
    shell();listen();if(admin())seedInitialData().catch(e=>notice('초기 데이터 등록 실패: '+e.message));
  });
}
start().catch(e=>root.innerHTML=`<div class="login-wrap"><div class="login-card"><h3>초기화 오류</h3><p class="error">${esc(e.message)}</p></div></div>`);

// 모바일 찬양 가사 보기: 세 언어를 같은 줄에 배치합니다.
const lyricStyle=document.createElement('style');
lyricStyle.textContent=`
.song-detail{overflow:hidden}
.song-player{padding:18px 18px 14px;border-radius:16px;background:#f3f5f8;margin-bottom:28px}
.song-player h3{margin:8px 0 12px}
.song-player audio{width:100%;display:block}
.lyric-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:15px;border-bottom:1px solid #e8e9ed}
.lyric-head h3{margin:0}
.aligned-lyrics{padding:4px 0 18px}
.lyric-section-title{margin:30px 0 5px;padding:11px 14px;border-radius:12px;background:#f0f2f5;color:#24334a;font-size:16px;font-weight:800}
.lyric-section-title:first-child{margin-top:12px}
.lyric-verse{padding:18px 0;border-bottom:1px solid #eef0f3;word-break:keep-all;overflow-wrap:anywhere}
.lyric-jp{font-size:clamp(17px,4.5vw,21px);font-weight:700;line-height:1.65;letter-spacing:-.025em;color:#17233a}
.lyric-pr{font-size:clamp(15px,4vw,18px);line-height:1.7;color:#364d6c;margin-top:5px}
.lyric-ko{font-size:14px;line-height:1.7;color:#7c8390;margin-top:5px}
.lyric-break{height:18px}
@media(max-width:600px){.song-detail{padding:20px 18px}.song-player{padding:14px;margin-bottom:22px}.lyric-verse{padding:16px 0}}
`;
document.head.appendChild(lyricStyle);
