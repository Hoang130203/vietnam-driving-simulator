/* Unlock the engine mix on a browser-authorized user gesture. */
(() => {
  'use strict';
  let sound;
  const preference='taylai.audio.muted';
  let enabled = true;
  try { enabled=localStorage.getItem(preference)!=='1'; } catch {}
  let nextTick = 0;
  let lowTick = false;

  function makeCabin(ctx) {
    const output = ctx.createGain();
    output.gain.value = 0;
    output.connect(ctx.destination);

    const engine = ctx.createOscillator();
    // An uneven four-cylinder exhaust pulse, muffled by the cabin.
    engine.setPeriodicWave(ctx.createPeriodicWave(
      new Float32Array(9),
      Float32Array.of(0, .8, .54, .28, .09, .15, .05, .04, .025)
    ));
    const intake = ctx.createBiquadFilter();
    intake.type = 'lowpass';
    intake.Q.value = .58;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(intake).connect(engineGain).connect(output);
    engine.start();

    const road = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.8), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let roughness = 0;
    for (let i = 0; i < data.length; i++) {
      roughness = .82 * roughness + .18 * (Math.random() * 2 - 1);
      data[i] = roughness;
    }
    road.buffer = buffer;
    road.loop = true;
    const tire = ctx.createBiquadFilter();
    tire.type = 'bandpass';
    tire.Q.value = .6;
    const roadGain = ctx.createGain();
    roadGain.gain.value = 0;
    road.connect(tire).connect(roadGain).connect(output);
    road.start();

    return { ctx, output, engine, engineGain, intake, roadGain, tire };
  }

  function tone(frequency, endFrequency, length, volume, offset = 0, shape = 'sine') {
    if (!enabled || sound?.ctx.state !== 'running') return;
    const { ctx, output } = sound;
    const start = ctx.currentTime + offset;
    const source = ctx.createOscillator();
    const envelope = ctx.createGain();
    source.type = shape;
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
    envelope.gain.setValueAtTime(.00001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + .004);
    envelope.gain.exponentialRampToValueAtTime(.00001, start + length);
    source.connect(envelope).connect(output);
    source.start(start);
    source.stop(start + length + .01);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
  }

  function unlock() {
    if(!enabled)return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    try {
      if (!sound || sound.ctx.state === 'closed') sound = makeCabin(new Audio());
      const { ctx, output } = sound;
      if (enabled && ctx.state !== 'running') ctx.resume().catch(() => {});
      output.gain.setTargetAtTime(enabled ? .55 : 0, ctx.currentTime, .045);
    } catch {}
  }
  function toggle() {
    enabled=!enabled;
    try{localStorage.setItem(preference,enabled?'0':'1');}catch{}
    if(enabled)unlock();else if(sound)sound.output.gain.setTargetAtTime(0,sound.ctx.currentTime,.025);
    return enabled;
  }
  for(const event of ['pointerdown','keydown','click'])window.addEventListener(event,()=>{
    if(enabled&&sound?.ctx.state!=='running')unlock();
  },{capture:true});

  function update({ speed, throttle, braking, signal, mode }) {
    if (!enabled || sound?.ctx.state !== 'running') return;
    const { ctx, engine, engineGain, intake, roadGain, tire } = sound;
    const now = ctx.currentTime;
    const driving = mode === 'driving';
    const velocity = Math.max(0, Math.min(190, speed || 0));
    const load = driving && throttle && !braking ? 1 : 0;
    const kmhPerThousandRpm = velocity < 19 ? 8.4 : velocity < 37 ? 14 : velocity < 58 ? 22 : 30;
    const rpm = Math.max(760, velocity / kmhPerThousandRpm * 1000) + load * 260;
    engine.frequency.setTargetAtTime(rpm / 30 + Math.sin(now * 6.8) * .26, now, .12);
    intake.frequency.setTargetAtTime(145 + rpm * .067 + load * 145, now, .12);
    engineGain.gain.setTargetAtTime(driving ? .068 + load * .038 : mode==='idling' ? .038 : 0, now, .14);
    tire.frequency.setTargetAtTime(260 + velocity * 8, now, .16);
    roadGain.gain.setTargetAtTime(driving ? velocity / 170 + (braking ? velocity / 340 : 0) : 0, now, .16);
    if (!driving || !signal) {
      nextTick = 0;
      lowTick = false;
    } else if (now >= nextTick) {
      tone(lowTick ? 660 : 830, 260, .023, .085, 0, 'triangle');
      lowTick = !lowTick;
      nextTick = now + .43;
    }
  }

  function cue(correct) {
    if (correct) {
      tone(622, 622, .095, .078);
      tone(831, 831, .15, .06, .075);
    } else {
      tone(330, 294, .18, .072);
    }
  }
  function impact(strength,type) {
    if (!enabled || sound?.ctx.state !== 'running') return;
    tone(94,28,.24,.20+strength*.28);
    if(type==='person')return;
    const {ctx,output}=sound, source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    const duration=.12+strength*.28;
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-5*i/samples.length);
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=type==='curb'?480:1500;filter.Q.value=.65;
    gain.gain.value=.4+strength*.45;source.connect(filter).connect(gain).connect(output);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  window.driveAudio = { toggle, update, cue, impact, get enabled(){return enabled;} };
})();
