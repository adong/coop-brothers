/* Co-op Brothers: the puzzle simulation. Plain JavaScript with no Three.js, so tools/check.js can run every level
   headlessly in Node. Exposes CB.Sim, CB.parseLevel, CB.Bot and CB.P (the physics numbers).

   Units are tiles (1 tile = 1 m). x grows to the right and y grows up. A body's x is its centre and y its feet.
   The sim runs at a fixed 120 Hz. The view reads its state and drains sim.events for sounds and effects. */
(function (root) {
  'use strict';
  const CB = (root.CB = root.CB || {});

  const DT = 1 / 120;
  const P = {
    run: 6, accelGround: 90, accelAir: 55, gravity: 34, jumpV: 12.8, maxFall: 18,
    coyote: 0.1, buffer: 0.12, pushSpeed: 0.55,
    w: 0.72, h: 1.5, box: 0.96,
    doorSpeed: 3.5, liftSpeed: 2.4,
    helperTime: 10.6, guardUntil: 9.6,
  };
  const EPS = 1e-4;

  // Tile kinds
  const E = 0, SOLID = 1, PLAT = 2, POOL_T = 3, POOL_M = 4, POOL_J = 5, GATE_T = 6, GATE_M = 7;
  const TILES = { '#': SOLID, '-': PLAT, o: POOL_T, m: POOL_M, j: POOL_J, O: GATE_T, M: GATE_M };
  const BROS = ['teddy', 'tommy'];
  const other = (id) => (id === 'teddy' ? 'tommy' : 'teddy');
  const poolOwner = { [POOL_T]: 'teddy', [POOL_M]: 'tommy', [POOL_J]: 'nobody' };

  const approach = (v, to, d) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ level parsing
  // def.map: rows top to bottom. Fixed characters:
  //   #  stone      -  wooden ledge (jump up through it)      o / m / j  orange / mint / grape-jelly pool
  //   O / M  orange / mint gate (only Teddy / only Tommy walks through)     * / v  Teddy's / Tommy's gem
  //   1 / 2  Teddy / Tommy start      D / d  Teddy's / Tommy's exit door     f  checkpoint flag     B  crate
  // Any other character is looked up in def.key, and its cells' bounding box becomes one object:
  //   { t: 'plate', link, who? }       pressure plate (who: 'teddy' | 'tommy' makes it his button only)
  //   { t: 'lever', link, on? }        bump it to flip it
  //   { t: 'door', link | need: [..], invert?, latch? }   slides open while its link is on (need: all of them)
  //   { t: 'lift', link?, dx, dy, auto? }   a platform whose top is the top of its cells; moves by (dx, dy)
  function parseLevel(def) {
    const rows = def.map;
    const H = rows.length, W = Math.max(...rows.map((r) => r.length));
    const grid = [];
    const L = { def, W, H, grid, starts: {}, exits: {}, gems: [], flags: [], boxes: [], objects: [], links: [] };
    const cells = {};
    for (let r = 0; r < H; r++) {
      const y = H - 1 - r;
      grid[y] = new Array(W).fill(E);
      for (let x = 0; x < W; x++) {
        const ch = rows[r][x] || '.';
        if (TILES[ch] !== undefined) grid[y][x] = TILES[ch];
        else if (ch === '*' || ch === 'v') L.gems.push({ x: x + 0.5, y: y + 0.5, who: ch === '*' ? 'teddy' : 'tommy' });
        else if (ch === '1') L.starts.teddy = { x: x + 0.5, y };
        else if (ch === '2') L.starts.tommy = { x: x + 0.5, y };
        else if (ch === 'D') L.exits.teddy = { x: x + 0.5, y };
        else if (ch === 'd') L.exits.tommy = { x: x + 0.5, y };
        else if (ch === 'f') L.flags.push({ x: x + 0.5, y });
        else if (ch === 'B') L.boxes.push({ x: x + 0.5, y });
        else if (ch !== '.' && ch !== ' ') {
          if (!def.key || !def.key[ch]) throw new Error(`${def.name}: unknown map character '${ch}'`);
          (cells[ch] = cells[ch] || []).push([x, y]);
        }
      }
    }
    for (const ch of Object.keys(cells)) {
      const xs = cells[ch].map((c) => c[0]), ys = cells[ch].map((c) => c[1]);
      const o = Object.assign({ ch }, def.key[ch]);
      o.x0 = Math.min(...xs);
      o.y0 = Math.min(...ys);
      o.w = Math.max(...xs) - o.x0 + 1;
      o.h = Math.max(...ys) - o.y0 + 1;
      L.objects.push(o);
      for (const k of [o.link].concat(o.need || [])) if (k && !L.links.includes(k)) L.links.push(k);
    }
    L.objects.sort((a, b) => (a.ch < b.ch ? -1 : 1));
    if (!L.starts.teddy || !L.starts.tommy || !L.exits.teddy || !L.exits.tommy) throw new Error(`${def.name}: needs 1, 2, D and d`);
    return L;
  }

  // ------------------------------------------------------------------ the simulation
  function Sim(def, opts = {}) {
    this.def = def;
    this.L = parseLevel(def);
    this.mode = opts.mode || '2p';
    this.reset();
  }

  Sim.prototype.reset = function () {
    const L = this.L;
    this.time = 0;
    this.won = false;
    this.winT = 0;
    this.events = [];
    this.active = this.active || 'teddy';
    this.bros = {};
    for (const id of BROS) {
      const s = L.starts[id];
      this.bros[id] = {
        id, isBro: true, x: s.x, y: s.y, vx: 0, vy: 0, w: P.w, h: P.h, face: id === 'teddy' ? 1 : 1,
        ground: 'tile', coyote: 0, buffer: 0, pushing: false, state: 'play', st: 0,
        cp: { x: s.x, y: s.y }, safe: { x: s.x, y: s.y }, wade: false, onExit: false, cheerT: 0,
        inLever: {}, flagSeen: {}, gems: 0, splashes: 0, arc: null,
      };
    }
    this.boxes = L.boxes.map((b, i) => ({ id: 'box' + i, isBox: true, x: b.x, y: b.y, vx: 0, vy: 0, w: P.box, h: P.box, ground: 'tile' }));
    this.gems = L.gems.map((g) => Object.assign({ taken: false }, g));
    this.flags = L.flags.map((f) => Object.assign({ by: {} }, f));
    this.plates = [];
    this.levers = [];
    this.doors = [];
    this.lifts = [];
    for (const o of L.objects) {
      if (o.t === 'plate') this.plates.push(Object.assign({ pressed: false, by: null }, o));
      else if (o.t === 'lever') this.levers.push(Object.assign({ state: !!o.on, cool: 0 }, o));
      else if (o.t === 'door') {
        const slide = o.slide || (o.h >= o.w ? 'up' : 'right');
        this.doors.push(Object.assign({ open: 0, latched: false, slide, wantOpen: false }, o));
      } else if (o.t === 'lift') {
        this.lifts.push(Object.assign({}, o, {
          x: o.x0, y: o.y0 + 0.6, w: o.w, h: 0.4, s: 0, target: 0, pause: o.hold || 0.8, holdT: o.hold || 0.8, dir: 1, isLift: true,
          len: Math.hypot(o.dx || 0, o.dy || 0) || 1,
        }));
      }
    }
    this.linkOn = {};
    for (const k of L.links) this.linkOn[k] = false;
    this.helper = { on: false };
    this.updateLinks();
    for (const d of this.doors) d.open = d.wantOpen ? 1 : 0;
  };

  Sim.prototype.ev = function (type, o) { this.events.push(Object.assign({ type }, o)); };

  // ------------------------------------------------------------------ collision
  Sim.prototype.tileAt = function (cx, cy) {
    if (cx < 0 || cx >= this.L.W || cy < 0 || cy >= this.L.H) return SOLID;
    return this.L.grid[cy][cx];
  };

  Sim.prototype.tileSolid = function (cx, cy, b) {
    const t = this.tileAt(cx, cy);
    if (t === SOLID || t === POOL_T || t === POOL_M || t === POOL_J) return true;
    if (t === GATE_T) return b.id !== 'teddy';
    if (t === GATE_M) return b.id !== 'tommy';
    return false;
  };

  function doorRect(d) {
    const o = d.open;
    if (d.slide === 'up') return [d.x0, d.y0 + d.h * o, d.w, d.h * (1 - o)];
    if (d.slide === 'down') return [d.x0, d.y0, d.w, d.h * (1 - o)];
    if (d.slide === 'left') return [d.x0, d.y0, d.w * (1 - o), d.h];
    return [d.x0 + d.w * o, d.y0, d.w * (1 - o), d.h];
  }
  CB.doorRect = doorRect;

  // Every solid rect near (x0..x1, y0..y1) for body b: [x, y, w, h, ref]. ref is null for tiles.
  Sim.prototype.solids = function (b, x0, y0, x1, y1) {
    const out = [];
    for (let cy = Math.floor(y0); cy <= Math.floor(y1 - 1e-7); cy++) {
      for (let cx = Math.floor(x0); cx <= Math.floor(x1 - 1e-7); cx++) {
        if (this.tileSolid(cx, cy, b)) out.push([cx, cy, 1, 1, null]);
      }
    }
    for (const d of this.doors) {
      const r = doorRect(d);
      if (r[2] > 1e-3 && r[3] > 1e-3) out.push([r[0], r[1], r[2], r[3], d]);
    }
    for (const lf of this.lifts) out.push([lf.x, lf.y, lf.w, lf.h, lf]);
    for (const bx of this.boxes) if (bx !== b) out.push([bx.x - bx.w / 2, bx.y, bx.w, bx.h, bx]);
    return out;
  };

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw - EPS && ax + aw > bx + EPS && ay < by + bh - EPS && ay + ah > by + EPS;

  // Move a body sideways. Bodies that can push shove crates ahead of them first. Returns the distance moved.
  Sim.prototype.moveX = function (b, dx, canPush, depth = 0) {
    if (!dx) return 0;
    if (canPush && depth < 4) this.pushAhead(b, dx, depth);
    const L0 = b.x - b.w / 2, R0 = L0 + b.w;
    const lo = Math.min(L0, L0 + dx), hi = Math.max(R0, R0 + dx);
    let nx = b.x + dx, stepTop = -1;
    for (const [rx, ry, rw, rh] of this.solids(b, lo, b.y, hi, b.y + b.h)) {
      if (!(ry < b.y + b.h - EPS && ry + rh > b.y + EPS)) continue; // no vertical overlap
      if (rx < R0 - EPS && rx + rw > L0 + EPS) continue; // already inside it: let it go
      const ahead = dx > 0 ? rx >= R0 - EPS && rx < R0 + dx : rx + rw <= L0 + EPS && rx + rw > L0 + dx;
      if (!ahead) continue;
      // brothers walk up tiny steps (a crate sunk in a pit, a lift that stopped a hair low)
      if (b.isBro && b.ground && ry + rh - b.y <= 0.16) { stepTop = Math.max(stepTop, ry + rh); continue; }
      if (dx > 0) nx = Math.min(nx, rx - b.w / 2);
      else nx = Math.max(nx, rx + rw + b.w / 2);
    }
    if (stepTop > b.y) {
      const free = !this.solids(b, nx - b.w / 2, stepTop, nx + b.w / 2, stepTop + b.h)
        .some(([x, y, w, h]) => overlaps(x, y, w, h, nx - b.w / 2, stepTop, b.w, b.h) && !overlaps(x, y, w, h, L0, b.y, b.w, b.h));
      if (free) b.y = stepTop;
      else nx = b.x;
    }
    const moved = nx - b.x;
    b.x = nx;
    if (Math.abs(moved) < Math.abs(dx) - 1e-6) b.blockedX = true;
    if (b.isBox && moved) this.carry(b, moved, 0);
    return moved;
  };

  // Shove the crates directly ahead of body b by however far b wants to go.
  Sim.prototype.pushAhead = function (b, dx, depth) {
    const L0 = b.x - b.w / 2, R0 = L0 + b.w;
    for (const bx of this.boxes) {
      if (bx === b) continue;
      if (!(bx.y < b.y + b.h - 0.05 && bx.y + bx.h > b.y + 0.05)) continue;
      const bl = bx.x - bx.w / 2, br = bl + bx.w;
      let need = 0;
      if (dx > 0 && bl >= R0 - 0.01 && bl < R0 + dx) need = R0 + dx - bl;
      if (dx < 0 && br <= L0 + 0.01 && br > L0 + dx) need = L0 + dx - br;
      if (need) {
        const m = this.moveX(bx, need, true, depth + 1);
        if (m && b.isBro) b.pushing = true;
        if (m) bx.pushedT = 0.15;
      }
    }
  };

  // Move everything standing on `base` along with it (lifts and pushed crates carry riders).
  Sim.prototype.ridersOf = function (base, out = []) {
    for (const r of this.bodies()) {
      if (r.ground === base && !out.includes(r)) {
        out.push(r);
        if (r.isBox) this.ridersOf(r, out);
      }
    }
    return out;
  };
  Sim.prototype.carry = function (base, dx, dy) {
    for (const r of this.bodies()) {
      if (r.ground !== base) continue;
      if (dx) this.moveX(r, dx, false);
      if (dy) r.y += dy;
    }
  };

  Sim.prototype.bodies = function () {
    const out = this.boxes.slice();
    for (const id of BROS) if (this.bros[id].state === 'play' || this.bros[id].state === 'cheer') out.push(this.bros[id]);
    return out;
  };

  // Move a body up or down. Lands on tiles, ledges (only from above), doors, lifts and crates.
  Sim.prototype.moveY = function (b, dy) {
    if (!dy) return null;
    const L0 = b.x - b.w / 2, R0 = L0 + b.w, B0 = b.y, T0 = b.y + b.h;
    let ny = b.y + dy, hit = null;
    const lo = Math.min(B0, B0 + dy), hi = Math.max(T0, T0 + dy);
    for (const [rx, ry, rw, rh, ref] of this.solids(b, L0, lo, R0, hi)) {
      if (!(rx < R0 - EPS && rx + rw > L0 + EPS)) continue;
      if (ry < T0 - EPS && ry + rh > B0 + EPS) continue;
      if (dy < 0 && ry + rh <= B0 + EPS && ry + rh > B0 + dy) {
        if (ry + rh > ny) { ny = ry + rh; hit = ref || 'tile'; }
      }
      if (dy > 0 && ry >= T0 - EPS && ry < T0 + dy) {
        if (ry - b.h < ny) { ny = ry - b.h; hit = ref || 'tile'; }
      }
    }
    if (dy < 0) {
      // wooden ledges: solid only when falling onto them from above
      for (let cx = Math.floor(L0 + EPS); cx <= Math.floor(R0 - EPS); cx++) {
        for (let cy = Math.floor(ny); cy <= Math.floor(B0); cy++) {
          if (this.tileAt(cx, cy) !== PLAT) continue;
          const top = cy + 1;
          if (B0 >= top - EPS && ny < top && top > ny) { ny = top; hit = 'plat'; }
        }
      }
    }
    b.y = ny;
    return hit;
  };

  // ------------------------------------------------------------------ links, doors and lifts
  Sim.prototype.platePressedBy = function (p) {
    const zx = p.x0 + 0.1, zw = p.w - 0.2;
    const hits = (b) => b.x + b.w / 2 > zx && b.x - b.w / 2 < zx + zw && Math.abs(b.y - p.y0) < 0.3;
    for (const id of BROS) {
      const b = this.bros[id];
      if (p.who && p.who !== id) continue;
      const standing = (b.state === 'play' && b.ground) || (b.state === 'helper' && this.helper.standing) || b.state === 'cheer';
      if (standing && hits(b)) return id;
    }
    if (!p.who) for (const bx of this.boxes) if (bx.ground && hits(bx)) return 'box';
    return null;
  };

  Sim.prototype.updateLinks = function () {
    for (const p of this.plates) {
      const by = this.platePressedBy(p);
      if (!!by !== p.pressed) this.ev(by ? 'plateOn' : 'plateOff', { x: p.x0 + p.w / 2, y: p.y0, link: p.link });
      p.pressed = !!by;
      p.by = by;
    }
    for (const k of this.L.links) this.linkOn[k] = false;
    for (const p of this.plates) if (p.pressed) this.linkOn[p.link] = true;
    for (const lv of this.levers) if (lv.state) this.linkOn[lv.link] = true;
    for (const d of this.doors) {
      const need = d.need || [d.link];
      let on = need.every((k) => this.linkOn[k]);
      if (d.invert) on = !on;
      if (on && d.latch && !d.latched) { d.latched = true; this.ev('latch', { x: d.x0 + d.w / 2, y: d.y0 + d.h / 2 }); }
      d.wantOpen = on || d.latched;
    }
  };

  Sim.prototype.moveDoors = function (dt) {
    for (const d of this.doors) {
      const target = d.wantOpen ? 1 : 0;
      if (d.open === target) continue;
      const span = d.slide === 'up' || d.slide === 'down' ? d.h : d.w;
      const next = approach(d.open, target, (P.doorSpeed * dt) / span);
      if (next < d.open) {
        // closing: stop rather than squash anyone underneath
        const keep = d.open;
        d.open = next;
        const [rx, ry, rw, rh] = doorRect(d);
        const blocked = this.bodies().some((b) => overlaps(rx, ry, rw, rh, b.x - b.w / 2, b.y, b.w, b.h));
        if (blocked) { d.open = keep; continue; }
      } else d.open = next;
      if ((d.open === 0 || d.open === 1) && d.open !== d.lastEnd) this.ev(d.open ? 'doorOpen' : 'doorShut', { x: d.x0 + d.w / 2, y: d.y0 });
      if (d.open === 0 || d.open === 1) d.lastEnd = d.open;
      else d.lastEnd = -1;
    }
  };

  Sim.prototype.moveLifts = function (dt) {
    for (const lf of this.lifts) {
      if (lf.auto) {
        const enabled = !lf.link || this.linkOn[lf.link];
        if (!enabled) continue;
        if (lf.pause > 0) { lf.pause -= dt; continue; }
        lf.target = lf.dir > 0 ? 1 : 0;
      } else lf.target = this.linkOn[lf.link] ? 1 : 0;
      if (lf.s === lf.target) continue;
      const ns = approach(lf.s, lf.target, (P.liftSpeed * dt) / lf.len);
      const mx = (ns - lf.s) * (lf.dx || 0), my = (ns - lf.s) * (lf.dy || 0);
      const nx = lf.x + mx, ny = lf.y + my;
      const riders = this.ridersOf(lf);
      let blocked = false;
      for (const b of this.bodies()) {
        if (riders.includes(b)) continue;
        if (overlaps(nx, ny, lf.w, lf.h, b.x - b.w / 2, b.y, b.w, b.h) && !overlaps(lf.x, lf.y, lf.w, lf.h, b.x - b.w / 2, b.y, b.w, b.h)) blocked = true;
      }
      if (!blocked && my > 0) {
        // riders going up need headroom
        for (const r of riders) {
          const sol = this.solids(r, r.x - r.w / 2, r.y + my, r.x + r.w / 2, r.y + r.h + my).filter((s) => s[4] !== lf && !riders.includes(s[4]));
          if (sol.some(([sx, sy, sw, sh]) => overlaps(sx, sy, sw, sh, r.x - r.w / 2, r.y + my, r.w, r.h) && !overlaps(sx, sy, sw, sh, r.x - r.w / 2, r.y, r.w, r.h))) blocked = true;
        }
      }
      if (blocked) {
        if (lf.auto) { lf.dir = -lf.dir; lf.pause = 0.3; }
        continue;
      }
      lf.x = nx;
      lf.y = ny;
      lf.s = ns;
      for (const r of riders) {
        if (mx) this.moveX(r, mx, false);
        r.y += my;
      }
      if (lf.s === lf.target) {
        this.ev('liftStop', { x: lf.x + lf.w / 2, y: lf.y });
        if (lf.auto) { lf.dir = -lf.dir; lf.pause = lf.holdT; }
      }
    }
  };

  // ------------------------------------------------------------------ the brothers
  Sim.prototype.updateBro = function (b, inp, dt) {
    b.cheerT = Math.max(0, b.cheerT - dt);
    if (b.state === 'splash') {
      b.st += dt;
      if (b.st > 0.9) {
        b.x = b.cp.x;
        b.y = b.cp.y;
        b.vx = b.vy = 0;
        b.state = 'appear';
        b.st = 0;
        b.ground = 'tile';
        this.ev('respawn', { who: b.id, x: b.x, y: b.y });
      }
      return;
    }
    if (b.state === 'appear') {
      b.st += dt;
      if (b.st > 0.35) b.state = 'play';
      return;
    }
    if (b.state === 'rescue') {
      // the helper lifts you out of the pool and back to dry ground
      b.st += dt / 0.6;
      const k = Math.min(1, b.st), a = b.arc;
      b.x = a.x0 + (a.x1 - a.x0) * k;
      b.y = a.y0 + (a.y1 - a.y0) * k + Math.sin(k * Math.PI) * 1.6;
      if (k >= 1) { b.state = 'play'; b.vx = b.vy = 0; b.ground = 'tile'; }
      return;
    }
    if (b.state !== 'play' && b.state !== 'cheer') return;
    if (b.state === 'cheer') inp = NO_INPUT;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) b.face = dir;
    const target = dir * P.run * (b.pushing ? P.pushSpeed : 1);
    b.vx = approach(b.vx, target, (b.ground ? P.accelGround : P.accelAir) * dt);
    if (inp.jump) b.buffer = P.buffer;
    else b.buffer -= dt;
    b.coyote = b.ground ? P.coyote : b.coyote - dt;
    if (b.buffer > 0 && b.coyote > 0) {
      b.vy = P.jumpV;
      b.buffer = 0;
      b.coyote = 0;
      b.ground = null;
      this.ev('jump', { who: b.id, x: b.x, y: b.y });
    }
    b.vy = Math.max(b.vy - P.gravity * dt, -P.maxFall);
    b.pushing = false;
    b.blockedX = false;
    this.moveX(b, b.vx * dt, true);
    if (b.blockedX && !b.pushing) b.vx = 0;
    const was = b.ground, vy = b.vy;
    const hit = this.moveY(b, b.vy * dt);
    if (b.vy < 0 && hit) {
      b.ground = hit;
      b.vy = 0;
      if (!was && vy < -6) this.ev('land', { who: b.id, x: b.x, y: b.y, v: vy });
    } else {
      if (b.vy > 0 && hit) { b.vy = 0; this.ev('bonk', { who: b.id, x: b.x, y: b.y + b.h }); }
      b.ground = null;
    }
    if (b.y < -3) this.splash(b, true);
  };

  const NO_INPUT = { left: false, right: false, jump: false };

  Sim.prototype.updateBox = function (bx, dt) {
    bx.pushedT = Math.max(0, (bx.pushedT || 0) - dt);
    bx.vy = Math.max(bx.vy - P.gravity * dt, -P.maxFall);
    const was = bx.ground, vy = bx.vy;
    const hit = this.moveY(bx, bx.vy * dt);
    if (bx.vy < 0 && hit) {
      bx.ground = hit;
      bx.vy = 0;
      if (!was && vy < -5) this.ev('boxLand', { x: bx.x, y: bx.y });
    } else bx.ground = null;
  };

  // What's under a grounded brother's feet: wading in his own pool, or a splash in the wrong one.
  Sim.prototype.checkPools = function (b) {
    b.wade = false;
    if (b.state !== 'play' || b.ground !== 'tile') return;
    const cy = Math.round(b.y) - 1;
    if (Math.abs(b.y - (cy + 1)) > 0.02) return;
    const a = Math.floor(b.x - b.w / 2 + 0.2), z = Math.floor(b.x + b.w / 2 - 0.2);
    let wrong = false, own = false, dry = true, wrongOwner = null;
    for (let cx = a; cx <= z; cx++) {
      const t = this.tileAt(cx, cy);
      if (poolOwner[t]) {
        dry = false;
        if (poolOwner[t] === b.id) own = true;
        else { wrong = true; wrongOwner = poolOwner[t]; }
      }
    }
    // also count a pool cell under the very edge of the feet as "not dry" so we never save a spot next to one
    const ea = Math.floor(b.x - b.w / 2 + 0.02), ez = Math.floor(b.x + b.w / 2 - 0.02);
    for (let cx = ea; cx <= ez; cx++) if (poolOwner[this.tileAt(cx, cy)] && poolOwner[this.tileAt(cx, cy)] !== b.id) dry = false;
    b.wade = own && !wrong;
    if (wrong) this.splash(b, false, wrongOwner);
    else if (dry) { b.safe.x = b.x; b.safe.y = b.y; }
  };

  // A harmless splash: back to the last flag. While the single-player helper is guarding, he lifts you out instead.
  Sim.prototype.splash = function (b, fell, cy) {
    const h = this.helper;
    const guarded = this.mode === '1p' && h.on && h.who !== b.id && h.t < P.guardUntil && !fell;
    this.ev('splash', { who: b.id, x: b.x, y: b.y, pool: fell ? 'fall' : cy, saved: guarded });
    if (guarded) {
      b.state = 'rescue';
      b.st = 0;
      b.arc = { x0: b.x, y0: b.y, x1: b.safe.x, y1: b.safe.y };
      b.vx = b.vy = 0;
      b.ground = null;
      this.ev('saved', { who: b.id, by: h.who });
      return;
    }
    b.splashes++;
    b.state = 'splash';
    b.st = 0;
    b.vx = b.vy = 0;
    b.ground = null;
  };

  Sim.prototype.checkPickups = function (b) {
    if (b.state !== 'play') return;
    const L0 = b.x - b.w / 2, R0 = L0 + b.w;
    for (const g of this.gems) {
      if (g.taken || g.who !== b.id) continue;
      const nx = clamp(g.x, L0, R0), ny = clamp(g.y, b.y, b.y + b.h);
      if (Math.hypot(g.x - nx, g.y - ny) < 0.38) {
        g.taken = true;
        b.gems++;
        this.ev('gem', { who: b.id, x: g.x, y: g.y, n: this.gems.filter((q) => q.taken && q.who === b.id).length });
      }
    }
    for (const f of this.flags) {
      if (Math.abs(b.x - f.x) < 0.7 && b.y >= f.y - 0.2 && b.y < f.y + 2) {
        if (!f.by[b.id]) { f.by[b.id] = true; this.ev('flag', { who: b.id, x: f.x, y: f.y }); }
        b.cp.x = f.x;
        b.cp.y = f.y;
      }
    }
    for (const lv of this.levers) {
      lv.cool = Math.max(0, lv.cool - DT);
      const inside = b.x + b.w / 2 > lv.x0 + 0.25 && b.x - b.w / 2 < lv.x0 + 0.75 && b.y < lv.y0 + 1 && b.y + b.h > lv.y0;
      if (inside && !b.inLever[lv.ch] && lv.cool <= 0) {
        // levers on the same link are one switch: flipping any of them flips them all
        const on = !lv.state;
        for (const o of this.levers) if (o.link === lv.link) { o.state = on; o.cool = 0.3; }
        this.ev('lever', { who: b.id, x: lv.x0 + 0.5, y: lv.y0, on: lv.state, link: lv.link });
      }
      b.inLever[lv.ch] = inside;
    }
  };

  Sim.prototype.checkExits = function (dt) {
    let both = true;
    for (const id of BROS) {
      const b = this.bros[id], ex = this.L.exits[id];
      const on = b.state === 'play' && !!b.ground && Math.abs(b.x - ex.x) < 0.6 && Math.abs(b.y - ex.y) < 0.1;
      if (on !== b.onExit) this.ev(on ? 'atDoor' : 'leftDoor', { who: id });
      b.onExit = on;
      if (!on) both = false;
    }
    this.winT = both ? this.winT + dt : 0;
    if (this.winT > 0.25 && !this.won) {
      this.won = true;
      if (this.helper.on) this.endHelper(true);
      for (const id of BROS) {
        const b = this.bros[id];
        b.state = 'cheer';
        b.vx = 0;
      }
      this.ev('win', { time: this.time, gems: this.gemCount() });
    }
  };

  Sim.prototype.gemCount = function () {
    const c = { teddy: 0, tommy: 0, teddyAll: 0, tommyAll: 0 };
    for (const g of this.gems) {
      c[g.who + 'All']++;
      if (g.taken) c[g.who]++;
    }
    c.all = c.teddy + c.tommy === c.teddyAll + c.tommyAll;
    return c;
  };

  // ------------------------------------------------------------------ the companion
  // Single player: the brother you're not steering comes to help for about 10 s. He leaps over, says hi with his
  // signature move, hands you a treat, then stands on the nearest pressure plate you still need (or walks with
  // you), and while he's helping a wrong-pool splash doesn't send you back. Then he says bye and goes back to his
  // spot. If he's already holding a plate down he stays put and throws the treat over instead.
  // Two players: both brothers high-five, do their signature moves and swap treats.
  Sim.prototype.callCompanion = function () {
    if (this.won) return null;
    if (this.mode === '2p') {
      for (const id of BROS) this.bros[id].cheerT = 1.8;
      this.ev('highfive', {});
      return 'highfive';
    }
    const h = this.helper;
    if (h.on) {
      if (h.t > 1.6 && (h.t - (h.treatT || -9)) > 0.8 && h.phase !== 'home') {
        h.treatT = h.t;
        this.ev('treat', { from: h.who, to: this.active });
        h.t = Math.min(h.t, 2.0); // and he stays to help a little longer
      }
      return 'treat';
    }
    const who = other(this.active), b = this.bros[who];
    if (b.state !== 'play') return null;
    const holding = this.plates.some((p) => p.by === who && this.linkUsed(p.link));
    Object.assign(h, {
      on: true, who, t: 0, phase: holding ? 'hold' : 'come', holding, home: { x: b.x, y: b.y }, standing: holding,
      x: b.x, y: b.y, leap: null, plate: null, treatT: null, face: b.face, walk: 0,
    });
    if (!holding) b.state = 'helper';
    this.ev('helper', { who, holding });
    return holding ? 'hold' : 'come';
  };

  Sim.prototype.linkUsed = function (k) {
    return this.doors.some((d) => d.link === k || (d.need && d.need.includes(k))) || this.lifts.some((l) => l.link === k);
  };

  // The ground height under (x, near y): the top of the first solid thing at or below y + 0.6, within 6 tiles.
  Sim.prototype.groundBelow = function (x, y, who) {
    const probe = { id: who, w: P.w, h: P.h };
    for (let cy = Math.floor(y + 0.6) - 1; cy >= Math.floor(y) - 6; cy--) {
      const t = this.tileAt(Math.floor(x), cy);
      if (this.tileSolid(Math.floor(x), cy, probe) || t === PLAT) {
        if (poolOwner[t] && poolOwner[t] !== who) return null;
        return cy + 1;
      }
    }
    return null;
  };

  Sim.prototype.updateHelper = function (dt) {
    const h = this.helper;
    if (!h.on) return;
    const b = this.bros[h.who], me = this.bros[this.active];
    h.t += dt;
    if (h.phase === 'hold') {
      // he's keeping a plate down: stay put, physics as normal
      h.x = b.x;
      h.y = b.y;
      if (h.t >= P.helperTime) this.endHelper();
      return;
    }
    if (h.leap) {
      const L = h.leap;
      L.t += dt / L.dur;
      const k = Math.min(1, L.t);
      h.x = L.x0 + (L.x1 - L.x0) * k;
      h.y = L.y0 + (L.y1 - L.y0) * k + Math.sin(k * Math.PI) * L.hgt;
      h.standing = false;
      if (k >= 1) {
        h.leap = null;
        h.standing = true;
        this.ev('helperLand', { who: h.who, x: h.x, y: h.y });
        if (h.phase === 'home') return this.endHelper();
      }
    } else if (h.phase !== 'home') {
      let tx, ty;
      if (h.t >= 2.0 && h.t < P.guardUntil && !h.plate) h.plate = this.neededPlate(me, h.who);
      if (h.t >= P.guardUntil) { tx = h.x; ty = h.y; } // saying bye where he stands
      else if (h.plate) {
        tx = h.plate.x0 + h.plate.w / 2;
        ty = h.plate.y0;
        if (h.plate.pressed && h.plate.by !== h.who) h.plate = null;
      }
      if (tx === undefined) {
        const side = me.face > 0 ? -1 : 1;
        const g = this.groundBelow(me.x + side * 1.1, me.y, h.who);
        tx = g !== null && Math.abs(g - me.y) < 0.6 ? me.x + side * 1.1 : me.x;
        ty = g !== null && Math.abs(g - me.y) < 0.6 ? g : me.y;
        if (me.state !== 'play' || !me.ground) { tx = h.x; ty = h.y; }
      }
      const dx = tx - h.x, dy = ty - h.y;
      if (Math.abs(dy) > 0.25 || Math.abs(dx) > 2.4) {
        this.startLeap(tx, ty);
      } else if (Math.abs(dx) > 0.12) {
        const step = Math.sign(dx) * Math.min(Math.abs(dx), P.run * 0.9 * dt);
        h.x += step;
        h.face = Math.sign(dx);
        h.walk += Math.abs(step);
        h.moving = true;
      } else {
        h.moving = false;
        h.face = me.x > h.x ? 1 : -1;
      }
      h.standing = true;
      if (h.t > 1.5 && h.treatT === null) {
        h.treatT = h.t;
        this.ev('treat', { from: h.who, to: this.active });
      }
      if (h.t >= P.helperTime) {
        h.phase = 'home';
        this.startLeap(h.home.x, h.home.y);
      }
    }
    b.x = h.x;
    b.y = h.y;
    b.face = h.face;
  };

  Sim.prototype.startLeap = function (x1, y1) {
    const h = this.helper;
    const d = Math.hypot(x1 - h.x, y1 - h.y);
    h.leap = { x0: h.x, y0: h.y, x1, y1, t: 0, dur: clamp(0.4 + d * 0.04, 0.45, 1.1), hgt: 1 + Math.min(3, d * 0.12) + Math.max(0, y1 - h.y) * 0.4 };
    h.face = x1 >= h.x ? 1 : -1;
    h.standing = false;
    this.ev('helperLeap', { who: h.who, x: h.x, y: h.y });
  };

  // The plate he should stand on: one he's allowed to press, whose door or lift is near the player and isn't
  // already held open by someone else, and that's close to the player. null when nothing nearby needs help.
  Sim.prototype.neededPlate = function (me, who) {
    let best = null, bs = Infinity;
    for (const p of this.plates) {
      if (p.who && p.who !== who) continue;
      if (p.pressed && p.by !== who) continue;
      if (this.linkOn[p.link] && p.by !== who) continue;
      let od = Infinity;
      for (const d of this.doors) if (d.link === p.link || (d.need && d.need.includes(p.link))) od = Math.min(od, Math.hypot(d.x0 + d.w / 2 - me.x, d.y0 + d.h / 2 - me.y));
      for (const l of this.lifts) if (l.link === p.link) od = Math.min(od, Math.hypot(l.x + l.w / 2 - me.x, l.y - me.y));
      const pd = Math.hypot(p.x0 + p.w / 2 - me.x, p.y0 - me.y);
      if (od > 7 || pd > 12) continue;
      if (pd + od < bs) { bs = pd + od; best = p; }
    }
    return best;
  };

  Sim.prototype.endHelper = function (instant) {
    const h = this.helper;
    if (!h.on) return;
    const b = this.bros[h.who];
    h.on = false;
    if (b.state === 'helper') {
      b.x = h.home.x;
      b.y = h.home.y;
      b.vx = b.vy = 0;
      b.state = 'play';
      b.ground = null;
      // if something moved into his spot while he was away, pop him up until he's free
      for (let i = 0; i < 40 && this.solids(b, b.x - b.w / 2, b.y, b.x + b.w / 2, b.y + b.h).some(([x, y, w, hh]) => overlaps(x, y, w, hh, b.x - b.w / 2, b.y, b.w, b.h)); i++) b.y += 0.1;
    }
    this.ev('helperDone', { who: h.who, instant: !!instant });
  };

  // Single player: switch which brother you steer. A visiting helper goes straight home first.
  Sim.prototype.swap = function () {
    if (this.mode !== '1p' || this.won) return;
    if (this.helper.on) this.endHelper(true);
    this.active = other(this.active);
    this.ev('swap', { who: this.active });
  };

  // ------------------------------------------------------------------ the tick
  // input: { teddy: { left, right, jump }, tommy: { ... } }
  Sim.prototype.tick = function (input) {
    const dt = DT;
    this.time += this.won ? 0 : dt;
    this.updateLinks();
    this.moveDoors(dt);
    this.moveLifts(dt);
    for (const id of BROS) {
      let inp = (input && input[id]) || NO_INPUT;
      if (this.mode === '1p' && id !== this.active) inp = NO_INPUT;
      this.updateBro(this.bros[id], inp, dt);
    }
    for (const bx of this.boxes) this.updateBox(bx, dt);
    this.updateHelper(dt);
    for (const id of BROS) {
      const b = this.bros[id];
      this.checkPools(b);
      this.checkPickups(b);
    }
    if (!this.won) this.checkExits(dt);
  };

  // Advance by `seconds` of game time in fixed ticks (the leftover is carried to the next call).
  Sim.prototype.advance = function (seconds, input) {
    this.acc = (this.acc || 0) + Math.min(seconds, 0.25);
    let n = 0;
    while (this.acc >= DT) {
      this.acc -= DT;
      this.tick(typeof input === 'function' ? input() : input);
      n++;
    }
    return n;
  };

  // ------------------------------------------------------------------ the solution bot
  // A solution is a list of steps; each step is a string of actions that run together:
  //   T@12.5        Teddy walks to x = 12.5          M@3.5   Tommy walks to x = 3.5
  //   T^            Teddy jumps where he stands       T^@15.5 jump now and keep going to 15.5
  //   T@20.5j14j17  walk to 20.5, jumping as he passes x = 14 and x = 17
  //   w0.5          wait half a second               call    call the companion (single player)
  //   swap          single player: switch brothers
  //   F=0 / F=1     wait until the lift drawn with 'F' rests at its start / end
  // A step ends when all its actions are done. The last step should leave both brothers at their doors.
  function Bot(sim, steps) {
    this.sim = sim;
    this.steps = steps.map(parseStep);
    this.i = 0;
    this.stepT = 0;
    this.log = [];
    this.failed = null;
    this.begin();
  }

  function parseStep(s) {
    return s.trim().split(/\s+/).map((tok) => {
      let m;
      if ((m = tok.match(/^w([\d.]+)$/))) return { kind: 'wait', dur: +m[1], src: tok };
      if (tok === 'call' || tok === 'swap') return { kind: tok, src: tok };
      if ((m = tok.match(/^([A-Za-z])=([01])$/))) return { kind: 'lift', ch: m[1], end: +m[2], src: tok };
      if ((m = tok.match(/^([TM])(\^?)(?:@(-?[\d.]+))?((?:j[\d.]+)*)$/))) {
        return {
          kind: 'move', who: m[1] === 'T' ? 'teddy' : 'tommy', jumpNow: !!m[2], x: m[3] !== undefined ? +m[3] : null,
          jumps: (m[4] || '').split('j').filter(Boolean).map(Number), src: tok,
        };
      }
      throw new Error('bad solution token: ' + tok);
    });
  }

  Bot.prototype.begin = function () {
    this.stepT = 0;
    const step = this.steps[this.i];
    if (!step) return;
    for (const a of step) {
      a.done = false;
      a.t = 0;
      a.jumped = a.jumpNow ? 0 : -1;
      a.left = false;
      a.next = 0;
      a.startX = a.who ? this.sim.bros[a.who].x : 0;
      if (a.kind === 'call') { this.sim.callCompanion(); a.done = true; }
      if (a.kind === 'swap') { this.sim.swap(); a.done = true; }
    }
  };

  Bot.prototype.input = function () {
    const sim = this.sim, inp = { teddy: { left: false, right: false, jump: false }, tommy: { left: false, right: false, jump: false } };
    const step = this.steps[this.i];
    if (!step || this.failed) return inp;
    this.stepT += DT;
    for (const a of step) {
      if (a.done) continue;
      a.t += DT;
      if (a.kind === 'wait') { if (a.t >= a.dur) a.done = true; continue; }
      if (a.kind === 'lift') {
        const lf = sim.lifts.find((l) => l.ch === a.ch);
        if (!lf) { this.fail('no lift ' + a.ch); return inp; }
        if (Math.abs(lf.s - a.end) < 1e-6 && lf.pause > 0.15) a.done = true;
        continue;
      }
      if (a.kind !== 'move') continue;
      const b = sim.bros[a.who], o = inp[a.who];
      if (b.state === 'splash' || b.state === 'appear' || b.state === 'rescue') { this.fail(`${a.who} splashed during "${a.src}"`); return inp; }
      // jump right away (pressed for a few ticks so the buffer catches it)
      if (a.jumpNow && a.jumped >= 0 && a.jumped < 3) { o.jump = true; a.jumped++; if (b.ground === null) a.left = true; }
      if (!b.ground) a.left = true;
      // jumps on the way, as he passes each x
      if (a.x !== null && a.next < a.jumps.length) {
        const jx = a.jumps[a.next], dirn = Math.sign(a.x - a.startX);
        if ((dirn > 0 && b.x >= jx) || (dirn < 0 && b.x <= jx)) { o.jump = true; if (!b.ground) a.next++; }
      }
      let arrived = true;
      if (a.x !== null) {
        const dx = a.x - b.x, decel = b.ground ? P.accelGround : P.accelAir;
        const stop = (b.vx * b.vx) / (2 * decel) + 0.01;
        if (Math.abs(dx) > 0.05) {
          if (Math.sign(dx) === Math.sign(b.vx) && Math.abs(dx) <= stop) { /* coast to a stop */ } else if (dx > 0) o.right = true;
          else o.left = true;
        }
        arrived = Math.abs(dx) < 0.1 && Math.abs(b.vx) < 0.6;
      }
      const landed = b.ground && (!a.jumpNow || a.left) && a.next >= a.jumps.length;
      if (arrived && landed && b.state === 'play') a.done = true;
    }
    if (step.every((a) => a.done)) {
      this.i++;
      this.begin();
    } else if (this.stepT > 20) this.fail(`step ${this.i + 1} timed out: ${step.map((a) => a.src || a.kind).join(' ')}`);
    return inp;
  };

  Bot.prototype.fail = function (msg) {
    if (!this.failed) this.failed = msg;
  };

  Bot.prototype.done = function () {
    return this.i >= this.steps.length;
  };

  // A two-player script turned into a single-player one: one brother moves at a time, with swaps in between.
  function toSinglePlayer(steps) {
    const out = [];
    let cur = 'teddy';
    for (const step of steps) {
      const toks = step.trim().split(/\s+/);
      const t = toks.filter((x) => x[0] === 'T'), m = toks.filter((x) => x[0] === 'M'), rest = toks.filter((x) => x[0] !== 'T' && x[0] !== 'M');
      if (rest.length) out.push(rest.join(' '));
      const groups = cur === 'teddy' ? [['teddy', t], ['tommy', m]] : [['tommy', m], ['teddy', t]];
      for (const [who, list] of groups) {
        if (!list.length) continue;
        if (who !== cur) { out.push('swap'); cur = who; }
        out.push(list.join(' '));
      }
    }
    return out;
  }

  // Run a level's solution headlessly. Returns { ok, time, gems, msg, sim }. In single-player mode it plays the
  // level's solution1p, or the two-player script turned into one brother at a time.
  function runSolution(def, opts = {}) {
    const mode = opts.mode || '2p';
    const sim = new Sim(def, { mode });
    const steps = opts.steps || (mode === '1p' ? def.solution1p || toSinglePlayer(def.solution || []) : def.solution || []);
    const bot = new Bot(sim, steps);
    const limit = (opts.limit || 240) / DT;
    let n = 0;
    while (!sim.won && !bot.failed && n++ < limit) sim.tick(bot.input());
    // after the script, wait a moment for the doors to register
    for (let i = 0; i < 120 && !sim.won && !bot.failed; i++) sim.tick(bot.input());
    const gems = sim.gemCount();
    const msg = sim.won ? 'won' : bot.failed || (bot.done() ? 'script finished but the brothers are not both at their doors' : 'ran out of time');
    return { ok: sim.won, time: +sim.time.toFixed(2), gems, msg, sim, bot };
  }

  CB.P = P;
  CB.DT = DT;
  CB.TILE = { E, SOLID, PLAT, POOL_T, POOL_M, POOL_J, GATE_T, GATE_M };
  CB.parseLevel = parseLevel;
  CB.Sim = Sim;
  CB.Bot = Bot;
  CB.runSolution = runSolution;
  CB.toSinglePlayer = toSinglePlayer;
})(typeof window !== 'undefined' ? window : globalThis);
