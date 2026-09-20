/* LiftOff Aero Studio: test flights. Shared world (sky by altitude, planet curvature, clouds, smoke, HUD, playback). */
(() => {
"use strict";
const A = window.Aero, T = THREE, PI = Math.PI, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const { scene, cam, orbit, U, disp, studioEnv, GLOW, R3 } = S3D;

/* ---------- sky dome ---------- */
const skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
  uniforms: { zen: { value: new T.Color() }, hor: { value: new T.Color() }, glow: { value: new T.Color() }, sunDir: { value: new T.Vector3(0.4, 0.5, -0.6).normalize() }, dip: { value: 0 }, gnd: { value: new T.Color(0x3d5a3a) } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 glow; uniform vec3 sunDir; uniform float dip; uniform vec3 gnd; varying vec3 vD;
    void main(){ float e = vD.y + dip; float t = pow(clamp(e,0.0,1.0),0.45); vec3 c = mix(hor, zen, t); c = mix(c, mix(hor, gnd, 0.75), clamp(-e*6.0,0.0,1.0));
      float band = exp(-abs(e)*28.0); c += glow*band*0.9; float s = max(dot(normalize(vD), sunDir),0.0); c += vec3(1.0,0.92,0.75)*pow(s,900.0)*3.0 + vec3(1.0,0.85,0.6)*pow(s,12.0)*0.12;
      gl_FragColor = vec4(c,1.0); }` });
const sky = new T.Mesh(new T.SphereGeometry(4000, 32, 20), skyMat); sky.renderOrder = -10;
const starG = new T.BufferGeometry(); { const n = 2500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * 2 * PI, ph = Math.asin(Math.random() * 2 - 1); p.set([3800 * Math.cos(ph) * Math.cos(th), 3800 * Math.sin(ph), 3800 * Math.cos(ph) * Math.sin(th)], i * 3); } starG.setAttribute("position", new T.BufferAttribute(p, 3)); }
const stars = new T.Points(starG, new T.PointsMaterial({ color: 0xdfeaff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
const sunL = new T.DirectionalLight(0xfff4e0, 1.1), hemi = new T.HemisphereLight(0xcfe8ff, 0x3a3228, 0.45); sunL.position.set(0.5, 1, 0.3);

/* sky colors per world, by altitude (m) */
const SKY = {
  earth: [[0, 0x2f78d6, 0xbfdcff, 0xffffff], [8000, 0x1d56b8, 0x9cc6ff, 0xdbe9ff], [20000, 0x0b2a72, 0x6fa3ea, 0x8fb8ff], [45000, 0x030a24, 0x3d74c9, 0x5d97ff], [90000, 0x000105, 0x12244f, 0x3d7bff], [200000, 0x000000, 0x050a18, 0x2a66ff]],
  mars: [[0, 0xb98a5c, 0xe3b98a, 0xf0d2b0], [15000, 0x6d4c33, 0xc49a6c, 0xd8b58c], [40000, 0x120b08, 0x6e5038, 0x9a7050], [90000, 0, 0x100a06, 0x5a4030]],
  titan: [[0, 0x8a5a1c, 0xc98f3a, 0xd9a655], [60000, 0x5a3a12, 0xa77430, 0xc08840], [200000, 0x0a0602, 0x4a3010, 0x9a6a2a], [600000, 0, 0x0a0602, 0x7a5520]],
  venus: [[0, 0x9a7c3a, 0xd8c07a, 0xe8d49a], [50000, 0xc9b070, 0xf0e2b0, 0xffffff], [80000, 0x3a4a80, 0xbfb080, 0xe0d8b0], [150000, 0, 0x201a10, 0xa09060]],
  moon: [[0, 0, 0x020202, 0x000000]]
};
function skyAt(pl, h, out) {
  const L = SKY[pl] || SKY.earth; let i = 0; while (i < L.length - 1 && h > L[i + 1][0]) i++;
  const a = L[i], b = L[Math.min(i + 1, L.length - 1)], f = b === a ? 0 : sstep((h - a[0]) / (b[0] - a[0]));
  const c = (x, y) => new T.Color(x).lerp(new T.Color(y), f);
  out.zen = c(a[1], b[1]); out.hor = c(a[2], b[2]); out.glow = c(a[3], b[3]).multiplyScalar(h > 20000 ? clamp((h - 20000) / 60000, 0, 1) : 0);
  out.dark = pl === "moon" ? 1 : clamp((h - 25000) / 60000, 0, 1) * (pl === "venus" ? 0.3 : 1); return out;
}

/* ---------- procedural textures ---------- */
function noiseTex(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = fn(x / w, y / h); const i = (y * w + x) * 4; im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; }
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
function fbm(x, y, o = 5) { let a = 0, f = 1, s = 0.5; for (let i = 0; i < o; i++) { a += vnoise(x * f, y * f) * s; f *= 2; s *= 0.5; } return a; }
const PAL = { earth: [[34, 70, 140], [58, 104, 58], [150, 130, 90], [240, 240, 245]], mars: [[120, 55, 30], [170, 85, 45], [200, 130, 80], [230, 210, 200]], titan: [[40, 25, 10], [120, 80, 30], [150, 100, 45], [180, 130, 60]], venus: [[120, 90, 50], [170, 130, 70], [200, 170, 110], [230, 210, 160]], moon: [[70, 70, 72], [110, 110, 112], [150, 150, 152], [190, 190, 192]] };
const texCache = {};
function planetTex(pl) { if (texCache["p" + pl]) return texCache["p" + pl]; const P = PAL[pl] || PAL.earth;
  const t = noiseTex(512, 256, (u, v) => { const n = fbm(u * 8, v * 4, 6), lat = Math.abs(v - 0.5) * 2; let c;
    if (pl === "earth") { c = n < 0.52 ? P[0] : n < 0.6 ? P[1] : P[2]; if (lat > 0.85) c = P[3]; const cl = fbm(u * 14 + 3, v * 7, 5); if (cl > 0.58) c = c.map((x, i) => lerp(x, 245, clamp((cl - 0.58) * 5, 0, 0.9))); }
    else { const k = clamp(n * 1.3 - 0.15, 0, 0.999) * (P.length - 1), i = Math.floor(k), f = k - i; c = P[i].map((x, j) => lerp(x, P[Math.min(i + 1, P.length - 1)][j], f)); if (pl === "mars" && lat > 0.9) c = P[3]; }
    return c; }); return texCache["p" + pl] = t; }
function groundTex(pl, water) { const key = "g" + pl + (water || ""); if (texCache[key]) return texCache[key]; const P = PAL[pl] || PAL.earth;
  const t = noiseTex(256, 256, (u, v) => { const n = fbm(u * 6, v * 6, 5), g = (Math.abs(((u * 16) % 1) - 0.5) > 0.49 || Math.abs(((v * 16) % 1) - 0.5) > 0.49) ? 0.85 : 1;
    const c = water ? [20 + n * 20, 60 + n * 40, 100 + n * 50] : pl === "earth" ? [60 + n * 50, 90 + n * 50, 50 + n * 30] : (PAL[pl] || PAL.earth)[1].map(x => x * (0.7 + n * 0.6)); return c.map(x => x * g); });
  t.repeat.set(40, 40); return texCache[key] = t; }

/* ---------- smoke / puff particles (custom shader: per-particle size + alpha) ---------- */
function puffSystem(max, color, additive) {
  const g = new T.BufferGeometry(), pos = new Float32Array(max * 3), sz = new Float32Array(max), al = new Float32Array(max), col = new Float32Array(max * 3);
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("size", new T.BufferAttribute(sz, 1)); g.setAttribute("alpha", new T.BufferAttribute(al, 1)); g.setAttribute("color", new T.BufferAttribute(col, 3));
  const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, uniforms: { map: { value: S3D.glowTex(0.5) }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = min(size*scale/max(-mv.z,0.001), 900.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); }` });
  const pts = new T.Points(g, mat); pts.frustumCulled = false;
  const P = []; for (let i = 0; i < max; i++) P.push({ life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a0: 1, c: [1, 1, 1] });
  let next = 0; const base = new T.Color(color);
  return { pts, emit(x, y, z, o) { const p = P[next]; next = (next + 1) % max; Object.assign(p, { x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 3, s0: o.s0 || 1, s1: o.s1 || 3, a0: o.a0 == null ? 0.8 : o.a0, c: o.c || [base.r, base.g, base.b], drag: o.drag || 0 }); },
    update(dt) { for (let i = 0; i < max; i++) { const p = P[i]; if (p.age >= p.life) { al[i] = 0; continue; } p.age += dt; const f = p.age / p.life, d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; sz[i] = lerp(p.s0, p.s1, Math.sqrt(f)); al[i] = p.a0 * (1 - f) * Math.min(1, p.age * 8); col[i * 3] = p.c[0]; col[i * 3 + 1] = p.c[1]; col[i * 3 + 2] = p.c[2]; }
      g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = g.attributes.color.needsUpdate = true; },
    clear() { for (const p of P) p.age = p.life = 0; } };
}
/* plume shader */
function plumeMat(c1, c2) { return new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { time: U.time, c1: { value: new T.Color(c1) }, c2: { value: new T.Color(c2) }, k: { value: 1 } },
  vertexShader: `varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 c1; uniform vec3 c2; uniform float time; uniform float k; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ float along = vU.y; float edge = pow(abs(dot(vN,vV)),1.4); float flick = 0.85+0.15*sin(time*60.0+along*30.0);
    float diamonds = 0.75+0.25*sin(along*40.0*k); vec3 c = mix(c2, c1, pow(along,1.5)); gl_FragColor = vec4(c*flick*diamonds, edge*pow(along,0.7)*0.95); }` }); }

/* ---------- world ---------- */
const W = { root: new T.Group(), world: new T.Group(), k: 1 };
W.root.add(sky, stars, sunL, hemi, W.world);
let ground = null, planet = null, atmo = null, clouds = null, streaks = null;
function buildWorld(pl, k, opts = {}) {
  W.world.clear(); W.k = k; W.pl = pl; skyMat.uniforms.gnd.value.set({ earth: 0x42603c, mars: 0x8a4a2a, titan: 0x4a3212, venus: 0x7a5a30, moon: 0x555558 }[pl] || 0x42603c); sky.visible = stars.visible = !opts.noSky;
  const G = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ map: groundTex(pl, opts.water), roughness: 0.95, metalness: 0 }));
  G.rotation.x = -PI / 2; const gs = opts.groundSize || 60000; G.scale.set(gs * k, gs * k, 1); G.material.map.repeat.set(gs / 150, gs / 150); ground = G; if (!opts.noGround) W.world.add(G);
  const pg = new T.SphereGeometry(1, 96, 64); planet = new T.Mesh(pg, new T.MeshStandardMaterial({ map: planetTex(pl), roughness: 1, metalness: 0 })); planet.visible = false; W.root.add(planet);
  atmo = new T.Mesh(new T.SphereGeometry(1.025, 96, 64), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide, uniforms: { c: { value: new T.Color(pl === "mars" ? 0xd9a066 : pl === "titan" ? 0xd99a40 : pl === "venus" ? 0xf0e0a0 : 0x5aa0ff) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(vN,vV)),3.0); gl_FragColor = vec4(c, f*0.9); }` }));
  atmo.visible = false; if (pl !== "moon") W.root.add(atmo);
  // clouds
  clouds = new T.Group(); if (["earth", "titan", "venus"].includes(pl) && !opts.noClouds) {
    const tex = S3D.glowTex(0.25), mat = new T.SpriteMaterial({ map: tex, color: pl === "earth" ? 0xffffff : pl === "titan" ? 0xd9a35a : 0xf2e2b0, transparent: true, opacity: 0.32, depthWrite: false, fog: false });
    const span = opts.cloudSpan || 40000;
    for (let i = 0; i < 70; i++) { const x = (Math.random() - 0.3) * span, z = (Math.random() - 0.5) * span * 0.6, h = (pl === "venus" ? 48000 : pl === "titan" ? 20000 : 2200) + Math.random() * (pl === "earth" ? 6000 : 15000);
      for (let j = 0; j < 4; j++) { const s = new T.Sprite(mat); const sz = (250 + Math.random() * 450) * k; s.scale.set(sz * 2, sz, 1); s.position.set((x + (Math.random() - 0.5) * 800) * k, h * k, (z + (Math.random() - 0.5) * 800) * k); clouds.add(s); } }
    W.world.add(clouds); }
  // speed streaks (in vehicle frame; drawn around origin)
  const n = 300, g = new T.BufferGeometry(), pos = new Float32Array(n * 6); g.setAttribute("position", new T.BufferAttribute(pos, 3));
  streaks = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); streaks.frustumCulled = false; streaks.userData.P = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]); W.root.add(streaks);
}
const skyTmp = {};
function envUpdate(h, dirV, speed, rhoRel, extent) {
  const k = W.k; skyAt(W.pl, h, skyTmp);
  skyMat.uniforms.zen.value.copy(skyTmp.zen); skyMat.uniforms.hor.value.copy(skyTmp.hor); skyMat.uniforms.glow.value.copy(skyTmp.glow);
  sky.position.copy(cam.position); stars.position.copy(cam.position); stars.material.opacity = skyTmp.dark;
  scene.fog = null; hemi.intensity = lerp(0.45, 0.15, skyTmp.dark);
  // curvature
  const pl = A.PLANETS[W.pl], hh = Math.max(h, 1), dip = Math.acos(pl.R / (pl.R + hh)); skyMat.uniforms.dip.value = Math.sin(dip) * 0.9;
  const showPlanet = h > 9000, Rv = 1800;
  planet.visible = showPlanet; if (atmo) atmo.visible = showPlanet;
  if (showPlanet) { const d = Rv / Math.cos(dip) + 0.0001; planet.scale.setScalar(Rv); planet.position.set(cam.position.x, cam.position.y - d, cam.position.z); planet.rotation.y = W.spin || 0; if (atmo) { atmo.scale.setScalar(Rv); atmo.position.copy(planet.position); } }
  if (ground) { ground.visible = h < 30000; ground.material.opacity = 1; }
  // streaks
  if (streaks) { const P = streaks.userData.P, pos = streaks.geometry.attributes.position.array, ext = extent, vis = clamp(Math.log10(1 + speed) / 3, 0, 1) * clamp(rhoRel * 3, 0.15, 1);
    streaks.material.opacity = vis * 0.22 * clamp((speed - 30) / 120, 0, 1); const len = ext * clamp(speed / 600, 0.03, 0.45), mv = (speed / 40) * ext * 0.02;
    for (let i = 0; i < P.length; i++) { const p = P[i]; p[1] -= mv * 0.02 / ext * 60 * 0.016 * (1 + Math.random()); if (p[1] < 0) { p[1] += 1; p[0] = Math.random(); p[2] = Math.random(); }
      const x = (p[0] - 0.5) * ext * 2, y = (p[1] - 0.5) * ext * 2, z = (p[2] - 0.5) * ext * 2;
      pos[i * 6] = x - dirV.x * y; pos[i * 6 + 1] = z * 0 + (-dirV.y * y); pos[i * 6 + 2] = z; pos[i * 6 + 3] = pos[i * 6] - dirV.x * len; pos[i * 6 + 4] = pos[i * 6 + 1] - dirV.y * len; pos[i * 6 + 5] = z; }
    streaks.geometry.attributes.position.needsUpdate = true; }
}

function fadeClouds(hASL) { const c = W.world.children.find(o => o.isGroup && o.children[0] && o.children[0].isSprite); if (!c) return; const op = 0.32 * clamp(1 - (hASL - 12000) / 10000, 0, 1); c.visible = op > 0.01; c.children[0].material.opacity = op; }
/* ---------- HUD helpers ---------- */
function hudRows(rows) { $("tele").innerHTML = `<div id="clockL" class="cap" style="color:var(--accent2)"></div>` + rows.map((r, i) => `<div class="tl ${r.big ? "big" : ""}"><span class="cap">${r.k}</span><b id="tv${i}"></b></div>`).join(""); }
function hudSet(i, v, u) { const el = $("tv" + i); if (el) el.innerHTML = `${v}<small>${u || ""}</small>`; }
function feed(t, label) { window.LEARN && LEARN.narrate(label); const d = document.createElement("div"); d.className = "fe"; d.innerHTML = `<b>T+${A.nf(t, 1)}</b>${label}`; $("feed").appendChild(d); while ($("feed").children.length > 6) $("feed").firstChild.remove(); }
function banner(big, small, ms = 1600) { const b = $("banner"); $("bnB").textContent = big; $("bnS").textContent = small || ""; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
function sampleAt(S, t, keys) { // linear interpolation over samples by t
  let lo = 0, hi = S.length - 1; if (t <= S[0].t) return S[0]; if (t >= S[hi].t) return S[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t <= t) lo = m; else hi = m; }
  const a = S[lo], b = S[hi], f = (t - a.t) / Math.max(b.t - a.t, 1e-9), o = Object.assign({}, a); for (const k of keys) o[k] = a[k] + (b[k] - a[k]) * f; return o;
}
function sizeCanvas(c) { const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); } return d; }

/* ---------- playback core ---------- */
const TEST = { active: false, ctl: null, t: 0, tEnd: 1, playing: true, warp: "auto", cb: null, args: null, count: 0, done: false, endT: 0 };
const WARPS = ["auto", 1, 10, 100];
function buildWarp() { const w = $("warp"); w.innerHTML = ""; for (const k of WARPS) { const b = document.createElement("button"); b.textContent = k === "auto" ? "AUTO" : k + "×"; b.setAttribute("aria-pressed", TEST.warp === k); b.onclick = () => { TEST.warp = k; buildWarp(); }; w.appendChild(b); } }
$("pp").onclick = () => { TEST.playing = !TEST.playing; $("pp").textContent = TEST.playing ? "❚❚" : "▶"; };
$("scrub").oninput = () => { TEST.t = +$("scrub").value * TEST.tEnd; TEST.ctl.seek && TEST.ctl.seek(TEST.t); TEST.done = false; };
TEST.start = function (kind, p, r, rep, cb) {
  TEST.args = [kind, p, r, rep]; TEST.cb = cb; TEST.active = true; TEST.done = false; TEST.warp = "auto"; buildWarp();
  studioEnv.visible = false; disp.visible = false; S3D.lights.hemi.intensity = 0.15; S3D.lights.sun.intensity = 0.5; S3D.lights.rim.intensity = 0.1; S3D.clearTags(); $("tags").style.display = "none";
  scene.add(W.root); $("hud").classList.remove("hide"); $("feed").innerHTML = ""; $("report").classList.remove("on");
  TEST.ctl = CTL[kind](p, r, rep); $("ladder").style.display = kind === "rocket" || kind === "sub" ? "" : "none"; TEST.tEnd = TEST.ctl.tEnd; TEST.t = TEST.ctl.t0 || 0; TEST.count = TEST.ctl.countdown ? 3.2 : 0; TEST.playing = true; $("pp").textContent = "❚❚";
  orbit.enabled = true;
};
TEST.restart = () => { const [k, p, r, rep] = TEST.args; TEST.stop(); TEST.start(k, p, r, rep, TEST.cb); };
TEST.replay = () => { TEST.t = TEST.ctl.t0 || 0; TEST.done = false; TEST.count = 0; $("feed").innerHTML = ""; TEST.ctl.seek && TEST.ctl.seek(TEST.t); TEST.playing = true; };
TEST.stop = () => { if (!TEST.active) return; TEST.active = false; TEST.ctl && TEST.ctl.dispose && TEST.ctl.dispose(); W.world.clear(); scene.remove(W.root); if (planet) W.root.remove(planet); if (atmo) W.root.remove(atmo); if (streaks) W.root.remove(streaks);
  studioEnv.visible = true; disp.visible = true; S3D.lights.hemi.intensity = 0.75; S3D.lights.sun.intensity = 1.35; S3D.lights.rim.intensity = 0.7; scene.background = new T.Color(0x02050b); scene.fog = new T.FogExp2(0x02050b, 0.035); $("tags").style.display = ""; $("banner").classList.remove("pop"); };
TEST.frame = dt => {
  const c = TEST.ctl; if (!c) return;
  if (TEST.count > 0) { const before = Math.ceil(TEST.count); TEST.count -= dt; const after = Math.ceil(TEST.count); if (after !== before || before === 4) { if (after > 0) banner(String(after), c.countLabel || "T-minus"); else banner(c.goWord || "LIFTOFF", ""); } }
  else if (TEST.playing && !TEST.done) {
    const w = TEST.warp === "auto" ? c.autoWarp(TEST.t) : TEST.warp; TEST.t = Math.min(TEST.tEnd, TEST.t + dt * w);
    if (TEST.t >= TEST.tEnd) { TEST.done = true; TEST.endT = performance.now(); }
  }
  if (TEST.done && TEST.endT && performance.now() - TEST.endT > 1400) { TEST.endT = 0; TEST.cb && TEST.cb.onEnd(); }
  c.update(TEST.t, dt);
  $("scrub").value = TEST.t / TEST.tEnd; $("scrub").style.setProperty("--f", (TEST.t / TEST.tEnd * 100) + "%"); $("clock").textContent = c.clock ? c.clock(TEST.t) : `T+${A.nf(TEST.t, 1)} s`;
  if ($("clockL")) $("clockL").textContent = c.title || "";
  // camera orbit around a target the controller sets
  const tg = c.camTarget || new T.Vector3(); orbit.dist += (orbit.goalDist - orbit.dist) * Math.min(1, dt * 2); orbit.target.lerp(tg, Math.min(1, dt * 6));
  if (!orbit._drag && c.camAuto) orbit.az += dt * c.camAuto;
  cam.position.set(orbit.target.x + orbit.dist * Math.cos(orbit.el) * Math.sin(orbit.az), orbit.target.y + orbit.dist * Math.sin(orbit.el), orbit.target.z + orbit.dist * Math.cos(orbit.el) * Math.cos(orbit.az));
  cam.lookAt(orbit.target); cam.near = orbit.dist * 0.01; cam.far = 400000; cam.updateProjectionMatrix();
};

/* ---------- shared: build a real-material vehicle for testing ---------- */
function testVehicle(kind, p, r, target) {
  const M = MODELS.build(kind, p, r), g = new T.Group(); const k = target / M.L; g.add(M.root); M.root.scale.setScalar(k); M.k = k; M.g = g; return M;
}
function explosion(sys, x, y, z, size, n = 60) { for (let i = 0; i < n; i++) { const a = Math.random() * 2 * PI, b = Math.random() * PI - PI / 2, s = size * (0.5 + Math.random()); sys.emit(x, y, z, { vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s, vz: Math.sin(a) * Math.cos(b) * s, life: 1 + Math.random() * 1.5, s0: size * 0.3, s1: size * 1.6, a0: 0.9, c: [1, 0.55 + Math.random() * 0.3, 0.2], drag: 1.5 }); } }

/* =================================================================== ROCKET */
function rocketCtl(p, r) {
  const S = r.samples, L = r.g.L, k = 4.2 / L, pl = p.planet, V = testVehicle("rocket", p, r, 4.2), liquid = r.g.liquid;
  buildWorld(pl, k, { groundSize: Math.max(20000, r.apogee * 4 + 20000) });
  const rocketG = new T.Group(); rocketG.add(V.g); W.root.add(rocketG);
  // pad & tower
  const pad = new T.Group(), steel = MODELS.plain(0x8a929c, { metalness: 0.6 }), conc = MODELS.plain(0x9a9a96, { roughness: 1, metalness: 0 });
  const slab = new T.Mesh(new T.CylinderGeometry(L * 1.6 * k, L * 1.8 * k, L * 0.08 * k, 40), conc); slab.position.y = -L * 0.04 * k; pad.add(slab);
  const twr = new T.Mesh(new T.BoxGeometry(L * 0.12 * k, L * 1.15 * k, L * 0.12 * k), steel); twr.position.set(-(r.g.r + L * 0.12) * k, L * 0.575 * k, 0); pad.add(twr);
  const rail = new T.Mesh(new T.BoxGeometry(L * 0.015 * k, L * 1.1 * k, L * 0.015 * k), steel); rail.position.set(-(r.g.r * 1.1) * k, L * 0.55 * k, 0); pad.add(rail);
  const balloon = p.alt0 > 5000; if (balloon) { pad.visible = false; const bg = new T.Group(); const env = new T.Mesh(new T.SphereGeometry(L * 2.2 * k, 32, 24), new T.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.4, transparent: true, opacity: 0.92 })); env.scale.y = 1.25; env.position.y = L * 5 * k; bg.add(env); const teth = new T.Mesh(new T.CylinderGeometry(0.004 * L * k + 0.002, 0.004 * L * k + 0.002, L * 2.2 * k, 6), MODELS.plain(0xdddddd)); teth.position.y = L * 1.9 * k + L * 0.3 * k; bg.add(teth); bg.position.set(0, (p.alt0 - r.gl) * k, 0); W.world.add(bg); }
  W.world.add(pad);
  // plume
  const pc = r.g.liquid ? ({ kerolox: [0xffd08a, 0xff6a1a], methalox: [0xbfe2ff, 0x5a7dff], hydrolox: [0xffe6f2, 0x9ab8ff] })[A.ENGINES[p.eng].prop] : [0xfff0b0, 0xff7a1a];
  const plumes = [], pmat = plumeMat(pc[0], pc[1]);
  for (const nz of V.nozzles) { const g = new T.ConeGeometry(1, 1, 24, 1, true); g.translate(0, -0.5, 0); const m = new T.Mesh(g, pmat); m.position.copy(nz); m.rotation.z = -PI / 2; m.userData.nz = nz; V.root.add(m); plumes.push(m); }
  const smoke = puffSystem(1600, r.g.liquid ? 0xe8e4de : 0xdedad4, false); W.world.add(smoke.pts);
  const fire = puffSystem(300, 0xff9a40, true); W.root.add(fire.pts);
  // vapor cone & plasma
  const vap = new T.Mesh(new T.ConeGeometry(r.g.r * 3.2 * k, L * 0.35 * k, 32, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false })); vap.rotation.x = PI; W.root.add(vap);
  const plasma = new T.Sprite(new T.SpriteMaterial({ map: GLOW, color: 0xff8a50, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); W.root.add(plasma);
  // chute
  const chute = new T.Group(); { const cmat = new T.MeshStandardMaterial({ color: 0xff6a2a, side: T.DoubleSide, roughness: 0.8 }); const can = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, 2 * PI, 0, PI / 2.2), cmat); can.position.y = 1.6; chute.add(can);
    const lines = new T.BufferGeometry().setFromPoints(Array.from({ length: 12 }, (_, i) => [new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(i / 12 * 2 * PI) * 0.95, 1.25, Math.sin(i / 12 * 2 * PI) * 0.95)]).flat()); chute.add(new T.LineSegments(lines, new T.LineBasicMaterial({ color: 0xdddddd }))); }
  chute.visible = false; W.root.add(chute);
  const noseMat = V.root.getObjectByProperty ? null : null; const bodyMats = []; V.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive && ["nose", "body", "fin"].includes(o.userData.role)) { o.material = o.material.clone(); bodyMats.push(o.material); } });
  let sep = null, sepV = new T.Vector3(), sepSpin = 0, lastEv = -1, prev = { h: 0, x: 0 }, boom = false, dust = false;
  const ev = r.events.filter(e => e.k !== "liftoff"), evShown = new Set();
  const rows = [{ k: "Altitude", big: true }, { k: "Speed" }, { k: "Mach" }, { k: "Dynamic pressure" }, { k: "Acceleration" }, { k: "Mass" }, { k: "Throttle" }, { k: "Skin temp" }, { k: "Air" }];
  hudRows(rows);
  orbit.goalDist = 13; orbit.dist = 16; orbit.el = 0.12; orbit.az = 0.9;
  const ctl = { tEnd: S[S.length - 1].t + (r.orbit ? 8 : 0), countdown: true, t0: 0, camTarget: new T.Vector3(0, 2.1, 0), camAuto: 0.03, title: `${A.PLANETS[pl].name} · ${r.g.liquid ? "liquid" : p.motor + "-class motor"}`,
    autoWarp(t) { const tb = r.burnOut ? r.burnOut.t : 3; const W0 = clamp((this.tEnd - tb) / 30, 1, 400); return t < Math.min(tb, 4) ? 1 : t < tb ? lerp(1, Math.max(1, (tb) / 12), sstep((t - 4) / 8)) : lerp(Math.max(1, tb / 12), W0, sstep((t - tb) / 8)) * (sm && sm.chute ? 0.35 : 1); } };
  let sm = S[0];
  const ladder = $("ladC"), mini = $("miniC"), maxX = Math.max(...S.map(s => Math.abs(s.x))) || 1, maxH = Math.max(r.apogee, 10);
  ctl.update = (t, dt) => {
    sm = sampleAt(S, t, ["h", "x", "v", "M", "q", "g", "m", "T", "skin", "pitch", "thr", "rho"]);
    const gl = r.gl, h = Math.max(0, sm.h + p.alt0 - gl), x = sm.x; // height above the ground
    // world offset: rocket fixed near origin
    W.world.position.set(-x * k, -h * k, 0); W.spin = x / A.PLANETS[pl].R;
    rocketG.rotation.z = -sm.pitch; rocketG.position.set(0, 0, 0);
    V.g.rotation.z = PI / 2; // model +x -> up
    // stage separation
    const sepEv = r.events.find(e => e.k === "sep");
    if (sepEv && t >= sepEv.t && !sep) { const s1 = V.root.getObjectByName("stage1"); sep = s1; const wp = new T.Vector3(); s1.getWorldPosition(wp); W.root.attach(s1); sepV.set(0, -0.8, 0); sepSpin = 0.4; const e2 = V.root.getObjectByName("eng2"); if (e2) e2.visible = true; plumes.forEach(pp => pp.visible = false); }
    if (sepEv && t < sepEv.t && sep) { V.root.add(sep); sep.position.set(0, 0, 0); sep.rotation.set(0, 0, 0); sep = null; }
    if (sep) { sep.position.addScaledVector(sepV, dt * 1.2); sepV.y -= dt * 0.4; sep.rotation.z += sepSpin * dt; }
    // plume
    const pa = sm.rho / (A.atm(pl, 0).rho || 1), thr = sm.thr;
    const upperFire = sep && thr > 0;
    for (const m of plumes) { m.visible = thr > 0.02 && !sep; const len = L * (0.35 + thr * 0.9) * (1 + (1 - pa) * 2.5), wid = r.g.r * (0.35 + (1 - Math.sqrt(clamp(pa, 0, 1))) * 3.2) * (liquid ? 1 / Math.sqrt(p.nEng) + 0.3 : 0.8);
      m.scale.set(wid / V.k * k * 0 + wid, len, wid); }
    if (upperFire) { const e2 = V.root.getObjectByName("eng2"); if (e2 && !e2.userData.pl) { const g = new T.ConeGeometry(1, 1, 24, 1, true); g.translate(0, -0.5, 0); const m = new T.Mesh(g, plumeMat(0xd8e6ff, 0x7a9cff)); m.rotation.z = -PI / 2; m.position.set(-r.g.r * 1.4, 0, 0); e2.add(m); e2.userData.pl = m; } if (e2 && e2.userData.pl) { e2.userData.pl.visible = true; e2.userData.pl.scale.set(r.g.r * 3, L * 0.9, r.g.r * 3); } }
    pmat.uniforms.k.value = pa > 0.3 ? 1 : 0.3;
    // smoke (world coords)
    const up = new T.Vector3(Math.sin(sm.pitch), Math.cos(sm.pitch), 0);
    if (TEST.playing && thr > 0.02 && pa > 0.02 && !sep && dt > 0) { const n = Math.ceil(3 * clamp(pa, 0.2, 1)); for (let i = 0; i < n; i++) { const b = Math.random(); const wx = x * k - up.x * (L * 0.1 + b * L * 0.3) * k, wy = h * k - up.y * (L * 0.1 + b * L * 0.3) * k;
      smoke.emit(wx, wy, (Math.random() - 0.5) * r.g.r * k, { vx: (Math.random() - 0.5) * 0.3 + p.wind * 0.02, vy: (h < L * 2 ? 0.2 : 0), vz: (Math.random() - 0.5) * 0.3, life: 6 + Math.random() * 6, s0: r.g.d * 2 * k, s1: r.g.d * (h < L * 3 ? 22 : 12) * k / Math.sqrt(pa + 0.05) * 0.4, a0: 0.55 * clamp(pa * 2, 0.2, 1) }); }
      if (h < L * 2 && !balloon) for (let i = 0; i < 4; i++) { const a = Math.random() * 2 * PI; smoke.emit(x * k, 0.02, 0, { vx: Math.cos(a) * L * 0.6 * k, vy: 0.1 * L * k, vz: Math.sin(a) * L * 0.6 * k, life: 5, s0: L * 0.3 * k, s1: L * 1.5 * k, a0: 0.6, drag: 0.6 }); } }
    smoke.update(TEST.playing ? dt : 0); fire.update(TEST.playing ? dt : 0);
    // vapor cone
    const inTrans = sm.M > 0.93 && sm.M < 1.12 && h < 12000 && pl === "earth"; vap.material.opacity += ((inTrans ? 0.35 : 0) - vap.material.opacity) * Math.min(1, dt * 6); vap.position.set(up.x * L * 0.25 * k, up.y * L * 0.25 * k, 0); vap.rotation.z = -sm.pitch;
    // heating: glow on body + plasma sprite when hot
    const hot = clamp((sm.skin - 450) / 900, 0, 1); for (const m of bodyMats) m.emissive.setRGB(hot * 1.2, hot * 0.35, hot * 0.1);
    plasma.material.opacity = hot * 0.8 * (sm.rho > 1e-5 ? 1 : 0); plasma.scale.setScalar(r.g.d * 6 * k); plasma.position.set(up.x * L * 1.05 * k, up.y * L * 1.05 * k, 0);
    // chute
    chute.visible = sm.chute > 0 && !boom; if (chute.visible) { const cs = (sm.chute === 1 ? 0.35 : 1) * Math.min(L * 0.6, Math.max(L * 0.3, Math.sqrt(r.chuteA || 1) * 0.6)) * k; chute.scale.setScalar(cs); rocketG.rotation.z = PI / 2 + Math.sin(U.time.value * 1.3) * 0.06; chute.position.set(-L * 0.5 * k, L * 0.05 * k, 0); }
    // failure explosion
    if (r.failure && r.failure.k !== "pad") { const fe = r.events.find(e => e.k === "fail"); if (fe && t >= fe.t && !boom) { boom = true; explosion(fire, 0, L * 0.5 * k, 0, L * 0.4 * k, 90); for (let i = 0; i < 40; i++) smoke.emit(x * k, h * k + L * 0.5 * k, 0, { vx: (Math.random() - 0.5) * L * k, vy: (Math.random() - 0.5) * L * k, vz: (Math.random() - 0.5) * L * k, life: 6, s0: L * 0.3 * k, s1: L * 1.6 * k, a0: 0.8, drag: 1 }); V.g.visible = false; banner("FAILURE", r.failure.k === "heat" ? "burned up" : "structure buckled"); } if (fe && t < fe.t && boom) { boom = false; V.g.visible = true; } }
    if (r.landed && t >= S[S.length - 1].t - 0.05 && !dust) { dust = true; for (let i = 0; i < 30; i++) { const a = Math.random() * 2 * PI; smoke.emit(x * k, 0.02, 0, { vx: Math.cos(a) * L * 0.4 * k, vy: 0.05, vz: Math.sin(a) * L * 0.4 * k, life: 3, s0: L * 0.1 * k, s1: L * 0.6 * k, a0: 0.5, drag: 1 }); } }
    if (t < 0.1) dust = false;
    // events feed
    for (const e of ev) { if (t >= e.t && !evShown.has(e)) { evShown.add(e); feed(e.t, e.label); if (["karman", "orbit", "mach1", "apogee", "escape", "meco"].includes(e.k)) banner(e.k === "karman" ? "SPACE" : e.k === "orbit" ? "ORBIT" : e.k === "mach1" ? "MACH 1" : e.k === "apogee" ? A.Dm(r.apogee).join(" ") : e.k === "meco" ? "STAGING" : "ESCAPE", e.label); } if (t < e.t) evShown.delete(e); }
    // environment
    const vdir = new T.Vector3(Math.sin(sm.pitch), Math.cos(sm.pitch), 0);
    fadeClouds(h + gl);
    envUpdate(h + gl, vdir, sm.v, sm.rho / (A.atm(pl, 0).rho || 1), 6);
    // camera: pull out with altitude
    ctl.camTarget.set(up.x * 2.1, up.y * 2.1, 0); orbit.goalDist = h < L * 3 ? 11 : lerp(12, 22, clamp(t / 60, 0, 1));
    // HUD
    const ht = h + gl; hudSet(0, A.Dm(ht)[0], A.Dm(ht)[1]); hudSet(1, A.nf(sm.v * 3.6), "km/h"); hudSet(2, A.nf(sm.M, 2), ""); hudSet(3, A.nf(sm.q / 1000, 1), "kPa");
    hudSet(4, A.nf(sm.g, 1), "g"); hudSet(5, A.Mk(sm.m).join(" "), ""); hudSet(6, A.nf(thr * 100), "%"); hudSet(7, A.nf(sm.skin - 273.15), "°C"); hudSet(8, sm.rho > 0 ? A.nf(sm.rho / (A.atm(pl, 0).rho || 1) * 100, sm.rho / (A.atm(pl, 0).rho || 1) < 0.01 ? 4 : 1) : "0", "% of ground");
    drawLadder(ladder, h + gl, pl); drawTraj(mini, S, t, maxX, maxH, r);
  };
  ctl.seek = t => { smoke.clear(); fire.clear(); boom = false; V.g.visible = true; };
  ctl.clock = t => (TEST.count > 0 ? `T−${A.nf(TEST.count, 1)}` : `T+${A.nf(t, 1)} s`);
  ctl.dispose = () => { W.root.remove(rocketG, fire.pts, vap, plasma, chute); if (sep) W.root.remove(sep); };
  return ctl;
}
function drawLadder(c, h, pl) {
  const d = sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  const top = 1e6, y = hh => H - 8 * d - Math.log10(1 + hh / 100) / Math.log10(1 + top / 100) * (H - 16 * d);
  const bands = pl === "earth" ? [[0, 12e3, "Troposphere", "#2f78d6"], [12e3, 50e3, "Stratosphere", "#1d4f9a"], [50e3, 85e3, "Mesosphere", "#162e66"], [85e3, 600e3, "Thermosphere", "#0c1636"], [600e3, 1e6, "Exosphere", "#050914"]] : [[0, 100e3, "Atmosphere", "#6a4a30"], [100e3, 1e6, "Space", "#0a0806"]];
  for (const [a, b, n, col] of bands) { g.fillStyle = col; g.globalAlpha = 0.5; g.fillRect(0, y(b), 16 * d, y(a) - y(b)); g.globalAlpha = 1; g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText(n, 22 * d, (y(a) + y(b)) / 2 + 3 * d); }
  const marks = [[100e3, "Kármán line 100 km"], [408e3, "ISS 408 km"], [8849, "Everest"], [11000, "Airliners"]];
  g.strokeStyle = "rgba(88,225,255,.5)"; for (const [m, n] of marks) { g.beginPath(); g.moveTo(0, y(m)); g.lineTo(w, y(m)); g.stroke(); g.fillStyle = "#c7d8ea"; g.fillText(n, 22 * d, y(m) - 3 * d); }
  const yy = y(Math.max(0, h)); g.fillStyle = "#ff7a3d"; g.beginPath(); g.moveTo(16 * d, yy); g.lineTo(26 * d, yy - 6 * d); g.lineTo(26 * d, yy + 6 * d); g.fill(); g.fillRect(0, yy - 1.5 * d, 16 * d, 3 * d);
}
function drawTraj(c, S, t, maxX, maxH, r) {
  const d = sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText("TRAJECTORY · altitude vs downrange", 10 * d, 16 * d);
  if (r.orbit && !r.orbit.escape && t >= S[S.length - 1].t) { // orbit inset
    const pl = r.planet, a = r.orbit.a, e = r.orbit.e, sc = (H * 0.38) / (a * (1 + e)), cx = w / 2, cy = H / 2 + 8 * d;
    g.fillStyle = "#1d56b8"; g.beginPath(); g.arc(cx, cy, pl.R * sc, 0, 7); g.fill(); g.strokeStyle = "#ff7a3d"; g.lineWidth = 2 * d; g.beginPath(); g.ellipse(cx - a * e * sc, cy, a * sc, a * Math.sqrt(1 - e * e) * sc, 0, 0, 7); g.stroke();
    g.fillStyle = "#e8f3ff"; g.fillText(`${A.nf(r.orbit.peri / 1000)} × ${A.nf(r.orbit.apo / 1000)} km orbit`, 10 * d, H - 10 * d); return; }
  const px = x => 12 * d + (Math.abs(x) / maxX) * (w - 24 * d) * (maxX < maxH * 0.05 ? 0.2 : 1), py = h => H - 12 * d - h / maxH * (H - 34 * d);
  g.strokeStyle = "rgba(88,225,255,.15)"; g.beginPath(); g.moveTo(12 * d, py(0)); g.lineTo(w - 12 * d, py(0)); g.stroke();
  if (maxH > 100e3) { g.setLineDash([4 * d, 4 * d]); g.strokeStyle = "rgba(255,209,102,.6)"; g.beginPath(); g.moveTo(12 * d, py(100e3)); g.lineTo(w - 12 * d, py(100e3)); g.stroke(); g.setLineDash([]); g.fillStyle = "#ffd166"; g.fillText("100 km", w - 60 * d, py(100e3) - 3 * d); }
  g.strokeStyle = "#ff7a3d"; g.lineWidth = 2 * d; g.beginPath(); let started = false; for (const s of S) { if (s.t > t) break; const X = px(s.x), Y = py(Math.max(0, s.h)); started ? g.lineTo(X, Y) : g.moveTo(X, Y); started = true; } g.stroke();
  g.fillStyle = "#e8f3ff"; g.fillText(`apogee ${A.Dm(r.apogee).join(" ")}`, 10 * d, 30 * d);
}

const CTL = { rocket: rocketCtl };
window.TEST = TEST; window.TESTKIT = { CTL, W, buildWorld, envUpdate, puffSystem, plumeMat, hudRows, hudSet, feed, banner, sampleAt, sizeCanvas, testVehicle, explosion, skyAt, groundTex, drawLadder };
})();
