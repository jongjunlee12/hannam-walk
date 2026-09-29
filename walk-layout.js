/* Deterministic collision layout, also tested with Node. */
(function(root){
  const overlaps=(a,b)=>a.x<b.x+b.w+6&&a.x+a.w+6>b.x&&a.y<b.y+b.h+6&&a.y+a.h+6>b.y;
  function placeLabels(items,width,height,obstacles=[]){
    const used=[...obstacles],placed=[];
    for(const item of items){
      if(item.px<0||item.py<0||item.px>width||item.py>height)continue;
      let box=null;
      for(const radius of [18,48,84,130,185,245]){
        for(const [dx,dy] of [[1,-1],[-1,-1],[1,1],[-1,1],[0,-1],[0,1],[1,0],[-1,0]]){
          const x=item.px+dx*radius-(dx<0?item.w:dx===0?item.w/2:0);
          const y=item.py+dy*radius-(dy<0?item.h:dy===0?item.h/2:0);
          const candidate={x,y,w:item.w,h:item.h};
          if(x<8||y<8||x+item.w>width-8||y+item.h>height-8)continue;
          if(used.some(other=>overlaps(candidate,other)))continue;
          box=candidate;break;
        }
        if(box)break;
      }
      if(box){used.push(box);placed.push({...item,...box});}
    }
    return placed;
  }
  root.WalkLayout={placeLabels,overlaps};
  if(typeof module!=='undefined')module.exports=root.WalkLayout;
})(globalThis);
