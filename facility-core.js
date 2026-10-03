// 주변시설 지도의 순수 로직: 반경 거리 계산·정렬·원 폴리곤 (Node 테스트 겸용)
(function(root){
  const CATEGORIES={
    public:{label:'공공시설',color:'#1d5fb4',icon:'공'},
    education:{label:'교육시설',color:'#1f8a4c',icon:'교'},
    culture:{label:'문화시설',color:'#6b3fa8',icon:'문'},
    transit:{label:'교통시설',color:'#d9640b',icon:'역'}
  };
  const meters=(a,b)=>Math.hypot((a[0]-b[0])*88200,(a[1]-b[1])*111200);
  function within(items,center,radius){
    return items
      .filter(item=>CATEGORIES[item.category])
      .map(item=>({...item,distance:meters(center,item.coordinates)}))
      .filter(item=>item.distance<=radius)
      .sort((a,b)=>a.distance-b.distance);
  }
  function circle(center,radius,steps=72){
    const ring=[];
    for(let i=0;i<=steps;i++){const angle=i/steps*Math.PI*2;ring.push([center[0]+Math.cos(angle)*radius/88200,center[1]+Math.sin(angle)*radius/111200]);}
    return {type:'Feature',properties:{radius},geometry:{type:'Polygon',coordinates:[ring]}};
  }
  function parseQuery(search){
    const params=new URLSearchParams(search);
    const lat=Number(params.get('lat')),lng=Number(params.get('lng'));
    const center=Number.isFinite(lat)&&Number.isFinite(lng)&&lat&&lng?[lng,lat]:null;
    return {center,name:(params.get('name')||'').slice(0,60)};
  }
  root.FacilityCore={CATEGORIES,meters,within,circle,parseQuery};
  if(typeof module!=='undefined')module.exports=root.FacilityCore;
})(globalThis);
