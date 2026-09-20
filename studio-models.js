/* LiftOff Aero Studio: parametric 3D models for all six vehicle classes (meters, nose toward +x, y up). */
(() => {
"use strict";
const A = window.Aero, T = THREE, PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function stdMat(matKey, o = {}) {
  const M = A.MATERIALS[matKey] || { color: 0xcccccc };
  const metal = ["aluminum", "alli", "steel", "hy100", "titanium"].includes(matKey);
  return new T.MeshStandardMaterial(Object.assign({ color: M.color, metalness: metal ? 0.55 : 0.05, roughness: matKey === "carbon" ? 0.35 : metal ? 0.35 : 0.7, side: T.DoubleSide, transparent: matKey === "acrylic", opacity: matKey === "acrylic" ? 0.55 : 1 }, o));
}
const plain = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, metalness: 0.3, roughness: 0.5, side: T.DoubleSide }, o));
function mesh(geo, mat, role) { const m = new T.Mesh(geo, mat); m.userData.role = role || "body"; m.castShadow = true; return m; }

/* superellipse loft: stations [{x, cy, hw, hh, n}] -> tube surface around x axis */
function loft(st, radial = 28, capEnds = true) {
  const pos = [], idx = [], ns = st.length;
  for (let i = 0; i < ns; i++) {
    const s = st[i];
    for (let j = 0; j < radial; j++) {
      const a = j / radial * 2 * PI, c = Math.cos(a), sn = Math.sin(a), e = 2 / (s.n || 2);
      const y = s.cy + s.hh * Math.sign(sn) * Math.pow(Math.abs(sn), e), z = s.hw * Math.sign(c) * Math.pow(Math.abs(c), e);
      pos.push(s.x, y, z);
    }
  }
  for (let i = 0; i < ns - 1; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  if (capEnds) for (const [i, flip] of [[0, true], [ns - 1, false]]) { const s = st[i], ci = pos.length / 3; pos.push(s.x, s.cy, 0); for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial; flip ? idx.push(ci, a, b) : idx.push(ci, b, a); } }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* NACA 4-digit section, x from 0 (LE) to 1 (TE) */
function naca(tc, m = 0, p = 0.4, n = 22) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos(i / n * PI)) / 2, yt = 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0, dy = 0; if (m > 0) { if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dy = 2 * m / (p * p) * (p - x); } else { yc = m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x); dy = 2 * m / ((1 - p) ** 2) * (p - x); } }
    const th = Math.atan(dy); up.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]); lo.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return up.reverse().concat(lo.slice(1)); // closed loop TE->upper->LE->lower->TE
}
/* wing: root at z=0 -> tip at z=half; LE at x=0 root, chord runs toward -x; returns geometry */
function wing(o) {
  const sec = naca(o.tc || 0.12, o.m || 0, o.p || 0.4), nsp = 6, pos = [], idx = [], n = sec.length;
  for (let i = 0; i <= nsp; i++) {
    const f = i / nsp, ch = o.root + (o.tip - o.root) * f, z = o.half * f, xle = -o.sweep * f, y = Math.tan(o.dihedral || 0) * z, tw = (o.twist || 0) * f;
    for (const [sx, sy] of sec) { const px = -sx * ch, py = sy * ch; pos.push(xle + px * Math.cos(tw) - py * Math.sin(tw), y + px * Math.sin(tw) + py * Math.cos(tw), z); }
  }
  for (let i = 0; i < nsp; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const ci = pos.length / 3, last = nsp * n; let cx = 0, cy = 0; for (let j = 0; j < n; j++) { cx += pos[(last + j) * 3]; cy += pos[(last + j) * 3 + 1]; }
  pos.push(cx / n, cy / n, o.half); for (let j = 0; j < n - 1; j++) idx.push(ci, last + j, last + j + 1);
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (o.mirror) g.scale(1, 1, -1);
  return g;
}
function lathe(profile, seg = 40) { const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(Math.max(r, 1e-4), y)), seg); g.rotateZ(-PI / 2); return g; } // lathe axis -> +x
function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, seg = 20, axis = "y") { const g = new T.CylinderGeometry(rt, rb, h, seg); if (axis === "x") g.rotateZ(PI / 2); if (axis === "z") g.rotateX(PI / 2); return g; }

/* ================= ROCKET ================= */
function noseR(shape, xi, R) { // xi: 0 at tip -> 1 at base
  if (shape === "cone") return R * xi;
  if (shape === "parabolic") return R * (2 * xi - xi * xi);
  if (shape === "blunt") return R * Math.sqrt(Math.max(0, 1 - (1 - xi) ** 2));
  return R * Math.sqrt(Math.max(0, 1 - (1 - xi) ** 2)) * 0.35 + R * (2 * xi - xi * xi) * 0.65; // ogive-like
}
function rocket(p, r) {
  const g = r.g, L = g.L, R = g.r, root = new T.Group(), stage1 = new T.Group(), upper = new T.Group(), body = stdMat(p.mat);
  stage1.name = "stage1"; upper.name = "upper";
  const accent = plain(0x1b1f27, { metalness: 0.2, roughness: 0.6 });
  // nose (tip at x = L)
  const npts = []; for (let i = 0; i <= 30; i++) { const xi = i / 30; npts.push([noseR(p.nose, 1 - xi, R), xi * g.Ln]); }
  const nose = mesh(lathe(npts), body, "nose"); nose.position.x = L - g.Ln;
  upper.add(nose);
  const tube = (x0, x1, mat, role) => { const m = mesh(cyl(R, R, x1 - x0, 40, "x"), mat, role); m.position.x = (x0 + x1) / 2; return m; };
  // body sections: stage 1 from 0..L-Ln-Lb2, upper Lb2 below nose
  const xS = L - g.Ln - g.Lb2;
  stage1.add(tube(0, xS, body, "body"));
  if (g.Lb2 > 0) { upper.add(tube(xS, L - g.Ln, body, "body")); const ring = mesh(cyl(R * 1.012, R * 1.012, Math.min(0.04 * L, 1.2), 40, "x"), accent, "trim"); ring.position.x = xS; stage1.add(ring); }
  // decorative bands
  const band = mesh(cyl(R * 1.006, R * 1.006, L * 0.012, 40, "x"), accent, "trim"); band.position.x = L - g.Ln - L * 0.01; upper.add(band);
  // fins
  if (p.fins) {
    const sh = new T.Shape(); sh.moveTo(0, R * 0.98); sh.lineTo(g.cr, R * 0.98); sh.lineTo(g.cr - g.xs, R + g.s); sh.lineTo(g.cr - g.xs - g.ct, R + g.s); sh.closePath();
    const th = Math.max(g.tf, L * 0.004), fg = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); fg.translate(0, 0, -th / 2);
    for (let i = 0; i < p.fins; i++) { const f = mesh(fg, body, "fin"); f.rotation.x = i / p.fins * 2 * PI; stage1.add(f); }
    // fins run from x=0 (tail) forward to x=cr... shape x axis already along +x from tail: root chord covers 0..cr
  }
  // engines
  const bell = (rb, len, mat) => { const pts = []; for (let i = 0; i <= 16; i++) { const f = i / 16; pts.push([rb * (0.35 + 0.65 * Math.pow(1 - f, 1.6)), -len * (1 - f)]); } return mesh(lathe(pts), mat, "engine"); };
  const engMat = plain(0x3a3f48, { metalness: 0.7, roughness: 0.3 });
  const nozzles = [];
  if (g.liquid) {
    const n = p.nEng, rb = Math.min(R * 0.9 / Math.max(1, Math.sqrt(n) * 1.15), R * 0.45), ln = rb * 2.4;
    const pos = n === 1 ? [[0, 0]] : n <= 4 ? Array.from({ length: n }, (_, i) => [Math.cos(i / n * 2 * PI) * R * 0.45, Math.sin(i / n * 2 * PI) * R * 0.45]) : [[0, 0], ...Array.from({ length: n - 1 }, (_, i) => [Math.cos(i / (n - 1) * 2 * PI) * R * 0.66, Math.sin(i / (n - 1) * 2 * PI) * R * 0.66])];
    for (const [yy, zz] of pos) { const b = bell(rb, ln, engMat); b.position.set(0, yy, zz); stage1.add(b); nozzles.push(new T.Vector3(-ln, yy, zz)); }
    if (g.Lb2 > 0) { const b = bell(R * 0.55, R * 1.4, engMat); b.position.set(xS, 0, 0); b.visible = false; b.name = "eng2"; upper.add(b); }
  } else { const b = bell(R * 0.55, R * 0.9, engMat); stage1.add(b); nozzles.push(new T.Vector3(-R * 0.9, 0, 0)); }
  root.add(stage1, upper);
  const bodies = [{ c: [L / 2, 0, 0], a: [L / 2, R * 1.1, R * 1.1] }];
  if (p.fins) bodies.push({ c: [g.cr / 2, 0, 0], a: [g.cr / 2 + 1e-3, R + g.s, R + g.s], thin: true });
  return { root, L, D: 2 * R, bodies, nozzles, stage1, upper, axisUp: true, cg: null };
}

/* ================= CAR ================= */
function car(p) {
  const root = new T.Group(), L = p.L, W = p.W, H = p.H, ride = p.ride / 1000, body = stdMat(p.mat, { metalness: 0.45, roughness: 0.28 });
  const open = p.wheels === "open", bw = open ? W * 0.42 : W, st = [], N = 18;
  for (let i = 0; i <= N; i++) {
    const f = i / N, x = L / 2 - f * L; // nose at +L/2
    let h, w, n = 3.2;
    if (p.nose === "wedge") { h = f < 0.55 ? 0.18 + f / 0.55 * 0.82 : f < 0.8 ? 1 : 1 - (f - 0.8) * 0.9; w = Math.min(1, 0.55 + f * 1.8); }
    else if (p.nose === "round") { h = Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, 0.45 - f) / 0.45, 2))) * (f < 0.25 ? 0.6 + f * 1.6 : 1) * (f > 0.82 ? 1 - (f - 0.82) * 1.6 : 1); w = Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, 0.18 - f) / 0.18, 2))); n = 2.4; }
    else { h = f < 0.06 ? 0.75 : f > 0.9 ? 0.85 : 1; w = f < 0.04 ? 0.85 : 1; n = 5; }
    if (f === 0) { h *= 0.6; w *= 0.7; }
    const hh = H * 0.5 * clamp(h, 0.12, 1) * (open ? 0.6 : 1), top = ride + 2 * hh;
    st.push({ x, cy: ride + hh, hw: bw / 2 * clamp(w, 0.1, 1) * (open ? (f < 0.3 ? 0.5 + f * 1.6 : 1) : 1), hh, n });
  }
  root.add(mesh(loft(st, 32), body, "body"));
  // cabin / cockpit
  if (open) { const c = mesh(new T.SphereGeometry(0.4, 20, 12), plain(0x0c0f14, { roughness: 0.1, metalness: 0.6 }), "canopy"); c.scale.set(1.4, 0.55, 0.7); c.position.set(-L * 0.05, ride + H * 0.62, 0); root.add(c);
    const halo = mesh(new T.TorusGeometry(0.33, 0.025, 8, 30, PI), plain(0x222222), "trim"); halo.position.set(-L * 0.02, ride + H * 0.8, 0); halo.rotation.y = PI / 2; root.add(halo); }
  else { const gh = loft([{ x: L * 0.12, cy: ride + H * 0.82, hw: W * 0.3, hh: 0.02, n: 3 }, { x: L * 0.02, cy: ride + H * 0.92, hw: W * 0.38, hh: H * 0.12, n: 3 }, { x: -L * 0.2, cy: ride + H * 0.92, hw: W * 0.38, hh: H * 0.13, n: 3 }, { x: -L * 0.32, cy: ride + H * 0.85, hw: W * 0.33, hh: 0.03, n: 3 }], 24);
    root.add(mesh(gh, plain(0x0b0e13, { roughness: 0.08, metalness: 0.7 }), "glass")); }
  // wheels
  const rw = 0.33, tw = 0.3, tire = plain(0x15171b, { roughness: 0.9, metalness: 0 }), rim = plain(0x9aa3ad, { metalness: 0.9, roughness: 0.25 });
  for (const [x, sz] of [[L * 0.33, 1], [L * 0.33, -1], [-L * 0.3, 1], [-L * 0.3, -1]]) {
    const w = new T.Group(); const t = mesh(new T.TorusGeometry(rw * 0.78, rw * 0.24, 12, 28), tire, "wheel"); t.scale.z = tw / (rw * 0.48); w.add(t);
    const rr = mesh(cyl(rw * 0.55, rw * 0.55, tw * 0.6, 18, "z"), rim, "wheel"); w.add(rr);
    w.position.set(x, rw, sz * (open ? W / 2 - tw / 2 : W / 2 - tw * 0.55)); w.userData.wheel = true; root.add(w);
  }
  const bodies = [{ c: [0, ride + H * 0.45, 0], a: [L / 2, H * 0.5, W / 2] }], lifting = [];
  if (p.wing !== "none") {
    const S = p.wingSpan, c = p.wingChord, ang = -p.wingAng * PI / 180, wg = new T.Group(), el = p.wing === "double" ? 2 : 1;
    for (let e = 0; e < el; e++) { const gg = wing({ root: c * (e ? 0.55 : 1), tip: c * (e ? 0.55 : 1), half: S, sweep: 0, tc: 0.1, m: 0.06, p: 0.4 }); gg.translate(0, 0, -S / 2); gg.scale(1, -1, 1);
      const m = mesh(gg, body, "wing"); m.position.set(e ? -c * 0.75 : 0, e ? c * 0.18 : 0, 0); m.rotation.z = ang * (e ? 1.6 : 1); wg.add(m); }
    const ep = mesh(box(c * 1.6, c * 0.8, 0.012), body, "wing"); ep.position.set(-c * 0.4, 0, S / 2); wg.add(ep); const ep2 = ep.clone(); ep2.position.z = -S / 2; wg.add(ep2);
    const hW = ride + H * (open ? 0.95 : 1.02) + 0.15; wg.position.set(-L / 2 + c * 0.9, hW, 0); root.add(wg);
    for (const z of [-S * 0.25, S * 0.25]) { const py = mesh(box(c * 0.4, hW - ride - H * 0.6, 0.02), body, "wing"); py.position.set(-L / 2 + c * 0.7, (hW + ride + H * 0.6) / 2, z); root.add(py); }
    lifting.push({ x: -L / 2 + c * 0.5, y: hW, half: S / 2, chord: c, sign: -1 });
    bodies.push({ c: [-L / 2 + c * 0.5, hW, 0], a: [c * 0.7, c * 0.15, S / 2], thin: true });
  }
  if (p.fwing) { const fw = mesh(box(0.3, 0.02, W * 0.95), body, "wing"); fw.position.set(L / 2 - 0.1, ride * 0.7 + 0.04, 0); fw.rotation.z = 0.12; root.add(fw); lifting.push({ x: L / 2 - 0.15, y: ride * 0.7, half: W * 0.47, chord: 0.3, sign: -1 }); }
  if (p.diff > 0) { const d = mesh(box(L * 0.18, 0.012, W * 0.8), plain(0x1a1d22), "diffuser"); d.position.set(-L / 2 + L * 0.09, ride + Math.sin(p.diff * PI / 180) * L * 0.09, 0); d.rotation.z = p.diff * PI / 180; root.add(d); }
  const ground = new T.Mesh(new T.PlaneGeometry(L * 1.6, W * 2.2), new T.MeshBasicMaterial({ color: 0x0a1a28, transparent: true, opacity: 0.0 })); ground.visible = false;
  return { root, L, D: H, bodies, lifting, groundY: 0 };
}

/* ================= AIRCRAFT ================= */
function plane(p, r) {
  const root = new T.Group(), P = r.P, af = A.AIRFOILS[p.airfoil], body = stdMat(p.mat), L = p.fuseL, R = p.fuseD / 2;
  const st = [];
  for (let i = 0; i <= 20; i++) { const f = i / 20, x = L / 2 - f * L; let rr;
    if (f < 0.18) rr = R * Math.sqrt(1 - Math.pow(1 - f / 0.18, 2)); else if (f < 0.62) rr = R; else rr = R * (1 - (f - 0.62) / 0.38 * 0.82);
    st.push({ x, cy: f > 0.62 ? (f - 0.62) / 0.38 * R * 0.6 : 0, hw: Math.max(rr, R * 0.05), hh: Math.max(rr, R * 0.05), n: 2 }); }
  root.add(mesh(loft(st, 28), body, "fuselage"));
  const sweepLE = Math.tan(p.sweep * PI / 180) * p.span / 2 + (p.chord - p.chord * p.taper) * 0.25, wx = L / 2 - L * 0.36, wy = -R * 0.35;
  const wo = { root: p.chord, tip: p.chord * p.taper, half: p.span / 2, sweep: sweepLE, tc: af.tc, m: af.m || 0, p: af.p || 0.4, dihedral: p.sweep > 10 ? 0.07 : 0.04 };
  const wl = mesh(wing(wo), body, "wing"), wr = mesh(wing(Object.assign({ mirror: true }, wo)), body, "wing");
  wl.position.set(wx, wy, 0); wr.position.set(wx, wy, 0); root.add(wl, wr);
  if (p.flaps) { const fl = p.flaps * 13 * PI / 180; for (const s of [1, -1]) { const f = mesh(box(p.chord * 0.25, 0.02 * p.chord, p.span * 0.3), plain(0x8899aa), "flap"); f.position.set(wx - p.chord * 0.95, wy - Math.sin(fl) * p.chord * 0.12, s * (R + p.span * 0.17)); f.rotation.z = -fl; root.add(f); } }
  // tail
  const hs = p.span * 0.34, hc = p.chord * 0.55, tx = -L / 2 + hc * 1.1, ty = R * 0.55;
  for (const mir of [false, true]) { const hsM = mesh(wing({ root: hc, tip: hc * 0.6, half: hs / 2, sweep: hc * 0.3 + Math.tan(p.sweep * PI / 180) * hs / 2 * 0.8, tc: 0.1, mirror: mir }), body, "tail"); hsM.position.set(tx + hc, ty, 0); root.add(hsM); }
  const vf = mesh(wing({ root: hc * 1.3, tip: hc * 0.55, half: hs * 0.42, sweep: hc * 0.8, tc: 0.1 }), body, "tail"); vf.rotation.x = -PI / 2; vf.position.set(tx + hc * 1.3, ty, 0); root.add(vf);
  // engines
  const props = [], dark = plain(0x2a2e35, { metalness: 0.6 }), nozzles = [];
  const propDisc = (d) => { const g = new T.Group(); for (let b = 0; b < 3; b++) { const bl = mesh(box(0.04 * d, d * 0.48, d * 0.08), dark, "prop"); bl.position.y = d * 0.24; const h = new T.Group(); h.add(bl); h.rotation.x = b / 3 * 2 * PI; g.add(h); } const disc = new T.Mesh(new T.CircleGeometry(d / 2, 32), new T.MeshBasicMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false })); disc.rotation.y = PI / 2; g.add(disc); g.userData.prop = true; props.push(g); return g; };
  if (p.engine === "prop" || p.engine === "electric") {
    const d = P.propD;
    if (p.nEng === 1) { const sp = mesh(new T.ConeGeometry(R * 0.45, R * 0.8, 20), dark, "spinner"); sp.rotation.z = -PI / 2; sp.position.x = L / 2 + R * 0.3; root.add(sp); const pr = propDisc(d); pr.position.x = L / 2 + R * 0.1; root.add(pr); }
    else for (let i = 0; i < p.nEng; i++) { const zz = (i % 2 ? -1 : 1) * (R + p.span * (0.15 + 0.12 * Math.floor(i / 2))); const n = mesh(cyl(d * 0.12, d * 0.1, d * 0.8, 16, "x"), dark, "nacelle"); n.position.set(wx + d * 0.3, wy, zz); root.add(n); const pr = propDisc(d); pr.position.set(wx + d * 0.72, wy, zz); root.add(pr); }
  }
  if (p.engine === "jet") for (let i = 0; i < p.nEng; i++) { const zz = (i % 2 ? -1 : 1) * (R + p.span * (0.14 + 0.13 * Math.floor(i / 2))); const dn = Math.max(0.3, Math.sqrt(p.thrust) * 0.2), ln = dn * 2.6;
    const n = mesh(cyl(dn / 2, dn * 0.42, ln, 24, "x"), dark, "nacelle"); n.position.set(wx + dn * 0.3 - Math.tan(p.sweep * PI / 180) * Math.abs(zz) * 0.9, wy - dn * 0.75, zz); root.add(n); nozzles.push(new T.Vector3(n.position.x - ln / 2, n.position.y, zz)); }
  // landing gear
  const gear = plain(0x1b1b1b); for (const [x, z] of [[L / 2 - L * 0.15, 0], [wx - p.chord * 0.4, R * 1.3], [wx - p.chord * 0.4, -R * 1.3]]) { const w = mesh(cyl(R * 0.3, R * 0.3, R * 0.2, 16, "z"), gear, "gear"); w.position.set(x, -R * 1.4, z); root.add(w); const s = mesh(box(R * 0.08, R * 0.9, R * 0.08), gear, "gear"); s.position.set(x, -R * 0.95, z); root.add(s); }
  root.position.y = R * 1.7;
  const bodies = [{ c: [0, 0, 0], a: [L / 2, R, R] }, { c: [wx - p.chord * 0.45, wy, 0], a: [p.chord * 0.55, p.chord * af.tc * 0.6 + 0.01, p.span / 2], thin: true }];
  const lifting = [{ x: wx - p.chord * 0.4, y: wy, half: p.span / 2, chord: p.chord, sign: 1 }];
  return { root, L: Math.max(L, p.span * 0.75), D: p.span, bodies, lifting, props, nozzles, lift: R * 1.7 };
}

/* ================= DRONE ================= */
function drone(p, r) {
  const root = new T.Group(), D = p.prop, N = p.rotors, body = stdMat(p.mat), dark = plain(0x23272e, { metalness: 0.6 }), props = [];
  const coax = N === 2, arm = r.arm;
  const rotor = (d, blades = 2) => { const g = new T.Group(); for (let b = 0; b < blades; b++) { const bl = mesh(box(d * 0.47, d * 0.008 + 0.002, d * 0.07), plain(0xe8eef5, { metalness: 0.1 }), "prop"); bl.position.x = d * 0.24; const h = new T.Group(); h.add(bl); h.rotation.y = b / blades * 2 * PI; g.add(h); }
    const disc = new T.Mesh(new T.CircleGeometry(d / 2, 40), new T.MeshBasicMaterial({ color: 0xaad8ff, transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false })); disc.rotation.x = -PI / 2; g.add(disc); g.userData.prop = true; props.push(g); return g; };
  let top = 0;
  if (coax) {
    const bd = D * 0.18, cube = mesh(box(bd, bd * 0.8, bd), body, "body"); cube.position.y = D * 0.22; root.add(cube);
    const mast = mesh(cyl(D * 0.012, D * 0.012, D * 0.45, 10), dark, "mast"); mast.position.y = D * 0.5; root.add(mast);
    const r1 = rotor(D), r2 = rotor(D); r1.position.y = D * 0.42; r2.position.y = D * 0.55; r2.userData.dir = -1; root.add(r1, r2);
    const sp = mesh(box(D * 0.14, 0.004, D * 0.1), plain(0x1d2b52, { metalness: 0.4 }), "solar"); sp.position.y = D * 0.73; root.add(sp);
    for (let i = 0; i < 4; i++) { const lg = mesh(cyl(D * 0.006, D * 0.006, D * 0.32, 6), dark, "leg"); const a = i / 4 * 2 * PI + PI / 4; lg.position.set(Math.cos(a) * D * 0.12, D * 0.1, Math.sin(a) * D * 0.12); lg.rotation.z = Math.cos(a) * 0.5; lg.rotation.x = -Math.sin(a) * 0.5; root.add(lg); }
    top = D * 0.75;
  } else {
    const bs = 0.22 * D + 0.04, h = bs * 0.45, y0 = h * 1.6;
    const bodyM = mesh(loft([{ x: bs * 0.7, cy: y0, hw: bs * 0.2, hh: h * 0.3, n: 3 }, { x: bs * 0.45, cy: y0, hw: bs * 0.5, hh: h * 0.5, n: 3 }, { x: -bs * 0.5, cy: y0, hw: bs * 0.5, hh: h * 0.5, n: 3 }, { x: -bs * 0.7, cy: y0, hw: bs * 0.3, hh: h * 0.35, n: 3 }], 24), body, "body"); root.add(bodyM);
    const bat = mesh(box(bs * 0.8, h * 0.5, bs * 0.45), plain(0x2d3440), "battery"); bat.position.y = y0 + h * 0.65; root.add(bat);
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * 2 * PI, cx = Math.cos(a) * arm, cz = Math.sin(a) * arm;
      const am = mesh(cyl(0.025 * D + 0.004, 0.025 * D + 0.004, arm, 10, "x"), body, "arm"); am.position.set(cx / 2, y0, cz / 2); am.rotation.y = -a; root.add(am);
      const mo = mesh(cyl(0.06 * D + 0.008, 0.06 * D + 0.008, 0.08 * D + 0.01, 16), dark, "motor"); mo.position.set(cx, y0 + 0.04 * D, cz); root.add(mo);
      const rt = rotor(D); rt.position.set(cx, y0 + 0.09 * D + 0.01, cz); rt.userData.dir = i % 2 ? 1 : -1; root.add(rt);
    }
    for (const s of [1, -1]) { const sk = mesh(box(bs * 1.2, 0.01 * D + 0.004, 0.01 * D + 0.004), dark, "leg"); sk.position.set(0, 0.004, s * bs * 0.4); root.add(sk); const lg = mesh(box(0.01 * D + 0.004, y0 - h * 0.5, 0.01 * D + 0.004), dark, "leg"); lg.position.set(0, (y0 - h * 0.5) / 2, s * bs * 0.4); root.add(lg); }
    if (p.payload > 0.05) { const cam = mesh(new T.SphereGeometry(bs * 0.14, 16, 12), plain(0x111111, { metalness: 0.8, roughness: 0.2 }), "camera"); cam.position.set(bs * 0.45, y0 - h * 0.6, 0); root.add(cam); }
    top = y0 + 0.2 * D;
  }
  const span = coax ? D : 2 * (arm + D / 2);
  return { root, L: span, D: top, bodies: [{ c: [0, top * 0.5, 0], a: [span * 0.25, top * 0.35, span * 0.25] }], props, lifting: [], downwash: true };
}

/* ================= BOAT ================= */
function hullGeo(L, B, Dp, T0, type, n = 16) {
  const st = [], sec = type === "planing" || type === "hydrofoil" ? "vee" : "round", radial = 22, pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = L / 2 - f * L, bow = Math.min(1, Math.pow(f / 0.4, sec === "vee" ? 0.6 : 0.8)), stern = sec === "vee" ? 1 : 1 - Math.pow(Math.max(0, f - 0.8) / 0.2, 2) * 0.35;
    const hw = B / 2 * bow * stern, keel = -T0 * (sec === "vee" ? Math.min(1, 0.4 + f) : Math.min(1, 0.3 + bow)) * 1.05, deck = Dp - T0 + (1 - f) * Dp * 0.18 * (1 - f);
    for (let j = 0; j <= radial; j++) { const t = j / radial, s = 2 * t - 1; // -1..1 across (port -> starboard) along bottom
      let z, y; const ang = s * PI / 2;
      if (sec === "vee") { const k = Math.abs(s); z = hw * s; y = keel + (Math.abs(keel) * 0.75) * k; if (k > 0.95) y = keel * 0.25; }
      else { z = hw * Math.sin(ang); y = keel * Math.cos(ang); }
      const rake = L * 0.12 * Math.pow(Math.max(0, 1 - f / 0.35), 2) * (1 - (y - keel) / Math.max(deck - keel, 1e-3));
      pos.push(x - rake, y, z); }
    pos.push(x, deck, hw, x, deck, -hw); // side tops
  }
  const rowL = radial + 3;
  for (let i = 0; i < n; i++) { const a0 = i * rowL, b0 = (i + 1) * rowL;
    for (let j = 0; j < radial; j++) idx.push(a0 + j, b0 + j, a0 + j + 1, a0 + j + 1, b0 + j, b0 + j + 1);
    // sides: starboard top (radial) to deck starboard (radial+1)
    idx.push(a0 + radial, b0 + radial, a0 + radial + 1, a0 + radial + 1, b0 + radial, b0 + radial + 1);
    idx.push(a0, a0 + radial + 2, b0, b0, a0 + radial + 2, b0 + radial + 2);
    idx.push(a0 + radial + 1, b0 + radial + 1, a0 + radial + 2, a0 + radial + 2, b0 + radial + 1, b0 + radial + 2); // deck
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function boat(p, r) {
  const root = new T.Group(), body = stdMat(p.mat), T0 = r.noLiquid ? p.D * 0.3 : clamp(r.T, 0.05, p.D * 0.95), cat = p.hull === "catamaran";
  const trim = plain(0x1d2530);
  if (cat) { const b = p.B / 4.5; for (const s of [1, -1]) { const h = mesh(hullGeo(p.L, b, p.D, T0, "round"), body, "hull"); h.position.z = s * (p.B - b) / 2; root.add(h); }
    const deck = mesh(box(p.L * 0.55, p.D * 0.12, p.B * 0.9), body, "deck"); deck.position.set(0, p.D - T0, 0); root.add(deck); }
  else root.add(mesh(hullGeo(p.L, p.B, p.D, T0, p.hull), body, "hull"));
  const cab = mesh(box(p.L * 0.28, p.D * 0.55, p.B * 0.6), plain(0xf0f3f7, { roughness: 0.4 }), "cabin"); cab.position.set(-p.L * 0.05, p.D - T0 + p.D * 0.3, 0); root.add(cab);
  const win = mesh(box(p.L * 0.285, p.D * 0.14, p.B * 0.61), plain(0x0c1118, { metalness: 0.7, roughness: 0.1 }), "glass"); win.position.set(-p.L * 0.05, p.D - T0 + p.D * 0.42, 0); root.add(win);
  if (p.payload > 50 && p.stack > 0.05) { const c = mesh(box(p.L * 0.3, p.stack, p.B * 0.7), plain(0xd9642b), "cargo"); c.position.set(-p.L * 0.3, p.D - T0 + p.stack / 2, 0); root.add(c); }
  if (p.hull === "hydrofoil") { const sd = p.D * 1.1; for (const [x, s] of [[p.L * 0.3, 0.8], [-p.L * 0.35, 1.1]]) { const str = mesh(box(0.08 * p.D, sd, 0.03 * p.D), trim, "strut"); str.position.set(x, -T0 - sd / 2 + 0.1, 0); root.add(str);
    const fg = wing({ root: p.L * 0.06 * s, tip: p.L * 0.035 * s, half: p.B * 0.45 * s, sweep: p.L * 0.02, tc: 0.1, m: 0.03 }); fg.translate(p.L * 0.03 * s, 0, 0); const f1 = mesh(fg, trim, "foil"), f2 = mesh(wing({ root: p.L * 0.06 * s, tip: p.L * 0.035 * s, half: p.B * 0.45 * s, sweep: p.L * 0.02, tc: 0.1, m: 0.03, mirror: true }).translate(p.L * 0.03 * s, 0, 0), trim, "foil");
    f1.position.set(x, -T0 - sd + 0.1, 0); f2.position.copy(f1.position); root.add(f1, f2); } }
  const mo = mesh(box(p.L * 0.04 + 0.1, p.D * 0.5, p.B * 0.08 + 0.05), plain(0x222222), "engine"); mo.position.set(-p.L / 2 - p.L * 0.01, -T0 * 0.3, 0); if (p.L < 12 && p.hull !== "displacement") root.add(mo);
  const bodies = [{ c: [0, -T0 * 0.4, 0], a: [p.L / 2, T0, p.B / 2] }];
  return { root, L: p.L, D: p.D, bodies, lifting: [], water: true, T0 };
}

/* ================= SUBMARINE ================= */
function sub(p, r) {
  const root = new T.Group(), body = stdMat(p.mat), D = p.D, R = D / 2, dark = plain(0x1e242c, { metalness: 0.5 });
  if (p.shape === "sphere") {
    root.add(mesh(new T.SphereGeometry(R, 40, 28), body, "hull"));
    const port = mesh(new T.CircleGeometry(R * 0.18, 24), plain(0x9fe6ff, { emissive: 0x0a3050, metalness: 0.2, roughness: 0.05 }), "port"); port.position.set(R * 1.001, R * 0.1, 0); port.rotation.y = PI / 2; root.add(port);
    const fr = mesh(new T.TorusGeometry(R * 1.05, R * 0.04, 8, 40), dark, "frame"); fr.rotation.x = PI / 2; root.add(fr);
    for (const s of [1, -1]) { const sk = mesh(box(D * 1.5, R * 0.08, R * 0.1), dark, "skid"); sk.position.set(0, -R * 1.1, s * R * 0.7); root.add(sk); }
    if ((p.foam || 0) > 0) { const v = p.foam, h = Math.cbrt(v / 2.4), fb = mesh(box(h * 2, h * 0.9, h * 1.3), plain(0xf2c230, { roughness: 0.8 }), "foam"); fb.position.y = R + h * 0.5; root.add(fb); }
    const lt = mesh(cyl(R * 0.1, R * 0.12, R * 0.3, 12, "x"), plain(0xfff6d0, { emissive: 0xfff0a0, emissiveIntensity: 0.9 }), "light"); lt.position.set(R * 0.9, -R * 0.6, R * 0.5); root.add(lt);
    return { root, L: D * 1.6, D, bodies: [{ c: [0, 0, 0], a: [R, R, R] }], lifting: [], water: true, sub: true };
  }
  const L = Math.max(p.L, D * 1.2), prof = [];
  for (let i = 0; i <= 40; i++) { const f = i / 40, x = f * L; let rr;
    if (p.shape === "teardrop") { rr = f > 0.78 ? R * Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.78) / 0.22, 2))) : f < 0.35 ? R * Math.pow(Math.max(0, 1 - (0.35 - f) / 0.35 * 0.99), 0.0) * (1 - Math.pow((0.35 - f) / 0.35, 2.2)) : R; }
    else { rr = x < R ? Math.sqrt(Math.max(0, R * R - (R - x) ** 2)) : x > L - R ? Math.sqrt(Math.max(0, R * R - (x - (L - R)) ** 2)) : R; }
    prof.push([Math.max(rr, 1e-3), x]); }
  // lathe axis: y from 0 (tail) to L (nose) -> +x
  const hull = mesh(lathe(prof.map(([rr, x]) => [rr, x])), body, "hull"); hull.position.x = -L / 2; root.add(hull);
  if (p.sail) { const sh = mesh(loft([{ x: L * 0.3, cy: R + R * 0.45, hw: R * 0.05, hh: R * 0.45, n: 3 }, { x: L * 0.25, cy: R + R * 0.45, hw: R * 0.18, hh: R * 0.45, n: 3 }, { x: L * 0.12, cy: R + R * 0.45, hw: R * 0.14, hh: R * 0.45, n: 3 }, { x: L * 0.08, cy: R + R * 0.4, hw: R * 0.04, hh: R * 0.4, n: 3 }], 20), body, "sail"); sh.position.y = -R * 0.05; root.add(sh);
    for (const s of [1, -1]) { const sp = mesh(box(R * 0.4, R * 0.04, R * 0.5), body, "plane"); sp.position.set(L * 0.2, R * 1.4, s * R * 0.4); root.add(sp); } }
  for (let i = 0; i < 4; i++) { const f = mesh(box(R * 0.8, R * 0.05, R * 0.9), dark, "fin"); const hold = new T.Group(); f.position.set(0, 0, R * 0.55); hold.add(f); hold.rotation.x = i * PI / 2; hold.position.x = -L / 2 + R * 0.6; root.add(hold); }
  const prop = new T.Group(); for (let b = 0; b < 7; b++) { const bl = mesh(box(R * 0.08, R * 0.55, R * 0.18), plain(0xb58a4c, { metalness: 0.8, roughness: 0.3 }), "prop"); bl.position.y = R * 0.28; const h = new T.Group(); h.add(bl); h.rotation.x = b / 7 * 2 * PI; prop.add(h); }
  prop.position.x = -L / 2 - R * 0.05; prop.userData.prop = true; root.add(prop);
  return { root, L, D, bodies: [{ c: [0, 0, 0], a: [L / 2, R, R] }], lifting: [], props: [prop], water: true, sub: true };
}

function build(kind, p, r) {
  const m = kind === "rocket" ? rocket(p, r) : kind === "car" ? car(p, r) : kind === "plane" ? plane(p, r) : kind === "drone" ? drone(p, r) : kind === "boat" ? boat(p, r) : sub(p, r);
  m.kind = kind; m.props = m.props || []; m.lifting = m.lifting || []; return m;
}
window.MODELS = { build, stdMat, plain, loft, wing, naca, lathe };
})();
