/* LiftOff Aero Studio: test scenes for race car, aircraft, drone, boat, submarine. */
(() => {
"use strict";
const A = window.Aero, T = THREE, PI = Math.PI, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const { scene, cam, orbit, U, GLOW } = S3D;
const K = TESTKIT, { W } = K;

/* =================================================================== RACE CAR */
function carCtl(p, r) {
  const k = 4.6 / p.L, V = K.testVehicle("car", p, r, 4.6), pl = p.planet, TR = A.buildTrack();
  K.buildWorld(pl, k, { groundSize: 3000, noClouds: false, cloudSpan: 4000 });
  W.root.add(V.g);
  // track ribbon
  const N = TR.pts.length, wHalf = 7, pos = [], idx = [], kerb = [];
  for (let i = 0; i < N; i++) { const a = TR.pts[(i - 1 + N) % N], b = TR.pts[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, c = TR.pts[i];
    pos.push((c[0] + nx * wHalf) * k, 0.004, (c[1] + ny * wHalf) * k, (c[0] - nx * wHalf) * k, 0.004, (c[1] - ny * wHalf) * k); kerb.push([c, nx, ny]); }
  for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const tg = new T.BufferGeometry(); tg.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  const road = new T.Mesh(tg, new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.85, side: T.DoubleSide })); W.world.add(road);
  const kp = []; for (let i = 0; i < N; i += 1) { const [c, nx, ny] = kerb[i]; if (TR.kap[i] < 1 / 150) continue; for (const s of [1, -1]) kp.push((c[0] + s * nx * (wHalf + 0.6)) * k, 0.01, (c[1] + s * ny * (wHalf + 0.6)) * k); }
  const kg = new T.BufferGeometry(); kg.setAttribute("position", new T.Float32BufferAttribute(kp, 3)); W.world.add(new T.Points(kg, new T.PointsMaterial({ color: 0xff3b3b, size: 0.9 * k * 2, sizeAttenuation: true })));
  // start line + grandstand + cones
  const sl = new T.Mesh(new T.PlaneGeometry(2 * k, wHalf * 2 * k), new T.MeshBasicMaterial({ color: 0xffffff })); sl.rotation.x = -PI / 2; sl.position.set(TR.pts[0][0] * k, 0.006, TR.pts[0][1] * k); W.world.add(sl);
  const gs = new T.Mesh(new T.BoxGeometry(120 * k, 12 * k, 14 * k), MODELS.plain(0x5a6a7d)); gs.position.set(80 * k, 6 * k, -24 * k); W.world.add(gs);
  const lap = r.lap, aeroDF = v => 0.5 * r.aero.rho * v * v * r.aero.ClA;
  const smoke = K.puffSystem(500, 0xcfd3d8, false); W.world.add(smoke.pts);
  K.hudRows([{ k: "Speed", big: true }, { k: "Lateral grip" }, { k: "Downforce" }, { k: "Drag" }, { k: "Lap time" }, { k: "Aero balance" }]);
  orbit.goalDist = 11; orbit.dist = 14; orbit.el = 0.22;
  const ctl = { tEnd: r.lapT, t0: 0, countdown: true, countLabel: "Lights", goWord: "GO", camTarget: new T.Vector3(0, 0.8, 0), title: `Lap of the ${A.nf(r.trackLen / 1000, 2)} km HoloRing · ${A.PLANETS[pl].name}`, autoWarp: () => 1.5 };
  const wheels = []; V.root.traverse(o => { if (o.userData.wheel) wheels.push(o); });
  const mini = $("miniC"); let bestSpeed = 0;
  ctl.update = (t, dt) => {
    const s = K.sampleAt(lap, t, ["x", "y", "v", "lat", "s"]); const s2 = K.sampleAt(lap, Math.min(t + 0.25, r.lapT), ["x", "y"]);
    const hd = Math.atan2(s2.y - s.y, s2.x - s.x);
    W.world.position.set(-s.x * k, 0, -s.y * k); V.g.rotation.y = -hd; V.g.position.set(0, 0, 0);
    for (const w of wheels) w.children.forEach(c => c.rotation.z -= s.v * dt / 0.33 * (TEST.playing ? 1 : 0));
    // camera behind
    const back = new T.Vector3(-Math.cos(hd), 0, -Math.sin(hd)); orbit.az = lerp(orbit.az, Math.atan2(back.x, back.z) + 0.35, Math.min(1, dt * 2)) ;
    if (s.lat > 1.2 && TEST.playing && Math.random() < 0.4) smoke.emit(s.x * k, 0.2 * k, s.y * k, { vy: 0.2 * k, life: 2, s0: 0.5 * k, s1: 3 * k, a0: 0.25 });
    smoke.update(TEST.playing ? dt : 0);
    K.envUpdate(p.alt0, new T.Vector3(0, 1, 0), 0, 1, 4);
    const df = aeroDF(s.v), dr = 0.5 * r.aero.rho * s.v * s.v * r.aero.CdA;
    K.hudSet(0, A.nf(s.v * 3.6), "km/h"); K.hudSet(1, A.nf(s.lat, 2), "g"); K.hudSet(2, A.nf(df / 9.81), "kg"); K.hudSet(3, A.nf(dr), "N"); K.hudSet(4, `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`, ""); K.hudSet(5, A.nf(r.aero.balance * 100), "% front");
    drawTrack(mini, TR, lap, s, t, r);
  };
  ctl.clock = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  ctl.dispose = () => { W.root.remove(V.g); };
  return ctl;
}
function drawTrack(c, TR, lap, s, t, r) {
  const d = K.sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of TR.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const sc = Math.min((w * 0.5 - 20 * d) / (x1 - x0), (H - 30 * d) / (y1 - y0)), X = x => 12 * d + (x - x0) * sc, Y = y => 20 * d + (y - y0) * sc;
  g.lineWidth = 5 * d; g.strokeStyle = "rgba(88,225,255,.18)"; g.beginPath(); TR.pts.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.stroke();
  g.lineWidth = 2 * d; const vmax = r.vLapMax; for (let i = 1; i < lap.length; i++) { if (lap[i].t > t) break; const f = lap[i].v / vmax; g.strokeStyle = `hsl(${lerp(0, 190, f)},90%,60%)`; g.beginPath(); g.moveTo(X(lap[i - 1].x), Y(lap[i - 1].y)); g.lineTo(X(lap[i].x), Y(lap[i].y)); g.stroke(); }
  g.fillStyle = "#ff7a3d"; g.beginPath(); g.arc(X(s.x), Y(s.y), 4 * d, 0, 7); g.fill();
  // speed trace
  const bx = w * 0.52, bw = w * 0.45; g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText("SPEED TRACE", bx, 16 * d);
  g.strokeStyle = "#58e1ff"; g.lineWidth = 1.5 * d; g.beginPath(); lap.forEach((q, i) => { const xx = bx + q.t / r.lapT * bw, yy = H - 12 * d - q.v / vmax * (H - 40 * d); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke();
  g.fillStyle = "#ff7a3d"; g.fillRect(bx + t / r.lapT * bw - d, 22 * d, 2 * d, H - 34 * d);
}

/* =================================================================== AIRCRAFT */
function planeCtl(p, r) {
  const Lr = Math.max(p.fuseL, p.span * 0.75), k = 5.2 / Lr, V = K.testVehicle("plane", p, r, 5.2), pl = p.planet, S = r.samples.length ? r.samples : [{ t: 0, x: 0, h: 0, v: 0, pitch: 0, ph: "roll" }, { t: 3, x: 0, h: 0, v: 0, pitch: 0, ph: "roll" }];
  const glider = p.engine === "glider";
  K.buildWorld(pl, k, { groundSize: Math.max(60000, (S[S.length - 1].x + 20000) * 2), cloudSpan: Math.max(40000, S[S.length - 1].x * 1.5) });
  W.root.add(V.g);
  if (!glider) { const rw = new T.Mesh(new T.PlaneGeometry(Math.max(3000, (r.toDist || 500) * 2.2) * k, Math.max(30, p.span * 1.5) * k), new T.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.9 })); rw.rotation.x = -PI / 2; rw.position.set(1000 * k * 0.8, 0.01, 0); W.world.add(rw);
    const dash = []; for (let x = -100; x < 3000; x += 40) dash.push(x * k, 0.02, 0); const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.Float32BufferAttribute(dash, 3)); W.world.add(new T.Points(dg, new T.PointsMaterial({ color: 0xffffff, size: 6 * k, sizeAttenuation: true }))); }
  const trail = K.puffSystem(1500, 0xffffff, false); W.world.add(trail.pts);
  K.hudRows([{ k: "Airspeed", big: true }, { k: "Altitude" }, { k: "Climb rate" }, { k: "Mach" }, { k: "Phase" }, { k: "Air density" }, { k: "Outside air" }]);
  orbit.goalDist = 13; orbit.dist = 16; orbit.el = 0.18; orbit.az = 1.9;
  const tEnd = S[S.length - 1].t;
  const ctl = { tEnd, t0: 0, countdown: !glider, countLabel: "Takeoff in", goWord: glider ? "RELEASE" : "ROLL", camTarget: new T.Vector3(0, 0.6, 0), camAuto: 0.02, title: `${A.PLANETS[pl].name} · ${p.engine === "glider" ? "glider" : p.engine + " power"}`,
    autoWarp: t => { const s = K.sampleAt(S, t, ["h"]); return s.ph === "roll" || s.ph === "rotate" ? 1.2 : clamp(tEnd / 40, 1, 60); } };
  let lastPh = null;
  const mini = $("miniC"), maxH = Math.max(...S.map(s => s.h)) + p.alt0, maxX = S[S.length - 1].x || 1;
  ctl.update = (t, dt) => {
    const s = K.sampleAt(S, t, ["x", "h", "v", "pitch"]); const hAbs = s.h + (glider ? p.alt0 : p.alt0);
    W.world.position.set(-s.x * k, -s.h * k - (glider ? 0 : 0), 0);
    V.g.rotation.z = s.pitch; V.g.position.y = 0;
    for (const pr of V.props || []) pr.rotation.x += dt * 60;
    if (s.ph !== lastPh) { lastPh = s.ph; const L = { roll: "Takeoff roll", rotate: "Rotate · liftoff", climb: "Climbing", cruise: "Cruise", glide: "Gliding" }[s.ph]; if (L) K.feed(t, L); if (s.ph === "rotate") K.banner("LIFTOFF", `${A.nf(s.v * 3.6)} km/h`); if (s.ph === "cruise") K.banner("CRUISE", A.Dm(hAbs).join(" ")); }
    const Ah = A.atm(pl, hAbs);
    if (r.contrail && hAbs > 8000 && TEST.playing) for (const nz of (V.nozzles.length ? V.nozzles : [new T.Vector3(-p.fuseL / 2, 0, 0)])) { const wp = nz.clone().multiplyScalar(V.k); trail.emit(s.x * k + wp.x, s.h * k + wp.y + (r.P ? 0 : 0) + p.fuseD * 0.85 * k, wp.z, { life: 14, s0: p.fuseD * 0.3 * k, s1: p.fuseD * 3 * k, a0: 0.55 }); }
    trail.update(TEST.playing ? dt : 0);
    K.envUpdate(hAbs, new T.Vector3(-1, 0, 0), s.v, Ah.rho / 1.225, 7);
    const vs = K.sampleAt(S, Math.min(t + 1, tEnd), ["h"]).h - s.h;
    K.hudSet(0, A.nf(s.v * 3.6), "km/h"); K.hudSet(1, A.Dm(hAbs)[0], A.Dm(hAbs)[1]); K.hudSet(2, A.nf(vs, 1), "m/s"); K.hudSet(3, A.nf(s.v / Ah.a, 2), ""); K.hudSet(4, { roll: "Takeoff", rotate: "Liftoff", climb: "Climb", cruise: "Cruise", glide: "Glide" }[s.ph] || "", ""); K.hudSet(5, A.nf(Ah.rho / 1.225 * 100), "% of sea level"); K.hudSet(6, A.nf(Ah.T - 273.15), "°C");
    drawProfile(mini, S, t, maxX, maxH, "FLIGHT PROFILE · altitude vs distance", p.alt0);
  };
  ctl.dispose = () => W.root.remove(V.g);
  return ctl;
}
function drawProfile(c, S, t, maxX, maxH, title, h0, key = "h", depth) {
  const d = K.sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText(title, 10 * d, 16 * d);
  const px = x => 12 * d + x / maxX * (w - 24 * d), py = h => depth ? 26 * d + h / maxH * (H - 38 * d) : H - 12 * d - h / maxH * (H - 34 * d);
  g.strokeStyle = "#ff7a3d"; g.lineWidth = 2 * d; g.beginPath(); let st = false; for (const s of S) { if (s.t > t) break; const X = px(depth ? s.t : s.x), Y = py(s[key] + (h0 || 0)); st ? g.lineTo(X, Y) : g.moveTo(X, Y); st = true; } g.stroke();
}

/* =================================================================== DRONE */
function droneCtl(p, r) {
  const V = K.testVehicle("drone", p, r, 3.6), k = V.k, pl = p.planet, S = r.samples.length ? r.samples : [{ t: 0, x: 0, h: 0, v: 0, bat: 1, ph: "fail", pitch: 0 }, { t: 4, x: 0, h: 0, v: 0, bat: 1, ph: "fail", pitch: 0 }];
  K.buildWorld(pl, k, { groundSize: 1200, cloudSpan: 3000 });
  W.root.add(V.g);
  const pad = new T.Mesh(new T.CircleGeometry(r.D * 1.2 * k + 0.5, 40), new T.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.6 })); pad.rotation.x = -PI / 2; pad.position.y = 0.01; W.world.add(pad);
  const blocks = new T.Group(); for (let i = 0; i < 60; i++) { const h = 3 + Math.random() * 25, w = 4 + Math.random() * 10, b = new T.Mesh(new T.BoxGeometry(w * k, h * k, w * k), MODELS.plain(pl === "mars" ? 0x9a5a3a : 0x5a6878, { roughness: 0.9 })); b.position.set((Math.random() * 400 - 120) * k, h * k / 2, (Math.random() < 0.5 ? 1 : -1) * (15 + Math.random() * 120) * k); blocks.add(b); } W.world.add(blocks);
  const wash = K.puffSystem(600, pl === "mars" ? 0xc98a5a : 0xcfd6dd, false); W.world.add(wash.pts);
  K.hudRows([{ k: "Altitude", big: true }, { k: "Speed" }, { k: "Battery" }, { k: "Tilt" }, { k: "Hover power" }, { k: "Phase" }]);
  orbit.goalDist = 10; orbit.dist = 13; orbit.el = 0.25;
  const tEnd = S[S.length - 1].t;
  const ctl = { tEnd, t0: 0, countdown: true, countLabel: "Arming", goWord: r.canHover ? "TAKEOFF" : "NO LIFT", camTarget: new T.Vector3(0, 0.8, 0), camAuto: 0.05, title: `${A.PLANETS[pl].name} · ${p.rotors} rotors`, autoWarp: () => clamp(tEnd / 30, 1, 5) };
  let lastPh = null; const mini = $("miniC"), maxX = Math.max(...S.map(s => s.x), 1), maxH = Math.max(...S.map(s => s.h), 1);
  ctl.update = (t, dt) => {
    const s = K.sampleAt(S, t, ["x", "h", "v", "bat", "pitch"]);
    W.world.position.set(-s.x * k, -s.h * k, 0); V.g.rotation.z = s.pitch;
    for (const pr of V.props || []) pr.rotation.y += dt * (r.canHover ? 45 : 8) * (pr.userData.dir || 1);
    if (!r.canHover && t > 0.5) V.g.position.y = Math.sin(t * 20) * 0.01;
    if (s.ph !== lastPh) { lastPh = s.ph; K.feed(t, { climb: "Climb", hover: "Hover", sprint: "Full-speed sprint", brake: "Braking", return: "Return", land: "Landing", fail: "Can't generate enough lift" }[s.ph] || s.ph); if (s.ph === "sprint") K.banner(A.nf(r.vmax * 3.6), "km/h top speed"); }
    if (TEST.playing && s.h < 12 && r.canHover) for (let i = 0; i < 3; i++) { const a = Math.random() * 2 * PI; wash.emit(s.x * k, 0.02, 0, { vx: Math.cos(a) * 3 * k * 4, vy: 0.3 * k, vz: Math.sin(a) * 3 * k * 4, life: 1.5, s0: r.D * 0.5 * k, s1: r.D * 3 * k, a0: 0.3 * (1 - s.h / 12), drag: 1.5 }); }
    wash.update(TEST.playing ? dt : 0);
    K.envUpdate(p.alt0 + s.h, new T.Vector3(-1, 0, 0), Math.abs(s.v), 1, 3);
    K.hudSet(0, A.nf(s.h, 1), "m"); K.hudSet(1, A.nf(Math.abs(s.v) * 3.6), "km/h"); K.hudSet(2, A.nf(s.bat * 100), "%"); K.hudSet(3, A.nf(Math.abs(s.pitch) * 57.3), "°"); K.hudSet(4, A.nf(r.Ph), "W"); K.hudSet(5, s.ph, "");
    drawProfile(mini, S, t, maxX, maxH, "MISSION PROFILE", 0);
  };
  ctl.dispose = () => W.root.remove(V.g);
  return ctl;
}

/* =================================================================== BOAT */
function waterMesh(color, size) {
  const g = new T.PlaneGeometry(size, size, 160, 160); g.rotateX(-PI / 2);
  const m = new T.ShaderMaterial({ transparent: true, uniforms: { time: U.time, col: { value: new T.Color(color) }, off: { value: new T.Vector2() }, amp: { value: 0.3 }, wl: { value: 20 }, v: { value: 0 }, kel: { value: 0 }, k: { value: 1 }, sky: { value: new T.Color(0x9cc6ff) } },
    vertexShader: `uniform float time; uniform vec2 off; uniform float amp; uniform float wl; uniform float kel; uniform float k; varying float vH; varying vec3 vW; varying float vFoam;
      void main(){ vec3 p = position; vec2 w = (p.xz/k + off); float h = amp*(sin(w.x*0.09+time*0.9)*0.6 + sin(w.y*0.13+time*1.1)*0.4 + sin((w.x+w.y)*0.21+time*1.7)*0.25);
        float bx = -p.x/k; float bz = abs(p.z/k); float foam = 0.0;
        if (bx > 0.0) { float ang = atan(bz, bx); float edge = exp(-pow((ang-0.3398)*9.0,2.0)); float tr = step(ang,0.3398); float kk = 6.2831/wl; h += kel*(edge*0.8*sin(kk*length(vec2(bx,bz))-time*2.0) + tr*0.5*sin(kk*bx))*exp(-bx/(wl*8.0)); foam = edge*kel*exp(-bx/(wl*5.0)); }
        vH = h; vFoam = foam; p.y += h*k; vW = (modelMatrix*vec4(p,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform vec3 col; uniform vec3 sky; varying float vH; varying vec3 vW; varying float vFoam; void main(){ vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float f = pow(1.0-abs(n.y),2.0); vec3 c = mix(col, sky, 0.25+f*0.5) + vec3(1.0)*clamp(vFoam*1.2,0.0,0.8); gl_FragColor = vec4(c, 0.96); }` });
  m.extensions = { derivatives: true };
  return new T.Mesh(g, m);
}
function boatCtl(p, r) {
  const V = K.testVehicle("boat", p, r, 4.6), k = V.k, pl = p.planet;
  K.buildWorld(pl, k, { noGround: true, cloudSpan: 4000 });
  if (r.noLiquid) { K.hudRows([{ k: "Status" }]); K.hudSet(0, "No liquid", ""); return { tEnd: 2, t0: 0, autoWarp: () => 1, update() { }, camTarget: new T.Vector3() }; }
  const liqCol = r.liq.name.includes("methane") ? 0x3a2a14 : r.liq.name.includes("fresh") || r.liq.name.includes("Lake") ? 0x1d4a5e : 0x0d3a5c;
  const water = waterMesh(liqCol, 4000 * k * 1 + 60); water.material.uniforms.k.value = k; W.root.add(water);
  W.root.add(V.g); V.g.position.y = 0;
  const foam = K.puffSystem(1600, 0xffffff, false); W.root.add(foam.pts);
  const S = r.samples.length ? r.samples : [{ t: 0, x: 0, v: 0, Fn: 0, trim: 0, lift: 0, reg: r.sinks ? "Sinking" : "Capsized", R: 0 }, { t: 5, x: 0, v: 0, Fn: 0, trim: 0, lift: 0, reg: r.sinks ? "Sinking" : "Capsized", R: 0 }];
  K.hudRows([{ k: "Speed", big: true }, { k: "Froude number" }, { k: "Regime" }, { k: "Resistance" }, { k: "Trim" }, { k: "Wave length" }]);
  orbit.goalDist = 12; orbit.dist = 15; orbit.el = 0.3; orbit.az = 2.4;
  const tEnd = S[S.length - 1].t;
  const ctl = { tEnd, t0: 0, countdown: true, countLabel: "Throttle up", goWord: "FULL THROTTLE", camTarget: new T.Vector3(0, 0.5, 0), camAuto: 0.03, title: `${r.liq.name} · ${A.PLANETS[pl].name}`, autoWarp: () => clamp(tEnd / 35, 1, 6) };
  let lastReg = null, sinkT = 0; const mini = $("miniC");
  ctl.update = (t, dt) => {
    const s = K.sampleAt(S, t, ["x", "v", "Fn", "trim", "lift", "R"]);
    water.material.uniforms.off.value.set(s.x, 0); water.material.uniforms.v.value = s.v; water.material.uniforms.kel.value = clamp(s.Fn * 1.5, 0, 1.2) * (p.L * 0.02); water.material.uniforms.wl.value = Math.max(2 * PI * s.v * s.v / A.PLANETS[pl].g, 1); water.material.uniforms.amp.value = 0.15;
    const bob = Math.sin(U.time.value * 1.3) * 0.02 * p.L * k;
    V.g.rotation.z = s.trim + Math.sin(U.time.value * 0.9) * 0.01; V.g.position.y = bob + s.lift * p.D * 0.9 * k;
    if (r.capsizes || r.sinks) { sinkT = Math.min(1, t / 4); V.g.rotation.x = r.capsizes ? sinkT * PI * 0.9 : 0; V.g.position.y = -sinkT * p.D * (r.sinks ? 1.5 : 0.4) * k; }
    if (TEST.playing && s.v > 0.5) { const sp = Math.tan(19.47 * PI / 180) * s.v; for (const side of [1, -1]) foam.emit(-p.L * 0.45 * k, 0.02 * k, side * p.B * 0.45 * k, { vx: -s.v * k, vz: side * sp * k * 0.9, life: 4, s0: p.B * 0.2 * k, s1: p.B * 1.1 * k, a0: clamp(s.Fn, 0.1, 0.8) });
      if (s.Fn > 0.3) foam.emit(p.L * 0.4 * k, 0.05 * k, (Math.random() - 0.5) * p.B * 0.5 * k, { vx: -s.v * k * 0.8, vy: s.v * 0.08 * k, vz: (Math.random() - 0.5) * s.v * 0.4 * k, life: 1.2, s0: p.B * 0.1 * k, s1: p.B * 0.5 * k, a0: 0.6 }); }
    foam.update(TEST.playing ? dt : 0);
    if (s.reg !== lastReg) { lastReg = s.reg; K.feed(t, s.reg); if (s.reg === "Planing") K.banner("ON PLANE", "the hull climbed its own bow wave"); if (s.reg && s.reg.startsWith("Foiling")) K.banner("FOILING", "hull lifted out of the water"); if (r.capsizes) K.banner("CAPSIZED", "GM < 0"); if (r.sinks) K.banner("SINKING", "not enough freeboard"); }
    K.envUpdate(0, new T.Vector3(-1, 0, 0), s.v, 1, 4);
    K.hudSet(0, A.nf(s.v * 1.944, 1), "kn"); K.hudSet(1, A.nf(s.Fn, 2), ""); K.hudSet(2, s.reg || "", ""); K.hudSet(3, A.nf(s.R / 1000, 2), "kN"); K.hudSet(4, A.nf(s.trim * 57.3, 1), "°"); K.hudSet(5, A.nf(2 * PI * s.v * s.v / A.PLANETS[pl].g, 1), "m");
    drawRes(mini, r, s.v);
  };
  ctl.dispose = () => { W.root.remove(V.g, water, foam.pts); };
  return ctl;
}
function drawRes(c, r, v) {
  const d = K.sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText("RESISTANCE vs SPEED · friction + waves", 10 * d, 16 * d);
  const C = r.curve, vm = C[C.length - 1].v, Rm = Math.max(...C.map(q => q.R)), X = x => 12 * d + x / vm * (w - 24 * d), Y = y => H - 12 * d - y / Rm * (H - 36 * d);
  const line = (key, col) => { g.strokeStyle = col; g.lineWidth = 1.6 * d; g.beginPath(); C.forEach((q, i) => i ? g.lineTo(X(q.v), Y(q[key])) : g.moveTo(X(q.v), Y(q[key]))); g.stroke(); };
  line("Rf", "#53f2a6"); line("Rw", "#58e1ff"); line("R", "#ff7a3d");
  g.strokeStyle = "rgba(255,209,102,.6)"; g.setLineDash([3 * d, 3 * d]); g.beginPath(); g.moveTo(X(r.hullSpeed), 22 * d); g.lineTo(X(r.hullSpeed), H - 12 * d); g.stroke(); g.setLineDash([]); g.fillStyle = "#ffd166"; g.fillText("hull speed", X(r.hullSpeed) + 3 * d, 30 * d);
  g.fillStyle = "#fff"; g.beginPath(); g.arc(X(v), Y(C.reduce((a, q) => Math.abs(q.v - v) < Math.abs(a.v - v) ? q : a).R), 4 * d, 0, 7); g.fill();
  g.fillStyle = "#53f2a6"; g.fillText("friction", w - 150 * d, H - 18 * d); g.fillStyle = "#58e1ff"; g.fillText("waves", w - 100 * d, H - 18 * d); g.fillStyle = "#ff7a3d"; g.fillText("total", w - 60 * d, H - 18 * d);
}

/* =================================================================== SUBMARINE */
function subCtl(p, r) {
  const V = K.testVehicle("sub", p, r, 4.6), k = V.k, pl = p.planet;
  K.buildWorld(pl, k, { noGround: true, noClouds: true, noSky: true });
  if (r.noLiquid) { K.hudRows([{ k: "Status" }]); K.hudSet(0, "No ocean", ""); return { tEnd: 2, t0: 0, autoWarp: () => 1, update() { }, camTarget: new T.Vector3() }; }
  W.root.add(V.g);
  const S = r.samples.length ? r.samples : [{ t: 0, z: 0, vz: 0, p: 0, ph: "float" }, { t: 5, z: 0, vz: 0, p: 0, ph: "float" }];
  const methane = r.liq.name.includes("methane");
  const surf = new T.Mesh(new T.PlaneGeometry(3000 * k + 100, 3000 * k + 100), new T.MeshBasicMaterial({ color: methane ? 0x9a6a2a : 0x6fc3e8, transparent: true, opacity: 0.55, side: T.DoubleSide })); surf.rotation.x = -PI / 2; W.world.add(surf);
  const floorM = new T.Mesh(new T.PlaneGeometry(600 * k + 60, 600 * k + 60), new T.MeshStandardMaterial({ map: K.groundTex(pl), color: 0x6a6258, roughness: 1 })); floorM.rotation.x = -PI / 2; floorM.position.y = -r.liq.maxDepth * k - p.D * k; W.world.add(floorM);
  const snow = K.puffSystem(900, 0xdfefff, false); W.root.add(snow.pts);
  const bio = K.puffSystem(200, 0x4fffd0, true); W.root.add(bio.pts);
  const bub = K.puffSystem(400, 0xcfefff, false); W.root.add(bub.pts);
  const lamp = new T.PointLight(0xfff2cc, 2, 30 * p.D * k); lamp.position.set(p.L * 0.6 * k, 0, 0); V.g.add(lamp);
  K.hudRows([{ k: "Depth", big: true }, { k: "Pressure" }, { k: "Descent rate" }, { k: "Hull stress" }, { k: "Zone" }, { k: "Light" }]);
  orbit.goalDist = 11; orbit.dist = 14; orbit.el = 0.15; orbit.az = 1.2;
  const tEnd = S[S.length - 1].t + (r.imploded ? 3 : 0);
  const ctl = { tEnd, t0: 0, countdown: true, countLabel: "Flooding tanks", goWord: "DIVE", camTarget: new T.Vector3(0, 0, 0), camAuto: 0.04, title: `${r.liq.name}`, autoWarp: () => clamp(tEnd / 40, 1, 400) };
  let boom = false, lastZone = null; const mini = $("miniC"), maxZ = Math.max(...S.map(s => s.z), 10);
  const deep = new T.Color(methane ? 0x0a0602 : 0x00030a), shallow = new T.Color(methane ? 0x6a4a1a : 0x1b7fb3);
  ctl.update = (t, dt) => {
    const s = K.sampleAt(S, Math.min(t, S[S.length - 1].t), ["z", "vz", "p"]);
    W.world.position.set(0, s.z * k, 0);
    V.g.rotation.z = s.vz > 0.05 && p.shape !== "sphere" ? -0.14 : 0; for (const pr of V.props || []) pr.rotation.x += dt * 6;
    // water color by depth (light fades ~ e-folding 60 m)
    const light = Math.exp(-s.z / (methane ? 40 : 70)); const bg = deep.clone().lerp(shallow, light);
    scene.background = bg; scene.fog = new T.FogExp2(bg.getHex(), 0.06 / (p.D * k + 0.5));
    // particles: marine snow drifts past (sub descends -> snow rises)
    if (TEST.playing) { for (let i = 0; i < 3; i++) snow.emit((Math.random() - 0.5) * 12, -6, (Math.random() - 0.5) * 12, { vy: 0.6 + s.vz * 0.4, life: 12, s0: 0.03, s1: 0.05, a0: 0.5 * clamp(1 - light * 0.6, 0.2, 1) });
      if (s.z > 200 && Math.random() < 0.2) bio.emit((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14, { life: 2 + Math.random() * 2, s0: 0.05, s1: 0.15, a0: 0.9, c: [0.3, 1, 0.85] });
      if (s.z < 30 || Math.abs(s.vz) > 0.5) bub.emit((Math.random() - 0.5) * p.L * k * 0.5, 0, (Math.random() - 0.5) * p.D * k, { vy: 1.2, life: 3, s0: 0.05, s1: 0.12, a0: 0.5 }); }
    snow.update(TEST.playing ? dt : 0); bio.update(TEST.playing ? dt : 0); bub.update(TEST.playing ? dt : 0);
    const zone = A.zoneAt(s.z); if (zone !== lastZone) { lastZone = zone; K.feed(t, zone); if (t > 1) K.banner(zone.toUpperCase().replace(" ZONE", ""), `${A.nf(s.z)} m`); }
    if (r.imploded && t >= S[S.length - 1].t && !boom) { boom = true; V.g.visible = false; K.explosion(bub, 0, 0, 0, p.D * k * 1.5, 160); K.banner("IMPLOSION", `hull ${r.mode} at ${A.nf(r.crush)} m`); }
    if (t < S[S.length - 1].t && boom) { boom = false; V.g.visible = true; }
    const stress = s.p / (r.pYield < r.pBuck ? r.pYield : r.pBuck);
    K.hudSet(0, A.nf(s.z), "m"); K.hudSet(1, A.nf(s.p / 101325), "atm"); K.hudSet(2, A.nf(s.vz, 2), "m/s"); K.hudSet(3, A.nf(Math.min(stress * 100, 999)), "% of crush"); K.hudSet(4, zone, ""); K.hudSet(5, light > 0.01 ? A.nf(light * 100, 1) : "<0.01", "% of surface");
    const el = $("tv3"); if (el) el.style.color = stress > 1 ? "var(--bad)" : stress > 0.67 ? "var(--warn)" : "";
    drawProfile(mini, S, t, S[S.length - 1].t || 1, maxZ, "DIVE PROFILE · depth vs time", 0, "z", true);
    K.drawLadder && drawDepth($("ladC"), s.z, r);
  };
  ctl.dispose = () => { W.root.remove(V.g, snow.pts, bio.pts, bub.pts); };
  return ctl;
}
function drawDepth(c, z, r) {
  const d = K.sizeCanvas(c), g = c.getContext("2d"), w = c.width, H = c.height; g.clearRect(0, 0, w, H);
  const top = Math.max(r.liq.maxDepth, 1000), y = zz => 8 * d + Math.log10(1 + zz) / Math.log10(1 + top) * (H - 16 * d);
  const Z = [[0, 200, "Sunlight", "#1b7fb3"], [200, 1000, "Twilight", "#0f4a78"], [1000, 4000, "Midnight", "#07203a"], [4000, 6000, "Abyssal", "#04121f"], [6000, 11000, "Hadal", "#020810"]];
  for (const [a, b, n, col] of Z) { if (a > top) continue; g.fillStyle = col; g.fillRect(0, y(a), 16 * d, y(Math.min(b, top)) - y(a)); g.fillStyle = "#8aa3bf"; g.font = `${10 * d}px IBM Plex Sans, Arial`; g.fillText(n, 22 * d, (y(a) + y(Math.min(b, top))) / 2 + 3 * d); }
  for (const [m, n, col] of [[r.test, "Test depth", "#ffd166"], [r.crush, "Crush depth", "#ff5d6c"], [3800, "Titanic wreck", "#8aa3bf"], [10935, "Challenger Deep", "#8aa3bf"]]) { if (m > top) continue; g.strokeStyle = col; g.beginPath(); g.moveTo(0, y(m)); g.lineTo(w, y(m)); g.stroke(); g.fillStyle = col; g.fillText(n, 22 * d, y(m) - 3 * d); }
  const yy = y(z); g.fillStyle = "#ff7a3d"; g.beginPath(); g.moveTo(16 * d, yy); g.lineTo(26 * d, yy - 6 * d); g.lineTo(26 * d, yy + 6 * d); g.fill(); g.fillRect(0, yy - 1.5 * d, 16 * d, 3 * d);
}

Object.assign(K.CTL, { car: carCtl, plane: planeCtl, drone: droneCtl, boat: boatCtl, sub: subCtl });
})();
