/* Co-op Brothers: the game's own sounds, built on Kit.sound.tone / hiss (no audio files). Exposes CB.sfx. */
(function () {
  'use strict';
  const CB = (window.CB = window.CB || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  const notes = (fs, o) => fs.forEach((f, i) => tone(Object.assign({ f, at: i * (o.step || 0.07) }, o)));

  CB.sfx = {
    jump(who) {
      const k = who === 'tommy' ? 1.25 : 1;
      tone({ type: 'square', f: 280 * k, to: 640 * k, dur: 0.14, vol: 0.045, lp: 2400 });
      hiss({ f: 1200, to: 3200, dur: 0.12, vol: 0.04, q: 0.7 });
    },
    land() { tone({ f: 150, to: 60, dur: 0.09, vol: 0.16 }); },
    bonk() { S.bump(); },
    gem(n) { S.coin(n); },
    // a big soft "sploosh" and a cartoon boing: never scary
    splash() {
      hiss({ filter: 'lowpass', f: 2600, to: 280, dur: 0.5, vol: 0.32 });
      tone({ f: 720, to: 150, dur: 0.3, vol: 0.16 });
      tone({ type: 'triangle', f: 260, to: 820, at: 0.3, dur: 0.22, vol: 0.09 });
    },
    respawn() {
      hiss({ filter: 'highpass', f: 2500, to: 6000, dur: 0.22, vol: 0.1 });
      notes([880, 1175, 1568], { type: 'triangle', step: 0.05, dur: 0.15, vol: 0.07 });
    },
    saved() {
      tone({ type: 'triangle', f: 380, to: 1150, dur: 0.35, vol: 0.11 });
      notes([784, 988, 1319], { type: 'triangle', step: 0.07, dur: 0.2, vol: 0.09 });
    },
    plateOn() { tone({ type: 'square', f: 520, to: 780, dur: 0.07, vol: 0.045, lp: 2000 }); },
    plateOff() { tone({ type: 'square', f: 600, to: 380, dur: 0.07, vol: 0.035, lp: 2000 }); },
    lever() {
      tone({ type: 'square', f: 300, dur: 0.05, vol: 0.06, lp: 1500 });
      tone({ type: 'square', f: 450, at: 0.06, dur: 0.05, vol: 0.06, lp: 1500 });
    },
    door() {
      hiss({ filter: 'lowpass', f: 520, to: 200, dur: 0.55, vol: 0.14, attack: 0.05 });
      tone({ type: 'sawtooth', f: 72, to: 55, dur: 0.55, vol: 0.05, lp: 300 });
    },
    thunk() { tone({ f: 120, to: 70, dur: 0.12, vol: 0.16 }); },
    latch() {
      notes([262, 330, 392, 523], { type: 'triangle', step: 0.08, dur: 0.7, vol: 0.09 });
      hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.9, vol: 0.12, attack: 0.1 });
    },
    flag() { notes([659, 988], { type: 'triangle', step: 0.09, dur: 0.25, vol: 0.11 }); },
    treat() { S.powerup(); },
    helper() {
      tone({ type: 'triangle', f: 500, to: 900, dur: 0.18, vol: 0.09 });
      hiss({ f: 1500, to: 4000, dur: 0.25, vol: 0.05 });
    },
    highfive() {
      hiss({ f: 2400, q: 1.1, dur: 0.06, vol: 0.4 });
      hiss({ f: 1600, q: 1.1, at: 0.015, dur: 0.09, vol: 0.25 });
      notes([523, 659, 784], { type: 'triangle', step: 0.06, dur: 0.18, vol: 0.08, at: 0.1 });
    },
    win() {
      notes([523, 659, 784, 1047], { type: 'triangle', step: 0.11, dur: 0.32, vol: 0.13 });
      notes([262, 330, 392, 523], { type: 'square', step: 0.11, dur: 0.3, vol: 0.03, lp: 1400 });
      tone({ type: 'triangle', f: 1319, at: 0.5, dur: 0.6, vol: 0.12 });
    },
    swish() { S.swish(); },
    swap() { tone({ f: 600, to: 950, dur: 0.1, vol: 0.08 }); },
    atDoor(who) { tone({ type: 'triangle', f: who === 'teddy' ? 784 : 988, dur: 0.18, vol: 0.09 }); },
    click() { S.click(); },
    star(i) { tone({ type: 'triangle', f: [784, 988, 1175][i] || 1175, dur: 0.3, vol: 0.13 }); },
  };
})();
