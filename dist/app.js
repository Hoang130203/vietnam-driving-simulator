'use strict';
const el = id => document.getElementById(id);
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const keys = new Set();
const route = [
  {at:0, questions:[78,44,187], action:'Giữ xe trong làn đang chạy, bên phải vạch tim đường.'},
  {at:13, questions:[362,436,364], action:'Nhìn biển tròn viền đỏ bên phải. Từ vị trí đặt biển, giữ tốc độ từ 40 km/h trở xuống.'},
  {at:66, questions:[198,34,367], action:'Nhả ga và phanh trước vạch. Chờ người đi bộ sang hết và đèn xanh mới đi.'},
  {at:135, questions:[60,57,62], action:'Bật xi nhan phải (E), quan sát, tiến sát lề phải rồi phanh dừng ở đoạn 165–185 m.'}
];
const stages = [...document.querySelectorAll('#stages li')];
let mode='ready', speed=0, distance=0, lateral=2, elapsed=0, steering=0;
let stage=0, rightSignal=false, green=false, wait=0, lastFrame=performance.now();
let quizPoints=0, parked=false, stopped=false, crossingTime=0;
const faults=new Set();
let engine=null;
function toggleSound() {
  if(!engine) {
    const ctx=new AudioContext(), gain=ctx.createGain(), motor=ctx.createOscillator();
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass'; filter.frequency.value=190;
    motor.type='sawtooth'; motor.frequency.value=38;
    motor.connect(filter).connect(gain).connect(ctx.destination);
    gain.gain.value=0;motor.start();
    engine={ctx,gain,motor,enabled:false};
  }
  engine.enabled=!engine.enabled;
  if(engine.enabled) engine.ctx.resume();
  el('audio').setAttribute('aria-pressed',String(engine.enabled));
  el('audio').textContent='Âm thanh '+(engine.enabled?'bật':'tắt');
}
function records(){
  try{const list=JSON.parse(localStorage.getItem('taylai.drives'));return Array.isArray(list)?list.filter(Number.isFinite):[];}catch{return [];}
}
function report(title,body){
  el('rt').textContent=title;el('rb').textContent=body;
  (document.fullscreenElement || document.body).append(el('report'));
  el('report').showModal();
}
function refreshStages(){
  stages.forEach((node,i)=>{node.classList.toggle('current',i===stage-1);node.classList.toggle('done',i<stage-1 || mode==='done');});
}
function pause(){
  keys.clear();
  if(mode!=='driving')return;
  mode='paused';el('start').textContent='Tiếp tục lái';el('hint').textContent='Đang tạm dừng';
}
function checkpoint(){
  const task=route[stage++];
  mode='question';keys.clear();refreshStages();
  el('hint').textContent=task.action;
  const question=task.questions[records().length % task.questions.length];
  openRoadQuestion(question, task.action, correct=>{
    if(correct)quizPoints+=10;
    mode='driving';lastFrame=performance.now();keys.clear();
  });
}
function start(){
  if(mode==='question')return;
  if(mode==='driving')return pause();
  if(!window.renderDrive || window.driveBank?.length!==600) {
    report('Chưa tải đủ dữ liệu','Hãy tải lại trang và kiểm tra WebGL trên trình duyệt.');return;
  }
  if(mode!=='paused'){
    stage=speed=distance=elapsed=wait=steering=quizPoints=crossingTime=0;
    rightSignal=green=parked=stopped=false;lateral=2;faults.clear();
    el('blinkMobile').setAttribute('aria-pressed','false');
  }
  mode='driving';el('start').textContent='Ⅱ  Tạm dừng';
  if(stage===0){el('road').scrollIntoView({block:'center'});checkpoint();}
}
function finish(){
  mode='done';speed=0;keys.clear();refreshStages();
  if(!parked)faults.add('Bật xi nhan, dừng hẳn ở đoạn cuối và đưa bánh phải cách lề tối đa 0,25 m.');
  if(!stopped)faults.add('Dừng trước vạch khi đèn đỏ và nhường người đi bộ.');
  const practice=Math.max(0,60-faults.size*15),score=quizPoints+practice;
  const list=records();list.push(score);
  try{localStorage.setItem('taylai.drives',JSON.stringify(list.slice(-100)));}catch{}
  el('start').textContent='Lái lại tuyến';el('hint').textContent='Đã kết thúc · '+score+'/100';
  report('Kết quả · '+score+'/100','Nhận diện tình huống: '+quizPoints+'/40\nThao tác lái: '+practice+'/60\n\n'+(faults.size?'Luyện lại\n'+[...faults].join('\n'):'Bạn đã xử lý đúng cả bốn tình huống trên tuyến.'));
}
function signal(){
  if(mode!=='driving')return;
  rightSignal=!rightSignal;el('blinkMobile').setAttribute('aria-pressed',String(rightSignal));
}
function drive(dt){
  const down=(...codes)=>codes.some(code=>keys.has(code));
  const brake=down('s','arrowdown',' '),gas=down('w','arrowup');
  speed=clamp(speed+dt*(brake?-22:gas?9-speed*.055:-1.9-speed*.02),0,68);
  const target=Number(down('d','arrowright'))-Number(down('a','arrowleft'));
  steering+=(target-steering)*Math.min(1,dt*7);
  const oldX=lateral;
  lateral=clamp(lateral+steering*Math.min(speed*.14,2.9)*dt,-7,7.04);
  const before=distance;distance+=speed/3.6*dt;
  if(lateral<.9)faults.add('Giữ toàn bộ xe bên phải vạch tim đường.');
  if(distance>=25 && speed>40.05)faults.add('Tuân thủ giới hạn 40 km/h từ vị trí đặt biển.');
  if(oldX<=4 && lateral>4 && !rightSignal)faults.add('Bật tín hiệu trước khi chuyển sang làn phải.');
  if(distance>=76 && distance<90 && speed<.1)stopped=true;
  if(stopped || distance>=90)wait+=dt;
  if(distance>=65)crossingTime+=dt;
  green=wait>=3.5 && crossingTime>=10.6;
  if(before<90 && distance>=90 && !green)faults.add('Dừng trước vạch khi đèn đỏ và nhường người đi bộ.');
  if(stage<route.length && distance>=route[stage].at){checkpoint();return;}
  const curbGap=Math.max(0,8-lateral-.98);
  parked=distance>=165 && distance<=185 && speed===0 && rightSignal && curbGap<=.25;
  if(parked || distance>185){finish();return;}
  const remain=Math.ceil(90-distance);
  let hint='Giữ làn bên phải · nhấn ↑ để tăng ga';
  if(stage>=2)hint='Biển giới hạn 40 km/h · giữ đều ga';
  if(stage===3)hint=green?'Đèn xanh · quan sát trước khi qua vạch':stopped?'Giữ phanh · chờ đèn xanh':'Đèn đỏ · vạch dừng cách '+Math.max(0,remain)+' m';
  if(stage===4)hint=(rightSignal?'Xi nhan phải bật':'Bật xi nhan phải (E)')+' · cách lề '+curbGap.toFixed(2)+' m · '+(distance<165?'đến vùng dừng '+Math.ceil(165-distance)+' m':'phanh dừng sát lề');
  if(speed>40.05 && distance>=25)hint='Quá 40 km/h · nhả ga và giảm tốc';
  if(lateral<.9)hint='Xe đang lấn sang chiều ngược lại';
  el('hint').textContent=hint;
}
const map=el('map').getContext('2d');
function drawMap(){
  map.fillStyle='#243b32';map.fillRect(0,0,132,90);
  map.strokeStyle='#516256';map.lineWidth=5;
  for(let x=-8;x<145;x+=27){map.beginPath();map.moveTo(x,0);map.lineTo(x+10,90);map.stroke();}
  for(let y=12;y<100;y+=24){map.beginPath();map.moveTo(0,y);map.lineTo(132,y-6);map.stroke();}
  map.strokeStyle='#c8e97a';map.lineWidth=3;map.beginPath();map.moveTo(68,79);map.lineTo(61,9);map.stroke();
  const ratio=clamp(distance/180,0,1),y=79-ratio*70,x=68-ratio*7;
  map.fillStyle='white';map.beginPath();map.moveTo(x,y-6);map.lineTo(x+5,y+5);map.lineTo(x-5,y+5);map.fill();
  el('remaining').textContent=Math.max(0,Math.ceil(180-distance))+' m đến đích';
}
function frame(now){
  const dt=clamp((now-lastFrame)/1000,0,.1);lastFrame=now;
  if(mode==='driving' || mode==='ready')elapsed+=dt;
  if(mode==='driving')drive(dt);
  window.renderDrive?.(distance,lateral,elapsed,green,steering,speed);
  el('speed').textContent=String(Math.round(speed)).padStart(2,'0');
  if(engine){
    engine.gain.gain.setTargetAtTime((engine.enabled && mode==='driving') ? .025 : 0,engine.ctx.currentTime,.12);
    engine.motor.frequency.setTargetAtTime(30+speed*.85,engine.ctx.currentTime,.1);
  }
  el('fullStart').textContent=el('start').textContent;
  drawMap();requestAnimationFrame(frame);
}
function camera(){if(window.toggleDriveCamera)el('camera').textContent=toggleDriveCamera()?'Góc tài xế':'Góc sau xe';}
el('camera').onclick=camera;el('audio').onclick=toggleSound;el('blinkMobile').onclick=signal;el('start').onclick=el('fullStart').onclick=start;
el('theory').onclick=el('lesson').onclick=()=>{pause();openQuiz();};
el('driveNav').onclick=()=>el('road').scrollIntoView({block:'center',behavior:'smooth'});
el('history').onclick=()=>{pause();const list=records();report('Thành tích bài lái',list.length?list.length+' lượt · Cao nhất '+Math.max(...list)+'/100 · Gần nhất '+list.at(-1)+'/100':'Hoàn thành tuyến phố để lưu điểm đầu tiên.');};
el('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await el('road').parentElement.requestFullscreen();}catch{el('hint').textContent='Trình duyệt chưa hỗ trợ chế độ toàn màn hình.';}};
addEventListener('blur',pause);
addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  const k=e.key.toLowerCase();
  if(!e.repeat){if(k==='p'&&['driving','paused'].includes(mode))start();if(k==='c')camera();if(k==='e')signal();}
  if(mode==='driving'&&['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)){e.preventDefault();keys.add(k);}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll('[data-key]').forEach(b=>{
  b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};
  b.onlostpointercapture=()=>keys.delete(b.dataset.key);
});
requestAnimationFrame(frame);
