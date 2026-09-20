/* LiftOff Aero Studio: the learning layer for complete beginners.
   Everyday comparisons, simple-view tiles, predict-then-try experiments, the change coach,
   guided missions with unlockable concepts, and a plain-language test narrator. */
(() => {
"use strict";
const A = window.Aero, $ = id => document.getElementById(id);
const nf = A.nf, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

/* ================= everyday comparisons ================= */
const times = (n, what) => n < 1.3 ? `about as ${what}` : `≈ ${n < 10 ? nf(n, n < 3 ? 1 : 0) : nf(n)}×`;
function heightCmp(m) {
  if (m >= 400000) return "above the Space Station's orbit";
  if (m >= 100000) return "past the edge of space (100 km)";
  if (m >= 11000) return "above where airliners fly";
  if (m >= 8849) return "higher than Mount Everest";
  const R = [["a person", 1.8], ["a house", 8], ["the Statue of Liberty", 93], ["the Eiffel Tower", 330], ["the tallest building on Earth", 828], ["Mount Everest", 8849]];
  if (m < 1.8) return "lower than a person is tall";
  let best = R[0]; for (const r of R) if (m >= r[1] * 0.9) best = r;
  const n = m / best[1]; return n < 1.3 ? `about as high as ${best[0]}` : `≈ ${nf(n, n < 3 ? 1 : 0)}× ${best[0]}`;
}
function depthCmp(m) {
  if (m >= 10900) return "the bottom of the deepest ocean";
  if (m >= 3800) return "deeper than the Titanic wreck";
  if (m >= 1000) return "where no sunlight ever reaches";
  if (m >= 330) return `≈ ${nf(m / 330, 1)} Eiffel Towers straight down`;
  if (m >= 40) return "deeper than scuba divers can go";
  return "about as deep as a diving pool";
}
function speedCmp(ms) {
  if (ms >= 7000) return "orbital speed: New York to London in 12 minutes";
  if (ms >= 343 * 1.1) return `${nf(ms / 343, 1)}× the speed of sound`;
  if (ms >= 320) return "about the speed of sound";
  const R = [["walking", 1.4], ["a bicycle", 7], ["the fastest human sprinter", 12], ["a car on the highway", 30], ["a Formula 1 car", 95], ["a cruising airliner", 250]];
  if (ms < 1.4) return "slower than walking";
  let best = R[0]; for (const r of R) if (ms >= r[1] * 0.85) best = r;
  const n = ms / best[1]; return n < 1.3 ? `about as fast as ${best[0]}` : `faster than ${best[0]}`;
}
function massCmp(kg) {
  const R = [["an apple", 0.2], ["a basketball", 0.6], ["a bowling ball", 7], ["a person", 70], ["a car", 1500], ["an elephant", 6000], ["a school bus", 12000], ["a blue whale", 150000], ["a jumbo jet", 400000]];
  if (kg < 0.2) return "lighter than an apple";
  let best = R[0]; for (const r of R) if (kg >= r[1] * 0.8) best = r;
  const n = kg / best[1]; return n < 1.3 ? `about the weight of ${best[0]}` : `≈ ${nf(n, n < 3 ? 1 : 0)}× ${best[0]}`;
}
function distCmp(m) {
  const R = [["a football field", 100], ["a marathon", 42195], ["New York to Boston", 300000], ["New York to Chicago", 1150000], ["across the USA", 4500000], ["New York to London", 5570000]];
  if (m < 100) return "shorter than a football field";
  let best = R[0]; for (const r of R) if (m >= r[1] * 0.85) best = r;
  const n = m / best[1]; return n < 1.3 ? `about ${best[0]}` : best[1] >= 300000 ? `farther than ${best[0]}` : `≈ ${nf(n, n < 3 ? 1 : 0)}× ${best[0]}`;
}
function timeCmp(s) {
  if (s < 90) return `${nf(s)} seconds`;
  if (s < 300) return "about as long as a song";
  if (s < 1800) return "about as long as a TV episode";
  if (s < 10800) return "about as long as a movie";
  return "longer than a movie marathon";
}
function gCmp(g) { return g < 1.3 ? "like standing still" : g < 3 ? "like a roller coaster" : g < 6 ? "like a fighter jet turn" : g < 10 ? "a fighter pilot's limit" : "would knock a person out"; }
const up = (a, b) => b > a;

/* ================= simple-view tiles (plain name + value + comparison) ================= */
function tiles(kind, p, r) {
  const T = [], t = (k, v, u, cmp, n, lesson, tech, lvl) => T.push({ k, v, u, cmp, n, lesson, tech, lvl });
  if (kind === "rocket") {
    const [hv, hu] = A.Dm(r.apogee); t("How high it goes", hv, hu, heightCmp(r.apogee), r.apogee, "atmosphere", "apogee");
    t("Fastest speed", nf(r.maxV * 3.6), "km/h", speedCmp(r.maxV), r.maxV, "mach", "max velocity");
    t("Lifting power", nf(r.tw0, 1) + "×", "weight", r.tw0 < 1 ? "too weak to lift off" : r.tw0 < 1.3 ? "barely lifts off" : "pushes up harder than gravity pulls", r.tw0, "thrust", "thrust-to-weight", r.tw0 < 1 ? "bad" : r.tw0 < 1.3 ? "warn" : "good");
    const st = r.g.liquid ? 2 : r.margin0; t("Flies straight?", r.g.liquid ? "Yes" : st < 0.3 ? "No" : st < 1 ? "Wobbly" : "Yes", "", r.g.liquid ? "engines steer it" : st < 0.3 ? "it will tumble" : st < 1 ? "fins are a bit small" : "fins keep it pointed", st, "stability", "stability margin", st < 0.3 ? "bad" : st < 1 ? "warn" : "good");
  }
  if (kind === "car") {
    t("Top speed", nf(r.vtop * 3.6), "km/h", speedCmp(r.vtop), r.vtop, "drag", "top speed");
    t("0 to 100 km/h", nf(r.t100, 1), "s", r.t100 < 3 ? "faster than almost any car" : r.t100 < 5 ? "sports-car quick" : "normal-car quick", -r.t100, "thrust", "acceleration");
    t("Cornering grip", nf(r.lat200, 1) + "×", "gravity", gCmp(r.lat200), r.lat200, "downforce", "lateral g at 200 km/h");
    t("Air pushing it down", nf(Math.max(0, r.df200)), "kg", r.df200 > 20 ? `at 200 km/h, like ${massCmp(r.df200).replace(/^≈ |^about the weight of /, "")} on the roof` : "none: it gets lighter as it speeds up", r.df200, "downforce", "downforce at 200 km/h");
  }
  if (kind === "plane") {
    if (p.engine === "glider") { const g = r.glide ? r.glide.dist : 0; t("How far it glides", nf(g / 1000, 1), "km", distCmp(g), g, "ld", "glide distance"); t("Glide ratio", nf(r.LDmax, 0) + " : 1", "", `goes ${nf(r.LDmax, 0)} m forward for every 1 m down`, r.LDmax, "ld", "L/D"); }
    else { t("Cruising speed", r.vCr ? nf(r.vCr * 3.6) : "can't", r.vCr ? "km/h" : "fly", r.vCr ? speedCmp(r.vCr) : "can't cruise", r.vCr || 0, "drag", "cruise speed"); t("How far it can fly", r.range ? nf(r.range / 1000) : "0", "km", r.range ? distCmp(r.range) : "it can't stay in the air", r.range || 0, "breguet", "range"); }
    t("Highest it can fly", r.svc != null ? A.Dm(r.svc)[0] : "—", r.svc != null ? A.Dm(r.svc)[1] : "", r.svc != null ? heightCmp(r.svc) : "no engine", r.svc || 0, "atmosphere", "service ceiling");
    const vsl = isFinite(r.vsLand) ? r.vsLand : r.vs0; t("Slowest before it falls", isFinite(vsl) ? nf(vsl * 3.6) : "—", "km/h", isFinite(vsl) ? (p.flaps ? "with flaps down: flaps let it fly slower" : "below this the wing can't hold it up") : "no air to fly in", -(isFinite(vsl) ? vsl : 1e4), "stall", "stall speed");
  }
  if (kind === "drone") {
    t("Flight time", nf(r.tHover / 60, 1), "min", r.tHover > 0 ? timeCmp(r.tHover) : "can't hover", r.tHover, "rotor", "hover endurance", r.canHover ? "" : "bad");
    t("Lifting power", nf(r.TW, 1) + "×", "weight", r.TW < 1.02 ? "too weak to take off" : r.TW < 2 ? "can lift off, but sluggish" : "zippy and agile", r.TW, "thrust", "thrust-to-weight", r.TW < 1.02 ? "bad" : r.TW < 2 ? "warn" : "good");
    t("Top speed", nf(r.vmax * 3.6), "km/h", speedCmp(r.vmax), r.vmax, "drag", "max speed");
    t("Can carry", A.Mk(r.payloadMax).join(" "), "", massCmp(r.payloadMax), r.payloadMax, "thrust", "max payload");
  }
  if (kind === "boat") {
    if (r.noLiquid) { t("Floats?", "No", "", "there's no liquid on this world", 0, "buoyancy", ""); return T; }
    t("Top speed", nf(r.vtop * 3.6), "km/h", `${nf(r.vtop * 1.944, 1)} knots · ${speedCmp(r.vtop)}`, r.vtop, "froude", "top speed");
    const reg = r.rTop.reg; t("How it moves", reg.startsWith("Planing") ? "Skims" : reg.startsWith("Foil") ? "Flies" : reg.includes("hump") || reg.includes("bow") ? "Plows" : "Pushes", "", reg.startsWith("Planing") ? "on top of the water, like a skipping stone" : reg.startsWith("Foil") ? "on underwater wings, hull in the air" : reg.includes("hump") || reg.includes("bow") ? "stuck climbing its own bow wave" : "through the water, like a swimmer", r.rTop.Fn, "planing", "Froude regime");
    t("Hard to tip over?", r.GM <= 0 ? "No" : r.GM < 0.3 ? "Tippy" : "Yes", "", r.GM <= 0 ? "it capsizes" : r.GM < 0.3 ? "a big wave could roll it" : "it rights itself when it rolls", r.GM, "metacentric", "metacentric height GM", r.GM <= 0 ? "bad" : r.GM < 0.3 ? "warn" : "good");
    t("Sits in the water", nf(r.T, 2), "m deep", r.sinks ? "too deep: it sinks" : `${nf(r.freeboard, 1)} m of hull above the water`, -r.T, "buoyancy", "draft", r.sinks ? "bad" : "");
  }
  if (kind === "sub") {
    if (r.noLiquid) { t("Can dive?", "No", "", "there's no ocean on this world", 0, "buoyancy", ""); return T; }
    const [tv, tu] = A.Dm(r.test); t("Deepest safe dive", tv, tu, depthCmp(r.test), r.test, "crush", "test depth");
    const [cv, cu] = A.Dm(r.crush); t("Crushed at", cv, cu, "the hull gives way below this", r.crush, "crush", "crush depth");
    const atm = r.pT / 101325; t("Water squeeze at target", nf(atm), "× air pressure", `like ${massCmp(r.thumb).replace(/^≈ |^about the weight of /, "")} on your thumbnail`, atm, "pressure", "pressure at target");
    t("Floats back up?", r.canSurface ? "Yes" : "No", "", r.canSurface ? "blow the tanks and it rises" : "too heavy: it can never surface", r.canSurface ? 1 : 0, "buoyancy", "buoyancy", r.canSurface ? "good" : "bad");
  }
  return T;
}

/* ================= predict-then-try experiments ================= */
const X = {
  rocket: [
    { l: "Give it a bigger motor", q: "higher", do: p => { if (p.prop === "liquid") p.nEng = Math.min(33, p.nEng + 2); else { const k = Object.keys(A.MOTORS), i = k.indexOf(p.motor); p.motor = k[Math.min(k.length - 1, i + 1)]; } }, lesson: "thrust" },
    { l: "Build it from balsa wood", q: "higher", do: p => { p.mat = "balsa"; }, lesson: "materials", skip: p => p.mat === "balsa" },
    { l: "Shrink the fins a lot", q: "higher", do: p => { p.span = Math.max(0.3, p.span * 0.45); }, lesson: "stability", skip: p => p.prop === "liquid" || !p.fins },
    { l: "Launch it from a balloon, 25 km up", q: "higher", do: p => { p.alt0 = 25000; }, lesson: "atmosphere", skip: p => p.alt0 >= 20000 },
    { l: "Launch it on Mars", q: "higher", do: p => { p.planet = "mars"; }, lesson: "planets", skip: p => p.planet === "mars" },
    { l: "Give it a flat, blunt nose", q: "higher", do: p => { p.nose = "blunt"; }, lesson: "drag", skip: p => p.nose === "blunt" },
    { l: "Double the payload it carries", q: "higher", do: p => { p.payload *= 2; }, lesson: "rocketeq" }
  ],
  car: [
    { l: "Remove all the wings", q: "faster", metric: 0, do: p => { p.wing = "none"; p.fwing = false; }, lesson: "downforce", skip: p => p.wing === "none" && !p.fwing },
    { l: "Tilt the rear wing way up (20°)", q: "more grip", metric: 2, do: p => { if (p.wing === "none") p.wing = "single"; p.wingAng = 20; }, lesson: "stall" },
    { l: "Double the engine power", q: "faster", metric: 0, do: p => { p.power = Math.min(1500, p.power * 2); }, lesson: "drag" },
    { l: "Race it on the Moon", q: "more grip", metric: 2, do: p => { p.planet = "moon"; }, lesson: "planets", skip: p => p.planet === "moon" },
    { l: "Make it tall and boxy", q: "faster", metric: 0, do: p => { p.nose = "blunt"; p.H = 1.5; }, lesson: "drag" },
    { l: "Lower it close to the road", q: "more grip", metric: 2, do: p => { p.ride = 30; p.diff = Math.max(p.diff, 10); }, lesson: "groundeffect", skip: p => p.ride <= 35 }
  ],
  plane: [
    { l: "Make the wings much longer", q: "farther", metric: 1, do: p => { p.span = Math.min(80, p.span * 1.6); }, lesson: "induced" },
    { l: "Put the flaps down", q: "slower stall", metric: 3, do: p => { p.flaps = 2; }, lesson: "stall", skip: p => p.flaps >= 2 },
    { l: "Fly it on Mars", q: "farther", metric: 1, do: p => { p.planet = "mars"; }, lesson: "planets", skip: p => p.planet === "mars" },
    { l: "Load it with extra cargo", q: "slower stall", metric: 3, do: p => { p.payload *= 2; }, lesson: "lift" },
    { l: "Sweep the wings back 35°", q: "faster", metric: 0, do: p => { p.sweep = 35; }, lesson: "sweep", skip: p => p.sweep >= 30 || p.engine === "glider" }
  ],
  drone: [
    { l: "Use rotors twice as big", q: "longer", metric: 0, do: p => { p.prop = Math.min(2, p.prop * 2); }, lesson: "rotor" },
    { l: "Fly it on Mars", q: "longer", metric: 0, do: p => { p.planet = "mars"; }, lesson: "planets", skip: p => p.planet === "mars" },
    { l: "Double the battery", q: "longer", metric: 0, do: p => { p.battery = Math.min(5000, p.battery * 2); }, lesson: "breguet" },
    { l: "Carry a 1 kg package", q: "longer", metric: 0, do: p => { p.payload += 1; }, lesson: "thrust" },
    { l: "Fly it on Titan", q: "longer", metric: 0, do: p => { p.planet = "titan"; }, lesson: "planets", skip: p => p.planet === "titan" }
  ],
  boat: [
    { l: "Switch to a flat planing hull", q: "faster", metric: 0, do: p => { p.hull = "planing"; }, lesson: "planing", skip: p => p.hull === "planing" },
    { l: "Double the engine power", q: "faster", metric: 0, do: p => { p.power = Math.min(100000, p.power * 2); }, lesson: "froude" },
    { l: "Stack the cargo 4 m high", q: "more stable", metric: 2, do: p => { p.stack = 4; p.payload = Math.max(p.payload, 1500); }, lesson: "metacentric" },
    { l: "Make it half as wide", q: "more stable", metric: 2, do: p => { p.B = Math.max(0.5, p.B / 2); }, lesson: "metacentric" },
    { l: "Make it twice as long", q: "faster", metric: 0, do: p => { p.L = Math.min(400, p.L * 2); }, lesson: "froude" }
  ],
  sub: [
    { l: "Make the hull a sphere", q: "deeper", metric: 0, do: p => { p.shape = "sphere"; }, lesson: "crush", skip: p => p.shape === "sphere" },
    { l: "Make the hull twice as thick", q: "deeper", metric: 0, do: p => { p.wall = Math.min(200, p.wall * 2); }, lesson: "crush" },
    { l: "Build it from titanium", q: "deeper", metric: 0, do: p => { p.mat = "titanium"; }, lesson: "materials", skip: p => p.mat === "titanium" },
    { l: "Build it from clear acrylic", q: "deeper", metric: 0, do: p => { p.mat = "acrylic"; }, lesson: "materials", skip: p => p.mat === "acrylic" },
    { l: "Make it twice as wide", q: "deeper", metric: 0, do: p => { p.D = Math.min(15, p.D * 2); }, lesson: "crush" }
  ]
};
const PAIR = { higher: ["Higher", "Lower"], faster: ["Faster", "Slower"], farther: ["Farther", "Shorter"], longer: ["Longer", "Shorter"], deeper: ["Deeper", "Shallower"], "more grip": ["More grip", "Less grip"], "more stable": ["More stable", "Less stable"], "slower stall": ["Slower (good)", "Faster"] };
function experiments(kind, p) { return (X[kind] || []).filter(e => !(e.skip && e.skip(p))).slice(0, 4); }

/* ================= change coach ================= */
function coach(label, before, after, tried) {
  const lead = tried ? `You tried “${label}”` : `You changed ${label.toLowerCase()}`;
  if (!before || !after) return "";
  const parts = [];
  for (let i = 0; i < after.length; i++) {
    const a = before[i], b = after[i]; if (!a || !b || a.k !== b.k || !isFinite(a.n) || !isFinite(b.n)) continue;
    const rel = Math.abs(b.n - a.n) / Math.max(Math.abs(a.n), 1e-9);
    if (a.v !== b.v) parts.push({ rel, t: `${b.k.toLowerCase()} ${b.n > a.n ? "▲" : "▼"} ${a.v}${a.u && a.u !== "weight" ? " " + a.u : ""} → ${b.v}${b.u && b.u !== "weight" ? " " + b.u : ""}` });
  }
  parts.sort((x, y) => y.rel - x.rel);
  if (!parts.length) return `${lead}. The results barely moved: this part doesn't matter much for this design.`;
  return `${lead}: ` + parts.slice(0, 2).map(p => p.t).join(", ") + ".";
}

/* ================= narrator (plain captions during tests) ================= */
const NARR = {
  "Liftoff": "Liftoff! The motor pushes up harder than gravity pulls down, so the rocket rises.",
  "Mach 1": "Faster than sound! The air can't get out of the way in time, so it piles up into a shock wave: a sonic boom.",
  "Burnout": "Out of fuel. It keeps coasting upward, slowing down as gravity and the air pull back.",
  "Apogee": "The highest point. For a moment it stops going up, then gravity takes over.",
  "Parachute": "Parachute out! Its big surface catches the air and slows the fall to a gentle landing.",
  "Drogue chute": "A small parachute opens first, so a big one isn't ripped apart at high speed.",
  "Main chute": "Main parachute open: now it drifts down gently.",
  "Kármán line · space": "Space! Above 100 km the air is so thin that wings can't work anymore.",
  "Stage 1 burnout": "The first stage is out of fuel.",
  "Stage separation": "The empty bottom half drops away, so the rocket stops carrying dead weight.",
  "Stage 2 ignition": "The upper stage lights up. It's much lighter now, so it speeds up fast.",
  "Orbit achieved": "Orbit! It's moving sideways so fast that it keeps falling around the Earth instead of into it.",
  "Touchdown": "Touchdown. Safe landing.",
  "Impact": "It hit the ground hard. A parachute would have saved it.",
  "Structural failure (heat)": "It got so hot from squeezing the air that the material gave way.",
  "Structural failure (buckling)": "The forces crushed the body like a soda can. It needs thicker walls or stronger material.",
  "Escape velocity!": "Escape velocity: it's going so fast it will never come back down.",
  "Takeoff roll": "Speeding down the runway. The wings need enough speed before they can lift the plane.",
  "Rotate · liftoff": "Fast enough! The wings now push up more than the plane weighs, so it lifts off.",
  "Climbing": "Climbing. The engine's extra power turns into height.",
  "Cruise": "Cruising. Lift equals weight and thrust equals drag, so everything is balanced.",
  "Gliding": "No engine: it trades height for distance, sliding down a gentle slope of air.",
  "Climb": "The rotors throw air down, so the drone goes up.",
  "Hover": "Hovering: the rotors push down exactly as hard as the drone weighs.",
  "Full-speed sprint": "It tilts forward so part of the rotor push drives it ahead.",
  "Braking": "It tilts back to push against its own motion.",
  "Return": "Flying back to the landing pad.",
  "Landing": "Easing off the power to settle down.",
  "Can't generate enough lift": "The rotors can't push down as hard as the drone weighs, so it can't take off.",
  "Displacement": "Pushing through the water, making waves as it goes.",
  "Fighting its bow wave": "It's trying to climb its own bow wave. Most of the engine power is now just making waves.",
  "Semi-planing (hump)": "The hardest part: climbing over its own bow wave.",
  "Planing": "On plane! It's skimming across the top of the water, so drag drops.",
  "Foiling": "The underwater wings lift the hull right out of the water.",
  "Foiling (cavitating)": "So fast that the water boils off the foils. That's cavitation, and drag spikes.",
  "Sunlight zone": "The sunlight zone: plenty of light and life.",
  "Twilight zone": "The twilight zone: sunlight is fading into deep blue.",
  "Midnight zone": "The midnight zone: total darkness, except for glowing animals.",
  "Abyssal zone": "The abyss: near freezing, crushing pressure.",
  "Hadal zone": "The hadal zone: the deepest trenches on Earth."
};
const INTRO = {
  rocket: "Watch the speed and the air. As the rocket climbs, the air thins and the sky darkens.",
  car: "Watch the speed trace: the car brakes before corners because tires can only grip so hard. Downforce lets it corner faster.",
  plane: "A plane needs speed before its wings can lift it. Watch the airspeed climb on the runway.",
  drone: "A drone flies by throwing air downward. Watch the battery: hovering costs energy every second.",
  boat: "Watch the speed and how the boat moves: pushing through the water, climbing its bow wave, then skimming on top.",
  sub: "The deeper it goes, the harder the water squeezes. Watch the pressure and the hull stress."
};
let narrT = 0;
function narrate(label) {
  const t = NARR[label] || INTRO[label]; const el = $("narr"); if (!t || !el) return;
  el.textContent = t; el.classList.add("on"); clearTimeout(narrT); narrT = setTimeout(() => el.classList.remove("on"), 6500);
}

/* ================= plain report summary ================= */
function summary(kind, p, r, rep) {
  const T = tiles(kind, p, r);
  const lines = T.slice(0, 2).map(t => `<b>${esc(t.k)}:</b> ${esc(t.v)} ${esc(t.u || "")} <span style="color:var(--muted)">(${esc(t.cmp)})</span>`);
  return lines.join("<br>");
}

/* ================= missions ================= */
const M = [
  { id: "r1", kind: "rocket", preset: "classroom", t: "Liftoff", goal: "Launch the classroom rocket and watch it fly.", hint: "Press the orange Launch button at the bottom right.", test: true, check: (p, r) => r.landed && !r.failure, lesson: "thrust", learned: "A rocket rises when its motor pushes harder than its weight." },
  { id: "r2", kind: "rocket", preset: "classroom", t: "Higher!", goal: "Make the classroom rocket fly higher than 350 m.", hint: "Try a bigger motor (Motor class, under Propulsion). Each letter is twice as powerful.", focus: "motor", check: (p, r) => r.apogee > 350, lesson: "rocketeq", learned: "More push, or less weight, means more height." },
  { id: "r3", kind: "rocket", preset: "classroom", t: "Make it tumble", goal: "Break it on purpose: make the rocket unstable.", hint: "Shrink the Fin span slider until “Flies straight?” says No.", focus: "span", check: (p, r) => !r.g.liquid && r.margin0 < 0.3, lesson: "stability", learned: "Fins keep the air's push point behind the balance point. Too small, and it tumbles." },
  { id: "r4", kind: "rocket", t: "Fix it", goal: "Now make it fly straight again.", hint: "Bring the fins back: raise Fin span, or make the root chord longer.", focus: "span", keep: true, check: (p, r) => !r.g.liquid && r.margin0 >= 1, lesson: "stability", learned: "Engineers aim for the push point 1–2 body widths behind the balance point." },
  { id: "r5", kind: "rocket", preset: "space", start: { alt0: 0 }, t: "Touch space", goal: "Get this rocket past 100 km: the edge of space.", hint: "From the ground, thick air slows it down. Raise the Launch altitude (under Mission) to launch from a balloon.", focus: "alt0", check: (p, r) => r.karman, lesson: "atmosphere", learned: "Most drag happens in the thick air near the ground. Start higher and you go much farther." },
  { id: "r6", kind: "rocket", preset: "orbital", t: "Reach orbit", goal: "Launch the two-stage rocket and put it into orbit.", hint: "Press Launch. Watch for stage separation, then the upper stage steering sideways.", test: true, check: (p, r) => r.orbit && !r.orbit.escape, lesson: "orbit", learned: "Orbit isn't about height: it's about going sideways fast enough to keep missing the ground." },
  { id: "c1", kind: "car", preset: "road", t: "Glue it to the road", goal: "Give the sports car more than 300 kg of downforce at 200 km/h.", hint: "Add a rear wing, turn on the front wing, lower the car and raise the diffuser angle.", focus: "wing", check: (p, r) => r.df200 > 300, lesson: "downforce", learned: "Wings on race cars work upside down: they push the car into the road so it corners faster." },
  { id: "c2", kind: "car", preset: "gt", t: "Stall the wing", goal: "Tilt the rear wing so far that it stops working.", hint: "Drag Wing angle up until the verdict says the wing stalled. Try the Wind tunnel to see it!", focus: "wingAng", check: (p, r) => r.aero.wingStall, lesson: "stall", learned: "Tilt a wing too far and the air breaks away from it: a stall. Lift (or downforce) collapses." },
  { id: "p1", kind: "plane", preset: "trainer", t: "Short takeoff", goal: "Get the trainer off the ground in under 120 m of runway.", hint: "Put the flaps down (Wing → Flaps) or give it a bigger wing.", focus: "flaps", check: (p, r) => r.canTO && r.toDist < 120, lesson: "lift", learned: "Flaps let a wing make more lift at low speed, so the plane can take off sooner." },
  { id: "p2", kind: "plane", preset: "glider", t: "Glide 60 km", goal: "Make the sailplane glide more than 60 km with no engine.", hint: "Make the wings longer (Wingspan). Long, skinny wings waste less energy.", focus: "span", check: (p, r) => r.glide && r.glide.dist > 60000 && r.wingMargin >= 1, lesson: "induced", learned: "Long, skinny wings waste less energy at the tips, which is why gliders and albatrosses have them." },
  { id: "d1", kind: "drone", preset: "photo", start: { planet: "mars" }, t: "Fly on Mars", goal: "This camera drone can't lift off on Mars. Make it fly.", hint: "Mars has 60× less air. Make the rotors bigger (Rotor diameter).", focus: "prop", check: (p, r) => p.planet === "mars" && r.canHover, lesson: "planets", learned: "Less air means each rotor has less to push against, so it needs to be much bigger." },
  { id: "b1", kind: "boat", preset: "trawler", t: "Get on plane", goal: "Make the cruiser skim across the top of the water.", hint: "Switch to a Planing hull, then add engine power.", focus: "hull", check: (p, r) => !r.noLiquid && r.rTop.reg === "Planing", lesson: "planing", learned: "With a flat bottom and enough power, a boat climbs its bow wave and skims instead of plowing." },
  { id: "b2", kind: "boat", preset: "speed", start: { payload: 1500, stack: 1 }, t: "Capsize it", goal: "Make the speedboat roll over.", hint: "Stack the cargo higher (Deck cargo height), or make the beam narrower.", focus: "stack", check: (p, r) => !r.noLiquid && r.capsizes, lesson: "metacentric", learned: "Weight up high makes a boat tippy. Wide and low is stable." },
  { id: "s1", kind: "sub", preset: "research", t: "Crush it", goal: "Send the research sub deeper than its hull can survive.", hint: "Raise the Target depth past its crush depth, then press Dive to watch.", focus: "target", check: (p, r) => !r.noLiquid && p.target > r.crush, lesson: "pressure", learned: "Every 10 m of water adds another atmosphere of squeeze. Eventually the hull gives way." },
  { id: "s2", kind: "sub", preset: "research", start: { target: 10900 }, t: "The deepest ocean", goal: "Design a sub that can safely reach 10.9 km: the Mariana Trench.", hint: "Use a Sphere hull made of titanium with a thick wall, and add buoyancy foam so it can float back up.", focus: "shape", check: (p, r) => !r.noLiquid && r.test >= 10900 && r.canSurface, lesson: "crush", learned: "Spheres spread the squeeze evenly. That's why the deepest subs ever built are balls." }
];
let done = new Set(store.get("liftoff-missions", [])), cur = null, armed = false, simple = store.get("liftoff-simple", true);
function save() { store.set("liftoff-missions", [...done]); }
function progressUI() { const ac = window.ACADEMY ? ACADEMY.progress() : { n: 0, N: 0 }, n = done.size + ac.n, N = M.length + ac.N; $("missBtnN").textContent = `${n}/${N}`; const ring = $("missRing"); if (ring) ring.style.setProperty("--p", (n / N * 100) + "%"); }
function startMission(m) {
  cur = m; armed = false; $("missions").classList.remove("on"); if (window.ACADEMY) ACADEMY.stopCoach();
  const api = window.STUDIO_API, S = window.STUDIO;
  if (!(m.keep && S.kind === m.kind)) { api.loadVehicle(m.kind, m.preset || undefined); if (m.start) { Object.assign(S.p, m.start); api.rebuild(); } }
  api.setMode("build"); renderCard(); focusCtl(m.focus);
  setTimeout(() => check(), 200);
}
function focusCtl(key) {
  document.querySelectorAll(".ctl.pulse").forEach(e => e.classList.remove("pulse")); if (!key) return;
  const c = A.SCHEMA[window.STUDIO.kind].find(x => x.k === key); if (!c) return;
  const el = [...document.querySelectorAll("#controls .ctl")].find(w => w.querySelector(".lab span") && w.querySelector(".lab span").textContent.trim().startsWith(c.l)) || null;
  if (el) { el.classList.add("pulse"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
function renderCard() {
  const box = $("mcard"); if (!cur) { box.classList.remove("on"); return; }
  const i = M.indexOf(cur);
  box.innerHTML = `<button class="x" id="mcX" aria-label="Hide mission">×</button><div class="cap">Mission ${i + 1} of ${M.length} · ${esc(A.VEHICLES[cur.kind].name)}</div><h3>${esc(cur.t)}</h3><p>${esc(cur.goal)}</p><div class="mrow"><button class="hb" id="mcHint">Hint</button><button class="hb" id="mcAll">All missions</button>${cur.test ? "" : `<span class="mstat" id="mcStat">Not yet</span>`}</div><p class="mhint" id="mcHintT" hidden>${esc(cur.hint)}</p>`;
  box.classList.add("on");
  $("mcX").onclick = () => { cur = null; renderCard(); document.querySelectorAll(".ctl.pulse").forEach(e => e.classList.remove("pulse")); };
  $("mcHint").onclick = () => { $("mcHintT").hidden = !$("mcHintT").hidden; focusCtl(cur.focus); };
  $("mcAll").onclick = openList;
}
function check(tested) {
  if (!cur) return; const S = window.STUDIO; if (!S.r || S.kind !== cur.kind) return;
  let ok = false; try { ok = !!cur.check(S.p, S.r, S.rep); } catch (e) { ok = false; }
  if (cur.test && !tested) return;
  if (!ok) { armed = true; return; }
  if (!armed && !cur.test && !cur.keep) return; // already true when it started: wait for the student to act
  complete(cur);
}
function complete(m) {
  done.add(m.id); save(); progressUI(); document.querySelectorAll(".ctl.pulse").forEach(e => e.classList.remove("pulse"));
  const L = A.LESSONS[m.lesson]; const next = M.find(x => !done.has(x.id));
  const w = $("unlock"); w.innerHTML = `<div class="burst"></div><div class="cap" style="color:var(--good)">Mission complete · concept unlocked</div><h2>${esc(L.t)}</h2><p class="big">${esc(m.learned)}</p><p>${esc(L.p)}</p><p class="ana"><b>Think of it like this:</b> ${esc(L.a)}</p><div class="mrow">${next ? `<button class="hb go" id="unNext">Next mission: ${esc(next.t)}</button>` : `<b style="color:var(--good)">You finished every mission!</b>`}<button class="hb" id="unClose">Keep playing</button></div>`;
  w.classList.add("on"); confetti();
  $("unClose").onclick = () => { w.classList.remove("on"); cur = null; renderCard(); };
  if (next) $("unNext").onclick = () => { w.classList.remove("on"); if (document.body.classList.contains("testing")) window.STUDIO_API.exitTest(); startMission(next); };
  cur = null; renderCard();
}
function openList() {
  const box = $("mlist"); const groups = {};
  M.forEach((m, i) => (groups[m.kind] = groups[m.kind] || []).push([m, i]));
  box.innerHTML = Object.entries(groups).map(([k, arr]) => `<div class="mg"><div class="cap">${esc(A.VEHICLES[k].name)}</div>${arr.map(([m, i]) => `<button class="mi ${done.has(m.id) ? "done" : ""}" data-i="${i}"><span class="ck">${done.has(m.id) ? "✓" : i + 1}</span><span><b>${esc(m.t)}</b><small>${esc(m.goal)}</small></span></button>`).join("")}</div>`).join("") +
    `<div class="mg"><div class="cap">Your notebook · ${done.size} concepts</div>${[...new Set(M.filter(m => done.has(m.id)).map(m => m.lesson))].map(k => `<button class="nb" data-l="${k}">${esc(A.LESSONS[k].t)}</button>`).join("") || `<p style="color:var(--muted);font-size:12.5px;margin:4px 0">Complete missions to collect concepts here.</p>`}</div>`;
  box.querySelectorAll(".mi").forEach(b => b.onclick = () => startMission(M[+b.dataset.i]));
  box.querySelectorAll(".nb").forEach(b => b.onclick = () => { $("missions").classList.remove("on"); window.STUDIO_API.showLesson(b.dataset.l); });
  $("missions").classList.add("on"); $("mlist").hidden = false; $("alist").hidden = true;
  document.querySelectorAll("#missions .ltabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.t === "missions")));
}
function confetti() {
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight, P = Array.from({ length: 140 }, () => ({ x: W / 2, y: H * 0.4, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 5, c: ["#58e1ff", "#ff7a3d", "#53f2a6", "#ffd166", "#b18cff"][Math.random() * 5 | 0], r: Math.random() * 6 }));
  let f = 0; (function tick() { x.clearRect(0, 0, W, H); for (const p of P) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += 0.2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); } if (++f < 110) requestAnimationFrame(tick); else c.remove(); })();
}

/* ================= wiring ================= */
$("missBtn").onclick = openList;
$("mlistX").onclick = () => $("missions").classList.remove("on");
function setSimple(v) { simple = v; store.set("liftoff-simple", v); document.body.classList.toggle("simple", v); document.querySelectorAll("#viewSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === (v ? "simple" : "eng")))); window.STUDIO_API && window.STUDIO_API.rerender(); }
document.querySelectorAll("#viewSeg button").forEach(b => b.onclick = () => setSimple(b.dataset.v === "simple"));
document.body.classList.toggle("simple", simple);
progressUI();

window.LEARN = { confetti, progressUI, get current() { return cur; }, hideCard: () => { $("mcard").classList.remove("on"); }, showCard: () => renderCard(), isDone: id => done.has(id), tiles, experiments, coach, narrate, summary, INTRO, PAIR, check, startMission, openList, get simple() { return simple; }, setSimple, M, heightCmp, speedCmp, massCmp, distCmp, depthCmp, timeCmp };
})();
