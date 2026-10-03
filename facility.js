'use strict';
// 주변시설 지도 UI: 중심 거점 기준 반경 500m·1km 원, 카테고리별 핀·라벨, 거리순 목록
const {CATEGORIES,within,circle,parseQuery}=FacilityCore;
const RADII=[500,1000];
const TILE='https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_2jst_1_f20036d2498b9af9e4827f69';
const $=id=>document.getElementById(id);
const active={public:true,education:true,culture:true,transit:true};
let center=null,items=[],markers=[],selectedKey=null,map=null;

async function init(){
  const query=parseQuery(location.search);
  const response=await fetch('facilities.json');
  if(!response.ok)throw new Error('facilities.json 로딩 실패');
  const payload=await response.json();
  const all=payload.items||[];
  center=query.center||meanCenter(all);
  const walkTitle=document.title.includes('해방촌')?'해방촌걸음':'한남걸음';
  $('facility-walk').textContent=`${walkTitle} · 주변시설`;
  $('facility-title').textContent=query.name?`${query.name} 주변 시설`:'걷기 구간 주변 시설';
  $('facility-source').textContent=`시설 자료: 부동산114 RCS, 수집일 ${payload.fetchedAt||'미상'}. 공공·교육·문화·교통 4종, 반경 1km 안만 표시.`;
  items=within(all,center,RADII[1]).map((item,i)=>({...item,key:`f${i}`}));
  buildMap();buildTypes();buildLegend();render();
}
function meanCenter(all){
  if(!all.length)return [127.0002,37.5346];
  const sum=all.reduce((acc,item)=>[acc[0]+item.coordinates[0],acc[1]+item.coordinates[1]],[0,0]);
  return [sum[0]/all.length,sum[1]/all.length];
}
function buildMap(){
  map=new maplibregl.Map({container:'facility-map',style:{version:8,sources:{carto:{type:'raster',tiles:[TILE],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'}},layers:[{id:'carto',type:'raster',source:'carto'}]},center,zoom:14.6,attributionControl:{compact:true}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
  map.on('load',()=>{
    map.addSource('rings',{type:'geojson',data:{type:'FeatureCollection',features:RADII.map(r=>circle(center,r))}});
    map.addLayer({id:'ring-fill',type:'fill',source:'rings',paint:{'fill-color':'#172e49','fill-opacity':0.035}});
    map.addLayer({id:'ring-line',type:'line',source:'rings',paint:{'line-color':'#172e49','line-width':1.4,'line-dasharray':[3,2],'line-opacity':0.7}});
    const centerEl=document.createElement('div');centerEl.className='facility-center';centerEl.title='기준 지점';
    new maplibregl.Marker({element:centerEl}).setLngLat(center).addTo(map);
    markers=items.map(item=>{
      const el=document.createElement('button');el.type='button';el.className='facility-pin';el.dataset.category=item.category;el.textContent=CATEGORIES[item.category].icon;el.title=item.name;el.setAttribute('aria-label',`${item.name} ${Math.round(item.distance)}m`);
      el.onclick=()=>select(item.key,true);
      return {item,el,marker:new maplibregl.Marker({element:el}).setLngLat(item.coordinates).addTo(map)};
    });
    map.resize();fitToRing();layoutLabels();
  });
  map.on('move',layoutLabels);map.on('resize',layoutLabels);
  let resizeTimer=null;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{map.resize();fitToRing();},200);});
}
function fitToRing(){
  const ring=circle(center,RADII[1]).geometry.coordinates[0];
  const bounds=ring.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(ring[0],ring[0]));
  const narrow=window.innerWidth<=760;
  map.fitBounds(bounds,{padding:narrow?{top:30,bottom:30,left:20,right:20}:{top:40,bottom:60,left:40,right:40},duration:0});
}
function buildTypes(){
  const box=$('facility-types');box.replaceChildren();
  Object.entries(CATEGORIES).forEach(([key,meta])=>{
    const button=document.createElement('button');button.type='button';button.dataset.category=key;button.setAttribute('aria-pressed','true');
    const count=items.filter(item=>item.category===key).length;
    button.innerHTML=`<span>${meta.label}</span><b>${count}</b>`;
    button.onclick=()=>{active[key]=!active[key];button.setAttribute('aria-pressed',String(active[key]));if(selectedKey&&items.find(i=>i.key===selectedKey)?.category===key&&!active[key])selectedKey=null;render();};
    box.append(button);
  });
}
function buildLegend(){
  const legend=$('facility-legend');legend.replaceChildren();
  Object.entries(CATEGORIES).forEach(([key,meta])=>{const span=document.createElement('span');span.dataset.category=key;span.innerHTML=`<i></i>${meta.label}`;legend.append(span);});
  const ring=document.createElement('span');ring.textContent='점선 원: 500m · 1km';legend.append(ring);
}
function visible(){return items.filter(item=>active[item.category]);}
function render(){
  const shown=visible();
  const inner=shown.filter(i=>i.distance<=RADII[0]).length;
  $('facility-summary').textContent=shown.length?`반경 1km 안 ${shown.length}곳 (500m 안 ${inner}곳)`:'선택한 유형의 시설이 반경 1km 안에 없습니다.';
  const list=$('facility-list');list.replaceChildren();
  if(!shown.length){const p=document.createElement('p');p.className='facility-empty';p.textContent='유형 버튼을 다시 켜 보세요.';list.append(p);}
  let group=null;
  shown.forEach(item=>{
    const label=item.distance<=RADII[0]?'500m 안':'500m ~ 1km';
    if(label!==group){group=label;const h=document.createElement('p');h.className='facility-group';h.textContent=label;list.append(h);}
    const row=document.createElement('button');row.type='button';row.className='facility-item';row.dataset.category=item.category;row.dataset.key=item.key;row.classList.toggle('selected',item.key===selectedKey);
    const pin=document.createElement('span');pin.className='facility-pin';pin.textContent=CATEGORIES[item.category].icon;
    const text=document.createElement('span');const name=document.createElement('strong');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=[item.subtype,item.note].filter(Boolean).join(' · ')||item.kind;text.append(name,meta);
    const dist=document.createElement('span');dist.className='dist';dist.textContent=`${Math.round(item.distance)}m`;
    row.append(pin,text,dist);row.onclick=()=>select(item.key,false);
    list.append(row);
  });
  markers.forEach(({item,el})=>{el.hidden=!active[item.category];el.classList.toggle('selected',item.key===selectedKey);});
  layoutLabels();
}
function select(key,fromMap){
  selectedKey=selectedKey===key?null:key;
  const item=items.find(i=>i.key===selectedKey);
  render();
  if(!item)return;
  if(fromMap){$('facility-list').querySelector(`[data-key="${key}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});}
  else map.easeTo({center:item.coordinates,duration:500});
}
function layoutLabels(){
  if(!map||!markers.length)return;
  const svg=$('facility-labels');const {width,height}=svg.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const candidates=markers.filter(({item})=>active[item.category]).map(({item})=>{
    const p=map.project(item.coordinates);
    return {item,px:p.x,py:p.y,w:item.name.length*12+8,h:16,priority:item.key===selectedKey?0:1};
  }).sort((a,b)=>a.priority-b.priority||a.item.distance-b.item.distance);
  const obstacles=candidates.map(c=>({x:c.px-14,y:c.py-14,w:28,h:28}));
  const placed=WalkLayout.placeLabels(candidates,width,height,obstacles);
  svg.replaceChildren();
  RADII.forEach(r=>{
    const top=map.project([center[0],center[1]+r/111200]);
    const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('class','ring-label');t.setAttribute('x',top.x+4);t.setAttribute('y',top.y-4);t.textContent=r===1000?'1km':`${r}m`;svg.append(t);
  });
  placed.forEach(p=>{const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+12);t.textContent=p.item.name;svg.append(t);});
}
init().catch(error=>{console.error(error);$('facility-summary').textContent=`실행 오류: ${error.message}. 실행.cmd로 서버를 시작해 주세요.`;});
