/* 中文 for BeTTer TogeTTher: the words on the page, the toasts, the level names and tips, and the ? panel
   (Kit.lang, from kit/lang.js). The kids' names (TEDDY, TOMMY) and the game's name stay in English on purpose.
   Nothing in the 3D scene is written in words except the name tags, so there's no canvas text to redraw. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', '🏀 TEDDY', '✌️ TOMMY', 'BeTTer TogeTTher', 'TAB', 'Tab', 'Esc',
    'Teddy W A D · Tommy ← ↑ →']);

  // the levels: names on the cards, the HUD (in capitals) and the banner, and each level's tip
  const LEVELS = {
    'Hello, Temple!': '你好，神庙！', 'Splash Garden': '水花花园', 'Plate Pals': '踏板好伙伴', 'Lever Lift': '拉杆升降台',
    'Crate Mate': '木箱好帮手', 'Both Buttons': '两个按钮', 'Going Up': '一起上楼', 'Grape Jelly': '葡萄果冻',
    'Crate Lift': '木箱坐电梯', 'The Grand Gate': '神庙大门',
  };
  for (const en in LEVELS) L.add({ [en]: LEVELS[en], [en.toUpperCase()]: LEVELS[en] });

  L.add({
    // level tips
    'Teddy can splash through orange. Tommy can splash through mint. Jump over the other colour!':
      'Teddy 能蹚过橙色水池，Tommy 能蹚过薄荷绿水池。别人的颜色就跳过去！',
    'Hop up onto the wooden ledges to get over a pool that isn’t yours.': '跳上木板，越过不是你颜色的水池。',
    'Stand on a plate to open the door with the same colour. Take turns!': '站在踏板上，同颜色的门就会打开。轮流来！',
    'Bump a lever to flip it. Both levers work the same lift.': '碰一下拉杆就能扳动它。两个拉杆管同一个升降台。',
    'Push a crate into the hole to hold the plate down. Crates float on pools!': '把木箱推进洞里压住踏板。木箱能浮在水池上！',
    'Orange gates let only Teddy through, mint gates only Tommy. Press both buttons together!':
      '橙色的门只让 Teddy 过，薄荷绿的门只让 Tommy 过。两个按钮要一起踩！',
    'Stand on a plate to send your brother up in the lift.': '站在踏板上，把兄弟送上去。',
    'Grape jelly is too sticky for both of you! Ride the raft, and hold the plate for the bridge.':
      '葡萄果冻太黏啦，你们俩都不能碰！坐木筏过去，再踩住踏板放下桥。',
    'Take the crate up in the lift. Only Teddy can push it through orange!': '用升降台把木箱运上去。只有 Teddy 能推着它穿过橙色水池！',
    'Crates float! Push one into your pool so your brother can hop across on it.': '木箱会浮起来！把它推进你的水池，让兄弟踩着跳过去。',
    // the banner's how-to line
    'Teddy: buttons on the left · Tommy: buttons on the right': 'Teddy：左边的按钮 · Tommy：右边的按钮',
    'Move and jump with the big buttons · ⇄ swaps brothers': '用大按钮走和跳 · ⇄ 换兄弟',
    'Teddy: W A D  ·  Tommy: ← ↑ →  ·  T: high five!': 'Teddy：W A D  ·  Tommy：← ↑ →  ·  T：击掌！',
    'Move: ← → or A D  ·  Jump: ↑ W Space  ·  Tab: swap  ·  T: call your brother': '走：← → 或 A D  ·  跳：↑ W 空格  ·  Tab：换兄弟  ·  T：叫兄弟来帮忙',
    '🎬 WATCH HOW! \u00a0TAP TO STOP': '🎬 看看怎么过！ \u00a0点一下停止', // the badge has a space, then a no-break space
    LEVEL: '关卡',
    // title screen
    'Teddy 🏀 and Tommy ✌️ team up in the backyard temple!': 'Teddy 🏀 和 Tommy ✌️ 在后院神庙里一起闯关！',
    'steer one brother · Tab swaps': '一次控制一个兄弟 · Tab 换人',
    // HUD and its tooltips
    "Teddy's gems": 'Teddy 的宝石', "Tommy's gems": 'Tommy 的宝石', 'Time (beat it for a star)': '时间（够快就多一颗星）',
    'Your brother is helping': '兄弟正在帮你', 'Start the level again (R)': '重新开始这一关 (R)', 'Sound on/off (M)': '声音 开/关 (M)',
    'Pause (P)': '暂停 (P)', 'Switch brothers (Tab)': '换兄弟 (Tab)', 'Call your brother (T)': '叫兄弟来帮忙 (T)',
    'Call Teddy to help (T)': '叫 Teddy 来帮忙 (T)', 'Call Tommy to help (T)': '叫 Tommy 来帮忙 (T)', 'High five! (T)': '击掌！(T)',
    'SWAP': '换人', 'HIGH FIVE!': '击掌！',
    // level select
    'PICK A LEVEL': '选一关', '◀ BACK': '◀ 返回', 'open every level': '打开所有关卡', 'lock levels again': '重新锁上关卡',
    '⭐ get both brothers home · ⭐ grab every gem · ⭐ beat the clock': '⭐ 两兄弟都到家 · ⭐ 收集所有宝石 · ⭐ 跑赢时间',
    // pause
    '▶ KEEP PLAYING': '▶ 继续玩', '↻ START AGAIN': '↻ 重新开始', '🎬 SHOW ME HOW': '🎬 教我怎么过', '☰ LEVELS': '☰ 选关', '⌂ TITLE': '⌂ 首页',
    // the win card
    'YOU DID IT!': '成功啦！', 'SUPER STARS!': '三颗星，太棒啦！', "THAT'S HOW!": '就是这样过关！', 'Both home!': '都到家啦！',
    'All gems': '所有宝石', 'Beat the clock': '跑赢时间', 'NEXT ▶': '下一关 ▶', 'YOUR TURN ▶': '轮到你啦 ▶', '☰ ALL LEVELS': '☰ 所有关卡',
    '↻ AGAIN': '↻ 再来一次',
    // toasts
    'SWISH!': '唰！进球！', 'SPLASH!': '扑通！', 'OOPS!': '哎呀！', 'THE BIG DOOR IS OPEN!': '大门打开啦！', 'CHECKPOINT!': '存档点！',
    'HOORAY! BOTH HOME!': '耶！都到家啦！',
    // the ? panel (js/keys.js)
    'swap brothers (1 player)': '换兄弟（单人）', 'pause · start again · sound': '暂停 · 重新开始 · 声音',
    '1 player: either set of keys moves you, and Space jumps too.': '单人时两套按键都能走，空格也能跳。',
    "On an iPad, Teddy's orange buttons are on the left and Tommy's mint ones on the right. ⇄ SWAP switches brothers.":
      '在 iPad 上，Teddy 的橙色按钮在左边，Tommy 的薄荷绿按钮在右边。点 ⇄ 换人 就能换兄弟。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^LEVEL (\d+) OF (\d+)$/, '第 $1 关（共 $2 关）');
  L.rule(/^LEVEL (\d+)$/, '第 $1 关');
  L.rule(/^FINISH LEVEL (\d+) FIRST!$/, '先完成第 $1 关！');
  L.rule(/^CALL (TEDDY|TOMMY)$/, '叫 $1');
  L.rule(/^(TEDDY|TOMMY) IS HELPING$/, '$1 在帮你');
  L.rule(/^(TEDDY|TOMMY) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(TEDDY|TOMMY) IS HOLDING IT FOR YOU!$/, '$1 帮你踩住啦！');
  L.rule(/^(TEDDY|TOMMY)'S HERE!$/, '$1 来啦！');
  // the toast puts the emoji in its own span, so the words arrive without it (both forms are covered)
  L.rule(/^(\S+ )?(ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (TEDDY|TOMMY)!$/, (m, emoji, item, who) => `${emoji || ''}${who} 送来的${TREAT[item]}！`);
  L.rule(/^All gems (\d+)\/(\d+)$/, '宝石 $1/$2');
  L.rule(/^Under (\d+:\d\d)$/, '$1 内完成');
  L.rule(/^Time (\d+:\d\d)(?:  ·  best (\d+:\d\d))?$/, (m, t, best) => `用时 ${t}` + (best ? `  ·  最快 ${best}` : ''));
})();
