'use strict';

// Angles are measured from world +Z. The eye and subject heights are metres
// above the landmark's ground level, independent of the car's nearest road.
const JourneyDepartures=(()=>{
  const places=[
    {id:'turtle',city:'Hà Nội',title:'Hồ Gươm',caption:'Bắt đầu bên hồ, nhìn qua đảo Tháp Rùa rồi nhập vào dòng xe phố cổ.',
      view:{angle:1.82,radius:34,eye:3.3,focus:3.6}},
    {id:'tam-chuc',city:'Tam Chúc',title:'Tam Chúc',caption:'Theo đường ven hồ tới quần thể chùa Tam Chúc.'},
    {id:'ngo-mon',city:'Huế',title:'Ngọ Môn',caption:'Ngắm lầu Ngũ Phụng từ phía trước cổng rồi cầm lái quanh Kinh thành.',
      view:{angle:1.06,radius:68,eye:7.4,focus:6.8}},
    {id:'rong',city:'Kon Tum',title:'Nhà rông Kon Klor',caption:'Từ mái nhà rông của làng Kon Klor, lái xe qua khu dân cư bên sông Đăk Bla.',
      view:{angle:-.72,radius:40,eye:3.6,focus:9.8}},
    {id:'market',city:'TP.HCM',title:'Chợ Bến Thành',caption:'Nhìn lên tháp đồng hồ cửa Nam trước khi nhập vào đường phố trung tâm.',
      view:{angle:.82,radius:49,eye:4.5,focus:9.8,offset:53}},
    {id:'cho-noi-cai-rang',city:'Cần Thơ',title:'Chợ nổi Cái Răng',caption:'Ngắm ghe hàng và những cây bẹo trên sông, rồi khởi hành từ đường ven bờ.',
      view:{angle:.87,radius:33,eye:3.6,focus:1.2}}
  ];
  const byId=id=>places.find(place=>place.id===id);
  const params=new URLSearchParams(location.search);
  let trip;
  try{
    const stored=JSON.parse(localStorage.getItem('taylai.world.trip'));
    if(stored&&[stored.lon,stored.lat,stored.distance].every(Number.isFinite)&&stored.distance>=0)trip=stored;
  }catch{}
  const requested=byId(params.get('intro'));
  const today=Math.floor((Date.now()+7*3600000)/86400000);
  const normalStart=trip?null:places[today%places.length];
  const initial=requested||normalStart;
  const explicit=['pass','landmark','drive','collection'].some(key=>params.has(key));
  const preview=explicit?byId(params.get('landmark')):initial;
  const group=document.getElementById('departureChoices');
  for(const place of places){
    const a=document.createElement('a');
    a.href='?intro='+place.id;a.dataset.departure=place.id;a.textContent=place.city;
    a.setAttribute('aria-label',place.city+' · '+place.title);group.append(a);
  }
  function select(place){
    for(const link of group.children){
      if(link.dataset.departure===place?.id)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
    const still=document.getElementById('openingStill');
    if(place){
      const hour=(new Date().getUTCHours()+7)%24;
      const night=hour<5||hour>=18;
      const base=place.id==='tam-chuc'?'tam-chuc-opening':'departure-views/'+place.id+(night?'-night':'');
      still.style.setProperty('--wide-view','url("'+base+'.webp")');
      still.style.setProperty('--tall-view','url("'+base+'-portrait.webp")');
    }
    still.hidden=!place;
  }
  select(preview);
  document.getElementById('journeyTitle').textContent=preview?.title||(!explicit&&trip?.label)||'Xuyên Việt';
  document.getElementById('journeyCaption').textContent=preview?.caption||'';
  return {byId,initial,trip,select};
})();
