/* Co-op Brothers: painted canvas textures for the temple, made once and cached. Exposes CB.art.
   Everything is drawn here with the canvas API: no image files. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx;
  const CB = (window.CB = window.CB || {});
  const { makeCanvas, toTexture, shade, roundRect } = G;

  // The brothers' colours, and the colours for each linked set of plates, levers, doors and lifts.
  const COLORS = {
    teddy: '#ff8a1f', teddyLight: '#ffb25c', teddyDeep: '#d9600a', teddyTag: '#ffa646', teddyEmoji: '🏀',
    tommy: '#34d6a4', tommyLight: '#8ff2cf', tommyDeep: '#169c76', tommyTag: '#7ff0c8', tommyEmoji: '✌️',
    jelly: '#9b5de5', jellyLight: '#c9a4ff',
  };
  const LINKS = [
    { c: '#ffd23f', sym: '★' }, { c: '#a66cff', sym: '●' }, { c: '#ff6fae', sym: '▲' },
    { c: '#4fa8ff', sym: '♥' }, { c: '#f4f4f4', sym: '◆' }, { c: '#ff5a5a', sym: '■' },
  ];

  // A small seeded random number generator, so each level's decorations come out the same every time.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cache = {};
  const once = (key, fn) => cache[key] || (cache[key] = fn());

  function speckle(g, w, h, n, cols, r0, r1, rand) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[Math.floor(rand() * cols.length)];
      g.globalAlpha = 0.25 + rand() * 0.35;
      const r = r0 + rand() * (r1 - r0);
      g.beginPath();
      g.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // One sandstone block with bevelled edges (all six faces of a tile use it).
  const stone = () => once('stone', () => {
    const [c, g] = makeCanvas(256, 256), rand = rng(7);
    g.fillStyle = '#e9c08f';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 260, ['#f6d6a8', '#d9a571', '#c99360', '#fbe3bd'], 2, 9, rand);
    // bevel: light top-left, dark bottom-right
    const bev = 14;
    g.fillStyle = 'rgba(255,240,210,0.55)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256 - bev, bev); g.lineTo(bev, bev); g.lineTo(bev, 256 - bev); g.lineTo(0, 256); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,70,30,0.35)';
    g.beginPath(); g.moveTo(256, 256); g.lineTo(0, 256); g.lineTo(bev, 256 - bev); g.lineTo(256 - bev, 256 - bev); g.lineTo(256 - bev, bev); g.lineTo(256, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,62,25,0.55)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 253, 253);
    // a couple of hairline cracks
    g.strokeStyle = 'rgba(120,72,35,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      let x = 40 + rand() * 170, y = 40 + rand() * 170;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 40; y += rand() * 22; g.lineTo(x, y); }
      g.stroke();
    }
    return toTexture(c);
  });

  // The temple's back wall: smaller, darker bricks, with the odd carved swirl.
  const wall = () => once('wall', () => {
    const [c, g] = makeCanvas(512, 512), rand = rng(3);
    g.fillStyle = '#a77a52';
    g.fillRect(0, 0, 512, 512);
    const bw = 128, bh = 64;
    for (let r = 0; r < 8; r++) {
      for (let k = -1; k < 5; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
        const l = 0.92 + rand() * 0.16;
        g.fillStyle = `rgb(${Math.round(214 * l)},${Math.round(168 * l)},${Math.round(122 * l)})`;
        roundRect(g, x + 4, y + 4, bw - 8, bh - 8, 8);
        g.fill();
        g.fillStyle = 'rgba(255,235,200,0.18)';
        g.fillRect(x + 8, y + 6, bw - 16, 6);
        if (rand() < 0.07) {
          g.strokeStyle = 'rgba(110,70,40,0.45)';
          g.lineWidth = 4;
          g.beginPath();
          for (let a = 0; a < 12; a += 0.3) g.lineTo(x + bw / 2 + Math.cos(a) * a * 1.8, y + bh / 2 + Math.sin(a) * a * 1.8);
          g.stroke();
        }
      }
    }
    speckle(g, 512, 512, 400, ['#8d6440', '#e7c08f'], 1.5, 5, rand);
    return toTexture(c, true);
  });

  // Grass along the top of a block, with a fringe hanging over its front edge.
  const grassTop = () => once('grassTop', () => {
    const [c, g] = makeCanvas(128, 128), rand = rng(11);
    g.fillStyle = '#6cc04a';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, 128, 120, ['#8bd660', '#4fa233', '#a4e070'], 2, 6, rand);
    return toTexture(c);
  });
  const fringe = () => once('fringe', () => {
    const [c, g] = makeCanvas(256, 64), rand = rng(5);
    g.fillStyle = '#5db53e';
    g.fillRect(0, 0, 256, 14);
    for (let x = 0; x < 256; x += 5) {
      const h = 10 + rand() * 26;
      g.fillStyle = rand() < 0.5 ? '#5db53e' : '#4c9e30';
      g.beginPath(); g.moveTo(x - 4, 10); g.lineTo(x + rand() * 4, 10 + h); g.lineTo(x + 5, 10); g.closePath(); g.fill();
    }
    for (let i = 0; i < 6; i++) {
      // tiny flowers in the grass
      const x = 10 + rand() * 236;
      g.fillStyle = ['#fff6a8', '#ffffff', '#ffb3d1'][i % 3];
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 3.5, 9 + Math.sin(k * 1.26) * 3.5, 2.6, 0, 7); g.fill(); }
      g.fillStyle = '#ffb02e';
      g.beginPath(); g.arc(x, 9, 2, 0, 7); g.fill();
    }
    return toTexture(c);
  });

  const plank = () => once('plank', () => {
    const [c, g] = makeCanvas(256, 64), rand = rng(9);
    g.fillStyle = '#b8743a';
    g.fillRect(0, 0, 256, 64);
    for (let y = 0; y < 64; y += 4) {
      g.fillStyle = `rgba(${rand() < 0.5 ? '90,45,15' : '230,170,110'},${0.08 + rand() * 0.1})`;
      g.fillRect(0, y, 256, 2);
    }
    g.fillStyle = '#7a4520';
    for (const x of [0, 128]) g.fillRect(x, 0, 4, 64);
    g.fillStyle = '#5a3418';
    for (const x of [14, 114, 142, 242]) { g.beginPath(); g.arc(x, 32, 4, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(70,35,10,0.7)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 60);
    return toTexture(c);
  });

  const crate = () => once('crate', () => {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#c98a4b';
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = y % 64 ? '#c3823f' : '#cf9455';
      g.fillRect(0, y, 128, 30);
    }
    g.strokeStyle = '#7d4a1f';
    g.lineWidth = 14;
    g.strokeRect(7, 7, 114, 114);
    g.beginPath(); g.moveTo(14, 14); g.lineTo(114, 114); g.stroke();
    g.strokeStyle = '#e0a868';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 124, 124);
    g.fillStyle = '#4a2a10';
    for (const [x, y] of [[14, 14], [114, 14], [14, 114], [114, 114]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    return toTexture(c);
  });

  // Shimmering bars for the coloured gates.
  const gateBars = (col) => once('gate' + col, () => {
    const [c, g] = makeCanvas(64, 256);
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = col;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, 64, 256);
    g.globalAlpha = 1;
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let x = 8; x < 64; x += 16) g.fillRect(x, 0, 3, 256);
    for (let y = 0; y < 256; y += 40) { g.globalAlpha = 0.5; g.fillRect(0, y, 64, 2); }
    g.globalAlpha = 1;
    return toTexture(c, true);
  });

  // Scrolling ripples on a pool's surface.
  const ripples = (col, light) => once('rip' + col, () => {
    const [c, g] = makeCanvas(128, 64);
    g.fillStyle = col;
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = light;
    g.lineWidth = 4;
    g.globalAlpha = 0.8;
    for (let y = 8; y < 64; y += 16) {
      g.beginPath();
      for (let x = 0; x <= 128; x += 4) g.lineTo(x, y + Math.sin((x / 128) * Math.PI * 4 + y) * 3);
      g.stroke();
    }
    g.globalAlpha = 1;
    return toTexture(c, true);
  });

  // A mechanical door: wooden slab with an iron frame and its link's colour band and symbol.
  function doorTex(col, sym, w, h, split) {
    return once(`door${col}${sym}${w}x${h}${split || ''}`, () => {
      const ppu = 96, [c, g] = makeCanvas(Math.round(w * ppu), Math.round(h * ppu));
      const W = c.width, H = c.height;
      g.fillStyle = '#8a5a34';
      g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 24) {
        g.fillStyle = (x / 24) % 2 ? '#93623a' : '#80522e';
        g.fillRect(x, 0, 22, H);
      }
      g.fillStyle = '#5b5e66';
      g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10); g.fillRect(0, 0, 10, H); g.fillRect(W - 10, 0, 10, H);
      const by = H / 2 - 30;
      if (split) {
        g.fillStyle = COLORS.teddy; g.fillRect(10, by, (W - 20) / 2, 60);
        g.fillStyle = COLORS.tommy; g.fillRect(W / 2, by, (W - 20) / 2, 60);
      } else {
        g.fillStyle = col;
        g.fillRect(10, by, W - 20, 60);
      }
      g.strokeStyle = '#2a1a10';
      g.lineWidth = 4;
      g.strokeRect(10, by, W - 20, 60);
      g.font = `44px ${split ? G.EMOJI_FONT : G.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#2a1a10';
      g.fillText(sym, W / 2, by + 32);
      g.fillStyle = '#3d3f45';
      for (let y = 30; y < H; y += 60) for (const x of [22, W - 22]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      return toTexture(c);
    });
  }

  // The brothers' exit doors: a stone arch and a coloured door with his emoji.
  function exitTex(who) {
    return once('exit' + who, () => {
      const [c, g] = makeCanvas(256, 384);
      const col = COLORS[who], deep = COLORS[who + 'Deep'];
      const arch = (inset) => {
        g.beginPath();
        g.moveTo(inset, 384);
        g.lineTo(inset, 128);
        g.arc(128, 128, 128 - inset, Math.PI, 0);
        g.lineTo(256 - inset, 384);
        g.closePath();
      };
      arch(0);
      g.fillStyle = '#d8b07f';
      g.fill();
      g.strokeStyle = '#8a5a30';
      g.lineWidth = 6;
      g.stroke();
      arch(22);
      const gr = g.createLinearGradient(0, 60, 0, 384);
      gr.addColorStop(0, shade(col, 0.25));
      gr.addColorStop(1, deep);
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(128, 30); g.lineTo(128, 384); g.stroke();
      g.font = `96px ${G.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(COLORS[who + 'Emoji'], 128, 170);
      g.fillStyle = '#ffe9a8';
      for (const x of [104, 152]) { g.beginPath(); g.arc(x, 260, 7, 0, 7); g.fill(); }
      return toTexture(c);
    });
  }

  // An arched window in the back wall, looking out at a sunny garden.
  const windowTex = () => once('window', () => {
    const [c, g] = makeCanvas(256, 384), rand = rng(21);
    const arch = (inset) => {
      g.beginPath();
      g.moveTo(inset, 384 - inset);
      g.lineTo(inset, 128);
      g.arc(128, 128, 128 - inset, Math.PI, 0);
      g.lineTo(256 - inset, 384 - inset);
      g.closePath();
    };
    arch(0);
    g.fillStyle = '#c99d6c';
    g.fill();
    arch(20);
    g.save();
    g.clip();
    const sky = g.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, '#7cc8ff');
    sky.addColorStop(0.7, '#d9f1ff');
    sky.addColorStop(1, '#fff4d6');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 384);
    g.fillStyle = '#fff2a8';
    g.beginPath(); g.arc(180, 110, 26, 0, 7); g.fill();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = rand() * 256, y = 60 + rand() * 120;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 16, y + (k % 2) * -8, 14, 0, 7); g.fill(); }
    }
    g.fillStyle = '#8fd46a';
    g.beginPath(); g.moveTo(0, 384); g.quadraticCurveTo(70, 250, 150, 320); g.quadraticCurveTo(210, 270, 256, 300); g.lineTo(256, 384); g.fill();
    g.fillStyle = '#5fb546';
    g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(120, 300, 256, 370); g.lineTo(256, 384); g.lineTo(0, 384); g.fill();
    g.restore();
    g.strokeStyle = '#8a5f36';
    g.lineWidth = 8;
    arch(20);
    g.stroke();
    g.beginPath(); g.moveTo(128, 20); g.lineTo(128, 364); g.moveTo(20, 230); g.lineTo(236, 230); g.stroke();
    return toTexture(c);
  });

  // A round carved plaque with an emoji, for the wall.
  function plaqueTex(emoji) {
    return once('plaque' + emoji, () => {
      const [c, g] = makeCanvas(128, 128);
      g.fillStyle = '#c99d6c';
      g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.strokeStyle = '#8a5f36';
      g.lineWidth = 6;
      g.stroke();
      g.fillStyle = '#e8c79a';
      g.beginPath(); g.arc(64, 64, 48, 0, 7); g.fill();
      g.font = `60px ${G.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, 64, 68);
      return toTexture(c);
    });
  }

  const vineTex = () => once('vine', () => {
    const [c, g] = makeCanvas(64, 256), rand = rng(17);
    g.strokeStyle = '#3f8a2c';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(32, 0);
    for (let y = 0; y <= 240; y += 10) g.lineTo(32 + Math.sin(y / 30) * 8, y);
    g.stroke();
    for (let y = 10; y < 240; y += 16) {
      const x = 32 + Math.sin(y / 30) * 8, s = rand() < 0.5 ? -1 : 1;
      g.fillStyle = rand() < 0.5 ? '#5dbb3f' : '#4aa232';
      g.beginPath();
      g.ellipse(x + s * 9, y, 10, 6, s * 0.6, 0, 7);
      g.fill();
    }
    return toTexture(c);
  });

  const lanternTex = () => once('lantern', () => {
    const [c, g] = makeCanvas(64, 96);
    g.strokeStyle = '#4a2f1a';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 18); g.stroke();
    g.fillStyle = '#3d2a1a';
    g.fillRect(20, 16, 24, 7);
    g.fillRect(20, 80, 24, 7);
    const gr = g.createRadialGradient(32, 50, 4, 32, 50, 30);
    gr.addColorStop(0, '#fff3b0');
    gr.addColorStop(0.5, '#ffb347');
    gr.addColorStop(1, '#e8602c');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(32, 51, 22, 30, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,40,10,0.5)';
    g.lineWidth = 2;
    for (const k of [-12, 0, 12]) { g.beginPath(); g.ellipse(32, 51, Math.abs(k) || 1, 30, 0, 0, 7); g.stroke(); }
    return toTexture(c);
  });

  const netTex = () => once('net', () => {
    const [c, g] = makeCanvas(64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    for (let x = -64; x < 128; x += 12) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 64); g.stroke();
      g.beginPath(); g.moveTo(x + 40, 0); g.lineTo(x, 64); g.stroke();
    }
    return toTexture(c, true);
  });

  // A flat colour with an emoji or symbol in the middle, for plates and lever knobs.
  function badgeTex(col, sym, emoji) {
    return once(`badge${col}${sym}`, () => {
      const [c, g] = makeCanvas(128, 64);
      g.fillStyle = col;
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, 128, 10);
      g.font = `40px ${emoji ? G.EMOJI_FONT : G.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#2a1a10';
      g.fillText(sym, 64, 36);
      return toTexture(c);
    });
  }

  CB.COLORS = COLORS;
  CB.LINK_COLORS = LINKS;
  CB.art = {
    rng, stone, wall, grassTop, fringe, plank, crate, gateBars, ripples, doorTex, exitTex,
    windowTex, plaqueTex, vineTex, lanternTex, netTex, badgeTex,
  };
})();
