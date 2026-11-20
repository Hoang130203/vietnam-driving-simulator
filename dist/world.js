'use strict';
const $=id=>document.getElementById(id),clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const keySet=createDriveInput(),held=(...names)=>names.some(n=>keySet.has(n));
const featured=[['Hà Nội',105.8521,21.0277],['TP. Hồ Chí Minh',106.6994,10.7743],['Đà Nẵng',108.2204,16.0677],['Hải Phòng',106.6821,20.8587],['Huế',107.5887,16.4645],['Đà Lạt',108.4373,11.9418],['Cần Thơ',105.7831,10.0324],['Cà Mau',105.1507,9.1769],['Hà Giang',104.9844,22.8234],['Phú Quốc',103.959,10.2135]];
const nameOf=e=>e.name||({motorway:'Đường cao tốc',trunk:'Đường trục chính',primary:'Đường chính',secondary:'Đường liên huyện',tertiary:'Đường địa phương',residential:'Đường dân cư',service:'Đường dịch vụ'}[e.kind]||'Đường địa phương');
const fmt=d=>(d/1000).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
let gfx,atlasData,indexData,roads,waterIndex,water,player,nearby=[],npcs=[],nextNpc=1,mode='loading',inside=false,source=featured[0],saved;
let viewX=Infinity,viewZ=Infinity,loadX=Infinity,loadZ=Infinity,busy=false,loadToken=0,streamRetry=0,tourPins=[];
let hp=100,nitro=100,cooldown=0,distance=0,snapshot=0,toastTime=0,crashTime=0,crashKind='car',passes=0,duel=null;
let car={model:'supercar',x:0,z:0,yaw:0,speed:0,steer:0,brake:false},last=performance.now(),uiTick=0,spawnTick=0;
let activeTrip=false,loadRequest=null,openingCameraTime=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
try{saved=JSON.parse(localStorage.getItem('taylai.world.trip'));const model=localStorage.getItem('taylai.garage');if(['gt','rally'].includes(model))car.model=model;}catch{}
$('garage').value=car.model;
$('garage').onchange=()=>{car.model=$('garage').value;try{localStorage.setItem('taylai.garage',car.model);}catch{}};
function inform(text,time=3){$('callout').textContent=text;toastTime=time;}
function stance(){return Math.min(2.05,worldRoadHalfWidth(player.edge)*.47);}
function save(){
 if(!activeTrip||!player||!roads||car.flood)return;
 const [lon,lat]=roads.geo(car.x,car.z);
 try{localStorage.setItem('taylai.world.trip',JSON.stringify({lon,lat,label:source[0],destination:source[3]?.id,distance,passes,dir:player.dir,edge:player.edge.id,yaw:car.yaw,origin:[roads.lon,roads.lat]}));}catch{}
}
function parkOnRoad(){
 const p=roads.sample(player,stance());car.flood=null;car.wading=null;DriveBody.reset(car);Object.assign(car,p);cooldown=1;
}
function trackRoad(){
 const around=roads.nearby(car.x,car.z,22);
 const nearest=roads.nearest(car.x,car.z,around);
 if(!nearest){car.offroad=true;player.error=Infinity;return;}
 const bearing=roads.sample(nearest).yaw;
 nearest.dir=Math.cos(car.yaw-bearing)>=0?1:-1;player=nearest;
 car.offroad=nearest.error>worldRoadHalfWidth(nearest.edge)**2;
}
function refreshView(){
 const [lon,lat]=roads.geo(car.x,car.z);
 tourPins=catalog.filter(s=>Math.abs(s.lon-lon)<.018&&Math.abs(s.lat-lat)<.018).map(data=>({...roads.point(data.lon,data.lat),data}));
 nearby=roads.nearby(car.x,car.z,560);
 const waterways=water?.nearby(car.x,car.z)||[];
 for(const coast of window.VietnamSightCoasts||[]){
   if(Math.abs(lon-coast.lon)>.02||Math.abs(lat-coast.lat)>.02)continue;
   const project=ring=>ring.map(([x,y])=>roads.point(x,y));
   waterways.push({kind:'lake',points:project(coast.ring),holes:coast.holes.map(project)});
 }
 gfx.setRoads(nearby,car.x,car.z,waterways,roads);viewX=car.x;viewZ=car.z;
}
function fetchWaterIndex(){
 return waterIndex??=fetchJSON('vn-water/index.json').catch(e=>{waterIndex=null;throw e;});
}
async function streamWater(graph,redraw=true){
 try{
   const index=await fetchWaterIndex();if(roads!==graph)return;
   if(!water||water.roads!==graph)water=new VietnamWater(index,graph);
   if(await water.load(car.x,car.z)&&roads===graph&&redraw&&mode!=='tour')refreshView();
 }catch{/* Road navigation stays available when this scenery layer is offline. */}
}
async function startAt(place,restore=null){
 loadRequest={place,restore};activeTrip=false;
 const firstDrive=place===openingPlace&&!restore;
 car.opening=firstDrive;car.openingPose=firstDrive?1:0;car.dawn=firstDrive?1:0;openingCameraTime=0;
 document.body.removeAttribute('data-awaiting-motion');
 document.body.toggleAttribute('data-lakeside',firstDrive);
 if(!firstDrive)$('openingStill').hidden=true;
 gfx.preloadVehicle(car.model);
 const site=place[3]||destinations.find(entry=>restore?.destination===entry.id);
 $('journeyTitle').textContent=firstDrive?'Tam Chúc':site?.name||place[0];
 $('journeyTitle').classList.toggle('longTitle',$('journeyTitle').textContent.length>25);
 $('journeyCaption').textContent=restore?'Tiếp tục hành trình đã lưu · '+fmt(restore.distance):
   firstDrive||site?.id==='tam-chuc'?'Theo đường ven hồ tới quần thể chùa Tam Chúc.':
   site?.km?'Chinh phục '+fmt(site.km*1000)+' đường đèo.':[site?.kind,site?.city].filter(Boolean).join(' · ')||'Khám phá những con đường quanh điểm xuất phát.';
 $('departureCoords').textContent=place[2].toFixed(4)+'° N  /  '+place[1].toFixed(4)+'° E';
 $('departureMap').getContext('2d').clearRect(0,0,$('departureMap').width,$('departureMap').height);
 const token=++loadToken;mode='loading';keySet.clear();$('grid').hidden=false;$('hud').hidden=true;$('touch').hidden=true;
 $('pause').hidden=true;$('camera').hidden=true;document.body.dataset.phase='grid';
 $('launch').disabled=true;$('challenge').disabled=true;$('launch').textContent='Đang tải đường…';$('loadStatus').textContent='';
 $('placeTitle').textContent=place[0];
 try{
   const origin=Array.isArray(restore?.origin)&&restore.origin.length===2&&restore.origin.every(Number.isFinite)?restore.origin:place.slice(1);
   const graph=new VietnamRoads(indexData,...origin),start=graph.point(place[1],place[2]);await graph.load(start.x,start.z);
   let nearest=graph.nearest(start.x,start.z);
   if(!nearest||nearest.error>4000**2){await graph.load(start.x,start.z,true);nearest=graph.nearest(start.x,start.z);}
   if(token!==loadToken)return;
   if(!nearest||nearest.error>28000**2)throw Error('Chưa có đường ô tô gần điểm này. Hãy chọn điểm khác trên bản đồ.');
   const sight=place[3]||destinations.find(v=>restore?.destination===v.id)||VietnamLandmarks.entries.find(v=>place[0]===v.name+' · '+v.city);
   if(sight)place=[place[0],place[1],place[2],sight];
   car.tourStop=Boolean(sight?.custom||sight&&VietnamLandmarks.entries.includes(sight));
   const bearing=firstDrive?104:sight?.bearing;
   if(Number.isFinite(bearing)&&!restore&&!nearest.edge.oneway){
     nearest.dir=Math.cos(graph.sample(nearest).yaw-bearing*Math.PI/180)>=0?1:-1;
   }else if(sight&&!restore&&!nearest.edge.oneway){
     const target=graph.point(sight.lon,sight.lat),p=graph.sample(nearest);
     if((target.x-p.x)*Math.sin(p.yaw)-(target.z-p.z)*Math.cos(p.yaw)<0)nearest.dir=-1;
   }
   if(restore&&restore.edge===nearest.edge.id&&restore.dir===-1&&!nearest.edge.oneway)nearest.dir=-1;
   nextWeatherCheck=0;roads=graph;water=null;player=nearest;source=place;distance=restore?.distance||0;hp=nitro=100;
   car.region=place[2]<10.8?'delta':place[2]>21.6||(place[1]>107&&place[2]>11&&place[2]<15)?'highlands':'city';
   duel=null;passes=restore?.passes||0;inside=false;busy=false;npcs=[];parkOnRoad();gfx.resetFx();
   if(Number.isFinite(restore?.yaw)){car.x=start.x;car.z=start.z;car.yaw=restore.yaw;trackRoad();}
   loadX=car.x;loadZ=car.z;streamRetry=0;
   await Promise.all([gfx.terrainReady,streamWater(graph,false),gfx.loadDistrict(graph,car.x,car.z)]);if(token!==loadToken)return;
   refreshView();drawDepartureMap();seedTraffic();mode='grid';
   $('challenge').disabled=false;$('launch').disabled=false;$('launch').textContent=restore?'Lái tiếp':'Cầm lái';
 }catch(e){if(token===loadToken){$('loadStatus').textContent=e.message;$('launch').textContent='Thử tải lại';$('launch').disabled=false;mode='error';pendingPlace=place;}}
}
async function stream(){
 if(busy||streamRetry>0||Math.hypot(car.x-loadX,car.z-loadZ)<300)return;
 const graph=roads,id=loadToken;busy=true;const x=car.x,z=car.z;
 try{
   await graph.load(x,z);if(id!==loadToken)return;loadX=x;loadZ=z;
   const [,changed]=await Promise.all([streamWater(graph),gfx.loadDistrict(graph,x,z)]);
   if(changed&&id===loadToken&&mode!=='tour')refreshView();
 }
 catch{if(id===loadToken){streamRetry=4;inform('Đang thử tải lại đường phía trước.',3);}}
 finally{if(id===loadToken)busy=false;}
}
function branchAhead(){
 let c={...player},left=0;
 for(let i=0;i<55;i++){
   left+=c.dir>0?c.edge.length-c.s:c.s;
   if(left>125)return null;
   const options=roads.options(c),node=c.dir>0?c.edge.end:c.edge.start;
   if(options.length>1)return {node,options,left};
   if(!options.length)return null;c=options[0];
 }return null;
}
function branchText(a){return a<-.38?'Trái':a>.38?'Phải':'Thẳng';}
function recover(){
 if(!player)return;
 const nearest=roads.nearest(car.x,car.z);if(nearest)player=nearest;
 parkOnRoad();inform('Đã đặt xe trở lại mặt đường.');
}
function spawnAhead(ahead,index){
 const c={edge:player.edge,dir:player.dir,s:player.s};
 if(roads.advance(c,ahead,opts=>opts[0])<10)return;
 if(index%3===1&&!c.edge.oneway)c.dir*=-1;
 addNpc(c,index);
}
function addNpc(c,i){
 const kind=['taxi','van','scooter','sedan','rival'][i%5];
 const offset=kind==='scooter'?Math.min(3.3,worldRoadHalfWidth(c.edge)*.7):Math.min(2.05,worldRoadHalfWidth(c.edge)*.47);
 const p=roads.sample(c,offset);
 if(Math.hypot(car.x-p.x,car.z-p.z)<16||npcs.some(n=>Math.hypot(p.x-n.x,p.z-n.z)<13))return;
 const pace=(kind==='scooter'?6:kind==='rival'?21:9)+Math.random()*4;
 npcs.push({...c,...p,kind,id:nextNpc++,speed:pace,pace,offset,stopped:0});
}
function seedTraffic(){
 for(let i=0;i<8;i++)spawnAhead(36+i*42,i);
 fillTraffic();
}
function fillTraffic(){
 npcs=npcs.filter(n=>Math.hypot(n.x-car.x,n.z-car.z)<430&&n.stopped<6&&roads.edges.has(n.edge.id));
 if(npcs.length>=13||!nearby.length)return;
 for(let i=0;i<12;i++){
   const edge=nearby[Math.floor(Math.random()*nearby.length)],dir=!edge.oneway&&Math.random()<.5?-1:1;
   const c={edge,dir,s:Math.random()*edge.length},p=roads.sample(c),d=Math.hypot(p.x-car.x,p.z-car.z);
   if(d>55&&d<330)addNpc(c,nextNpc);
   if(npcs.length>=13)break;
 }
 if(npcs.length<6)spawnAhead(85+Math.random()*125,nextNpc);
}
function trafficStep(dt){
 for(const n of npcs){
   if(n.flood){advanceFlood(n,dt);if(n.flood.age>5)n.stopped=7;continue;}
   const dx=car.x-n.x,dz=car.z-n.z,fx=Math.sin(n.yaw),fz=-Math.cos(n.yaw);
   const fallen=n.recoil?.fallen;
   let target=fallen||n.recoil?.braking?0:n.pace;
   for(const other of npcs){
     if(other===n)continue;const ox=other.x-n.x,oz=other.z-n.z,long=ox*fx+oz*fz;
     if(long>0&&long<15&&Math.abs(ox*fz-oz*fx)<1.65)target=Math.min(target,Math.max(0,(long-4)*1.3));
   }
   const ahead=dx*fx+dz*fz;
   if(ahead>0&&ahead<17&&Math.abs(dx*fz-dz*fx)<1.75)target=Math.min(target,Math.max(0,(ahead-5)*1.2));
   n.speed=fallen?0:n.speed+clamp(target-n.speed,-9*dt,2.8*dt);
   const moved=roads.advance(n,n.speed*dt,opts=>opts.length>1&&Math.random()<.24?opts[Math.floor(Math.random()*opts.length)]:opts[0]);
   if(moved<.001&&!fallen)n.stopped+=dt;else n.stopped=0;
   const pos=roads.sample(n,Math.min(n.offset,worldRoadHalfWidth(n.edge)*.75));
   const landing=DriveBody.advanceRecoil(n,dt);Object.assign(n,pos);
   if(n.recoil){n.x+=n.recoil.x;n.z+=n.recoil.z;n.yaw+=n.recoil.angle;}
   if(n.recoil){
     const wet=gfx.waterAt(n.x,n.z);
     if(wet&&wet.level-wet.bed>.55&&n.recoil.y<.6){
       startFlood(n,wet,n.recoil.vx,n.recoil.vz);continue;
     }
   }
   if(fallen)wreckContact(n);
   landingFx(n,landing);
   const along=(car.x-n.x)*fx+(car.z-n.z)*fz,across=(car.x-n.x)*fz-(car.z-n.z)*fx;
   const parallel=Math.cos(car.yaw-n.yaw)>.88&&Math.abs(across)<9;
   if(parallel&&along< -4&&along> -18)n.armed=true;
   if(!parallel||Math.abs(along)>32)n.armed=false;
   if(n.armed&&parallel&&along>4&&car.speed>n.speed&&cooldown<=0&&!n.passed){
     n.passed=true;passes++;nitro=Math.min(100,nitro+(n.kind==='rival'?20:7));inform(n.kind==='rival'?'Vượt tay đua · +20 nitro':'Vượt sạch · +7 nitro',1.6);
   }
   hitVehicle(n);if(mode!=='drive')return;
 }
}
function hitVehicle(n){
 if(n.recoil?.y>1.35)return;
 const bike=n.kind==='scooter',hit=DriveBody.contact(car,n,bike?.38:.91,bike?.95:1.98);
 if(!hit)return;
 const impact=DriveBody.resolve(car,hit,Math.sin(n.yaw)*n.speed+(n.recoil?.vx||0),-Math.cos(n.yaw)*n.speed+(n.recoil?.vz||0),n);
 if(impact.closing>.7){
   n.armed=false;n.passed=true;
   DriveBody.strikeTraffic(n,hit,impact,n.yaw,car.x,car.z,n.x,n.z);
   if(n.recoil?.fallen)n.speed=0;
   if(n===duel?.actor)duel.speed=n.speed;
   hurt(bike?'scooter':'car',impact,hit);
 }
}
const pit=createPitQuiz($('pit'),()=>'Chú Tư lắc đầu. Chọn lại đáp án nhé.',()=>{
 if(car.flood)recover();
 hp=100;DriveBody.reset(car);cooldown=2;mode='drive';keySet.clear();updateHud();save();inform('Máy lại giòn. Lên đường!');
});
function wreckContact(n){
 const r=n.recoil;
 if(Math.hypot(r.vx,r.vz)<.08)return;
 const hit=gfx.contact(n.x,n.z,.59);
 if(!hit||r.y>(hit.height??(hit.kind==='water'?.15:7)))return;
 r.kind='scooter';r.yaw=n.yaw;
 const x=r.x,z=r.z,event=DriveBody.resolve(r,hit);
 n.x+=r.x-x;n.z+=r.z-z;
 if(event.closing<1)return;
 const px=hit.pointX??n.x,pz=hit.pointZ??n.z;
 gfx.reactToContact(hit,px,pz,event.strength);gfx.impact(px,pz,hit.nx,hit.nz,event.strength,hit.kind,r.y,.18);
}
function landingFx(n,joules){
 if(n.recoil?.scrape)gfx.scrape(n.x,0,n.z,n.recoil.vx,n.recoil.vz);
 if(joules<160)return;
 const r=n.recoil,level=Math.min(.77,Math.sqrt(joules)/100);
 gfx.impact(n.x,n.z,-r.vx,-r.vz,level,'scrape',0,.12);
 driveAudio.impact(level*.55,'vehicle');
}
function hurt(kind,event,hit){
 if(cooldown>0||event.closing<.7)return;
 const strength=event.strength;
 DriveBody.recordDent(car,hit,event.delta,car.yaw);
 hp=Math.max(0,hp-event.damage);cooldown=.35;
 const x=hit.pointX??car.x-hit.nx,z=hit.pointZ??car.z-hit.nz;
 gfx.reactToContact?.(hit,x,z,strength);gfx.impact(x,z,hit.nx,hit.nz,strength,kind);
 driveAudio.impact(strength,kind==='car'||kind==='scooter'?'vehicle':'curb');
 if(hp===0){mode='crash';crashTime=1.2;crashKind=kind;car.boost=false;keySet.clear();}
 else inform('Va chạm · '+(event.energy/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})+' kJ · thân xe '+hp+'%',1.6);
}
function startFlood(actor,wet,vx,vz){
 const impact=Math.hypot(vx,vz);
 actor.flood={level:wet.level,bed:wet.bed,y:actor.wading?.bed??wet.level,age:0,vy:0,vx,vz,pitch:0};
 actor.wading=null;actor.boost=false;actor.slip=0;
 gfx.splash(actor.x,actor.z,-vx,-vz,Math.min(1,.24+impact/30),wet.level);
 if(actor!==car)return;
 driveAudio.impact(Math.min(1,.25+impact/35),'water');
 mode='sinking';keySet.clear();hp=0;updateHud();
 inform('Nước tràn vào máy · chờ cứu hộ',5);
}
function advanceFlood(actor,dt){
 const f=actor.flood;f.age+=dt;
 const drag=Math.exp(-2.6*dt);
 f.vx*=drag;f.vz*=drag;
 const x=actor.x+f.vx*dt,z=actor.z+f.vz*dt;
 const wet=gfx.waterAt(x,z);
 if(wet){
   actor.x=x;actor.z=z;f.level=wet.level;f.bed=wet.bed;
 }else{f.vx=0;f.vz=0;}
 actor.speed=f.vx*Math.sin(actor.yaw)-f.vz*Math.cos(actor.yaw);
 f.vy=Math.min(2.2,f.vy+dt*(.65+Math.min(1,f.age)*1.4));
 f.y=Math.max(f.bed,Math.min(f.level,f.y-f.vy*dt));
 f.pitch+=(Math.min(.21,(f.level-f.y)*.16)-f.pitch)*(1-Math.exp(-dt*2.6));
}
function waterStep(dt){
 const wet=gfx.waterAt(car.x,car.z);
 if(!wet){car.wading=null;return;}
 const depth=wet.level-wet.bed;
 if(depth>.6){startFlood(car,wet,car.vx,car.vz);return;}
 if(!car.wading&&Math.abs(car.speed)>1)gfx.splash(car.x,car.z,-car.vx,-car.vz,Math.min(.65,.14+Math.abs(car.speed)/35),wet.level);
 car.wading=wet;
 const drag=Math.exp(-depth*2.4*dt);
 car.vx*=drag;car.vz*=drag;car.speed*=drag;car.boost=false;
}
function tick(dt){
 cooldown=Math.max(0,cooldown-dt);streamRetry=Math.max(0,streamRetry-dt);
 const gas=held('w','arrowup'),reverse=held('s','arrowdown'),brake=held(' '),boost=!car.wading&&held('shift')&&nitro>1&&!reverse&&!brake;
 nitro=clamp(nitro+(boost?-27:held('shift')?0:6)*dt,0,100);
 const tune={gt:[6.4,43],rally:[7.7,40],supercar:[8.4,48]}[car.model];
 const x=car.x,z=car.z;
 DriveBody.step(car,{grade:gfx.grade(car.x,car.z,car.yaw),gas,reverse,brake,boost,steer:Number(held('d','arrowright'))-Number(held('a','arrowleft')),power:tune[0],top:tune[1]},dt);
 for(const axle of [1.2,-1.2]){
   const cx=car.x+Math.sin(car.yaw)*axle,cz=car.z-Math.cos(car.yaw)*axle,hit=gfx.contact(cx,cz,.88);
   if(!hit)continue;
   hit.axle=axle;const impact=DriveBody.resolve(car,hit);
   if(impact.closing>.7)hurt(hit.kind||'shoulder',impact,hit);
 }
 if(mode==='drive')waterStep(dt);
 trackRoad();const moved=Math.hypot(car.x-x,car.z-z);distance+=moved;
 if(mode!=='drive')return;
 if(duel){
   duel.move(player,moved,dt,npcs);hitVehicle(duel.actor);
   if(duel.player>=duel.gate){
     const won=duel.player>=duel.opponent;if(won)duel.wins++;
     inform((won?'Thắng chặng!':'Đối thủ về trước.')+' Chặng '+(++duel.round)+' bắt đầu.',4);duel.gate+=1200;
   }
 }
 if(Math.hypot(car.x-viewX,car.z-viewZ)>155)refreshView();stream();
 trafficStep(dt);spawnTick+=dt;if(spawnTick>1.6){fillTraffic();spawnTick=0;}
 snapshot+=dt;if(snapshot>4){save();snapshot=0;}
}
function updateHud(){
 const monument=gfx.nearLandmark(car.x,car.z);
 $('tourView').hidden=!monument||monument.distance>450;
 let landmark=monument;
 for(const pin of tourPins){
   const distance=Math.hypot(car.x-pin.x,car.z-pin.z);
   if(distance<420&&(!landmark||distance<landmark.distance))landmark={...pin,distance};
 }
 const site=source[3];
 if(site){const p=roads.point(site.lon,site.lat),distance=Math.hypot(car.x-p.x,car.z-p.z);
   if(distance<5000&&(!landmark||landmark.distance>distance))landmark={...p,distance,data:site};}
 $('landmark').hidden=!landmark;
 if(landmark)$('landmark').textContent=landmark.data.name+' · '+Math.round(landmark.distance)+' m';
 const grade=Math.round(100*gfx.grade(car.x,car.z,car.yaw));
 $('street').textContent=nameOf(player.edge)+(Math.abs(grade)>=2?' · '+(grade>0?'↑ ':'↓ ')+Math.abs(grade)+'%':'');$('speed').textContent=Math.round(Math.abs(car.speed)*3.6);$('trip').textContent=fmt(distance)+' · '+passes+' lượt vượt';$('hp').value=hp;$('nitro').value=nitro;
 const fork=branchAhead(),plan=duel&&fork?duel.nextAt(fork.node):null;
 $('duelInfo').hidden=!duel;
 if(duel)$('duelInfo').textContent='CHẶNG '+duel.round+' · '+(duel.player>=duel.opponent?'1/2':'2/2')+' · CÒN '+Math.ceil(duel.gate-duel.player)+' M';
 $('turnInfo').textContent=car.flood?'Xe ngập nước · chờ cứu hộ':car.wading?'Đang lội nước':duel?.offCourse?'Lệch lộ trình · tự lái về vệt xanh trên bản đồ':car.offroad?'Ngoài mặt đường':plan?'Giao lộ sau '+Math.ceil(fork.left)+' m · '+branchText(fork.options.find(o=>o.edge.id===plan.edge.id)?.angle||0):fork?'Giao lộ sau '+Math.ceil(fork.left)+' m':'';
 drawMini(landmark);
}
function traceMapLine(g,points){
 g.beginPath();
 points.forEach((p,i)=>i?g.lineTo(p.x-car.x,p.z-car.z):g.moveTo(p.x-car.x,p.z-car.z));
}
function drawDepartureMap(){
 const c=$('departureMap'),g=c.getContext('2d');
 // North-up overview of the actual starting roads. The driving map follows the car.
 g.save();g.translate(c.width/2,c.height/2);g.scale(.39,.39);
 for(const feature of water?.nearby(car.x,car.z)||[]){
   traceMapLine(g,feature.points);
   if(feature.kind==='lake'){g.fillStyle='#376267';g.fill();}
   else{g.strokeStyle='#437278';g.lineWidth=9;g.stroke();}
 }
 for(const edge of nearby){
   const selected=edge.id===player.edge.id;
   traceMapLine(g,edge.points);g.strokeStyle=selected?'#dbfa90':'#94aa93';
   g.lineWidth=selected?8:3.5;g.stroke();
 }
 g.restore();
 g.beginPath();g.arc(c.width/2,c.height/2,15,0,Math.PI*2);
 g.strokeStyle='#dcf89a';g.lineWidth=2;g.fillStyle='#d6f58932';g.fill();g.stroke();
 g.beginPath();g.arc(c.width/2,c.height/2,5,0,Math.PI*2);g.fillStyle='#f2ffca';g.fill();
}
let mapPlaces=[];
const drivingMap=createDrivingMap(()=>({graph:roads,car,edge:player.edge,water,duel,places:mapPlaces,amenities:gfx.streetLife?.places||[]}));
function openDrivingMap(){
 if(mode!=='drive')return;
 mode='map';keySet.clear();save();
 mapPlaces=localDrivingPlaces(roads,car.x,car.z,2700);
 drivingMap.open(nameOf(player.edge));
}
$('openDrivingMap').onclick=openDrivingMap;
$('drivingMap').addEventListener('close',()=>{
 if(mode!=='map')return;
 mode='drive';keySet.clear();updateHud();
 if(document.hidden||!document.hasFocus())pause();
});
function drawMini(landmark){
 const c=$('map'),g=c.getContext('2d'),scale=.43;
 g.clearRect(0,0,c.width,c.height);g.save();g.translate(c.width/2,c.height*.56);
 g.scale(scale,scale);g.rotate(-car.yaw);
 for(const e of nearby){
   g.strokeStyle=e.id===player.edge.id?'#d8f791':'#93aba2';g.lineWidth=e.id===player.edge.id?7:3;
   traceMapLine(g,e.points);g.stroke();
 }
 if(duel){
   g.strokeStyle='#a4ff63';g.lineWidth=5;g.beginPath();
   for(let d=0;d<=135;d+=3){const p=roads.sample(duel.at(duel.player+d));if(d)g.lineTo(p.x-car.x,p.z-car.z);else g.moveTo(p.x-car.x,p.z-car.z);}g.stroke();
   g.fillStyle='#ff6848';g.beginPath();g.arc(duel.actor.x-car.x,duel.actor.z-car.z,6,0,Math.PI*2);g.fill();
 }
 g.fillStyle='#b1dcca';for(const pin of tourPins){g.beginPath();g.arc(pin.x-car.x,pin.z-car.z,3.5,0,Math.PI*2);g.fill();}
 if(landmark){g.fillStyle='#ffe7a5';g.strokeStyle='#423c28';g.lineWidth=2;g.beginPath();g.arc(landmark.x-car.x,landmark.z-car.z,7,0,Math.PI*2);g.fill();g.stroke();}
 g.fillStyle='#ffbe68';for(const n of npcs){g.beginPath();g.arc(n.x-car.x,n.z-car.z,4,0,2*Math.PI);g.fill();}
 g.restore();g.fillStyle='#e5ff9b';g.beginPath();g.moveTo(c.width/2,c.height*.56-7);g.lineTo(c.width/2+5,c.height*.56+5);g.lineTo(c.width/2-5,c.height*.56+5);g.fill();
}
let nextWeatherCheck=0;
function frame(now){
 const dt=clamp((now-last)/1000,0,.1);last=now;
 if(gfx&&player){
   if(mode==='drive'){
     const steps=Math.max(1,Math.ceil(dt*90));
     for(let i=0;i<steps&&mode==='drive';i++)tick(dt/steps);
     if(car.opening){
       openingCameraTime=Math.min(1,openingCameraTime+dt/.85);
       car.openingPose=reduceMotion.matches||inside?0:1-openingCameraTime**2*(3-2*openingCameraTime);
       car.dawn=clamp((210-distance)/85,0,1);
       if(distance>.25)document.body.removeAttribute('data-awaiting-motion');
       if(car.dawn===0){car.opening=false;document.body.removeAttribute('data-lakeside');}
     }
   }else if(mode==='sinking'){
     advanceFlood(car,dt);
     if(car.flood.age>=4.1){mode='pit';pit('water');}
   }else if(mode==='crash'){
     DriveBody.settle(car,dt);
     for(const actor of duel?[duel.actor,...npcs]:npcs){
       const r=actor.recoil;if(!r)continue;
       const {x,z,angle}=r,landing=DriveBody.advanceRecoil(actor,dt);
       actor.x+=r.x-x;actor.z+=r.z-z;actor.yaw+=r.angle-angle;
       if(r.fallen)wreckContact(actor);
       landingFx(actor,landing);
     }
     crashTime-=dt;if(crashTime<=0){mode='pit';pit(crashKind);}
   }
   if(mode!=='loading'&&roads&&!document.hidden&&now>=nextWeatherCheck){nextWeatherCheck=now+2000;gfx.weather.locate(...roads.geo(car.x,car.z));}
   car.driving=mode==='drive';car.showroom=mode==='grid';
   if(mode!=='loading'&&mode!=='error'&&mode!=='map'&&!document.hidden){
     const ready=gfx.render(car,duel?[duel.actor,...npcs]:npcs,mode==='drive'||mode==='crash'||mode==='sinking'?dt:0,inside);
     if(mode==='tour'&&car.sightView?.data.id==='tam-chuc'){
       const point=gfx.projectSummit();
       summitMarker.hidden=!point;
       if(point){
         summitMarker.style.left=(point.x+1)*50+'%';
         summitMarker.style.top=(1-point.y)*50+'%';
       }
     }else summitMarker.hidden=true;
     if(ready&&!$('openingStill').hidden)$('openingStill').hidden=true;
   }
   if(mode==='drive'||mode==='sinking'){uiTick+=dt;if(uiTick>.13){uiTick=0;updateHud();}}
   driveAudio.update({speed:Math.abs(car.speed)*3.6,boost:car.driving&&car.boost,slip:car.slip,offroad:car.offroad,throttle:held('w','arrowup'),braking:car.brake,signal:false,mode:mode==='drive'?'driving':mode==='grid'?'idling':'ready'});
 }
 if(toastTime>0&&(toastTime-=dt)<=0)$('callout').textContent='';
 requestAnimationFrame(frame);
}
const worldBoard=createLeaderboard('xuyen-viet','Xuyên Việt');
let tripStart=0;
$('showBoard').onclick=()=>worldBoard.open();
$('openSetup').onclick=()=>$('journeySetup').showModal();
$('closeSetup').onclick=()=>$('journeySetup').close();
$('scoreBoard').onclick=()=>worldBoard.open(distance-tripStart);
function begin(){
 if(mode==='error'){if(loadRequest&&indexData&&gfx)startAt(loadRequest.place,loadRequest.restore);else location.reload();return;}
 if(!player||mode!=='grid')return;
 if($('journeySetup').open)$('journeySetup').close();
 $('openingStill').hidden=true;
 activeTrip=true;tripStart=distance;worldBoard.start();
 mode='drive';document.body.dataset.phase='drive';$('grid').hidden=true;$('hud').hidden=false;$('touch').hidden=false;$('camera').hidden=false;$('pause').hidden=false;updateHud();
 if(car.opening){
   document.body.setAttribute('data-awaiting-motion','');
   if(!matchMedia('(pointer:coarse)').matches&&!duel)inform('Giữ W hoặc ↑ để lên ga',3);
   driveAudio.ignition();
 }
 else driveAudio.cue(true);
}
function pause(){
 if(mode!=='drive')return;mode='paused';keySet.clear();save();$('raceMode').textContent=duel?'Lái tự do':'Đua xuyên Việt';$('positionLabel').textContent=nameOf(player.edge)+' · '+fmt(distance);$('rest').showModal();
}
$('launch').onclick=begin;$('pause').onclick=pause;
function showMonument(monument){
 const portraitOverview=monument.data.id==='tam-chuc'&&innerWidth<innerHeight;
 const angle=portraitOverview?monument.data.yaw-.27:(monument.data.viewAngle??(monument.data.yaw+.23));
 car.sightView={...monument,angle,elevation:monument.data.viewElevation??.27,zoom:1};
 $('tourZoom').value='1';$('tourReference').href=monument.data.photo;
 $('tourDescription').textContent=monument.data.description||'';$('tourDescription').hidden=!monument.data.description;
 $('tourTitle').textContent=monument.data.name;$('tourCamera').hidden=false;
 $('complexStopLabel').hidden=!monument.data.complex;
 if(monument.data.complex)$('complexStop').value=monument.data.id;
}
$('tourView').onclick=()=>{
 const monument=gfx.nearLandmark(car.x,car.z);if(mode!=='drive'||!monument)return;
 mode='tour';keySet.clear();
 const center=roads.point(tamChucOverview.lon,tamChucOverview.lat);
 const overview=source[3]?.id==='tam-chuc'&&monument.data.complex==='tam-chuc'&&Math.hypot(center.x-car.x,center.z-car.z)<540;
 showMonument(overview?{...center,data:tamChucOverview,height:75}:monument);
 for(const id of ['hud','touch','camera','pause'])$(id).hidden=true;
 $('backToCar').focus({preventScroll:true});
};
$('tourZoom').oninput=e=>{if(car.sightView)car.sightView.zoom=Number(e.target.value);};
let tourPointer=null,tourGraph=null,tourWater=null,tourCenter=null;
function loadingStop(busy){
 $('complexStop').disabled=$('backToCar').disabled=busy;
 $('tourCamera').setAttribute('aria-busy',String(busy));
}
$('complexStop').onchange=async e=>{
 const stop=e.target.value==='tam-chuc'?tamChucOverview:tamChucParts.find(s=>s.id===e.target.value);
 if(mode!=='tour'||!stop)return;
 loadingStop(true);
 try{
   const {x,z}=roads.point(stop.lon,stop.lat);
   if(Math.hypot(x-(tourCenter?.x??viewX),z-(tourCenter?.z??viewZ))>290){
     // Share the geographic origin, keeping the parked car and its road graph intact.
     tourGraph??=new VietnamRoads(indexData,roads.lon,roads.lat);
     tourWater??=new VietnamWater(await fetchWaterIndex(),tourGraph);
     await Promise.all([tourGraph.load(x,z),tourWater.load(x,z),gfx.loadDistrict(tourGraph,x,z)]);
     gfx.setRoads(tourGraph.nearby(x,z,560),x,z,tourWater.nearby(x,z),tourGraph);
     tourCenter={x,z};
   }
   showMonument(stop===tamChucOverview?{x,z,data:stop,height:75}:gfx.nearLandmark(x,z));
 }catch{
   $('complexStop').value=car.sightView.data.id;
   $('tourDescription').hidden=false;$('tourDescription').textContent='Chưa tải được cảnh. Hãy chọn lại công trình hoặc trở lại xe.';
 }finally{loadingStop(false);}
};
async function closeTour(){
 if(mode!=='tour'||$('backToCar').disabled)return;
 if(tourGraph){
   loadingStop(true);
   try{await gfx.loadDistrict(roads,car.x,car.z);refreshView();}
   finally{tourGraph=tourWater=tourCenter=null;loadingStop(false);}
 }
 mode='drive';car.sightView=null;tourPointer=null;keySet.clear();$('tourCamera').hidden=true;
 for(const id of ['hud','touch','camera','pause'])$(id).hidden=false;
 updateHud();$('tourView').focus({preventScroll:true});
}
$('backToCar').onclick=closeTour;
$('world').addEventListener('pointerdown',e=>{
 if(mode!=='tour'||tourPointer)return;
 $('world').setPointerCapture(e.pointerId);tourPointer={id:e.pointerId,x:e.clientX,y:e.clientY};
});
$('world').addEventListener('pointermove',e=>{
 if(!car.sightView||tourPointer?.id!==e.pointerId)return;
 car.sightView.angle-=(e.clientX-tourPointer.x)*.009;
 car.sightView.elevation=clamp(car.sightView.elevation+(e.clientY-tourPointer.y)*.004,.13,1.05);
 tourPointer.x=e.clientX;tourPointer.y=e.clientY;
});
$('world').addEventListener('lostpointercapture',()=>{tourPointer=null;});
$('challenge').onclick=()=>{if(mode==='grid'){duel=new RollingDuel(roads,player);begin();inform('Theo vệt xanh · vượt đối thủ trước mốc 1,2 km.',4);}};
$('raceMode').onclick=()=>{
 if(duel){duel=null;inform('Đã chuyển sang lái tự do.');}
 else{duel=new RollingDuel(roads,player);inform('Chặng đua 1,2 km bắt đầu.');}
 $('resume').click();updateHud();
};
$('resume').onclick=()=>{$('rest').close();mode='drive';keySet.clear();};
$('reverse').onclick=()=>{$('resume').click();recover();};
$('camera').onclick=()=>{inside=!inside;$('camera').textContent=inside?'Góc tài xế':'Góc sau xe';};
function soundLabel(){
 $('sound').textContent=driveAudio.enabled?'Tắt âm':'Bật âm';
 $('sound').dataset.muted=String(!driveAudio.enabled);
 $('sound').title=$('sound').textContent;
}
soundLabel();$('sound').onclick=()=>{driveAudio.toggle();soundLabel();};
$('rest').oncancel=e=>{e.preventDefault();$('resume').click();};
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(k==='m'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(mode==='drive'||mode==='map')){
   e.preventDefault();
   if(!e.repeat){if(mode==='map')$('drivingMap').close();else openDrivingMap();}
   return;
 }
 if(mode==='tour'){
   if(k==='escape')closeTour();
   if(!['SELECT','INPUT'].includes(e.target.tagName)&&(k==='arrowleft'||k==='arrowright')){car.sightView.angle+=(k==='arrowleft'?-1:1)*.09;e.preventDefault();}
   return;
 }
 if(mode!=='drive')return;
 if(['p','u','c'].includes(k)&&!e.repeat){
   if(k==='p')pause();if(k==='u')recover();if(k==='c')$('camera').click();e.preventDefault();return;
 }
 if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','shift',' '].includes(k)){keySet.add(k);e.preventDefault();}
});
window.addEventListener('keyup',e=>keySet.delete(e.key.toLowerCase()));
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',save);

let pendingPlace=featured[0],atlasPromise,originatedInPause=false;
const normalize=s=>s.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const tamChucParts=VietnamLandmarks.entries.filter(site=>site.complex==='tam-chuc').sort((a,b)=>a.tourOrder-b.tourOrder);
const tamChucOverview={id:'tam-chuc',complex:'tam-chuc',name:'Toàn cảnh trục chùa Tam Chúc',lon:105.79565,lat:20.55279,yaw:2.39,viewAngle:1.24,viewElevation:.50,width:260,depth:595,
 description:'Từ hồ vào núi, trục chùa đi qua Tam Quan nội, Vườn Cột Kinh và ba điện Quan Âm, Pháp Chủ, Tam Thế. Chùa Ngọc nằm cao hơn trên núi Thất Tinh.',
 photo:'https://vietnamtourism.gov.vn/en/printer/15748?type=1'};
$('complexStop').append(new Option('Toàn cảnh trục chùa','tam-chuc'));
const summitId='chua-ngoc-tam-chuc',summitName='Chùa Ngọc · đỉnh Thất Tinh';
for(const part of tamChucParts)$('complexStop').append(new Option(part.id===summitId?summitName:part.name,part.id));
const summitMarker=document.createElement('button');
summitMarker.id='summitMarker';summitMarker.hidden=true;summitMarker.textContent=summitName;
$('tourCamera').before(summitMarker);
summitMarker.onclick=()=>{
 if($('complexStop').disabled)return;
 $('complexStop').value=summitId;
 $('complexStop').dispatchEvent(new Event('change'));
};
const tamChuc={...tamChucParts.find(site=>site.tourOrder===1),id:'tam-chuc',name:'Quần thể Tam Chúc',custom:true,kind:'Quần thể kiến trúc',formerProvince:'Hà Nam',searchNames:tamChucParts.map(s=>s.name).join(' ')};
const models=VietnamLandmarks.entries.filter(site=>!site.complex).map(site=>({...site,custom:true,kind:'Mô hình 3D'}));
models.push(tamChuc);
// Eastbound on the lakeside road, just before it curves toward Tam Quan nội.
const openingPlace=['Tam Chúc',105.79650,20.555945,tamChuc];
const tourismSites=window.VietnamTourism?.entries||[];
const replaced=new Set();
for(const model of models){
 if(model.approachMeters==null){
   const east=(model.start[0]-model.lon)*111320*Math.cos(model.lat*Math.PI/180);
   model.approachMeters=Math.hypot(east,(model.start[1]-model.lat)*110900);
 }
 let closest=null,best=Infinity;
 for(const site of tourismSites){
   const d=(site.lon-model.lon)**2+(site.lat-model.lat)**2;
   if(d<best){best=d;closest=site;}
   if(d<.003**2&&(normalize(model.name)===normalize(site.name)||model.map&&model.map===site.map))replaced.add(site);
 }
 if(closest){model.region??=closest.region;model.province??=closest.province;}
}
const catalog=tourismSites.filter(site=>!replaced.has(site)&&site.id!=='osm-way-1346643116');
const mountainPlaces=mountainStages.map(stage=>({
 id:stage.id,name:stage.name,kind:'Đường đèo',city:'Đường đèo',start:stage.start,
 lon:stage.start[0],lat:stage.start[1],bearing:stage.bearing,km:stage.angles.length*stage.step/1000
}));
const destinations=[...models,...mountainPlaces,...catalog];
const tourPlace=site=>[site.km?site.name:site.name+' · '+site.city,...site.start,site];
for(const [label,values] of [['Vùng',['Bắc Bộ','Trung Bộ','Nam Bộ']],['Tỉnh, thành phố',[...new Set(catalog.map(s=>s.province))].sort((a,b)=>a.localeCompare(b,'vi'))]]){
 const group=document.createElement('optgroup');group.label=label;
 for(const value of values)group.append(new Option(value,value));$('tourFilter').append(group);
}
let matches=[],filteredSites=[],mapPins=[],projection,pageSize=24;
function samePlace(a,b){return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];}
function choosePlace(place){
 pendingPlace=place;const site=place[3];
 const raceLink=$('racePass');raceLink.hidden=!site?.km;
 if(site?.km)raceLink.href='cup.html?route='+encodeURIComponent(site.id);
 const approach=site?.approachMeters>=20?' · đường ô tô cách khoảng '+Math.round(site.approachMeters)+' m':'';
 $('picked').textContent=site?.km?site.name+' · '+site.km.toLocaleString('vi-VN')+' km trong Cúp':site?site.name+' · '+(site.province||site.city)+' · '+site.kind+approach:place[0]+' · '+place[2].toFixed(3)+'° B, '+place[1].toFixed(3)+'° Đ';
 for(const b of $('places').children)b.setAttribute('aria-pressed',String(samePlace(matches[Number(b.dataset.index)],place)));
 drawAtlas();
}
function placeList(keepScroll=false){
 const q=normalize($('findPlace').value.trim()),filter=$('tourFilter').value,list=$('places');
 const tokens=q.split(/\s+/).filter(Boolean),test=str=>tokens.every(t=>normalize(str).includes(t));
 filteredSites=destinations.filter(s=>(filter==='all'||(filter==='model'?s.custom:filter==='mountain'?!!s.km:filter===s.region||filter===s.province))&&test([s.name,s.city,s.locality,s.searchNames,s.formerProvince&&s.formerProvince+' cũ',s.province,s.kind,s.region].filter(Boolean).join(' ')));
 const coords=q.match(/^(-?[\d.]+)\s*[,;]\s*(-?[\d.]+)$/);
 const cities=filter==='all'?[...featured,...(q?atlasData?.places||[]:[])].filter(p=>test(p[0])):[];
 const seen=new Set();matches=coords?[['Tọa độ đã nhập',Number(coords[2]),Number(coords[1])]]:[...filteredSites.map(tourPlace),...cities];
 matches=matches.filter(p=>{
   const key=[p[0],p[1].toFixed(3),p[2].toFixed(3)].join('|');
   if(!Number.isFinite(p[1])||!Number.isFinite(p[2])||seen.has(key))return false;
   seen.add(key);return true;
 });
 const scroll=keepScroll?list.scrollTop:0;list.replaceChildren();
 matches.slice(0,pageSize).forEach((p,i)=>{
   const b=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('span');
   title.textContent=p[3]?.name||p[0];detail.textContent=p[3]?.km?'Đường đèo · '+p[3].km.toLocaleString('vi-VN')+' km':p[3]?[p[3].kind,p[3].province||p[3].city].filter(Boolean).join(' · '):'Điểm xuất phát';
   if(filter==='model'&&p[3]?.custom){
     const photo=document.createElement('img');photo.src='landmark-previews/'+encodeURIComponent(p[3].id)+'.webp';
     photo.alt='';photo.width=84;photo.height=58;photo.loading='lazy';b.className='sightChoice';b.append(photo);
     detail.textContent=[p[3].city,p[3].province||p[3].region].filter(Boolean).join(' · ');
   }
   b.append(title,detail);b.type='button';b.dataset.index=i;b.setAttribute('aria-pressed',String(samePlace(p,pendingPlace)));
   b.onclick=()=>choosePlace(p);list.append(b);
 });
 $('resultCount').textContent=matches.length?matches.length.toLocaleString('vi-VN')+' điểm đến':'Không tìm thấy điểm đến';
 $('morePlaces').hidden=matches.length<=pageSize;list.scrollTop=scroll;drawAtlas();
}
function resetPlaces(){pageSize=$('tourFilter').value==='model'?models.length:24;placeList();}
$('morePlaces').onclick=()=>{pageSize+=24;placeList(true);};
$('tourFilter').onchange=resetPlaces;
function drawAtlas(){
 const c=$('country'),g=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;
 const ratio=Math.min(2,devicePixelRatio);c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);g.setTransform(ratio,0,0,ratio,0,0);
 let west=101.75,east=110.25,south=7.8,north=24.2;
 if(filteredSites.length&&($('tourFilter').value!=='all'||$('findPlace').value.trim())){
   west=Infinity;east=-Infinity;south=Infinity;north=-Infinity;
   for(const p of filteredSites){west=Math.min(west,p.lon);east=Math.max(east,p.lon);south=Math.min(south,p.lat);north=Math.max(north,p.lat);}
   const pad=.3;
   west-=pad;east+=pad;south-=pad;north+=pad;
 }
 const lon0=(east+west)/2,lat0=(south+north)/2,scale=Math.min((w-14)/((east-west)*.96),(h-12)/(north-south)),cx=w/2,cy=h/2;
 const at=(lon,lat)=>[cx+(lon-lon0)*scale*.96,cy-(lat-lat0)*scale];
 projection=(x,y)=>[lon0+(x-cx)/(scale*.96),lat0-(y-cy)/scale];
 g.fillStyle='#132b32';g.fillRect(0,0,w,h);g.strokeStyle='#284149';g.lineWidth=.6;g.beginPath();
 for(let lon=101;lon<112;lon++){const [x]=at(lon,16);g.moveTo(x,0);g.lineTo(x,h);}
 for(let lat=8;lat<25;lat++){const [,y]=at(106,lat);g.moveTo(0,y);g.lineTo(w,y);}g.stroke();
 g.strokeStyle='#a8cb9c';g.lineWidth=.65;g.beginPath();
 for(const line of atlasData?.lines||[]){for(let i=0;i<line.length;i+=2){const p=at(line[i]/1e5,line[i+1]/1e5);if(!i)g.moveTo(...p);else g.lineTo(...p);}}g.stroke();
 mapPins=[];for(const site of filteredSites){
   const [x,y]=at(site.lon,site.lat);mapPins.push({x,y,site});
   g.fillStyle=site.custom?'#ffe2a5':'#97cdb9';g.beginPath();g.arc(x,y,site.custom?3:1.55,0,Math.PI*2);g.fill();
 }
 g.font='600 11px Segoe UI';g.fillStyle='#f5ecd2';
 for(const p of [featured[0],featured[2],featured[1]]){const [x,y]=at(p[1],p[2]);if(x<0||x>w||y<0||y>h)continue;g.fillRect(x-1.5,y-1.5,3,3);g.fillText(p[0],clamp(x+5,2,w-g.measureText(p[0]).width-2),y-4);}
 const [x,y]=at(pendingPlace[3]?.lon??pendingPlace[1],pendingPlace[3]?.lat??pendingPlace[2]);g.strokeStyle='#fff';g.fillStyle='#ff713c';g.lineWidth=1.6;g.beginPath();g.arc(x,y,4.5,0,Math.PI*2);g.fill();g.stroke();
}
function setAtlasView(map){
 $('atlas').dataset.view=map?'map':'list';
 $('atlasMap').setAttribute('aria-pressed',String(map));
 $('atlasList').setAttribute('aria-pressed',String(!map));
 if(map)drawAtlas();
}
$('atlasMap').onclick=()=>setAtlasView(true);
$('atlasList').onclick=()=>setAtlasView(false);
async function openAtlas(filter='all'){
 setAtlasView(filter==='all');
 originatedInPause=$('rest').open;if(originatedInPause)$('rest').close();
 $('atlas').showModal();$('findPlace').value='';$('tourFilter').value=filter;
 let preferred;
 if(filter==='model'&&!source[3]?.custom)preferred=models.find(site=>site.id==='ganh-da-dia')||models[0];
 if(filter==='mountain'&&!source[3]?.km)preferred=mountainPlaces.find(site=>site.id==='deo-hai-van')||mountainPlaces[0];
 choosePlace(preferred?tourPlace(preferred):source);resetPlaces();
 if(!atlasData){
   try{atlasPromise||=fetchJSON('vn-roads/overview.json');atlasData=await atlasPromise;placeList();drawAtlas();}
   catch{atlasPromise=null;$('picked').textContent='Chưa tải được bản đồ. Bạn vẫn có thể chọn địa danh trong danh sách.';}
 }
}
$('openingAtlas').onclick=$('openMap').onclick=$('relocate').onclick=()=>openAtlas();
$('openSights').onclick=e=>{e.preventDefault();openAtlas('model');};
$('openPasses').onclick=$('pausedPasses').onclick=e=>{e.preventDefault();openAtlas('mountain');};
$('atlas').onclose=()=>{if(originatedInPause&&mode==='paused')$('rest').showModal();originatedInPause=false;};
$('closeAtlas').onclick=()=>$('atlas').close();$('findPlace').oninput=resetPlaces;
$('country').onclick=e=>{
 if(!projection)return;
 const rect=$('country').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 let best=null,range=10;
 for(const pin of mapPins){const d=Math.hypot(pin.x-x,pin.y-y);if(d<range){best=pin.site;range=d;}}
 const [lon,lat]=projection(x,y);choosePlace(best?tourPlace(best):['Điểm trên bản đồ',lon,lat]);
};
$('travel').onclick=()=>{originatedInPause=false;$('atlas').close();if($('journeySetup').open)$('journeySetup').close();if(indexData&&gfx)startAt(pendingPlace);};
window.addEventListener('resize',()=>{if($('atlas').open)drawAtlas();});
async function fetchJSON(path){const r=await fetch(path);if(!r.ok)throw Error('Chưa tải được dữ liệu đường.');return r.json();}
(async()=>{
 $('openMap').disabled=true;
 try{
   gfx=createWorldScene($('world'));indexData=await fetchJSON('vn-roads/index.json');
   $('coverage').textContent=indexData.roadKm.toLocaleString('vi-VN')+' km đường · Dữ liệu '+new Date(indexData.osmTimestamp).toLocaleDateString('vi-VN');
   $('openingAtlas').disabled=false;$('openMap').disabled=false;$('travel').disabled=false;
   const valid=new URLSearchParams(location.search).get('intro')!=='tam-chuc'&&saved&&Number.isFinite(saved.lon)&&Number.isFinite(saved.lat)&&Number.isFinite(saved.distance)&&saved.distance>=0;
   const params=new URLSearchParams(location.search),stage=mountainPlaces.find(p=>p.id===params.get('pass'));
   const collection=params.get('collection')==='ha-nam';
   const landmark=models.find(p=>p.id===params.get('landmark'))||tamChucParts.find(p=>p.id===params.get('landmark'))||(collection&&tamChuc);
   if(landmark||stage)await startAt(tourPlace(landmark||stage));else await startAt(valid?[saved.label||'Hành trình đang lái',saved.lon,saved.lat]:openingPlace,valid?saved:null);
   requestAnimationFrame(frame);
   if(collection)await openAtlas('model');
 }catch(e){mode='error';$('loadStatus').textContent=e.message;$('launch').disabled=false;$('launch').textContent='Thử tải lại';}
})();
