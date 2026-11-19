'use strict';
// Extend the tarmac behind the starting line for the chase camera.
const apron=new T.Mesh(new T.PlaneGeometry(12,36),new T.MeshLambertMaterial({map:asphalt,color:0xb4b8b8}));
apron.rotation.x=-Math.PI/2;apron.position.set(0,height(0),18);scene.add(apron);
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
const brush=shadowCanvas.getContext('2d'),shade=brush.createRadialGradient(32,32,10,32,32,32);
shade.addColorStop(0,'rgba(10,10,14,.72)');shade.addColorStop(1,'rgba(10,10,14,0)');brush.fillStyle=shade;brush.fillRect(0,0,64,64);
const shadowMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
function addShadow(parent){
 const mesh=new T.Mesh(new T.PlaneGeometry(3.1,5.6),shadowMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.y=.075;parent.add(mesh);
}
addShadow(rig);
const coupeAsset=TrafficModels.load.loadAsync('streetscape/race-car.glb');
const animatedCars=[];
async function fitCoupe(parent,paint,isPlayer){
 const {scene:template}=await coupeAsset,model=template.clone(true);
 const finish=new Map();
 model.traverse(part=>{
   if(!part.isMesh)return;
   part.castShadow=true;part.receiveShadow=true;
   const src=part.material;
   if(!['paint','light_rear'].includes(src.name))return;
   if(!finish.has(src.name)){
     const m=src.clone();
     if(src.name==='paint'){m.color.set(paint);m.envMapIntensity=1.35;m.clearcoat=1;m.clearcoatRoughness=.11;}
     else{m.emissive.set(0xff1604);m.emissiveIntensity=.6;}
     finish.set(src.name,m);
   }
   part.material=finish.get(src.name);
 });
 model.rotation.y=Math.PI;
 parent.add(model);
 animatedCars.push({model,isPlayer,wheels:['FL','FR','RL','RR'].map(id=>model.getObjectByName('wheel_'+id)),front:['FL','FR'].map(id=>model.getObjectByName('steer_'+id)),rear:finish.get('light_rear')});
}
fitCoupe(outer,0xcb331e,true).then(()=>outer.remove(fallback)).catch(()=>loadSedan().catch(()=>{}));
const chips=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:0xffc878,size:.085}));
const positions=new Float32Array(54),velocities=new Float32Array(54);
chips.geometry.setAttribute('position',new T.BufferAttribute(positions,3));chips.frustumCulled=false;chips.visible=false;scene.add(chips);
let chipTime=0;
function scatterChips(){
 chipTime=.55;chips.visible=true;chips.position.set(state.x,at(state.d).y+.65,state.z);
 positions.fill(0);
 for(let i=0;i<velocities.length;i+=3){velocities[i]=(Math.random()-.5)*8;velocities[i+1]=1+Math.random()*4;velocities[i+2]=(Math.random()-.5)*7;}
 chips.geometry.attributes.position.needsUpdate=true;
}
const rivals = [
  {name:'Bảy Bánh Mì',lane:-3.4,grid:16,pace:29,color:0xff853d,asset:'hatchback'},
  {name:'Út Giao Hàng',lane:.3,grid:10,pace:27,color:0x2e95ba,asset:'kei-van'},
  {name:'Tèo Hết Xăng',lane:3.4,grid:7,pace:26,color:0xafdc50,asset:'hatchback'}
];
for(const rival of rivals){
  rival.d=rival.grid;rival.offset=rival.lane;rival.v=0;
  rival.car=new T.Group();scene.add(rival.car);addShadow(rival.car);
  const shell=new T.Mesh(new T.BoxGeometry(1.78,1.12,3.9),new T.MeshLambertMaterial({color:rival.color}));
  shell.position.y=.7;rival.car.add(shell);
  if(rival===rivals[2]){
    fitCoupe(rival.car,0x427383,false).then(()=>rival.car.remove(shell)).catch(()=>{});
  }else TrafficModels.load.loadAsync('traffic/'+rival.asset+'.glb').then(({scene:model})=>{
    const bounds=new T.Box3().setFromObject(model),scale=4.05/(bounds.max.z-bounds.min.z);
    model.scale.setScalar(scale);model.rotation.y=Math.PI;model.position.y=-bounds.min.y*scale;
    model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
    rival.car.remove(shell);rival.car.add(model);
  }).catch(()=>{});
  const label=document.createElement('canvas');label.width=320;label.height=64;
  const ctx=label.getContext('2d');ctx.fillStyle='#202127';ctx.fillRect(0,0,320,64);
  ctx.fillStyle='#ffe079';ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.fillText(rival.name,160,42);
  const tex=new T.CanvasTexture(label);tex.colorSpace=T.SRGBColorSpace;
  const tag=new T.Sprite(new T.SpriteMaterial({map:tex,opacity:.82,transparent:true}));tag.scale.set(1.75,.35,1);tag.position.y=2.35;rival.car.add(tag);
}
let questionDeck=[];
function drawQuestion(){
 if(!questionDeck.length){
   questionDeck=[...window.driveBank];
   for(let i=questionDeck.length-1;i>0;i--){
     const j=Math.floor(Math.random()*(i+1));
     [questionDeck[i],questionDeck[j]]=[questionDeck[j],questionDeck[i]];
   }
   if(questionDeck.at(-1).id===previousQuestion)questionDeck.reverse();
 }
 return questionDeck.pop();
}
let vitality=100,boost=100,lateral=0,grace=0,shake=0,countdown=3,penalty=0,repairs=0;
let lastRank=4,previousQuestion=null,answered=false,resumePhase='drive',checkpoint=0;
const held=(...codes)=>codes.some(code=>keys.has(code));
const clockText=seconds=>Math.floor(seconds/60)+':'+(seconds%60).toFixed(1).padStart(4,'0');
const rank=()=>1+rivals.filter(r=>r.d>state.d||r.finished).length;
function tellRace(text){message=text;feedbackUntil=state.time+2.4;}
function setMode(mode){state.mode=mode;document.body.dataset.phase=mode;}
function positionCar(){
 const p=at(state.d,state.offset);state.x=p.x;state.z=p.z;state.h=p.h+Math.atan2(lateral,Math.max(6,state.v))*.55;
}
function placeRivals(){
 for(const r of rivals){
   const p=at(r.d,r.offset);r.car.position.set(p.x,p.y,p.z);r.car.rotation.y=-p.h;
 }
}
function beginRace(){
 const p=at(0,1.6);
 state={mode:'grid',d:0,x:p.x,z:p.z,h:p.h,offset:1.6,v:0,steer:0,time:0,signal:0};
 inside=false;placeRivals();$('routeName').textContent=route.name;$('progress').max=route.finish;
 $('next').href='?route='+(river?'pass':'river');
 requestAnimationFrame(render);
}
function startCountdown(){
 $('grid').hidden=true;$('hud').hidden=false;$('touch').hidden=false;$('pause').hidden=false;
 setMode('countdown');keys.clear();$('count').textContent='3';driveAudio.cue(false);
}
function openPit(kind){
 setMode('pit');state.v=0;lateral=0;keys.clear();repairs++;
 const q=drawQuestion();
 previousQuestion=q.id;answered=false;
 const diagram=$('pitImage');diagram.hidden=!q.image;
 if(q.image){diagram.src=q.image;diagram.alt='Hình minh họa câu '+q.id;}else diagram.removeAttribute('src');
 $('remark').textContent=kind==='car'?'Cản sau đâu phải nút bấm còi!':kind==='downhill'?'Đổ đèo, đừng đổ phụ tùng!':kind==='curve'?'Cua trái, cản trước đi thẳng.':'Lề đường vừa xin chữ ký.';
 $('prompt').textContent=q.prompt;$('reply').textContent='Chú Tư đang mở nắp ca-pô. Trả lời câu này để chú ráp xe.';$('choices').replaceChildren();$('repair').hidden=true;
 q.choices.forEach((choice,i)=>{
   const b=document.createElement('button');b.textContent=choice;b.onclick=()=>{
     if(answered)return;
     if(i!==q.correct){penalty+=3;b.disabled=true;$('reply').textContent='Chưa ổn! Chú Tư cộng 3 giây tiền công. Thử lại nhé.';return;}
     answered=true;for(const btn of $('choices').children)btn.disabled=true;
     $('reply').textContent='Chuẩn bài! Cản trước đã về với chính chủ.';$('repair').hidden=false;$('repair').focus();
   };$('choices').append(b);
 });
 $('pit').showModal();
}
function repair(){
 if(!answered||state.mode!=='pit')return;
 $('pit').close();vitality=100;state.offset=clamp(state.offset,-3.8,3.8);positionCar();
 grace=2;state.v=9;keys.clear();setMode('drive');tellRace('Máy lại giòn. Đi kiếm ổ bánh mì thôi!');
}
function collision(kind,relative){
 if(grace>0)return;
 const damage=Math.min(100,Math.round(18+2.4*relative));vitality=Math.max(0,vitality-damage);
 shake=.48;grace=1.15;scatterChips();driveAudio.impact(damage/100,kind==='car'?'vehicle':'curb');
 document.body.classList.add('hit');setTimeout(()=>document.body.classList.remove('hit'),270);
 state.v*=.55;lateral*=-.32;
 if(!vitality)openPit(kind);else tellRace('Rầm! Thân xe còn '+vitality+'%.');
}
function finishRace(){
 setMode('done');keys.clear();state.v=0;$('pause').hidden=true;$('touch').hidden=true;
 const pos=rank(),total=state.time+penalty,key='taylai.cup.best.'+route.id;
 let best=total;try{const old=Number(localStorage.getItem(key));best=old>0?Math.min(old,total):total;localStorage.setItem(key,String(best));}catch{}
 $('podium').textContent=pos===1?'Quán quân thêm chả!':'Về hạng '+pos+'/4';
 $('result').textContent=route.name+' · '+clockText(total)+' · Kỷ lục '+clockText(best)+' · '+repairs+' lượt vào gara'+(penalty?' · gồm '+penalty+' giây phạt':'')+'.';
 $('finish').showModal();
}
function raceUpdate(dt){
 if(state.mode==='countdown'){
   const before=Math.ceil(countdown);countdown-=dt;
   if(Math.ceil(countdown)!==before)driveAudio.cue(countdown<=0);$('count').textContent=countdown>0?Math.ceil(countdown):'';
   if(countdown<=0){setMode('drive');tellRace('Bánh nóng ra lò!');}return;
 }
 if(state.mode!=='drive')return;
 const s=state;s.time+=dt;grace=Math.max(0,grace-dt);shake=Math.max(0,shake-dt);
 const gas=held('w','arrowup'),brake=held('s','arrowdown',' ');
 const nitro=held('shift')&&boost>1&&!brake;
 boost=clamp(boost+(nitro?-27:held('shift')?0:7)*dt,0,100);
 const accel=(gas?7.7:0)+(nitro?13:0)-(brake?16:0)-.7-.0034*s.v*s.v;
 s.v=clamp(s.v+accel*dt,0,nitro?52:Math.max(38,s.v-.9*dt));
 const steer=Number(held('d','arrowright'))-Number(held('a','arrowleft'));
 s.steer+=(steer-s.steer)*(1-Math.exp(-dt*9));
 const curvature=(heading(s.d+2)-heading(s.d))/2;
 const slide=s.steer*Math.min(9,s.v*.34)-curvature*s.v*s.v*.19;
 lateral+=(slide-lateral)*(1-Math.exp(-dt*4.5));
 s.offset+=lateral*dt;s.d=Math.min(route.finish,s.d+s.v*dt);positionCar();
 if(Math.abs(s.offset)>5.35){
   s.offset=Math.sign(s.offset)*5.12;positionCar();
   const kind=Math.abs(curvature)>.001?'curve':height(s.d+3)<height(s.d)-.04?'downhill':'shoulder';
   collision(kind,Math.max(Math.abs(lateral)*1.8,s.v*.72));if(s.mode!=='drive')return;
 }
 for(const [i,r] of rivals.entries()){
   const curve=Math.abs(heading(r.d+20)-heading(r.d));
   r.v=Math.min(r.pace*(1-.55*curve),r.v+(5.3+i*.34)*dt);
   r.d+=r.v*dt;r.offset=r.lane+.42*Math.sin(r.d/49+i);
   if(r.d>=route.finish)r.finished=true;r.d=Math.min(r.d,route.finish+38+i*6);
   if(Math.abs(r.d-s.d)<3.8&&Math.abs(r.offset-s.offset)<1.65){
     const delta=s.offset-r.offset;s.offset=clamp(r.offset+(delta<0?-1:1)*1.7,-5.12,5.12);positionCar();
     collision('car',Math.max(4,Math.abs(r.v-s.v)+Math.abs(lateral)));
     if(s.mode!=='drive')break;
   }
 }
 placeRivals();if(s.mode!=='drive')return;
 if(s.d>=route.finish){finishRace();return;}
 if(!checkpoint&&s.d>route.finish/2){checkpoint=1;tellRace('Nửa chặng! Pâté vẫn còn nóng.');}
 else if(rank()<lastRank)tellRace('Vượt đẹp! Lên hạng '+rank()+'/4.');
 lastRank=rank();
}
function raceHud(){
 $('speed').textContent=Math.round(state.v*3.6);$('hp').value=vitality;$('nitro').value=boost;
 $('rank').textContent=rank()+'/4';$('time').textContent=clockText(state.time+penalty);
 $('distance').textContent=Math.round(state.d)+' m';$('progress').value=state.d;
 $('callout').textContent=state.mode==='drive'&&state.time<feedbackUntil?message:'';
}
function raceCamera(dt,now){
 const driving=state.mode==='drive',braking=held('s','arrowdown',' ');
 for(const c of animatedCars){
   const v=c.isPlayer?state.v:rivals[2].v,steer=c.isPlayer?state.steer:0;
   if(driving)c.wheels.forEach((wheel,i)=>wheel?.rotateX((i%2?-1:1)*v*dt/.344));
   c.front.forEach(joint=>{if(joint)joint.rotation.y=-steer*.36;});
   if(c.rear)c.rear.emissiveIntensity=c.isPlayer&&braking?4:.68;
   c.model.rotation.z=T.MathUtils.lerp(c.model.rotation.z,steer*Math.min(.033,v*.001),1-Math.exp(-dt*6));
   const station=c.isPlayer?state.d:rivals[2].d;
   c.model.rotation.x=Math.atan(height(station+1)-height(station))+(c.isPlayer&&braking&&v>2?.019:0);
 }
 if(chipTime>0&&state.mode!=='paused'){
   chipTime-=dt;
   for(let i=0;i<positions.length;i+=3){velocities[i+1]-=dt*9;for(let j=0;j<3;j++)positions[i+j]+=dt*velocities[i+j];}
   chips.geometry.attributes.position.needsUpdate=true;chips.visible=chipTime>0;
 }
 if(state.mode==='grid'){
   const portrait=camera.aspect<.85;
   eye.set(portrait?-5.5:-4.0,portrait?1.85:1.42,portrait?8.4:5.18).applyQuaternion(yawQ).add(rig.position);
   look.set(portrait?0:-1.28,.77,-.35).applyQuaternion(yawQ).add(rig.position);
   camera.position.copy(eye);camera.lookAt(look);
 }else if(!inside){
   eye.set(-state.steer*.38,1.85+state.v*.009,6.1+state.v*.021).applyQuaternion(yawQ).add(rig.position);
   const ahead=at(state.d+10,state.offset);look.set(ahead.x,ahead.y+.84,ahead.z);
   camera.position.copy(eye);camera.lookAt(look);
 }
 if(shake>0&&driving)camera.rotateZ(Math.sin(now*.063)*shake*.055);
 const desired=inside?64:state.mode==='grid'?47:57+state.v*.29;
 if(Math.abs(camera.fov-desired)>.05){camera.fov+=(desired-camera.fov)*(1-Math.exp(-dt*5));camera.updateProjectionMatrix();}
}
function pauseRace(){
 if(!['drive','countdown'].includes(state.mode))return;
 resumePhase=state.mode;keys.clear();setMode('paused');$('rest').showModal();
}
$('launch').onclick=startCountdown;$('repair').onclick=repair;$('pause').onclick=pauseRace;
$('resume').onclick=()=>{$('rest').close();keys.clear();setMode(resumePhase);};
$('again').onclick=()=>location.reload();
$('camera').onclick=()=>{if(state.mode!=='grid')inside=!inside;};
$('sound').onclick=()=>{sound=driveAudio.toggle();$('sound').textContent=sound?'Tắt âm':'Bật âm';};
for(const dialog of document.querySelectorAll('dialog'))dialog.oncancel=e=>{e.preventDefault();if(dialog.id==='rest')$('resume').click();};
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(key==='p'&&!e.repeat){if(state.mode==='paused')$('resume').click();else pauseRace();return;}
 if(!['drive','countdown'].includes(state.mode))return;
 if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift',' '].includes(key)){keys.add(key);e.preventDefault();}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',pauseRace);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRace();});
for(const b of document.querySelectorAll('[data-key]')){
 b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);e.preventDefault();};
 b.onlostpointercapture=()=>keys.delete(b.dataset.key);
}
beginRace();
