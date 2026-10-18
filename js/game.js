/* Co-op Brothers: the game shell. Screens, input (two players on one keyboard, touch pads, single-player swap),
   the companion button, the HUD, stars and saving, the title-screen demo, and test hooks (window.game). */
(function () {
  'use strict';
  const C = CB.COLORS, P = CB.P, LEVELS = CB.LEVELS;
  const $ = (id) => document.getElementById(id);
  const NAME = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const other = (id) => (id === 'teddy' ? 'tommy' : 'teddy');
  const cls = (id) => (id === 'teddy' ? 't' : id === 'tommy' ? 'm' : '');
  const sfx = (name, ...a) => { try { CB.sfx[name](...a); } catch (e) { /* sound is optional */ } };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------------------------------------------------------------- saved progress
  // best[i] = { done, gems, time, bestTime }: each true flag is a star. Kept per browser (index.html and the
  // single-page build each have their own).
  const SAVE_KEY = 'coopBrothers.v1';
  const save = { best: {}, unlockAll: false, mode: '2p' };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };
  const starsOf = (i) => { const b = save.best[i]; return b ? [!!b.done, !!b.gems, !!b.time] : [false, false, false]; };
  const unlocked = (i) => save.unlockAll || i <= 1 || !!save.best[i - 1];

  const G = {
    state: 'title', mode: save.mode === '1p' ? '1p' : '2p', level: 0, sim: null, demo: null, demoMode: false,
    attract: false, attractLevel: 0, winT: 0, cardShown: false, hold: false, autoPause: true, bannerT: 0, touch: false,
  };
  let view, thumbs;

  // ---------------------------------------------------------------- boot
  function boot() {
    document.title = `${CB.TITLE} · Teddy & Tommy`;
    const sp = CB.TITLE.indexOf(' ');
    // the display font is all capitals, so the double Ts get their own colour to keep the pun
    const tt = (w) => w.replace(/[&<>]/g, '').replace(/TT/g, '<em>TT</em>');
    $('logo1').innerHTML = tt(sp > 0 ? CB.TITLE.slice(0, sp) : CB.TITLE);
    $('logo2').innerHTML = tt(sp > 0 ? CB.TITLE.slice(sp + 1) : '');
    view = new CB.View($('game'));
    view.onSwish = (hoop) => { sfx('swish'); if (hoop && G.state === 'won' && !G.attract) toast('SWISH!', 't'); };
    thumbs = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 152 });
    $('heroT').src = $('faceT').src = $('swapT').src = thumbs.teddy;
    $('heroM').src = $('faceM').src = $('swapM').src = thumbs.tommy;
    G.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    resize();
    window.addEventListener('resize', resize);
    buildGrid();
    bindUi();
    bindKeys();
    bindPads();
    updateMute();
    const q = new URLSearchParams(location.search);
    if (q.has('level')) {
      G.mode = q.get('mode') === '1p' ? '1p' : '2p';
      startLevel(Math.max(0, Math.min(LEVELS.length - 1, (+q.get('level') || 1) - 1)));
    } else startAttract();
    requestAnimationFrame(frame);
  }

  // catch size changes that didn't fire a resize event (rotation, browser chrome showing up)
  function checkSize() {
    if (window.innerWidth && (window.innerWidth !== view.size[0] || window.innerHeight !== view.size[1])) resize();
  }

  function resize() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1024;
    const h = window.innerHeight || document.documentElement.clientHeight || 768;
    view.resize(w, h);
    layoutInsets();
  }

  // How much of the screen the HUD and buttons cover, so the camera frames the level in the rest.
  function layoutInsets() {
    const playing = G.state !== 'title' && G.state !== 'select' && !G.attract;
    const pads = playing && !$('pads').classList.contains('hidden');
    view.insets = playing ? { top: 58, bottom: pads ? 64 : 30, left: 8, right: 8 } : { top: 0, bottom: 0, left: 0, right: 0 };
  }

  // ---------------------------------------------------------------- levels
  function startLevel(i, o = {}) {
    G.level = i;
    const def = LEVELS[i];
    G.sim = new CB.Sim(def, { mode: o.demo ? '2p' : G.mode });
    G.sim.active = 'teddy';
    G.demo = o.demo ? new CB.Bot(G.sim, def.solution) : null;
    G.demoMode = !!o.demo;
    G.attract = false;
    G.state = 'play';
    G.winT = 0;
    G.cardShown = false;
    showScreen(null);
    $('hud').classList.remove('hidden');
    $('hud').querySelector('.dock').style.visibility = '';
    $('demoBadge').classList.toggle('hidden', !o.demo);
    setupPads();
    layoutInsets();
    view.load(G.sim, i);
    updateDock();
    hudCache = {};
    if (!o.demo) showBanner(i);
    else hideBanner();
    Kit.sound.music('title');
  }

  function restart() { if (G.sim && !G.attract) startLevel(G.level, { demo: G.demoMode }); }

  function startAttract() {
    G.attract = true;
    G.state = 'title';
    const i = G.attractLevel % 3;
    G.sim = new CB.Sim(LEVELS[i], { mode: '2p' });
    G.demo = new CB.Bot(G.sim, LEVELS[i].solution);
    G.demoMode = true;
    G.winT = 0;
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('demoBadge').classList.add('hidden');
    hideBanner();
    layoutInsets();
    view.load(G.sim, i);
    showScreen('title');
  }

  function showScreen(id) {
    for (const s of ['title', 'select', 'pause', 'win']) $(s).classList.toggle('hidden', s !== id);
  }

  function showSelect() {
    if (G.attract === false && G.sim) {
      // keep the current level behind the menu, frozen
      G.state = 'select';
    } else G.state = 'select';
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('demoBadge').classList.add('hidden');
    hideBanner();
    buildGrid();
    showScreen('select');
    layoutInsets();
    Kit.sound.music('title');
  }

  function goTitle() {
    G.attractLevel++;
    startAttract();
  }

  function buildGrid() {
    const grid = $('grid');
    grid.innerHTML = '';
    let nextSet = false;
    LEVELS.forEach((def, i) => {
      const open = unlocked(i), st = starsOf(i);
      const b = document.createElement('button');
      b.className = 'card' + (open ? '' : ' locked');
      if (open && !st[0] && !nextSet) { b.classList.add('next'); nextSet = true; }
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${def.name}</span><span class="st">${st.map((s) => `<i class="${s ? 'on' : ''}">★</i>`).join('')}</span>${open ? '' : '<span class="lock">🔒</span>'}`;
      b.addEventListener('click', () => {
        Kit.sound.init();
        if (!unlocked(i)) { sfx('bonk'); toast('FINISH LEVEL ' + i + ' FIRST!'); return; }
        sfx('click');
        startLevel(i);
      });
      grid.appendChild(b);
    });
    for (const btn of $('modeSeg').children) btn.classList.toggle('on', btn.dataset.mode === G.mode);
    $('unlockAll').textContent = save.unlockAll ? 'lock levels again' : 'open every level';
  }

  // ---------------------------------------------------------------- banner, toasts
  function showBanner(i) {
    const def = LEVELS[i];
    $('bannerNum').textContent = `LEVEL ${i + 1} OF ${LEVELS.length}`;
    $('bannerName').textContent = def.name;
    $('bannerTip').textContent = def.tip || '';
    let keys;
    if (G.touch) keys = G.mode === '2p' ? 'Teddy: buttons on the left · Tommy: buttons on the right' : 'Move and jump with the big buttons · ⇄ swaps brothers';
    else keys = G.mode === '2p' ? 'Teddy: W A D  ·  Tommy: ← ↑ →  ·  T: high five!' : 'Move: ← → or A D  ·  Jump: ↑ W Space  ·  Tab: swap  ·  T: call your brother';
    $('bannerKeys').textContent = keys;
    $('banner').classList.remove('hidden');
    G.bannerT = 4.5;
  }
  function hideBanner() { $('banner').classList.add('hidden'); G.bannerT = 0; }

  function toast(text, c, big) {
    if (G.attract && G.state === 'title') return; // the title-screen demo stays quiet (the level screen can still toast)
    const el = document.createElement('div');
    el.className = 'toast' + (c ? ' ' + c : '') + (big ? ' big' : '');
    // emoji keep their own colours: no outline on them
    for (const part of text.split(/(\p{Extended_Pictographic}\uFE0F?)/u)) {
      if (!part) continue;
      const span = document.createElement('span');
      if (/\p{Extended_Pictographic}/u.test(part)) span.className = 'emo';
      span.textContent = part;
      el.appendChild(span);
    }
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1650);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  // ---------------------------------------------------------------- the companion
  // Single player: the other brother comes to help for about 10 s (see Sim.callCompanion). Two players: a high
  // five, both do their signature moves and swap treats. Tapping again gives another treat.
  function callCompanion() {
    Kit.sound.init();
    if (G.state !== 'play' || G.demoMode || !G.sim) return null;
    return G.sim.callCompanion();
  }

  function swap() {
    Kit.sound.init();
    if (G.state !== 'play' || G.demoMode || !G.sim || G.sim.mode !== '1p') return;
    G.sim.swap();
  }

  function updateDock() {
    const sim = G.sim;
    if (!sim) return;
    const one = sim.mode === '1p' && !G.demoMode;
    $('swapBtn').style.display = one ? '' : 'none';
    $('swapT').classList.toggle('on', sim.active === 'teddy');
    $('swapM').classList.toggle('on', sim.active === 'tommy');
    const bb = $('buddyBtn'), faces = $('buddyFaces');
    bb.style.display = G.demoMode ? 'none' : '';
    if (one) {
      const buddy = other(sim.active);
      bb.className = 'buddybtn' + (buddy === 'teddy' ? ' t' : '');
      faces.innerHTML = `<img src="${thumbs[buddy]}" alt="">`;
      $('buddyLabel').textContent = 'CALL ' + NAME[buddy];
      bb.title = `Call ${buddy === 'teddy' ? 'Teddy' : 'Tommy'} to help (T)`;
      $('pwFace').src = thumbs[buddy];
      $('pwName').textContent = NAME[buddy] + ' IS HELPING';
      $('pwBuddy').className = buddy === 'teddy' ? 't' : '';
    } else {
      bb.className = 'buddybtn both';
      faces.innerHTML = `<img src="${thumbs.teddy}" alt=""><img src="${thumbs.tommy}" alt="">`;
      $('buddyLabel').textContent = 'HIGH FIVE!';
      bb.title = 'High five! (T)';
    }
  }

  // ---------------------------------------------------------------- the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    checkSize();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.hold) tick(dt, true);
  }

  function tick(dt, render) {
    const sim = G.sim;
    if (!sim) return;
    const running = G.state === 'play' || G.state === 'won' || G.attract;
    if (running) {
      if (G.demo) sim.advance(dt, () => G.demo.input());
      else {
        const inp = readInput();
        sim.advance(dt, inp);
      }
      handleEvents();
      if (sim.won) {
        G.winT += dt;
        if (G.attract && G.winT > 5) { G.attractLevel++; startAttract(); return; }
        if (!G.attract && G.winT > 3.6 && !G.cardShown) showWinCard();
      } else if (G.attract && (sim.time > 90 || (G.demo && G.demo.failed))) { G.attractLevel++; startAttract(); return; }
      if (G.bannerT > 0) {
        G.bannerT -= dt;
        if (G.bannerT <= 0) hideBanner();
      }
      // the whole level first (while the name and tip show), then the camera follows the brothers
      view.follow = !G.attract && G.bannerT <= 0;
    }
    view.sync(sim, running ? dt : 0, { demo: G.attract || G.demoMode });
    if (render) view.render();
    updateHud();
  }

  function handleEvents() {
    const sim = G.sim;
    for (const e of sim.events.splice(0)) {
      view.lastTreats = [];
      view.event(e);
      if (G.attract) continue;
      switch (e.type) {
        case 'jump': sfx('jump', e.who); break;
        case 'land': sfx('land'); break;
        case 'bonk': sfx('bonk'); break;
        case 'gem': sfx('gem', e.n); popPill(e.who === 'teddy' ? 'gemT' : 'gemM'); break;
        case 'splash':
          sfx('splash');
          if (!e.saved) toast(e.pool === 'fall' ? 'OOPS!' : 'SPLASH!', cls(e.who), true);
          break;
        case 'saved': sfx('saved'); toast(`${NAME[e.by]} SAVED YOU!`, cls(e.by), true); break;
        case 'respawn': sfx('respawn'); break;
        case 'plateOn': sfx('plateOn'); break;
        case 'plateOff': sfx('plateOff'); break;
        case 'lever': sfx('lever'); break;
        case 'doorOpen': case 'doorShut': sfx('door'); break;
        case 'liftStop': sfx('thunk'); break;
        case 'latch': sfx('latch'); toast('THE BIG DOOR IS OPEN!', '', true); break;
        case 'flag': sfx('flag'); toast('CHECKPOINT!', cls(e.who)); break;
        case 'helper':
          sfx('helper');
          toast(e.holding ? `${NAME[e.who]} IS HOLDING IT FOR YOU!` : `${NAME[e.who]}'S HERE!`, cls(e.who), true);
          break;
        case 'treat': {
          const tr = view.lastTreats[0];
          sfx('treat');
          if (tr) toast(`${tr.emoji} ${tr.label} FROM ${NAME[e.from]}!`, cls(e.from));
          break;
        }
        case 'highfive':
          sfx('highfive');
          toast('HIGH FIVE! ✋', '', true);
          setTimeout(() => sfx('treat'), 450);
          for (const tr of view.lastTreats) toast(`${tr.emoji} ${tr.label} FROM ${NAME[tr.from]}!`, cls(tr.from));
          break;
        case 'atDoor': sfx('atDoor', e.who); break;
        case 'swap': sfx('swap'); updateDock(); break;
        case 'win': onWin(); break;
      }
    }
  }

  function popPill(id) {
    const el = $(id);
    el.classList.remove('done');
    void el.offsetWidth;
    el.classList.add('done');
  }

  // ---------------------------------------------------------------- winning
  function onWin() {
    G.state = 'won';
    $('hud').querySelector('.dock').style.visibility = 'hidden';
    G.winT = 0;
    sfx('win');
    toast('HOORAY! BOTH HOME!', '', true);
    hideBanner();
    const sim = G.sim, def = LEVELS[G.level], g = sim.gemCount();
    G.result = { time: sim.time, gems: g, stars: [true, g.all, sim.time <= def.par] };
    if (!G.demoMode) {
      const prev = save.best[G.level] || {};
      save.best[G.level] = {
        done: true, gems: !!(prev.gems || g.all), time: !!(prev.time || sim.time <= def.par),
        bestTime: Math.min(prev.bestTime || 1e9, +sim.time.toFixed(1)),
      };
      persist();
    }
  }

  function showWinCard() {
    G.cardShown = true;
    const r = G.result, def = LEVELS[G.level];
    $('winTitle').textContent = G.demoMode ? "THAT'S HOW!" : r.stars.every(Boolean) ? 'SUPER STARS!' : 'YOU DID IT!';
    $('star1t').textContent = `All gems ${r.gems.teddy + r.gems.tommy}/${r.gems.teddyAll + r.gems.tommyAll}`;
    $('star2t').textContent = `Under ${fmt(def.par)}`;
    $('winStat').textContent = `Time ${fmt(r.time)}` + (save.best[G.level] && !G.demoMode ? `  ·  best ${fmt(save.best[G.level].bestTime)}` : '');
    const last = G.level >= LEVELS.length - 1;
    $('wNext').textContent = G.demoMode ? 'YOUR TURN ▶' : last ? '☰ ALL LEVELS' : 'NEXT ▶';
    for (let i = 0; i < 3; i++) $('star' + i).classList.remove('on');
    showScreen('win');
    r.stars.forEach((on, i) => {
      if (on) setTimeout(() => { $('star' + i).classList.add('on'); sfx('star', i); }, 350 + i * 380);
    });
    Kit.sound.music('over');
  }

  function winNext() {
    sfx('click');
    if (G.demoMode) return startLevel(G.level);
    if (G.level >= LEVELS.length - 1) return showSelect();
    startLevel(G.level + 1);
  }

  // ---------------------------------------------------------------- pause
  function pause() {
    if (G.state !== 'play') return;
    G.state = 'paused';
    showScreen('pause');
    $('pDemo').style.display = G.demoMode ? 'none' : '';
    Kit.sound.music('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'play';
    showScreen(null);
    Kit.sound.music('title');
  }

  // ---------------------------------------------------------------- HUD
  let hudCache = {};
  const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
  function updateHud() {
    const sim = G.sim;
    if (!sim || G.attract) return;
    const g = sim.gemCount(), def = LEVELS[G.level];
    setText('lvlNum', String(G.level + 1));
    setText('lvlName', def.name.toUpperCase());
    setText('gemTn', `${g.teddy}/${g.teddyAll}`);
    setText('gemMn', `${g.tommy}/${g.tommyAll}`);
    setText('timer', fmt(sim.time));
    $('timePill').classList.toggle('over', sim.time > def.par);
    const h = sim.helper, guarding = sim.mode === '1p' && h.on && h.t < P.guardUntil;
    $('pwBuddy').classList.toggle('on', guarding);
    if (guarding) $('pwBuddy').querySelector('b').style.transform = `scaleX(${Math.max(0, 1 - h.t / P.guardUntil)})`;
    $('buddyBtn').classList.toggle('guarding', guarding);
  }

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const touch = new Set();
  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

  function readInput() {
    const k = keys, t = touch, sim = G.sim;
    if (sim.mode === '2p') {
      return {
        teddy: { left: k.has('KeyA') || t.has('t-left'), right: k.has('KeyD') || t.has('t-right'), jump: k.has('KeyW') || t.has('t-jump') },
        tommy: { left: k.has('ArrowLeft') || t.has('m-left'), right: k.has('ArrowRight') || t.has('m-right'), jump: k.has('ArrowUp') || t.has('m-jump') },
      };
    }
    const one = {
      left: k.has('KeyA') || k.has('ArrowLeft') || t.has('p-left'),
      right: k.has('KeyD') || k.has('ArrowRight') || t.has('p-right'),
      jump: k.has('KeyW') || k.has('ArrowUp') || k.has('Space') || t.has('p-jump'),
    };
    return { [sim.active]: one };
  }

  function anyMove() {
    for (const c of ['KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']) if (keys.has(c)) return true;
    return touch.size > 0;
  }

  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      Kit.sound.init();
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keys.add(e.code);
      if (e.repeat) return;
      if (G.state === 'play' && G.demoMode) { stopDemo(); return; }
      if (G.state === 'play' && G.bannerT > 0 && anyMove()) G.bannerT = Math.min(G.bannerT, 0.6);
      switch (e.code) {
        case 'Tab': swap(); break;
        case 'KeyT': callCompanion(); break;
        case 'KeyP': case 'Escape':
          if (G.state === 'play') pause();
          else if (G.state === 'paused') resume();
          else if (G.state === 'select') goTitle();
          break;
        case 'KeyR': if (G.state === 'play' || G.state === 'won') restart(); break;
        case 'KeyM': toggleMute(); break;
        case 'Enter': case 'Space':
          if (G.state === 'title') { sfx('click'); showSelect(); }
          else if (G.state === 'paused') resume();
          else if (G.state === 'won' && G.cardShown) winNext();
          break;
      }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); touch.clear(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        keys.clear();
        if (G.autoPause && G.state === 'play' && !G.demoMode) pause();
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }

  // Touch pads: each finger presses whichever button is under it, and can slide from one to the next.
  const pointers = new Map();
  function setupPads() {
    const two = G.sim && G.sim.mode === '2p';
    const btn = (ctl, label, c, extra) => `<button class="tbtn ${c} ${extra || ''}" data-ctl="${ctl}">${label}</button>`;
    if (two) {
      $('padL').innerHTML = `<div class="padlabel">🏀 TEDDY</div>${btn('t-left', '◀', 't')}${btn('t-right', '▶', 't')}${btn('t-jump', '▲', 't', 'jump')}`;
      $('padR').innerHTML = `<div class="padlabel">✌️ TOMMY</div>${btn('m-left', '◀', 'm')}${btn('m-right', '▶', 'm')}${btn('m-jump', '▲', 'm', 'jump')}`;
    } else {
      $('padL').innerHTML = `${btn('p-left', '◀', '')}${btn('p-right', '▶', '')}`;
      $('padR').innerHTML = `${btn('p-jump', '▲', '', 'jump')}`;
    }
    $('padL').style.position = $('padR').style.position = 'fixed';
    $('pads').classList.toggle('hidden', !(G.touch && !G.demoMode));
    touch.clear();
    pointers.clear();
  }

  function bindPads() {
    const ctlAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const b = el && el.closest && el.closest('[data-ctl]');
      return b ? b.dataset.ctl : null;
    };
    const refresh = () => {
      touch.clear();
      for (const c of pointers.values()) if (c) touch.add(c);
      for (const b of document.querySelectorAll('[data-ctl]')) b.classList.toggle('down', touch.has(b.dataset.ctl));
      if (G.state === 'play' && G.bannerT > 0 && touch.size) G.bannerT = Math.min(G.bannerT, 0.6);
    };
    $('pads').addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (G.demoMode && G.state === 'play') { stopDemo(); return; }
      const c = ctlAt(e.clientX, e.clientY);
      if (!c) return;
      e.preventDefault();
      pointers.set(e.pointerId, c);
      refresh();
    });
    window.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const c = ctlAt(e.clientX, e.clientY);
      // slide between buttons of the same pad; keep the last one when the finger drifts off
      if (c && c !== pointers.get(e.pointerId)) { pointers.set(e.pointerId, c); refresh(); }
    });
    const up = (e) => { if (pointers.delete(e.pointerId)) refresh(); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // the first touch anywhere shows the pads on devices that didn't say they had touch
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !G.touch) {
        G.touch = true;
        if (G.state === 'play') { setupPads(); layoutInsets(); }
      }
    }, true);
  }

  function stopDemo() {
    sfx('click');
    startLevel(G.level);
  }

  // ---------------------------------------------------------------- buttons
  function tap(id, fn) {
    $(id).addEventListener('click', (e) => {
      e.preventDefault();
      Kit.sound.init();
      fn(e);
      $(id).blur();
    });
  }
  function fastTap(id, fn) {
    // in-game buttons react on press, not release
    $(id).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Kit.sound.init();
      fn(e);
    });
  }

  function bindUi() {
    tap('play1', () => { G.mode = '1p'; save.mode = '1p'; persist(); sfx('click'); showSelect(); });
    tap('play2', () => { G.mode = '2p'; save.mode = '2p'; persist(); sfx('click'); showSelect(); });
    tap('backTitle', () => { sfx('click'); goTitle(); });
    tap('unlockAll', () => { save.unlockAll = !save.unlockAll; persist(); sfx('click'); buildGrid(); });
    for (const b of $('modeSeg').children) {
      b.addEventListener('click', () => { Kit.sound.init(); G.mode = b.dataset.mode; save.mode = G.mode; persist(); sfx('click'); buildGrid(); });
    }
    fastTap('buddyBtn', callCompanion);
    fastTap('swapBtn', swap);
    fastTap('pauseBtn', () => (G.state === 'play' ? pause() : resume()));
    fastTap('restartBtn', () => { sfx('click'); restart(); });
    fastTap('muteBtn', toggleMute);
    tap('muteBtn2', toggleMute);
    tap('muteBtn3', toggleMute);
    tap('resume', resume);
    tap('pRestart', () => { sfx('click'); startLevel(G.level); });
    tap('pDemo', () => { sfx('click'); startLevel(G.level, { demo: true }); });
    tap('pLevels', () => { sfx('click'); showSelect(); });
    tap('pTitle', () => { sfx('click'); goTitle(); });
    tap('wNext', winNext);
    tap('wAgain', () => { sfx('click'); startLevel(G.level); });
    tap('wLevels', () => { sfx('click'); showSelect(); });
    // tapping the game during a demo stops it
    $('game').addEventListener('pointerdown', () => { Kit.sound.init(); if (G.demoMode && G.state === 'play') stopDemo(); });
  }

  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    updateMute();
  }
  function updateMute() {
    const m = Kit.sound.isMuted() ? '🔇' : '🔊';
    for (const id of ['muteBtn', 'muteBtn2', 'muteBtn3']) $(id).textContent = m;
  }

  // ---------------------------------------------------------------- test hooks
  // The Browser pane throttles requestAnimationFrame when hidden, so tests drive the game with step().
  window.game = {
    G, LEVELS,
    get sim() { return G.sim; },
    get view() { return view; },
    start(i, mode) { if (mode) G.mode = mode; startLevel(i - 1); return this.state(); },
    demo(i) { startLevel(i - 1, { demo: true }); return this.state(); },
    step(seconds = 1 / 60, opts = {}) {
      checkSize();
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) tick(1 / 60, opts.render !== false && i === n - 1);
      if (opts.render === false) view.render();
      return this.state();
    },
    hold(on = true) { G.hold = on; return G.hold; },
    keepAwake() { G.autoPause = false; },
    press(code, down = true) { if (down) keys.add(code); else keys.delete(code); },
    touch(ctl, down = true) { if (down) touch.add(ctl); else touch.delete(ctl); },
    call: () => callCompanion(),
    swap: () => swap(),
    pause, resume, restart, title: goTitle, select: showSelect,
    // play a level's scripted solution headlessly with the real sim (no drawing): proves it can be finished
    solve(i, mode) { const r = CB.runSolution(LEVELS[i - 1], { mode: mode || '2p' }); return { level: i, mode: mode || '2p', ok: r.ok && r.gems.all, msg: r.msg, time: r.time, gems: r.gems }; },
    solveAll() { return LEVELS.flatMap((_, i) => [this.solve(i + 1, '2p'), this.solve(i + 1, '1p')]); },
    state() {
      const s = G.sim;
      if (!s) return { state: G.state };
      const b = (id) => ({ x: +s.bros[id].x.toFixed(2), y: +s.bros[id].y.toFixed(2), state: s.bros[id].state, ground: !!s.bros[id].ground });
      return {
        state: G.state, level: G.level + 1, mode: s.mode, active: s.active, time: +s.time.toFixed(2), won: s.won,
        teddy: b('teddy'), tommy: b('tommy'), helper: s.helper.on ? { who: s.helper.who, t: +s.helper.t.toFixed(2), phase: s.helper.phase, plate: s.helper.plate && s.helper.plate.ch } : null,
        gems: s.gemCount(), attract: G.attract, demo: G.demoMode,
      };
    },
    save,
  };

  boot();
})();
