(() => {
  const $ = id => document.getElementById(id);
  // Explicit state variables control every transition.
  let doorOpen = false, foodInside = false, heating = false;
  let power = 'high', remainingSeconds = 0, paused = false;
  let timer = null, deadline = 0, audioContext;
  let lastStopTap = null;
  const doubleTapWindow = 400;
  const format = seconds => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  function settings() {
    const minutes = Number($('minutes').value), seconds = Number($('seconds').value);
    if ($('minutes').value === '' || $('seconds').value === '' || !Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || minutes > 99 || seconds < 0 || seconds > 59) return null;
    return minutes * 60 + seconds;
  }
  function render(message) {
    $('chamber').classList.toggle('open', doorOpen);
    $('chamber').classList.toggle('heating', heating);
    $('doorLabel').textContent = heating ? 'Door locked' : doorOpen ? 'Door open' : 'Door closed · unlocked';
    $('food').hidden = !foodInside;
    $('activity').textContent = heating ? `Heating · ${power} power` : foodInside ? 'Food inside' : 'Empty';
    $('clock').textContent = format(remainingSeconds);
    if (message) $('status').textContent = message;
    $('open').disabled = doorOpen || heating;
    $('open').textContent = heating ? 'Open Door (locked)' : 'Open Door';
    $('close').disabled = !doorOpen;
    $('foodButton').disabled = !doorOpen;
    $('foodButton').textContent = foodInside ? 'Remove food' : 'Place food';
    $('start').disabled = doorOpen || !foodInside || heating;
    // Keep Stop available after pausing so a second tap can reset settings.
    $('stop').disabled = false;
    $('powerFields').disabled = heating;
    $('timeFields').disabled = heating;
  }
  function pause() {
    if (heating) remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    heating = false; paused = true;
    clearInterval(timer); timer = null;
  }
  function beep() {
    if (!audioContext) return;
    try {
      for (let i = 0; i < 3; i++) {
        const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
        const time = audioContext.currentTime + i * .3;
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(.12, time + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .18);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.start(time); oscillator.stop(time + .2);
      }
    } catch (_) { /* Visual completion still works if audio is unavailable. */ }
  }
  function tick() {
    remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remainingSeconds === 0) {
      clearInterval(timer); timer = null; heating = false; paused = false;
      render('Heating complete.'); beep();
    } else render();
  }
  $('open').addEventListener('click', () => {
    // Guard the transition as well as disabling the control.
    if (heating || doorOpen) return;
    doorOpen = true; $('error').textContent = '';
    render(paused ? 'Door open. Close the door, then press Start to resume.' : 'Door open. Place or remove food.');
  });
  $('close').addEventListener('click', () => {
    doorOpen = false;
    render(foodInside ? paused ? 'Door securely closed. Press Start to resume the remaining time.' : 'Door closed. Set power and time, then press Start.' : 'Door closed. Open the door to place food inside.');
  });
  $('foodButton').addEventListener('click', () => {
    if (!doorOpen || heating) return;
    foodInside = !foodInside;
    paused = false; remainingSeconds = 0;
    render(foodInside ? 'Food placed. Close the door.' : 'Food removed.');
  });
  document.querySelectorAll('input[name="power"]').forEach(input => input.addEventListener('change', () => {power = input.value; render(`Power set to ${power}.`);}));
  ['minutes','seconds'].forEach(id => $(id).addEventListener('input', () => {
    paused = false; remainingSeconds = settings() ?? 0;
    $('error').textContent = '';
    render('Time changed. Press Start when ready.');
  }));
  $('start').addEventListener('click', () => {
    lastStopTap = null;
    if (doorOpen || !foodInside || heating) return;
    const duration = paused ? remainingSeconds : settings();
    if (duration === null || duration <= 0) {
      $('error').textContent = 'Enter 0–99 minutes and 0–59 seconds, with a total above zero.'; return;
    }
    // Initialize sound during a user gesture to satisfy browser audio rules.
    try {const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) {audioContext ||= new Audio(); audioContext.resume().catch(() => {});}} catch (_) {}
    $('error').textContent = ''; remainingSeconds = duration;
    heating = true; paused = false; deadline = Date.now() + duration * 1000;
    render(`Heating at ${power} power. Door locked; press Stop to unlock.`);
    timer = setInterval(tick, 100);
  });
  $('stop').addEventListener('click', () => {
    const now = Date.now();
    if (lastStopTap !== null && now - lastStopTap <= doubleTapWindow) {
      clearInterval(timer); timer = null;
      heating = false; paused = false; remainingSeconds = 0; deadline = 0;
      power = 'high'; lastStopTap = null;
      $('minutes').value = '0'; $('seconds').value = '0';
      document.querySelectorAll('input[name="power"]').forEach(input => { input.checked = input.value === power; });
      $('error').textContent = '';
      render('Timer cleared. Power reset to High. Door unlocked.');
      return;
    }
    lastStopTap = now;
    if (heating) {
      pause();
      render('Heating paused. Door unlocked. Tap Stop again to reset, or press Start to resume.');
    }
  });
  render();
})();
