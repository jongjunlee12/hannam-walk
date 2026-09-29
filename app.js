'use strict';
const $ = id => document.getElementById(id);
const fmt = n => n == null ? '자료 없음' : Number(n).toLocaleString('ko-KR', {maximumFractionDigits: 0});
const monthLabel = s => `${s.slice(0,4)}.${s.slice(4)}`;
const meters = (a,b) => Math.hypot((a[0]-b[0])*88200,(a[1]-b[1])*111200);
const collection = features => ({type:'FeatureCollection',features});
const line = coordinates => ({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});
let data, map, marker, route, cumulative=[], walked=0, playing=false, lastTime=null, lastSpeech='', selectedId=null, filtered=[], loaded=false, lastFollow=0;
const dialogue=WalkDialogue.create();
const walker = document.createElement('div');
walker.className='walker'; walker.setAttribute('aria-label','산책하는 시연 아바타');
walker.innerHTML=`<div class="speech-bubble" id="bubble"><small>아바타의 시연 대사</small><span id="bubble-text"></span><span class="bubble-leg" id="bubble-leg" hidden></span></div><svg viewBox="0 0 64 92" aria-hidden="true"><ellipse class="walker-shadow" cx="32" cy="87" rx="21" ry="5"/><g class="body"><g class="leg-a limb"><path d="M27 55 L23 71 L18 82" stroke="#283c50" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M18 82h-7" stroke="#14232f" stroke-width="7" stroke-linecap="round"/></g><g class="leg-b limb"><path d="M37 55 L39 71 L43 82" stroke="#3e5366" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M43 82h7" stroke="#14232f" stroke-width="7" stroke-linecap="round"/></g><g class="arm-b limb"><path d="M39 35 L48 46 L45 57" fill="none" stroke="#e9ac82" stroke-width="7" stroke-linecap="round"/></g><rect x="19" y="28" width="27" height="32" rx="11" fill="#0064e0"/><rect x="15" y="32" width="10" height="22" rx="4" fill="#a7c6e1"/><path d="M32 22v10" stroke="#e9ac82" stroke-width="9"/><circle cx="33" cy="17" r="12" fill="#f2bd96"/><path d="M21 17Q18 2 33 3Q46 2 46 14Q34 8 21 17" fill="#263643"/><circle cx="38" cy="18" r="1.4" fill="#24333e"/><path d="M37 24q4 2 6-1" stroke="#a3634d" stroke-width="1.5" fill="none"/><g class="arm-a limb"><path d="M25 36 L20 48 L27 57" fill="none" stroke="#f2bd96" stroke-width="7" stroke-linecap="round"/></g></g></svg>`;

// Distance and walking time to the next stop (1 m/s flat-ground assumption, same as the route total).
function legInfo(fromMeters, stopIndex) {
  if (!route || stopIndex < 1 || stopIndex >= route.stops.length) return null;
  const remaining = Math.max(0, route.stops[stopIndex].at - fromMeters);
  return {stop: route.stops[stopIndex], meters: Math.round(remaining / 10) * 10, minutes: Math.max(1, Math.ceil(remaining / 60))};
}
function legText(info) { return info ? `${info.stop.name}까지 약 ${fmt(info.meters)}m · 도보 약 ${info.minutes}분` : ''; }
function speak(key, text) {
  if (key===lastSpeech) return;
  if(!dialogue.accept(text,performance.now(),!key.startsWith('walk-')))return;
  lastSpeech=key; $('bubble-text').textContent=text;
}
function setPlaying(value) {
  playing=value; lastTime=null;
  $('play').textContent=value?'Ⅱ 일시정지':walked>=route.distance?'↻ 다시 걷기':walked>0?'▶ 이어 걷기':'▶ 산책 시작';
  $('play').setAttribute('aria-pressed',String(value));
  walker.classList.toggle('walking',value && $('motion').checked);
  if (!value && walked>0 && walked<route.distance) speak('pause','잠깐 쉬어갈까요? 여기서 풍경을 둘러봐요.');
}
function fitRoute() {
  const bounds = new maplibregl.LngLatBounds(); data.routes.filter(r=>r.theme===route.theme).forEach(r=>r.coordinates.forEach(p=>bounds.extend(p)));
  const phone=matchMedia('(max-width:760px)').matches;
  map.fitBounds(bounds,{padding:phone?{top:125,bottom:120,left:40,right:40}:{top:160,bottom:275,left:70,right:70},duration:900,maxZoom:17});
}
function selectRoute() {
  route=data.routes[Number($('route').value)]; walked=0; lastSpeech='';
  dialogue.reset();
  setPlaying(false); cumulative=[0];
  for(let i=1;i<route.coordinates.length;i++) cumulative.push(cumulative[i-1]+meters(route.coordinates[i-1],route.coordinates[i]));
  route.distance=cumulative.at(-1);
  $('route-description').textContent=route.description+(route.suggestedStay?` · 관람·식사·휴식 ${route.suggestedStay}분 포함(시연 가정). 영업·휴무 확인 필요.`:'');
  $('distance').textContent=`${(route.distance/1000).toFixed(2)} km`;
  $('duration').textContent=`약 ${Math.ceil(route.distance/60)}분`;
  $('stops').replaceChildren(...route.stops.map(stop=>{const li=document.createElement('li'); li.textContent=stop.name+(stop.kind==='산책'?'':` · ${stop.kind}`); if(stop.storeId){const b=document.createElement('button');b.className='stop-insight';b.textContent='매장 보기 ↗';b.onclick=()=>{selectStore(stop.storeId,true);$('detail').scrollIntoView({behavior:'smooth',block:'center'});};li.append(b);} return li;}));
  renderAlternatives();
  if(loaded) {
    map.getSource('route').setData(line(route.coordinates));
    window.poiMarkers?.forEach(m=>m.remove());
    window.poiMarkers=route.stops.map((stop,i)=>{const el=document.createElement('button');el.className='poi-marker';el.textContent=i+1;el.title=stop.name;el.setAttribute('aria-label',`${i+1}번 ${stop.name} 안내`);el.onclick=()=>{setPlaying(false);showArrival(stop,i,false);};return new maplibregl.Marker({element:el}).setLngLat(stop.coordinates).addTo(map);});
    fitRoute();
  }
  renderPosition();
  document.dispatchEvent(new CustomEvent('walk-route-change'));
}
function renderPosition() {
  if(!route || !marker) return;
  let i=1; while(i<cumulative.length-1 && cumulative[i]<walked) i++;
  const start=route.coordinates[i-1], end=route.coordinates[i];
  const fraction=Math.max(0,Math.min(1,(walked-cumulative[i-1])/(cumulative[i]-cumulative[i-1]||1)));
  const point=[start[0]+(end[0]-start[0])*fraction,start[1]+(end[1]-start[1])*fraction];
  marker.setLngLat(point); walker.classList.toggle('facing-left',map.project(end).x<map.project(start).x);
  const pct=walked/route.distance;
  $('progress').value=Math.round(pct*1000); $('percent').textContent=`${Math.round(pct*100)}%`;
  let next=route.stops.findIndex(s=>s.at>walked+2); if(next<0) next=route.stops.length-1;
  [...$('stops').children].forEach((el,j)=>el.classList.toggle('active',j===next));
  $('progress-label').textContent=walked>=route.distance?'산책을 마쳤어요':`${route.stops[next].name} 방향 · ${fmt(walked)}m 이동`;
  const leg=walked>=route.distance?null:legInfo(walked,next);
  $('bubble-leg').hidden=false;
  $('bubble-leg').textContent=leg?`다음 장소 → ${leg.stop.name}\n남은 거리 약 ${fmt(leg.meters)}m · 도보 약 ${leg.minutes}분\n분당 60m 기준 · 경사·신호 대기 제외`:'마지막 장소에 도착했어요 · 남은 이동 없음';
  const nearStop=route.stops.findIndex((s,j)=>j>0 && Math.abs(walked-s.at)<22);
  if(walked>=route.distance) {const final=route.stops.at(-1);speak('finish',final.kind==='간식'?`${final.name} 주변에 도착했어요. 간식 먹으며 쉬어갈까요? 영업 여부를 확인해 주세요.`:final.kind==='식사'?`${final.name} 주변에 도착했어요. 이제 식사할까요? 영업 여부를 확인해 주세요.`:`${final.name}에 도착했어요! 오늘의 산책, 즐거웠어요.`);}
  else if(walked<8) speak('start',`${route.stops[1].name} 쪽으로 가볼까요? 천천히 출발해요.`);
  else if(nearStop>0) {const stop=route.stops[nearStop];speak(`arrive-${nearStop}`,stop.kind==='식사'?`${stop.name} 주변이에요. 밥 먹고 쉬어갈까요? 영업 중인지 확인해 주세요.`:stop.kind==='간식'?`${stop.name} 주변이에요. 간식 먹으며 잠깐 쉬고 싶어요!`: `${stop.name}에 왔어요. 잠시 둘러보고 싶어요!`);}
  else if(playing || lastSpeech!=='pause') {
    const text=dialogue.next(route.stops[next],next,performance.now());
    if(text)speak(`walk-${next}-${text}`,text);
  }
  if(loaded) map.getSource('travelled').setData(line([...route.coordinates.slice(0,i),point]));
  if($('follow').checked && playing && performance.now()-lastFollow>200) {map.easeTo({center:point,duration:220});lastFollow=performance.now();}
  scheduleLabels();
}
function animate(time) {
  if(playing && lastTime!=null) {
    const target=Math.min(route.distance,walked+Math.min((time-lastTime)/1000,.1)*Number($('speed').value));
    const arrived=route.stops.findIndex((s,i)=>i>0 && s.at>walked+.01 && s.at<=target+.01);
    walked=arrived>=0?Math.min(route.distance,route.stops[arrived].at):target;
    renderPosition();
    if(arrived>=0){setPlaying(false);showArrival(route.stops[arrived],arrived,true);}
    else if(walked>=route.distance) setPlaying(false);
  }
  lastTime=time; requestAnimationFrame(animate);
}
function updateStores() {
  const month=$('month').value, query=$('search').value.trim().toLocaleLowerCase();
  filtered=data.stores.filter(s=>s.months[month] && `${s.name} ${s.category}`.toLocaleLowerCase().includes(query));
  filtered.sort((a,b)=>(b.months[month][0]??-1)-(a.months[month][0]??-1));
  $('store-count').textContent=`${fmt(filtered.length)}곳`;
  const list=$('store-list');list.replaceChildren();
  filtered.slice(0,100).forEach(store=>{
    const button=document.createElement('button');button.className='store-row';button.classList.toggle('selected',store.id===selectedId);
    const name=document.createElement('span');name.textContent=store.name;
    const cat=document.createElement('small');cat.textContent=store.category;name.append(cat);
    const amount=document.createElement('span');amount.className='amount';amount.textContent=`${fmt(store.months[month][0])}${store.months[month][0]==null?'':' 만원'}`;
    button.append(name,amount);button.onclick=()=>selectStore(store.id,true);list.append(button);
  });
  if(!filtered.length) list.textContent='이 조건에 해당하는 관측 매장이 없습니다.';
  if(filtered.length>100) {const note=document.createElement('p');note.className='muted';note.textContent='목록은 매출 상위 100곳입니다. 지도에는 검색된 매장을 모두 표시합니다.';list.append(note);}
  if(loaded) map.getSource('stores').setData(collection(filtered.map(s=>({type:'Feature',geometry:{type:'Point',coordinates:s.coordinates},properties:{id:s.id,name:s.name}}))));
  if(selectedId) selectStore(selectedId,false);
}
function selectStore(id,fly) {
  const store=data.stores.find(s=>s.id===id); if(!store) return; selectedId=id;
  const month=$('month').value, values=store.months[month];
  const detail=$('detail');detail.replaceChildren();
  const eye=document.createElement('div');eye.className='eyebrow';eye.textContent=`STORE INSIGHT · ${monthLabel(month)}`;
  const title=document.createElement('h3');title.textContent=store.name;
  const category=document.createElement('p');category.className='muted';category.textContent=store.category;
  const metrics=document.createElement('div');metrics.className='metric-row';
  [['매출액 · 만원',values?.[0]],['외국인매출 · 원자료 값',values?.[1]]].forEach(([label,n])=>{const box=document.createElement('div'),strong=document.createElement('strong'),caption=document.createElement('span');strong.textContent=fmt(n);caption.textContent=label;box.append(strong,caption);metrics.append(box);});
  const endIndex=data.months.indexOf(month), months=data.months.slice(Math.max(0,endIndex-11),endIndex+1), nums=months.map(m=>store.months[m]?.[0]??null), max=Math.max(1,...nums.filter(n=>n!=null));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 130');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label',months.map((m,i)=>`${monthLabel(m)} ${fmt(nums[i])} 만원`).join(', '));
  nums.forEach((n,i)=>{if(n==null)return;const rect=document.createElementNS(svg.namespaceURI,'rect');rect.setAttribute('x',String(i*600/months.length+4));rect.setAttribute('y',String(125-n/max*110));rect.setAttribute('width',String(600/months.length-10));rect.setAttribute('height',String(Math.max(2,n/max*110)));rect.setAttribute('rx','4');rect.setAttribute('fill',i===months.length-1?'#0064e0':'#bdcbd6');const t=document.createElementNS(svg.namespaceURI,'title');t.textContent=`${monthLabel(months[i])} · ${fmt(n)}만원`;rect.append(t);svg.append(rect);});
  const caption=document.createElement('div');caption.className='chart-caption';caption.innerHTML='<span></span><span></span>';caption.children[0].textContent=monthLabel(months[0]);caption.children[1].textContent=`${monthLabel(months.at(-1))} · 결측은 빈칸`;
  detail.append(eye,title,category);
  renderVisitorDetails(store,detail,[metrics,svg,caption],month);
  if(fly) {map.flyTo({center:store.coordinates,zoom:17,pitch:$('view').getAttribute('aria-pressed')==='true'?52:0});document.querySelectorAll('.store-row').forEach(b=>b.classList.toggle('selected',b.firstChild.firstChild?.textContent===store.name));if(document.body.classList.contains('map-focused'))setMapFocus(false);hideArrival();requestAnimationFrame(()=>detail.scrollIntoView({behavior:'smooth',block:'start'}));}
}
async function start() {
  const response=await fetch('data.json');if(!response.ok)throw new Error('data.json 로딩 실패'); data=await response.json();
  try{const reviewsResponse=await fetch('restaurant-reviews.json');if(reviewsResponse.ok)restaurantReviews=await reviewsResponse.json();}catch(error){console.warn('후기 요약을 불러오지 못했습니다. 원문 검색 링크를 제공합니다.');}
  // Researched place descriptions live in a sidecar so regenerating data.json does not erase them.
  try {
    const infoResponse=await fetch('place-info.json');
    if(infoResponse.ok){const infoById=new Map((await infoResponse.json()).map(p=>[String(p.id),p]));data.landmarks.forEach(poi=>{poi.info=infoById.get(String(poi.id))||null;});data.routes.forEach(r=>r.stops.forEach(stop=>{stop.info=infoById.get(String(stop.id))||null;}));}
  } catch (error) { console.error('place-info.json 로딩 실패:', error); }
  data.routes.forEach((r,i)=>$('route').add(new Option(r.name,i)));$('route').disabled=false;
  const sharedRoute=new URLSearchParams(location.search).get('route');
  if(sharedRoute!==null&&/^\d+$/.test(sharedRoute)&&Number(sharedRoute)<data.routes.length)$('route').value=String(Number(sharedRoute));
  [...data.months].reverse().forEach(m=>$('month').add(new Option(monthLabel(m),m)));
  map=new maplibregl.Map({container:'map',style:{version:8,sources:{carto:{type:'raster',tiles:['https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_2jst_1_f20036d2498b9af9e4827f69'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'}},layers:[{id:'background',type:'raster',source:'carto'}]},center:[127.003,37.536],zoom:15.8,pitch:52,bearing:-18,antialias:true});
  map.addControl(new maplibregl.NavigationControl(),'top-right');
  marker=new maplibregl.Marker({element:walker,anchor:'bottom'}).setLngLat(data.routes[0].coordinates[0]).addTo(map);
  map.on('error',()=>{$('map-status').textContent='일부 지도 자료를 불러오지 못했습니다. 인터넷 연결과 지도 접근 권한을 확인해 주세요.';});
  map.on('load',()=>{
    map.addSource('buildings',{type:'geojson',data:'buildings.geojson'});
    map.addLayer({id:'buildings',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-color':['coalesce',['get','useColor'],'#dce1e5'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':.86}});
    [0,1].forEach(i=>{map.addSource(`alternative-${i}`,{type:'geojson',data:collection([])});map.addLayer({id:`alternative-${i}`,type:'line',source:`alternative-${i}`,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':i?'#936633':'#687a8d','line-width':4,'line-dasharray':i?[1,2]:[3,2],'line-offset':i?-7:7,'line-opacity':.9}});});
    map.addSource('route',{type:'geojson',data:line(data.routes[0].coordinates)});
    map.addLayer({id:'route-halo',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':10}});
    map.addLayer({id:'route-line',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#0064e0','line-width':5}});
    map.addSource('travelled',{type:'geojson',data:collection([])});
    map.addLayer({id:'travelled',type:'line',source:'travelled',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#172e49','line-width':5}});
    map.addSource('stores',{type:'geojson',data:collection([])});
    map.addLayer({id:'stores',type:'circle',source:'stores',paint:{'circle-radius':['interpolate',['linear'],['zoom'],13,2,17,6],'circle-color':'#0064e0','circle-opacity':.7,'circle-stroke-color':'white','circle-stroke-width':1.5}});
    map.on('click','stores',e=>selectStore(e.features[0].properties.id,true));
    map.on('mouseenter','stores',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','stores',()=>map.getCanvas().style.cursor='');
    loaded=true;$('map-status').textContent='';$('play').disabled=false;setupLandmarks();selectRoute();updateStores();
  });
  selectRoute();updateStores();
  $('data-stats').textContent=`건물 ${fmt(data.meta.buildings)}동 · 층수 미상 ${fmt(data.meta.unknownFloors)}동 · 점포 ${fmt(data.stores.length)}개 ID · OSM 기준 ${data.meta.osmTimestamp || '미확인'} · 동일 점포/월 중복 ${fmt(data.meta.duplicateStoreMonths)}건은 합산하지 않았고, 값이 충돌하는 ${fmt(data.meta.conflictingStoreMonths)}개 점포/월은 제외했습니다. 점포 좌표는 첫 관측 좌표로 이력에 따른 이전 여부는 미검증입니다.`;
  $('route').onchange=selectRoute;$('month').onchange=updateStores;$('search').oninput=updateStores;
  $('play').onclick=()=>{hideArrival();if(walked>=route.distance){walked=0;dialogue.reset();lastSpeech='';}setPlaying(!playing);renderPosition();};
  $('reset').onclick=()=>{walked=0;dialogue.reset();hideArrival();setPlaying(false);lastSpeech='';renderPosition();fitRoute();};
  $('progress').oninput=()=>{hideArrival();walked=Number($('progress').value)/1000*route.distance;lastSpeech='';renderPosition();const near=route.stops.findIndex((s,i)=>i>0&&Math.abs(s.at-walked)<20);if(near>=0){walked=route.stops[near].at;setPlaying(false);renderPosition();showArrival(route.stops[near],near,true);}};
  $('speech').onchange=()=>{$('bubble').hidden=!$('speech').checked;};
  $('motion').checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('motion').onchange=()=>{walker.dataset.motion=$('motion').checked?'on':'off';walker.classList.toggle('walking',playing && $('motion').checked);};
  $('view').onclick=()=>{const active=$('view').getAttribute('aria-pressed')!=='true';$('view').setAttribute('aria-pressed',String(active));$('view').textContent=active?'3D 켜짐':'2D 보기';map.easeTo({pitch:active?52:0,bearing:active?-18:0});map.setLayoutProperty('buildings','visibility',active?'visible':'none');};
  $('fit').onclick=fitRoute;
  requestAnimationFrame(animate);
}
$('info').onclick=()=>$('data-dialog').showModal();$('close-info').onclick=()=>$('data-dialog').close();
document.addEventListener('DOMContentLoaded',()=>start().catch(error=>{$('map-status').textContent=`실행 오류: ${error.message}. 실행.cmd로 서버를 시작해 주세요.`;console.error(error);}));
