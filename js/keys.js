/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "BeTTer TogeTTher",
  cols: ["Teddy", "Tommy"],
  keys: [
    ["walk", "A D", "← →"],
    ["jump", "W", "↑"],
    ["swap brothers (1 player)", "Tab", ""],
    ["call your brother", "T", ""],
    ["pause · start again · sound", "P or Esc · R · M", ""],
  ],
  note: "1 player: either set of keys moves you, and Space jumps too.",
  touch: "On an iPad, Teddy's orange buttons are on the left and Tommy's mint ones on the right. ⇄ SWAP switches brothers.",
});
