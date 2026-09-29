'use strict';
let landmarkLabels=[],labelFrame=0,arrivalStop=null,arrivalIndex=-1;
let arrivalAutoTimer=null;
function cancelArrivalAuto(){clearTimeout(arrivalAutoTimer);arrivalAutoTimer=null;}
const featureUI=document.createElement('div');
featureUI.innerHTML=`<div class="day-alternatives" id="alternatives" aria-label="같은 목적의 대안 코스"></div><p class="day-note" id="day-note"></p><details class="landmark-index"><summary>거점 20곳 모두 보기</summary><div id="landmark-index"></div></details>`;
$('route-description').after(featureUI);
const labelLayer=document.createElement('div');labelLayer.id='landmark-labels';
const leaderSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');leaderSvg.id='label-leaders';
const labelCount=document.createElement('div');labelCount.id='label-count';labelCount.textContent='거점 라벨 준비 중';
const arrivalCard=document.createElement('article');arrivalCard.id='arrival-card';arrivalCard.hidden=true;arrivalCard.setAttribute('aria-live','polite');
document.querySelector('.map-panel').append(leaderSvg,labelLayer,labelCount);
document.body.append(arrivalCard);
window.addEventListener('resize',positionArrival);

const playerPanel=document.querySelector('.player');
playerPanel.id='player-panel';playerPanel.setAttribute('role','group');playerPanel.setAttribute('aria-label','산책 재생 패널');
const playerToggle=document.createElement('button');
playerToggle.id='player-toggle';playerToggle.type='button';playerToggle.textContent='⌄ 최소화';
playerToggle.setAttribute('aria-expanded','true');playerToggle.setAttribute('aria-controls','player-panel');
playerToggle.setAttribute('aria-label','재생 패널 최소화');
document.querySelector('.player-top').append(playerToggle);
playerToggle.onclick=()=>{
  const collapsed=playerPanel.classList.toggle('is-collapsed');
  playerToggle.textContent=collapsed?'⌃ 펼치기':'⌄ 최소화';
  playerToggle.setAttribute('aria-expanded',String(!collapsed));
  playerToggle.setAttribute('aria-label',collapsed?'재생 패널 펼치기':'재생 패널 최소화');
  updatePlayerLayout();
};
function updatePlayerLayout(){
  const panel=document.querySelector('.map-panel');
  document.querySelector('.map-legend').style.bottom=matchMedia('(max-width:760px)').matches?'96px':`${panel.clientHeight-localBox(playerPanel).y+12}px`;
  scheduleLabels();
}
new ResizeObserver(updatePlayerLayout).observe(playerPanel);

function setupLandmarks(){
  const legend=document.querySelector('.map-legend');legend.replaceChildren();
  Object.entries(data.usePalette).forEach(([name,color])=>{const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=color;item.append(swatch,document.createTextNode(name));legend.append(item);});
  legend.title='건물속성 A9 용도 · UFID 우선 연결, 중복 시 연면적 합계가 큰 용도. 층수 × 3m';
  landmarkLabels=data.landmarks.map(poi=>{
    const el=document.createElement('button');el.className='landmark-label';el.title=poi.name;
    el.onclick=()=>showArrival(poi,-1,false);labelLayer.append(el);
    const indexButton=document.createElement('button');indexButton.textContent=`${poi.name} · ${poi.kind}`;
    indexButton.onclick=()=>{map.flyTo({center:poi.placeCoordinates,zoom:16.5});showArrival(poi,-1,false);};
    $('landmark-index').append(indexButton);
    return {poi,el};
  });
  map.on('move',scheduleLabels);map.on('resize',scheduleLabels);
  new ResizeObserver(scheduleLabels).observe(document.querySelector('.map-panel'));
  scheduleLabels();
}
function scheduleLabels(){if(!labelFrame)labelFrame=requestAnimationFrame(()=>{labelFrame=0;layoutLandmarks();});}
function localBox(el){const root=document.querySelector('.map-panel').getBoundingClientRect(),r=el.getBoundingClientRect();return {x:r.left-root.left,y:r.top-root.top,w:r.width,h:r.height};}
function layoutLandmarks(){
  if(!loaded||!landmarkLabels.length)return;
  const panel=document.querySelector('.map-panel'),width=panel.clientWidth,height=panel.clientHeight;
  positionArrival();
  const blockers=[localBox(document.querySelector('.map-top')),localBox(document.querySelector('.player')),localBox(document.querySelector('.map-legend')),localBox(labelCount)];
  if(!arrivalCard.hidden)blockers.push(localBox(arrivalCard));
  if(marker){const box=localBox(walker);blockers.push({x:box.x-4,y:box.y-4,w:box.w+8,h:box.h+8});if(!$('bubble').hidden)blockers.push(localBox($('bubble')));}
  const stopIds=route.stops.map(s=>s.id);
  const items=landmarkLabels.map(({poi,el})=>{
    const index=stopIds.indexOf(poi.id);el.textContent=`${index>=0?`${index+1} · `:''}${poi.name}`;el.classList.toggle('on-route',index>=0);
    el.style.visibility='hidden';el.hidden=false;
    const p=map.project(poi.placeCoordinates);return {id:poi.id,px:p.x,py:p.y,w:el.offsetWidth,h:el.offsetHeight,priority:index>=0?index:-1};
  }).sort((a,b)=>(a.priority<0?100:a.priority)-(b.priority<0?100:b.priority));
  const placed=WalkLayout.placeLabels(items,width,height,blockers);leaderSvg.replaceChildren();
  for(const {el} of landmarkLabels)el.hidden=true;
  for(const item of placed){
    const {el}=landmarkLabels.find(l=>l.poi.id===item.id);el.hidden=false;el.style.visibility='visible';el.style.left=`${item.x}px`;el.style.top=`${item.y}px`;
    const lineEl=document.createElementNS(leaderSvg.namespaceURI,'line');lineEl.setAttribute('x1',item.px);lineEl.setAttribute('y1',item.py);lineEl.setAttribute('x2',Math.max(item.x,Math.min(item.x+item.w,item.px)));lineEl.setAttribute('y2',Math.max(item.y,Math.min(item.y+item.h,item.py)));leaderSvg.append(lineEl);
  }
  labelCount.textContent=`거점 ${placed.length}/20 표시 · 확대하면 더 보여요`;
}
function renderAlternatives(){
  hideArrival();
  const peers=data.routes.map((r,i)=>({...r,index:i})).filter(r=>r.theme===route.theme);
  $('alternatives').replaceChildren(...peers.map(r=>{const b=document.createElement('button');const selected=r.variant===route.variant;b.className=selected?'selected':'';b.setAttribute('aria-pressed',String(selected));b.textContent=`${'ABC'[r.variant]}안 ${selected?'━':'┄'} ${(r.distance/1000).toFixed(1)}km`;b.onclick=()=>{$('route').value=r.index;selectRoute();};return b;}));
  const duration=Math.ceil(route.totalMinutes),end=600+duration;
  $('day-note').textContent=`8곳 · 10:00–${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')} (체류 포함 가정) / 주 코스 실선 · 대안 2개 점선. 영업·예약 미확인.`;
  if(loaded){
    const other=peers.filter(r=>r.variant!==route.variant);
    other.forEach((r,i)=>map.getSource(`alternative-${i}`).setData(line(r.coordinates)));
  }
  scheduleLabels();
}
function showArrival(stop,index,arrived=true){
  cancelArrivalAuto();
  arrivalStop=stop;arrivalIndex=index;arrivalCard.replaceChildren();arrivalCard.hidden=false;
  const close=document.createElement('button');close.className='arrival-close';close.textContent='×';close.setAttribute('aria-label','장소 카드 닫기');close.onclick=hideArrival;
  const img=document.createElement('img');img.src=stop.image;img.alt=stop.photo?`${stop.name} 외관 사진`:`${stop.name} 인근 건물 데이터 모형`;img.onerror=()=>{img.hidden=true;};
  const tag=document.createElement('small');tag.textContent=`${arrived?`${index+1}번 도착`:'거점 안내'} · ${stop.kind}`;
  const title=document.createElement('h3');title.textContent=stop.name;
  const info=stop.info;
  const warning=document.createElement('p');warning.className='arrival-tip';warning.hidden=!info?.statusNote;warning.textContent=info?.statusNote||'';
  if(info?.statusSource){const a=document.createElement('a');a.href=info.statusSource;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 확인 자료 ↗';warning.append(a);}
  const text=document.createElement('p');text.textContent=info?.summary||stop.description;
  const highlights=document.createElement('ul');highlights.className='arrival-highlights';
  (info?.highlights||[]).forEach(h=>{const li=document.createElement('li');li.textContent=h;highlights.append(li);});
  const tip=document.createElement('p');tip.className='arrival-tip';tip.hidden=!info?.tip;tip.textContent=info?.tip?`TIP · ${info.tip}`:'';
  const caption=document.createElement('small');caption.className='image-credit';caption.textContent=stop.imageCaption;
  if(stop.photoSource){const source=document.createElement('a');source.href=stop.photoSource;source.target='_blank';source.rel='noopener noreferrer';source.textContent=' 원문 출처 ↗';caption.append(source);}
  const infoSource=document.createElement('small');infoSource.className='image-credit';
  if(info?.source){infoSource.textContent=`소개 출처 · ${info.sourceName||'웹'} `;const a=document.createElement('a');a.href=info.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent='원문 ↗';infoSource.append(a);}
  else infoSource.textContent='소개문 미확인 · 방문 전 최신 정보를 확인하세요.';
  const stay=document.createElement('p');stay.className='arrival-stay';stay.textContent=stop.stay?`예시 체류 ${stop.stay}분 · 실제 운영정보 미확인`:'교통 거점 · 실제 출입구 확인 필요';
  const nextLeg=index>=0?legInfo(stop.at,index+1):null;
  const legLine=document.createElement('p');legLine.className='arrival-leg';legLine.hidden=!nextLeg;legLine.textContent=nextLeg?`다음 → ${legText(nextLeg)}`:'';
  const action=document.createElement('button');action.className='primary';action.textContent=arrived&&index<route.stops.length-1?'다음 장소로 걷기': '닫고 지도 보기';
  action.onclick=()=>{hideArrival();if(arrived&&index<route.stops.length-1){setPlaying(true);speak(`continue-${index}`,`${stop.name} 방문을 마치고 ${route.stops[index+1].name} 쪽으로 출발해요.`);renderPosition();}};
  arrivalCard.append(close,img,tag,title,warning,text,highlights,tip,stay,legLine,infoSource,caption,action);
  if(arrived&&index>=0&&index<route.stops.length-1){
    const pendingRoute=route;
    const autoNote=document.createElement('p');autoNote.className='arrival-leg';autoNote.textContent='10초 후 다음 장소로 자동 출발합니다.';
    const hold=document.createElement('button');hold.type='button';hold.textContent='자동 출발 멈추고 더 보기';
    hold.onclick=()=>{cancelArrivalAuto();autoNote.textContent='자동 출발을 멈췄어요. 준비되면 다음 장소로 걷기를 누르세요.';hold.hidden=true;};
    arrivalCard.append(autoNote,hold);
    arrivalAutoTimer=setTimeout(()=>{
      arrivalAutoTimer=null;
      if(route===pendingRoute&&arrivalStop===stop&&!arrivalCard.hidden&&!playing)action.onclick();
    },10000);
  }
  // Offset only for the portion of the screen-edge card overlapping the map.
  if(arrived){const panel=document.querySelector('.map-panel').getBoundingClientRect(),card=arrivalCard.getBoundingClientRect();const phone=matchMedia('(max-width:760px)').matches;const overlap=phone?Math.max(0,panel.bottom-card.top):Math.max(0,panel.right-card.left);map.easeTo({center:stop.coordinates,offset:phone?[0,-Math.min(overlap/2,panel.height/4)]:[-overlap/2,0],duration:500});}
  positionArrival();scheduleLabels();
}
function hideArrival(){cancelArrivalAuto();arrivalCard.hidden=true;arrivalStop=null;$('bubble').hidden=!$('speech').checked;scheduleLabels();}
function positionArrival(){
  if(!arrivalStop||arrivalCard.hidden)return;
  const top=Math.min(96,Math.max(12,innerHeight*.12));
  arrivalCard.style.maxHeight=`${Math.max(0,innerHeight-top-16)}px`;
  arrivalCard.style.top=`${top}px`;
}
