/* Original, locally synthesized pentatonic music. No network audio service. */
window.MaruMusic = function ({enabled = true} = {}) {
  let context, master, timer, nextBeat = 0, step = 0, speaking = false, active = true;
  const beat = 60 / 96;
  const melody = [72,null,76,79,81,79,76,null,74,null,77,81,84,81,77,null,
    76,79,84,null,83,79,76,null,74,77,81,79,76,74,72,null,
    79,null,81,84,88,84,81,null,77,81,84,null,86,84,81,null,
    76,79,84,79,81,79,76,null,74,77,79,76,74,null,72,null];
  const chords = [[48,55,60],[53,60,65],[45,52,57],[55,62,67]];
  const frequency = note => 440 * Math.pow(2, (note - 69) / 12);
  function gain() {
    if (!master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(enabled && active ? (speaking ? .012 : .18) : 0, now, speaking || !enabled ? .035 : .35);
  }
  function tone(note, time, duration, level, type = 'sine') {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency(note);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(master);
    oscillator.start(time); oscillator.stop(time + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function schedule() {
    if (!context || context.state !== 'running') return;
    if (nextBeat < context.currentTime - beat) nextBeat = context.currentTime + .04;
    while (nextBeat < context.currentTime + .18) {
      if (enabled && active) {
        const note = melody[step % melody.length], chord = chords[Math.floor(step / 8) % 4];
        if (note !== null) { tone(note, nextBeat, .68, .24); tone(note + 12, nextBeat, .3, .035); }
        if (step % 4 === 0) {
          tone(chord[0] - 12, nextBeat, beat * 3.8, .14);
          chord.forEach((n, i) => tone(n, nextBeat + i * .065, beat * 3.5, .055, 'triangle'));
        }
      }
      step++; nextBeat += beat;
    }
  }
  async function unlock() {
    if (!enabled || !active) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) { context = new AudioContext(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination); nextBeat = context.currentTime + .05; }
      if (context.state === 'suspended') await context.resume();
      gain(); schedule(); if (!timer) timer = setInterval(schedule, 80);
    } catch { /* Browser autoplay policy: the next user gesture can retry. */ }
  }
  return {
    unlock,
    setEnabled(value) { enabled = value; gain(); if (enabled) unlock(); },
    setSpeaking(value) { speaking = value; gain(); },
    setActive(value) { active = value; gain(); if (!value) { clearInterval(timer); timer = null; context?.suspend().catch(() => {}); } else unlock(); }
  };
};
