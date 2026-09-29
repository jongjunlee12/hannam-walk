'use strict';
let restaurantReviews={};
const analyticsCache=new Map();
const insightEl=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
function insightLink(text,url){const a=insightEl('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function reviewSection(id,name){
  const section=insightEl('section',null,'visitor-review');
  section.append(insightEl('h4','방문 후기 살펴보기'));
  const review=restaurantReviews[id];
  if(review){section.append(insightEl('p',review.summary),insightEl('small','일부 공개 후기의 편집 요약 · 2026.09.30 확인 · 전체 평판이나 실시간 리뷰가 아닙니다.'),insightLink('확인한 후기 원문 ↗',review.source));}
  else section.append(insightEl('p','이 매장의 후기는 아직 검증·요약하지 않았습니다. 아래에서 같은 상호·지점인지 확인하고 최근 후기를 살펴보세요.'));
  const links=insightEl('div',null,'review-links');
  links.append(insightLink('네이버 후기 검색 ↗',`https://search.naver.com/search.naver?query=${encodeURIComponent('한남동 '+name+' 후기')}`),insightLink('카카오맵에서 찾기 ↗',`https://map.kakao.com/?q=${encodeURIComponent('한남동 '+name)}`));section.append(links);
  return section;
}
function totalKnown(values){return values.length&&values.every(v=>Number.isFinite(v)&&v>=0)?values.reduce((a,b)=>a+b,0):null;}
function distribution(labels,values,title){
  const box=insightEl('section',null,'insight-chart');box.append(insightEl('h4',title));
  const total=totalKnown(values);
  if(total==null||total===0){box.append(insightEl('p',total===0?'합계가 0이라 구성비를 계산하지 않았습니다.':'결측이 있어 구성비를 계산하지 않았습니다.','muted'));}
  labels.forEach((label,i)=>{
    const row=insightEl('div',null,'distribution-row'),value=values[i],percent=total>0?value/total*100:null;
    row.append(insightEl('span',label),insightEl('span',Number.isFinite(value)?`${percent==null?'':percent.toFixed(1)+'% · '}${fmt(value)}`:'자료 없음'));
    const bar=insightEl('div',null,'distribution-track'),fill=insightEl('i');fill.style.width=`${percent||0}%`;bar.append(fill);row.append(bar);box.append(row);
  });return box;
}
function ageRadar(labels,values){
  const box=distribution(labels,values,'연령별 분포 · 남녀 합산');const total=totalKnown(values);
  if(!(total>0))return box;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 340 280');svg.classList.add('age-radar');svg.setAttribute('role','img');svg.setAttribute('aria-label',labels.map((l,i)=>`${l} ${(values[i]/total*100).toFixed(1)}%`).join(', '));
  const point=(i,r)=>{const a=-Math.PI/2+i*Math.PI*2/5;return [170+Math.cos(a)*r,140+Math.sin(a)*r];};
  function polygon(points,fill,stroke){const p=document.createElementNS(ns,'polygon');p.setAttribute('points',points.map(p=>p.join(',')).join(' '));p.setAttribute('fill',fill);p.setAttribute('stroke',stroke);svg.append(p);}
  [.25,.5,.75,1].forEach(scale=>polygon(labels.map((_,i)=>point(i,100*scale)),'none','#d5dee5'));
  polygon(values.map((v,i)=>point(i,100*v/total)),'#0064e055','#0064e0');
  labels.forEach((label,i)=>{const [x,y]=point(i,123),t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','13');t.textContent=label;svg.append(t);});
  box.insertBefore(svg,box.children[1]||null);box.append(insightEl('small','바깥선 100% · 실제 원자료 5구간만 표시합니다. 10대 자료는 없습니다.'));return box;
}
async function loadStoreAnalytics(store,month,target){
  target.textContent='월별 상세 자료를 불러오는 중입니다…';
  try{
    if(!analyticsCache.has(month))analyticsCache.set(month,fetch(`analytics/${month}.json`).then(r=>{if(!r.ok)throw Error('fetch');return r.json();}).catch(error=>{analyticsCache.delete(month);throw error;}));
    const dataMonth=await analyticsCache.get(month),row=dataMonth.stores[store.id];
    if(!target.isConnected)return;
    target.replaceChildren();
    if(!row){target.append(insightEl('p','이 매장·월의 상세 자료가 없거나 중복 값 충돌로 제외되었습니다.'));return;}
    const get=field=>row[dataMonth.fields.indexOf(field)]??null;
    const note=insightEl('p','연령·성별·요일·시간대의 단위 및 집계 범위는 미확인입니다. 아래 %는 각 항목의 원자료 합계 대비 구성비이며, 고객 수 비율·매출 비율로 단정할 수 없습니다.','analytics-note');target.append(note);
    const metrics=insightEl('div',null,'metric-row');
    [['거래건수',get('거래건수'),'건'],['배달매출액',get('배달매출액_만원'),'만원'],['배달거래건수',get('배달거래건수'),'건']].forEach(([label,n,unit])=>{const item=insightEl('div');item.append(insightEl('strong',n==null?'자료 없음':`${fmt(n)} ${unit}`),insightEl('span',label));metrics.append(item);});target.append(metrics);
    const ageLabels=['20대','30대','40대','50대','60대이상'];const ages=ageLabels.map(a=>totalKnown([get('남'+a),get('여'+a)]));
    target.append(ageRadar(ageLabels,ages),distribution(['남성','여성'],[get('남성합'),get('여성합')],'성별 분포'));
    const days=[...'월화수목금토일'].map(d=>get('요일_'+d));
    target.append(distribution(['주중 (월–금)','주말 (토·일)'],[totalKnown(days.slice(0,5)),totalKnown(days.slice(5))],'주중·주말 구성비'));
    target.append(insightEl('p','주중은 5개 요일, 주말은 2개 요일의 합계입니다. 일평균이나 실시간 혼잡도가 아닙니다.','muted'));
    target.append(distribution([...'월화수목금토일'],days,'요일별 분포'));
    const times=['아침05-11','점심11-15','오후15-18','저녁18-20','밤20-22','심야22-01','새벽01-05'];target.append(distribution(times,times.map(t=>get('시간_'+t)),'시간대별 분포'));
  }catch(error){if(target.isConnected){target.replaceChildren(insightEl('p','상세 자료를 불러오지 못했습니다.'));const retry=insightEl('button','다시 시도');retry.onclick=()=>loadStoreAnalytics(store,month,target);target.append(retry);}}
}
function renderVisitorDetails(store,detail,existingCharts,month){
  const poi=data.landmarks.find(p=>p.storeId===store.id),food=store.businessType==='음식'||['식사','간식'].includes(poi?.kind);
  if(food){
    detail.querySelector('.eyebrow').textContent='VISIT & REVIEWS · 방문 정보';
    if(poi?.info){detail.append(insightEl('p',poi.info.summary));if(poi.info.source)detail.append(insightLink('장소 소개 출처 ↗',poi.info.source));}
    detail.append(reviewSection(store.id,store.name));
  }
  const stats=insightEl('details',null,'store-analytics');stats.open=!food;
  stats.append(insightEl('summary',`매출·방문 패턴 자세히 보기 · ${monthLabel(month)}`),...existingCharts);
  const changes=insightEl('div',null,'metric-row'),at=data.months.indexOf(month),current=store.months[month]?.[0];
  [['전월 대비',data.months[at-1]],['전년 동월 대비',String(Number(month.slice(0,4))-1)+month.slice(4)]].forEach(([label,m])=>{
    const previous=store.months[m]?.[0],valid=Number.isFinite(current)&&Number.isFinite(previous)&&previous>0;
    const item=insightEl('div');item.append(insightEl('strong',valid?`${((current-previous)/previous*100).toFixed(1)}%`:'비교 자료 없음'),insightEl('span',label));changes.append(item);
  });stats.append(changes);
  const extra=insightEl('div');stats.append(extra);detail.append(stats);let requested=false;
  const load=()=>{if(stats.open&&!requested){requested=true;loadStoreAnalytics(store,month,extra);}};stats.addEventListener('toggle',load);load();
}
