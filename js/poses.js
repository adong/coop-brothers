/* Co-op Brothers: poses on top of Kit.people.pose. Exposes CB.pose(p, phase, mode, k, opts).
   Extra modes: 'stand' (arms relaxed, a little breathing), 'push' (leaning into a crate), 'wade' (high-knee walk),
   'splash' (arms up, wobbling), 'cheer' (both fists up). Standing signature moves ('peace', 'wave') keep their
   legs still instead of striding. */
(function () {
  'use strict';
  const CB = (window.CB = window.CB || {});
  const People = Kit.people;

  const STILL_LEGS = { peace: 1, wave: 1, give: 1, cheer: 1 };

  function ease(o, prop, v, k) { o[prop] += (v - o[prop]) * k; }

  function pose(p, ph, mode, k, opts = {}) {
    if (mode === 'stand') {
      People.pose(p, ph, 'idle', k);
      const b = Math.sin(ph * 0.5) * 0.04;
      ease(p.armL.rotation, 'z', -0.08 - b, k);
      ease(p.armR.rotation, 'z', 0.08 + b, k);
      p.hips.position.y = p.hipY + Math.sin(ph * 0.5) * 0.012;
      return;
    }
    if (mode === 'push') {
      People.pose(p, ph, 'grab', k);
      ease(p.hips.rotation, 'x', -0.45, k);
      ease(p.legL.rotation, 'x', Math.sin(ph) * 0.6 + 0.25, k);
      ease(p.legR.rotation, 'x', -Math.sin(ph) * 0.6 + 0.25, k);
      return;
    }
    if (mode === 'wade') {
      People.pose(p, ph, 'walk', k);
      ease(p.legL.rotation, 'x', Math.max(0, Math.sin(ph)) * 1.1, k);
      ease(p.legR.rotation, 'x', Math.max(0, -Math.sin(ph)) * 1.1, k);
      ease(p.armL.rotation, 'z', -0.5, k);
      ease(p.armR.rotation, 'z', 0.5, k);
      return;
    }
    if (mode === 'splash') {
      People.pose(p, ph, 'fall', k);
      ease(p.armL.rotation, 'z', -2.4 + Math.sin(ph * 3) * 0.3, k);
      ease(p.armR.rotation, 'z', 2.4 - Math.sin(ph * 3) * 0.3, k);
      ease(p.hips.rotation, 'x', 0.1, k);
      return;
    }
    if (mode === 'cheer') {
      People.pose(p, ph, 'jump', k);
      ease(p.armL.rotation, 'x', 2.9, k);
      ease(p.armR.rotation, 'x', 2.9, k);
      ease(p.armL.rotation, 'z', -0.35, k);
      ease(p.armR.rotation, 'z', 0.35, k);
      ease(p.legL.rotation, 'x', 0, k);
      ease(p.legR.rotation, 'x', 0, k);
      return;
    }
    People.pose(p, ph, mode, k);
    if (STILL_LEGS[mode] && !opts.moving) {
      p.legL.rotation.x *= 0.25;
      p.legR.rotation.x *= 0.25;
      p.hips.position.y = p.hipY + Math.abs(Math.sin(ph)) * 0.03;
    }
  }

  CB.pose = pose;
})();
