/* LiftOff Aero Studio: course builder. Build a race track, a boat course, a drone delivery map, an air route
   over mountains, a seafloor with canyons and trenches, or a launch-day airspace, then run your design through it.
   Every course runs on the same physics engine as the rest of the studio. */
(() => {
"use strict";
const A = window.Aero, $ = id => document.getElementById(id), S = window.STUDIO, API = () => window.STUDIO_API;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, PI = Math.PI;
const nf = A.nf, clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const km = m => m / 1000, hyp = Math.hypot;
const toast = (m, ms) => window.toast && window.toast(m, ms);
const fmtT = s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round(s % 3600 / 60)} min` : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${nf(s, 1)} s`;
const Dm = m => A.Dm(m).join(" ");

/* =================================================================== TYPES (per vehicle) */
const HOLO_PTS = [[0, 0], [620, 0], [820, 50], [880, 210], [780, 340], [580, 320], [450, 420], [470, 580], [320, 650], [120, 590], [60, 440], [190, 320], [130, 190], [-60, 150], [-150, 60]];
const K = {
  car: { title: "Race track", view: "top", hint: "Drag the white dots to reshape the track. Pick a tool, then click to add it.",
    tools: [["move", "Move"], ["bend", "Add a bend"], ["wet", "Wet patch"], ["oil", "Oil slick"], ["bank", "Banked turn"], ["wind", "Headwind"]],
    items: {
      wet: { l: "Wet patch", r: 70, props: [["r", "Size", 20, 200, 5, "m"], ["mu", "Grip left", 0.4, 0.95, 0.05, "×"]], def: { mu: 0.7 } },
      oil: { l: "Oil slick", r: 40, props: [["r", "Size", 15, 150, 5, "m"], ["mu", "Grip left", 0.2, 0.7, 0.05, "×"]], def: { mu: 0.4 } },
      bank: { l: "Banked turn", r: 110, props: [["r", "Size", 40, 250, 5, "m"], ["bank", "Bank angle", 5, 35, 1, "°"]], def: { bank: 24 } },
      wind: { l: "Headwind", r: 120, props: [["r", "Size", 40, 300, 5, "m"], ["speed", "Wind", 2, 30, 1, "m/s"], ["dir", "Blowing toward", 0, 355, 5, "°"]], def: { speed: 12, dir: 180 } }
    },
    templates: [
      ["HoloRing", () => ({ pts: clone(HOLO_PTS), items: [] })],
      ["Oval speedway", () => ({ pts: [[0, 0], [700, 0], [950, 150], [950, 350], [700, 500], [0, 500], [-250, 350], [-250, 150]], items: [{ t: "bank", x: 900, y: 250, r: 190, bank: 24 }, { t: "bank", x: -200, y: 250, r: 190, bank: 24 }] })],
      ["Street circuit", () => ({ pts: [[0, 0], [400, 0], [420, 120], [300, 140], [300, 260], [520, 260], [540, 420], [120, 430], [100, 300], [-80, 280], [-100, 80]], items: [] })],
      ["Rain race", () => ({ pts: clone(HOLO_PTS), items: [{ t: "wet", x: 700, y: 20, r: 110, mu: 0.65 }, { t: "wet", x: 460, y: 500, r: 120, mu: 0.6 }, { t: "oil", x: 130, y: 250, r: 45, mu: 0.4 }] })]
    ] },
  boat: { title: "Boat course", view: "top", hint: "Drag the buoys to shape the course. The boat starts at S, rounds each buoy in order and comes back.",
    tools: [["move", "Move"], ["mark", "Add a buoy"], ["rough", "Rough water"], ["current", "Current"], ["shallow", "Shallows"], ["rocks", "Rocks"]],
    items: {
      rough: { l: "Rough water", r: 250, props: [["r", "Size", 50, 800, 10, "m"], ["h", "Wave height", 0.2, 6, 0.1, "m"]], def: { h: 1.5 } },
      current: { l: "Current", r: 220, props: [["r", "Size", 50, 800, 10, "m"], ["speed", "Current", 0.2, 6, 0.1, "m/s"], ["dir", "Flowing toward", 0, 355, 5, "°"]], def: { speed: 1.5, dir: 180 } },
      shallow: { l: "Shallows", r: 160, props: [["r", "Size", 30, 600, 10, "m"], ["depth", "Water depth", 0.3, 20, 0.1, "m"]], def: { depth: 1.2 } },
      rocks: { l: "Rocks", r: 40, props: [["r", "Size", 10, 200, 5, "m"]], def: {} }
    },
    templates: [
      ["Harbor sprint", () => ({ start: [0, 0], marks: [[1400, 200], [1600, 900], [300, 1000]], items: [] })],
      ["Rough crossing", () => ({ start: [0, 0], marks: [[2600, 300], [2600, 1400]], items: [{ t: "rough", x: 1400, y: 600, r: 700, h: 2 }] })],
      ["Reef run", () => ({ start: [0, 0], marks: [[900, -300], [1800, 200], [900, 700]], items: [{ t: "shallow", x: 1300, y: 150, r: 220, depth: 1.2 }, { t: "rocks", x: 350, y: 540, r: 60 }] })],
      ["River upstream", () => ({ start: [0, 0], marks: [[3000, 0]], items: [{ t: "current", x: 1500, y: 0, r: 1200, speed: 2.5, dir: 180 }] })]
    ] },
  drone: { title: "Delivery map", view: "top", hint: "Drag the home pad (H) and the numbered drop points. Add buildings, no-fly zones and wind.",
    tools: [["move", "Move"], ["stop", "Add a drop point"], ["building", "Building"], ["nofly", "No-fly zone"], ["wind", "Wind"]],
    items: {
      building: { l: "Building", r: 20, props: [["r", "Size", 5, 80, 1, "m"], ["h", "Height", 5, 400, 5, "m"]], def: { h: 60 } },
      nofly: { l: "No-fly zone", r: 150, props: [["r", "Size", 30, 800, 10, "m"]], def: {} },
      wind: { l: "Wind", r: 200, props: [["r", "Size", 40, 900, 10, "m"], ["speed", "Wind", 1, 30, 0.5, "m/s"], ["dir", "Blowing toward", 0, 355, 5, "°"]], def: { speed: 8, dir: 180 } }
    },
    templates: [
      ["City delivery", () => ({ home: [0, 0], stops: [[700, 250], [1100, -300]], items: [{ t: "building", x: 350, y: 120, r: 30, h: 120 }, { t: "building", x: 900, y: 0, r: 25, h: 80 }, { t: "building", x: 500, y: -200, r: 35, h: 200 }] })],
      ["Windy coast", () => ({ home: [0, 0], stops: [[1600, 0]], items: [{ t: "wind", x: 800, y: 0, r: 600, speed: 10, dir: 180 }] })],
      ["Airport nearby", () => ({ home: [0, 0], stops: [[1200, 0], [1200, 700]], items: [{ t: "nofly", x: 600, y: 60, r: 220 }] })],
      ["Search grid", () => ({ home: [0, 0], stops: [[400, 0], [400, 400], [800, 400], [800, 0], [1200, 0], [1200, 400]], items: [] })]
    ] },
  plane: { title: "Flight route", view: "side", hint: "Side view of the route. Drag a mountain's peak or a storm to move it. Click an airport to change its runway.",
    tools: [["move", "Move"], ["mountain", "Mountain"], ["storm", "Storm cell"], ["wind", "Wind layer"], ["thermal", "Thermal (gliders)"]],
    items: {
      mountain: { l: "Mountain", props: [["h", "Peak height", 200, 8800, 50, "m"], ["w", "Width", 5, 200, 1, "km"]], def: { h: 3500, w: 40 } },
      storm: { l: "Storm cell", props: [["base", "Cloud base", 300, 6000, 50, "m"], ["top", "Cloud top", 2000, 16000, 100, "m"], ["w", "Width", 5, 150, 1, "km"]], def: { base: 1200, top: 11000, w: 40 } },
      wind: { l: "Wind layer", props: [["base", "Bottom", 0, 14000, 100, "m"], ["top", "Top", 500, 16000, 100, "m"], ["speed", "Headwind (− = tailwind)", -80, 80, 1, "m/s"]], def: { base: 8000, top: 12000, speed: 40 } },
      thermal: { l: "Thermal", props: [["strength", "Lift", 0.5, 5, 0.1, "m/s"]], def: { strength: 2.5 } }
    },
    templates: [
      ["Alps crossing", () => ({ dist: 420, dep: { elev: 400, rw: 2500 }, arr: { elev: 200, rw: 2500 }, items: [{ t: "mountain", x: 150, h: 4800, w: 45 }, { t: "mountain", x: 230, h: 4200, w: 60 }] })],
      ["Hot and high", () => ({ dist: 160, dep: { elev: 1650, rw: 1200 }, arr: { elev: 2400, rw: 1000 }, items: [{ t: "mountain", x: 80, h: 4300, w: 30 }] })],
      ["Jet stream crossing", () => ({ dist: 5500, dep: { elev: 10, rw: 3500 }, arr: { elev: 20, rw: 3500 }, items: [{ t: "wind", x: 0, base: 9000, top: 12500, speed: 55 }] })],
      ["Storm line", () => ({ dist: 600, dep: { elev: 100, rw: 2500 }, arr: { elev: 100, rw: 2500 }, items: [{ t: "storm", x: 300, base: 900, top: 12500, w: 60 }] })],
      ["Glider ridge run", () => ({ dist: 120, dep: { elev: 300, rw: 800 }, arr: { elev: 300, rw: 800 }, items: [{ t: "thermal", x: 30, strength: 3 }, { t: "thermal", x: 70, strength: 2.5 }, { t: "mountain", x: 95, h: 1300, w: 20 }] })]
    ] },
  sub: { title: "Seafloor", view: "side", hint: "Side view of the ocean. Add canyons and trenches, drag their bottom to set the depth. The sub follows the seafloor down to its target depth.",
    tools: [["move", "Move"], ["canyon", "Canyon / trench"], ["seamount", "Seamount"], ["wreck", "Shipwreck"], ["vent", "Hot vent"], ["current", "Current"]],
    items: {
      canyon: { l: "Canyon", props: [["depth", "Bottom depth", 200, 11000, 50, "m"], ["w", "Width", 1, 80, 0.5, "km"]], def: { depth: 3000, w: 8 } },
      seamount: { l: "Seamount", props: [["top", "Summit depth", 20, 10000, 10, "m"], ["w", "Width", 1, 80, 0.5, "km"]], def: { top: 800, w: 10 } },
      wreck: { l: "Shipwreck", props: [], def: {} },
      vent: { l: "Hot vent", props: [], def: {} },
      current: { l: "Current", props: [["base", "Top of layer", 0, 9000, 50, "m"], ["top", "Bottom of layer", 50, 11000, 50, "m"], ["speed", "Against you", -3, 3, 0.1, "m/s"]], def: { base: 0, top: 400, speed: 1 } }
    },
    templates: [
      ["Mariana Trench", () => ({ dist: 80, shelf: 6000, clear: 40, items: [{ t: "canyon", x: 40, depth: 10935, w: 26 }, { t: "canyon", x: 24, depth: 8200, w: 6 }, { t: "canyon", x: 58, depth: 8800, w: 7 }] })],
      ["Titanic wreck", () => ({ dist: 30, shelf: 3800, clear: 30, items: [{ t: "wreck", x: 20 }, { t: "seamount", x: 9, top: 2600, w: 6 }] })],
      ["Shelf and canyon", () => ({ dist: 60, shelf: 150, clear: 20, items: [{ t: "canyon", x: 22, depth: 2000, w: 10 }, { t: "canyon", x: 45, depth: 3600, w: 14 }, { t: "current", x: 0, base: 0, top: 300, speed: 1 }] })],
      ["Vent field", () => ({ dist: 40, shelf: 3000, clear: 25, items: [{ t: "seamount", x: 20, top: 2200, w: 14 }, { t: "vent", x: 18 }, { t: "vent", x: 22 }] })]
    ] },
  rocket: { title: "Launch-day airspace", view: "side", hint: "Side view of the sky over the launch pad. Add wind layers, storms, an altitude limit, a hoop to fly through, and things to avoid landing in.",
    tools: [["move", "Move"], ["wind", "Wind layer"], ["storm", "Storm cloud"], ["ceiling", "Altitude limit"], ["hoop", "Hoop"], ["lake", "Lake"], ["town", "Town"]],
    items: {
      wind: { l: "Wind layer", props: [["base", "Bottom", 0, 60000, 50, "m"], ["top", "Top", 50, 80000, 50, "m"], ["speed", "Wind (→ +)", -40, 40, 0.5, "m/s"]], def: { speed: 8 } },
      storm: { l: "Storm cloud", props: [["base", "Cloud base", 100, 5000, 50, "m"], ["top", "Cloud top", 1000, 16000, 100, "m"], ["w", "Width", 0.5, 40, 0.5, "km"]], def: { base: 1200, top: 9000, w: 6 } },
      ceiling: { l: "Altitude limit", props: [["h", "Limit", 50, 200000, 50, "m"]], def: {} },
      hoop: { l: "Hoop", props: [["h", "Height", 20, 200000, 10, "m"], ["r", "Radius", 5, 5000, 5, "m"]], def: {} },
      lake: { l: "Lake", props: [["w", "Width", 0.05, 20, 0.05, "km"]], def: { w: 0.8 } },
      town: { l: "Town", props: [["w", "Width", 0.05, 20, 0.05, "km"]], def: { w: 0.6 } }
    },
    templates: [
      ["Hoop challenge", r => { const s = r.samples.find(q => q.h >= r.apogee * 0.75) || r.samples[0]; return { items: [{ t: "hoop", x: +(s.x / 1000).toFixed(3), h: Math.round(s.h), r: Math.max(10, Math.round(r.apogee * 0.06)) }] }; }],
      ["Windy day by the lake", r => { const H = Math.max(200, r.apogee); return { items: [{ t: "wind", x: 0, base: 0, top: Math.round(H * 1.1), speed: 7 }, { t: "lake", x: Math.max(0.1, km(H) * 0.35), w: Math.max(0.2, km(H) * 0.6) }] }; }],
      ["Altitude limit", r => ({ items: [{ t: "ceiling", x: 0, h: Math.round(r.apogee * 0.8 / 10) * 10 || 100 }] })],
      ["Storm overhead", r => { const H = Math.max(300, r.apogee); return { items: [{ t: "storm", x: 0, base: Math.round(H * 0.4), top: Math.round(H * 1.6), w: Math.max(1, km(H) * 1.2) }] }; }]
    ] }
};

/* =================================================================== TERRAIN / FIELDS */
const bump = (x, xc, w, sharp) => { const u = (x - xc) / (w / 2); return Math.exp(-Math.pow(Math.abs(u), sharp || 2) * (sharp ? 1 : 1.4)); };
function planeGround(D, x) { let g = 0; if (x < 6) g = Math.max(g, D.dep.elev * (x < 3 ? 1 : bump(x, 3, 6))); if (x > D.dist - 6) g = Math.max(g, D.arr.elev * (x > D.dist - 3 ? 1 : bump(x, D.dist - 3, 6)));
  for (const it of D.items) if (it.t === "mountain") g = Math.max(g, it.h * bump(x, it.x, it.w)); return g; }
function seafloor(D, x) { let f = D.shelf + Math.min(60, D.shelf * 0.1) * Math.sin(x * 0.9) * Math.sin(x * 0.37);
  for (const it of D.items) if (it.t === "canyon") f = Math.max(f, lerp(f, it.depth, bump(x, it.x, it.w, 4)));
  for (const it of D.items) if (it.t === "seamount") f = Math.min(f, lerp(f, it.top, bump(x, it.x, it.w)));
  return f; }
function catmull(P, per = 24) { const n = P.length, out = []; for (let i = 0; i < n; i++) { const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
  for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t; out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } } return out; }
const inside = (it, x, y) => hyp(x - it.x, y - it.y) <= it.r;
const dirV = deg => [Math.cos(deg * PI / 180), Math.sin(deg * PI / 180)];

/* =================================================================== SIMULATIONS */
const SIM = {};
function fail(res, t, x, y, text, lesson) { res.ok = false; res.events.push({ t, x, y, lvl: "bad", text, lesson }); res.failText = text; if (lesson) res.lesson = lesson; return res; }
SIM.car = (p, r0, D) => {
  const zones = D.items.map(z => ({ x: z.x, y: z.y, r: z.r, mu: z.t === "wet" || z.t === "oil" ? z.mu : 0, bank: z.t === "bank" ? z.bank : 0, wind: z.t === "wind" ? z.speed : 0, dir: z.dir || 0 }));
  A.setTrack({ pts: D.pts, zones }); const r = A.run("car", p);
  const res = { ok: true, events: [], path: r.lap.map(q => ({ t: q.t, x: q.x, y: q.y, v: q.v, lat: q.lat, lim: q.lim, grip: q.mu })), T: r.lapT, lesson: "downforce", progress: 1 };
  const seen = new Set();
  r.lap.forEach(q => { if (q.zone >= 0 && !seen.has(q.zone)) { seen.add(q.zone); const z = D.items[q.zone];
    res.events.push({ t: q.t, x: q.x, y: q.y, lvl: z.t === "bank" ? "good" : "warn", text: z.t === "wet" ? `Wet patch: grip drops to ${nf(z.mu * 100)}%, so it slows to ${nf(q.v * 3.6)} km/h` : z.t === "oil" ? `Oil slick! Grip drops to ${nf(z.mu * 100)}%` : z.t === "bank" ? `Banked turn: the tilted road adds grip, ${nf(q.v * 3.6)} km/h through the corner` : `Headwind: more drag, but more downforce too`, lesson: z.t === "bank" ? "downforce" : z.t === "wind" ? "drag" : "downforce" }); } });
  let mi = 0; r.lap.forEach((q, i) => { if (q.v < r.lap[mi].v) mi = i; }); const q = r.lap[mi];
  res.events.push({ t: q.t, x: q.x, y: q.y, lvl: "info", text: `Slowest corner: ${nf(q.v * 3.6)} km/h. The tires are at their grip limit here.`, lesson: "downforce" });
  res.events.sort((a, b) => a.t - b.t);
  res.title = `Lap time ${fmtT(r.lapT)}`; res.lines = [["Lap time", `${Math.floor(r.lapT / 60)}:${(r.lapT % 60).toFixed(2).padStart(5, "0")}`], ["Top speed here", `${nf(r.vLapMax * 3.6)} km/h`], ["Slowest corner", `${nf(r.vMin * 3.6)} km/h`], ["Track length", `${nf(r.trackLen / 1000, 2)} km`]];
  res.perf = -r.lapT / 60; res.summary = `Faster corners come from grip: tire grip, downforce, and banking. Faster straights come from power and low drag.`;
  res.hud = s => [["Speed", `${nf(s.v * 3.6)} km/h`], ["Cornering", `${nf(s.lat, 2)} g`], ["Grip", s.lim ? "at the limit" : "spare"]];
  return res;
};
SIM.boat = (p, r, D) => {
  const res = { ok: true, events: [], path: [], lesson: "froude", progress: 0 };
  const route = [D.start, ...D.marks, D.start]; let total = 0; for (let i = 1; i < route.length; i++) total += hyp(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  if (r.noLiquid) return fail(res, 0, D.start[0], D.start[1], "There's no liquid on this world, so the boat has nothing to float on.", "buoyancy");
  if (r.sinks) return fail(res, 0, D.start[0], D.start[1], "It sinks at the dock: too heavy for its hull.", "buoyancy");
  if (r.capsizes) return fail(res, 0, D.start[0], D.start[1], "It capsizes at the dock: the weight sits too high for how wide it is.", "metacentric");
  const v0 = r.vtop, ds = Math.max(2, total / 900); let t = 0, s = 0, entered = new Set(), vmax = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], L = hyp(b[0] - a[0], b[1] - a[1]), hx = (b[0] - a[0]) / (L || 1), hy = (b[1] - a[1]) / (L || 1);
    for (let d = 0; d < L; d += ds) {
      const x = a[0] + hx * d, y = a[1] + hy * d; let f = 1, cur = 0;
      // slowing for the turns at each buoy
      for (let m = 1; m < route.length - 1; m++) { const P0 = route[m - 1], P1 = route[m], P2 = route[m + 1], u1 = [P1[0] - P0[0], P1[1] - P0[1]], u2 = [P2[0] - P1[0], P2[1] - P1[1]], th = Math.acos(clamp((u1[0] * u2[0] + u1[1] * u2[1]) / ((hyp(...u1) * hyp(...u2)) || 1), -1, 1)); f *= 1 - 0.5 * (th / PI) * Math.exp(-hyp(x - P1[0], y - P1[1]) / (4 * p.L + 12)); }
      D.items.forEach((z, zi) => { if (!inside(z, x, y)) return; const first = !entered.has(zi); if (first) entered.add(zi);
        if (z.t === "rough") { const fr = 1 / (1 + Math.pow(z.h / (0.06 * p.L + 0.05), 1.5)); f *= fr;
          if (first) res.events.push({ t, x, y, lvl: "warn", text: `Rough water, ${nf(z.h, 1)} m waves: ${fr < 0.5 ? `a ${nf(p.L, 0)} m boat gets thrown around and slows to ${nf(fr * 100)}% speed` : `a ${nf(p.L, 0)} m hull rides over them at ${nf(fr * 100)}% speed`}`, lesson: "froude" });
          if (z.h > 0.6 * p.B && r.GM < 0.25 * z.h) res.capsize = { t, x, y, h: z.h }; }
        if (z.t === "current") { const [cx, cy] = dirV(z.dir); cur += z.speed * (cx * hx + cy * hy); if (first) res.events.push({ t, x, y, lvl: "warn", text: `Current of ${nf(z.speed, 1)} m/s ${cx * hx + cy * hy < 0 ? "against" : "with"} the boat`, lesson: "froude" }); }
        if (z.t === "shallow" && first) { if (r.T > z.depth) res.aground = { t, x, y, depth: z.depth }; else res.events.push({ t, x, y, lvl: "good", text: `Shallows, ${nf(z.depth, 1)} m deep: the hull only needs ${nf(r.T, 2)} m, so it passes`, lesson: "buoyancy" }); }
        if (z.t === "rocks") res.rocks = { t, x, y };
      });
      if (res.capsize) return fail(res, t, x, y, `Capsized in ${nf(res.capsize.h, 1)} m waves: the boat is too narrow or top-heavy to recover.`, "metacentric");
      if (res.aground) return fail(res, t, x, y, `Ran aground: the hull reaches ${nf(r.T, 2)} m down but the water is only ${nf(res.aground.depth, 1)} m deep.`, "buoyancy");
      if (res.rocks) return fail(res, t, x, y, "Hit the rocks! Move the buoys so the course goes around them.", null);
      const v = v0 * f, gs = v + cur;
      if (gs < 0.3) return fail(res, t, x, y, `The current is faster than the boat can go (${nf(v, 1)} m/s), so it's pushed backward.`, "froude");
      res.path.push({ t, x, y, v: gs, hd: Math.atan2(hy, hx) }); vmax = Math.max(vmax, gs);
      t += ds / gs; s += ds; res.progress = s / total;
    }
    if (i < route.length - 1) res.events.push({ t, x: b[0], y: b[1], lvl: "good", text: `Rounded buoy ${i}`, lesson: null });
  }
  res.path.push({ t, x: D.start[0], y: D.start[1], v: 0, hd: 0 }); res.T = t; res.progress = 1;
  res.events.push({ t, x: D.start[0], y: D.start[1], lvl: "good", text: `Finished in ${fmtT(t)}`, lesson: null });
  res.title = `Course time ${fmtT(t)}`; res.lines = [["Time", fmtT(t)], ["Average speed", `${nf(total / t * 1.944, 1)} kn`], ["Distance", `${nf(total / 1000, 2)} km`], ["Top speed", `${nf(vmax * 1.944, 1)} kn`]];
  res.perf = -t / 600; res.summary = "Long hulls handle waves better; wide, low boats resist capsizing; the draft decides where you can go.";
  res.hud = s => [["Speed", `${nf(s.v * 1.944, 1)} kn`]];
  return res;
};
SIM.drone = (p, r, D) => {
  const res = { ok: true, events: [], path: [], lesson: "rotor", progress: 0 };
  if (!r.canHover) return fail(res, 0, D.home[0], D.home[1], "It can't lift off: the rotors can't push down as hard as the drone weighs.", "rotor");
  const route = [D.home, ...D.stops, D.home]; let total = 0; for (let i = 1; i < route.length; i++) total += hyp(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  const W0 = r.W, E0 = r.Ph * r.tHover, vc = Math.max(2, 0.65 * r.vmax), per = D.stops.length ? p.payload / D.stops.length : 0, g = A.PLANETS[p.planet].g;
  let E = E0, W = W0, t = 0, s = 0, alt = 0, low = false; const ds = Math.max(2, total / 900), entered = new Set();
  const push = (x, y, h, v) => res.path.push({ t, x, y, h, v, bat: E / E0 });
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], L = hyp(b[0] - a[0], b[1] - a[1]), hx = (b[0] - a[0]) / (L || 1), hy = (b[1] - a[1]) / (L || 1);
    let need = 30; for (let d = 0; d <= L; d += ds) { const x = a[0] + hx * d, y = a[1] + hy * d; for (const z of D.items) if (z.t === "building" && Math.abs(x - z.x) < z.r && Math.abs(y - z.y) < z.r) need = Math.max(need, z.h + 12); }
    if (need > alt) { const dh = need - alt, P = r.Ph * Math.pow(W / W0, 1.5) * 1.3, tc = dh / Math.max(r.climb || 3, 1); E -= P * tc + W * dh / 0.5; t += tc; alt = need;
      if (need > 45) res.events.push({ t, x: a[0], y: a[1], lvl: "info", text: `Climbs to ${nf(need)} m to clear the buildings (climbing costs extra battery)`, lesson: "rotor" }); }
    for (let d = 0; d < L; d += ds) {
      const x = a[0] + hx * d, y = a[1] + hy * d; let w = 0;
      D.items.forEach((z, zi) => { if (!inside(z, x, y)) return; const first = !entered.has(zi); if (first) entered.add(zi);
        if (z.t === "wind") { const [cx, cy] = dirV(z.dir); w += z.speed * (cx * hx + cy * hy); if (first) res.events.push({ t, x, y, lvl: "warn", text: `${nf(z.speed, 1)} m/s wind ${cx * hx + cy * hy < 0 ? "in its face: it tilts forward harder and burns battery faster" : "at its back: a free push"}`, lesson: "drag" }); }
        if (z.t === "nofly") res.nofly = true; });
      if (res.nofly) return fail(res, t, x, y, "Flew into a no-fly zone (like the airspace around an airport). Drag the drop points to route around it.", null);
      const gs = vc + w; if (gs < 0.5) return fail(res, t, x, y, `The headwind (${nf(-w, 1)} m/s) is stronger than the drone can fly, so it can't make progress.`, "drag");
      const P = r.Ph * Math.pow(W / W0, 1.5) * (1 + 0.35 * Math.pow(Math.min(vc - w, r.vmax * 1.3) / r.vmax, 2)), dt = ds / gs; E -= P * dt; t += dt; s += ds; res.progress = s / total;
      if (!low && E < 0.2 * E0 && E > 0) { low = true; res.events.push({ t, x, y, lvl: "warn", text: "Battery below 20%", lesson: "breguet" }); }
      if (E <= 0) { push(x, y, alt, gs); return fail(res, t, x, y, `Battery empty ${nf((total - s) / 1000, 2)} km from home: the drone falls. A bigger battery, lighter frame, or bigger rotors would help.`, "rotor"); }
      push(x, y, alt, gs);
    }
    if (i < route.length - 1) { W = Math.max(W0 - per * g * i, W0 * 0.3); res.events.push({ t, x: b[0], y: b[1], lvl: "good", text: `Package ${i} of ${D.stops.length} delivered${per > 0 ? ": lighter now, so hovering costs less" : ""}`, lesson: "thrust" }); }
  }
  push(D.home[0], D.home[1], 0, 0); res.T = t; res.progress = 1; res.batLeft = E / E0;
  res.events.push({ t, x: D.home[0], y: D.home[1], lvl: "good", text: `Back home with ${nf(E / E0 * 100)}% battery left`, lesson: null });
  res.title = `Mission complete, ${nf(E / E0 * 100)}% battery left`; res.lines = [["Flight time", fmtT(t)], ["Distance", `${nf(total / 1000, 2)} km`], ["Battery left", `${nf(E / E0 * 100)}%`], ["Cruise speed", `${nf(vc * 3.6)} km/h`]];
  res.perf = E / E0; res.summary = "Hovering costs energy every second. Bigger, slower rotors and less weight stretch the battery.";
  res.hud = s => [["Battery", `${nf(s.bat * 100)}%`], ["Altitude", `${nf(s.h)} m`], ["Ground speed", `${nf(s.v * 3.6)} km/h`]];
  return res;
};
SIM.plane = (p, r0, D) => {
  const res = { ok: true, events: [], path: [], lesson: "lift", progress: 0, side: true };
  const glider = p.engine === "glider", X = D.dist, N = 1400, dx = X / N; let t = 0;
  const windAt = (x, h) => { let w = 0; for (const it of D.items) if (it.t === "wind" && h >= it.base && h <= it.top) w += it.speed; return w; };
  const inStorm = (x, h) => D.items.find(it => it.t === "storm" && Math.abs(x - it.x) < it.w / 2 && h >= it.base && h <= it.top);
  if (glider) {
    const LD = Math.max(r0.LDmax || 10, 3), v = (r0.vs0 || 20) * 1.35; let h = D.dep.elev + 1000;
    res.events.push({ t: 0, x: 0, y: h, lvl: "info", text: "Released from the tow plane 1,000 m above the airfield", lesson: "ld" });
    const th = new Set();
    for (let i = 0; i <= N; i++) { const x = i * dx, gnd = planeGround(D, x);
      D.items.forEach((it, k) => { if (it.t === "thermal" && Math.abs(x - it.x) < dx * 1.5 && !th.has(k)) { th.add(k); const gain = Math.min(it.strength * 600, gnd + 2800 - h); if (gain > 0) { h += gain; t += gain / it.strength; res.events.push({ t, x, y: h, lvl: "good", text: `Thermal: rising warm air lifts it ${nf(gain)} m, free height`, lesson: "ld" }); } } });
      const w = windAt(x, h), gs = Math.max(v - w, 1);
      if (h < gnd + 20) { res.path.push({ t, x, y: gnd, v: 0, fuel: 1 }); return fail(res, t, x, gnd, `Out of height at ${nf(x)} km: it glides down into a field. With a glide ratio of ${nf(LD)}:1 it needs ${nf((X - x) * 1000 / LD)} m more height to finish.`, "ld"); }
      if (inStorm(x, h)) return fail(res, t, x, h, "Glided into a thunderstorm. Violent air currents: never do this!", "stall");
      res.path.push({ t, x, y: h, v: gs, fuel: 1 }); h -= dx * 1000 / LD * (v / gs); t += dx * 1000 / gs; res.progress = x / X;
    }
    res.T = t; res.title = `Glided all ${nf(X)} km`; res.lines = [["Distance", `${nf(X)} km`], ["Time", fmtT(t)], ["Glide ratio", `${nf(LD)} : 1`], ["Height left", `${nf(res.path[res.path.length - 1].y - D.arr.elev)} m`]];
    res.perf = (res.path[res.path.length - 1].y - D.arr.elev) / 1000; res.summary = "A glider trades height for distance. Long, skinny wings stretch each metre of height further, and thermals give free height back.";
    res.hud = s => [["Altitude", Dm(s.y)], ["Ground speed", `${nf(s.v * 3.6)} km/h`]]; return res;
  }
  const rd = A.run("plane", Object.assign({}, p, { alt0: D.dep.elev }));
  if (!rd.canTO) return fail(res, 0, 0, D.dep.elev, `It can't take off from a ${Dm(D.dep.elev)} high airport: the air is too thin for this wing and engine.`, "lift");
  if (rd.toDist > D.dep.rw) return fail(res, 0, 0, D.dep.elev, `The runway is too short: it needs ${nf(rd.toDist)} m to take off and has ${nf(D.dep.rw)} m. Thin, hot air at high airports makes this worse.`, "lift");
  const svc = rd.svc != null ? rd.svc : (rd.ceil || 3000), TAS = rd.vCr || r0.vCr; if (!TAS) return fail(res, 0, 0, D.dep.elev, "It can't hold level flight: not enough power to overcome drag.", "drag");
  let maxG = 0, maxGx = 0; for (let i = 0; i <= N; i++) { const g = planeGround(D, i * dx); if (g > maxG) { maxG = g; maxGx = i * dx; } }
  let cruise = Math.max(p.cruise, maxG + 300), stormTop = 0;
  for (const it of D.items) if (it.t === "storm") stormTop = Math.max(stormTop, it.top + 300);
  if (stormTop && stormTop <= svc) cruise = Math.max(cruise, stormTop);
  if (maxG + 300 > svc) { /* can't clear: will hit the mountain below */ cruise = Math.min(cruise, svc); }
  cruise = Math.min(cruise, svc);
  if (cruise > p.cruise + 50) res.events.push({ t: 0, x: 0.5, y: D.dep.elev, lvl: "info", text: `Plans to cruise at ${Dm(cruise)} to clear the ${stormTop && stormTop >= maxG + 300 ? "storm" : "mountains"} (its ceiling is ${Dm(svc)})`, lesson: "atmosphere" });
  // climb gradient from the engine's own climb, fading toward the ceiling
  const cl = rd.samples.filter(s => s.ph === "climb"); let g0 = 0.08; if (cl.length > 2) g0 = Math.max(0.01, (cl[Math.min(cl.length - 1, 8)].h - cl[0].h) / Math.max(1, cl[Math.min(cl.length - 1, 8)].x - cl[0].x));
  let h = D.dep.elev, air = 0, fuelR = rd.range || r0.range || 1e9, descending = false;
  const land = A.run("plane", Object.assign({}, p, { alt0: D.arr.elev }));
  res.events.push({ t: 0, x: 0, y: D.dep.elev, lvl: "good", text: `Takeoff after ${nf(rd.toDist)} m of runway`, lesson: "lift" });
  for (let i = 0; i <= N; i++) {
    const x = i * dx, gnd = planeGround(D, x), rem = X - x, slope = Math.tan(3 * PI / 180);
    if (!descending && h > D.arr.elev && rem * 1000 * slope <= h - D.arr.elev) descending = true;
    const w = windAt(x, h), gs = TAS - w;
    if (gs < 15) return fail(res, t, x, h, `A ${nf(w)} m/s headwind: the plane barely moves over the ground.`, "drag");
    if (h < gnd + 25 && x > 3 && x < X - 3) { res.path.push({ t, x, y: h, v: gs, fuel: 1 - air / fuelR }); return fail(res, t, x, gnd, cruise >= svc - 1 && maxG + 300 > svc ? `It can't climb over the ${Dm(maxG)} mountain: its ceiling is only ${Dm(svc)}. The air up there is too thin for this wing and engine.` : `Hit the mountain while climbing: it doesn't climb steeply enough. More power, or bigger wings, help it climb.`, "atmosphere"); }
    const st = inStorm(x, h); if (st) return fail(res, t, x, h, `Flew into a thunderstorm at ${Dm(h)}. Pilots go over or around: it would need a ceiling above ${Dm(st.top + 300)}.`, "stall");
    res.path.push({ t, x, y: h, v: gs, fuel: 1 - air / fuelR, w });
    const dm = dx * 1000; air += dm * TAS / gs; t += dm / gs; res.progress = x / X;
    if (air > fuelR) return fail(res, t, x, h, `Out of fuel ${nf(X - x)} km short. ${w > 5 ? "The headwind made the trip longer through the air. " : ""}More fuel, or a more efficient wing, would help.`, "breguet");
    if (descending) h = Math.max(D.arr.elev, h - dm * slope); else if (h < cruise) h = Math.min(cruise, h + dm * g0 * Math.max(0.04, 1 - (h - D.dep.elev) / Math.max(1, svc - D.dep.elev)));
  }
  const ldg = land.canTO ? land.toDist * 1.25 : Infinity;
  if (ldg > D.arr.rw) return fail(res, t, X, D.arr.elev, `The runway at the destination is too short: landing needs about ${nf(ldg)} m, it has ${nf(D.arr.rw)} m. Flaps let a plane land slower and shorter.`, "stall");
  res.events.push({ t, x: X, y: D.arr.elev, lvl: "good", text: `Landed with ${nf((1 - air / fuelR) * 100)}% fuel left`, lesson: null });
  const winds = D.items.filter(i => i.t === "wind"); if (winds.length) res.events.push({ t: t * 0.5, x: X * 0.5, y: cruise, lvl: winds[0].speed > 0 ? "warn" : "good", text: winds[0].speed > 0 ? `Headwind at cruise: ${nf(winds[0].speed)} m/s slows it over the ground` : `Tailwind at cruise: ${nf(-winds[0].speed)} m/s pushes it along, saving fuel`, lesson: "breguet" });
  res.events.sort((a, b) => a.t - b.t);
  res.T = t; res.title = `Arrived in ${fmtT(t)}`; res.lines = [["Flight time", fmtT(t)], ["Cruise altitude", Dm(cruise)], ["Fuel left", `${nf((1 - air / fuelR) * 100)}%`], ["Route", `${nf(X)} km`]];
  res.perf = (1 - air / fuelR); res.summary = "A plane's ceiling decides which mountains and storms it can fly over. Wind at cruise altitude changes the trip time and the fuel it burns.";
  res.hud = s => [["Altitude", Dm(s.y)], ["Ground speed", `${nf(s.v * 3.6)} km/h`], ["Fuel", `${nf(s.fuel * 100)}%`]];
  return res;
};
SIM.sub = (p, r, D) => {
  const res = { ok: true, events: [], path: [], lesson: "pressure", progress: 0, side: true, depth: true };
  if (r.noLiquid) return fail(res, 0, 0, 0, "There's no ocean on this world.", "buoyancy");
  const X = D.dist, N = 1600, dx = X / N, tanA = Math.tan(25 * PI / 180), v = Math.max(0.5, r.vtop || 2); let z = 0, t = 0, maxZ = 0, zone = A.zoneAt(0), warned = false, seen = new Set();
  const curAt = zz => { let c = 0; for (const it of D.items) if (it.t === "current" && zz >= it.base && zz <= it.top) c += it.speed; return c; };
  for (let i = 0; i <= N; i++) {
    const x = i * dx, fl = seafloor(D, x), want = Math.min(fl - D.clear, p.target), lim = dx * 1000 * tanA;
    const nz = Math.min(Math.min(want, z + lim), fl - Math.max(2, Math.min(D.clear, fl * 0.5)));   // dives at up to 25°, climbs as steeply as it needs
    const dz = nz - z; z = Math.max(0, nz); maxZ = Math.max(maxZ, z);
    const pr = r.liq.rho * A.PLANETS[p.planet].g * z + 101325;
    if (z > r.crush) { res.path.push({ t, x, y: z, z, p: pr }); return fail(res, t, x, z, `IMPLOSION at ${Dm(z)}. The water squeezes with ${nf(pr / 101325)} times air pressure; this hull gives way at ${Dm(r.crush)}. A thicker wall, a stronger material or a sphere shape helps.`, "crush"); }
    if (z > r.test && !warned) { warned = true; res.events.push({ t, x, y: z, lvl: "warn", text: `Past its safe test depth (${Dm(r.test)}). Engineers keep a safety margin below the crush depth.`, lesson: "crush" }); }
    const zn = A.zoneAt(z); if (zn !== zone) { zone = zn; res.events.push({ t, x, y: z, lvl: "info", text: `${zn} · ${Dm(z)}`, lesson: "pressure" }); }
    D.items.forEach((it, k) => { if ((it.t === "wreck" || it.t === "vent") && Math.abs(x - it.x) < dx * 1.2 && !seen.has(k)) { seen.add(k); const ok2 = z > seafloor(D, it.x) - D.clear - 150;
      res.events.push({ t, x, y: z, lvl: ok2 ? "good" : "info", text: it.t === "wreck" ? (ok2 ? `Found the shipwreck at ${Dm(seafloor(D, it.x))}!` : "Passed above the shipwreck: set a deeper target depth to reach it") : (ok2 ? `Hydrothermal vents: 400 °C water full of minerals, and life that never sees the sun` : "Passed high above the hot vents"), lesson: "pressure" }); } });
    const c = curAt(z), hs = Math.max(0.2, v - c), step = Math.hypot(dx * 1000, dz); res.path.push({ t, x, y: z, z, p: pr, cur: c });
    t += dx * 1000 / hs + Math.abs(dz) / Math.max(0.6, v * 0.5); res.progress = x / X;
  }
  if (!r.canSurface) return fail(res, t, X, z, "It can't float back up: too heavy even with empty tanks. Add buoyancy foam.", "buoyancy");
  for (let k = 1; k <= 20; k++) { const zz = z * (1 - k / 20); res.path.push({ t: t + k / 20 * z / Math.max(0.5, v * 0.5), x: X, y: zz, z: zz, p: r.liq.rho * A.PLANETS[p.planet].g * zz + 101325 }); }
  t = res.path[res.path.length - 1].t;
  res.events.push({ t, x: X, y: 0, lvl: "good", text: `Surfaced safely. Deepest point: ${Dm(maxZ)}`, lesson: null });
  res.T = t; res.maxZ = maxZ; res.title = `Dived to ${Dm(maxZ)} and back`; res.lines = [["Deepest", Dm(maxZ)], ["Peak squeeze", `${nf((r.liq.rho * A.PLANETS[p.planet].g * maxZ + 101325) / 101325)} atm`], ["Hull margin", `${nf((1 - maxZ / r.crush) * 100)}%`], ["Time", fmtT(t)]];
  res.perf = 1 - maxZ / r.crush; res.summary = "Every 10 m of water adds about one more atmosphere of squeeze. Spheres and thick walls survive the deepest trenches.";
  res.hud = s => [["Depth", Dm(s.z)], ["Pressure", `${nf(s.p / 101325)} atm`], ["Hull stress", `${nf(Math.min(999, s.z / r.crush * 100))}%`]];
  return res;
};
SIM.rocket = (p, r, D) => {
  const res = { ok: true, events: [], path: [], lesson: "drag", progress: 0, side: true };
  const Sm = r.samples, n = Sm.length, step = Math.max(1, Math.floor(n / 1500)); let drift = 0, hoopBest = Infinity, hoopHit = false;
  const hoop = D.items.find(i => i.t === "hoop"), ceil = D.items.find(i => i.t === "ceiling");
  const windAt = h => { let w = 0; for (const it of D.items) if (it.t === "wind" && h >= it.base && h <= it.top) w += it.speed; return w; };
  let entered = new Set();
  for (let i = 0; i < n; i++) {
    const s = Sm[i], sp = i ? Sm[i - 1] : s, dt = s.t - sp.t, f = s.chute ? 1 : s.thr > 0.01 ? 0.12 : 0.5; drift += windAt(s.h) * f * dt;
    const x = (s.x + drift) / 1000, h = s.h;
    D.items.forEach((it, k) => { if (it.t === "wind" && h >= it.base && h <= it.top && !entered.has(k)) { entered.add(k); res.events.push({ t: s.t, x, y: h, lvl: "info", text: `Wind layer: ${nf(Math.abs(it.speed), 1)} m/s pushes it ${it.speed >= 0 ? "right" : "left"}${p.chute ? ", most of all under the parachute" : ""}`, lesson: "drag" }); } });
    if (hoop) { const d = hyp((x - hoop.x) * 1000, h - hoop.h); if (d < hoopBest) hoopBest = d; if (d <= hoop.r && !hoopHit) { hoopHit = true; res.events.push({ t: s.t, x, y: h, lvl: "good", text: "Through the hoop!", lesson: "stability" }); } }
    if (i % step === 0 || i === n - 1) res.path.push({ t: s.t, x, y: h, v: s.v, h });
    const st = D.items.find(it => it.t === "storm" && Math.abs(x - it.x) < it.w / 2 && h >= it.base && h <= it.top);
    if (st) return fail(res, s.t, x, h, "Flew into the storm cloud. A rocket's exhaust plume can trigger lightning: Apollo 12 was struck twice this way. Launches wait for storms to pass.", "atmosphere");
    if (ceil && h > ceil.h) return fail(res, s.t, x, h, `Broke the ${Dm(ceil.h)} altitude limit. Real launches get permission for a set height: a smaller motor or more weight keeps it lower.`, "rocketeq");
    res.progress = i / n;
  }
  const last = res.path[res.path.length - 1], lx = last.x;
  if (r.failure) res.events.push({ t: last.t, x: lx, y: last.y, lvl: "bad", text: `Structural failure: ${r.failure}`, lesson: "buckling" });
  if (r.failure) { res.ok = false; res.failText = `It broke up in flight (${r.failure}).`; }
  if (r.tumbling && res.ok) { res.ok = false; res.failText = "It tumbled: unstable rockets fly wherever the wind throws them."; res.events.push({ t: last.t, x: lx, y: last.y, lvl: "bad", text: "Tumbled: fins too small to keep it pointed", lesson: "stability" }); res.lesson = "stability"; }
  if (!r.orbit && res.ok) { const hz = D.items.find(it => (it.t === "lake" || it.t === "town") && lx >= it.x && lx <= it.x + it.w);
    if (hz) return fail(res, last.t, lx, 0, hz.t === "lake" ? `Landed in the lake, ${nf(lx, 2)} km downwind. Wind pushes hardest on the parachute: a smaller chute (or a later one) drifts less.` : `Came down in the town! Wind carried it ${nf(lx, 2)} km. Launch sites keep a clear area downwind.`, "drag"); }
  if (hoop && !hoopHit && res.ok) { res.ok = false; res.failText = `Missed the hoop by ${nf(hoopBest)} m.`; res.events.push({ t: last.t, x: hoop.x, y: hoop.h, lvl: "bad", text: `Missed the hoop by ${nf(hoopBest)} m`, lesson: "rocketeq" }); res.lesson = "rocketeq"; }
  if (res.ok) res.events.push({ t: last.t, x: lx, y: last.y, lvl: "good", text: r.orbit ? "Reached orbit!" : `Landed ${nf(Math.abs(lx), 2)} km from the pad`, lesson: null });
  res.events.sort((a, b) => a.t - b.t);
  res.T = last.t; res.title = res.ok ? (r.orbit ? "Orbit, clear of every hazard" : `Clean flight, landed ${nf(Math.abs(lx), 2)} km away`) : "Course failed"; res.lines = [["Apogee", Dm(r.apogee)], ["Drift", `${nf(Math.abs(drift) / 1000, 2)} km`], ["Flight time", fmtT(last.t)], hoop ? ["Hoop", hoopHit ? "through it" : `missed by ${nf(hoopBest)} m`] : ["Landing", `${nf(Math.abs(lx), 2)} km out`]];
  res.perf = hoop ? -hoopBest / 1000 : -Math.abs(lx); if (!res.ok && hoop) res.margin = -Math.min(hoopBest / Math.max(hoop.h, 1), 2) * 100;
  res.summary = "Wind pushes hardest on a slow rocket under its parachute, so drift depends on the wind and on how long the rocket hangs in the air.";
  res.hud = s => [["Altitude", Dm(s.h)], ["Speed", `${nf(s.v * 3.6)} km/h`], ["Downrange", `${nf(s.x, 2)} km`]];
  return res;
};

/* =================================================================== STATE + DOM */
const C = { kind: null, D: null, tool: "move", sel: null, res: null, play: null, vp: null, drag: null, open: false, dirty: true, hover: null };
const panel = document.createElement("section"); panel.id = "course"; panel.className = "glass brk"; panel.setAttribute("aria-label", "Course builder");
panel.innerHTML = `<div class="chd"><div class="ctit"><div class="cap" id="coCap">Course builder</div><h2 id="coT">Course</h2></div><div class="ctpl" id="coTpl"></div>
  <div class="cact"><button class="hb sm" id="coClear" title="Remove every obstacle">Clear</button><button class="hb go" id="coRun">Run course</button></div></div>
  <div class="cbar"><div class="ctools" id="coTools"></div><div class="chint" id="coHint"></div></div>
  <div class="cbody"><canvas id="coC"></canvas><div class="chud glass" id="coHud" hidden></div><div class="cinsp glass" id="coInsp" hidden></div><div class="cev" id="coEv"></div></div>
  <div class="cres" id="coRes" hidden></div>`;
document.body.insertBefore(panel, $("left"));
const cv = $("coC"), g = cv.getContext("2d");
function key() { return "liftoff-course-" + C.kind; }
function save() { store.set(key(), C.D); }
function loadKind(kind) {
  C.kind = kind; C.sel = null; C.res = null; C.play = null; C.tool = "move";
  const T = K[kind]; C.D = store.get(key(), null);
  if (!C.D || !C.D.items) C.D = T.templates[0][1](S.r || A.run(kind, S.p));
  applyTrack();
  $("coCap").textContent = `Course builder · ${A.VEHICLES[kind].name}`; $("coT").textContent = T.title; $("coHint").textContent = T.hint;
  $("coTpl").innerHTML = T.templates.map((t, i) => `<button class="chip" data-i="${i}">${esc(t[0])}</button>`).join("");
  $("coTpl").querySelectorAll(".chip").forEach(b => b.onclick = () => { C.D = T.templates[+b.dataset.i][1](S.r); C.sel = null; C.res = null; save(); applyTrack(); fit(); insp(); draw(); showRes(); toast(`Loaded course: ${T.templates[+b.dataset.i][0]}`); });
  $("coTools").innerHTML = T.tools.map(([id, l]) => `<button class="tl" data-t="${id}" aria-pressed="${id === C.tool}" title="${esc(l)}">${TOOLICON[id] || TOOLICON.add}<span>${esc(l)}</span></button>`).join("");
  $("coTools").querySelectorAll(".tl").forEach(b => b.onclick = () => setTool(b.dataset.t));
  $("coRun").textContent = { car: "Run a lap", boat: "Run the course", drone: "Fly the route", plane: "Fly the route", sub: "Dive the course", rocket: "Launch" }[kind];
  fit(); insp(); showRes(); draw();
}
function setTool(t) { C.tool = t; $("coTools").querySelectorAll(".tl").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t))); cv.style.cursor = t === "move" ? "default" : "crosshair"; if (t !== "move") $("coHint").textContent = t === "bend" ? "Click on the track to add a bend there." : `Click on the map to place: ${(K[C.kind].items[t] || { l: t === "mark" ? "a buoy" : "a drop point" }).l || t}.`; else $("coHint").textContent = K[C.kind].hint; }
function applyTrack() { if (C.kind === "car" && C.open) { A.setTrack({ pts: C.D.pts, zones: C.D.items.map(z => ({ x: z.x, y: z.y, r: z.r, mu: z.t === "wet" || z.t === "oil" ? z.mu : 0, bank: z.t === "bank" ? z.bank : 0, wind: z.t === "wind" ? z.speed : 0, dir: z.dir || 0 })) }); } }
const TOOLICON = {
  move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3l14 8-6 2-2 6z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  bend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18c6 0 4-12 10-12s5 9 8 9"/><circle cx="13" cy="6" r="2"/></svg>',
  wet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/></svg>',
  oil: '<svg viewBox="0 0 24 24" fill="currentColor" opacity=".8"><ellipse cx="12" cy="13" rx="8" ry="5"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 19L21 9M3 19h18"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h11a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h8"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v10M8 13h8l-2 7h-4z"/></svg>',
  rough: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 10c3-3 5 3 8 0s5 3 8 0 4 1 4 1M2 16c3-3 5 3 8 0s5 3 8 0"/></svg>',
  current: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h15M14 7l5 5-5 5"/></svg>',
  shallow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 9h20M4 17c4-3 12-3 16 0"/></svg>',
  rocks: '<svg viewBox="0 0 24 24" fill="currentColor" opacity=".8"><path d="M4 18l3-7 4 2 3-6 6 11z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="8" width="14" height="11" rx="1"/><path d="M5 12h14M12 8v11M9 4l3 4 3-4"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
  nofly: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M6 6l12 12"/></svg>',
  mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 20l7-13 4 7 3-4 6 10z"/></svg>',
  storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 15a4 4 0 010-8 5 5 0 019.6 1.5A3.5 3.5 0 0117 15z"/><path d="M12 14l-2 4h3l-2 4"/></svg>',
  thermal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 20c-2-3 2-5 0-8s2-5 0-8M16 20c-2-3 2-5 0-8s2-5 0-8"/></svg>',
  canyon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 6h6l3 13h2l3-13h6"/></svg>',
  seamount: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 20c4 0 6-14 10-14s6 14 10 14"/></svg>',
  wreck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 15l4 4h11l3-5zM8 15V8l6-2v9"/></svg>',
  vent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21l1-6h4l1 6M12 13c-2-2 2-4 0-6s1-3 1-3"/></svg>',
  ceiling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 6h20" stroke-dasharray="3 2"/><path d="M12 20V9M8 13l4-4 4 4"/></svg>',
  hoop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="12" rx="4" ry="8"/></svg>',
  lake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 14c3-2 5 2 8 0s5 2 8 0 4 0 4 0M4 19h16"/></svg>',
  town: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21V11l5-4 5 4v10M13 21V7h8v14M6 21v-4h4v4"/></svg>'
};

/* =================================================================== VIEW / GEOMETRY */
function size() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (!r.width) return false; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); C.dpr = d; C.W = r.width; C.H = r.height; return true; }
function bounds() {
  const D = C.D, k = C.kind; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const ext = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  if (k === "car") { catmull(D.pts, 8).forEach(q => ext(q[0], q[1], 20)); D.items.forEach(z => ext(z.x, z.y, z.r)); }
  if (k === "boat") { [D.start, ...D.marks].forEach(q => ext(q[0], q[1], 60)); D.items.forEach(z => ext(z.x, z.y, z.r)); }
  if (k === "drone") { [D.home, ...D.stops].forEach(q => ext(q[0], q[1], 60)); D.items.forEach(z => ext(z.x, z.y, z.r)); }
  if (k === "car" || k === "boat" || k === "drone") { const px = (x1 - x0) * 0.08 + 20, py = (y1 - y0) * 0.08 + 20; return { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py, eq: true }; }
  if (k === "plane") { let top = Math.max(D.dep.elev, D.arr.elev, S.p.cruise || 0) + 800; for (const it of D.items) top = Math.max(top, it.h || 0, it.top || 0); if (C.res) C.res.path.forEach(q => top = Math.max(top, q.y)); return { x0: -D.dist * 0.03, x1: D.dist * 1.03, y0: -200, y1: top * 1.15 }; }
  if (k === "sub") { let bot = D.shelf; for (let i = 0; i <= 200; i++) bot = Math.max(bot, seafloor(D, i / 200 * D.dist)); return { x0: -D.dist * 0.03, x1: D.dist * 1.03, y0: -bot * 0.07, y1: bot * 1.1, down: true }; }
  if (k === "rocket") { const r = S.r; let top = Math.max(r.apogee * 1.25, 100), xa = -0.2, xb = 0.2; for (const it of D.items) { top = Math.max(top, (it.h || 0) * 1.15, (it.top || 0) * 1.1); if (it.x != null) { xa = Math.min(xa, it.x - (it.w || 0.2)); xb = Math.max(xb, it.x + (it.w || 0.2)); } }
    const path = C.res ? C.res.path : r.samples.map(s => ({ x: s.x / 1000, y: s.h })); path.forEach(q => { xa = Math.min(xa, q.x); xb = Math.max(xb, q.x); top = Math.max(top, q.y * 1.1); });
    const span = Math.max(xb - xa, top / 1000 * 1.3); const mid = (xa + xb) / 2; return { x0: mid - span * 0.55, x1: mid + span * 0.55, y0: -top * 0.05, y1: top }; }
}
function fit() { if (!size()) return; const b = bounds(); const pl = 62, pr = 18, pt = 16, pb = 26, W = C.W - pl - pr, H = C.H - pt - pb;
  if (b.eq) { const sc = Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0)), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; C.vp = { sx: sc, sy: sc, ox: pl + W / 2 - cx * sc, oy: pt + H / 2 - cy * sc, b }; }
  else { const sx = W / (b.x1 - b.x0), sy = H / (b.y1 - b.y0); C.vp = { sx, sy: b.down ? sy : -sy, ox: pl - b.x0 * sx, oy: b.down ? pt - b.y0 * sy : pt + b.y1 * sy, b }; } }
const X = x => C.vp.ox + x * C.vp.sx, Y = y => C.vp.oy + y * C.vp.sy, IX = sx => (sx - C.vp.ox) / C.vp.sx, IY = sy => (sy - C.vp.oy) / C.vp.sy;

/* =================================================================== DRAW */
function draw() {
  if (!C.open || !C.vp) return; const d = C.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, C.W, C.H);
  const k = C.kind, D = C.D; C.handles = [];
  ({ car: drawCar, boat: drawBoat, drone: drawDrone, plane: drawPlane, sub: drawSub, rocket: drawRocket })[k](D);
  drawRun();
}
function grid(step, labelFn, eq) {
  const b = C.vp.b; g.strokeStyle = "rgba(88,225,255,.07)"; g.lineWidth = 1; g.fillStyle = "rgba(138,163,191,.8)"; g.font = "10.5px IBM Plex Mono, monospace";
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const sx = nice((b.x1 - b.x0) / 8), sy = nice(Math.abs(b.y1 - b.y0) / 6);
  for (let x = Math.ceil(b.x0 / sx) * sx; x <= b.x1; x += sx) { if (Math.abs(x) < sx * 1e-6) x = 0; g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), C.H); g.stroke(); g.fillText(labelFn ? labelFn.x(x) : `${nf(x)} m`, X(x) + 3, C.H - 8); }
  for (let y = Math.ceil(Math.min(b.y0, b.y1) / sy) * sy; y <= Math.max(b.y0, b.y1); y += sy) { if (Math.abs(y) < sy * 1e-6) y = 0; g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(C.W, Y(y)); g.stroke(); if (labelFn) g.fillText(labelFn.y(y), 6, Y(y) - 3); }
}
const handle = (x, y, ref, r = 9) => C.handles.push({ sx: X(x), sy: Y(y), r, ref });
function dot(sx, sy, r, fill, stroke, lw = 2) { g.beginPath(); g.arc(sx, sy, r, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function label(t, sx, sy, col = "#e8f3ff", bg = "rgba(3,10,20,.8)", align = "center") { g.font = "600 11px IBM Plex Sans, Arial"; const w = g.measureText(t).width + 10; const x0 = align === "center" ? sx - w / 2 : align === "left" ? sx : sx - w; g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(x0, sy - 9, w, 18, 5) : g.rect(x0, sy - 9, w, 18); g.fill(); g.fillStyle = col; g.textAlign = "left"; g.fillText(t, x0 + 5, sy + 4); }
const isSel = ref => C.sel && C.sel.type === ref.type && C.sel.i === ref.i;
function zoneCircle(z, i, fill, stroke, lbl) { const r = z.r * C.vp.sx; g.beginPath(); g.arc(X(z.x), Y(z.y), r, 0, 7); g.fillStyle = fill; g.fill(); g.setLineDash([5, 4]); g.strokeStyle = isSel({ type: "item", i }) ? "#fff" : stroke; g.lineWidth = isSel({ type: "item", i }) ? 2 : 1.3; g.stroke(); g.setLineDash([]); if (lbl) label(lbl, X(z.x), Y(z.y), stroke); handle(z.x, z.y, { type: "item", i }, Math.max(12, Math.min(r, 30))); }
function windArrows(z, col) { const [cx, cy] = dirV(z.dir); g.strokeStyle = col; g.lineWidth = 1.6; const r = z.r * C.vp.sx; for (let k = -1; k <= 1; k++) { const ox = X(z.x) - cy * k * r * 0.45, oy = Y(z.y) + cx * k * r * 0.45 * (C.vp.sy / C.vp.sx), L = r * 0.5; g.beginPath(); g.moveTo(ox - cx * L, oy - cy * L); g.lineTo(ox + cx * L, oy + cy * L); g.stroke(); g.beginPath(); g.moveTo(ox + cx * L, oy + cy * L); g.lineTo(ox + cx * L - (cx * 7 - cy * 5), oy + cy * L - (cy * 7 + cx * 5)); g.lineTo(ox + cx * L - (cx * 7 + cy * 5), oy + cy * L - (cy * 7 - cx * 5)); g.closePath(); g.fillStyle = col; g.fill(); } }
function drawCar(D) {
  const bg = g.createRadialGradient(C.W / 2, C.H / 2, 0, C.W / 2, C.H / 2, C.W * 0.7); bg.addColorStop(0, "#0a1a14"); bg.addColorStop(1, "#040a0a"); g.fillStyle = bg; g.fillRect(0, 0, C.W, C.H); grid(0, { x: x => `${nf(x)} m`, y: y => `${nf(y)} m` });
  D.items.forEach((z, i) => { if (z.t === "wet") zoneCircle(z, i, "rgba(60,140,255,.18)", "#6fb2ff", `Wet · ${nf(z.mu * 100)}% grip`); if (z.t === "oil") zoneCircle(z, i, "rgba(120,60,160,.3)", "#b18cff", "Oil"); if (z.t === "bank") zoneCircle(z, i, "rgba(255,176,77,.12)", "#ffb04d", `Banked ${z.bank}°`); if (z.t === "wind") { zoneCircle(z, i, "rgba(88,225,255,.06)", "#8cf0ff", `Wind ${z.speed} m/s`); windArrows(z, "rgba(140,240,255,.6)"); } });
  const P = catmull(D.pts, 20), w = Math.max(5, 14 * C.vp.sx);
  const path = () => { g.beginPath(); P.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); };
  g.lineJoin = "round"; path(); g.strokeStyle = "rgba(88,225,255,.35)"; g.lineWidth = w + 4; g.stroke(); path(); g.strokeStyle = "#2a2e35"; g.lineWidth = w; g.stroke();
  path(); g.setLineDash([8, 10]); g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
  const a = P[0], b = P[2], ang = Math.atan2(Y(b[1]) - Y(a[1]), X(b[0]) - X(a[0])); g.save(); g.translate(X(a[0]), Y(a[1])); g.rotate(ang); g.fillStyle = "#fff"; g.fillRect(-2, -w / 2, 4, w); g.restore(); label("START", X(a[0]), Y(a[1]) - w - 6, "#ffb04d");
  D.pts.forEach((q, i) => { dot(X(q[0]), Y(q[1]), isSel({ type: "pt", i }) ? 7 : 5, "#e8f3ff", isSel({ type: "pt", i }) ? "#58e1ff" : "rgba(0,0,0,.6)"); handle(q[0], q[1], { type: "pt", i }); });
}
function drawBoat(D) {
  const bg = g.createLinearGradient(0, 0, 0, C.H); bg.addColorStop(0, "#07304f"); bg.addColorStop(1, "#041a2e"); g.fillStyle = bg; g.fillRect(0, 0, C.W, C.H);
  g.strokeStyle = "rgba(160,220,255,.07)"; for (let y = 10; y < C.H; y += 18) { g.beginPath(); for (let x = 0; x <= C.W; x += 10) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5); g.stroke(); }
  grid(0, { x: x => `${nf(x)} m`, y: y => `${nf(y)} m` });
  D.items.forEach((z, i) => { if (z.t === "rough") zoneCircle(z, i, "rgba(255,255,255,.08)", "#dfefff", `Waves ${nf(z.h, 1)} m`); if (z.t === "current") { zoneCircle(z, i, "rgba(88,225,255,.07)", "#8cf0ff", `Current ${nf(z.speed, 1)} m/s`); windArrows(z, "rgba(140,240,255,.6)"); } if (z.t === "shallow") zoneCircle(z, i, "rgba(214,190,130,.25)", "#e9d49a", `Shallows ${nf(z.depth, 1)} m`); if (z.t === "rocks") { zoneCircle(z, i, "rgba(60,60,66,.8)", "#9aa3ad", "Rocks"); } });
  const route = [D.start, ...D.marks, D.start]; g.setLineDash([6, 6]); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5; g.beginPath(); route.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke(); g.setLineDash([]);
  D.marks.forEach((q, i) => { dot(X(q[0]), Y(q[1]), isSel({ type: "mk", i }) ? 10 : 8, "#ff7a3d", isSel({ type: "mk", i }) ? "#fff" : "#ffd0b0"); g.fillStyle = "#1b0a02"; g.font = "700 10px IBM Plex Mono"; g.textAlign = "center"; g.fillText(i + 1, X(q[0]), Y(q[1]) + 3.5); g.textAlign = "left"; handle(q[0], q[1], { type: "mk", i }); });
  dot(X(D.start[0]), Y(D.start[1]), 9, "#53f2a6", "#04160d"); g.fillStyle = "#04160d"; g.font = "700 10px IBM Plex Mono"; g.textAlign = "center"; g.fillText("S", X(D.start[0]), Y(D.start[1]) + 3.5); g.textAlign = "left"; handle(D.start[0], D.start[1], { type: "start" });
}
function drawDrone(D) {
  g.fillStyle = "#070d16"; g.fillRect(0, 0, C.W, C.H); grid(0, { x: x => `${nf(x)} m`, y: y => `${nf(y)} m` });
  g.strokeStyle = "rgba(88,225,255,.05)"; g.lineWidth = 6; for (let x = -3000; x < 5000; x += 160) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), C.H); g.stroke(); } for (let y = -3000; y < 3000; y += 160) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(C.W, Y(y)); g.stroke(); }
  D.items.forEach((z, i) => {
    if (z.t === "building") { const s = z.r * C.vp.sx, sel = isSel({ type: "item", i }), sh = clamp(z.h / 300, 0.15, 1); g.fillStyle = `rgba(${Math.round(60 + 90 * sh)},${Math.round(90 + 60 * sh)},${Math.round(130 + 40 * sh)},.85)`; g.fillRect(X(z.x) - s, Y(z.y) - s, 2 * s, 2 * s); g.strokeStyle = sel ? "#fff" : "rgba(180,220,255,.5)"; g.lineWidth = sel ? 2 : 1; g.strokeRect(X(z.x) - s, Y(z.y) - s, 2 * s, 2 * s); label(`${nf(z.h)} m`, X(z.x), Y(z.y), "#e8f3ff"); handle(z.x, z.y, { type: "item", i }, Math.max(10, s)); }
    if (z.t === "nofly") { zoneCircle(z, i, "rgba(255,93,108,.12)", "#ff5d6c", "No-fly zone"); }
    if (z.t === "wind") { zoneCircle(z, i, "rgba(88,225,255,.06)", "#8cf0ff", `Wind ${z.speed} m/s`); windArrows(z, "rgba(140,240,255,.6)"); } });
  const route = [D.home, ...D.stops, D.home]; g.setLineDash([6, 6]); g.strokeStyle = "rgba(88,225,255,.5)"; g.lineWidth = 1.5; g.beginPath(); route.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke(); g.setLineDash([]);
  D.stops.forEach((q, i) => { g.fillStyle = "#ffb04d"; g.strokeStyle = isSel({ type: "st", i }) ? "#fff" : "#5a3a10"; g.lineWidth = 2; g.beginPath(); g.rect(X(q[0]) - 8, Y(q[1]) - 8, 16, 16); g.fill(); g.stroke(); g.fillStyle = "#1b0a02"; g.font = "700 10px IBM Plex Mono"; g.textAlign = "center"; g.fillText(i + 1, X(q[0]), Y(q[1]) + 3.5); g.textAlign = "left"; handle(q[0], q[1], { type: "st", i }); });
  dot(X(D.home[0]), Y(D.home[1]), 11, "#53f2a6", "#04160d"); g.fillStyle = "#04160d"; g.font = "700 11px IBM Plex Mono"; g.textAlign = "center"; g.fillText("H", X(D.home[0]), Y(D.home[1]) + 4); g.textAlign = "left"; handle(D.home[0], D.home[1], { type: "home" });
}
function drawPlane(D) {
  const sky = g.createLinearGradient(0, Y(C.vp.b.y1), 0, Y(0)); sky.addColorStop(0, "#050d1f"); sky.addColorStop(1, "#15385e"); g.fillStyle = sky; g.fillRect(0, 0, C.W, C.H);
  grid(0, { x: x => `${nf(x)} km`, y: y => `${nf(y)} m` });
  D.items.forEach((it, i) => { if (it.t === "wind") { const sel = isSel({ type: "item", i }); g.fillStyle = it.speed > 0 ? "rgba(255,122,61,.1)" : "rgba(83,242,166,.1)"; g.fillRect(0, Y(it.top), C.W, Y(it.base) - Y(it.top)); g.strokeStyle = sel ? "#fff" : it.speed > 0 ? "rgba(255,122,61,.5)" : "rgba(83,242,166,.5)"; g.setLineDash([5, 5]); g.strokeRect(-2, Y(it.top), C.W + 4, Y(it.base) - Y(it.top)); g.setLineDash([]);
      label(`${it.speed > 0 ? "Headwind" : "Tailwind"} ${Math.abs(it.speed)} m/s`, 70, (Y(it.top) + Y(it.base)) / 2, it.speed > 0 ? "#ffb04d" : "#53f2a6", "rgba(3,10,20,.8)", "left"); handle(IX(160), (it.base + it.top) / 2, { type: "item", i }, 14); }
    if (it.t === "storm") { const x0 = X(it.x - it.w / 2), x1 = X(it.x + it.w / 2), yt = Y(it.top), yb = Y(it.base), sel = isSel({ type: "item", i }); g.fillStyle = "rgba(120,130,150,.35)"; g.beginPath(); for (let k = 0; k <= 12; k++) { const u = k / 12, cx = lerp(x0, x1, u), r = (x1 - x0) / 7; g.moveTo(cx + r, yt + r * 0.7); g.arc(cx, yt + r * 0.7, r, 0, 7); } g.fill(); g.fillRect(x0, yt + (x1 - x0) / 10, x1 - x0, yb - yt - (x1 - x0) / 10); g.strokeStyle = sel ? "#fff" : "rgba(200,210,230,.5)"; g.strokeRect(x0, yt, x1 - x0, yb - yt);
      g.strokeStyle = "#ffe66b"; g.lineWidth = 2; const lx = (x0 + x1) / 2; g.beginPath(); g.moveTo(lx, yb - 4); g.lineTo(lx - 8, yb + 16); g.lineTo(lx + 2, yb + 16); g.lineTo(lx - 6, yb + 36); g.stroke(); label("Thunderstorm", lx, yt - 12, "#e8f3ff"); handle(it.x, (it.top + it.base) / 2, { type: "item", i }, 16); }
    if (it.t === "thermal") { const sel = isSel({ type: "item", i }), gx = X(it.x), gy = Y(planeGround(D, it.x)); g.strokeStyle = sel ? "#fff" : "rgba(255,176,77,.55)"; g.lineWidth = 1.5; for (let k = -1; k <= 1; k++) { g.beginPath(); for (let yy = gy; yy > gy - 140; yy -= 6) g.lineTo(gx + k * 10 + Math.sin(yy * 0.08 + k) * 5, yy); g.stroke(); } label(`Thermal +${it.strength} m/s`, gx, gy - 150, "#ffb04d"); handle(it.x, planeGround(D, it.x) + 400, { type: "item", i }, 16); } });
  // terrain
  const N = 300; g.beginPath(); g.moveTo(X(C.vp.b.x0), Y(C.vp.b.y0)); for (let i = 0; i <= N; i++) { const x = lerp(C.vp.b.x0, C.vp.b.x1, i / N); g.lineTo(X(x), Y(planeGround(D, clamp(x, 0, D.dist)))); } g.lineTo(X(C.vp.b.x1), Y(C.vp.b.y0)); g.closePath();
  const tg = g.createLinearGradient(0, Y(5000), 0, Y(0)); tg.addColorStop(0, "#e8eef5"); tg.addColorStop(0.35, "#6b6356"); tg.addColorStop(1, "#23351f"); g.fillStyle = tg; g.fill(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.stroke();
  D.items.forEach((it, i) => { if (it.t === "mountain") { const sel = isSel({ type: "item", i }); dot(X(it.x), Y(it.h), sel ? 7 : 5, sel ? "#58e1ff" : "#e8f3ff", "rgba(0,0,0,.6)"); label(Dm(it.h), X(it.x), Y(it.h) - 14, "#e8f3ff"); handle(it.x, it.h, { type: "item", i }); } });
  // airports
  for (const [ap, x, nm] of [[D.dep, 0, "Departure"], [D.arr, D.dist, "Arrival"]]) { const sel = isSel({ type: ap === D.dep ? "dep" : "arr" }); g.fillStyle = sel ? "#58e1ff" : "#ffb04d"; g.fillRect(X(x) - 10, Y(ap.elev) - 3, 20, 4); label(`${nm} · ${Dm(ap.elev)} · ${nf(ap.rw)} m runway`, X(x) + (x ? -8 : 8), Y(ap.elev) - 16, "#ffb04d", "rgba(3,10,20,.8)", x ? "right" : "left"); handle(x, ap.elev, { type: ap === D.dep ? "dep" : "arr" }, 14); }
  if (!C.res && S.p.cruise) { g.setLineDash([3, 6]); g.strokeStyle = "rgba(88,225,255,.45)"; g.beginPath(); g.moveTo(X(0), Y(S.p.cruise)); g.lineTo(X(D.dist), Y(S.p.cruise)); g.stroke(); g.setLineDash([]); label(`planned cruise ${Dm(S.p.cruise)}`, X(D.dist * 0.5), Y(S.p.cruise) - 12, "#8cf0ff"); }
}
function drawSub(D) {
  const b = C.vp.b, bot = b.y1; const zones = [[0, 200, "#1b7fb3", "Sunlight"], [200, 1000, "#0f4a78", "Twilight"], [1000, 4000, "#07203a", "Midnight"], [4000, 6000, "#04121f", "Abyss"], [6000, 11500, "#020810", "Hadal"]];
  g.fillStyle = "#08121f"; g.fillRect(0, 0, C.W, Y(0)); for (const [a, z, col, n] of zones) { if (a > bot) continue; g.fillStyle = col; g.fillRect(0, Y(a), C.W, Y(Math.min(z, bot)) - Y(a) + 1); label(n, C.W - 8, Y(a) + 12, "rgba(200,225,245,.75)", "rgba(0,0,0,.25)", "right"); }
  grid(0, { x: x => `${nf(x)} km`, y: y => y >= 0 ? `${nf(y)} m` : "" });
  g.strokeStyle = "rgba(160,220,255,.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(C.W, Y(0)); g.stroke();
  const r = S.r; if (r && !r.noLiquid) for (const [z, col, n] of [[r.test, "#ffd166", `Safe test depth ${Dm(r.test)}`], [r.crush, "#ff5d6c", `Crush depth ${Dm(r.crush)}`], [S.p.target, "#8cf0ff", `Target depth ${Dm(S.p.target)}`]]) { if (z > bot) continue; g.setLineDash([6, 5]); g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, Y(z)); g.lineTo(C.W, Y(z)); g.stroke(); g.setLineDash([]); label(n, 64, Y(z) - 10, col, "rgba(0,0,0,.45)", "left"); }
  const N = 400; g.beginPath(); g.moveTo(X(b.x0), Y(bot * 1.2)); for (let i = 0; i <= N; i++) { const x = lerp(b.x0, b.x1, i / N); g.lineTo(X(x), Y(seafloor(D, clamp(x, 0, D.dist)))); } g.lineTo(X(b.x1), Y(bot * 1.2)); g.closePath();
  const fg = g.createLinearGradient(0, Y(0), 0, Y(bot)); fg.addColorStop(0, "#5a4b3a"); fg.addColorStop(1, "#1d1712"); g.fillStyle = fg; g.fill(); g.strokeStyle = "rgba(255,220,180,.35)"; g.lineWidth = 1.2; g.stroke();
  D.items.forEach((it, i) => { const sel = isSel({ type: "item", i });
    if (it.t === "canyon") { dot(X(it.x), Y(it.depth), sel ? 7 : 5, sel ? "#58e1ff" : "#e8f3ff", "rgba(0,0,0,.6)"); label(`${Dm(it.depth)}`, X(it.x), Y(it.depth) + 16, "#e8f3ff"); handle(it.x, it.depth, { type: "item", i }); }
    if (it.t === "seamount") { dot(X(it.x), Y(it.top), sel ? 7 : 5, sel ? "#58e1ff" : "#e8f3ff", "rgba(0,0,0,.6)"); label(`summit ${Dm(it.top)}`, X(it.x), Y(it.top) - 14, "#e8f3ff"); handle(it.x, it.top, { type: "item", i }); }
    if (it.t === "wreck") { const y = Y(seafloor(D, it.x)); g.fillStyle = sel ? "#58e1ff" : "#b9a88f"; g.beginPath(); g.moveTo(X(it.x) - 16, y - 8); g.lineTo(X(it.x) + 14, y - 12); g.lineTo(X(it.x) + 10, y); g.lineTo(X(it.x) - 12, y); g.closePath(); g.fill(); g.fillRect(X(it.x) - 2, y - 22, 3, 12); label("Shipwreck", X(it.x), y - 32, "#e8d8b8"); handle(it.x, seafloor(D, it.x), { type: "item", i }, 14); }
    if (it.t === "vent") { const y = Y(seafloor(D, it.x)); g.fillStyle = sel ? "#58e1ff" : "#3a2f28"; g.fillRect(X(it.x) - 4, y - 14, 8, 14); for (let k = 0; k < 6; k++) dot(X(it.x) + Math.sin(k * 1.7 + (performance.now() / 600)) * 5, y - 18 - k * 9, 4 + k, `rgba(40,40,45,${0.5 - k * 0.07})`); label("Hot vent", X(it.x), y - 80, "#ffb04d"); handle(it.x, seafloor(D, it.x), { type: "item", i }, 14); }
    if (it.t === "current") { g.fillStyle = "rgba(88,225,255,.07)"; g.fillRect(0, Y(it.base), C.W, Y(it.top) - Y(it.base)); g.strokeStyle = sel ? "#fff" : "rgba(140,240,255,.45)"; g.setLineDash([5, 5]); g.strokeRect(-2, Y(it.base), C.W + 4, Y(it.top) - Y(it.base)); g.setLineDash([]); label(`Current ${it.speed > 0 ? "against you" : "with you"} ${Math.abs(it.speed)} m/s`, 70, (Y(it.base) + Y(it.top)) / 2, "#8cf0ff", "rgba(3,10,20,.8)", "left"); handle(IX(160), (it.base + it.top) / 2, { type: "item", i }, 14); } });
  if (D.shelf) { handle(D.dist * 0.02 + 0.5, seafloor(D, D.dist * 0.02 + 0.5), { type: "shelf" }, 12); }
}
function drawRocket(D) {
  const b = C.vp.b, top = b.y1, sky = g.createLinearGradient(0, Y(top), 0, Y(0)); const blk = clamp(top / 80000, 0, 1); sky.addColorStop(0, `rgb(${Math.round(8 - blk * 6)},${Math.round(20 - blk * 16)},${Math.round(48 - blk * 38)})`); sky.addColorStop(1, "#2a5f94"); g.fillStyle = sky; g.fillRect(0, 0, C.W, C.H);
  if (top > 60000) { g.fillStyle = "rgba(255,255,255,.6)"; for (let i = 0; i < 70; i++) { const x = (i * 97.3) % C.W, y = (i * 53.7) % (Y(60000)); g.fillRect(x, y, 1.3, 1.3); } }
  grid(0, { x: x => `${nf(x, Math.abs(b.x1 - b.x0) < 4 ? 1 : 0)} km`, y: y => y >= 0 ? Dm(y) : "" });
  if (top > 100000 * 0.6) { g.setLineDash([4, 6]); g.strokeStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(0, Y(100000)); g.lineTo(C.W, Y(100000)); g.stroke(); g.setLineDash([]); label("Kármán line · space", C.W - 10, Y(100000) - 10, "#e8f3ff", "rgba(0,0,0,.4)", "right"); }
  D.items.forEach((it, i) => { const sel = isSel({ type: "item", i });
    if (it.t === "wind") { g.fillStyle = "rgba(88,225,255,.08)"; g.fillRect(0, Y(it.top), C.W, Y(it.base) - Y(it.top)); g.strokeStyle = sel ? "#fff" : "rgba(140,240,255,.45)"; g.setLineDash([5, 5]); g.strokeRect(-2, Y(it.top), C.W + 4, Y(it.base) - Y(it.top)); g.setLineDash([]); const yy = (Y(it.top) + Y(it.base)) / 2; for (let x = 120; x < C.W; x += 140) { g.strokeStyle = "rgba(140,240,255,.5)"; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 30 * Math.sign(it.speed || 1), yy); g.stroke(); } label(`Wind ${it.speed} m/s`, 70, yy, "#8cf0ff", "rgba(3,10,20,.8)", "left"); handle(IX(160), (it.base + it.top) / 2, { type: "item", i }, 14); }
    if (it.t === "storm") { const x0 = X(it.x - it.w / 2), x1 = X(it.x + it.w / 2), yt = Y(it.top), yb = Y(it.base); g.fillStyle = "rgba(120,130,150,.4)"; g.fillRect(x0, yt, x1 - x0, yb - yt); g.strokeStyle = sel ? "#fff" : "rgba(200,210,230,.5)"; g.strokeRect(x0, yt, x1 - x0, yb - yt); g.strokeStyle = "#ffe66b"; g.lineWidth = 2; const lx = (x0 + x1) / 2; g.beginPath(); g.moveTo(lx, yb - 4); g.lineTo(lx - 8, yb + 16); g.lineTo(lx + 2, yb + 16); g.lineTo(lx - 6, yb + 36); g.stroke(); label("Storm cloud", lx, yt - 12, "#e8f3ff"); handle(it.x, (it.top + it.base) / 2, { type: "item", i }, 16); }
    if (it.t === "ceiling") { g.setLineDash([8, 5]); g.strokeStyle = sel ? "#fff" : "#ff5d6c"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, Y(it.h)); g.lineTo(C.W, Y(it.h)); g.stroke(); g.setLineDash([]); label(`Altitude limit ${Dm(it.h)}`, 70, Y(it.h) - 12, "#ff5d6c", "rgba(3,10,20,.8)", "left"); handle(IX(180), it.h, { type: "item", i }, 12); }
    if (it.t === "hoop") { const rx = Math.max(6, it.r / 1000 * C.vp.sx * 0.35), ry = Math.max(8, it.r * Math.abs(C.vp.sy)); g.strokeStyle = sel ? "#fff" : "#ffb04d"; g.lineWidth = 3; g.beginPath(); g.ellipse(X(it.x), Y(it.h), rx, ry, 0, 0, 7); g.stroke(); label(`Hoop ${Dm(it.h)}`, X(it.x) + rx + 8, Y(it.h), "#ffb04d", "rgba(3,10,20,.8)", "left"); handle(it.x, it.h, { type: "item", i }, 14); } });
  g.fillStyle = "#1c2a18"; g.fillRect(0, Y(0), C.W, C.H - Y(0));
  D.items.forEach((it, i) => { const sel = isSel({ type: "item", i }); if (it.t === "lake" || it.t === "town") { const x0 = X(it.x), x1 = X(it.x + it.w); g.fillStyle = it.t === "lake" ? "#2f79b8" : "#6b6f78"; g.fillRect(x0, Y(0), x1 - x0, 7); if (it.t === "town") for (let x = x0; x < x1 - 6; x += 12) g.fillRect(x, Y(0) - 8 - (x * 7 % 9), 8, 8 + (x * 7 % 9)); g.strokeStyle = sel ? "#fff" : "transparent"; g.strokeRect(x0, Y(0) - 20, x1 - x0, 28); label(it.t === "lake" ? "Lake" : "Town", (x0 + x1) / 2, Y(0) + 20, "#e8f3ff"); handle(it.x + it.w / 2, 0, { type: "item", i }, 14); } });
  g.fillStyle = "#ffb04d"; g.fillRect(X(0) - 3, Y(0) - 14, 6, 14); label("Pad", X(0), Y(0) + 20, "#ffb04d");
  if (!C.res && S.r) { g.setLineDash([3, 5]); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.3; g.beginPath(); S.r.samples.forEach((s, i) => { if (i % 3) return; i ? g.lineTo(X(s.x / 1000), Y(s.h)) : g.moveTo(X(s.x / 1000), Y(s.h)); }); g.stroke(); g.setLineDash([]); }
}

/* =================================================================== RUN + PLAYBACK */
function traceColor(q, res) { if (C.kind === "sub") return `hsl(${190 - clamp(q.z / (S.r.crush || 1), 0, 1) * 190},90%,62%)`; const vmax = res._vmax || (res._vmax = Math.max(...res.path.map(p => p.v || 0), 1)); return `hsl(${lerp(0, 190, clamp((q.v || 0) / vmax, 0, 1))},90%,60%)`; }
function drawRun() {
  const res = C.res; if (!res) return; const tNow = C.play ? C.play.t : res.T || 0, P = res.path; if (!P.length) return;
  g.lineWidth = 3; g.lineCap = "round"; let last = P[0];
  for (let i = 1; i < P.length; i++) { const q = P[i]; if (q.t > tNow) break; g.strokeStyle = traceColor(q, res); g.beginPath(); g.moveTo(X(last.x), Y(last.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke(); last = q; }
  // interpolate current position
  let j = P.findIndex(q => q.t > tNow); const a = j <= 0 ? P[P.length - 1] : P[j - 1], b = j <= 0 ? a : P[j], f = b.t > a.t ? (tNow - a.t) / (b.t - a.t) : 0, cx = lerp(a.x, b.x, f), cy = lerp(a.y, b.y, f);
  const hd = Math.atan2(Y(b.y) - Y(a.y), X(b.x) - X(a.x)); g.save(); g.translate(X(cx), Y(cy)); if (!res.side) g.rotate(hd); g.fillStyle = "#fff"; g.shadowColor = "#58e1ff"; g.shadowBlur = 14;
  g.beginPath(); if (res.side) g.arc(0, 0, 5.5, 0, 7); else { g.moveTo(9, 0); g.lineTo(-6, 5); g.lineTo(-3, 0); g.lineTo(-6, -5); g.closePath(); } g.fill(); g.restore(); g.shadowBlur = 0;
  // events reached
  for (const e of res.events) { if (e.t > tNow + 1e-9) continue; const col = e.lvl === "bad" ? "#ff5d6c" : e.lvl === "warn" ? "#ffd166" : e.lvl === "good" ? "#53f2a6" : "#8cf0ff"; dot(X(e.x), Y(e.y), e.lvl === "bad" ? 7 : 4.5, col, "rgba(0,0,0,.6)", 1.5); if (e.lvl === "bad") { g.strokeStyle = "#ff5d6c"; g.lineWidth = 2.5; const sx = X(e.x), sy = Y(e.y); g.beginPath(); g.moveTo(sx - 9, sy - 9); g.lineTo(sx + 9, sy + 9); g.moveTo(sx + 9, sy - 9); g.lineTo(sx - 9, sy + 9); g.stroke(); } }
  // HUD
  const s = { ...a }; for (const k in b) if (typeof b[k] === "number" && typeof a[k] === "number") s[k] = lerp(a[k], b[k], f);
  const hud = $("coHud"); if (res.hud) { hud.hidden = false; hud.innerHTML = `<div class="cap">${esc(C.play ? "Running" : res.ok ? "Finished" : "Stopped")} · ${esc(fmtT(tNow))}</div>` + res.hud(s).map(r => `<div><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join(""); }
}
function run() {
  if (!S.r) return; const k = C.kind; let res;
  try { res = SIM[k](S.p, S.r, C.D); } catch (e) { console.error(e); toast("That course couldn't run. Try another template."); return; }
  C.res = res; C.lastOK = res.ok; fit(); $("coRes").hidden = true; $("coEv").innerHTML = "";
  const T = Math.max(res.T || 1, 1e-3), dur = clamp(4 + Math.log10(1 + T) * 2.2, 5, 11) * 1000, t0 = performance.now(); let shown = 0;
  C.play = { t: 0 };
  const tick = now => { if (!C.play || C.res !== res) return; const f = clamp((now - t0) / dur, 0, 1); C.play.t = T * (f < 1 ? (1 - Math.pow(1 - f, 1.6)) : 1); draw();
    while (shown < res.events.length && res.events[shown].t <= C.play.t + 1e-9) { evPop(res.events[shown]); shown++; }
    if (f < 1) requestAnimationFrame(tick); else { C.play = null; draw(); showRes(); } };
  requestAnimationFrame(tick);
  if (window.PLUS) PLUS.say(k === "car" ? "Running a lap of your track." : "Running your course.", false);
}
function evPop(e) { const box = $("coEv"); const d = document.createElement("div"); d.className = "evp " + e.lvl; d.textContent = e.text; box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.classList.add("out"), 4200); setTimeout(() => d.remove(), 4800); }
function showRes() {
  const box = $("coRes"), res = C.res; if (!res || C.play) { box.hidden = true; return; }
  const extra3d = C.kind === "car" ? "Drive it in 3D" : C.kind === "sub" ? "Dive to the deepest point in 3D" : `${$("goBtn").textContent} in 3D`;
  box.innerHTML = `<div class="rhead ${res.ok ? "ok" : "no"}"><b>${res.ok ? "✓ " + esc(res.title) : "✗ " + esc(res.failText || "Course failed")}</b></div>
    <div class="rlines">${(res.lines || []).map(l => `<div><span>${esc(l[0])}</span><b>${esc(l[1])}</b></div>`).join("")}</div>
    <p class="rsum">${esc(res.summary || "")}</p>
    <div class="mrow"><button class="hb" id="coReplay">Replay</button>${res.ok ? "" : `<button class="hb go" id="coFix">Fix my design for this course</button>`}<button class="hb" id="coWhy">Explain the physics</button><button class="hb" id="co3d">${esc(extra3d)}</button><button class="hb" id="coHide">Hide</button></div>`;
  box.hidden = false;
  $("coReplay").onclick = run; $("coHide").onclick = () => box.hidden = true;
  const fx = $("coFix"); if (fx) fx.onclick = () => window.PLUS && PLUS.openFixer("course");
  $("coWhy").onclick = () => { const e = res.events.find(x => x.lvl === "bad" && x.lesson) || res.events.find(x => x.lesson); API().showLesson(res.lesson || (e && e.lesson) || "drag", null, false); };
  $("co3d").onclick = () => { if (C.kind === "sub" && res.maxZ) { API().pushHist(); S.p.target = Math.max(50, Math.round(res.path.reduce((m, q) => Math.max(m, q.z || 0), 0))); API().rebuild(); } API().startTest(); };
}
function canScore() { return C.open && !!C.D; }
function score(kind, p, r) { if (kind !== C.kind || !C.D) return 0; let res; try { res = SIM[kind](p, r, C.D); } catch (e) { return -1e6; } if (kind === "car") applyTrack(); return res.ok ? 1000 + (res.perf || 0) * 10 : (res.progress || 0) * 500 + (res.margin || 0); }
function passes() { if (!C.D || !S.r) return false; try { return SIM[C.kind](S.p, S.r, C.D).ok; } catch (e) { return false; } }

/* =================================================================== EDITING */
function hit(sx, sy) { let best = null, bd = 1e9; for (const h of C.handles || []) { const d = hyp(sx - h.sx, sy - h.sy); if (d <= h.r + 4 && d < bd) { bd = d; best = h; } } return best; }
function addItem(t, wx, wy) {
  const T = K[C.kind], def = T.items[t]; const it = Object.assign({ t }, clone(def.def));
  if (T.view === "top") { it.x = wx; it.y = wy; it.r = def.r; }
  else if (C.kind === "plane") { it.x = clamp(wx, 1, C.D.dist - 1); if (t === "mountain") { it.h = clamp(Math.round(wy / 50) * 50, 300, 8800); } if (t === "storm") { it.base = def.def.base; it.top = Math.max(def.def.top, wy + 2000); } if (t === "wind") { it.base = clamp(Math.round(wy / 100) * 100 - 1500, 0, 14000); it.top = it.base + 3000; } }
  else if (C.kind === "sub") { it.x = clamp(wx, 0.5, C.D.dist - 0.5); if (t === "canyon") it.depth = clamp(Math.round(Math.max(wy, seafloor(C.D, it.x) + 300) / 50) * 50, 200, 11000); if (t === "seamount") it.top = clamp(Math.round(Math.min(wy, seafloor(C.D, it.x) - 200) / 10) * 10, 20, 10000); if (t === "current") { it.base = clamp(Math.round(wy / 50) * 50, 0, 9000); it.top = it.base + 400; } }
  else if (C.kind === "rocket") { const H = Math.max(S.r.apogee, 100); it.x = wx; if (t === "wind") { it.base = Math.max(0, Math.round(wy - H * 0.2)); it.top = Math.round(wy + H * 0.2); } if (t === "storm") { it.base = Math.max(100, Math.round(wy - H * 0.3)); it.top = Math.round(wy + H * 0.5); it.w = Math.max(0.5, km(H)); } if (t === "ceiling") it.h = Math.max(50, Math.round(wy / 10) * 10); if (t === "hoop") { it.h = Math.max(20, Math.round(wy)); it.r = Math.max(10, Math.round(H * 0.08)); } if (t === "lake" || t === "town") it.w = Math.max(0.1, km(H) * 0.4); }
  if (t === "hoop" || t === "ceiling") C.D.items = C.D.items.filter(x => x.t !== t);
  C.D.items.push(it); C.sel = { type: "item", i: C.D.items.length - 1 }; C.res = null; save(); applyTrack(); insp(); draw(); showRes(); API().rerender();
}
function nearestSeg(P, wx, wy) { let bi = 0, bd = 1e18; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, u = clamp(((wx - a[0]) * dx + (wy - a[1]) * dy) / L2, 0, 1), d = hyp(a[0] + dx * u - wx, a[1] + dy * u - wy); if (d < bd) { bd = d; bi = i; } } return { i: bi, d: bd }; }
cv.addEventListener("pointerdown", e => {
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, wx = IX(sx), wy = IY(sy), T = K[C.kind];
  if (C.play) return;
  if (C.tool !== "move") {
    if (C.tool === "bend" && C.kind === "car") { const n = nearestSeg(C.D.pts, wx, wy); C.D.pts.splice(n.i + 1, 0, [wx, wy]); C.sel = { type: "pt", i: n.i + 1 }; }
    else if (C.tool === "mark") { C.D.marks.push([wx, wy]); C.sel = { type: "mk", i: C.D.marks.length - 1 }; }
    else if (C.tool === "stop") { C.D.stops.push([wx, wy]); C.sel = { type: "st", i: C.D.stops.length - 1 }; }
    else if (T.items[C.tool]) { addItem(C.tool, wx, wy); setTool("move"); return; }
    C.res = null; save(); applyTrack(); insp(); draw(); showRes(); API().rerender(); setTool("move"); return;
  }
  const h = hit(sx, sy); C.sel = h ? h.ref : null; insp(); draw();
  if (h) { C.drag = { ref: h.ref, sx, sy, wx, wy, orig: clone(C.D) }; cv.setPointerCapture(e.pointerId); }
});
cv.addEventListener("pointermove", e => {
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (!C.drag) { cv.style.cursor = C.tool !== "move" ? "crosshair" : hit(sx, sy) ? "grab" : "default"; return; }
  const dr = C.drag, dx = IX(sx) - dr.wx, dy = IY(sy) - dr.wy, O = dr.orig, D = C.D, ref = dr.ref, k = C.kind;
  if (ref.type === "pt") D.pts[ref.i] = [O.pts[ref.i][0] + dx, O.pts[ref.i][1] + dy];
  if (ref.type === "mk") D.marks[ref.i] = [O.marks[ref.i][0] + dx, O.marks[ref.i][1] + dy];
  if (ref.type === "st") D.stops[ref.i] = [O.stops[ref.i][0] + dx, O.stops[ref.i][1] + dy];
  if (ref.type === "start") D.start = [O.start[0] + dx, O.start[1] + dy];
  if (ref.type === "home") D.home = [O.home[0] + dx, O.home[1] + dy];
  if (ref.type === "dep") D.dep.elev = clamp(Math.round((O.dep.elev + dy) / 10) * 10, 0, 4500);
  if (ref.type === "arr") D.arr.elev = clamp(Math.round((O.arr.elev + dy) / 10) * 10, 0, 4500);
  if (ref.type === "shelf") D.shelf = clamp(Math.round((O.shelf + dy) / 10) * 10, 20, 10000);
  if (ref.type === "item") { const it = D.items[ref.i], o = O.items[ref.i];
    if (K[k].view === "top") { it.x = o.x + dx; it.y = o.y + dy; }
    else {
      if (o.x != null && !(it.t === "wind" || it.t === "current" || it.t === "ceiling")) it.x = k === "rocket" ? o.x + dx : clamp(o.x + dx, 0, D.dist);
      if (it.t === "mountain") it.h = clamp(Math.round((o.h + dy) / 50) * 50, 100, 8800);
      if (it.t === "canyon") it.depth = clamp(Math.round((o.depth + dy) / 50) * 50, 100, 11000);
      if (it.t === "seamount") it.top = clamp(Math.round((o.top + dy) / 10) * 10, 10, 10000);
      if (it.t === "hoop") it.h = Math.max(10, Math.round(o.h + dy));
      if (it.t === "ceiling") it.h = Math.max(20, Math.round(o.h + dy));
      if (it.t === "storm" || it.t === "wind" || it.t === "current") { const nb = Math.max(0, o.base + dy); it.top = o.top + (nb - o.base); it.base = nb; }
    } }
  C.res = null; draw();
});
cv.addEventListener("pointerup", () => { if (!C.drag) return; C.drag = null; save(); applyTrack(); insp(); showRes(); API().rerender(); });
addEventListener("keydown", e => { if (!C.open || !C.sel || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSel(); } });
function removeSel() { const s = C.sel, D = C.D; if (!s) return;
  if (s.type === "item") D.items.splice(s.i, 1);
  else if (s.type === "pt") { if (D.pts.length <= 4) { toast("A track needs at least 4 points."); return; } D.pts.splice(s.i, 1); }
  else if (s.type === "mk") { if (D.marks.length <= 1) { toast("Keep at least one buoy."); return; } D.marks.splice(s.i, 1); }
  else if (s.type === "st") { if (D.stops.length <= 1) { toast("Keep at least one drop point."); return; } D.stops.splice(s.i, 1); }
  else return;
  C.sel = null; C.res = null; save(); applyTrack(); insp(); draw(); showRes(); API().rerender(); }
function insp() {
  const box = $("coInsp"), s = C.sel, D = C.D; if (!s) { box.hidden = true; return; }
  let title = "", props = [], obj = null, removable = true;
  if (s.type === "item") { obj = D.items[s.i]; const def = K[C.kind].items[obj.t]; title = def.l; props = def.props.slice(); if (C.kind === "rocket" && (obj.t === "lake" || obj.t === "town" || obj.t === "hoop" || obj.t === "storm")) props.unshift(["x", "Downrange", -30, 60, 0.05, "km"]); if ((C.kind === "plane" || C.kind === "sub") && obj.x != null && !(obj.t === "wind" || obj.t === "current")) props.unshift(["x", "Distance along route", 0, D.dist, 0.5, "km"]); }
  else if (s.type === "dep" || s.type === "arr") { obj = D[s.type]; title = s.type === "dep" ? "Departure airport" : "Arrival airport"; props = [["elev", "Elevation", 0, 4500, 10, "m"], ["rw", "Runway length", 200, 5000, 50, "m"]]; removable = false; }
  else if (s.type === "shelf") { obj = D; title = "Seafloor"; props = [["shelf", "Normal seafloor depth", 20, 10000, 10, "m"], ["dist", "Route length", 5, 200, 1, "km"], ["clear", "Height above the seafloor", 5, 500, 5, "m"]]; removable = false; }
  else { title = { pt: "Track point", mk: `Buoy ${s.i + 1}`, st: `Drop point ${s.i + 1}`, start: "Start", home: "Home pad" }[s.type]; removable = /pt|mk|st/.test(s.type); }
  if (C.kind === "plane" && !props.find(p => p[0] === "dist") && (s.type === "dep" || s.type === "arr")) props.push(["dist", "Route length", 20, 9000, 10, "km", D]);
  box.innerHTML = `<div class="cap">${esc(title)}</div>` + props.map((pp, i) => { const o = pp[6] || obj, v = o[pp[0]]; return `<label class="ip"><span>${esc(pp[1])}</span><b id="ipv${i}">${esc(fmtP(v, pp))}</b><input type="range" min="${pp[2]}" max="${pp[3]}" step="${pp[4]}" value="${v}" data-i="${i}"></label>`; }).join("") + (removable ? `<button class="hb sm" id="ipDel">Remove</button>` : "");
  box.hidden = false;
  box.querySelectorAll("input").forEach(inp => inp.oninput = () => { const pp = props[+inp.dataset.i], o = pp[6] || obj; o[pp[0]] = +inp.value; if (C.kind === "plane" && pp[0] === "dist") D.items.forEach(it => { if (it.x != null) it.x = Math.min(it.x, D.dist); }); $("ipv" + inp.dataset.i).textContent = fmtP(+inp.value, pp); C.res = null; applyTrack(); fit(); draw(); });
  box.querySelectorAll("input").forEach(inp => inp.onchange = () => { save(); showRes(); API().rerender(); });
  const del = $("ipDel"); if (del) del.onclick = removeSel;
}
function fmtP(v, pp) { const u = pp[5]; if (u === "m" && v >= 1000) return `${nf(v / 1000, 2)} km`; if (u === "×") return `${nf(v * 100)}%`; if (u === "°") return `${nf(v)}°`; return `${nf(v, pp[4] < 1 ? (pp[4] < 0.1 ? 2 : 1) : 0)} ${u}`; }
$("coRun").onclick = run;
$("coClear").onclick = () => { C.D.items = []; C.sel = null; C.res = null; save(); applyTrack(); insp(); fit(); draw(); showRes(); API().rerender(); toast("Cleared the obstacles"); };
new ResizeObserver(() => { if (C.open) { fit(); draw(); } }).observe(cv);

/* =================================================================== OPEN / CLOSE / COMMANDS */
function open() { C.open = true; if (innerWidth < 860) { window.PLUS && PLUS.topH && PLUS.topH(); scrollTo(0, 0); } if (C.kind !== S.kind || !C.D) loadKind(S.kind); else { applyTrack(); } requestAnimationFrame(() => { fit(); draw(); }); API().rerender(); if (!store.get("liftoff-course-seen", false)) { store.set("liftoff-course-seen", true); toast("Pick a ready-made course, or add your own obstacles with the tools above the map. Then press Run.", 5200); } }
function close(keep) { C.open = !!keep && C.open; if (!keep) { C.open = false; C.play = null; if (C.kind === "car") { A.setTrack(null); API().rerender(); } } }
function afterTest() { if (S.mode === "course") { C.open = true; applyTrack(); fit(); draw(); } }
const onKind = () => { if (C.open && S.kind !== C.kind) { if (C.kind === "car") A.setTrack(null); loadKind(S.kind); } };
setInterval(onKind, 400);
function command(t) {
  if (/\b(course|track|terrain|sea ?floor|flight path|route)\b/.test(t) && S.mode !== "course") { API().setMode("course"); return "Opening the course builder."; }
  if (/\b(run|start|go|test|drive|fly|dive)\b.*\b(course|track|route|it)\b|\brun (it|the course)\b/.test(t) && S.mode === "course") { run(); return null; }
  const T = K[C.kind]; if (!T) return null;
  for (const [i, tp] of T.templates.entries()) if (t.includes(tp[0].toLowerCase()) || (/mariana|trench/.test(t) && tp[0] === "Mariana Trench") || (/titanic/.test(t) && tp[0] === "Titanic wreck")) { C.D = tp[1](S.r); C.sel = null; C.res = null; save(); applyTrack(); fit(); insp(); draw(); showRes(); return `Loaded ${tp[0]}.`; }
  const words = { canyon: /canyon|trench/, seamount: /seamount|underwater mountain/, wreck: /wreck|ship/, vent: /vent/, current: /current/, mountain: /mountain/, storm: /storm|thunder/, wind: /wind|jet stream/, thermal: /thermal/, wet: /wet|rain/, oil: /oil/, bank: /bank/, rough: /rough|waves/, shallow: /shallow|sand ?bar/, rocks: /rock/, building: /building|tower/, nofly: /no.?fly|airport/, ceiling: /limit|ceiling/, hoop: /hoop|ring/, lake: /lake/, town: /town|city/ };
  if (/\b(add|put|place|build|make)\b/.test(t)) for (const [id, re] of Object.entries(words)) if (T.items[id] && re.test(t)) {
    const b = C.vp ? C.vp.b : { x0: 0, x1: 1, y0: 0, y1: 1 }, mx = (b.x0 + b.x1) / 2 + (Math.random() - 0.5) * (b.x1 - b.x0) * 0.3, my = (b.y0 + b.y1) / 2 + (Math.random() - 0.5) * Math.abs(b.y1 - b.y0) * 0.2;
    addItem(id, mx, id === "canyon" && C.kind === "sub" ? (t.match(/(\d[\d,.]*)\s*(m|km)?/) ? (() => { const m = t.match(/(\d[\d,.]*)\s*(m|km)?/); return +m[1].replace(/,/g, "") * (m[2] === "km" ? 1000 : 1); })() : 8000) : my);
    return `Added a ${T.items[id].l.toLowerCase()}. Drag it where you want it.`; }
  if (/\bclear\b/.test(t)) { $("coClear").click(); return "Cleared the course."; }
  return null;
}

window.COURSE = { open, close, afterTest, run, score, canScore, passes, command, get state() { return C; }, SIM, K };
})();
