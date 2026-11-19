'use strict';
const $=id=>document.getElementById(id),clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const keySet=new Set(),held=(...names)=>names.some(n=>keySet.has(n));
const featured=[['Hà Nội',105.8521,21.0277],['TP. Hồ Chí Minh',106.6994,10.7743],['Đà Nẵng',108.2204,16.0677],['Hải Phòng',106.6821,20.8587],['Huế',107.5887,16.4645],['Đà Lạt',108.4373,11.9418],['Cần Thơ',105.7831,10.0324],['Cà Mau',105.1507,9.1769],['Hà Giang',104.9844,22.8234],['Phú Quốc',103.959,10.2135]];
const nameOf=e=>e.name||({motorway:'Đường cao tốc',trunk:'Đường trục chính',primary:'Đường chính',secondary:'Đường liên huyện',tertiary:'Đường địa phương',residential:'Đường dân cư',service:'Đường dịch vụ'}[e.kind]||'Đường địa phương');
const fmt=d=>(d/1000).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
let gfx,atlasData,indexData,roads,waterIndex,water,player,nearby=[],npcs=[],nextNpc=1,mode='loading',inside=false,source=featured[0],saved;
let viewX=Infinity,viewZ=Infinity,loadX=Infinity,loadZ=Infinity,busy=false,loadToken=0,streamRetry=0;
let hp=100,nitro=100,cooldown=0,distance=0,snapshot=0,toastTime=0,steering=0,lane=1.65,queued=null,preview=null,lastFork='',passes=0,duel=null;
let car={model:'supercar',x:0,z:0,yaw:0,speed:0,steer:0,brake:false},last=performance.now(),uiTick=0,spawnTick=0;
try{saved=JSON.parse(localStorage.getItem('taylai.world.trip'));const model=localStorage.getItem('taylai.garage');if(['gt','rally'].includes(model))car.model=model;}catch{}
$('garage').value=car.model;
$('garage').onchange=()=>{car.model=$('garage').value;try{localStorage.setItem('taylai.garage',car.model);}catch{}};
function inform(text,time=3){$('callout').textContent=text;toastTime=time;}
function stance(){return Math.min(2.05,worldRoadHalfWidth(player.edge.kind)*.47);}
function save(){
 if(!player||!roads)return;
 const [lon,lat]=roads.geo(car.x,car.z);
 try{localStorage.setItem('taylai.world.trip',JSON.stringify({lon,lat,label:source[0],distance,passes,dir:player.dir,edge:player.edge.id}));}catch{}
}
function alignPlayer(snap=false,dt=0){
 const p=roads.sample(player,lane);car.x=p.x;car.z=p.z;
 const angle=p.yaw+steering*Math.min(.22,car.speed*.013),delta=Math.atan2(Math.sin(angle-car.yaw),Math.cos(angle-car.yaw));
 car.yaw=snap?angle:car.yaw+delta*(1-Math.exp(-dt*11));car.steer=steering;
}
function refreshView(){
 nearby=roads.nearby(car.x,car.z,560);
 gfx.setRoads(nearby,car.x,car.z,water?.nearby(car.x,car.z)||[]);viewX=car.x;viewZ=car.z;
}
async function streamWater(graph){
 try{
   waterIndex||=fetchJSON('vn-water/index.json').catch(e=>{waterIndex=null;throw e;});
   const index=await waterIndex;if(roads!==graph)return;
   if(!water||water.roads!==graph)water=new VietnamWater(index,graph);
   if(await water.load(car.x,car.z)&&roads===graph)refreshView();
 }catch{/* Road navigation stays available when this scenery layer is offline. */}
}
async function startAt(place,restore=null){
 const token=++loadToken;mode='loading';keySet.clear();$('grid').hidden=false;$('hud').hidden=true;$('touch').hidden=true;
 $('pause').hidden=true;$('camera').hidden=true;document.body.dataset.phase='grid';
 $('launch').disabled=true;$('challenge').disabled=true;$('launch').textContent='Đang tải đường…';$('loadStatus').textContent='';
 $('placeTitle').textContent=place[0];
 try{
   const graph=new VietnamRoads(indexData,place[1],place[2]);await graph.load(0,0);
   let nearest=graph.nearest(0,0);
   if(!nearest||nearest.error>4000**2){await graph.load(0,0,true);nearest=graph.nearest(0,0);}
   if(token!==loadToken)return;
   if(!nearest||nearest.error>28000**2)throw Error('Chưa có đường ô tô gần điểm này. Hãy chọn điểm khác trên bản đồ.');
   if(restore&&restore.edge===nearest.edge.id&&restore.dir===-1&&!nearest.edge.oneway)nearest.dir=-1;
   roads=graph;water=null;player=nearest;source=place;lane=stance();distance=restore?.distance||0;car.speed=0;steering=0;hp=nitro=100;
   car.region=place[2]<10.8?'delta':place[2]>21.6||(place[1]>107&&place[2]>11&&place[2]<15)?'highlands':'city';
   duel=null;passes=restore?.passes||0;cooldown=0;queued=null;preview=null;lastFork='';inside=false;busy=false;npcs=[];alignPlayer(true);
   loadX=car.x;loadZ=car.z;streamRetry=0;refreshView();streamWater(graph);seedTraffic();mode='grid';
   $('challenge').disabled=false;$('launch').disabled=false;$('launch').textContent=restore?'Tiếp tục lái tự do':'Lái tự do';$('loadStatus').textContent=nameOf(player.edge);
 }catch(e){if(token===loadToken){$('loadStatus').textContent=e.message;$('launch').textContent='Thử tải lại';$('launch').disabled=false;mode='error';pendingPlace=place;}}
}
async function stream(){
 if(busy||streamRetry>0||Math.hypot(car.x-loadX,car.z-loadZ)<300)return;
 const graph=roads,id=loadToken;busy=true;const x=car.x,z=car.z;
 try{await graph.load(x,z);if(id!==loadToken)return;loadX=x;loadZ=z;streamWater(graph);}
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
function selected(list){return list.find(o=>queued?.id===o.edge.id&&queued?.dir===o.dir)||list[0];}
function chooseByKey(side){
 if(!preview)return;
 const sorted=[...preview.options].sort((a,b)=>a.angle-b.angle);
 const i=sorted.indexOf(selected(preview.options));
 const next=sorted[(i+side+sorted.length)%sorted.length];queued={node:preview.node,id:next.edge.id,dir:next.dir};lastFork='';
}
function playerTurn(list){
 const node=player.dir>0?player.edge.end:player.edge.start;
 let next=list[0];
 if(queued?.node===node)next=selected(list);
 else if(list.length>1&&Math.abs(steering)>.55){
   const side=list.filter(o=>Math.sign(o.angle)===Math.sign(steering)&&Math.abs(o.angle)>.38);
   if(side.length)next=side[0];
 }
 const limit=worldRoadHalfWidth(next.edge.kind)-1;
 lane=clamp(lane,-limit,limit);
 if(queued?.node===node)queued=null;
 return next;
}
function reverse(){
 if(!player)return;
 if(duel){inform('Đang đua · chọn Lái tự do trong mục Dừng chân để tự chọn hướng.');return;}
 if(player.edge.oneway){inform('Đường một chiều. Hãy rẽ ở giao lộ tiếp theo.');return;}
 player.dir*=-1;queued=null;preview=null;car.speed=0;lane=stance();steering=0;alignPlayer(true);cooldown=1.5;
}
function spawnAhead(ahead,index){
 const c={edge:player.edge,dir:player.dir,s:player.s};
 if(roads.advance(c,ahead,opts=>opts[0])<10)return;
 if(index%3===1&&!c.edge.oneway)c.dir*=-1;
 addNpc(c,index);
}
function addNpc(c,i){
 const kind=['taxi','van','scooter','sedan','rival'][i%5];
 const offset=kind==='scooter'?Math.min(3.3,worldRoadHalfWidth(c.edge.kind)*.7):Math.min(2.05,worldRoadHalfWidth(c.edge.kind)*.47);
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
   const dx=car.x-n.x,dz=car.z-n.z,fx=Math.sin(n.yaw),fz=-Math.cos(n.yaw);
   let target=n.pace;
   for(const other of npcs){
     if(other===n)continue;const ox=other.x-n.x,oz=other.z-n.z,long=ox*fx+oz*fz;
     if(long>0&&long<15&&Math.abs(ox*fz-oz*fx)<1.65)target=Math.min(target,Math.max(0,(long-4)*1.3));
   }
   const ahead=dx*fx+dz*fz;
   if(ahead>0&&ahead<17&&Math.abs(dx*fz-dz*fx)<1.75)target=Math.min(target,Math.max(0,(ahead-5)*1.2));
   n.speed+=clamp(target-n.speed,-9*dt,2.8*dt);
   const moved=roads.advance(n,n.speed*dt,opts=>opts.length>1&&Math.random()<.24?opts[Math.floor(Math.random()*opts.length)]:opts[0]);
   if(moved<.001)n.stopped+=dt;else n.stopped=0;
   const pos=roads.sample(n,Math.min(n.offset,worldRoadHalfWidth(n.edge.kind)*.75));Object.assign(n,pos);
   const along=(car.x-n.x)*fx+(car.z-n.z)*fz,across=(car.x-n.x)*fz-(car.z-n.z)*fx;
   const parallel=Math.cos(car.yaw-n.yaw)>.88&&Math.abs(across)<9;
   if(parallel&&along< -4&&along> -18)n.armed=true;
   if(!parallel||Math.abs(along)>32)n.armed=false;
   if(n.armed&&parallel&&along>4&&car.speed>n.speed&&cooldown<=0&&!n.passed){
     n.passed=true;passes++;nitro=Math.min(100,nitro+(n.kind==='rival'?20:7));inform(n.kind==='rival'?'Vượt tay đua · +20 nitro':'Vượt sạch · +7 nitro',1.6);
   }
   if(Math.abs(along)<(n.kind==='scooter'?2.7:3.8)&&Math.abs(across)<(n.kind==='scooter'?1.1:1.7)&&cooldown<=0){
     const rel=Math.hypot(Math.sin(car.yaw)*car.speed-fx*n.speed,Math.cos(car.yaw)*car.speed+fz*n.speed);
     if(rel>1.2){n.armed=false;n.passed=true;hurt('car',rel);if(mode!=='drive')return;}
   }
 }
}
const pit=createPitQuiz($('pit'),()=>'Chú Tư lắc đầu. Chọn lại đáp án nhé.',()=>{
 hp=100;car.speed=0;lane=stance();alignPlayer(true);cooldown=3;mode='drive';keySet.clear();inform('Máy lại giòn. Lên đường!');
});
function hurt(kind,energy){
 if(cooldown>0)return;
 hp=Math.max(0,hp-Math.min(100,Math.round(16+energy*2.6)));cooldown=1.6;car.speed*=.36;
 driveAudio.impact(clamp(energy/35,.2,1),kind==='car'?'vehicle':'curb');document.body.classList.add('hit');setTimeout(()=>document.body.classList.remove('hit'),230);
 if(hp===0){mode='pit';car.speed=0;keySet.clear();pit(kind);}else inform('Va chạm · thân xe còn '+hp+'%');
}
function tick(dt){
 cooldown=Math.max(0,cooldown-dt);streamRetry=Math.max(0,streamRetry-dt);
 const gas=held('w','arrowup'),brake=held('s','arrowdown',' '),boost=held('shift')&&nitro>1&&!brake;
 car.brake=brake;nitro=clamp(nitro+(boost?-27:held('shift')?0:6)*dt,0,100);
 const tune={gt:[6.4,43],rally:[7.7,40],supercar:[8.4,48]}[car.model];
 car.speed=clamp(car.speed+((gas?tune[0]:0)+(boost?13:0)-(brake?18:0)-.65-.0029*car.speed**2)*dt,0,tune[1]+(boost?8:0));
 const steer=Number(held('d','arrowright'))-Number(held('a','arrowleft'));
 steering+=(steer-steering)*(1-Math.exp(-dt*8));
 lane+=steering*Math.min(8,car.speed*.4)*dt;
 const limit=worldRoadHalfWidth(player.edge.kind)-.8;
 if(Math.abs(lane)>limit){lane=Math.sign(lane)*limit;if(car.speed>4)hurt('shoulder',car.speed*.75);if(mode!=='drive')return;}
 const want=car.speed*dt,oldDir=player.dir,oldId=player.edge.id;
 let moved;
 if(duel){
   moved=duel.move(want,dt,npcs);Object.assign(player,duel.at(duel.player));
   if(duel.player>=duel.gate){
     const won=duel.player>=duel.opponent;if(won)duel.wins++;
     inform((won?'Thắng chặng!':'Đối thủ về trước.')+' Chặng '+(++duel.round)+' bắt đầu.',4);duel.gate+=1200;
   }
 }else moved=roads.advance(player,want,playerTurn);
 if(moved+.001<want){car.speed=0;inform('Cuối đường một chiều. Mở bản đồ để chọn điểm xuất phát khác.');}
 else if(oldId===player.edge.id&&oldDir!==player.dir){car.speed=Math.min(car.speed,3);inform('Hết đường · quay đầu');}
 distance+=moved;alignPlayer(false,dt);
 if(duel&&cooldown<=0&&Math.hypot(car.x-duel.actor.x,car.z-duel.actor.z)<2.6&&Math.abs(car.speed-duel.speed)>2){
   hurt('car',Math.abs(car.speed-duel.speed)+4);if(mode!=='drive')return;
 }
 if(Math.hypot(car.x-viewX,car.z-viewZ)>155)refreshView();stream();
 trafficStep(dt);spawnTick+=dt;if(spawnTick>1.6){fillTraffic();spawnTick=0;}
 snapshot+=dt;if(snapshot>4){save();snapshot=0;}
}
function updateHud(){
 $('street').textContent=nameOf(player.edge);$('speed').textContent=Math.round(car.speed*3.6);$('trip').textContent=fmt(distance)+' · '+passes+' lượt vượt';$('hp').value=hp;$('nitro').value=nitro;
 preview=branchAhead();if(queued&&preview&&queued.node!==preview.node)queued=null;
 const options=preview?.options||[],plan=duel&&preview?duel.nextAt(preview.node):null;
 const pick=options.find(o=>o.edge.id===plan?.edge.id&&o.dir===plan.dir)||selected(options);
 $('duelInfo').hidden=!duel;
 if(duel)$('duelInfo').textContent='CHẶNG '+duel.round+' · '+(duel.player>=duel.opponent?'1/2':'2/2')+' · CÒN '+Math.ceil(duel.gate-duel.player)+' M · '+duel.wins+' THẮNG';
 $('turnInfo').textContent=preview?'Giao lộ sau '+Math.ceil(preview.left)+' m · '+branchText(pick.angle)+' vào '+nameOf(pick.edge):player.edge.oneway?'Đường một chiều':'';
 const signature=options.map(o=>o.edge.id+'/'+o.dir).join(',')+':'+(pick?.edge.id||'')+'/'+(pick?.dir||'');
 if(signature!==lastFork){
   lastFork=signature;$('forkButtons').replaceChildren();
   for(const o of (duel?[]:[...options].sort((a,b)=>a.angle-b.angle))){
     const b=document.createElement('button');b.textContent=branchText(o.angle);b.title=nameOf(o.edge);b.setAttribute('aria-label',b.textContent+' · '+b.title);
     b.setAttribute('aria-pressed',String(o===pick));b.onclick=()=>{queued={node:preview.node,id:o.edge.id,dir:o.dir};lastFork='';updateHud();};$('forkButtons').append(b);
   }
 }
 drawMini();
}
function drawMini(){
 const c=$('map'),g=c.getContext('2d'),scale=.43;
 g.clearRect(0,0,c.width,c.height);g.save();g.translate(c.width/2,c.height*.56);
 g.scale(scale,scale);g.rotate(-car.yaw);
 for(const e of nearby){
   g.strokeStyle=e.id===player.edge.id?'#abe9c9':'#809291';g.lineWidth=e.id===player.edge.id?7:3;g.beginPath();
   e.points.forEach((p,i)=>i?g.lineTo(p.x-car.x,p.z-car.z):g.moveTo(p.x-car.x,p.z-car.z));g.stroke();
 }
 if(duel){
   g.strokeStyle='#a4ff63';g.lineWidth=5;g.beginPath();
   for(let d=0;d<=135;d+=3){const p=roads.sample(duel.at(duel.player+d));if(d)g.lineTo(p.x-car.x,p.z-car.z);else g.moveTo(p.x-car.x,p.z-car.z);}g.stroke();
   g.fillStyle='#ff6848';g.beginPath();g.arc(duel.actor.x-car.x,duel.actor.z-car.z,6,0,Math.PI*2);g.fill();
 }
 g.fillStyle='#ffbe68';for(const n of npcs){g.beginPath();g.arc(n.x-car.x,n.z-car.z,4,0,2*Math.PI);g.fill();}
 g.restore();g.fillStyle='#e5ff9b';g.beginPath();g.moveTo(c.width/2,c.height*.56-7);g.lineTo(c.width/2+5,c.height*.56+5);g.lineTo(c.width/2-5,c.height*.56+5);g.fill();
}
function frame(now){
 const dt=clamp((now-last)/1000,0,.1);last=now;
 if(gfx&&player){
   if(mode==='drive')tick(dt);
   car.showroom=mode==='grid';
   if(mode!=='loading'&&mode!=='error'&&!document.hidden)gfx.render(car,duel?[duel.actor,...npcs]:npcs,mode==='drive'?dt:0,inside);
   if(mode==='drive'){uiTick+=dt;if(uiTick>.13){uiTick=0;updateHud();}}
   driveAudio.update({speed:car.speed*3.6,throttle:held('w','arrowup'),braking:car.brake,signal:false,mode:mode==='drive'?'driving':mode==='grid'?'idling':'ready'});
 }
 if(toastTime>0&&(toastTime-=dt)<=0)$('callout').textContent='';
 requestAnimationFrame(frame);
}
function begin(){
 if(mode==='error'){if(indexData&&gfx)startAt(pendingPlace);else location.reload();return;}
 if(!player||mode!=='grid')return;
 mode='drive';document.body.dataset.phase='drive';$('grid').hidden=true;$('hud').hidden=false;$('touch').hidden=false;$('camera').hidden=false;$('pause').hidden=false;updateHud();driveAudio.cue(true);
}
function pause(){
 if(mode!=='drive')return;mode='paused';keySet.clear();save();$('raceMode').textContent=duel?'Lái tự do':'Đua xuyên Việt';$('positionLabel').textContent=nameOf(player.edge)+' · '+fmt(distance);$('rest').showModal();
}
$('launch').onclick=begin;$('pause').onclick=pause;
$('challenge').onclick=()=>{if(mode==='grid'){duel=new RollingDuel(roads,player);begin();inform('Theo vệt xanh · vượt đối thủ trước mốc 1,2 km.',4);}};
$('raceMode').onclick=()=>{
 if(duel){duel=null;inform('Đã chuyển sang lái tự do.');}
 else{duel=new RollingDuel(roads,player);inform('Chặng đua 1,2 km bắt đầu.');}
 lastFork='';$('resume').click();updateHud();
};
$('resume').onclick=()=>{$('rest').close();mode='drive';keySet.clear();};
$('reverse').onclick=()=>{$('resume').click();reverse();};
$('camera').onclick=()=>{inside=!inside;$('camera').textContent=inside?'Góc tài xế':'Góc sau xe';};
function soundLabel(){$('sound').textContent=driveAudio.enabled?'Tắt âm':'Bật âm';}
soundLabel();$('sound').onclick=()=>{driveAudio.toggle();soundLabel();};
$('rest').oncancel=e=>{e.preventDefault();$('resume').click();};
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();if(mode!=='drive')return;
 if(['q','e','p','u','c'].includes(k)&&!e.repeat){
   if(k==='q'||k==='e')chooseByKey(k==='q'?-1:1);
   if(k==='p')pause();if(k==='u')reverse();if(k==='c')$('camera').click();e.preventDefault();return;
 }
 if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','shift',' '].includes(k)){keySet.add(k);e.preventDefault();}
});
window.addEventListener('keyup',e=>keySet.delete(e.key.toLowerCase()));
for(const b of document.querySelectorAll('[data-key]')){
 b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keySet.add(b.dataset.key);e.preventDefault();};
 b.onlostpointercapture=()=>keySet.delete(b.dataset.key);
}
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',save);

let pendingPlace=featured[0],atlasPromise,originatedInPause=false;
const normalize=s=>s.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
function choosePlace(place){pendingPlace=place;$('picked').textContent=place[0]+' · '+place[2].toFixed(3)+'° B, '+place[1].toFixed(3)+'° Đ';drawAtlas();}
function placeList(){
 const q=normalize($('findPlace').value.trim()),all=[...featured,...(atlasData?.places||[])],list=$('places');list.replaceChildren();
 const coords=q.match(/^(-?[\d.]+)\s*[,;]\s*(-?[\d.]+)$/);
 const picks=coords?[['Tọa độ đã nhập',Number(coords[2]),Number(coords[1])]]:all.filter(p=>!q||normalize(p[0]).includes(q));
 const seen=new Set();
 for(const p of picks){
   if(seen.has(p[0])||!Number.isFinite(p[1])||!Number.isFinite(p[2]))continue;
   const b=document.createElement('button');b.textContent=p[0];b.onclick=()=>choosePlace(p);list.append(b);seen.add(p[0]);if(seen.size>=16)break;
 }
 if(!list.children.length)list.textContent='Chưa tìm thấy. Có thể chọn trực tiếp trên bản đồ.';
}
let projection;
function drawAtlas(){
 const c=$('country'),g=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;
 const ratio=Math.min(2,devicePixelRatio);c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);g.setTransform(ratio,0,0,ratio,0,0);
 const scale=Math.min((w-14)/8.5,(h-12)/16.4),cx=w/2,cy=h/2;
 const at=(lon,lat)=>[cx+(lon-106)*scale*.96,cy-(lat-16)*scale];
 projection=(x,y)=>[106+(x-cx)/(scale*.96),16-(y-cy)/scale];
 g.fillStyle='#132b32';g.fillRect(0,0,w,h);g.strokeStyle='#284149';g.lineWidth=.6;g.beginPath();
 for(let lon=101;lon<112;lon++){const [x]=at(lon,16);g.moveTo(x,0);g.lineTo(x,h);}
 for(let lat=8;lat<25;lat++){const [,y]=at(106,lat);g.moveTo(0,y);g.lineTo(w,y);}g.stroke();
 g.strokeStyle='#a8cb9c';g.lineWidth=.65;g.beginPath();
 for(const line of atlasData?.lines||[]){for(let i=0;i<line.length;i+=2){const p=at(line[i]/1e5,line[i+1]/1e5);if(!i)g.moveTo(...p);else g.lineTo(...p);}}g.stroke();
 g.font='600 11px Segoe UI';g.fillStyle='#f5ecd2';
 for(const p of [featured[0],featured[2],featured[1]]){const [x,y]=at(p[1],p[2]);g.fillRect(x-1.5,y-1.5,3,3);g.fillText(p[0],clamp(x+5,2,w-g.measureText(p[0]).width-2),y-4);}
 const [x,y]=at(pendingPlace[1],pendingPlace[2]);g.strokeStyle='#fff';g.fillStyle='#ff713c';g.lineWidth=1.6;g.beginPath();g.arc(x,y,4.5,0,Math.PI*2);g.fill();g.stroke();
}
async function openAtlas(){
 originatedInPause=$('rest').open;if(originatedInPause)$('rest').close();
 $('atlas').showModal();$('findPlace').value='';choosePlace(source);placeList();
 if(!atlasData){
   try{atlasPromise||=fetchJSON('vn-roads/overview.json');atlasData=await atlasPromise;placeList();drawAtlas();}
   catch{atlasPromise=null;$('picked').textContent='Chưa tải được bản đồ. Bạn vẫn có thể chọn địa danh trong danh sách.';}
 }
}
$('openMap').onclick=openAtlas;$('relocate').onclick=openAtlas;
$('atlas').onclose=()=>{if(originatedInPause&&mode==='paused')$('rest').showModal();originatedInPause=false;};
$('closeAtlas').onclick=()=>$('atlas').close();$('findPlace').oninput=placeList;
$('country').onclick=e=>{if(!projection)return;const rect=$('country').getBoundingClientRect(),[lon,lat]=projection(e.clientX-rect.left,e.clientY-rect.top);choosePlace(['Điểm trên bản đồ',lon,lat]);};
$('travel').onclick=()=>{originatedInPause=false;$('atlas').close();if(indexData&&gfx)startAt(pendingPlace);};
window.addEventListener('resize',()=>{if($('atlas').open)drawAtlas();});
async function fetchJSON(path){const r=await fetch(path);if(!r.ok)throw Error('Chưa tải được dữ liệu đường.');return r.json();}
(async()=>{
 $('openMap').disabled=true;
 try{
   gfx=createWorldScene($('world'));indexData=await fetchJSON('vn-roads/index.json');
   $('coverage').textContent=indexData.roadKm.toLocaleString('vi-VN')+' km đường · Dữ liệu '+new Date(indexData.osmTimestamp).toLocaleDateString('vi-VN');
   $('openMap').disabled=false;
   const valid=saved&&Number.isFinite(saved.lon)&&Number.isFinite(saved.lat)&&Number.isFinite(saved.distance)&&saved.distance>=0;
   await startAt(valid?[saved.label||'Hành trình đang lái',saved.lon,saved.lat]:featured[0],valid?saved:null);
   requestAnimationFrame(frame);
 }catch(e){mode='error';$('loadStatus').textContent=e.message;$('launch').disabled=false;$('launch').textContent='Thử tải lại';}
})();
