'use strict';
const el = id => document.getElementById(id);
const keys = new Set();
let mode = 'ready', speed = 0, distance = 0, lateral = 2, elapsed = 0;
let signalWait = 0, green = false, lastFrame = performance.now();
const faults = new Set();
function records() {
  try { return JSON.parse(localStorage.getItem('taylai.drives') || '[]'); }
  catch { return []; }
}
function report(title, body) {
  el('rt').textContent = title;
  el('rb').textContent = body;
  el('report').showModal();
}
function pause() {
  keys.clear();
  if (mode !== 'driving') return;
  mode = 'paused';
  el('start').textContent = '▶  Tiếp tục lái';
  el('hint').textContent = 'Đang tạm dừng';
}
function start() {
  if (mode === 'driving') return pause();
  if (mode !== 'paused') {
    distance = speed = elapsed = signalWait = 0;
    green = false;
    lateral = 2;
    faults.clear();
  }
  mode = 'driving';
  el('start').textContent = 'Ⅱ  Tạm dừng';
}
function finish() {
  mode = 'done';
  keys.clear();
  speed = 0;
  const score = 100 - faults.size * 25;
  const list = records();
  list.push(score);
  try { localStorage.setItem('taylai.drives', JSON.stringify(list.slice(-100))); } catch {}
  el('start').textContent = '↻  Lái lại';
  el('hint').textContent = 'Đã về đích · ' + score + '/100';
  report('Kết quả bài lái · ' + score + '/100', faults.size ? 'Cần luyện lại: ' + [...faults].join(', ') + '.' : 'Bạn đã giữ đúng phần đường, tốc độ và chấp hành đèn tín hiệu.');
}
function drive(dt) {
  const down = (...codes) => codes.some(code => keys.has(code));
  const brake = down('s','arrowdown',' ');
  const gas = down('w','arrowup');
  speed = Math.max(0,Math.min(65,speed + dt * (brake ? -24 : gas ? 9 : -2)));
  lateral += (Number(down('d','arrowright')) - Number(down('a','arrowleft'))) * Math.min(speed / 8, 2.5) * dt;
  lateral = Math.max(-3.8,Math.min(3.8,lateral));
  const previous = distance;
  distance += speed / 3.6 * dt;
  if (distance >= 65) signalWait += dt;
  green = signalWait >= 12;
  if (previous < 90 && distance >= 90 && !green) faults.add('dừng trước vạch khi đèn đỏ');
  if (speed > 40.5) faults.add('giữ tốc độ dưới giới hạn');
  if (lateral < 0.85) faults.add('giữ xe trong phần đường bên phải');
  el('hint').textContent = lateral < 0.85 ? 'Đưa xe về bên phải' : speed > 40.5 ? 'Quá tốc độ · hãy giảm ga' : distance >= 90 ? 'Tiếp tục đến đích · ' + Math.ceil(180-distance) + ' m' : green ? 'Đèn xanh · quan sát rồi đi tiếp' : distance > 48 ? 'Đèn đỏ · vạch dừng cách ' + Math.ceil(90-distance) + ' m' : 'Giữ phím ↑ để tăng ga · giới hạn 40 km/h';
  if (distance >= 180) finish();
}
const map = el('map').getContext('2d');
function drawMap() {
  map.fillStyle='#283435'; map.fillRect(0,0,132,90);
  map.strokeStyle='#435053'; map.lineWidth=5;
  for(let x=-8;x<145;x+=27){map.beginPath();map.moveTo(x,0);map.lineTo(x+10,90);map.stroke();}
  for(let y=12;y<100;y+=24){map.beginPath();map.moveTo(0,y);map.lineTo(132,y-6);map.stroke();}
  map.strokeStyle='#ffa359';map.lineWidth=3;map.beginPath();map.moveTo(68,79);map.lineTo(61,9);map.stroke();
  const y=79-distance/180*70,x=68-distance/180*7;map.fillStyle='white';map.beginPath();map.moveTo(x,y-6);map.lineTo(x+5,y+5);map.lineTo(x-5,y+5);map.fill();
}
function frame(now) {
  const dt=Math.min(.08,(now-lastFrame)/1000); lastFrame=now;
  if(mode!=='paused') elapsed+=dt;
  if(mode==='driving') drive(dt);
  window.renderDrive?.(distance,lateral,elapsed,green);
  el('speed').textContent=String(Math.round(speed)).padStart(2,'0');
  drawMap(); requestAnimationFrame(frame);
}
el('start').onclick=start;
el('lesson').onclick=el('theory').onclick=()=>{pause();openQuiz();};
el('driveNav').onclick=()=>el('road').scrollIntoView({block:'center',behavior:'smooth'});
el('history').onclick=()=>{pause();const list=records();report('Thành tích bài lái',list.length ? list.length+' lượt đã lưu · Cao nhất '+Math.max(...list)+'/100 · Lượt gần nhất '+list.at(-1)+'/100' : 'Hoàn thành bài Qua giao lộ để lưu điểm đầu tiên.');};
el('full').onclick=()=>document.fullscreenElement ? document.exitFullscreen() : el('road').parentElement.requestFullscreen();
addEventListener('blur',pause);
addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')) return;
  const k=e.key.toLowerCase();
  if(k==='p'&&!e.repeat && ['driving','paused'].includes(mode)) start();
  if(mode==='driving' && ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)){e.preventDefault();keys.add(k);}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll('[data-key]').forEach(b=>{
  b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};
  b.onlostpointercapture=()=>keys.delete(b.dataset.key);
});
requestAnimationFrame(frame);
