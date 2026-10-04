'use strict';
// 매장 고객 거주지 TOP5를 지도 위 OD 곡선·순위 원형 핀으로 그리는 모듈 (시군구/행정동 전환, 부드러운 등장 애니메이션)
const RESIDENCE_COLORS=['#0064e0','#2f8f6b','#c2410c','#6b3fa8','#8a6d1d'];
let residenceGeoPromise=null,residencePins=[],residenceFrame=0,residenceState=null;
const residenceBar=document.createElement('div');residenceBar.className='residence-map-bar';residenceBar.hidden=true;
document.querySelector('.map-panel').append(residenceBar);
function loadResidenceGeo(){
  if(!residenceGeoPromise)residenceGeoPromise=fetch('residence-geo.json').then(r=>{if(!r.ok)throw Error('fetch');return r.json();}).catch(error=>{residenceGeoPromise=null;throw error;});
  return residenceGeoPromise;
}
function ensureResidenceLayers(){
  if(map.getSource('residence-od'))return;
  map.addSource('residence-od',{type:'geojson',data:collection([])});
  map.addSource('residence-origin',{type:'geojson',data:collection([])});
  // The origin halo marks the store area; flows are drawn above it with a white halo for contrast.
  map.addLayer({id:'residence-origin',type:'circle',source:'residence-origin',paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,14,12,22,16,34],'circle-color':'#0064e0','circle-opacity':.22,'circle-stroke-color':'#0064e0','circle-stroke-width':2,'circle-stroke-opacity':.7}});
  map.addLayer({id:'residence-od-halo',type:'line',source:'residence-od',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':['+',['get','width'],3],'line-opacity':.9}});
  map.addLayer({id:'residence-od',type:'line',source:'residence-od',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['get','width'],'line-opacity':.9}});
}
// Quadratic arc bulging to the left of travel so overlapping flows stay distinguishable.
function residenceArc(from,to,steps=48){
  const mx=(from[0]+to[0])/2,my=(from[1]+to[1])/2,dx=to[0]-from[0],dy=to[1]-from[1];
  const ctrl=[mx-dy*.2,my+dx*.2*(88200/111200)],points=[];
  for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;points.push([u*u*from[0]+2*u*t*ctrl[0]+t*t*to[0],u*u*from[1]+2*u*t*ctrl[1]+t*t*to[1]]);}
  return points;
}
function clearResidenceMap(){
  cancelAnimationFrame(residenceFrame);residenceFrame=0;
  residencePins.forEach(pin=>pin.remove());residencePins=[];residenceState=null;
  residenceBar.hidden=true;
  if(map&&map.getSource('residence-od')){map.getSource('residence-od').setData(collection([]));map.getSource('residence-origin').setData(collection([]));}
  document.querySelectorAll('.residence-map-buttons button').forEach(b=>b.setAttribute('aria-pressed','false'));
}
function showResidenceMap(store,month,kind,rows,geo){
  if(!loaded)return;
  ensureResidenceLayers();
  cancelAnimationFrame(residenceFrame);residencePins.forEach(pin=>pin.remove());residencePins=[];
  const list=(rows[kind]||[]).map((r,i)=>{const code=r[r.length-1],place=geo[kind][code];if(!place)return null;const name=kind==='sgg'?(place[2]||r[0]):`${r[0]} · ${r[1]}`;return {rank:i+1,name,pct:r[r.length-2],count:r[r.length-3],to:[place[0],place[1]],approx:kind==='dong'&&place[2]===1};}).filter(Boolean);
  residenceState={store,month,kind};
  document.querySelectorAll('.residence-map-buttons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
  map.getSource('residence-origin').setData(collection([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:store.coordinates}}]));
  residenceBar.hidden=false;residenceBar.replaceChildren();
  const title=insightEl('strong',`${store.name} · 고객 거주 ${kind==='sgg'?'시군구':'행정동'} TOP${list.length} · ${monthLabel(month)}`);
  const close=insightEl('button','지도 닫기');close.type='button';close.onclick=()=>{clearResidenceMap();map.easeTo({center:store.coordinates,zoom:16.5,duration:600});};
  const note=insightEl('small',`선 굵기·원 크기는 전체 고객 대비 비율입니다. ${list.some(l=>l.approx)?'※ 표시는 시군구 중심 근사 위치입니다. ':''}순위 원을 누르면 라벨을 접고 폅니다.`);
  residenceBar.append(title,close,note);
  if(!list.length){map.getSource('residence-od').setData(collection([]));residenceBar.append(insightEl('small','표시할 거주지 좌표가 없습니다.'));return;}
  const bounds=new maplibregl.LngLatBounds(store.coordinates,store.coordinates);list.forEach(l=>bounds.extend(l.to));
  const phone=matchMedia('(max-width:760px)').matches;
  // Flat view: the ground-level flows would otherwise disappear behind the 3D buildings.
  if(map.getPitch()||map.getBearing())map.jumpTo({pitch:0,bearing:0});
  map.fitBounds(bounds,{padding:phone?{top:120,bottom:120,left:40,right:40}:{top:140,bottom:120,left:120,right:360},duration:800,maxZoom:14});
  const peak=Math.max(.1,...list.map(l=>l.pct||0));
  const arcs=list.map(l=>({...l,points:residenceArc(store.coordinates,l.to),width:2+8*(l.pct||0)/peak,color:RESIDENCE_COLORS[l.rank-1]}));
  list.forEach((l,i)=>{
    const el=document.createElement('button');el.type='button';el.className='residence-pin';el.style.setProperty('--pin',RESIDENCE_COLORS[i]);el.style.setProperty('--size',`${26+22*(l.pct||0)/peak}px`);el.style.setProperty('--delay',`${300+i*120}ms`);
    el.setAttribute('aria-label',`${l.rank}위 ${l.name} ${l.pct==null?'':l.pct.toFixed(1)+'%'}`);
    const dot=insightEl('span',String(l.rank),'residence-pin-dot'),label=insightEl('span',null,'residence-pin-label');
    label.append(insightEl('b',l.name),insightEl('i',`${l.pct==null?'':l.pct.toFixed(1)+'%'}${l.count==null?'':' · '+fmt(l.count)}`));
    el.append(dot,label);el.onclick=event=>{event.stopPropagation();el.classList.toggle('is-folded');};
    residencePins.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(l.to).addTo(map));
  });
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now(),duration=reduce?0:900;
  const draw=eased=>map.getSource('residence-od').setData(collection(arcs.map(a=>({type:'Feature',properties:{color:a.color,width:a.width},geometry:{type:'LineString',coordinates:a.points.slice(0,Math.max(2,Math.round(1+eased*(a.points.length-1))))}}))));
  const render=now=>{
    const t=duration?Math.min(1,(now-start)/duration):1;draw(1-Math.pow(1-t,3));
    if(t<1)residenceFrame=requestAnimationFrame(render);else residenceFrame=0;
  };
  draw(duration?0:1);residenceFrame=requestAnimationFrame(render);
  // A throttled or hidden tab may never animate; make sure the full flows exist regardless.
  setTimeout(()=>{if(residenceFrame){cancelAnimationFrame(residenceFrame);residenceFrame=0;draw(1);}},duration+400);
}
// Buttons appended under the residence table; the map call waits for the month rows and the geo table.
function residenceMapButtons(store,month,rowsPromise){
  const box=insightEl('div',null,'residence-map-buttons');
  box.append(insightEl('span','지도로 보기'));
  [['sgg','시군구'],['dong','행정동']].forEach(([kind,label])=>{
    const b=insightEl('button',label);b.type='button';b.dataset.kind=kind;b.setAttribute('aria-pressed',String(residenceState?.store.id===store.id&&residenceState?.month===month&&residenceState?.kind===kind));
    b.onclick=async()=>{
      b.disabled=true;
      try{const [rows,geo]=await Promise.all([rowsPromise,loadResidenceGeo()]);const item=rows[store.id];if(!item)return;showResidenceMap(store,month,kind,item,geo);document.querySelector('.map-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
      catch(error){box.append(insightEl('small','지도 자료를 불러오지 못했습니다.'));}
      finally{b.disabled=false;}
    };
    box.append(b);
  });
  return box;
}
document.addEventListener('walk-route-change',clearResidenceMap);
