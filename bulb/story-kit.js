/* Shared pieces for the lightbulb intro (seed-story.js).
   Needs bulb-data.js (window.BULB) and GSAP 3.13 loaded first.
   Every moving part keeps its state in a plain object that the main timeline tweens; the drawing
   is worked out from that state once per frame, so scrubbing, replaying and jumping to the end
   always land on the right picture. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const B = window.BULB;

  // ---------- small helpers
  const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const rad = d => d * Math.PI / 180;
  const fmt = n => Math.round(n * 10) / 10;
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const polyPoints = d => d.slice(1).split(' L').map(s => s.trim().split(/\s+/).map(Number));
  // Catmull-Rom through the points, written as cubic Beziers: a smooth path for the pen to follow
  function smoothPath(pts) {
    let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)} ${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)} ${fmt(p2[0])} ${fmt(p2[1])}`;
    }
    return d;
  }
  // the glass outline as one continuous line: up the left side, over the top, down the right side
  function ringPath() {
    const left = polyPoints(B.ring[0].d), right = polyPoints(B.ring[1].d).reverse();
    return smoothPath(left.concat(right.slice(1)));
  }
  const groundY = x => {
    const s = B.seam;
    for (let i = 1; i < s.length; i++) if (x <= s[i][0]) { const [x0, y0] = s[i - 1], [x1, y1] = s[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return s[s.length - 1][1];
  };
  const subpaths = d => d.split(/(?=M)/).filter(s => s.trim());

  // ---------- the per-frame loop: each part registers an update that returns early when nothing moved
  const updaters = [];
  const onFrame = fn => updaters.push(fn);
  gsap.ticker.add(() => { for (const fn of updaters) fn(); });

  // ---------- tree growth: branches appear as thin shoots and thicken to their real width
  // Each branch is one filled shape, rebuilt while it grows: a tapered ribbon along its centerline,
  // fine at the growing tip and wider where it has had time to thicken, with round ends.
  // maskGroup is a mask: the traced tree shows only where these shapes are.
  function treeGrowth(maskGroup, { thicken = 120, minWidth = 2.2, shift = () => 0, extra = [], step = 2.5 } = {}) {
    const segs = extra.concat(B.tree).map(s => {
      const pts = polyPoints(s.d), samples = [];
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i > 0) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / step));
          for (let j = 1; j <= n; j++) samples.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, acc + d * j / n]);
          acc += d;
        } else samples.push([pts[0][0], pts[0][1], 0]);
      }
      // unit normals at each sample, from its neighbours
      for (let i = 0; i < samples.length; i++) {
        const a = samples[Math.max(i - 1, 0)], b = samples[Math.min(i + 1, samples.length - 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        samples[i].push(-dy / l, dx / l);
      }
      const p = el('path', { fill: '#fff', stroke: 'none' }, maskGroup);
      p.style.visibility = 'hidden';
      return { p, samples, len: Math.max(acc, 0.5), t0: s.t0 + shift(s), w: s.w, root: extra.includes(s), done: false, shown: false };
    });
    const state = { reach: 0 };
    const widthAt = (s, d) => minWidth + (s.w - minWidth) * smooth((state.reach - s.t0 - d) / thicken);
    function shape(s) {
      const vis = clamp(state.reach - s.t0, 0, s.len), L = [], R = [];
      let tip = null;
      for (let i = 0; i < s.samples.length; i++) {
        let [x, y, d, nx, ny] = s.samples[i];
        if (d > vis) {
          // the growing tip falls between two samples
          const [px, py, pd] = s.samples[i - 1], k = (vis - pd) / ((d - pd) || 1);
          x = px + (x - px) * k; y = py + (y - py) * k; d = vis;
        }
        const h = widthAt(s, d) / 2;
        L.push(`${fmt(x + nx * h)} ${fmt(y + ny * h)}`); R.push(`${fmt(x - nx * h)} ${fmt(y - ny * h)}`);
        tip = [x, y, h];
        if (d >= vis) break;
      }
      const [bx, by] = s.samples[0], bh = widthAt(s, 0) / 2, [tx, ty, th] = tip;
      // ribbon with a round tip; branches start inside their parent's round end, so only the root needs a round base
      return `M${L.join(' L')} A${fmt(th)} ${fmt(th)} 0 0 1 ${R[R.length - 1]} L${R.reverse().join(' L')} Z`
        + (s.root ? ` M${fmt(bx - bh)} ${fmt(by)} a${fmt(bh)} ${fmt(bh)} 0 1 0 ${fmt(bh * 2)} 0 a${fmt(bh)} ${fmt(bh)} 0 1 0 ${fmt(-bh * 2)} 0` : '')
        + ` M${fmt(tx - th)} ${fmt(ty)} a${fmt(th)} ${fmt(th)} 0 1 0 ${fmt(th * 2)} 0 a${fmt(th)} ${fmt(th)} 0 1 0 ${fmt(-th * 2)} 0`;
    }
    let last = -1;
    onFrame(() => {
      if (state.reach === last) return;
      const back = state.reach < last;
      last = state.reach;
      for (const s of segs) {
        const started = state.reach > s.t0;
        if (started !== s.shown) { s.p.style.visibility = started ? 'visible' : 'hidden'; s.shown = started; }
        if (!started) { s.done = false; continue; }
        const finished = state.reach >= s.t0 + s.len + thicken;
        if (finished && s.done && !back) continue;    // fully grown and fully thick: nothing changes
        s.p.setAttribute('d', shape(s));
        s.done = finished;
      }
    });
    return { state, end: B.treeMax + thicken };
  }

  // ---------- pen: draws a line with a tapered leading edge and a glowing tip
  // the thin stroke leads, the full-width stroke follows a moment later, like ink spreading
  function pen(maskGroup, tipLayer, d, width, { lag = 70 } = {}) {
    const lead = el('path', { d, 'stroke-width': width * 0.3 }, maskGroup);
    const mid = el('path', { d, 'stroke-width': width * 0.62 }, maskGroup);
    const full = el('path', { d, 'stroke-width': width }, maskGroup);
    const len = full.getTotalLength();
    for (const p of [lead, mid, full]) { p.style.strokeDasharray = `${len} ${len + 1}`; p.style.strokeDashoffset = len; p.style.visibility = 'hidden'; }
    const tip = el('g', { opacity: 0 }, tipLayer);
    el('circle', { r: 26, fill: 'url(#g-spark)' }, tip);
    el('circle', { r: 3.2, fill: '#FFF8EA' }, tip);
    const state = { p: 0 };              // 0..1 along the line; runs a little past 1 so the trailing strokes finish
    const total = len + lag * 1.6;
    let last = -1;
    onFrame(() => {
      if (state.p === last) return;
      last = state.p;
      const at = state.p * total;
      [[lead, at], [mid, at - lag * 0.6], [full, at - lag * 1.6]].forEach(([p, l]) => {
        l = clamp(l, 0, len);
        p.style.visibility = l > 0 ? 'visible' : 'hidden';
        p.style.strokeDashoffset = len - l;
      });
      const head = clamp(at, 0, len), pt = full.getPointAtLength(head);
      tip.setAttribute('transform', `translate(${fmt(pt.x)} ${fmt(pt.y)})`);
      // the tip fades in as it starts and out as it reaches the end of the line
      tip.setAttribute('opacity', fmt(smooth(at / 40) * (1 - smooth((at - len + 30) / 60)) * 100) / 100);
    });
    return { state, len };
  }

  // ---------- the walking figure
  // forward kinematics on a simple skeleton; angles in degrees from straight down, positive = forward (left)
  const L = { th: 26, sh: 26, ft: 9, to: 37, ua: 19, fa: 18, hr: 13.5 };
  const W = { torso: 23, th: 14.5, sh: 12.5, ft: 8, ua: 10, fa: 9 };
  const g = (p, c, w) => { let d = Math.abs(p - c); d = Math.min(d, 1 - d); return Math.exp(-(d * d) / (2 * w * w)); };
  const frac = v => v - Math.floor(v);
  function legAngles(p, amp) {
    const th = amp * (23 * Math.cos(2 * Math.PI * p) - 2);
    const knee = -amp * (4 + 58 * g(p, 0.70, 0.11) + 10 * g(p, 0.08, 0.05));
    const ft = amp * (10 * g(p, 0.98, 0.06) - 30 * g(p, 0.58, 0.07) - 6 * g(p, 0.76, 0.1));
    return [th, th + knee, ft];
  }
  // outline: a dark edge drawn under the figure, for when it walks in front of something the same colour (null = none)
  function walker(parent, { from = 700, cycle = 84, outline = '#16202D' } = {}) {
    const shadow = outline ? el('g', { stroke: outline, 'stroke-linecap': 'round', fill: 'none' }, parent) : null;
    const body = el('g', { stroke: 'var(--mark)', 'stroke-linecap': 'round', fill: 'none', class: 'walker-body' }, parent);
    const parts = {};
    const order = ['uaB', 'faB', 'thB', 'shB', 'ftB', 'torso', 'head', 'thF', 'shF', 'ftF', 'uaF', 'faF'];
    // the torso is a curved, tapered shape (so the back can slouch into the logo's pose): [ribbon, hip cap, neck cap] per layer
    const torsoLayer = (layer, isShadow) => [
      el('path', isShadow ? { fill: outline, stroke: outline, 'stroke-width': 5.2, 'stroke-linejoin': 'round' } : { fill: 'var(--mark)', stroke: 'none' }, layer),
      el('circle', { fill: isShadow ? outline : 'var(--mark)', stroke: 'none' }, layer),
      el('circle', { fill: isShadow ? outline : 'var(--mark)', stroke: 'none' }, layer)
    ];
    const widths = { uaB: W.ua, faB: W.fa, thB: W.th, shB: W.sh, ftB: W.ft, torso: W.torso, thF: W.th, shF: W.sh, ftF: W.ft, uaF: W.ua, faF: W.fa };
    for (const k of order) {
      // each part is [body] or [outline, body]; the body is always last
      if (k === 'head') {
        parts.head = [shadow && el('circle', { r: L.hr + 2.6, fill: outline, stroke: 'none' }, shadow), el('circle', { r: L.hr, fill: 'var(--mark)', stroke: 'none' }, body)].filter(Boolean);
      } else if (k === 'torso') {
        parts.torso = [shadow && torsoLayer(shadow, true), torsoLayer(body, false)].filter(Boolean);
      } else {
        parts[k] = [shadow && el('line', { 'stroke-width': widths[k] + 5.2 }, shadow), el('line', { 'stroke-width': widths[k] }, body)].filter(Boolean);
      }
    }
    // sitting down, in three held poses after the stop: lean in, drop the hips, settle and hug the knees
    const KEYS = [
      null, // filled in from the standing pose where the walk ends
      // the back starts to round as they lean in, and keeps curving as they sit, so it arrives at the logo's slouch
      { dx: 3, dy: 6, tt: -18, thF: 30, shF: -14, ftF: 0, thB: 26, shB: -18, ftB: 0, uaF: -16, faF: -12, uaB: -17, faB: -13, bend: 2.5, wH: 23, wN: 21, hd: 15 },   // arms along the body as they lean in
      { x: 446, y: 594, tt: -10, thF: 100, shF: 22, ftF: 2, thB: 94, shB: 20, ftB: 2, uaF: -4, faF: 40, uaB: -5, faB: 38, bend: 5, wH: 23.2, wN: 20, hd: 14.6 },   // hands come to rest on the thighs
      // the last pose is fitted to the logo's seated figure (work/fitsit.py), so the hand-off to the real artwork is seamless
      { x: 446.0, y: 605.5, tt: -21.8, thF: 172.5, shF: 41.9, ftF: 0, thB: 94.5, shB: 52.6, ftB: 0, uaF: 33.2, faF: 52.3, uaB: 29.2, faB: 57.4, hr: 13.7, bend: 6.7, wH: 23.2, wN: 18.9, hd: 14.4 }
    ];
    const state = { x: from, sit: 0, stopX: from };
    const pose = {};
    function walkPose(x) {
      const p = (from - x) / cycle;
      const amp = smooth((x - state.stopX) / 28);   // the stride shrinks over the last step so it stops on both feet
      const [thF, shF, ftF] = legAngles(frac(p), amp), [thB, shB, ftB] = legAngles(frac(p + 0.5), amp);
      // a natural arm swing while walking; once they stop, the sit keys tuck the arms in along the body
      const tt = -3 - amp * (3 - 1.5 * Math.cos(4 * Math.PI * p));
      const arm = q => 12 * amp * Math.cos(2 * Math.PI * q);
      const uaF = arm(p + 0.5), uaB = arm(p);
      return {
        x, y: groundY(x) - (L.th + L.sh) * 0.995 + amp * 2.2 * Math.cos(4 * Math.PI * p),
        tt,
        thF, shF, ftF, thB, shB, ftB,
        uaF, faF: uaF + 6 + amp * 10 * Math.max(0, Math.cos(2 * Math.PI * (p + 0.5))),
        uaB, faB: uaB + 6 + amp * 10 * Math.max(0, Math.cos(2 * Math.PI * p)),
        hr: L.hr, bend: 0, wH: W.torso, wN: W.torso, hd: L.hr + 2
      };
    }
    const seg = (a, b, k) => { const o = {}; for (const key in a) o[key] = a[key] + ((b[key] ?? a[key]) - a[key]) * k; return o; };
    const set = (k, x1, y1, x2, y2) => { for (const n of parts[k]) { n.setAttribute('x1', fmt(x1)); n.setAttribute('y1', fmt(y1)); n.setAttribute('x2', fmt(x2)); n.setAttribute('y2', fmt(y2)); } };
    const dir = a => [-Math.sin(rad(a)), Math.cos(rad(a))];
    let lastKey = '';
    onFrame(() => {
      const key = state.x.toFixed(2) + '|' + state.sit.toFixed(3);
      if (key === lastKey) return;
      lastKey = key;
      let P = walkPose(state.x);
      if (state.sit > 0) {
        const stand = walkPose(state.stopX);
        const keys = [stand, { ...stand, ...KEYS[1], x: stand.x + KEYS[1].dx, y: stand.y + KEYS[1].dy }, { ...stand, ...KEYS[2] }, { ...stand, ...KEYS[3] }];
        delete keys[1].dx; delete keys[1].dy;
        const i = Math.min(Math.floor(state.sit), 2);
        P = seg(keys[i], keys[i + 1], state.sit - i);
      }
      Object.assign(pose, P);
      const hx = P.x, hy = P.y;
      // spine: a curve from the hip to the neck, bowed backward by P.bend, tapering from wH to wN
      const tdir = [Math.sin(rad(P.tt)), -Math.cos(rad(P.tt))];
      const nx = hx + tdir[0] * L.to, ny = hy + tdir[1] * L.to;
      const cx0 = (hx + nx) / 2 - tdir[1] * P.bend, cy0 = (hy + ny) / 2 + tdir[0] * P.bend;
      const at = t => { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        const dx = 2 * (1 - t) * (cx0 - hx) + 2 * t * (nx - cx0), dy = 2 * (1 - t) * (cy0 - hy) + 2 * t * (ny - cy0), l = Math.hypot(dx, dy) || 1;
        return [a * hx + b * cx0 + c * nx, a * hy + b * cy0 + c * ny, dx / l, dy / l]; };
      const Ls = [], Rs = [];
      for (let i = 0; i <= 12; i++) {
        const [x, y, tx, ty] = at(i / 12), w = (P.wH + (P.wN - P.wH) * i / 12) / 2;
        Ls.push(`${fmt(x - ty * w)} ${fmt(y + tx * w)}`); Rs.push(`${fmt(x + ty * w)} ${fmt(y - tx * w)}`);
      }
      const ribbon = `M${Ls.join(' L')} L${Rs.reverse().join(' L')} Z`;
      const [ex, ey, etx, ety] = at(1);
      const top = parts.head.length - 1;
      parts.torso.forEach(([ribbonEl, hipCap, neckCap], i) => {
        const grow = i === top ? 0 : 2.6;
        ribbonEl.setAttribute('d', ribbon);
        hipCap.setAttribute('cx', fmt(hx)); hipCap.setAttribute('cy', fmt(hy)); hipCap.setAttribute('r', fmt(P.wH / 2 + grow));
        neckCap.setAttribute('cx', fmt(ex)); neckCap.setAttribute('cy', fmt(ey)); neckCap.setAttribute('r', fmt(P.wN / 2 + grow));
      });
      // the head sits on the end of the spine, so a slouch carries it forward and down
      parts.head.forEach((n, i) => { n.setAttribute('cx', fmt(ex + etx * P.hd)); n.setAttribute('cy', fmt(ey + ety * P.hd)); n.setAttribute('r', fmt(P.hr + (i === top ? 0 : 2.6))); });
      for (const s of ['F', 'B']) {
        const [ax, ay] = dir(P['th' + s]), kx = hx + ax * L.th, ky = hy + ay * L.th;
        const [bx, by] = dir(P['sh' + s]), anx = kx + bx * L.sh, any = ky + by * L.sh;
        const fa = rad(P['ft' + s]);
        set('th' + s, hx, hy, kx, ky); set('sh' + s, kx, ky, anx, any);
        set('ft' + s, anx, any, anx - Math.cos(fa) * L.ft, any - Math.sin(fa) * L.ft);
        const [sx, sy] = at(10 / 12);   // shoulders, near the top of the spine
        const [cx, cy] = dir(P['ua' + s]), ex = sx + cx * L.ua, ey = sy + cy * L.ua;
        const [dx, dy] = dir(P['fa' + s]);
        set('ua' + s, sx, sy, ex, ey); set('fa' + s, ex, ey, ex + dx * L.fa, ey + dy * L.fa);
      }
    });
    return { state, shadow, body };
  }

  // ---------- light: flicker, warm bloom, drifting dust, optional slow rays
  function lightShow(svg, { glow, tint, rays = null, motes, holePath, markGroup, strength = 0.85, tintStrength = 1, follow = null, gradient = null }) {
    // dust motes: random points inside the glass
    const box = holePath.getBBox(), pts = [];
    let guard = 0;
    while (pts.length < 22 && guard++ < 2000) {
      const x = box.x + Math.random() * box.width, y = box.y + Math.random() * (box.height * 0.82);
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      if (holePath.isPointInFill(pt)) pts.push([x, y]);
    }
    const moteEls = pts.map(([x, y]) => el('circle', { cx: fmt(x), cy: fmt(y), r: fmt(1 + Math.random() * 1.8), fill: '#FFE7B8', opacity: 0 }, motes));
    // light rays: soft wedges turning very slowly behind the bulb
    for (let i = 0; rays && i < 7; i++) {
      const a = (i / 7) * 360 + Math.random() * 20, w = 2.5 + Math.random() * 3.5;
      el('path', { d: `M512 430 L${fmt(512 + 560 * Math.cos(rad(a - w)))} ${fmt(430 + 560 * Math.sin(rad(a - w)))} L${fmt(512 + 560 * Math.cos(rad(a + w)))} ${fmt(430 + 560 * Math.sin(rad(a + w)))} Z`, fill: 'url(#g-ray)' }, rays);
    }
    const ambient = gsap.timeline({ paused: true });
    if (rays) ambient.to(rays, { rotation: 360, svgOrigin: '512 430', duration: 140, ease: 'none', repeat: -1 }, 0);
    moteEls.forEach(m => {
      ambient.fromTo(m, { opacity: 0 }, { opacity: 0.25 + Math.random() * 0.55, duration: 2 + Math.random() * 3, ease: 'sine.inOut', repeat: -1, yoyo: true }, Math.random() * 3)
        .to(m, { x: gsap.utils.random(-14, 14), y: gsap.utils.random(-34, -10), duration: 7 + Math.random() * 6, ease: 'sine.inOut', repeat: -1, yoyo: true }, 0);
    });
    // add the light-up to the story timeline at a position
    function addTo(tl, at) {
      tl.addLabel('light', at)
        .to(glow, { keyframes: [{ opacity: 0.4 * strength, duration: 0.09 }, { opacity: 0.05, duration: 0.11 }, { opacity: 0.6 * strength, duration: 0.07 }, { opacity: 0.12, duration: 0.14 }, { opacity: strength, duration: 1.4, ease: 'sine.out' }] }, 'light')
        .to(tint, { opacity: tintStrength, duration: 1.6, ease: 'sine.out' }, 'light+=0.38')
        .to(markGroup, { attr: { fill: '#FBF3E6' }, duration: 1.6, ease: 'sine.out' }, 'light+=0.38')
        .call(() => ambient.play(), null, 'light+=0.5');
      if (rays) tl.fromTo(rays, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: 'sine.inOut' }, 'light+=0.6');
    }
    // the light leans gently toward the cursor: the halo drifts a little and the warm centre of the glass follows
    if (follow) {
      const home = { x: +glow.getAttribute('cx'), y: +glow.getAttribute('cy') };
      const lean = { x: home.x, y: home.y, fx: 50, fy: 58 };
      const apply = () => {
        glow.setAttribute('cx', fmt(lean.x)); glow.setAttribute('cy', fmt(lean.y));
        if (gradient) { gradient.setAttribute('cx', fmt(lean.fx) + '%'); gradient.setAttribute('cy', fmt(lean.fy) + '%'); }
      };
      const q = k => gsap.quickTo(lean, k, { duration: 1.4, ease: 'power3', onUpdate: apply });
      const qx = q('x'), qy = q('y'), qfx = q('fx'), qfy = q('fy');
      const pt = svg.createSVGPoint();
      follow.addEventListener('pointermove', e => {
        const m = svg.getScreenCTM(); if (!m) return;
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(m.inverse());
        const dx = clamp((p.x - home.x) / 520, -1, 1), dy = clamp((p.y - home.y) / 520, -1, 1);
        qx(home.x + dx * 70); qy(home.y + dy * 55); qfx(50 + dx * 14); qfy(58 + dy * 12);
      });
      follow.addEventListener('pointerleave', () => { qx(home.x); qy(home.y); qfx(50); qfy(58); });
    }
    function reset() { ambient.pause(0); gsap.set(moteEls, { opacity: 0, x: 0, y: 0 }); }
    return { addTo, ambient, reset };
  }

  // ---------- playback controls, reduced motion, and ?t= for reviewing single frames
  function controls(tl, { replay, pause, note, ambient, onReset }) {
    const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]calm\b/.test(location.search);
    const setPause = p => { pause.textContent = p ? 'Play' : 'Pause'; pause.setAttribute('aria-pressed', p); };
    replay.addEventListener('click', () => { onReset && onReset(); tl.restart(); setPause(false); });
    pause.addEventListener('click', () => {
      const pausing = pause.getAttribute('aria-pressed') !== 'true';
      if (pausing) { tl.pause(); ambient && ambient.pause(); }
      else { if (tl.progress() < 1) tl.play(); else if (ambient) ambient.play(); }
      setPause(pausing);
    });
    tl.eventCallback('onComplete', () => { if (calm() && ambient) ambient.pause(); });
    const seekTo = new URLSearchParams(location.search).get('t');
    if (seekTo !== null) { tl.seek(parseFloat(seekTo)).pause(); setPause(true); }
    else if (calm()) {
      tl.progress(1, true); setPause(true);   // true = jump to the end without firing callbacks, so nothing starts moving
      note.textContent = 'Reduced motion is on, so this shows the finished mark. Press Replay to watch it.';
    } else startWhenReady(() => tl.play());
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) { tl.progress(1, true); ambient && ambient.pause(); setPause(true); } });
  }

  // wait for fonts and two painted frames, so the first seconds of an intro don't stutter while the page settles
  function startWhenReady(fn) {
    let started = false;
    const go = () => { if (started) return; started = true; requestAnimationFrame(() => requestAnimationFrame(fn)); };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(go, go);
    setTimeout(go, 1200);   // slow fonts shouldn't hold the intro back
  }

  window.BulbKit = { NS, el, clamp, smooth, rad, fmt, polyPoints, smoothPath, ringPath, groundY, subpaths, onFrame, treeGrowth, pen, walker, lightShow, controls, startWhenReady };
})();
