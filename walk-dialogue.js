(function(root){
  const pools={
    '문화':['전시를 볼 때는 마음에 드는 작품 앞에서 조금 더 머물러도 좋아요.','관람 전 예약 여부를 확인해 두면 한결 여유롭겠어요.','문화 공간에서는 걷는 속도를 조금 늦춰보고 싶어요.'],
    '식사':['다음 식사 자리에서는 충분히 쉬어가고 싶어요.','먹고 싶은 메뉴와 예산을 미리 생각해 볼까요?','음식 알레르기나 못 먹는 재료는 주문 전에 확인해 주세요.'],
    '간식':['음료 한 잔과 함께 발을 쉬게 해주면 좋겠어요.','달콤한 간식이 당기네요. 메뉴는 도착해서 살펴봐요.','카페에 자리가 없다면 다른 대안 코스도 살펴볼 수 있어요.'],
    '쇼핑':['마음에 드는 물건이 없어도 구경하는 재미가 있겠죠.','가게마다 어떤 분위기가 다른지 천천히 보고 싶어요.','짐이 늘어나면 남은 이동 거리를 확인해 주세요.'],
    '복합공간':['여러 공간을 둘러본 뒤 마음에 드는 곳에 머물러봐요.','서두르지 않고 골목에서 잠시 여유를 가져보고 싶어요.'],
    '교통':['돌아가는 길의 열차 시간은 따로 확인해 주세요.','오늘 마음에 들었던 장소를 하나 골라볼까요?']
  };
  function create(){
    let spoken=new Set(),lastAt=-Infinity,legCounts=new Map();
    return {
      reset(){spoken=new Set();lastAt=-Infinity;legCounts=new Map();},
      accept(text,now,force=false){if(spoken.has(text)||(!force&&now-lastAt<8000))return false;spoken.add(text);lastAt=now;return true;},
      next(stop,leg,now){
        if(now-lastAt<8000||(legCounts.get(leg)||0)>=2)return null;
        const count=legCounts.get(leg)||0;
        const introductions=[`${stop.name}, 다음에 둘러볼 곳이에요.`,`${stop.name}까지 가는 동안 주변도 천천히 살펴봐요.`,`이번 목적지는 ${stop.name}이에요.`,`조금 뒤에는 ${stop.name}에서 시간을 보낼 거예요.`,`${stop.name} 방문을 앞두고 있어요.`,`이 길은 ${stop.name} 쪽으로 이어져요.`];
        const candidates=count===0?[introductions[leg%introductions.length],...(pools[stop.kind]||[])]:pools[stop.kind]||['피곤하면 재생을 멈추고 다음 장소를 미리 살펴봐도 좋아요.'];
        const text=candidates.find(t=>!spoken.has(t));
        if(!text)return null;
        legCounts.set(leg,count+1);
        return text;
      }
    };
  }
  root.WalkDialogue={create};if(typeof module!=='undefined')module.exports=root.WalkDialogue;
})(globalThis);
