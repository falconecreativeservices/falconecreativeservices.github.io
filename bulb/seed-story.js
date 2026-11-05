/* "Seed to light": specks of light gather on the ground, a tree grows, the camera pulls back to the bulb,
   someone walks in and sits, and the light comes on. Builds the SVG into a container and returns its timeline.
   Needs bulb-data.js, GSAP 3.13 and story-kit.js.
     SeedStory.mount(container, { pace, follow })
       pace      1 = the full-length cut; below 1 runs faster (the hero uses about 0.7)
       follow    element whose pointer moves the glow */
(function () {
  const K = BulbKit, B = BULB;
  const MARKUP = `
  <svg class="bulb" viewBox="343 449 300 300" role="img" aria-labelledby="bulb-title">
    <title id="bulb-title">The Falcone Creative Services lightbulb: a tree inside a lightbulb with a person sitting beneath it</title>
    <defs>
      <radialGradient id="g-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#F7D58E" stop-opacity="0.55"/>
        <stop offset="0.5" stop-color="#C89B4E" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#C89B4E" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-inner" cx="50%" cy="58%" r="55%">
        <stop offset="0" stop-color="#FFD98A" stop-opacity="0.42"/>
        <stop offset="0.6" stop-color="#E0A85A" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#E0A85A" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-spark" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#FFF4D6" stop-opacity="0.95"/>
        <stop offset="0.25" stop-color="#FFD98A" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
      <clipPath id="clip-hole"><path id="hole-clip"/></clipPath>
      <mask id="m-ground" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><circle id="ground-light" cx="493" cy="600" r="0" fill="#fff" filter="url(#f-soft)"/></mask>
      <mask id="m-hill" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><g id="hill-strokes" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"></g></mask>
      <mask id="m-ring" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><g id="ring-strokes" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"></g></mask>
      <mask id="m-tree" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><g id="tree-strokes" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"></g></mask>
    </defs>
    <circle id="glow" cx="512" cy="430" r="500" fill="url(#g-glow)" opacity="0"/>
    <path id="glass-tint" fill="url(#g-inner)" opacity="0"/>
    <g id="mark" fill="#F5F0E8" fill-rule="evenodd">
      <path id="base1"/><path id="base2"/><path id="base3"/>
      <!-- the person starts hidden behind the tree and the ground, so nothing of them shows until they step out -->
      <g id="walker" clip-path="url(#clip-hole)" opacity="0"></g>
      <path id="ground" mask="url(#m-ground)"/>
      <rect id="hill-line" x="0" y="0" width="1024" height="1024" mask="url(#m-hill)"/>
      <path id="ring" mask="url(#m-ring)"/>
      <path id="tree" mask="url(#m-tree)"/>
      <path id="figure" opacity="0"/>
    </g>
    <g id="motes" clip-path="url(#clip-hole)"></g>
    <g id="tips"></g>
    <g id="seed">
      <circle id="seed-ripple" cx="493" cy="599" r="4" fill="none" stroke="#FFE2A8" stroke-width="1" opacity="0"/>
      <circle id="seed-halo" cx="493" cy="599" r="34" fill="url(#g-spark)" opacity="0"/>
    </g>
    <g id="specks"></g>
  </svg>`;

  function mount(container, { pace = 1, follow = null } = {}) {
    container.insertAdjacentHTML('beforeend', MARKUP);
    const svg = container.querySelector('svg.bulb'), $ = id => svg.querySelector('#' + id);
    const T = v => v * pace;            // every duration and offset scales with the pace
    for (const k of ['base1', 'base2', 'base3', 'ground', 'ring', 'tree', 'figure']) $(k).setAttribute('d', B.parts[k]);
    $('hole-clip').setAttribute('d', B.parts.hole);
    $('glass-tint').setAttribute('d', B.parts.hole);

    // the hill's surface, drawn outward from where the light lands, in both directions
    const SEED = [493, 599];
    const hillPts = x0 => { const pts = []; const step = x0 < SEED[0] ? -6 : 6; for (let x = SEED[0]; step < 0 ? x >= x0 : x <= x0; x += step) pts.push([x, K.groundY(x) + 0.5]); return pts; };
    const hillL = K.pen($('hill-strokes'), $('tips'), K.smoothPath(hillPts(376)), 4.2, { lag: 30 });
    const hillR = K.pen($('hill-strokes'), $('tips'), K.smoothPath(hillPts(648)), 4.2, { lag: 30 });
    const ring = K.pen($('ring-strokes'), $('tips'), K.ringPath(), B.ring[0].w, { lag: 16 });
    // the root flare spreads along the ground as the trunk thickens, rather than shooting out first
    const tree = K.treeGrowth($('tree-strokes'), {
      thicken: 190,
      // everything waits for the trunk base below it; the root flare spreads along the ground as the trunk thickens
      shift: s => { if (s.t0 <= 0.5) return 0; const p = K.polyPoints(s.d), a = p[0], b = p[p.length - 1]; return a[1] > 560 && b[1] > 585 ? 182 : 12; },
      extra: [{ d: 'M497 607 L501 573', w: 58, t0: 0.5 }]   // the base of the trunk, so the shoot rises straight out of the ground
    });
    // no outline needed: they start behind the tree and the ground and only ever stand in front of the dark glass
    const fig = K.walker($('walker'), { from: 503, cycle: 84, outline: null });
    const light = K.lightShow(svg, { glow: $('glow'), tint: $('glass-tint'), motes: $('motes'), holePath: $('hole-clip'), markGroup: $('mark'),
      strength: 0.45, tintStrength: 0.6, follow, gradient: $('g-inner') });

    // the specks for the opening, scattered across the close-up frame. A seeded random gives the same
    // composition on every visit (an art-directed layout) instead of an occasional unlucky clump.
    let seed = 7;
    const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const specks = Array.from({ length: 13 }, () => {
      const g = K.el('g', {}, $('specks')), inner = K.el('g', {}, g);
      const x = 362 + rand() * 262, y = 466 + rand() * 112;
      K.el('circle', { cx: K.fmt(x), cy: K.fmt(y), r: K.fmt(7 + rand() * 6), fill: 'url(#g-spark)' }, inner);
      K.el('circle', { cx: K.fmt(x), cy: K.fmt(y), r: K.fmt(1 + rand() * 0.9), fill: '#FFF4D6' }, inner);
      return { g, inner, x, y, dx: rand() * 24 - 12, dy: rand() * 20 - 14 };
    });

    // the person starts out of sight behind the trunk and takes a step and a half out to the left;
    // three quarters of a stride ends with both legs passing under the body, ready to sit
    const STOP = 440, walkFrom = STOP + 84 * 0.75;
    fig.state.stopX = STOP;

    // camera: frames the landing spot, follows the tree out as it grows, then pulls back to the whole bulb
    const VB = [[343, 449, 300], [248, 152, 520], [0, 0, 1024]];
    const cam = { out: 0 }, camEase = gsap.parseEase('power2.inOut');
    let camKey = '';
    K.onFrame(() => {
      const g = K.smooth(tree.state.reach / (B.treeMax * 0.92)), o = camEase(cam.out);
      const v = VB[0].map((a, i) => a + (VB[1][i] - a) * g).map((a, i) => a + (VB[2][i] - a) * o);
      const key = v.map(K.fmt).join(' ');
      if (key !== camKey) { camKey = key; svg.setAttribute('viewBox', `${key} ${K.fmt(v[2])}`); }
    });

    const sp = specks.map(s => s.g), spIn = specks.map(s => s.inner);
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    tl.addLabel('dark', 0)
      .set([$('figure'), $('walker')], { opacity: 0 }, 0)
      .set([$('glow'), $('glass-tint')], { opacity: 0 }, 0)
      .set($('mark'), { attr: { fill: '#F5F0E8' } }, 0)
      .set([$('ring'), $('tree')], { attr: { mask: (i, t) => `url(#m-${t.id})` } }, 0)
      .set($('ground'), { attr: { mask: 'url(#m-ground)' } }, 0)
      // specks of light softly bloom into the dark, one after another, and drift
      // (a short beat of darkness first, so the page has settled before anything moves)
      .fromTo(sp, { opacity: 0 }, { opacity: 1, duration: T(1.0), ease: 'sine.inOut', stagger: { each: T(0.08), from: 'random' } }, 0.45)
      .fromTo(spIn, { scale: 0.45 }, { scale: 1, svgOrigin: i => `${K.fmt(specks[i].x)} ${K.fmt(specks[i].y)}`, duration: T(1.1), ease: 'sine.out', stagger: { each: T(0.08), from: 'random' }, immediateRender: true }, 0.45)
      .fromTo(sp, { x: 0, y: 0 }, { x: i => specks[i].dx, y: i => specks[i].dy, duration: T(1.7), ease: 'sine.inOut', stagger: { each: T(0.05), from: 'random' } }, 0.35)
      // then drift down and gather at one spot on the ground, which warms as they arrive
      .addLabel('gather', 0.35 + T(1.35))
      .fromTo(spIn, { x: 0, y: 0, scale: 1 },
        { x: i => SEED[0] - specks[i].x, y: i => SEED[1] - specks[i].y, scale: 0.35, svgOrigin: i => `${K.fmt(specks[i].x)} ${K.fmt(specks[i].y)}`,
          duration: T(1.15), ease: 'power2.in', stagger: { each: T(0.06), from: 'random' }, immediateRender: false }, 'gather')
      .to(sp, { x: 0, y: 0, duration: T(1.15), ease: 'power2.in', stagger: { each: T(0.06), from: 'random' } }, 'gather')
      .fromTo($('seed-halo'), { opacity: 0, scale: 0.4, svgOrigin: '493 599' }, { opacity: 1, scale: 1, svgOrigin: '493 599', duration: T(1.4), ease: 'sine.in' }, `gather+=${T(0.3)}`)
      .to(sp, { opacity: 0, duration: T(0.25), stagger: { each: T(0.06), from: 'random' } }, `gather+=${T(1.0)}`)
      // the ground's surface glows out from that spot, and the earth fades up around it
      .addLabel('ground', `gather+=${T(1.25)}`)
      .fromTo($('seed-ripple'), { attr: { r: 4 }, opacity: 0.7 }, { attr: { r: 52 }, opacity: 0, duration: T(1.2), ease: 'power2.out', immediateRender: false }, 'ground')
      .fromTo([hillL.state, hillR.state], { p: 0 }, { p: 1, duration: T(1.4), ease: 'power2.inOut' }, 'ground')
      .fromTo($('ground-light'), { attr: { r: 0 } }, { attr: { r: 62 }, duration: T(1.6), ease: 'power2.out' }, `ground+=${T(0.1)}`)
      // and a shoot comes up where the light went in
      .addLabel('sprout', `ground+=${T(0.45)}`)
      .to($('seed-halo'), { scale: 0.6, opacity: 0, svgOrigin: '493 599', duration: T(1.4), ease: 'sine.inOut' }, `sprout+=${T(0.2)}`)
      .fromTo($('hill-line'), { opacity: 1 }, { opacity: 0, duration: T(1.2), ease: 'sine.inOut', immediateRender: false }, `sprout+=${T(1.2)}`)
      .fromTo(tree.state, { reach: 0 }, { reach: tree.end, duration: T(5.0), ease: 'sine.inOut' }, `sprout+=${T(0.15)}`)
      .to($('ground-light'), { attr: { r: 230 }, duration: T(4.6), ease: 'sine.inOut' }, `sprout+=${T(0.3)}`)
      // Each beat starts as the one before it is finishing, so the story flows instead of waiting:
      // the glass starts wrapping around the tree while the crown is still filling out,
      .addLabel('glass', `sprout+=${T(3.0)}`)
      .fromTo(ring.state, { p: 0 }, { p: 1, duration: T(1.6), ease: 'power3.inOut' }, `glass+=${T(0.1)}`)
      .fromTo(cam, { out: 0 }, { out: 1, duration: T(2.6), ease: 'none' }, 'glass')
      .to($('ground-light'), { attr: { r: 720 }, duration: T(2.2), ease: 'power2.inOut' }, 'glass')
      // the base screws on as the glass closes,
      .fromTo([$('base1'), $('base2'), $('base3')], { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: T(0.7), stagger: T(0.12), ease: 'back.out(1.5)' }, `glass+=${T(1.2)}`)
      // and as the bulb closes around the tree, someone steps out from behind the trunk,
      .addLabel('walk', `glass+=${T(1.1)}`)
      .set($('walker'), { opacity: 1 }, 'walk')
      .fromTo(fig.state, { x: walkFrom, sit: 0 }, { x: STOP + 22, duration: 0.45, ease: 'none' }, 'walk')
      .to(fig.state, { x: STOP, duration: 0.6, ease: 'power2.out' }, '>')
      .to(fig.state, { sit: 1, duration: 0.4, ease: 'power1.inOut' }, '>')
      .addLabel('sitDown', '>')
      .to(fig.state, { sit: 2, duration: 0.55, ease: 'power2.inOut' }, 'sitDown')
      .to(fig.state, { sit: 3, duration: 0.85, ease: 'power3.out' }, '>')
      .addLabel('seated', '>')
      // once they've settled into the fitted pose, the real artwork fades in over it and the rig underneath goes
      .to($('figure'), { opacity: 1, duration: 0.35, ease: 'sine.inOut' }, 'seated-=0.15')
      .set($('walker'), { opacity: 0 }, '>')
      .set([$('ring'), $('tree'), $('ground')], { attr: { mask: 'none' } }, '>');
    // and the light warms up as they settle in
    light.addTo(tl, 'sitDown+=0.35');
    return { svg, tl, light };
  }

  window.SeedStory = { mount };
})();
