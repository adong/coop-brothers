/* Co-op Brothers: the Three.js view. Builds the cosy temple for a level (stone blocks, grass, pools, gates, plates,
   levers, doors, lifts, crates, gems, flags and the two exit doors), the two brothers, and draws the sim each frame.
   Exposes CB.View. The sim (js/sim.js) owns all the rules; this file only looks at it. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, A = CB.art, C = CB.COLORS;
  const TL = CB.TILE;
  const DEPTH = 1.4; // how deep a stone block is (z), the brothers walk along z = 0

  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const easeOutBack = (x) => { const c = 1.7; x = Math.min(1, Math.max(0, x)); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  const hex = (c) => new T.Color(c);

  // ------------------------------------------------------------------ particles
  function makeParticles(scene, max) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), alpha = new Float32Array(max), size = new Float32Array(max);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('pcolor', new T.BufferAttribute(col, 3));
    geo.setAttribute('alpha', new T.BufferAttribute(alpha, 1));
    geo.setAttribute('size', new T.BufferAttribute(size, 1));
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: G.dotTexture() }, scale: { value: 400 } },
      vertexShader: `attribute float alpha; attribute float size; attribute vec3 pcolor; uniform float scale;
        varying float vA; varying vec3 vC;
        void main() { vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`,
      transparent: true, depthWrite: false,
    });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    scene.add(pts);
    const P = [];
    for (let i = 0; i < max; i++) P.push({ life: 0 });
    let next = 0;
    const c = new T.Color();
    return {
      mat,
      emit(x, y, z, n, o = {}) {
        for (let i = 0; i < n; i++) {
          const p = P[next];
          next = (next + 1) % max;
          const a = Math.random() * Math.PI * 2, s = (o.speed || 2) * (0.4 + Math.random() * 0.8);
          const sp = o.spread || 0.2;
          p.x = x + (Math.random() - 0.5) * sp * 2;
          p.y = y + (Math.random() - 0.5) * sp;
          p.z = z + (Math.random() - 0.5) * sp;
          p.vx = Math.cos(a) * s * (o.flat ? 1 : 0.8);
          p.vy = (o.flat ? 0 : Math.sin(a) * s * 0.6) + (o.up || 0) * (0.6 + Math.random() * 0.6);
          p.vz = (Math.random() - 0.5) * s * 0.6;
          p.life = p.max = (o.life || 0.6) * (0.7 + Math.random() * 0.6);
          p.g = o.gravity !== undefined ? o.gravity : 6;
          p.drag = o.drag || 1.5;
          p.size = (o.size || 0.18) * (0.6 + Math.random() * 0.8);
          const cols = Array.isArray(o.color) ? o.color : [o.color || '#ffffff'];
          c.set(cols[Math.floor(Math.random() * cols.length)]);
          p.r = c.r; p.gg = c.g; p.b = c.b;
        }
      },
      update(dt) {
        for (let i = 0; i < max; i++) {
          const p = P[i];
          if (p.life > 0) {
            p.life -= dt;
            p.vy -= p.g * dt;
            const d = Math.exp(-p.drag * dt);
            p.vx *= d; p.vz *= d;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
            col[i * 3] = p.r; col[i * 3 + 1] = p.gg; col[i * 3 + 2] = p.b;
            alpha[i] = Math.max(0, Math.min(1, (p.life / p.max) * 1.6));
            size[i] = p.size;
          } else alpha[i] = 0;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.pcolor.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
      },
      clear() { for (const p of P) p.life = 0; },
    };
  }

  // ------------------------------------------------------------------ the brothers
  const SCALE = { teddy: 0.78, tommy: 0.7 };

  function makeBro(id) {
    const entry = Kit.roster.get(id);
    const p = Kit.people.build(entry.look);
    p.root.scale.setScalar(SCALE[id]);
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const g = new T.Group();
    g.add(p.root);
    const tag = G.nameTag(entry.name, C[id + 'Tag']);
    tag.scale.multiplyScalar(0.62);
    tag.position.y = SCALE[id] * 2 + 0.55;
    tag.renderOrder = 6;
    g.add(tag);
    const glow = new T.Mesh(new T.PlaneGeometry(1.3, 0.7), new T.MeshBasicMaterial({
      map: G.glowTexture(), color: C[id], transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false,
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    g.add(glow);
    // the "this is you" arrow in single player
    const [ac, ag] = G.makeCanvas(64, 64);
    ag.fillStyle = C[id];
    ag.strokeStyle = '#14121f';
    ag.lineWidth = 6;
    ag.beginPath(); ag.moveTo(8, 12); ag.lineTo(56, 12); ag.lineTo(32, 54); ag.closePath(); ag.fill(); ag.stroke();
    const arrow = new T.Sprite(new T.SpriteMaterial({ map: G.toTexture(ac), depthWrite: false }));
    arrow.scale.set(0.45, 0.45, 1);
    arrow.position.y = tag.position.y + 0.5;
    arrow.renderOrder = 6;
    g.add(arrow);
    return { id, entry, p, g, tag, glow, arrow, ph: Math.random() * 6, rot: id === 'teddy' ? -2 : 2, mode: '', modeT: 0, shot: false };
  }

  function makeSprite(emoji, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(emoji), depthWrite: false }));
    s.scale.setScalar(size);
    s.renderOrder = 7;
    return s;
  }

  // ------------------------------------------------------------------ the view
  function View(canvas) {
    const r = (this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene();
    this.scene.background = hex('#3b2617');
    this.camera = new T.PerspectiveCamera(30, 1, 0.5, 500);
    this.scene.add(new T.HemisphereLight('#fff1d6', '#7a5638', 0.85));
    const sun = (this.sun = new T.DirectionalLight('#ffe4b8', 1.05));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    const fill = new T.DirectionalLight('#ffd9a8', 0.25);
    fill.position.set(10, 5, 20);
    this.scene.add(fill);
    this.fx = makeParticles(this.scene, 900);
    this.bros = { teddy: makeBro('teddy'), tommy: makeBro('tommy') };
    for (const id in this.bros) this.scene.add(this.bros[id].g);
    this.insets = { top: 64, bottom: 20, left: 10, right: 10 };
    this.flights = [];
    this.time = 0;
    this.camState = null;
    this.focus = null;
    this.onSwish = null;
    this.size = [1, 1];
  }

  View.prototype.resize = function (w, h) {
    if (!w || !h) return;
    this.size = [w, h];
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.mat.uniforms.scale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  };

  View.prototype.dispose = function () {
    if (!this.level) return;
    this.scene.remove(this.level);
    this.level.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.level = null;
  };

  // ------------------------------------------------------------------ building a level
  View.prototype.load = function (sim, index) {
    this.dispose();
    this.fx.clear();
    for (const f of this.flights) if (f.sprite.parent) f.sprite.parent.remove(f.sprite);
    this.flights = [];
    const L = sim.L, grid = L.grid, W = L.W, H = L.H;
    const lv = (this.level = new T.Group());
    this.scene.add(lv);
    this.sim = sim;
    this.index = index || 0;
    const rand = A.rng(1234 + this.index * 77);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? TL.SOLID : grid[y][x]);
    const isPool = (t) => t === TL.POOL_T || t === TL.POOL_M || t === TL.POOL_J;
    const occupied = {};
    for (const o of L.objects) for (let x = o.x0; x < o.x0 + o.w; x++) for (let y = o.y0; y < o.y0 + o.h; y++) occupied[x + ',' + y] = o.t;
    const m4 = new T.Matrix4(), col = new T.Color();

    // the back wall
    const wallTex = A.wall();
    const wallMat = new T.MeshStandardMaterial({ map: wallTex, color: '#c79b72', roughness: 1 });
    const wallGeo = new T.PlaneGeometry(W + 80, H + 50);
    const uv = wallGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (W + 80)) / 2, (uv.getY(i) * (H + 50)) / 2);
    const back = new T.Mesh(wallGeo, wallMat);
    back.position.set(W / 2, H / 2, -DEPTH / 2 - 0.02);
    back.receiveShadow = true;
    lv.add(back);

    // stone blocks
    const solids = [], pools = [], plats = [], grassy = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = grid[y][x];
        if (t === TL.SOLID) {
          solids.push([x, y]);
          const up = at(x, y + 1);
          if (y + 1 < H && up !== TL.SOLID && !isPool(up) && occupied[x + ',' + (y + 1)] !== 'door') grassy.push([x, y]);
        } else if (isPool(t)) pools.push([x, y, t]);
        else if (t === TL.PLAT) plats.push([x, y]);
      }
    }
    const stoneMat = new T.MeshStandardMaterial({ map: A.stone(), roughness: 0.92 });
    const tiles = new T.InstancedMesh(new T.BoxGeometry(1, 1, DEPTH), stoneMat, solids.length);
    solids.forEach(([x, y], i) => {
      m4.makeTranslation(x + 0.5, y + 0.5, 0);
      tiles.setMatrixAt(i, m4);
      const l = 0.84 + rand() * 0.18;
      col.setRGB(l, l * (0.96 + rand() * 0.05), l * (0.9 + rand() * 0.08));
      tiles.setColorAt(i, col);
    });
    tiles.castShadow = tiles.receiveShadow = true;
    lv.add(tiles);

    if (grassy.length) {
      const grassMat = new T.MeshStandardMaterial({ map: A.grassTop(), roughness: 1 });
      const grass = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.1, DEPTH + 0.04), grassMat, grassy.length);
      const fr = new T.InstancedMesh(new T.PlaneGeometry(1.02, 0.28), new T.MeshStandardMaterial({ map: A.fringe(), transparent: true, alphaTest: 0.4, roughness: 1, side: T.DoubleSide }), grassy.length);
      grassy.forEach(([x, y], i) => {
        m4.makeTranslation(x + 0.5, y + 1.03, 0);
        grass.setMatrixAt(i, m4);
        m4.makeTranslation(x + 0.5, y + 0.95, DEPTH / 2 + 0.025);
        fr.setMatrixAt(i, m4);
      });
      grass.receiveShadow = true;
      fr.receiveShadow = true;
      lv.add(grass, fr);
    }

    if (plats.length) {
      const pm = new T.MeshStandardMaterial({ map: A.plank(), color: '#ffd9a8', roughness: 0.85 });
      const pl = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.26, 1.15), pm, plats.length);
      plats.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, y + 0.87, 0); pl.setMatrixAt(i, m4); });
      pl.castShadow = pl.receiveShadow = true;
      lv.add(pl);
    }

    // pools: a stone basin with translucent juice, jelly or minty water, rippling, with its owner's emoji bobbing
    this.poolsV = [];
    if (pools.length) {
      // its own material: sharing one between instanced meshes with and without per-instance colours draws black
      const basin = new T.InstancedMesh(new T.BoxGeometry(1, 0.34, DEPTH), new T.MeshStandardMaterial({ map: A.stone(), color: '#d9c2a0', roughness: 0.92 }), pools.length);
      pools.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, y + 0.17, 0); basin.setMatrixAt(i, m4); });
      basin.receiveShadow = true;
      lv.add(basin);
      const runs = [];
      for (const [x, y, t] of pools) {
        const last = runs[runs.length - 1];
        if (last && last.y === y && last.t === t && last.x1 === x - 1) last.x1 = x;
        else runs.push({ x0: x, x1: x, y, t });
      }
      for (const r of runs) {
        const w = r.x1 - r.x0 + 1, kind = r.t === TL.POOL_T ? 'teddy' : r.t === TL.POOL_M ? 'tommy' : 'jelly';
        const base = C[kind], light = C[kind + 'Light'];
        const liquid = new T.Mesh(new T.BoxGeometry(w, 0.6, DEPTH - 0.06), new T.MeshStandardMaterial({
          color: base, emissive: base, emissiveIntensity: 0.25, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.05,
        }));
        liquid.position.set(r.x0 + w / 2, r.y + 0.64, 0);
        const tex = A.ripples(base, light).clone();
        tex.needsUpdate = true;
        tex.repeat.set(w, 1);
        const surf = new T.Mesh(new T.PlaneGeometry(w, DEPTH - 0.06), new T.MeshStandardMaterial({
          map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.95,
        }));
        surf.rotation.x = -Math.PI / 2;
        surf.position.set(r.x0 + w / 2, r.y + 0.945, 0);
        surf.receiveShadow = true;
        const emo = makeSprite(kind === 'teddy' ? '🏀' : kind === 'tommy' ? '✌️' : '🍇', 0.62);
        emo.position.set(r.x0 + w / 2, r.y + 0.62, DEPTH / 2 + 0.08);
        lv.add(liquid, surf, emo);
        this.poolsV.push({ r, w, kind, tex, emo, light, bubbleT: rand() });
      }
    }

    // coloured gates: only the brother of that colour walks through
    this.gatesV = [];
    const gateSeen = {};
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const t = grid[y][x];
        if ((t !== TL.GATE_T && t !== TL.GATE_M) || gateSeen[x + ',' + y]) continue;
        let y1 = y;
        while (at(x, y1 + 1) === t) y1++;
        for (let k = y; k <= y1; k++) gateSeen[x + ',' + k] = true;
        const who = t === TL.GATE_T ? 'teddy' : 'tommy', h = y1 - y + 1;
        const tex = A.gateBars(C[who]).clone();
        tex.needsUpdate = true;
        tex.repeat.set(1, h);
        const panel = new T.Mesh(new T.BoxGeometry(0.86, h, 0.3), new T.MeshStandardMaterial({
          map: tex, color: '#ffffff', emissive: C[who], emissiveIntensity: 0.55, transparent: true, opacity: 0.8, depthWrite: false,
        }));
        panel.position.set(x + 0.5, y + h / 2, 0);
        const posts = new T.MeshStandardMaterial({ color: C[who + 'Deep'], roughness: 0.5 });
        G.mesh(new T.BoxGeometry(1, 0.14, 0.5), posts, x + 0.5, y + 0.07, 0, lv);
        G.mesh(new T.BoxGeometry(1, 0.14, 0.5), posts, x + 0.5, y + h - 0.07, 0, lv);
        const emo = makeSprite(C[who + 'Emoji'], 0.55);
        emo.position.set(x + 0.5, y + h / 2, 0.3);
        lv.add(panel, emo);
        this.gatesV.push({ panel, emo, tex, who, x, y, h });
      }
    }

    // link colours for plates, levers, doors and lifts (buttons for one brother use his colour instead)
    const linkCol = {};
    let ci = 0;
    for (const k of L.links) {
      const plates = L.objects.filter((o) => o.t === 'plate' && o.link === k);
      if (plates.length && plates.every((p) => p.who)) continue;
      linkCol[k] = CB.LINK_COLORS[ci++ % CB.LINK_COLORS.length];
    }
    this.linkCol = linkCol;
    const styleOf = (o) => {
      if (o.who) return { c: C[o.who], sym: C[o.who + 'Emoji'], emoji: true };
      return linkCol[o.link] || { c: '#dddddd', sym: '' };
    };

    // pressure plates
    this.platesV = sim.plates.map((p) => {
      const st = styleOf(p);
      const g = new T.Group();
      g.position.set(p.x0 + p.w / 2, p.y0, 0);
      G.mesh(new T.BoxGeometry(p.w - 0.1, 0.08, 0.95), new T.MeshStandardMaterial({ color: '#5b4a3a', roughness: 0.7 }), 0, 0.04, 0, g, false).receiveShadow = true;
      const topTex = A.badgeTex(st.c, st.sym, st.emoji);
      const plain = new T.MeshStandardMaterial({ color: st.c, roughness: 0.4, emissive: st.c, emissiveIntensity: 0.15 });
      const face = new T.MeshStandardMaterial({ map: topTex, roughness: 0.4, emissive: '#ffffff', emissiveMap: topTex, emissiveIntensity: 0.15 });
      const top = G.mesh(new T.BoxGeometry(p.w - 0.26, 0.1, 0.8), [plain, plain, face, plain, face, plain], 0, 0.13, 0, g, false);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: st.c, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      glow.scale.set(p.w + 0.6, 0.8, 1);
      glow.position.set(0, 0.3, 0.2);
      g.add(glow);
      lv.add(g);
      return { p, g, top, glow, mats: [plain, face] };
    });

    // levers
    this.leversV = sim.levers.map((l) => {
      const st = styleOf(l);
      const g = new T.Group();
      g.position.set(l.x0 + 0.5, l.y0, -0.1);
      G.mesh(new T.BoxGeometry(0.6, 0.22, 0.5), new T.MeshStandardMaterial({ color: '#6e5a48', roughness: 0.7 }), 0, 0.11, 0, g);
      const arm = new T.Group();
      arm.position.y = 0.2;
      g.add(arm);
      G.mesh(new T.BoxGeometry(0.08, 0.7, 0.08), new T.MeshStandardMaterial({ color: '#3f3a36', metalness: 0.4, roughness: 0.4 }), 0, 0.35, 0, arm);
      G.mesh(new T.SphereGeometry(0.13, 16, 12), new T.MeshStandardMaterial({ color: st.c, roughness: 0.3, emissive: st.c, emissiveIntensity: 0.2 }), 0, 0.72, 0, arm);
      lv.add(g);
      return { l, g, arm };
    });

    // doors (slide into the stone when open), bridges (slide sideways)
    this.doorsV = sim.doors.map((d) => {
      const horiz = d.w > d.h;
      const split = !!d.need && d.need.length > 1 && d.need.every((k) => !linkCol[k]);
      const st = split ? { c: '#ffffff', sym: '🏀✌️' } : linkCol[d.link] || linkCol[(d.need || [])[0]] || { c: '#ddd', sym: '' };
      let mats;
      if (horiz) {
        const tex = A.plank().clone();
        tex.needsUpdate = true;
        tex.wrapS = T.RepeatWrapping;
        tex.repeat.set(d.w / 2, 1);
        const pm = new T.MeshStandardMaterial({ map: tex, roughness: 0.8 });
        const band = new T.MeshStandardMaterial({ color: st.c, roughness: 0.5, emissive: st.c, emissiveIntensity: 0.2 });
        mats = [band, band, pm, pm, pm, pm];
      } else {
        const tex = A.doorTex(st.c, st.sym, d.w, d.h, split);
        const face = new T.MeshStandardMaterial({ map: tex, roughness: 0.75 });
        const side = new T.MeshStandardMaterial({ color: '#6e4526', roughness: 0.8 });
        mats = [side, side, side, side, face, face];
      }
      const m = new T.Mesh(new T.BoxGeometry(d.w - (horiz ? 0 : 0.06), d.h - (horiz ? 0.08 : 0), horiz ? 1.2 : 1.0), mats);
      m.castShadow = m.receiveShadow = true;
      lv.add(m);
      return { d, m };
    });

    // lifts
    this.liftsV = sim.lifts.map((lf) => {
      const st = lf.link ? linkCol[lf.link] || { c: '#ddd' } : { c: '#fff1c9' };
      const tex = A.plank().clone();
      tex.needsUpdate = true;
      tex.wrapS = T.RepeatWrapping;
      tex.repeat.set(lf.w / 2, 1);
      const pm = new T.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const g = new T.Group();
      const body = G.mesh(new T.BoxGeometry(lf.w, 0.4, 1.25), pm, lf.w / 2, 0.2, 0, g);
      body.receiveShadow = true;
      G.mesh(new T.BoxGeometry(lf.w + 0.04, 0.12, 0.08), new T.MeshStandardMaterial({ color: st.c, emissive: st.c, emissiveIntensity: 0.3 }), lf.w / 2, 0.18, 0.64, g, false);
      lv.add(g);
      return { lf, g };
    });

    // crates
    const crateMat = new T.MeshStandardMaterial({ map: A.crate(), roughness: 0.85 });
    this.boxesV = sim.boxes.map((b) => {
      const m = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.w), crateMat);
      m.castShadow = m.receiveShadow = true;
      lv.add(m);
      return { b, m };
    });

    // gems
    const gemGeo = new T.OctahedronGeometry(0.31, 0);
    gemGeo.scale(1, 1.35, 1);
    const gemMat = {
      teddy: new T.MeshStandardMaterial({ color: C.teddy, emissive: C.teddyDeep, emissiveIntensity: 0.6, metalness: 0.25, roughness: 0.15, flatShading: true }),
      tommy: new T.MeshStandardMaterial({ color: C.tommy, emissive: C.tommyDeep, emissiveIntensity: 0.6, metalness: 0.25, roughness: 0.15, flatShading: true }),
    };
    this.gemsV = sim.gems.map((gm, i) => {
      const g = new T.Group();
      g.position.set(gm.x, gm.y, 0);
      const m = new T.Mesh(gemGeo, gemMat[gm.who]);
      m.castShadow = true;
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: C[gm.who], blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
      glow.scale.setScalar(1.0);
      glow.position.z = -0.15;
      g.add(glow, m);
      lv.add(g);
      return { gm, g, m, ph: i * 1.3, gone: 0 };
    });

    // checkpoint flags: a pennant in each brother's colour runs up the pole when he touches it
    this.flagsV = sim.flags.map((f) => {
      const g = new T.Group();
      g.position.set(f.x, f.y, -0.45);
      G.mesh(new T.CylinderGeometry(0.04, 0.05, 2.1, 8), new T.MeshStandardMaterial({ color: '#e9e2d4', metalness: 0.3, roughness: 0.4 }), 0, 1.05, 0, g);
      G.mesh(new T.CylinderGeometry(0.18, 0.22, 0.12, 12), new T.MeshStandardMaterial({ color: '#7a6a5a' }), 0, 0.06, 0, g);
      G.mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.5, roughness: 0.3 }), 0, 2.13, 0, g);
      const tri = new T.BufferGeometry();
      tri.setAttribute('position', new T.Float32BufferAttribute([0, 0.18, 0, 0, -0.18, 0, 0.62, 0, 0], 3));
      tri.computeVertexNormals();
      const pen = {};
      for (const [id, k] of [['teddy', 0], ['tommy', 1]]) {
        const m = new T.Mesh(tri, new T.MeshStandardMaterial({ color: C[id], side: T.DoubleSide, roughness: 0.6 }));
        m.position.set(0.04, 0.35 + k * 0.05, 0.02 + k * 0.03);
        g.add(m);
        pen[id] = { m, h: 0.35 };
      }
      lv.add(g);
      return { f, g, pen };
    });

    // exit doors, with a hoop over Teddy's if there's room
    this.exitsV = {};
    for (const id of ['teddy', 'tommy']) {
      const ex = L.exits[id];
      const g = new T.Group();
      g.position.set(ex.x, ex.y, -DEPTH / 2 + 0.06);
      const plane = new T.Mesh(new T.PlaneGeometry(1.5, 2.25), new T.MeshStandardMaterial({ map: A.exitTex(id), transparent: true, alphaTest: 0.1, roughness: 0.8 }));
      plane.position.y = 1.125;
      plane.receiveShadow = true;
      g.add(plane);
      const light = new T.Mesh(new T.PlaneGeometry(1.08, 1.9), new T.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false }));
      light.position.set(0, 1.0, 0.02);
      g.add(light);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: C[id], blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 }));
      halo.scale.set(2.6, 3.2, 1);
      halo.position.set(0, 1.15, -0.02);
      g.add(halo);
      let hoop = null;
      let room = 0;
      for (let y = ex.y; y < H && at(Math.floor(ex.x), y) !== TL.SOLID; y++) room++;
      if (id === 'teddy' && room >= 4) {
        hoop = new T.Group();
        hoop.position.set(0, 3.05, 0.1);
        const bb = A.badgeTex('#ffffff', '', false);
        G.mesh(new T.BoxGeometry(0.95, 0.62, 0.05), new T.MeshStandardMaterial({ map: bb, color: '#ffffff', roughness: 0.4 }), 0, 0.2, 0, hoop);
        G.mesh(new T.BoxGeometry(0.4, 0.3, 0.06), new T.MeshStandardMaterial({ color: '#ff7a1a' }), 0, 0.1, 0.01, hoop).scale.set(1, 1, 0.5);
        const rim = new T.Mesh(new T.TorusGeometry(0.2, 0.025, 8, 24), new T.MeshStandardMaterial({ color: '#ff5a1a', metalness: 0.3, roughness: 0.4 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, -0.05, 0.25);
        hoop.add(rim);
        const net = new T.Mesh(new T.CylinderGeometry(0.2, 0.13, 0.3, 14, 1, true), new T.MeshBasicMaterial({ map: A.netTex(), transparent: true, side: T.DoubleSide, depthWrite: false }));
        net.position.set(0, -0.21, 0.25);
        hoop.add(net);
        g.add(hoop);
      }
      lv.add(g);
      this.exitsV[id] = { g, light, halo, hoop, ex, open: 0 };
    }

    this.decorate(sim, at, occupied, rand, lv);

    // shadows cover the whole level
    const s = this.sun;
    s.position.set(W / 2 - 6, H / 2 + 14, 22);
    s.target.position.set(W / 2, H / 2, 0);
    const half = Math.max(W, H) * 0.62 + 2;
    Object.assign(s.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 80 });
    s.shadow.camera.updateProjectionMatrix();

    // the brothers
    for (const id in this.bros) {
      const v = this.bros[id];
      v.treat = null;
      v.mode = '';
      v.g.visible = true;
      v.p.root.scale.setScalar(SCALE[id]);
    }
    this.camState = null;
    this.focus = null;
    this.follow = false;
    this.won = false;
    this.fit(true);
  };

  // Windows, carved plaques, hanging lanterns and vines on the back wall, placed in empty space.
  View.prototype.decorate = function (sim, at, occupied, rand, lv) {
    const L = sim.L, W = L.W, H = L.H;
    const used = {};
    const empty = (x, y) => at(x, y) === TL.E && !occupied[x + ',' + y];
    const boxFree = (x0, y0, w, h) => {
      for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) if (!empty(x, y) || used[x + ',' + y]) return false;
      return true;
    };
    const mark = (x0, y0, w, h) => { for (let x = x0 - 1; x < x0 + w + 1; x++) for (let y = y0 - 1; y < y0 + h + 1; y++) used[x + ',' + y] = true; };
    const spots = (w, h) => {
      const out = [];
      for (let y = 1; y < H - h; y++) for (let x = 1; x < W - w; x++) if (boxFree(x, y, w, h)) out.push([x, y]);
      return out;
    };
    const take = (w, h, n, make) => {
      for (let i = 0; i < n; i++) {
        const s = spots(w, h);
        if (!s.length) return;
        const [x, y] = s[Math.floor(rand() * s.length)];
        mark(x, y, w, h);
        make(x, y);
      }
    };
    const z = -DEPTH / 2 + 0.01;
    const winMat = new T.MeshStandardMaterial({ map: A.windowTex(), transparent: true, alphaTest: 0.1, emissive: '#ffffff', emissiveMap: A.windowTex(), emissiveIntensity: 0.35, roughness: 1 });
    take(3, 4, Math.max(1, Math.round((W * H) / 220)), (x, y) => {
      const m = new T.Mesh(new T.PlaneGeometry(2.3, 3.45), winMat);
      m.position.set(x + 1.5, y + 2, z);
      lv.add(m);
    });
    let k = 0;
    take(2, 2, 2, (x, y) => {
      const m = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshStandardMaterial({ map: A.plaqueTex(k++ % 2 ? '✌️' : '🏀'), transparent: true, alphaTest: 0.1, roughness: 1 }));
      m.position.set(x + 1, y + 1, z);
      lv.add(m);
    });
    // lanterns hang from ceilings
    this.lanterns = [];
    const lanTex = A.lanternTex();
    const lanSpots = [];
    for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (at(x, y + 1) === TL.SOLID && empty(x, y) && empty(x, y - 1) && !used[x + ',' + y]) lanSpots.push([x, y]);
    for (let i = 0; i < Math.min(6, Math.round(W / 6)) && lanSpots.length; i++) {
      const j = Math.floor(rand() * lanSpots.length);
      const [x, y] = lanSpots.splice(j, 1)[0];
      if (lanSpots.some(([a, b]) => Math.abs(a - x) < 3 && b === y)) for (let q = lanSpots.length - 1; q >= 0; q--) if (Math.abs(lanSpots[q][0] - x) < 4 && lanSpots[q][1] === y) lanSpots.splice(q, 1);
      const g = new T.Group();
      g.position.set(x + 0.5, y + 1, -0.45);
      const s = new T.Sprite(new T.SpriteMaterial({ map: lanTex, depthWrite: false }));
      s.scale.set(0.42, 0.63, 1);
      s.position.y = -0.36;
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#ffb347', blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
      glow.scale.setScalar(1.6);
      glow.position.y = -0.38;
      g.add(glow, s);
      lv.add(g);
      this.lanterns.push({ g, ph: rand() * 6 });
    }
    // vines hang from the undersides of blocks
    const vineMat = new T.MeshStandardMaterial({ map: A.vineTex(), transparent: true, alphaTest: 0.35, side: T.DoubleSide, roughness: 1 });
    let vines = 0;
    for (let y = 2; y < H - 1 && vines < 14; y++) {
      for (let x = 1; x < W - 1 && vines < 14; x++) {
        if (at(x, y) === TL.SOLID && empty(x, y - 1) && rand() < 0.16) {
          const len = 0.9 + rand() * 1.1;
          const m = new T.Mesh(new T.PlaneGeometry(0.35, len), vineMat);
          m.position.set(x + 0.3 + rand() * 0.4, y - len / 2 + 0.05, -DEPTH / 2 + 0.06);
          lv.add(m);
          vines++;
        }
      }
    }
  };

  // ------------------------------------------------------------------ the camera
  // Frame the level in the part of the screen the HUD and touch buttons leave free. With `follow` on, big levels
  // are framed around both brothers (or the one you steer, plus a visiting helper) with at least 20 x 12 tiles in
  // view, so they stay big on an iPad; it never zooms out past the whole level. On a win it glides in to the doors.
  View.prototype.fit = function (snap, dt) {
    const sim = this.sim;
    if (!sim) return;
    const [w, h] = this.size, L = sim.L, ins = this.insets;
    const fov = (this.camera.fov * Math.PI) / 180, aspect = w / h;
    const fy = Math.max(0.3, (h - ins.top - ins.bottom) / h), fx = Math.max(0.3, (w - ins.left - ins.right) / w);
    const full = Math.max((L.H + 0.3) / fy, (L.W + 0.3) / (aspect * fx));
    let cx = L.W / 2, cy = L.H / 2, ext = full;
    if (this.focus) {
      const f = this.focus;
      cx = f.x;
      cy = f.y;
      ext = Math.max(f.h / fy, f.w / (aspect * fx));
    } else if (this.follow) {
      const ids = sim.mode === '1p' ? [sim.active].concat(sim.helper.on ? [sim.helper.who] : []) : ['teddy', 'tommy'];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const id of ids) {
        const b = sim.bros[id];
        x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y);
      }
      const rw = Math.max(x1 - x0 + 10, 20), rh = Math.max(y1 - y0 + 6.5, 12);
      ext = Math.min(full, Math.max(rh / fy, rw / (aspect * fx)));
      const vw = ext * aspect * fx, vh = ext * fy;
      cx = vw >= L.W ? L.W / 2 : Math.max(vw / 2 - 0.15, Math.min(L.W - vw / 2 + 0.15, (x0 + x1) / 2));
      cy = vh >= L.H ? L.H / 2 : Math.max(vh / 2 - 0.15, Math.min(L.H - vh / 2 + 0.15, (y0 + y1) / 2 + 1.2));
    }
    const shiftY = ((ins.bottom - ins.top) / (2 * h)) * ext;
    const shiftX = ((ins.right - ins.left) / (2 * w)) * ext * aspect;
    const dist = ext / 2 / Math.tan(fov / 2) + DEPTH / 2;
    const target = { x: cx + shiftX, y: cy - shiftY, d: dist };
    const c = this.camState;
    if (!c || snap) this.camState = { ...target };
    else {
      const k = damp(this.focus ? 2.2 : this.follow ? 3.2 : 6, dt || 0.016);
      c.x += (target.x - c.x) * k;
      c.y += (target.y - c.y) * k;
      c.d += (target.d - c.d) * k;
    }
    const s = this.camState;
    this.camera.position.set(s.x, s.y + s.d * 0.05, s.d);
    this.camera.lookAt(s.x, s.y, 0);
    this.camera.updateMatrixWorld();
  };

  // ------------------------------------------------------------------ effects
  View.prototype.event = function (e) {
    const sim = this.sim, fx = this.fx;
    const bro = e.who && sim.bros[e.who];
    switch (e.type) {
      case 'jump':
        fx.emit(e.x, e.y + 0.05, 0.2, 6, { color: '#f3dcb8', speed: 1.5, up: 0.5, life: 0.35, gravity: 2, size: 0.16 });
        break;
      case 'land':
        fx.emit(e.x, e.y + 0.05, 0.2, 8, { color: '#f3dcb8', speed: 2, flat: true, life: 0.35, gravity: 0, size: 0.18 });
        break;
      case 'gem':
        fx.emit(e.x, e.y, 0.3, 22, { color: [C[e.who], C[e.who + 'Light'], '#ffffff'], speed: 4, up: 2, life: 0.7, gravity: 3, size: 0.2 });
        break;
      case 'splash': {
        const k = e.pool === 'teddy' ? 'teddy' : e.pool === 'tommy' ? 'tommy' : 'jelly';
        fx.emit(e.x, e.y + 0.1, 0.3, 40, { color: [C[k], C[k + 'Light'], '#ffffff'], speed: 4.5, up: 6, life: 0.9, gravity: 14, size: 0.24 });
        break;
      }
      case 'respawn':
        fx.emit(e.x, e.y + 0.8, 0.3, 30, { color: ['#ffffff', C[e.who + 'Light'], '#fff3a8'], speed: 3, up: 1, life: 0.6, gravity: 0, size: 0.22 });
        break;
      case 'saved':
        fx.emit(bro.x, bro.y + 0.8, 0.3, 30, { color: ['#ffffff', C[e.by], '#fff3a8'], speed: 3.5, up: 2, life: 0.8, gravity: 1, size: 0.24 });
        break;
      case 'plateOn': case 'lever': {
        const st = this.linkCol[e.link] || { c: '#ffffff' };
        fx.emit(e.x, e.y + 0.3, 0.3, 12, { color: [st.c, '#ffffff'], speed: 2.5, up: 2, life: 0.5, gravity: 4, size: 0.16 });
        break;
      }
      case 'latch':
        fx.emit(e.x, e.y, 0.5, 50, { color: [C.teddy, C.tommy, '#ffffff', '#ffd23f'], speed: 5, up: 2, life: 1.1, gravity: 2, size: 0.25 });
        break;
      case 'flag':
        fx.emit(e.x, e.y + 2, -0.3, 20, { color: [C[e.who], C[e.who + 'Light'], '#ffffff'], speed: 3, up: 2, life: 0.8, gravity: 4, size: 0.18 });
        break;
      case 'helper': case 'helperLand':
        fx.emit(bro.x, bro.y + 0.1, 0.2, 14, { color: ['#ffffff', C[e.who + 'Light']], speed: 2.5, up: 1, life: 0.45, gravity: 1, size: 0.2 });
        break;
      case 'treat':
        this.throwTreat(e.from, e.to);
        break;
      case 'highfive':
        for (const id of ['teddy', 'tommy']) {
          const b = sim.bros[id];
          const hand = makeSprite('✋', 0.7);
          this.scene.add(hand);
          this.flights.push({ kind: 'pop', sprite: hand, t: 0, dur: 1.4, x: b.x, y: b.y + 2.6 });
          fx.emit(b.x, b.y + 2.2, 0.3, 18, { color: ['#ffffff', '#ffd23f', C[id]], speed: 3, up: 2, life: 0.7, gravity: 3, size: 0.2 });
        }
        this.throwTreat('teddy', 'tommy');
        this.throwTreat('tommy', 'teddy');
        break;
      case 'win':
        this.celebrate();
        break;
      case 'swap':
        fx.emit(bro.x, bro.y + 1, 0.3, 20, { color: [C[e.who], '#ffffff'], speed: 3, up: 1, life: 0.5, gravity: 0, size: 0.2 });
        break;
      case 'boxLand':
        fx.emit(e.x, e.y + 0.05, 0.2, 10, { color: '#e8cfa6', speed: 2, flat: true, life: 0.4, gravity: 0, size: 0.2 });
        break;
    }
  };

  View.prototype.handPos = function (id, out) {
    const v = this.bros[id];
    v.g.updateMatrixWorld(true);
    return Kit.people.handWorld(v.p, 1, out || new T.Vector3());
  };

  // A treat arcs from one brother's hand into the other's, and he holds it for a while.
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  View.prototype.throwTreat = function (from, to) {
    const [emoji, label] = TREATS[Math.floor(Math.random() * TREATS.length)];
    const s = makeSprite(emoji, 0.55);
    const p0 = this.handPos(from);
    s.position.copy(p0);
    this.scene.add(s);
    this.flights.push({ kind: 'treat', sprite: s, t: 0, dur: 0.6 + Math.min(0.6, p0.distanceTo(this.handPos(to)) * 0.04), from: p0.clone(), to, emoji });
    const info = { emoji, label, from, to };
    (this.lastTreats = this.lastTreats || []).push(info);
    return info;
  };

  // Teddy's jump shot: a 🏀 from his hands to the hoop (or up and away), SWISH.
  View.prototype.shootBall = function (id, hoopPos) {
    const s = makeSprite('🏀', 0.42);
    const p0 = this.handPos(id);
    s.position.copy(p0);
    this.scene.add(s);
    const to = hoopPos ? hoopPos.clone() : p0.clone().add(new T.Vector3(this.sim.bros[id].face * 2.5, 3, 0));
    this.flights.push({ kind: 'ball', sprite: s, t: 0, dur: 0.75, from: p0.clone(), toV: to, hoop: !!hoopPos });
  };

  View.prototype.updateFlights = function (dt) {
    const tmp = new T.Vector3();
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      if (f.kind === 'treat') {
        const v = this.bros[f.to];
        if (f.held) {
          if (f.t > f.dur + 7 || v.treat !== f) {
            f.sprite.parent && f.sprite.parent.remove(f.sprite);
            this.flights.splice(i, 1);
            if (v.treat === f) v.treat = null;
          }
          continue;
        }
        this.handPos(f.to, tmp);
        f.sprite.position.lerpVectors(f.from, tmp, k);
        f.sprite.position.y += Math.sin(k * Math.PI) * 1.4;
        f.sprite.material.rotation = Math.sin(f.t * 10) * 0.2;
        if (k >= 1) {
          if (v.treat && v.treat.sprite.parent) v.treat.sprite.parent.remove(v.treat.sprite);
          f.held = true;
          v.treat = f;
          v.p.armR.add(f.sprite);
          f.sprite.position.set(0.18, -0.85, -0.25);
          f.sprite.scale.setScalar(0.55 / SCALE[f.to]);
          this.fx.emit(tmp.x, tmp.y, tmp.z, 12, { color: '#ffffff', speed: 2, up: 2, life: 0.4, gravity: 2, size: 0.14 });
        }
      } else if (f.kind === 'ball') {
        f.sprite.position.lerpVectors(f.from, f.toV, k);
        f.sprite.position.y += Math.sin(k * Math.PI) * 1.6;
        f.sprite.material.rotation = -f.t * 9;
        if (k >= 1) {
          const p = f.sprite.position;
          this.fx.emit(p.x, p.y, p.z, 24, { color: ['#ff9f1c', '#ffffff', '#ffd23f'], speed: 3, up: 1, life: 0.6, gravity: 4, size: 0.2 });
          this.scene.remove(f.sprite);
          this.flights.splice(i, 1);
          if (this.onSwish) this.onSwish(f.hoop);
        }
      } else if (f.kind === 'pop') {
        const s = f.sprite;
        s.position.set(f.x, f.y + k * 0.6, 0.5);
        s.scale.setScalar(0.8 * easeOutBack(Math.min(1, f.t / 0.25)));
        s.material.opacity = 1 - Math.max(0, (k - 0.7) / 0.3);
        if (k >= 1) {
          this.scene.remove(s);
          this.flights.splice(i, 1);
        }
      }
    }
  };

  View.prototype.celebrate = function () {
    this.won = true;
    this.winT = 0;
    const ex = this.sim.L.exits;
    const x0 = Math.min(ex.teddy.x, ex.tommy.x), x1 = Math.max(ex.teddy.x, ex.tommy.x);
    this.focus = { x: (x0 + x1) / 2, y: (ex.teddy.y + ex.tommy.y) / 2 + 1.6, w: x1 - x0 + 6, h: 5.2 };
    for (const id in this.bros) this.bros[id].shot = false;
  };

  // ------------------------------------------------------------------ drawing the sim
  View.prototype.sync = function (sim, dt, opts = {}) {
    this.time += dt;
    const t = this.time;
    if (this.won) this.winT += dt;
    for (const pv of this.poolsV) {
      pv.tex.offset.x = (t * 0.25) % 1;
      pv.tex.offset.y = Math.sin(t * 0.7) * 0.05;
      pv.emo.position.y = pv.r.y + 0.62 + Math.sin(t * 2 + pv.r.x0) * 0.05;
      pv.emo.material.rotation = Math.sin(t * 1.5 + pv.r.x0) * 0.2;
      pv.bubbleT -= dt;
      if (pv.bubbleT < 0) {
        pv.bubbleT = 0.4 + Math.random() * 1.2;
        this.fx.emit(pv.r.x0 + Math.random() * pv.w, pv.r.y + 0.95, 0.2 + Math.random() * 0.3, 2, { color: [pv.light, '#ffffff'], speed: 0.4, up: 0.8, life: 0.6, gravity: -0.5, size: 0.12 });
      }
    }
    for (const gv of this.gatesV) {
      gv.tex.offset.y = (t * 0.3) % 1;
      gv.panel.material.opacity = 0.7 + Math.sin(t * 3 + gv.x) * 0.1;
      const inside = Math.abs(sim.bros[gv.who].x - (gv.x + 0.5)) < 0.8 && sim.bros[gv.who].y >= gv.y - 0.5 && sim.bros[gv.who].y < gv.y + gv.h;
      gv.panel.material.emissiveIntensity += ((inside ? 1.1 : 0.5) - gv.panel.material.emissiveIntensity) * damp(8, dt);
    }
    for (const pv of this.platesV) {
      const target = pv.p.pressed ? 0.06 : 0.13;
      pv.top.position.y += (target - pv.top.position.y) * damp(18, dt);
      pv.glow.material.opacity += ((pv.p.pressed ? 0.9 : 0) - pv.glow.material.opacity) * damp(10, dt);
      for (const m of pv.mats) m.emissiveIntensity = pv.p.pressed ? 0.5 : 0.15;
    }
    for (const lv of this.leversV) {
      const target = lv.l.state ? -0.65 : 0.65;
      lv.arm.rotation.z += (target - lv.arm.rotation.z) * damp(14, dt);
    }
    for (const dv of this.doorsV) {
      const d = dv.d, o = d.open;
      let x = d.x0 + d.w / 2, y = d.y0 + d.h / 2;
      if (d.slide === 'up') y += d.h * o;
      else if (d.slide === 'down') y -= d.h * o;
      else if (d.slide === 'left') x -= d.w * o;
      else x += d.w * o;
      dv.m.position.set(x, y - (d.w > d.h ? 0.04 : 0), 0);
      dv.m.visible = o < 0.999;
    }
    for (const lv of this.liftsV) lv.g.position.set(lv.lf.x, lv.lf.y, 0);
    for (const bv of this.boxesV) bv.m.position.set(bv.b.x, bv.b.y + bv.b.h / 2, 0);
    for (const gv of this.gemsV) {
      if (gv.gm.taken) {
        if (gv.g.visible) {
          gv.gone += dt;
          gv.g.position.y = gv.gm.y + gv.gone * 3;
          gv.g.scale.setScalar(Math.max(0.01, 1 - gv.gone * 2.5));
          if (gv.gone > 0.4) gv.g.visible = false;
        }
        continue;
      }
      gv.m.rotation.y = t * 2 + gv.ph;
      gv.g.position.y = gv.gm.y + Math.sin(t * 2.4 + gv.ph) * 0.07;
      gv.g.children[0].material.opacity = 0.55 + Math.sin(t * 3 + gv.ph) * 0.15;
    }
    for (const fv of this.flagsV) {
      for (const id of ['teddy', 'tommy']) {
        const pen = fv.pen[id];
        const target = fv.f.by[id] ? (id === 'teddy' ? 1.9 : 1.5) : 0.35;
        pen.h += (target - pen.h) * damp(5, dt);
        pen.m.position.y = pen.h;
        pen.m.rotation.y = Math.sin(t * 4 + (id === 'teddy' ? 0 : 1)) * 0.25;
      }
    }
    for (const lan of this.lanterns) lan.g.rotation.z = Math.sin(t * 1.3 + lan.ph) * 0.08;
    for (const id of ['teddy', 'tommy']) {
      const ev = this.exitsV[id], b = sim.bros[id];
      const ready = b.onExit || this.won;
      ev.halo.material.opacity += ((ready ? 0.85 + Math.sin(t * 6) * 0.1 : 0.22) - ev.halo.material.opacity) * damp(6, dt);
      ev.open += ((this.won ? 1 : 0) - ev.open) * damp(3, dt);
      ev.light.material.opacity = ev.open * 0.9;
    }
    for (const id of ['teddy', 'tommy']) this.syncBro(this.bros[id], sim, dt, opts);
    this.updateFlights(dt);
    if (this.won) {
      // confetti over the doors
      if (Math.random() < dt * 14) {
        const f = this.focus;
        this.fx.emit(f.x + (Math.random() - 0.5) * f.w * 0.8, f.y + 2.2, 0.6, 3, { color: [C.teddy, C.tommy, '#ffd23f', '#ff6fae', '#4fa8ff', '#ffffff'], speed: 1.5, up: 0, life: 2.2, gravity: 2.2, drag: 1.2, size: 0.2 });
      }
    }
    this.fx.update(dt);
    this.fit(false, dt);
  };

  View.prototype.syncBro = function (v, sim, dt, opts) {
    const b = sim.bros[v.id], h = sim.helper, P = CB.P, t = this.time;
    const sig = Kit.roster.signature(v.entry, 'hello'), bye = Kit.roster.signature(v.entry, 'goodbye');
    let mode = 'stand', moving = false, yOff = 0, scale = 1, visible = true, hop = 0, toCam = false, ph;
    v.ph += dt * (2 + Math.abs(b.vx) * 2.1);
    ph = v.ph;
    const helping = h.on && h.who === v.id;
    switch (b.state) {
      case 'play': {
        if (!b.ground) mode = 'jump';
        else if (b.pushing) mode = 'push';
        else if (Math.abs(b.vx) > 0.4) { mode = b.wade ? 'wade' : 'run'; moving = true; }
        else if (b.cheerT > 0) {
          // two-player high five: both do their signature moves
          toCam = true;
          if (v.id === 'teddy') mode = b.cheerT > 0.8 ? 'boxing' : 'jumpshot';
          else mode = 'peace';
        } else if (helping && h.phase === 'hold') {
          toCam = true;
          mode = h.t < 1.4 ? sig : h.t >= P.guardUntil ? bye : h.treatT !== null && h.t - h.treatT < 0.6 ? 'give' : 'stand';
        }
        if (b.wade && b.ground) yOff = -0.2;
        break;
      }
      case 'splash':
        mode = 'splash';
        yOff = -Math.min(1, b.st * 2.2) * 0.8;
        if (b.st > 0.5) visible = false;
        break;
      case 'appear':
        scale = easeOutBack(b.st / 0.35);
        break;
      case 'rescue':
        mode = 'jump';
        break;
      case 'helper': {
        const ht = h.t;
        if (h.leap) mode = 'jump';
        else if (ht < 1.4) { mode = sig; toCam = true; }
        else if (ht >= P.guardUntil) { mode = bye; toCam = true; }
        else if (h.moving) { mode = 'run'; moving = true; }
        else if (h.treatT !== null && ht - h.treatT < 0.6) mode = 'give';
        break;
      }
      case 'cheer': {
        toCam = true;
        const ct = this.won ? this.winT : t;
        if (v.id === 'teddy') {
          const cyc = ct % 2.8;
          if (cyc < 1.5) mode = 'boxing';
          else if (cyc < 2.3) mode = 'jumpshot';
          else mode = 'cheer';
          if (cyc < 1.5) v.shot = false;
        } else {
          mode = 'peace';
          hop = Math.abs(Math.sin(ct * 5)) * 0.25;
        }
        break;
      }
    }
    // jump shots: a hop, and the ball leaves his hands halfway up
    if (mode !== v.mode) { v.mode = mode; v.modeT = 0; if (mode === 'jumpshot') v.shot = false; }
    else v.modeT += dt;
    if (mode === 'jumpshot') {
      const u = v.modeT / 0.7;
      if (u < 1) hop = Math.sin(u * Math.PI) * 0.9;
      if (u > 0.45 && !v.shot) {
        v.shot = true;
        const hoop = this.won && this.exitsV.teddy.hoop;
        let target = null;
        if (hoop) { target = new T.Vector3(); hoop.localToWorld(target.set(0, 0.05, 0.25)); }
        this.shootBall(v.id, target);
      }
    }
    if (mode === 'boxing') ph = t * 6;
    if (mode === 'peace' && b.state !== 'cheer') hop = Math.abs(Math.sin(t * 5)) * 0.15;
    // face where he's going, or toward the camera to show off
    const side = b.face > 0 ? -Math.PI / 2 - 0.45 : Math.PI / 2 + 0.45;
    let target = side;
    if (toCam) target = v.id === 'teddy' && mode === 'boxing' ? Math.PI - 0.7 * (b.face > 0 ? 1 : -1) : Math.PI - 0.25 * (b.face > 0 ? 1 : -1);
    v.rot = lerpAngle(v.rot, target, damp(12, dt));
    v.p.root.rotation.y = v.rot;
    CB.pose(v.p, ph, mode, damp(18, dt), { moving });
    v.g.visible = visible;
    v.p.root.scale.setScalar(SCALE[v.id] * Math.max(0.01, scale));
    v.g.position.set(b.x, b.y + yOff + hop, 0);
    v.glow.position.y = 0.03 - yOff - hop;
    v.glow.visible = b.state !== 'splash';
    // name tag always; the arrow marks who you steer in single player
    v.arrow.visible = sim.mode === '1p' && sim.active === v.id && !sim.won && !opts.demo;
    v.arrow.position.y = v.tag.position.y + 0.5 + Math.sin(t * 6) * 0.08;
    v.tag.material.opacity = sim.mode === '1p' && sim.active !== v.id && !helping ? 0.7 : 1;
  };

  View.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  // Where a world point lands on screen, in CSS pixels (for the HUD).
  View.prototype.toScreen = function (x, y, z) {
    const v = new T.Vector3(x, y, z || 0).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size[0], y: (-v.y * 0.5 + 0.5) * this.size[1] };
  };

  View.prototype.treatNames = TREATS;
  CB.View = View;
})();
