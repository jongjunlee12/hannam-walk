'use strict';
const mobileScreen=matchMedia('(max-width:760px)');
const routePanel=document.querySelector('.route-panel');
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
const shareButton=document.createElement('button');shareButton.className='share-link';shareButton.type='button';shareButton.textContent='링크 공유';
document.querySelector('header').append(shareButton);
const shareStatus=document.createElement('div');shareStatus.className='share-status';shareStatus.hidden=true;shareStatus.setAttribute('role','status');document.body.append(shareStatus);
let shareStatusTimer;
shareButton.onclick=async()=>{
  const url=new URL(location.href);url.hash='';
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
