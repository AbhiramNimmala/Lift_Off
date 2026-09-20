/* LiftOff Aero Studio: 3D scene, hologram look, live wind tunnel (potential-flow streaks + surface pressure). */
(() => {
"use strict";
const A = window.Aero, T = THREE, PI = Math.PI, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ---------- renderer / camera ---------- */
const cv = $("gl"), R3 = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
R3.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R3.outputEncoding = T.sRGBEncoding; R3.toneMapping = T.ACESFilmicToneMapping; R3.toneMappingExposure = 1.05;
const scene = new T.Scene(), BG = new T.Color(0x02050b); scene.background = BG; scene.fog = new T.FogExp2(0x02050b, 0.035);
const cam = new T.PerspectiveCamera(40, 1, 0.01, 5000);
const orbit = { az: 0.75, el: 0.28, dist: 9, target: new T.Vector3(0, 1.4, 0), goalDist: 9, goalT: new T.Vector3(0, 1.4, 0), auto: true, enabled: true };
const hemi = new T.HemisphereLight(0xbfe6ff, 0x0a1420, 0.75), sun = new T.DirectionalLight(0xffffff, 1.35), rim = new T.DirectionalLight(0x58e1ff, 0.7);
sun.position.set(6, 10, 7); rim.position.set(-8, 4, -6); scene.add(hemi, sun, rim);
const U = { time: { value: 0 } };
function resize() { const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight; if (!w || !h) return; R3.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener("resize", resize); resize(); new ResizeObserver(resize).observe(cv);

// pointer orbit
let drag = null;
cv.addEventListener("pointerdown", e => { if (!orbit.enabled) return; drag = { x: e.clientX, y: e.clientY, az: orbit.az, el: orbit.el }; cv.setPointerCapture(e.pointerId); cv.classList.add("drag"); orbit.auto = false; });
cv.addEventListener("pointermove", e => { if (!drag) return; orbit.az = drag.az - (e.clientX - drag.x) * 0.006; orbit.el = clamp(drag.el + (e.clientY - drag.y) * 0.005, -0.3, 1.35); });
cv.addEventListener("pointerup", () => { drag = null; cv.classList.remove("drag"); });
cv.addEventListener("wheel", e => { e.preventDefault(); orbit.goalDist = clamp(orbit.goalDist * Math.exp(e.deltaY * 0.001), 2.5, 40); }, { passive: false });
cv.addEventListener("dblclick", () => { orbit.auto = true; });

/* ---------- hologram materials ---------- */
function holoMat(color = 0x58e1ff, op = 1) {
  return new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.FrontSide,
    uniforms: { time: U.time, color: { value: new T.Color(color) }, op: { value: op } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = (modelMatrix*vec4(position,1.0)).y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float op; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.0-abs(dot(vN,vV)),2.0); float scan = smoothstep(0.92,1.0,sin(vY*14.0-time*2.5)); float a = (f*0.85+scan*0.25)*op; gl_FragColor = vec4(color*(0.7+f*0.6), a); }` });
}
function glowTex(soft = 0.35) { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(soft, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); }
const GLOW = glowTex();

/* ---------- studio environment (build + tunnel) ---------- */
const studioEnv = new T.Group(); scene.add(studioEnv);
{ const grid = new T.GridHelper(60, 120, 0x15506a, 0x0a2230); grid.material.transparent = true; grid.material.opacity = 0.35; studioEnv.add(grid);
  const ring = (r, op, w = 0.02) => { const m = new T.Mesh(new T.RingGeometry(r - w, r, 128), new T.MeshBasicMaterial({ color: 0x58e1ff, transparent: true, opacity: op, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -PI / 2; m.position.y = 0.003; return m; };
  [[2.6, .5, .015], [2.75, .18, .1], [3.3, .12, .01], [4.4, .08, .01]].forEach(a => studioEnv.add(ring(...a)));
  const disc = new T.Mesh(new T.CircleGeometry(2.6, 96), new T.MeshBasicMaterial({ color: 0x0b2a3a, transparent: true, opacity: 0.35, depthWrite: false })); disc.rotation.x = -PI / 2; disc.position.y = 0.002; studioEnv.add(disc);
  const n = 1400, g = new T.BufferGeometry(), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 120 + Math.random() * 200, th = Math.random() * 2 * PI, ph = Math.random() * 1.4 - 0.2; p.set([r * Math.cos(th) * Math.cos(ph), r * Math.sin(ph), r * Math.sin(th) * Math.cos(ph)], i * 3); }
  g.setAttribute("position", new T.BufferAttribute(p, 3)); studioEnv.add(new T.Points(g, new T.PointsMaterial({ color: 0xbcd6ff, size: 1.3, map: GLOW, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
  const scan = ring(2.6, 0.6, 0.06); scan.name = "scan"; studioEnv.add(scan); }

/* ---------- vehicle display ---------- */
const disp = new T.Group(); scene.add(disp);          // display frame (scaled)
const holder = new T.Group(); disp.add(holder);       // rotates with AoA
const tunnelG = new T.Group(); disp.add(tunnelG);     // flow particles (tunnel frame)
let M = null, cur = { kind: null, p: null, r: null }, mode = "build", view = "holo", S = 1, morph = 0;
const TAGS = $("tags");
function clearTags() { TAGS.innerHTML = ""; tags.length = 0; }
const tags = [];
function addTag(text, local, cls) { const el = document.createElement("div"); el.className = "tag " + (cls || ""); el.textContent = text; TAGS.appendChild(el); tags.push({ el, local }); return el; }

function applyView(obj) {
  obj.traverse(o => {
    if (!o.isMesh || o.userData.overlay) return;
    if (!o.userData.real) o.userData.real = o.material;
    if (o.userData.holo) { o.remove(o.userData.holo); o.userData.holo = null; }
    if (view === "pressure") { o.material = o.userData.pmat || (o.userData.pmat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: o.userData.role === "prop", opacity: o.userData.role === "prop" ? 0.3 : 1 })); }
    else { o.material = o.userData.real; if (view === "holo" && o.geometry && !(o.material && o.material.depthWrite === false)) { const h = new T.Mesh(o.geometry, HOLO); h.userData.overlay = true; h.renderOrder = 2; o.add(h); o.userData.holo = h; } }
  });
}
const HOLO = holoMat(0x58e1ff, 0.9);

function setVehicle(kind, p, reframe) {
  const r = window.STUDIO && window.STUDIO.r ? window.STUDIO.r : A.run(kind, p);
  cur = { kind, p: JSON.parse(JSON.stringify(p)), r };
  if (M) { holder.remove(M.root); M.root.traverse(o => { if (o.geometry && !o.userData.overlay) o.geometry.dispose(); }); }
  M = MODELS.build(kind, p, r);
  holder.add(M.root);
  // display scale & orientation
  const target = kind === "rocket" ? 4.4 : kind === "plane" ? 5.2 : kind === "drone" ? 3.6 : 4.6;
  const newS = target / Math.max(M.L, 1e-3);
  S = newS; disp.scale.setScalar(S);
  holder.rotation.set(0, 0, 0); tunnelG.rotation.set(0, 0, 0); disp.rotation.set(0, 0, 0); disp.position.set(0, 0, 0);
  if (kind === "rocket") { disp.rotation.z = PI / 2; disp.position.y = 0.05; }
  if (kind === "boat") disp.position.y = 0.6 + (M.T0 || 0) * S;
  if (kind === "sub") disp.position.y = 1.5;
  if (kind === "plane") disp.position.y = 0.05;
  applyView(M.root);
  // tags
  clearTags();
  const lenTxt = A.Dm(kind === "rocket" ? p.L : kind === "plane" ? p.fuseL : kind === "drone" ? M.L : kind === "sub" && p.shape === "sphere" ? p.D : p.L).join(" ");
  if (kind === "rocket") {
    const g = r.g, cgx = A.rocketMass(g, 0, g.stages.map(() => 1)).cg;
    addTag(`${lenTxt} tall · Ø ${A.Dm(g.d).join(" ")}`, new T.Vector3(g.L * 1.04, 0, 0));
    if (!g.liquid) { addTag("CG", new T.Vector3(g.L - cgx, g.r * 1.8, 0), "dim"); addTag("CP", new T.Vector3(g.L - g.CP, -g.r * 1.8, 0), "o"); cgMarks(g.L - cgx, g.L - g.CP, g.r); }
    else cgMarks(null);
  } else {
    cgMarks(null);
    const box = new T.Box3().setFromObject(M.root);
    addTag(kind === "plane" ? `${A.Dm(p.span).join(" ")} span · ${lenTxt} long` : kind === "drone" ? `${A.Dm(p.prop).join(" ")} rotors` : `${lenTxt} long`, new T.Vector3((box.max.x + box.min.x) / 2 / 1, box.max.y + M.L * 0.06, 0));
  }
  if (reframe) { orbit.goalT.set(0, kind === "rocket" ? 2.3 : kind === "sub" ? 1.5 : 1.0, 0); orbit.goalDist = (kind === "rocket" ? 8.5 : 9.5) * (innerWidth < 860 ? 1.4 : 1); morph = 1; }
  if (mode === "tunnel") { resetFlow(); window.tunnelUI && tunnelUI(); }
  if (ghost) ghost.root.visible = mode !== "tunnel" && kind === ghost.kind;
}
let cgG = null;
function cgMarks(xcg, xcp, R) {
  if (cgG) { holder.remove(cgG); cgG = null; } if (xcg == null) return;
  cgG = new T.Group();
  const mk = (x, col) => { const m = new T.Mesh(new T.SphereGeometry(R * 0.35, 16, 10), new T.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 })); m.position.x = x; m.renderOrder = 5; const r2 = new T.Mesh(new T.TorusGeometry(R * 1.35, R * 0.06, 8, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthTest: false })); r2.rotation.y = PI / 2; r2.position.x = x; r2.renderOrder = 5; cgG.add(m, r2); };
  mk(xcg, 0xffffff); mk(xcp, 0xff7a3d); holder.add(cgG);
}

/* ---------- wind tunnel: flow field ---------- */
const NP = 1500, TR = 7;
let flow = null, Uinf = 0, aoa = 0, tunnelInfo = { cl: 0, stall: false, cd: 0.5, water: false };
const tmpV = new T.Vector3();
function fieldAt(x, y, z, out) {
  // free stream in model frame: comes from the nose (+x) and flows toward -x, rotated by AoA
  const ca = Math.cos(aoa), sa = Math.sin(aoa);
  let ux = -ca, uy = sa, uz = 0; // unit (relative wind seen by a nose-up model)
  let vx = ux, vy = uy, vz = uz;
  for (const b of M.bodies) {
    const ax = b.a[0], ay = b.a[1], az = b.a[2];
    const qx = (x - b.c[0]) / ax, qy = (y - b.c[1]) / ay, qz = (z - b.c[2]) / az, r2 = qx * qx + qy * qy + qz * qz, r = Math.sqrt(r2);
    if (r < 0.2) continue;
    const k = 1 / (2 * r2 * r) * (b.thin ? 0.35 : 1), Ux = ux * ax, Uy = uy * ay, Uz = uz * az, Un = Math.hypot(Ux, Uy, Uz) || 1;
    const ex = Ux / Un, ey = Uy / Un, ez = Uz / Un, dot = (ex * qx + ey * qy + ez * qz) / r;
    const px = k * (ex - 3 * dot * qx / r), py = k * (ey - 3 * dot * qy / r), pz = k * (ez - 3 * dot * qz / r);
    const scale = (ax + ay + az) / 3; vx += px * ax / scale; vy += py * ay / scale; vz += pz * az / scale;
  }
  for (const l of M.lifting) {
    const dz = Math.abs(z) / l.half, behind = sstep((l.x - x) / (l.chord * 1.2) + 0.3), near = Math.exp(-Math.pow((y - l.y) / (l.chord * 1.4), 2));
    const G = tunnelInfo.cl * l.sign * 0.45;
    if (dz < 1) vy += -G * near * (behind * 1.2 - (1 - behind) * 0.35) * Math.sqrt(1 - dz * dz * 0.9);
    const tipD = Math.hypot(Math.abs(z) - l.half, y - l.y) / (l.chord * 0.6);
    if (x < l.x && tipD < 3) { const s = G * 1.6 / (1 + tipD * tipD) * Math.sign(z), dy = y - l.y, dzz = Math.abs(z) - l.half; vy += s * dzz * 0.8; vz += -s * dy * 0.8; }
  }
  // wake behind bodies
  const b0 = M.bodies[0], tail = b0.c[0] - b0.a[0];
  if (x < tail + b0.a[0] * 0.3) { const d = (tail - x) / (b0.a[0] * 2), rr = Math.hypot((y - b0.c[1]) / b0.a[1], (z - b0.c[2]) / b0.a[2]);
    if (rr < 1.4 + d) { const amp = tunnelInfo.cd * 0.9 * Math.exp(-d * 0.8) * (1.4 + d - rr) / (1.4 + d); const t = U.time.value * 6;
      vx *= 1 - amp * 0.6; vy += amp * Math.sin(t + x * 7 / b0.a[0] + z * 3) * 0.5; vz += amp * Math.cos(t * 1.3 + x * 5 / b0.a[0] + y * 3) * 0.5; } }
  if (tunnelInfo.stall && M.lifting[0]) { const l = M.lifting[0]; if (x < l.x + l.chord * 0.3 && x > l.x - l.chord * 4 && y > l.y && y < l.y + l.chord * 1.5 && Math.abs(z) < l.half) { const t = U.time.value * 9; vx *= 0.3; vy += Math.sin(t + x * 11) * 0.6; vz += Math.cos(t + x * 13) * 0.4; } }
  out.set(vx, vy, vz); return out;
}
function cmap(t, c) { // t: 0 suction .. 1 stagnation
  const stops = [[0, 0.16, 0.24, 1], [0.2, 0.12, 0.71, 1], [0.4, 0.21, 0.94, 0.75], [0.6, 0.96, 0.96, 0.42], [0.8, 1, 0.54, 0.24], [1, 1, 0.18, 0.33]];
  t = clamp(t, 0, 1); let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], f = (t - a[0]) / (b[0] - a[0]); c.setRGB(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f); return c;
}
function domain() { const L = M.L, H = cur.kind === "rocket" ? Math.max(M.D * 2.5, L * 0.12) : Math.max(M.D, L * 0.25); return { x0: L * 0.85, x1: -L * 1.15, y0: (M.bodies[0].c[1]) - H * 0.9, y1: M.bodies[0].c[1] + H * 0.9, z: Math.max(L * 0.3, (M.lifting[0] ? M.lifting[0].half * 1.2 : 0)) }; }
function resetFlow() {
  if (flow) { tunnelG.remove(flow.lines); flow.lines.geometry.dispose(); }
  const pos = new Float32Array(NP * (TR - 1) * 6), col = new Float32Array(NP * (TR - 1) * 6), g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("color", new T.BufferAttribute(col, 3));
  const lines = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: cur.kind === "rocket" ? 0.45 : 0.85, blending: T.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false; tunnelG.add(lines);
  const P = [], D = domain();
  for (let i = 0; i < NP; i++) { const p = { tr: [] }; spawn(p, D, true); P.push(p); }
  flow = { lines, P, D };
}
function spawn(p, D, anywhere) {
  const rake = Math.floor(Math.random() * 7), zz = M.kind === "rocket" || M.kind === "sub" ? (Math.random() * 2 - 1) * D.z * 0.5 : ((rake / 6) * 2 - 1) * D.z;
  const x = anywhere ? D.x1 + Math.random() * (D.x0 - D.x1) : D.x0, y = D.y0 + Math.random() * (D.y1 - D.y0);
  p.tr.length = 0; for (let k = 0; k < TR; k++) p.tr.push([x, M.kind === "car" || M.kind === "drone" ? Math.max(y, 0.02) : y, zz]);
}
const cA = new T.Color(), cB = new T.Color();
function stepFlow(dt) {
  if (!flow || !M) return;
  const P = flow.P, D = flow.D, pos = flow.lines.geometry.attributes.position.array, col = flow.lines.geometry.attributes.color.array;
  const spd = (0.25 + Math.sqrt(Uinf / (TMAX() || 1)) * 1.4) * M.L * 0.9 * dt;
  let w = 0;
  for (const p of P) {
    const h = p.tr[0]; fieldAt(h[0], h[1], h[2], tmpV);
    const nx = h[0] + tmpV.x * spd, ny = h[1] + tmpV.y * spd, nz = h[2] + tmpV.z * spd;
    p.tr.pop(); p.tr.unshift([nx, (M.kind === "car" || M.kind === "drone" || M.kind === "plane") ? Math.max(ny, 0.01 - (M.kind === "plane" ? 99 : 0)) : ny, nz]);
    p.sp = Math.hypot(tmpV.x, tmpV.y, tmpV.z);
    if (nx < D.x1 || nx > D.x0 * 1.3 || ny > D.y1 * 2 + M.L || ny < D.y0 - M.L || Math.abs(nz) > D.z * 2.5 + M.L * 0.3 || Math.random() < 0.002) spawn(p, D, false);
    const cp = 1 - p.sp * p.sp; cmap(0.55 + cp * 0.45, cA);
    for (let k = 0; k < TR - 1; k++) { const a = p.tr[k], b = p.tr[k + 1], fade = 1 - k / (TR - 1);
      pos[w] = a[0]; pos[w + 1] = a[1]; pos[w + 2] = a[2]; pos[w + 3] = b[0]; pos[w + 4] = b[1]; pos[w + 5] = b[2];
      col[w] = cA.r * fade; col[w + 1] = cA.g * fade; col[w + 2] = cA.b * fade; col[w + 3] = cA.r * fade * 0.6; col[w + 4] = cA.g * fade * 0.6; col[w + 5] = cA.b * fade * 0.6; w += 6; }
  }
  flow.lines.geometry.attributes.position.needsUpdate = true; flow.lines.geometry.attributes.color.needsUpdate = true;
}
function paintPressure() {
  if (!M) return;
  M.root.updateMatrixWorld(true); holder.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(holder.matrixWorld).invert(), v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3(), c = new T.Color();
  M.root.traverse(o => {
    if (!o.isMesh || o.userData.overlay || !o.geometry.attributes.position) return;
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal; if (!N) return;
    let C = g.attributes.color; if (!C || C.count !== P.count) { C = new T.BufferAttribute(new Float32Array(P.count * 3), 3); g.setAttribute("color", C); }
    const mw = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(mw);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(mw); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      const eps = M.L * 0.02; fieldAt(v.x + n.x * eps, v.y + n.y * eps, v.z + n.z * eps, tmpV);
      const ca = Math.cos(aoa), sa = Math.sin(aoa), facing = -(n.x * -ca + n.y * sa); // + when facing into the wind
      let cp = 1 - (tmpV.x * tmpV.x + tmpV.y * tmpV.y + tmpV.z * tmpV.z);
      if (facing > 0.2) cp = Math.max(cp, facing * facing);
      if (M.lifting.length && (o.userData.role === "wing" || o.userData.role === "foil" || o.userData.role === "tail")) cp += -Math.sign(n.y) * tunnelInfo.cl * 0.45 * (M.lifting[0].sign || 1);
      cmap(0.5 + cp * 0.5, c); C.setXYZ(i, c.r, c.g, c.b);
    }
    C.needsUpdate = true;
  });
}
let machCone = null;
function setMachCone(M1, blunt) {
  if (machCone) { tunnelG.remove(machCone); machCone = null; }
  if (!(M1 > 1) || cur.kind !== "rocket") return;
  const mu = Math.asin(1 / M1), len = M.L * 1.3, rad = Math.tan(mu) * len * (blunt ? 1.25 : 1);
  const g = new T.ConeGeometry(rad, len, 48, 1, true); g.rotateZ(PI / 2); g.translate(M.L - len / 2 + (blunt ? M.D * 0.25 : 0), 0, 0);
  machCone = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  tunnelG.add(machCone);
}
const TMAXV = { rocket: 1700, car: 110, plane: 300, drone: 40, boat: 30, sub: 20 };
const TMAX = () => TMAXV[cur.kind] || 100;
function tunnel(v, aoaDeg) {
  if (!M) return null;
  Uinf = v; const k = cur.kind, p = cur.p, r = cur.r, pl = A.PLANETS[p.planet] || A.PLANETS.earth;
  aoa = (k === "car" ? -aoaDeg * 0.25 : k === "boat" ? 0 : aoaDeg) * PI / 180;
  holder.rotation.z = k === "boat" ? 0 : aoa; tunnelG.rotation.z = 0;
  // flow uses model frame, so rotate field by aoa but draw in tunnel frame: simplest is to rotate tunnel group with holder and tilt the stream
  tunnelG.rotation.z = aoa; aoa = aoa; // streaks drawn in model frame with a free stream tilted by aoa
  const A0 = A.atm(pl, 0), rho = A0.rho, q = 0.5 * rho * v * v;
  let out = [], cl = 0, stall = false, cd = 0.5, raw = {}, arr = [];
  const N = x => Math.abs(x) >= 1e5 ? A.nf(x / 1000) + "k" : A.nf(x, Math.abs(x) < 10 ? 1 : 0);
  if (k === "rocket") { const g = r.g, M1 = v / A0.a, Re = rho * v * g.L / A0.mu, c = A.rocketCd(g, M1, Math.max(Re, 1e4), false, false, g.L), a = aoaDeg * PI / 180; cd = c;
    const CN = 2 + g.CNf, Nf = q * g.A * CN * Math.sin(a); cl = 0; raw = { drag: q * g.A * c, side: Nf, mach: M1 };
    const Wr = r.m0 * pl.g; arr = [{ d: [-1, 0, 0], F: raw.drag, W: Wr, c: 0xff7a3d, l: "Drag", log: true }]; if (Math.abs(Nf) > 1e-3) arr.push({ d: [0, Math.sign(Nf) || 1, 0], F: Math.abs(Nf), W: Wr, c: 0x53f2a6, l: "Side push", log: true }); out = [["Drag", N(q * g.A * c) + " N"], ["Side force", N(Nf) + " N"], ["Cd", A.nf(c, 2)], ["Mach", A.nf(M1, 2)], ["Reynolds", Re > 0 ? Re.toExponential(1) : "0"]]; setMachCone(M1, p.nose === "blunt"); }
  if (k === "car") { const a = r.aero, pitch = aoaDeg * 0.02, cla = a.ClA * (1 + pitch * 3), df = q * cla, dr = q * a.CdA; cl = cla / 3; cd = a.Cd; stall = a.wingStall; raw = { df, drag: dr, weight: r.m * pl.g, stall };
    arr = [{ d: [0, -1, 0], F: Math.max(df, 0), W: raw.weight, c: 0x53f2a6, l: "Downforce", off: [0.25, 0, 0] }, { d: [0, -1, 0], F: raw.weight, W: raw.weight, c: 0x8aa3bf, l: "Weight", off: [-0.25, 0, 0] }, { d: [-1, 0, 0], F: dr, W: raw.weight, c: 0xff7a3d, l: "Drag" }];
    out = [["Downforce", A.nf(df / 9.81) + " kg"], ["Drag", N(dr) + " N"], ["DF ÷ drag", A.nf(cla / a.CdA, 2)], ["Balance", A.nf(a.balance * 100) + "% F"], ["Weight carried", A.nf(df / 9.81 / r.m * 100) + "%"]]; }
  if (k === "plane") { const P = r.P, af = A.AIRFOILS[p.airfoil], a0 = (af.a0 - p.flaps * 3) * PI / 180, al = aoaDeg * PI / 180; let CL = P.CLa * (al - a0);
    if (CL > P.CLmax) { stall = true; CL = P.CLmax * 0.62 - (CL - P.CLmax) * 0.2; } if (CL < -P.CLmax * 0.8) { stall = true; CL = -P.CLmax * 0.5; }
    const CD = P.CD0f(rho, Math.max(v, 1), A0.mu) + P.K * CL * CL + (stall ? 0.12 + Math.abs(al) * 0.5 : 0); cl = CL; cd = CD;
    const L = q * P.S * CL, D = q * P.S * CD; raw = { lift: L, drag: D, weight: P.W, stall };
    arr = [{ d: [0, Math.sign(L) || 1, 0], F: Math.abs(L), W: P.W, c: 0x53f2a6, l: "Lift", off: [0.12, 0, 0] }, { d: [0, -1, 0], F: P.W, W: P.W, c: 0x8aa3bf, l: "Weight", off: [-0.12, 0, 0] }, { d: [-1, 0, 0], F: D, W: P.W, c: 0xff7a3d, l: "Drag" }]; out = [["Lift", N(L) + " N"], ["Drag", N(D) + " N"], ["L ÷ D", A.nf(L / Math.max(D, 1e-6), 1)], ["C_L", A.nf(CL, 2)], ["Lift ÷ weight", A.nf(L / P.W * 100) + "%"]]; }
  if (k === "drone") { const CdA = 0.02 + 0.3 * p.prop * p.prop, D = q * CdA * 3; cd = 1; raw = { drag: D, tilt: Math.atan2(D, r.W) * 57.3, weight: r.W };
    arr = [{ d: [-1, 0, 0], F: D, W: r.W, c: 0xff7a3d, l: "Drag", log: true }, { d: [0, -1, 0], F: r.W, W: r.W, c: 0x8aa3bf, l: "Weight", log: true }]; out = [["Drag", A.nf(D, 1) + " N"], ["Power to push", A.nf(D * v) + " W"], ["Max speed", A.nf(r.vmax * 3.6) + " km/h"], ["Tilt needed", A.nf(Math.atan2(D, r.W) * 57.3, 1) + "°"], ["Air", A.nf(rho, 3) + " kg/m³"]]; }
  if (k === "boat") { if (r.noLiquid) { out = [["", "No liquid here"]]; raw = { noLiquid: true }; } else { const liq = r.liq, Fn = v / Math.sqrt(pl.g * p.L), Re = v * p.L / liq.nu; cd = 0.6; raw = { Fn, wl: 2 * PI * v * v / pl.g }; out = [["Froude", A.nf(Fn, 2)], ["Regime", Fn < 0.4 ? "displacement" : Fn < 1 ? "hump" : "planing"], ["Wave length", A.nf(2 * PI * v * v / pl.g, 1) + " m"], ["Kelvin angle", "19.47°"], ["Reynolds", Re > 0 ? Re.toExponential(1) : "0"]]; } }
  if (k === "sub") { if (r.noLiquid) { out = [["", "No liquid here"]]; raw = { noLiquid: true }; } else { const liq = r.liq, Re = v * r.f * p.D / liq.nu, Cf = Re > 1e4 ? 0.075 / Math.pow(Math.log10(Re) - 2, 2) : 0.01, CdS = p.shape === "sphere" ? 0.47 * PI * p.D * p.D / 4 : Cf * r.FF * r.Sw, D = 0.5 * liq.rho * v * v * CdS; cd = p.shape === "sphere" ? 0.8 : 0.3; raw = { drag: D };
    arr = [{ d: [-1, 0, 0], F: D, W: Math.max(D, 1) * 2, c: 0xff7a3d, l: "Drag", log: true }];
    out = [["Drag", N(D) + " N"], ["Power", A.nf(D * v / 1000, 1) + " kW"], ["Form factor", A.nf(r.FF, 2)], ["Reynolds", Re > 0 ? Re.toExponential(1) : "0"], ["Fineness", A.nf(r.f, 1)]]; } }
  tunnelInfo = { cl: clamp(cl, -2.5, 2.5), stall, cd: clamp(cd, 0.05, 1.5), water: k === "boat" || k === "sub" };
  if (view === "pressure") paintPressure();
  arrows(v > 0.01 ? arr : null);
  out.raw = raw; return out;
}

/* ---------- force arrows (tunnel): length shows how big each force is ---------- */
const arrowG = new T.Group(); scene.add(arrowG); let arrowList = [];
const ATAGS = document.createElement("div"); ATAGS.id = "atags"; document.body.appendChild(ATAGS);
function arrows(list) {
  while (arrowG.children.length) { const c = arrowG.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  ATAGS.innerHTML = ""; arrowList = []; if (!list || !M || mode !== "tunnel") return;
  disp.updateMatrixWorld(true); const box = new T.Box3().setFromObject(M.root), c0 = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()).length();
  for (const a of list) {
    if (!(a.F > 0) || !isFinite(a.F)) continue;
    const ratio = a.F / Math.max(a.W, 1e-9), len = a.log ? clamp(0.45 + 0.75 * Math.log10(1 + ratio * 4), 0.3, 2.6) : clamp(1.7 * ratio, 0.22, 3);
    const dir = new T.Vector3(...a.d).applyQuaternion(disp.quaternion).normalize();
    const off = a.off ? new T.Vector3(...a.off).multiplyScalar(size * 0.5).applyQuaternion(disp.quaternion) : new T.Vector3();
    const o = c0.clone().add(off).add(dir.clone().multiplyScalar(size * 0.12));
    const g = new T.Group(), mat = new T.MeshBasicMaterial({ color: a.c, transparent: true, opacity: 0.92, depthTest: false });
    const head = Math.min(0.32, len * 0.35), shaft = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, Math.max(0.01, len - head), 10), mat), cone = new T.Mesh(new T.ConeGeometry(0.11, head, 16), mat);
    shaft.position.y = (len - head) / 2; cone.position.y = len - head / 2; g.add(shaft, cone); g.renderOrder = 9; shaft.renderOrder = cone.renderOrder = 9;
    g.position.copy(o); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); arrowG.add(g);
    const el = document.createElement("div"); el.className = "atag"; el.style.borderColor = "#" + a.c.toString(16).padStart(6, "0"); el.style.color = el.style.borderColor; el.textContent = a.l; ATAGS.appendChild(el);
    arrowList.push({ el, tip: o.clone().add(dir.clone().multiplyScalar(len + 0.18)) });
  }
}
function placeArrowTags() { if (!arrowList.length) return; const w = cv.clientWidth, h = cv.clientHeight; for (const a of arrowList) { tmpV.copy(a.tip).project(cam); a.el.style.left = ((tmpV.x + 1) / 2 * w) + "px"; a.el.style.top = ((1 - tmpV.y) / 2 * h) + "px"; a.el.style.display = tmpV.z < 1 ? "" : "none"; } }

/* ---------- ghost: the pinned design, drawn as an orange hologram for comparison ---------- */
let ghost = null; const GHOST = holoMat(0xff9a4d, 1.1);
function setGhost(kind, p) {
  if (ghost) { holder.remove(ghost.root); ghost.root.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); ghost = null; }
  if (!kind || !p) return;
  try { ghost = MODELS.build(kind, p, A.run(kind, p)); ghost.kind = kind; } catch (e) { ghost = null; return; }
  ghost.root.traverse(o => { if (o.isMesh) { o.material = GHOST; o.renderOrder = 3; } if (o.isPoints || o.isLine) o.visible = false; });
  holder.add(ghost.root); ghost.root.visible = mode !== "tunnel" && cur.kind === kind;
}

/* ---------- modes ---------- */
function setMode(m) {
  mode = m; if (m !== "tunnel") arrows(null); if (ghost) ghost.root.visible = m !== "tunnel" && cur.kind === ghost.kind;
  if (m === "tunnel") { view = "pressure"; if (M) { applyView(M.root); resetFlow(); } }
  else { view = "holo"; if (M) { applyView(M.root); holder.rotation.z = 0; } if (flow) { tunnelG.remove(flow.lines); flow = null; } setMachCone(0); }
  TAGS.style.display = m === "build" ? "" : "none";
}

/* ---------- loop ---------- */
const clock = new T.Clock(); let hooks = [];
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); U.time.value += dt;
  if (window.TEST && TEST.active) TEST.frame(dt);
  else {
    if (orbit.auto && mode === "build") orbit.az += dt * 0.12;
    orbit.dist += (orbit.goalDist - orbit.dist) * Math.min(1, dt * 3); orbit.target.lerp(orbit.goalT, Math.min(1, dt * 3));
    cam.position.set(orbit.target.x + orbit.dist * Math.cos(orbit.el) * Math.sin(orbit.az), orbit.target.y + orbit.dist * Math.sin(orbit.el), orbit.target.z + orbit.dist * Math.cos(orbit.el) * Math.cos(orbit.az));
    cam.lookAt(orbit.target);
    if (morph > 0) { morph = Math.max(0, morph - dt * 1.8); const s = 1 - Math.pow(morph, 3) * 0.25; holder.scale.set(1, s, 1); HOLO.uniforms.op.value = 0.9 + morph * 1.5; }
    const sc = studioEnv.getObjectByName("scan"); if (sc) { const f = (U.time.value * 0.35) % 1; sc.scale.setScalar(0.3 + f * 1.4); sc.material.opacity = 0.5 * (1 - f); }
    if (M) for (const pr of M.props) { if (pr.parent && pr.parent.userData) {} if (cur.kind === "drone") pr.rotation.y += dt * 40 * (pr.userData.dir || 1); else pr.rotation.x += dt * (mode === "tunnel" ? 20 : 8); }
    if (mode === "tunnel") { stepFlow(dt); placeArrowTags(); }
    // tags
    if (M && TAGS.style.display !== "none") { const w = cv.clientWidth, h = cv.clientHeight; holder.updateMatrixWorld(); for (const t of tags) { tmpV.copy(t.local).applyMatrix4(holder.matrixWorld).project(cam); const vis = tmpV.z < 1; t.el.style.display = vis ? "" : "none"; t.el.style.left = ((tmpV.x + 1) / 2 * w) + "px"; t.el.style.top = ((1 - tmpV.y) / 2 * h) + "px"; } }
  }
  for (const f of hooks) f(dt);
  R3.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.S3D = { arrows, setGhost, lights: { hemi, sun, rim }, R3, scene, cam, orbit, U, disp, holder, studioEnv, GLOW, glowTex, holoMat, setVehicle, setMode, tunnel, get M() { return M; }, get S() { return S; }, get cur() { return cur; }, applyView: (o, v) => { const pv = view; view = v; applyView(o); view = pv; }, hooks, clearTags, TAGS, cmap };
})();
