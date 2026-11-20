'use strict';

// Rendering budgets are independent of the simulation clock and CSS layout.
function createDrivingGraphics(renderer, camera, sun) {
  const profiles = [
    {id:'low', dpr:.9, pixels:900000, shadow:512, shadowMs:180, mirrorMs:170, waterWidth:0, waterMs:0, scenery:360, cars:2},
    {id:'medium', dpr:1.25, pixels:1800000, shadow:1024, shadowMs:100, mirrorMs:120, waterWidth:256, waterMs:260, scenery:480, cars:3},
    {id:'high', dpr:1.65, pixels:3600000, shadow:2048, shadowMs:60, mirrorMs:90, waterWidth:480, waterMs:130, scenery:620, cars:5}
  ];
  const cores = navigator.hardwareConcurrency, memory = navigator.deviceMemory;
  const initial = cores <= 4 || memory <= 4 ? 0 : cores >= 8 && memory >= 8 ? 2 : 1;
  let level = initial, preference, previous = null, duration = 0, frames = 0, slow = 0, fast = 0, recoverAfter = 12;
  let width = 0, height = 0, ratio = 0;
  const canvas = renderer.domElement;

  function resetSamples() {
    previous = null;
    duration = frames = slow = fast = 0;
  }
  function choose() {
    const selected = document.body.dataset.graphics || 'auto';
    if (preference === selected) return;
    preference = selected;
    const fixed = profiles.findIndex(profile => profile.id === selected);
    level = fixed < 0 ? initial : fixed;
    recoverAfter = 12;
    resetSamples();
  }
  function sample(now, playing) {
    if (!playing || document.hidden || preference !== 'auto') {
      if (previous !== null) resetSamples();
      return;
    }
    const delta = previous === null ? 0 : now - previous;
    previous = now;
    if (delta <= 0) return;
    // Bound the influence of a single tile load or shader compilation.
    duration += Math.min(delta, 100);
    frames++;
    if (duration < 1000) return;
    const average = duration / frames;
    slow = average > 23 ? slow + 1 : 0;
    fast = average < 18.5 ? fast + 1 : 0;
    duration = frames = 0;
    if (slow >= 2 && level > 0) {
      level--;
      recoverAfter = 45;
      resetSamples();
    } else if (fast >= recoverAfter && level < profiles.length - 1) {
      level++;
      resetSamples();
    }
  }
  function resize() {
    const profile = profiles[level], w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const scale = Math.min(window.devicePixelRatio || 1, profile.dpr, Math.sqrt(profile.pixels / (w * h)));
    if (w !== width || h !== height || scale !== ratio) {
      renderer.setDrawingBufferSize(w, h, scale);
      if (w !== width || h !== height) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      width = w; height = h; ratio = scale;
    }
    if (sun && sun.shadow.mapSize.x !== profile.shadow) {
      sun.shadow.mapSize.setScalar(profile.shadow);
      sun.shadow.map?.setSize(profile.shadow, profile.shadow);
      renderer.shadowMap.needsUpdate = true;
    }
  }
  function frame(now, playing) {
    choose();
    sample(now, playing);
    resize();
  }
  choose();
  document.addEventListener('visibilitychange', resetSamples);
  return {frame, resize, get profile() { return profiles[level]; }};
}
