/* ═══════════ 상태 ═══════════ */
const S={lv:0,qs:[],i:0,score:0,combo:0,best:{},unlocked:{},wrong:[],recovered:[],locked:false,retry:false,attempt:1,
  wrongBank:{},streak:0,lastPlayDate:null,virtualKind:null};
let VIRTUAL_LEVEL=null;
function curLevel(){ return S.lv==='virtual' ? VIRTUAL_LEVEL : LEVELS[S.lv]; }
const $=id=>document.getElementById(id);
const show=id=>document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));

function parse(item){
  const m=item.s.match(/\[(.+?)\]/);
  if(!m) return {...item,t:'',html:item.s};   // 대괄호가 없으면 강조 없이 그대로 표시(문항 편집 실수 방지)
  return {...item,t:m[1],html:item.s.replace(/\[(.+?)\]/,'<mark>$1</mark>')};
}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
/* 정답 통(bin) 기준으로 고르게 뽑기 — "나누기" 단계에서 특정 품사가 통째로 안 나오는 것 방지 */
function sampleByBin(pool,L,n){
  const binOf = w => L.map ? L.map(w) : w.p;   // 2단계=w.p, 8단계=w.role
  const groups={};
  shuffle(pool).forEach(w=>{ const b=binOf(w); (groups[b]=groups[b]||[]).push(w); });
  const bins=Object.keys(groups), out=[];
  let added=true;
  while(out.length<n && added){                // 통을 돌아가며 한 개씩(라운드로빈)
    added=false;
    for(const b of bins){ if(groups[b].length){ out.push(groups[b].pop()); added=true; if(out.length>=n) break; } }
  }
  return shuffle(out);
}

/* ── 홈 ── */
let TEACHER=false;
function drawMap(){
  const all=TEACHER;
  $('map').innerHTML='';
  LEVELS.forEach((L,idx)=>{
    const open = all || idx===0 || S.unlocked[idx-1];
    const b=document.createElement('button');
    b.className='stage'; b.disabled=!open;
    const sw=L.bins.map(n=>{
      const c=L.color?L.color(n):POS[n].c;
      return `<i style="background:${c}"></i>`;
    }).join('');
    b.innerHTML=`<span class="no">${L.n}</span>
      <span class="tt"><b>${L.name}</b><span>${L.sub} · 통 ${L.bins.length}개</span></span>
      <span class="swatches">${sw}</span>
      ${S.best[idx]!=null?`<span class="sc">${S.best[idx]}/10</span>`:''}`;
    b.onclick=()=>start(idx);
    $('map').appendChild(b);
  });
  if(TEACHER && !$('teacherTag')){
    const t=document.createElement('div');
    t.id='teacherTag'; t.className='teacherTag'; t.textContent='교사 모드 · 전체 단계 열림';
    $('map').before(t);
  }else if(!TEACHER){
    const old=$('teacherTag'); if(old) old.remove();
  }

  $('streakTag').textContent = S.streak>=2 ? `🔥 ${S.streak}일 연속 학습 중!` : '';

  const wrongCount=Object.keys(S.wrongBank).length;
  const knownCount=knownPOS().size;
  const bar=$('reviewBar'); bar.innerHTML='';
  /* 세 칸을 항상 표시. 아직 못 쓰는 복습 버튼은 비활성(흐림) + 안내문구 */
  const addReviewBtn=(cls,ic,title,sub,enabled,onclick)=>{
    const b=document.createElement('button');
    b.className='reviewBtn'+(cls?' '+cls:''); b.type='button'; b.disabled=!enabled;
    b.innerHTML=`<span class="ic">${ic}</span><span class="tx"><b>${title}</b><span>${sub}</span></span>`;
    if(enabled) b.onclick=onclick;
    bar.appendChild(b);
  };
  addReviewBtn('', '📝', '틀린 문제만 복습',
    wrongCount ? `지금까지 틀린 ${wrongCount}개` : '아직 틀린 문제가 없어요',
    wrongCount>0, startReview);
  addReviewBtn('', '🔀', '자유 복습',
    knownCount ? '배운 것 전부 섞어서 풀기' : '1단계를 통과하면 열려요',
    knownCount>0, startFreePractice);
  addReviewBtn('ref', '📖', '품사 한눈에 보기', '9품사 정리 카드', true, ()=>show('s-ref'));
}

/* 타이틀 5번 탭 → 비밀번호 모달 → 교사 모드 */
let tapCount=0, tapTimer=null;
$('titleTap').addEventListener('click',()=>{
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>{ tapCount=0; },1200);
  if(tapCount>=5){
    tapCount=0;
    $('pwErr').classList.remove('on');
    $('pwInput').value='';
    $('pwModal').classList.add('on');
    setTimeout(()=>$('pwInput').focus(),50);
  }
});
$('pwCancel').onclick=()=>{ $('pwModal').classList.remove('on'); };
$('pwOk').onclick=()=>{
  if($('pwInput').value==='308038'){
    TEACHER=!TEACHER;
    $('pwModal').classList.remove('on');
    drawMap();
  }else{
    $('pwErr').classList.add('on');
  }
};
$('pwInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('pwOk').click(); });

/* ── 복습 모드 ── */
function knownPOS(){
  const s=new Set();
  if(S.unlocked[1]){s.add('명사');s.add('대명사');s.add('수사');}
  if(S.unlocked[3]){s.add('동사');s.add('형용사');}
  if(S.unlocked[5]){s.add('관형사');s.add('부사');}
  if(S.unlocked[7]){s.add('조사');}
  if(S.unlocked[8]){s.add('감탄사');}
  return s;
}
function startReview(){
  const items=Object.values(S.wrongBank);
  if(!items.length) return;
  S.virtualKind='review';
  VIRTUAL_LEVEL={name:'틀린 문제 복습',
    bins:['명사','대명사','수사','동사','형용사','관형사','부사','조사','감탄사']};
  start('virtual', shuffle(items).slice(0,20));
}
function startFreePractice(){
  const known=knownPOS();
  if(!known.size) return;
  const pool=BANK.filter(w=>known.has(w.p));
  S.virtualKind='free';
  VIRTUAL_LEVEL={name:'자유 복습', bins:[...known]};
  start('virtual', shuffle(pool).slice(0,15).map(parse));
}

/* ── 시작 ── */
function start(idx,retryList){
  S.lv=idx; S.i=0; S.score=0; S.combo=0; S.wrong=[]; S.recovered=[]; S.locked=false; S.retry=!!retryList;
  const L = idx==='virtual' ? VIRTUAL_LEVEL : LEVELS[idx];
  if(retryList){
    S.qs=shuffle(retryList);
  }else if(L.pool===null && L.bins.length===2){
    /* 골라내기 단계: 목표 그룹 4~5개 : 나머지 5~6개 비율로 강제 샘플링 (자연 비율이면 목표 그룹이 너무 적게 나옴) */
    const target=L.bins[0];
    const yes=shuffle(BANK.filter(w=>L.map(w)===target));
    const no=shuffle(BANK.filter(w=>L.map(w)!==target));
    const yesCount=Math.random()<0.5?4:5;
    S.qs=shuffle([...yes.slice(0,yesCount), ...no.slice(0,10-yesCount)]).map(parse);
  }else{
    let pool = L.pool ? BANK.filter(w=>L.pool.includes(w.p)) : BANK;
    S.qs = sampleByBin(pool,L,10).map(parse);
  }
  $('lvTag').textContent = idx==='virtual' ? L.name : `${L.n}단계`;
  buildBins(); buildBelt(); render(); show('s-play');
}

function answerOf(w){ const L=curLevel(); return L.map?L.map(w):w.p; }
function binColor(name){ const L=curLevel(); return L.color?L.color(name):POS[name].c; }

function buildBins(){
  const L=curLevel(), box=$('bins');
  box.style.gridTemplateColumns = L.bins.length<=2?'repeat(2,1fr)'
    : L.bins.length===3?'repeat(3,1fr)' : 'repeat(3,1fr)';
  box.style.setProperty('--bh', L.bins.length>=9?'70px':(L.bins.length===3?'86px':'100px'));
  box.innerHTML='';
  L.bins.forEach((name,k)=>{
    const b=document.createElement('button');
    b.className='bin'; b.style.setProperty('--c',binColor(name));
    b.innerHTML=`<span class="lid"><span class="handle"></span></span><span class="mouth"></span>
      <span class="body"><span class="name">${name}</span><span class="key">${k+1}</span></span>`;
    b.onclick=()=>pick(name,b);
    box.appendChild(b);
  });
}
function buildBelt(){
  $('belt').innerHTML=S.qs.map(()=>'<i></i>').join('');
}
function markBelt(state){
  const els=$('belt').children;
  if(els[S.i]) els[S.i].className=state;
}

function render(){
  const w=S.qs[S.i];
  S.attempt=1;
  $('score').textContent=S.score;
  $('combo').textContent = S.combo>=2 ? `${S.combo}연속 정확 선별!` : '';
  markBelt('now');
  $('cardSlot').innerHTML=`<div class="card" id="card">
    <div class="q">밑줄 친 말의 품사는?</div>
    <div class="sent">${w.html}</div></div>`;
  document.querySelectorAll('.bin').forEach(b=>{b.disabled=false; b.classList.remove('hit','miss');});
  S.locked=false;
}

function pick(name,el){
  if(S.locked) return;
  const w=S.qs[S.i], ans=answerOf(w), ok=(name===ans);
  const L=curLevel();
  const card=$('card');

  /* 1차 시도가 오답이면 정답을 알려주지 않고 다시 고를 기회를 준다 */
  if(S.attempt===1 && !ok){
    S.locked=true;
    S.combo=0;
    $('combo').textContent='';
    el.disabled=true; el.classList.add('miss');
    setTimeout(()=>{
      card.insertAdjacentHTML('beforeend',`<div class="retry-note">
        <b>오답이에요, 다시 골라볼까요?</b>
        <button class="hint-btn" id="hintBtn" onclick="showHint()">힌트 보기</button>
        <div class="hint-box" id="hintBody"></div></div>`);
      document.querySelectorAll('.bin').forEach(b=>{ if(b!==el) b.disabled=false; });
      S.attempt=2;
      S.locked=false;
    },280);
    return;
  }

  /* 최종 시도(1차 정답 또는 2차 시도) — 여기서 정답 공개 */
  S.locked=true;
  document.querySelectorAll('.bin').forEach(b=>b.disabled=true);
  el.classList.add('hit');
  const secondTry = S.attempt===2;

  if(ok){
    if(secondTry){
      S.score += 50; S.recovered.push({...w});
      S.wrongBank[w.s]={...w}; saveProgress();   // 재도전으로 맞혀도 "한 번 틀린" 것이므로 복습 대상에 포함
    }else{
      S.combo++; S.score += 100 + Math.min(S.combo-1,5)*20;
      if(S.wrongBank[w.s]){ delete S.wrongBank[w.s]; saveProgress(); }   // 첫 시도 정답 → 확실히 아는 것 → 은행에서 제거
    }
    card.classList.add('drop');
  }else{
    S.combo=0;
    S.wrong.push({...w,pick:name,ans});
    card.classList.add('shake');
    S.wrongBank[w.s]={...w};
    saveProgress();
  }
  markBelt(ok?'done':'miss');
  $('score').textContent=S.score;

  setTimeout(()=>{
    const why = L.why ? L.why(w,name) : w.why;
    $('cardSlot').innerHTML=`<div class="verdict ${ok?'y':'n'}">
      <b>${ok?'정확한 선별':`${ans} 통으로 가야 해요`}</b>
      <p>${why}</p>
      <button class="next-btn" onclick="next()">다음 문제</button></div>`;
  }, ok?420:360);
}

function showHint(){
  const remain=[...document.querySelectorAll('.bin')]
    .filter(b=>!b.disabled)
    .map(b=>b.querySelector('.name').textContent);
  $('hintBody').innerHTML = remain
    .map(n=>`<div><span class="hl">${n}</span> — ${DEF[n]||GROUPDEF[n]||''}</div>`)
    .join('');
  $('hintBtn').style.display='none';
}

function next(){
  S.i++;
  if(S.i>=S.qs.length) finish(); else render();
}

/* ── 결과 ── */
function finish(){
  const isVirtual = S.lv==='virtual';
  const L=curLevel(), correct=S.qs.length-S.wrong.length-S.recovered.length;
  if(!S.retry){
    S.best[S.lv]=correct;                      // 표시용 기록: 가장 최근 시도
    if(correct>=7) S.unlocked[S.lv]=true;       // 잠금 해제: 한 번이라도 7개 이상이면 영구 고정
  }
  updateStreak();
  saveProgress();
  $('doneLv').textContent = isVirtual ? L.name : `${L.n}단계 · ${L.name}`;
  const perfect = S.wrong.length===0 && S.recovered.length===0;
  $('doneTitle').textContent = perfect?'완벽한 선별':'선별 완료';
  $('doneScore').innerHTML=`${S.score}<span>점</span>`;
  $('doneRate').textContent=`${S.qs.length}개 중 ${correct}개 정확`;

  let wrongHtml='';
  if(S.wrong.length){
    wrongHtml += S.wrong.map(w=>`<div class="wrongline">
        <span class="w">${w.t}</span>
        <span class="a">${w.pick}에 넣음</span>
        <span class="b">${w.ans}</span></div>`).join('');
  }
  if(S.recovered.length){
    wrongHtml += S.recovered.map(w=>`<div class="wrongline">
        <span class="w">${w.t}</span>
        <span class="a" style="color:var(--ink-2)">한 번 틀렸다가</span>
        <span class="b">재도전으로 정답</span></div>`).join('');
  }
  const isLastLevel = !isVirtual && !LEVELS[S.lv+1];
  $('wrongList').innerHTML = perfect
    ? `<div class="perfect">틀린 것이 없어요. ${isLastLevel?'모든 단계를 완벽하게 끝냈어요!':'다음 통을 열어 볼까요?'}</div>`
    : wrongHtml;

  const acts=$('doneActions'); acts.innerHTML='';
  if(S.wrong.length){
    const r=document.createElement('button');
    r.className='btn'; r.textContent=`틀린 ${S.wrong.length}개만 다시`;
    const list=[...S.wrong]; r.onclick=()=>start(S.lv,list);
    acts.appendChild(r);
  }
  const a=document.createElement('button');
  a.className='btn ghost'; a.textContent='이 단계 다시';
  a.onclick=()=> isVirtual
    ? (S.virtualKind==='review'?startReview():startFreePractice())
    : start(S.lv);
  acts.appendChild(a);

  const nx = isVirtual ? null : LEVELS[S.lv+1];
  if(nx && (S.unlocked[S.lv] || TEACHER)){
    const n=document.createElement('button');
    n.className='btn'; n.textContent=`${nx.n}단계로`;
    n.onclick=()=>start(S.lv+1); acts.appendChild(n);
  }
  const h=document.createElement('button');
  h.className='btn ghost'; h.textContent='단계 선택';
  h.onclick=()=>{drawMap();show('s-home')}; acts.appendChild(h);

  show('s-done');
}

/* ── 기록 저장(이 기기에만) ── */
const SAVE_KEY='pumsa-recycling-progress-v3';
function saveProgress(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      best:S.best, unlocked:S.unlocked, wrongBank:S.wrongBank,
      streak:S.streak, lastPlayDate:S.lastPlayDate
    }));
  }catch(e){ /* 저장 안 되면 그냥 이번 세션만 유지 */ }
}
function loadProgress(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw){
      const d=JSON.parse(raw)||{};
      S.best=d.best||{}; S.unlocked=d.unlocked||{}; S.wrongBank=d.wrongBank||{};
      S.streak=d.streak||0; S.lastPlayDate=d.lastPlayDate||null;
    }
  }catch(e){ /* 무시 */ }
}
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function updateStreak(){
  const today=todayStr();
  if(S.lastPlayDate===today) return;
  const y=new Date(); y.setDate(y.getDate()-1);
  const yStr=`${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;
  S.streak = (S.lastPlayDate===yStr) ? (S.streak||0)+1 : 1;
  S.lastPlayDate=today;
}
$('resetProg').onclick=()=>{ $('resetModal').classList.add('on'); };
$('resetCancel').onclick=()=>{ $('resetModal').classList.remove('on'); };
$('resetOk').onclick=()=>{
  S.best={}; S.unlocked={}; S.wrongBank={}; S.streak=0; S.lastPlayDate=null;
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  $('resetModal').classList.remove('on');
  drawMap();
};

$('exitBtn').onclick=()=>{drawMap();show('s-home')};
document.addEventListener('keydown',e=>{
  if(!$('s-play').classList.contains('on')||S.locked) return;
  const k=parseInt(e.key,10);
  const bins=document.querySelectorAll('.bin');
  if(k>=1&&k<=bins.length) bins[k-1].click();
});

/* ── 품사 한눈에 보기 ── */
const GROUP_ORDER=['체언','용언','수식언','관계언','독립언'];
function buildRefCard(){
  const body=$('refBody'); body.innerHTML='';
  GROUP_ORDER.forEach(g=>{
    const names=Object.keys(POS).filter(n=>POS[n].g===g);
    const grp=document.createElement('div'); grp.className='refGroup';
    grp.innerHTML=`<h3>${g}</h3>`;
    names.forEach(n=>{
      const c=document.createElement('div'); c.className='refCard';
      c.innerHTML=`<span class="dot" style="background:${POS[n].c}"></span>
        <div><b>${n}</b><span>${DEF[n]}</span></div>`;
      grp.appendChild(c);
    });
    body.appendChild(grp);
  });
}
$('refBack').onclick=()=>{show('s-home')};
buildRefCard();

loadProgress();
drawMap();
