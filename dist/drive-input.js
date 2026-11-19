'use strict';
// Keyboard and individual contacts own their input independently on hybrid devices.
function createDriveInput() {
  const keyboard = new Set(), contacts = new Map(), active = new Set();
  function release(id) {
    const button = contacts.get(id);
    if (!button) return;
    contacts.delete(id);
    if (![...contacts.values()].some(other => other.dataset.key === button.dataset.key)) {
      active.delete(button.dataset.key);
      button.classList.remove('active');
    }
  }
  function clear() {
    keyboard.clear();
    for (const id of contacts.keys()) release(id);
  }
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      contacts.set(event.pointerId, button);
      active.add(button.dataset.key);
      button.classList.add('active');
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => release(event.pointerId));
    }
    button.addEventListener('contextmenu', event => event.preventDefault());
  }
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  return {has: key => keyboard.has(key) || active.has(key), add: key => keyboard.add(key), delete: key => keyboard.delete(key), clear};
}
