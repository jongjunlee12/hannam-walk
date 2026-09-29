'use strict';
const mobileScreen=matchMedia('(max-width:760px)');
const routePanel=document.querySelector('.route-panel');
const interests=document.createElement('div');interests.className='interest-buttons';interests.setAttribute('role','group');interests.setAttribute('aria-label','관심사로 코스 고르기');
['문화와 미식','식사와 카페','쇼핑과 골목'].forEach((theme,i)=>{
  const button=document.createElement('button');button.type='button';button.disabled=true;button.textContent=['문화·미식','식사·카페','쇼핑·골목'][i];button.dataset.theme=theme;
  button.onclick=()=>{const index=data.routes.findIndex(r=>r.theme===theme);if(index>=0){$('route').value=String(index);selectRoute();}};
  interests.append(button);
});
routePanel.querySelector('h2').after(interests);
document.addEventListener('walk-route-change',()=>{
  interests.querySelectorAll('button').forEach(button=>{button.disabled=false;button.setAttribute('aria-pressed',String(button.dataset.theme===route.theme));});
  const url=new URL(location.href);url.searchParams.set('route',$('route').value);history.replaceState(null,'',url);
});
const focusMapButton=document.createElement('button');focusMapButton.type='button';focusMapButton.textContent='지도 크게';focusMapButton.setAttribute('aria-pressed','false');
document.querySelector('.map-top>div').append(focusMapButton);
let beforeFocusScroll=0;
function setMapFocus(active){
  if(active)beforeFocusScroll=window.scrollY;
  document.body.classList.toggle('map-focused',active);focusMapButton.setAttribute('aria-pressed',String(active));focusMapButton.textContent=active?'원래 화면':'지도 크게';
  requestAnimationFrame(()=>{if(map){map.resize();updatePlayerLayout();scheduleLabels();}if(!active)window.scrollTo(0,beforeFocusScroll);});
}
focusMapButton.onclick=()=>setMapFocus(!document.body.classList.contains('map-focused'));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('map-focused')){setMapFocus(false);focusMapButton.focus();}});
const routeToggle=document.createElement('button');
routeToggle.className='mobile-route-toggle';routeToggle.type='button';
routePanel.id='route-panel';routeToggle.setAttribute('aria-controls','route-panel');
routePanel.append(routeToggle);
function setRouteFolded(folded){
  routePanel.classList.toggle('mobile-folded',folded);
  routeToggle.setAttribute('aria-expanded',String(!folded));
  routeToggle.textContent=folded?'코스 상세 펼치기 ▾':'코스 상세 접기 ▴';
}
setRouteFolded(mobileScreen.matches);
routeToggle.onclick=()=>setRouteFolded(!routePanel.classList.contains('mobile-folded'));
if(!playerPanel.classList.contains('is-collapsed'))playerToggle.click();
document.querySelector('#play').addEventListener('click',()=>{
  if(mobileScreen.matches&&playing)document.querySelector('.map-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});
const shareButton=document.createElement('button');shareButton.className='share-link';shareButton.type='button';shareButton.textContent='링크 공유';
document.querySelector('header').append(shareButton);
const shareStatus=document.createElement('div');shareStatus.className='share-status';shareStatus.hidden=true;shareStatus.setAttribute('role','status');document.body.append(shareStatus);
let shareStatusTimer;
shareButton.onclick=async()=>{
  const url=new URL(location.href);url.hash='';
  if(route)url.searchParams.set('route',$('route').value);
  try{
    if(navigator.share){await navigator.share({title:'한남걸음 · 한남동 산책',url:url.href});return;}
    await navigator.clipboard.writeText(url.href);
    shareStatus.textContent='링크를 복사했어요. 메시지에 붙여넣어 보내세요.';
  }catch(error){
    if(error.name==='AbortError')return;
    shareStatus.textContent='주소창의 링크를 복사해 보내주세요.';
  }
  shareStatus.hidden=false;clearTimeout(shareStatusTimer);shareStatusTimer=setTimeout(()=>shareStatus.hidden=true,5000);
};
