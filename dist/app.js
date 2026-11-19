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
const decisions = [];
let continuous = false;
let routeQuestions = [];
const landmarks = [
  [2, .1, 14, 'Giữ làn'],
  [7.8, 2.4, 25, 'Biển tốc độ'],
  [3.5, .05, 91, 'Vạch dừng'],
  [6.9, .1, 176, 'Vùng dừng xe']
];
let toastUntil = 0, toastText = '';
function noteFault(message) {
  if (faults.has(message)) return;
  faults.add(message);
  toastText = message;
  toastUntil = elapsed + 3;
}
function toggleSound() {
  const enabled = driveAudio.toggle();
  el('audio').setAttribute('aria-pressed', String(enabled));
  el('audio').textContent = enabled ? 'Âm thanh bật' : 'Âm thanh tắt';
}
function label(node,text){if(node.textContent!==text)node.textContent=text;}
function roadMarker(){
  const marker = el('target');
  const target = landmarks[stage-1];
  if (!target || !['question','driving'].includes(mode) || target[2]<distance+1) {
    marker.hidden = true;return;
  }
  const point = window.projectDriveTarget?.(...target.slice(0,3));
  marker.hidden = !point?.visible || point.x<.1 || point.x>.9 || point.y<.18 || point.y>.85;
  if (marker.hidden) return;
  marker.style.left=(point.x*100)+'%';marker.style.top=(point.y*100)+'%';
  label(marker.firstElementChild,target[3]+' · '+Math.round(target[2]-distance)+' m');
}
function records(){
  try{const list=JSON.parse(localStorage.getItem('taylai.drives'));return Array.isArray(list)?list.filter(Number.isFinite):[];}catch{return [];}
}
function report(title,body){
  el('reviewDrive').hidden=true;
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
  refreshStages();
  const question=task.questions[records().length % task.questions.length];
  routeQuestions.push(question);
  if(continuous){
    el('askCoach').hidden=false;
    toastText=task.action;toastUntil=elapsed+3;
    return;
  }
  consult();
}
function consult(){
  const task=route[stage-1], question=routeQuestions[stage-1];
  if (!task || mode!=='driving') return;
  mode='question';keys.clear();
  el('hint').textContent='Quan sát · '+stages[stage-1].querySelector('b').textContent;
  el('askCoach').hidden=true;
  openRoadQuestion(question, task.action, correct=>{
    if(correct)quizPoints+=10;
    decisions.push({question,correct});
    toastText=task.action;toastUntil=elapsed+2.5;
    if (!document.fullscreenElement && matchMedia('(max-width:820px)').matches) el('road').scrollIntoView({block:'center'});
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
    continuous=document.querySelector('#lessonMode input:checked').value==='flow';
    el('lessonMode').disabled=true;
    routeQuestions=[];decisions.length=0;toastUntil=0;rightSignal=green=parked=stopped=false;lateral=2;faults.clear();
    el('blinkMobile').setAttribute('aria-pressed','false');
  }
  mode='driving';el('start').textContent='Ⅱ  Tạm dừng';
  if(stage===0){el('road').scrollIntoView({block:'center'});checkpoint();}
}
function finish(){
  mode='done';speed=0;keys.clear();refreshStages();
  if(!parked)faults.add('Bật xi nhan, dừng hẳn ở đoạn cuối và đưa bánh phải cách lề tối đa 0,25 m.');
  if(!stopped)faults.add('Dừng trước vạch khi đèn đỏ và nhường người đi bộ.');
  const practice=Math.max(0,60-faults.size*15);
  const score=continuous?Math.round(practice/60*100):quizPoints+practice;
  el('lessonMode').disabled=false;el('askCoach').hidden=true;
  const list=records();list.push(score);
  try{localStorage.setItem('taylai.drives',JSON.stringify(list.slice(-100)));}catch{}
  el('start').textContent='Lái lại tuyến';el('hint').textContent='Đã kết thúc · '+score+'/100';
  const answers=decisions.map(d=>(d.correct?'✓ ':'× ')+stages[routeQuestions.indexOf(d.question)].querySelector('b').textContent+' · câu '+d.question).join('\n');
  const theory=continuous?'Lái liên tục · chấm theo thao tác'+(answers?'\nĐã ôn trên đường\n'+answers:''):'Nhận diện tình huống · '+quizPoints+'/40\n'+answers;
  report('Kết quả · '+score+'/100',theory+'\n\nThao tác lái · '+practice+'/60\n'+(faults.size?'Luyện lại\n'+[...faults].join('\n'):'Bạn đã xử lý đúng cả bốn tình huống trên tuyến.'));
  el('reviewDrive').hidden=false;
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
  if(lateral<.9)noteFault('Giữ toàn bộ xe bên phải vạch tim đường.');
  if(distance>=25 && speed>40.05)noteFault('Tuân thủ giới hạn 40 km/h từ vị trí đặt biển.');
  if(oldX<=4 && lateral>4 && !rightSignal)noteFault('Bật tín hiệu trước khi chuyển sang làn phải.');
  if(distance>=76 && distance<90 && speed<.1)stopped=true;
  if(stopped || distance>=90)wait+=dt;
  if(distance>=65)crossingTime+=dt;
  green=wait>=3.5 && crossingTime>=10.6;
  if(before<90 && distance>=90 && !green)noteFault('Dừng trước vạch khi đèn đỏ và nhường người đi bộ.');
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
  label(el('hint'), toastUntil>elapsed ? toastText : hint);
}
const map=el('map').getContext('2d');
let lastMapState='';
function drawMap(){
  const position=Math.min(180,Math.round(distance));
  const lane=Math.round(lateral);
  const state=position+'/'+lane+'/'+stage;
  if(state===lastMapState)return;
  lastMapState=state;
  map.fillStyle='#20332b';map.fillRect(0,0,132,90);
  map.fillStyle='#31453a';
  for(let x=4;x<125;x+=24){
    for(let y=3;y<86;y+=16)map.fillRect(x,y,19,11);
  }
  // Same northbound road, junction and right-hand parking bay as the 3D route.
  map.fillStyle='#58665d';map.fillRect(49,0,19,90);map.fillRect(0,38,132,7);
  map.fillStyle='#899d86';map.fillRect(67,8,4,10);
  map.strokeStyle='#c8e97a';map.lineWidth=2.5;
  map.beginPath();map.moveTo(61,82);map.lineTo(61,26);map.lineTo(66,11);map.stroke();
  const x=58+lane, y=82-position/180*71;
  map.fillStyle='#fff';map.beginPath();map.moveTo(x,y-6);map.lineTo(x+4.7,y+4.5);map.lineTo(x,y+2.5);map.lineTo(x-4.7,y+4.5);map.fill();
  label(el('remaining'),(180-position)+' m đến đích');
  el('travel').value=position;
  label(el('metres'),position+' / 180 m');
}
function frame(now){
  const dt=clamp((now-lastFrame)/1000,0,.1);lastFrame=now;
  if(mode==='driving' || mode==='ready')elapsed+=dt;
  if(mode==='driving')drive(dt);
  if(document.body.dataset.mode!==mode){
    document.body.dataset.mode=mode;
    for(const id of ['theory','lesson','history','fullStart'])el(id).disabled=mode==='question';
  }
  window.renderDrive?.(distance,lateral,elapsed,green,steering,speed,mode);
  roadMarker();
  el('turn').hidden=!rightSignal || mode==='done';
  label(el('speed'),String(Math.round(speed)).padStart(2,'0'));
  driveAudio.update({speed,throttle:keys.has('arrowup')||keys.has('w'),braking:keys.has('arrowdown')||keys.has('s')||keys.has(' '),signal:rightSignal,mode});
  label(el('fullStart'),el('start').textContent);
  drawMap();requestAnimationFrame(frame);
}
function camera(){if(window.toggleDriveCamera)el('camera').textContent=toggleDriveCamera()?'Góc tài xế':'Góc sau xe';}
el('reviewDrive').onclick=()=>{el('report').close();openRouteReview(routeQuestions);};
el('askCoach').onclick=consult;
el('camera').onclick=camera;el('audio').onclick=toggleSound;el('blinkMobile').onclick=signal;el('start').onclick=el('fullStart').onclick=el('mobileStart').onclick=start;
el('theory').onclick=el('lesson').onclick=()=>{pause();openQuiz();};
el('driveNav').onclick=()=>el('road').scrollIntoView({block:'center',behavior:'smooth'});
el('history').onclick=()=>{if(mode==='question')return;pause();const list=records();report('Thành tích bài lái',list.length?list.length+' lượt · Cao nhất '+Math.max(...list)+'/100 · Gần nhất '+list.at(-1)+'/100':'Hoàn thành tuyến phố để lưu điểm đầu tiên.');};
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
