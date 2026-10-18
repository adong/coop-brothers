#!/usr/bin/env node
/* Plays every level's scripted solution headlessly with the real simulation and checks that both brothers reach
   their doors with every gem, in two-player mode and in single-player mode (one brother at a time).
   Also proves the check can fail: with no solution, nobody may win.
   Usage: node tools/check.js            all levels
          node tools/check.js 4          just level 4 (1-based), with a picture of where it got stuck
          node tools/check.js 4 --trace  print each step as it finishes */
'use strict';
const path = require('path');
require(path.join(__dirname, '../js/sim.js'));
require(path.join(__dirname, '../js/levels.js'));
const CB = globalThis.CB;

const args = process.argv.slice(2);
const only = args.find((a) => /^\d+$/.test(a));
const trace = args.includes('--trace');

function picture(sim) {
  const L = sim.L, rows = [];
  for (let y = L.H - 1; y >= 0; y--) {
    let r = '';
    for (let x = 0; x < L.W; x++) {
      const t = L.grid[y][x];
      r += ['.', '#', '-', 'o', 'm', 'j', 'O', 'M'][t];
    }
    rows.push(r.split(''));
  }
  const put = (x, y, ch) => {
    const r = L.H - 1 - Math.floor(y), c = Math.floor(x);
    if (rows[r] && rows[r][c] !== undefined) rows[r][c] = ch;
  };
  for (const bx of sim.boxes) put(bx.x, bx.y + 0.5, 'B');
  for (const lf of sim.lifts) for (let i = 0; i < lf.w; i++) put(lf.x + i + 0.5, lf.y, '=');
  for (const d of sim.doors) {
    const [x, y, w, h] = CB.doorRect(d);
    for (let i = 0; i < w - 0.01; i++) for (let j = 0; j < h - 0.01; j++) put(x + i + 0.5, y + j + 0.5, '|');
  }
  put(sim.bros.teddy.x, sim.bros.teddy.y + 0.5, 'T');
  put(sim.bros.tommy.x, sim.bros.tommy.y + 0.5, 'Y');
  return rows.map((r) => '   ' + r.join('')).join('\n');
}

let failures = 0;
CB.LEVELS.forEach((def, i) => {
  if (only && +only !== i + 1) return;
  let res;
  try {
    res = CB.runSolution(def, {});
  } catch (e) {
    console.log(`L${i + 1} ${def.name}: ERROR ${e.message}`);
    failures++;
    return;
  }
  const g = res.gems;
  const allGems = g.all;
  const ok = res.ok && allGems;
  const timeStar = res.time <= def.par;
  console.log(`L${String(i + 1).padStart(2)} ${def.name.padEnd(16)} ${ok ? 'OK  ' : 'FAIL'} ${res.msg}; ${res.time}s (par ${def.par}${timeStar ? '' : ' MISSED'}); gems teddy ${g.teddy}/${g.teddyAll} tommy ${g.tommy}/${g.tommyAll}; splashes ${res.sim.bros.teddy.splashes + res.sim.bros.tommy.splashes}`);
  if (!ok || only) {
    if (!ok) failures++;
    const b = res.bot;
    console.log(`    stopped at step ${b.i + 1}/${b.steps.length}: ${(def.solution[b.i] || '(end)')}`);
    for (const id of ['teddy', 'tommy']) {
      const p = res.sim.bros[id];
      console.log(`    ${id}: x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} state ${p.state} ground ${p.ground && (p.ground.ch || p.ground.id || p.ground)}`);
    }
    console.log(picture(res.sim));
  }
  // single player: one brother at a time, with swaps
  const one = CB.runSolution(def, { mode: '1p' });
  const ok1 = one.ok && one.gems.all;
  console.log(`    1 player: ${ok1 ? 'OK  ' : 'FAIL'} ${one.msg}; ${one.time}s${one.time <= def.par ? '' : ' (over par)'}`);
  if (!ok1) failures++;
  // the check must be able to fail: standing still never wins
  const idle = CB.runSolution(def, { steps: ['w3'], limit: 5 });
  if (idle.ok) {
    console.log(`    BROKEN CHECK: level ${i + 1} was won by doing nothing`);
    failures++;
  }
});

if (trace && only) {
  const def = CB.LEVELS[+only - 1];
  const sim = new CB.Sim(def, {});
  const bot = new CB.Bot(sim, def.solution);
  let last = -1;
  for (let n = 0; n < 240 * 120 && !sim.won && !bot.failed; n++) {
    sim.tick(bot.input());
    if (bot.i !== last) {
      last = bot.i;
      const t = sim.bros.teddy, m = sim.bros.tommy;
      console.log(`  t=${sim.time.toFixed(2)} step ${bot.i + 1}: T(${t.x.toFixed(2)},${t.y.toFixed(2)}) M(${m.x.toFixed(2)},${m.y.toFixed(2)})`);
    }
  }
}

console.log(failures ? `\n${failures} problem(s)` : '\nall levels solvable with every gem');
process.exit(failures ? 1 : 0);
