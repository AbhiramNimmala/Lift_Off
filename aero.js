/* LiftOff aero engine: atmosphere, materials, and physics models for six vehicle classes.
   Pure functions, SI units, no dependencies. Works in the browser (window.Aero) and in Node (require). */
(function (root) {
"use strict";
const G0 = 9.80665, R_AIR = 287.053, P0 = 101325;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

/* ---------------- Worlds ---------------- */
const PLANETS = {
  earth: { name: "Earth", g: 9.80665, R: 6371e3, isa: true, p0: P0,
    liquids: { sea: { name: "Ocean (salt water)", rho: 1025, nu: 1.19e-6, maxDepth: 10935 }, fresh: { name: "Lake (fresh water)", rho: 1000, nu: 1.0e-6, maxDepth: 1642 } },
    blurb: "1 atm, 1 g. The baseline everything is designed for." },
  mars: { name: "Mars", g: 3.721, R: 3389.5e3, rho0: 0.020, H: 11100, T0: 210, lapse: 0.0025, Tmin: 150, gamma: 1.29, Rg: 188.9, mu: 1.1e-5, liquids: {},
    blurb: "Air 60× thinner than Earth's, gravity 38%. Wings and rotors struggle; rockets fly far." },
  titan: { name: "Titan", g: 1.352, R: 2574.7e3, rho0: 5.43, H: 21000, T0: 94, lapse: 0.0012, Tmin: 70, gamma: 1.4, Rg: 296.8, mu: 6.5e-6,
    liquids: { methane: { name: "Kraken Mare (liquid methane)", rho: 660, nu: 3e-7, maxDepth: 300 } },
    blurb: "Air 4× denser than Earth's, gravity 14%. A person could fly with strap-on wings." },
  venus: { name: "Venus", g: 8.87, R: 6051.8e3, rho0: 65, H: 15900, T0: 737, lapse: 0.0077, Tmin: 170, gamma: 1.29, Rg: 188.9, mu: 3.3e-5, liquids: {},
    blurb: "92 bar of hot CO₂ at the surface: like being 900 m underwater, at 464 °C." },
  moon: { name: "Moon", g: 1.62, R: 1737.4e3, rho0: 0, H: 1, T0: 250, lapse: 0, Tmin: 250, gamma: 1.4, Rg: 287, mu: 1e-5, liquids: {},
    blurb: "No air at all: no drag, no lift. Wings and propellers are useless." }
};
const ISA = [[0, 288.15, -0.0065], [11000, 216.65, 0], [20000, 216.65, 0.001], [32000, 228.65, 0.0028], [47000, 270.65, 0], [51000, 270.65, -0.0028], [71000, 214.65, -0.002], [84852, 186.946, 0]];
(function () { let p = P0; for (let i = 0; i < ISA.length; i++) { ISA[i][3] = p; if (i + 1 < ISA.length) { const [hb, Tb, L] = ISA[i], h = ISA[i + 1][0]; p = L ? p * Math.pow((Tb + L * (h - hb)) / Tb, -G0 / (L * R_AIR)) : p * Math.exp(-G0 * (h - hb) / (R_AIR * Tb)); } } })();
for (const k in PLANETS) { const pl = PLANETS[k]; if (!pl.isa) pl.p0 = pl.rho0 * pl.Rg * pl.T0; }

let ISAT = null;
function atm(pl, h) {
  if (typeof pl === "string") pl = PLANETS[pl];
  h = Math.max(-500, h);
  if (pl.isa && ISAT && h >= 0 && h < 150000) { const f = h / 50, i = f | 0, u = f - i, a = ISAT[i], b = ISAT[i + 1];
    return { T: a.T + (b.T - a.T) * u, Td: a.Td + (b.Td - a.Td) * u, p: a.p + (b.p - a.p) * u, rho: a.rho + (b.rho - a.rho) * u, a: a.a + (b.a - a.a) * u, mu: a.mu + (b.mu - a.mu) * u }; }
  if (pl.isa) {
    let i = ISA.length - 1; while (i > 0 && h < ISA[i][0]) i--;
    const [hb, Tb, L, pb] = ISA[i], T = Tb + L * (h - hb);
    const p = L ? pb * Math.pow(T / Tb, -G0 / (L * R_AIR)) : pb * Math.exp(-G0 * (h - hb) / (R_AIR * Tb));
    const rho = p / (R_AIR * T), a = Math.sqrt(1.4 * R_AIR * T), mu = 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4);
    const Td = h > 86000 ? Math.min(1200, 186.9 + (h - 86000) * 0.009) : T;
    return { T, Td, p, rho, a, mu };
  }
  if (!pl.rho0) return { T: pl.T0, Td: pl.T0, p: 0, rho: 0, a: 300, mu: 1e-5 };
  const T = Math.max(pl.Tmin, pl.T0 - pl.lapse * h), rho = pl.rho0 * Math.exp(-h / pl.H), p = rho * pl.Rg * T, a = Math.sqrt(pl.gamma * pl.Rg * T);
  return { T, Td: T, p, rho, a, mu: pl.mu };
}
{ const t = []; for (let i = 0; i <= 3001; i++) t.push(atm(PLANETS.earth, i * 50)); ISAT = t; }
function layer(pl, h) {
  if (typeof pl === "string") pl = PLANETS[pl];
  if (!pl.rho0 && !pl.isa) return "Vacuum";
  if (pl.isa) return h < 12e3 ? "Troposphere" : h < 50e3 ? "Stratosphere" : h < 85e3 ? "Mesosphere" : h < 600e3 ? "Thermosphere" : "Exosphere";
  return h < 100e3 ? "Lower atmosphere" : "Space";
}

/* ---------------- Materials ---------------- */
const MATERIALS = {
  paper:     { name: "Cardboard",         rho: 690,  sy: 20e6,  E: 3e9,   Tmax: 180, color: 0xc19a63, note: "Cheap and light. Weak and burns easily." },
  balsa:     { name: "Balsa wood",        rho: 160,  sy: 12e6,  E: 3.5e9, Tmax: 200, color: 0xe7cf9c, note: "Incredibly light. Crushes under real loads." },
  pla:       { name: "3D-printed PLA",    rho: 1250, sy: 50e6,  E: 3.5e9, Tmax: 60,  color: 0xe9edf2, note: "Easy to make. Softens at 60 °C." },
  hdpe:      { name: "HDPE plastic",      rho: 960,  sy: 26e6,  E: 1.0e9, Tmax: 80,  color: 0xdfe6ee, note: "Floats, doesn't rot. Flexible." },
  acrylic:   { name: "Acrylic (clear)",   rho: 1180, sy: 70e6,  E: 3.2e9, Tmax: 90,  color: 0xbfe8ff, note: "See-through. Used for deep-sea viewing spheres." },
  fiberglass:{ name: "Fiberglass",        rho: 1850, sy: 250e6, E: 20e9,  Tmax: 250, color: 0xe2ead8, note: "Tough and cheap. The workhorse of boats and hobby rockets." },
  aluminum:  { name: "Aluminum 6061",     rho: 2700, sy: 276e6, E: 69e9,  Tmax: 350, color: 0xc9d1da, note: "The classic aerospace metal. Loses strength above ~200 °C." },
  alli:      { name: "Aluminum-lithium",  rho: 2590, sy: 480e6, E: 76e9,  Tmax: 300, color: 0xd8dfe8, note: "Lighter and stronger aluminum used in modern rocket tanks." },
  carbon:    { name: "Carbon fiber",      rho: 1600, sy: 600e6, E: 70e9,  Tmax: 260, color: 0x30353d, note: "Best strength-to-weight here. Resin limits heat." },
  steel:     { name: "Stainless steel",   rho: 7900, sy: 500e6, E: 193e9, Tmax: 800, color: 0xaeb6bf, note: "Heavy but handles heat and cold. Starship-style." },
  hy100:     { name: "HY-100 sub steel",  rho: 7850, sy: 690e6, E: 207e9, Tmax: 600, color: 0x6d757f, note: "High-yield steel made for submarine pressure hulls." },
  titanium:  { name: "Titanium Ti-6Al-4V",rho: 4430, sy: 880e6, E: 114e9, Tmax: 600, color: 0x9aa3ad, note: "Strong, hot-tolerant, corrosion-proof. Expensive." }
};

/* ---------------- Engines ---------------- */
// Hobby / amateur solid motors by NAR letter class (each letter doubles total impulse).
const MOTORS = { A: [2.5, 5, 80], B: [5, 6, 80], C: [10, 8, 80], D: [20, 12, 80], E: [40, 25, 170], F: [70, 40, 180], G: [120, 80, 190], H: [240, 160, 195], I: [500, 300, 200], J: [1000, 500, 205], K: [2000, 1000, 210], L: [4000, 2000, 215], M: [8000, 3500, 220], N: [16000, 6000, 225], O: [32000, 10000, 230], P: [64000, 16000, 235], Q: [128000, 25000, 238], R: [256000, 40000, 240], S: [512000, 60000, 242] };
function motorInfo(k) { const [I, T, isp] = MOTORS[k], mp = I / (isp * G0), frac = isp < 100 ? 0.45 : isp < 205 ? 0.6 : 0.7; return { I, T, isp, burn: I / T, mp, mcase: mp / frac - mp }; }
const PROPELLANTS = { kerolox: { name: "Kerosene + LOX", rho: 1030 }, methalox: { name: "Methane + LOX", rho: 830 }, hydrolox: { name: "Hydrogen + LOX", rho: 360 } };
const ENGINES = {
  k25:   { name: "Kerolox 25 kN · small launcher", Tvac: 25.8e3, ispSL: 311, ispV: 343, mass: 35, prop: "kerolox" },
  k850:  { name: "Kerolox 850 kN · booster", Tvac: 934e3, ispSL: 282, ispV: 311, mass: 470, prop: "kerolox" },
  m2300: { name: "Methalox 2.3 MN · full-flow", Tvac: 2.46e6, ispSL: 327, ispV: 350, mass: 1600, prop: "methalox" },
  h2200: { name: "Hydrolox 2.2 MN · sea level", Tvac: 2.28e6, ispSL: 366, ispV: 452, mass: 3500, prop: "hydrolox" },
  k980v: { name: "Kerolox 980 kN · vacuum", Tvac: 981e3, ispSL: 150, ispV: 348, mass: 550, prop: "kerolox", vac: true },
  h110v: { name: "Hydrolox 110 kN · vacuum", Tvac: 110e3, ispSL: 150, ispV: 465, mass: 300, prop: "hydrolox", vac: true }
};

/* ---------------- Lessons (concept cards) ---------------- */
const LESSONS = {
  drag: { p: "Air pushes back on anything moving through it. The faster you go, the harder it pushes, and it grows fast: go twice as fast and the push is four times stronger. Pointy, smooth shapes slip through; flat, blunt ones get shoved.", a: "Stick your hand out of a car window. Flat hand: it gets pushed back hard. Turn it sideways: it slices through.", t: "Drag", f: "D = ½·ρ·v²·Cd·A", x: "Air pushes back harder the faster you go. Double the speed and drag goes up 4×. Cd is how slippery the shape is; A is the area facing the wind." },
  stability: { p: "There are two special points on your vehicle: the balance point (where its weight is centered, CG) and the push point (where the air pushes on it, CP). If the push point is behind the balance point, the air straightens it out. If it's in front, it flips and tumbles.", a: "A dart flies straight because its heavy tip is in front and its feathers are at the back. Throw it backwards and it spins.", t: "Stability: CP behind CG", f: "margin = (X_cp − X_cg) / d", x: "The center of pressure (CP) is where air pushes on the body. If it sits behind the center of gravity (CG), the vehicle weathercocks nose-first like an arrow. If it's ahead, it tumbles. Aim for 1–2 body diameters." },
  thrust: { p: "To leave the ground, the engine has to push up harder than gravity pulls down. We compare the two: thrust divided by weight. Above 1, it rises. Below 1, it just sits there burning fuel.", a: "Try to lift a suitcase: if you pull with less force than it weighs, it doesn't move, no matter how long you try.", t: "Thrust-to-weight", f: "T/W > 1 to leave the ground", x: "If the engine pushes with less force than the vehicle weighs, nothing happens. Rockets want T/W of 1.3 or more so they clear the tower quickly." },
  rocketeq: { p: "A rocket goes faster by throwing its fuel out the back. The more of the rocket that is fuel (and the less that is metal and cargo), the faster it can end up going. That's why rockets are mostly fuel tanks.", a: "Like trying to run while carrying your own lunch, water and backpack: the less extra weight you carry, the faster you can go.", t: "The rocket equation", f: "Δv = Isp·g₀·ln(m₀ / m_f)", x: "Your speed budget grows only with the log of the mass ratio. That's why rockets are mostly fuel and why every gram of structure hurts." },
  staging: { p: "When a fuel tank is empty, it's just dead weight. Real rockets drop their empty bottom half so the top half is much lighter and can go much faster.", a: "Like dropping empty water bottles during a hike so your backpack gets lighter.", t: "Staging", f: "Δv_total = Δv₁ + Δv₂", x: "Dropping empty tanks and engines mid-flight means the upper stage doesn't carry dead weight. Nearly every orbital rocket stages because single-stage-to-orbit needs a >90% fuel fraction." },
  atmosphere: { p: "The air gets thinner the higher you go. About 5.5 km up there's already only half the air; at 50 km, almost none. Thin air means less drag, but also less lift for wings and rotors.", a: "Mountain climbers need oxygen tanks on Everest because each breath holds much less air up there.", t: "The atmosphere thins fast", f: "ρ ≈ ρ₀·e^(−h/H), H ≈ 8.5 km", x: "Every 8.5 km up, air density drops to about a third. At 50 km it's 0.08% of sea level. Rockets climb straight up first to get out of the thick air quickly." },
  mach: { p: "Mach is your speed compared to the speed of sound (about 1,200 km/h near the ground). Mach 1 = the speed of sound. Near it, air can't get out of the way fast enough and piles up into a shock wave, the sonic boom, and drag jumps.", a: "A boat going faster than its own waves leaves a V-shaped wake. A supersonic jet does the same thing in the air.", t: "The sound barrier", f: "M = v / a", x: "Near Mach 1 shock waves form and drag can double. Once supersonic, drag falls back but pointy noses matter much more." },
  maxq: { p: "Max Q is the moment the air pushes hardest on the rocket. It happens when the rocket is already fast but the air is still thick, usually a few kilometres up. Engineers design the whole rocket to survive this moment.", a: "Like running into the wind: it's hardest when you're fast AND the wind is strong.", t: "Max Q", f: "q = ½·ρ·v²", x: "Dynamic pressure peaks where speed is high but air is still thick, usually 10–15 km up. It's the moment of greatest aerodynamic stress, so real rockets throttle down through it." },
  heating: { p: "When something flies very fast, the air in front of it gets squeezed so hard that it heats up. At a few times the speed of sound, the nose can get hotter than an oven. Some materials melt or burn.", a: "Rub your hands together fast and they warm up. Air rubbing and squishing against the nose does the same thing, much harder.", t: "Aerodynamic heating", f: "T₀ = T·(1 + 0.2·M²)", x: "Air that slams into the nose is compressed and heats up. At Mach 3 the nose can pass 300 °C; at Mach 5, 1000 °C. Material temperature limits set how fast you can fly low." },
  buckling: { p: "A thin tube can crumple long before the material itself breaks, like stepping on a soda can. Thicker walls or stiffer materials resist this. Real rockets also fill their tanks with gas pressure to keep them stiff.", a: "A full, sealed soda can is hard to crush. An empty open one crumples easily.", t: "Thin shells buckle", f: "σ_cr ≈ 0.6·E·t / r (× knockdown)", x: "A thin tube can crush long before the metal itself yields, like stepping on a soda can. Rockets pressurize their tanks so internal pressure keeps the walls stiff." },
  orbit: { p: "Space is only about 100 km up, but staying there is the hard part. To orbit, you go sideways so fast (about 28,000 km/h) that as you fall, the Earth curves away beneath you. You keep falling around it forever.", a: "Throw a ball harder and it lands farther away. Throw it hard enough and the ground curves away before it can land.", t: "Orbit is going sideways fast", f: "v_orbit = √(GM / r) ≈ 7.8 km/s", x: "Reaching space only takes going up about 100 km. Staying there takes moving sideways at 7.8 km/s, so you keep falling around the Earth and never hit it." },
  materials: { p: "Every material is a trade-off: light or strong, cheap or heat-proof. Carbon fiber is strong and light. Steel is heavy but survives heat. Cardboard is light and cheap but weak.", a: "A paper cup is light; a metal mug is heavy but survives the dishwasher. Engineers pick the right one for the job.", t: "Strength-to-weight", f: "specific strength = σ_y / ρ", x: "Carbon fiber is about as strong as steel at a fifth of the weight. Steel wins where heat matters. Every structure trades weight, strength, heat tolerance, and cost." },
  lift: { p: "A wing is tilted and shaped so it pushes air downward. Push air down, and the air pushes the wing up. More speed or a bigger wing means more lift.", a: "Hold your hand flat out of a car window and tilt the front up a little. You'll feel it lift.", t: "Lift", f: "L = ½·ρ·v²·S·C_L", x: "A wing turns the passing air downward; by Newton's third law, the air pushes the wing up. More speed, more area, or more angle of attack means more lift, until it stalls." },
  downforce: { p: "A race car wing is an upside-down airplane wing. Instead of lifting the car, it pushes it down onto the road. That makes the tires grip harder, so the car can take corners faster.", a: "Pushing down on a shopping cart makes its wheels grip the floor better when you turn.", t: "Downforce", f: "DF = ½·ρ·v²·S·C_L", x: "A race car wing is an upside-down airplane wing. It pushes the tires into the road so they grip harder in corners, at the cost of extra drag on the straights." },
  groundeffect: { p: "Air squeezed through the narrow gap under a car speeds up, and fast air has lower pressure. The low pressure sucks the car down onto the road. Too low, though, and the air chokes and the car bounces.", a: "Hold a sheet of paper close to a table and blow under it: it gets pulled down, not up.", t: "Ground effect", f: "Venturi: faster air → lower pressure", x: "Air squeezed between the car floor and the road speeds up and its pressure drops, sucking the car down. Lower is stronger, until the flow chokes and the car starts bouncing (porpoising)." },
  induced: { p: "The air under a wing leaks around the wing tips to the top, making swirling tip vortices that waste energy. Long, skinny wings leak less. That's why gliders and albatrosses have very long wings.", a: "Like water spilling over the edges of a wide tray: the longer and thinner the tray, the less spills per bit of tray.", t: "Induced drag & aspect ratio", f: "C_Di = C_L² / (π·e·AR)", x: "Wingtips leak high-pressure air to the low-pressure side, making vortices that cost energy. Long, skinny wings (high aspect ratio, like gliders) waste less." },
  stall: { p: "If you tilt a wing too far, the air can't follow its curved top anymore. It breaks away, lift collapses and drag jumps. That's a stall. Pilots and race engineers keep the angle below it.", a: "Tilt your hand out of the car window too far and suddenly it stops lifting and just gets shoved back.", t: "Stall", f: "C_L max ≈ 1.2–1.8 (clean)", x: "Past about 15° angle of attack the airflow can no longer follow the top of the wing. It separates, lift collapses, and drag spikes. Flaps raise the stall limit for takeoff and landing." },
  ld: { p: "Lift-to-drag ratio is how much lift you get for each unit of drag. Higher is more efficient. It also tells you how far you can glide: a ratio of 20 means 20 km forward for every 1 km down.", a: "A paper airplane with good L/D floats across the room; a bad one dives into the floor.", t: "Lift-to-drag ratio", f: "glide ratio = L / D", x: "An airliner has L/D ≈ 17, so from 10 km up it could glide 170 km. A sailplane reaches 50+. L/D is the single best measure of aerodynamic efficiency." },
  sweep: { p: "Near the speed of sound, air over a straight wing forms shock waves. Sweeping the wings back makes the air 'feel' like it's going slower across them, which delays those shocks. That's why fast jets have swept-back wings.", a: "Walking diagonally up a steep hill feels easier than walking straight up.", t: "Swept wings", f: "M_crit,swept ≈ M_crit / √cos Λ", x: "Sweeping wings back means the air only 'feels' part of the speed across the airfoil, delaying shock waves. That's why jets have swept wings and slow planes don't." },
  breguet: { p: "How far a plane can fly depends on three things: how efficient its engines are, how efficient its shape is (lift-to-drag), and how much of its weight is fuel it can burn off along the way.", a: "A car's range depends on its engine, how aerodynamic it is, and how big its fuel tank is.", t: "Range", f: "R = (V / c)·(L/D)·ln(W_start / W_end)", x: "Range depends on engine efficiency, aerodynamic efficiency (L/D), and how much of the takeoff weight is fuel. Batteries don't get lighter as they drain, so electric range is harder." },
  rotor: { p: "A drone or helicopter stays up by throwing air down with its rotors. Big rotors that move lots of air slowly need much less power than small ones spinning like crazy.", a: "It's easier to push a big swing gently than to push a small one really hard to get the same result.", t: "How rotors lift", f: "P_hover = W^1.5 / √(2·ρ·A)", x: "A rotor throws air downward. Bigger rotors move more air slowly, which takes much less power than moving a little air fast. That's why helicopters have huge blades." },
  tipmach: { p: "The tips of spinning blades move much faster than the middle. If the tips get close to the speed of sound, they become loud and inefficient. So you can't just spin a small rotor faster forever.", a: "The outside edge of a merry-go-round moves way faster than the centre.", t: "Tip speed limit", f: "M_tip = Ω·R / a", x: "Blade tips move fastest. Near the speed of sound they create shock waves, noise, and lose efficiency. On Mars, the Ingenuity helicopter spun at 2,500 rpm to lift itself in air 60× thinner." },
  planets: { p: "Every world has different air and gravity. Mars has barely any air (flying is hard) and weak gravity. Titan has thick air and very weak gravity (flying is easy). The Moon has no air at all, so wings and rotors are useless there.", a: "Swimming in water vs. air: thick stuff gives you more to push against.", t: "Flying on other worlds", f: "ρ_Mars ≈ 0.02 kg/m³ · ρ_Titan ≈ 5.4 kg/m³", x: "Lift, drag, and rotor thrust all scale with air density. Titan's dense air and weak gravity make flying easy; NASA's Dragonfly rotorcraft is going there. The Moon has no air, so only rockets work." },
  froude: { p: "Boats make waves. At a certain speed (hull speed), the wave a boat makes is as long as the boat itself, and the boat gets stuck climbing its own bow wave. Longer boats have higher hull speeds.", a: "Wading through water: you hit a speed where each step drags a wall of water with you.", t: "Hull speed & Froude number", f: "Fn = v / √(g·L)", x: "A boat makes a wave as long as itself at about Fn = 0.4. Going faster means climbing its own bow wave, so resistance skyrockets. Longer hulls have higher hull speeds." },
  planing: { p: "With enough power, a flat-bottomed boat climbs on top of its own bow wave and skims across the surface instead of pushing through it. That's planing, and drag drops.", a: "A skipping stone bounces across the top instead of sinking.", t: "Planing", f: "Fn > 1: hull rides on top of the water", x: "Push hard enough and a flat-bottomed hull climbs its bow wave and skims across the surface, like a skipped stone. That hump is why speedboats pitch up before they 'get on plane'." },
  kelvin: { p: "Every boat, duck or ship leaves a V-shaped wake, and that V always has the same angle (about 39\u00b0 across), no matter how fast it goes.", a: "Watch ducks on a pond: the V behind a tiny duckling has the same angle as the one behind a huge ship.", t: "Kelvin wake", f: "half-angle = 19.47°", x: "Every ship, duck, and speedboat in deep water leaves a V-shaped wake with the same 19.47° half-angle, no matter how fast it goes. Lord Kelvin proved it in 1887." },
  metacentric: { p: "When a boat tilts, the water pushes back up on the side that dips and rights it. That only works if the boat's weight is low enough. Stack heavy cargo up high, or make the boat too narrow, and it rolls over.", a: "A wide, low table is hard to tip. A tall, narrow bookshelf tips easily.", t: "Stability: metacentric height", f: "GM = KB + BM − KG", x: "When a boat heels, the center of buoyancy shifts sideways and pushes it back upright, as long as the metacenter (M) is above the center of gravity (G). Wide beams help; tall heavy cargo hurts. GM < 0 means it capsizes." },
  buoyancy: { p: "Water pushes up on anything in it with a force equal to the weight of the water it pushes aside. If your vehicle weighs less than that water, it floats. Submarines dive by letting water into tanks to get heavier, and surface by blowing it out.", a: "Push a beach ball underwater: you feel it shove back up.", t: "Buoyancy (Archimedes)", f: "F_b = ρ_fluid·V·g", x: "Anything in a fluid is pushed up by the weight of fluid it displaces. Submarines dive by flooding tanks with water to get heavier, and surface by blowing it out with compressed air." },
  pressure: { p: "Water is heavy. Every 10 metres deeper adds the weight of another whole atmosphere pressing on you. At the bottom of the deepest ocean, that's over 1,000 times the air pressure you feel now.", a: "Your ears hurt at the bottom of a deep pool: that's the water above you pressing in.", t: "Water pressure", f: "p = ρ·g·h", x: "Every 10 m of seawater adds another atmosphere. At the bottom of the Mariana Trench it's over 1,000 atm, like the weight of an SUV on your thumbnail." },
  crush: { p: "The deep ocean squeezes a submarine from every side. Thicker walls and stronger materials resist more. A sphere is the best shape because it spreads the squeeze evenly, which is why the deepest subs are balls.", a: "An egg is hard to crush by squeezing its ends because the curved shell spreads the force.", t: "Pressure hulls", f: "σ = p·r / t (cylinder), p·r / 2t (sphere)", x: "A sphere spreads load twice as well as a cylinder, which is why the deepest vehicles are spherical. Thicker walls and stronger metals go deeper, but get heavier and may not float." },
  reynolds: { p: "This number tells you whether a fluid feels thick and sticky or thin and slippery to your vehicle. Tiny, slow things (like insects) feel air like honey. Big, fast things (like jets) slice through it.", a: "A bee flying through air feels a bit like you swimming through syrup.", t: "Reynolds number", f: "Re = ρ·v·L / μ", x: "Re compares inertia to stickiness (viscosity). Big, fast things (Re in the millions) have thin turbulent boundary layers and low friction coefficients; tiny slow things feel air like syrup." },
  cooling: { p: "Downforce has to be shared between the front and back wheels, roughly matching the car's weight. Too much at the back and the car won't turn; too much at the front and the back slides out.", a: "Like carrying a long box with a friend: if one person takes all the weight, it tips.", t: "Aerodynamic balance", f: "balance = DF_front / DF_total", x: "Downforce needs to be split between front and rear axles about like the weight is. Too much rear and the car understeers; too much front and it spins." }
};

/* =====================================================================
   ROCKET
   ===================================================================== */
function rocketGeom(p) {
  const L = p.L, d = L / p.fin, r = d / 2, Ln = Math.min(p.noseR * d, 0.45 * L), Lb = L - Ln;
  const s = p.span * d, cr = Math.min(p.root * d, Lb * 0.45), ct = cr * p.tipR, xs = Math.min(p.sweep * d, cr * 1.5);
  const M = MATERIALS[p.mat], t = p.wall / 1000, tf = Math.max(2 * t, Math.min(0.004, 0.02 * s));
  const liquid = p.prop === "liquid", nst = liquid && p.stages === 2 ? 2 : 1;
  const kN = { cone: 1, ogive: 1.12, parabolic: 1.1, blunt: 1.25 }[p.nose] || 1;
  const Anose = Math.PI * r * Math.sqrt(r * r + Ln * Ln) * kN, Afin = (cr + ct) / 2 * s, A = Math.PI * r * r;
  const Xn = { cone: 0.666, ogive: 0.466, parabolic: 0.5, blunt: 0.4 }[p.nose] * Ln;
  const lf = Math.sqrt(s * s + (xs + ct / 2 - cr / 2) ** 2);
  const CNf = p.fins ? (1 + r / (s + r)) * (4 * p.fins * (s / d) ** 2) / (1 + Math.sqrt(1 + (2 * lf / (cr + ct)) ** 2)) : 0;
  const Xb = L - cr, Xf = Xb + xs * (cr + 2 * ct) / (3 * (cr + ct)) + ((cr + ct) - cr * ct / (cr + ct)) / 6;
  const CP = (2 * Xn + CNf * Xf) / (2 + CNf), CPupper = Xn;
  // body split into stages
  const Lb2 = nst === 2 ? Lb * clamp(p.s2frac, 10, 60) / 100 : 0, Lb1 = Lb - Lb2;
  const parts = []; // {m, x, st}  st: 0 = first stage (dropped at separation), 1 = upper/last
  const last = nst - 1, add = (m, x, st, tag) => parts.push({ m, x, st, tag });
  add(Anose * t * M.rho, Ln * 0.62, last, "structure");
  add(p.payload, Ln + 0.04 * L, last, "payload");
  const stages = [];
  const sec = nst === 2 ? [[Ln + Lb2, L, 0], [Ln, Ln + Lb2, 1]] : [[Ln, L, 0]];
  for (const [x0, x1, st] of sec) {
    const len = x1 - x0, shell = Math.PI * d * len * t * M.rho + 2 * Math.PI * r * r * t * M.rho;
    add(shell, (x0 + x1) / 2, st, "structure");
    if (liquid) {
      const eng = ENGINES[st === 0 ? p.eng : p.eng2], n = st === 0 ? p.nEng : p.nEng2, pr = PROPELLANTS[eng.prop];
      const vol = Math.PI * Math.max(r - t, r * 0.5) ** 2 * len * 0.9 * clamp(p.fill, 5, 100) / 100;
      const mp = vol * pr.rho;
      add(eng.mass * n, x1 - Math.min(0.05 * L, 3), st, "engines");
      add(mp * 0.06, (x0 + x1) / 2, st, "tanks");
      const mdot = n * eng.Tvac / (eng.ispV * G0);
      stages.push({ st, x0, x1, len, mp, mdot, burn: mp / mdot, eng, n, liquid: true, isp: eng.ispV });
    } else {
      const mi = motorInfo(p.motor), ml = Math.min(0.2 * L, Math.max(0.07, 0.12 * L));
      add(mi.mcase, L - ml / 2, 0, "engines");
      stages.push({ st: 0, x0: L - ml, x1: L, len: ml, mp: mi.mp, mdot: mi.mp / mi.burn, burn: mi.burn, motor: mi, liquid: false, isp: mi.isp });
    }
  }
  if (p.fins) add(p.fins * Afin * tf * M.rho, Xb + cr * 0.45, 0, "structure");
  const dryAll = parts.reduce((a, q) => a + q.m, 0);
  if (p.chute) add(Math.max(0.004, dryAll * 0.015), Ln + 0.02 * L, last, "recovery");
  if (!liquid) add(Math.max(0.005, 0.002 * L * L), Ln + 0.08 * L, last, "avionics"); else add(dryAll * 0.01, Ln + 0.06 * L, last, "avionics");
  return { L, d, r, Ln, Lb, Lb1, Lb2, s, cr, ct, xs, t, tf, M, A, Anose, Afin, Xn, CNf, Xf, Xb, CP, CPupper, parts, stages, nst, liquid, nose: p.nose, fins: p.fins };
}
function rocketMass(g, stage, rem) { // mass & CG for current stage index and remaining propellant fractions
  let m = 0, mx = 0;
  for (const q of g.parts) { if (q.st < stage) continue; m += q.m; mx += q.m * q.x; }
  for (const S of g.stages) {
    if (S.st < stage) continue;
    const f = rem[S.st]; if (f <= 0) continue;
    const mp = S.mp * f, x = S.liquid ? S.x1 - S.len * f / 2 : (S.x0 + S.x1) / 2;
    m += mp; mx += mp * x;
  }
  return { m, cg: mx / m };
}
function rocketCd(g, M, Re, burning, upper, len) {
  const f = len / g.d, Cf = Re > 5e5 ? 0.074 / Math.pow(Re, 0.2) : 1.328 / Math.sqrt(Math.max(Re, 1e4));
  const Sb = g.Anose + Math.PI * g.d * (len - g.Ln);
  const hasFins = g.fins && !upper;
  const fric = Cf * (1 + 60 / f ** 3 + 0.0025 * f) * Sb / g.A + (hasFins ? Cf * (1 + 2 * g.tf / ((g.cr + g.ct) / 2)) * 2 * g.fins * g.Afin / g.A : 0);
  const th = Math.atan(g.r / Math.max(g.Ln, 1e-3)), sn = Math.sin(th), noseK = { cone: 1, ogive: 0.72, parabolic: 0.8, blunt: 0 }[g.nose];
  const finLE = hasFins ? g.fins * g.s * g.tf / g.A : 0;
  const press = m => {
    let nose, base, fin;
    if (m < 1) { nose = g.nose === "blunt" ? 0.12 * (1 + 0.6 * m * m) : 0.01; base = 0.12 + 0.13 * m * m; fin = finLE * 0.12; }
    else { const b = Math.sqrt(m * m - 1); nose = g.nose === "blunt" ? 0.9 + 0.08 / m : noseK * (2.1 * sn * sn + 0.5 * sn / Math.max(b, 0.3)); base = 0.25 / m; fin = finLE * (0.6 + 0.5 / m); }
    if (burning) base *= 0.35;
    return nose + base + fin;
  };
  if (M <= 0.8 || M >= 1.2) return fric + press(M);
  const s = (M - 0.8) / 0.4, S = sstep(s), a = press(0.8), b = press(1.2);
  return fric + lerp(a, b, S) + 0.3 * Math.max(a, b) * Math.sin(Math.PI * s) * (g.nose === "blunt" ? 1.4 : 1);
}

function simRocket(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, g = rocketGeom(p), GM = pl.g * pl.R * pl.R, A = g.A;
  const h0 = p.alt0, R = pl.R, gl = p.alt0 > 5000 ? 0 : p.alt0; // balloon/air launches fall back to the surface
  let x = 0, y = R + h0, vx = 0, vy = 0, t = 0;
  let stage = 0; const rem = g.stages.map(() => 1);
  const tilt = p.tilt * D2R, railLen = Math.max(1, Math.min(60, 3 * p.L)), railDir = [Math.sin(tilt), Math.cos(tilt)];
  const margin0 = (g.CP - rocketMass(g, 0, rem).cg) / g.d;
  const ev = [], samples = [], log = (k, extra) => ev.push(Object.assign({ t, h: Math.hypot(x, y) - R - h0, k }, extra || {}));
  let launched = false, onRail = true, burnOut = null, apogee = -1, apT = 0, maxQ = 0, maxQh = 0, maxQt = 0, maxV = 0, maxM = 0, maxG = 0;
  let mach1 = null, karman = false, chute = 0, drogueDone = false, landed = false, failure = null, orbit = null, sepT = null, ignT = 0;
  let skinT = atm(pl, h0).T, maxSkin = skinT, maxStress = 0, gLoss = 0, dLoss = 0, tumble = 0, maxAlt = 0, prevVr = 0, tumbling = false;
  let bdir = railDir.slice(), padWait = 0, lastBurnStage = -1, stress = 0, allow = 1, landV = 0;
  const lastStage = g.stages.length - 1;
  const maxT = 36000; let steps = 0, nextS = 0;
  const bodyLen = () => stage === 0 ? g.L : g.Ln + g.Lb2;
  const cnt = { tw0: 0 };
  { const m0 = rocketMass(g, 0, rem).m, a0 = atm(pl, h0), T0 = thrustAt(0, a0.p); cnt.tw0 = T0 / (m0 * pl.g); }
  function thrustAt(si, pa) {
    const S = g.stages[si];
    if (S.liquid) { const e = S.eng, Tsl = e.Tvac * e.ispSL / e.ispV; return Math.max(0, S.n * (e.Tvac - (e.Tvac - Tsl) * pa / P0)); }
    const mi = S.motor; return mi.T * (1 + 0.08 * (1 - Math.min(1, pa / P0)));
  }
  let chuteA = 0;
  const allowStress = () => { const E = g.M.E, sy = g.M.sy; return g.liquid ? Math.min(sy, 0.6 * E * 3 * g.t / g.r) / 1.25 : Math.min(sy, 0.6 * E * g.t / g.r * 0.3) / 1.25; };
  while (t < maxT && steps < 600000) {
    steps++;
    const rr = Math.hypot(x, y), h = rr - R, ux = x / rr, uy = y / rr, ex = uy, ey = -ux;
    const A0 = atm(pl, h), ms = rocketMass(g, stage, rem), m = ms.m;
    const w = h - h0 < 20000 ? p.wind * Math.pow(Math.max(h - h0, 1) / 10, 0.14) * (h - h0 < 12000 ? 1 : 1 - (h - h0 - 12000) / 8000) : 0;
    const vax = vx - w * ex, vay = vy - w * ey, Va = Math.hypot(vax, vay), V = Math.hypot(vx, vy);
    const S = g.stages[stage], burning = rem[stage] > 0 && t >= ignT;
    if (burning && lastBurnStage !== stage) { lastBurnStage = stage; if (stage > 0) log("ignite", { label: "Stage 2 ignition" }); }
    let T = burning ? thrustAt(stage, A0.p) : 0;
    const Mach = Va / A0.a, q = 0.5 * A0.rho * Va * Va;
    // pad
    if (!launched) {
      if (T > m * pl.g * Math.cos(tilt) * 1.001) { launched = true; log("liftoff", { label: "Liftoff" }); }
      else {
        if (!burning || pl.g === 0) { failure = failure || { k: "pad", label: "Never left the pad" }; break; }
        const dt0 = Math.min(0.05, S.burn / 200); rem[stage] -= S.mdot * dt0 / S.mp; t += dt0; padWait += dt0; continue;
      }
    }
    // body direction
    const cg = ms.cg, CPnow = stage === 0 ? g.CP : g.CPupper, margin = (CPnow - cg) / g.d;
    const dist = Math.hypot(x, y - R - h0);
    if (onRail && dist > railLen) onRail = false;
    let wob = 0;
    if (onRail) bdir = railDir.slice();
    else if (Va > 1) {
      const vdx = vax / Va, vdy = vay / Va;
      let tx = vdx, ty = vdy;
      if (g.liquid) { // actively guided (gimbaled engines): hold attitude, pitch program, then prograde
        const hUp = h - h0, pgx = vx / Math.max(V, 1e-6), pgy = vy / Math.max(V, 1e-6);
        if (p.guidance === "vertical") { tx = ux; ty = uy; }
        else if (stage === 0) {
          if (V < 50) { tx = ux; ty = uy; }
          else if (V < 170) { const k = sstep((V - 50) / 120) * p.kick * D2R; tx = Math.sin(k) * ex + Math.cos(k) * ux; ty = Math.sin(k) * ey + Math.cos(k) * uy; }
          else { tx = pgx; ty = pgy; }
        } else if (p.guidance === "orbit") {
          // upper stage: hold a pitch that cancels gravity minus centrifugal lift, and damp vertical speed -> circular orbit
          const vr = vx * ux + vy * uy, vhz = vx * ex + vy * ey, aT = Math.max(thrustAt(stage, A0.p) / m, 1e-3);
          const need = GM / (rr * rr) - vhz * vhz / rr - 0.02 * vr + (hUp < 120e3 ? 3 : 0);
          const sn = clamp(need / aT, -0.6, 0.9), cs = Math.sqrt(1 - sn * sn), dirE = vhz >= 0 ? 1 : -1;
          tx = cs * dirE * ex + sn * ux; ty = cs * dirE * ey + sn * uy;
        } else { tx = pgx; ty = pgy; }
      }
      if (!g.liquid && A0.rho > 1e-4) {
        if (margin < 0.3) { tumbling = true; tumble += 0.002; }
        if (tumbling) wob = Math.min(Math.PI, 0.15 * Math.exp(Math.min(8, (t - (ev[0] ? ev[0].t : 0)) * 3))) * Math.sin(t * 9);
        else if (margin < 1) wob = 0.12 * (1 - margin) * Math.sin(t * 7) * Math.exp(-t);
      }
      const c = Math.cos(wob), s2 = Math.sin(wob); bdir = [tx * c - ty * s2, tx * s2 + ty * c];
    }
    // drag
    const Re = A0.rho * Va * bodyLen() / A0.mu;
    let cd = rocketCd(g, Mach, Re, burning, stage > 0, bodyLen());
    if (wob) cd *= 1 + 6 * Math.sin(wob) ** 2;
    // chutes
    const hRel = h - h0, vr = vx * ux + vy * uy;
    if (launched && !burning && vr < 0 && prevVr >= 0 && apogee < 0) { apogee = hRel; apT = t; log("apogee", { label: "Apogee" }); }
    if (p.chute && apogee >= 0 && !orbit) {
      if (!chute) {
        const dual = apogee > 3000;
        if (!chuteA) { const mland = rocketMass(g, lastStage, rem).m; chuteA = 2 * mland * pl.g / (Math.max(atm(pl, h0).rho, 1e-3) * 1.5 * 25); }
        if (!dual && vr < 0) { chute = 2; log("main", { label: "Parachute" }); }
        else if (dual && !drogueDone && vr < 0) { chute = 1; drogueDone = true; log("drogue", { label: "Drogue chute" }); }
      } else if (chute === 1 && h - gl < 450) { chute = 2; log("main", { label: "Main chute" }); }
    }
    const Dch = chute ? 0.5 * A0.rho * Va * Va * 1.5 * chuteA * (chute === 1 ? 0.025 : 1) : 0;
    const D = 0.5 * A0.rho * Va * Va * cd * A;
    // integrate (RK4 on position/velocity with frozen forces except gravity/drag direction)
    const inBurn = burning;
    let dt = inBurn ? Math.min(0.01, S.burn / 400) : chute ? (h - gl > 2000 ? 1 : 0.2) : (hRel < 3000 && V < 400) ? 0.02 : h < 60e3 ? 0.05 : 0.5;
    if (!inBurn && !chute && V < 30 && h - gl < 300) dt = 0.01;
    if (onRail) dt = Math.min(dt, 0.004);
    { const kr = 0.5 * A0.rho * Math.max(Va, 1) * (cd * A + (chute ? 1.5 * chuteA * (chute === 1 ? 0.025 : 1) : 0)) / m; if (kr > 0) dt = Math.min(dt, 0.6 / kr); dt = Math.max(dt, 1e-4); }
    const Tx = T * bdir[0], Ty = T * bdir[1];
    const acc = (px, py, qx, qy) => {
      const r2 = px * px + py * py, r1 = Math.sqrt(r2), gx = -GM * px / (r2 * r1), gy = -GM * py / (r2 * r1);
      const hh = r1 - R, a1 = hh < 150e3 ? atm(pl, hh) : { rho: 0 };
      const u1x = px / r1, u1y = py / r1, e1x = u1y, e1y = -u1x;
      const wx = w * e1x, wy = w * e1y, bx = qx - wx, by = qy - wy, vb = Math.hypot(bx, by);
      let ax = gx + Tx / m, ay = gy + Ty / m;
      if (vb > 1e-6 && a1.rho > 0) { const k = 0.5 * a1.rho * vb * (cd * A + (chute ? 1.5 * chuteA * (chute === 1 ? 0.025 : 1) : 0)) / m; ax -= k * bx; ay -= k * by; }
      if (onRail) { const along = ax * railDir[0] + ay * railDir[1]; ax = along * railDir[0]; ay = along * railDir[1]; }
      return [ax, ay];
    };
    const k1v = acc(x, y, vx, vy), k1x = [vx, vy];
    const k2v = acc(x + k1x[0] * dt / 2, y + k1x[1] * dt / 2, vx + k1v[0] * dt / 2, vy + k1v[1] * dt / 2), k2x = [vx + k1v[0] * dt / 2, vy + k1v[1] * dt / 2];
    const k3v = acc(x + k2x[0] * dt / 2, y + k2x[1] * dt / 2, vx + k2v[0] * dt / 2, vy + k2v[1] * dt / 2), k3x = [vx + k2v[0] * dt / 2, vy + k2v[1] * dt / 2];
    const k4v = acc(x + k3x[0] * dt, y + k3x[1] * dt, vx + k3v[0] * dt, vy + k3v[1] * dt), k4x = [vx + k3v[0] * dt, vy + k3v[1] * dt];
    const nx = x + dt / 6 * (k1x[0] + 2 * k2x[0] + 2 * k3x[0] + k4x[0]), ny = y + dt / 6 * (k1x[1] + 2 * k2x[1] + 2 * k3x[1] + k4x[1]);
    const nvx = vx + dt / 6 * (k1v[0] + 2 * k2v[0] + 2 * k3v[0] + k4v[0]), nvy = vy + dt / 6 * (k1v[1] + 2 * k2v[1] + 2 * k3v[1] + k4v[1]);
    // bookkeeping
    const accG = Math.hypot((nvx - vx) / dt + GM * x / rr ** 3, (nvy - vy) / dt + GM * y / rr ** 3) / G0;
    if (!onRail || launched) maxG = Math.max(maxG, accG);
    if (inBurn) { gLoss += pl.g * Math.max(0, vr / Math.max(V, 1e-3)) * dt; dLoss += D / m * dt; }
    if (q > maxQ) { maxQ = q; maxQh = hRel; maxQt = t; }
    if (Va > maxV) maxV = Va; if (Mach > maxM && A0.rho > 1e-5) maxM = Mach;
    if (!mach1 && Mach >= 1 && A0.rho > 1e-5) { mach1 = { t, h: hRel }; log("mach1", { label: "Mach 1" }); }
    if (!karman && h >= 100e3) { karman = true; log("karman", { label: "Kármán line · space" }); }
    const Tst = A0.T * (1 + 0.18 * Mach * Mach), tau = 4.5 * p.wall * Math.sqrt(1.225 / Math.max(A0.rho, 1e-5));
    skinT += (Tst - skinT) * Math.min(1, dt / Math.max(0.5, tau)); if (skinT > maxSkin) maxSkin = skinT;
    const aHere = Math.hypot(k1v[0] + GM * x / rr ** 3, k1v[1] + GM * y / rr ** 3);
    stress = Math.max(0, ((T + D) * 0.85) / (Math.PI * g.d * g.t) - (g.liquid && inBurn ? 3e5 * g.r / (2 * g.t) : 0));
    allow = allowStress(A0.p); if (stress / allow > maxStress) maxStress = stress / allow;
    if (!failure && launched && skinT - 273.15 > g.M.Tmax && A0.rho > 1e-4) { failure = { k: "heat", label: `Skin hit ${Math.round(skinT - 273.15)} °C, over the ${g.M.name} limit of ${g.M.Tmax} °C` }; log("fail", { label: "Structural failure (heat)" }); }
    if (!failure && launched && stress > allow) { failure = { k: "stress", label: `Body buckled: ${(stress / 1e6).toFixed(1)} MPa vs ${(allow / 1e6).toFixed(1)} MPa allowed` }; log("fail", { label: "Structural failure (buckling)" }); }
    // sample
    if (t >= nextS) {
      const bang = Math.atan2(bdir[0] * uy - bdir[1] * ux, bdir[0] * ux + bdir[1] * uy);
      samples.push({ t, h: hRel, x: R * Math.atan2(x, y), v: Va, M: Mach, q, g: accG, m, T, cd, rho: A0.rho, st: stage, chute, skin: skinT, pitch: bang + wob * 0, thr: T > 0 ? T / (g.stages[stage].liquid ? g.stages[stage].n * g.stages[stage].eng.Tvac : g.stages[stage].motor.T * 1.08) : 0, wob });
      nextS = t + (t < 20 ? 0.02 : t < 200 ? 0.1 : 1);
    }
    x = nx; y = ny; vx = nvx; vy = nvy; prevVr = vr; t += dt;
    if (inBurn) {
      rem[stage] -= S.mdot * dt / S.mp;
      if (rem[stage] <= 0) {
        rem[stage] = 0;
        if (stage < lastStage) { log("meco", { label: "Stage 1 burnout" }); stage++; sepT = t; ignT = t + 2; log("sep", { label: "Stage separation" }); }
        else { burnOut = { t, h: Math.hypot(x, y) - R - h0, v: Math.hypot(vx, vy) }; log("burnout", { label: "Burnout" }); }
      }
    }
    if (failure) break;
    maxAlt = Math.max(maxAlt, Math.hypot(x, y) - R - h0);
    // orbit check after final burnout
    if (burnOut && !orbit) {
      const r2 = Math.hypot(x, y), v2 = Math.hypot(vx, vy), eps = v2 * v2 / 2 - GM / r2, hh = x * vy - y * vx;
      if (eps >= 0) { orbit = { escape: true }; log("escape", { label: "Escape velocity!" }); break; }
      const a = -GM / (2 * eps), e = Math.sqrt(Math.max(0, 1 + 2 * eps * hh * hh / (GM * GM))), rp = a * (1 - e), ra = a * (1 + e);
      if (rp - R > (pl.isa ? 100e3 : pl.rho0 ? 60e3 : 5e3)) { orbit = { peri: rp - R, apo: ra - R, period: 2 * Math.PI * Math.sqrt(a ** 3 / GM), v: v2, a, e }; log("orbit", { label: "Orbit achieved" }); break; }
    }
    const hn = Math.hypot(x, y) - R - gl;
    if (launched && hn <= 0 && t > 0.2) { landed = true; landV = Math.hypot(vx, vy); log("land", { label: chute ? "Touchdown" : "Impact" }); break; }
  }
  if (apogee < 0) { apogee = maxAlt; apT = t; }
  const last = samples[samples.length - 1];
  samples.push({ t, h: Math.max(gl - h0, Math.hypot(x, y) - R - h0), x: R * Math.atan2(x, y), v: Math.hypot(vx, vy), M: 0, q: 0, g: 0, m: rocketMass(g, stage, rem).m, T: 0, cd: last ? last.cd : 0, rho: atm(pl, Math.max(0, Math.hypot(x, y) - R)).rho, st: stage, chute, skin: skinT, pitch: last ? last.pitch : 0, thr: 0, wob: 0 });
  // summary numbers
  const m0 = rocketMass(g, 0, g.stages.map(() => 1)).m;
  let dv = 0; { const r1 = g.stages.map(() => 1); for (let i = 0; i < g.stages.length; i++) { const S = g.stages[i]; const mA = rocketMass(g, i, r1).m; r1[i] = 0; const mB = rocketMass(g, i, r1).m; const isp = S.liquid ? (i === 0 ? (S.eng.ispSL + S.eng.ispV) / 2 : S.eng.ispV) : S.isp; dv += isp * G0 * Math.log(mA / mB); } }
  const mdry = rocketMass(g, 0, g.stages.map(() => 0)).m, mprop = m0 - mdry;
  const mBO = rocketMass(g, 0, g.stages.map((_, i) => i === 0 ? 0 : 1));
  const marginBO = (g.CP - mBO.cg) / g.d;
  const apA = atm(pl, apogee + h0), cd0 = rocketCd(g, 0.3, 1.225 * 100 * g.L / 1.8e-5, false, false, g.L);
  return { kind: "rocket", g, samples, events: ev, apogee, apT, maxQ, maxQh, maxQt, maxV, maxM, maxG, mach1, karman, orbit, failure, landed, landV, tumbling, burnOut,
    tFlight: t, gl, steps, range: last ? Math.abs(last.x) : 0, m0, mdry, mprop, dv, tw0: cnt.tw0, margin0, marginBO, maxSkin, maxStress, gLoss, dLoss, apA, cd0, padWait, h0, planet: pl, chuteA };
}

/* =====================================================================
   RACE CAR
   ===================================================================== */
const TRACK_PTS = [[0, 0], [620, 0], [820, 50], [880, 210], [780, 340], [580, 320], [450, 420], [470, 580], [320, 650], [120, 590], [60, 440], [190, 320], [130, 190], [-60, 150], [-150, 60]];
let TRACK = null, TRACK_CUSTOM = null;
/* custom course: { pts: [[x,y],...] control points (m), zones: [{x,y,r,mu,bank,wind}] } ; null = default HoloRing */
function setTrack(c) { TRACK_CUSTOM = c && c.pts && c.pts.length >= 3 ? c : null; TRACK = null; }
function buildTrack() {
  if (TRACK) return TRACK;
  const P = TRACK_CUSTOM ? TRACK_CUSTOM.pts : TRACK_PTS, n = P.length, raw = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) { const t = k / 40, t2 = t * t, t3 = t2 * t;
      raw.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  // resample every 5 m
  const pts = [raw[0]]; let acc = 0;
  for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += L; if (acc >= 5) { pts.push(b); acc = 0; } }
  const N = pts.length, kap = new Array(N);
  for (let i = 0; i < N; i++) { const a = pts[(i - 3 + N) % N], b = pts[i], c = pts[(i + 3) % N];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); kap[i] = Math.abs(2 * cr / (ab * bc * ca + 1e-9)); }
  let len = 0; const s = [0]; for (let i = 1; i < N; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); s.push(len); }
  len += Math.hypot(pts[0][0] - pts[N - 1][0], pts[0][1] - pts[N - 1][1]);
  // per-point zone effects: grip factor, banking (rad), head/tail wind along the track (m/s)
  const muF = new Array(N).fill(1), bank = new Array(N).fill(0), wind = new Array(N).fill(0), zone = new Array(N).fill(-1);
  if (TRACK_CUSTOM && TRACK_CUSTOM.zones) TRACK_CUSTOM.zones.forEach((z, zi) => { for (let i = 0; i < N; i++) { if (Math.hypot(pts[i][0] - z.x, pts[i][1] - z.y) > z.r) continue; zone[i] = zi;
    if (z.mu) muF[i] = Math.min(muF[i], z.mu); if (z.bank) bank[i] = Math.max(bank[i], z.bank * D2R);
    if (z.wind) { const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N], hx = b[0] - a[0], hy = b[1] - a[1], hl = Math.hypot(hx, hy) || 1, wd = (z.dir || 0) * D2R; wind[i] = -z.wind * (Math.cos(wd) * hx + Math.sin(wd) * hy) / hl; } } });
  TRACK = { pts, kap, s, len, muF, bank, wind, zone, custom: !!TRACK_CUSTOM }; return TRACK;
}
function carAero(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, A0 = atm(pl, p.alt0), rho = A0.rho;
  const Ab = p.W * p.H * 0.82;
  const cdB = ({ wedge: 0.27, round: 0.30, blunt: 0.42 }[p.nose]) * (1 + 0.3 * Math.max(0, p.H / p.L - 0.25));
  let CdA = cdB * Ab + (p.wheels === "open" ? 0.42 : 0) + 0.0022 * p.diff * p.W;
  const ride = p.ride / 1000;
  // body lift (positive = up), floor downforce
  const Aplan = p.L * p.W;
  const bodyCL = { wedge: -0.04, round: 0.09, blunt: 0.04 }[p.nose];
  let gf = clamp(0.05 / Math.max(ride, 0.005), 0.3, 2.0), porpoise = false;
  if (ride < 0.025) { gf *= 0.55; porpoise = true; }
  const floorCL = (0.04 + 0.018 * p.diff) * gf;
  let ClA = (floorCL - bodyCL) * Aplan * 0.6;
  let front = floorCL * Aplan * 0.6 * 0.45 - (-bodyCL) * 0; // floor ~45% front
  let rearW = 0, wingStall = false, wingCdA = 0;
  if (p.wing !== "none") {
    const S = p.wingSpan * p.wingChord * (p.wing === "double" ? 1.6 : 1), AR = p.wingSpan / (p.wingChord * (p.wing === "double" ? 1.6 : 1)) * 1.5;
    const CLa = 2 * Math.PI * AR / (AR + 2), CLmax = p.wing === "double" ? 2.6 : 1.5, a = (p.wingAng + (p.wing === "double" ? 6 : 1)) * D2R;
    let CL = CLa * a; if (CL > CLmax) { wingStall = true; CL = CLmax * 0.6; }
    const cd = 0.015 + (p.wing === "double" ? 0.02 : 0) + CL * CL / (Math.PI * 0.8 * AR) + (wingStall ? 0.35 : 0);
    rearW = CL * S; wingCdA = cd * S; ClA += rearW; CdA += wingCdA;
  }
  let frontW = 0;
  if (p.fwing) { const S = p.W * 0.28 * 0.9; frontW = 1.3 * S; ClA += frontW; CdA += 0.09 * S; }
  front += frontW;
  const balance = ClA > 0.05 ? clamp(front / ClA, 0, 1) : 0.45;
  return { CdA, ClA, Cd: CdA / (Ab + (p.wheels === "open" ? 0.5 : 0)), Afront: Ab + (p.wheels === "open" ? 0.5 : 0), rho, balance, porpoise, wingStall, pl, A0 };
}
function carMass(p) {
  const M = MATERIALS[p.mat], shell = 2 * (p.L * p.W + p.L * p.H + p.W * p.H) * 0.55;
  const body = shell * 0.004 * M.rho * 1.6;
  const pt = p.engine === "electric" ? 0.25 * p.power + 6 * (40 + 0.08 * p.power) : 150 + 0.6 * p.power;
  const parts = { body, powertrain: pt, "chassis & systems": 180, "wheels & suspension": 130, driver: 75, wings: (p.wing !== "none" ? 8 : 0) + (p.fwing ? 5 : 0) };
  return { m: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}
function simCar(p) {
  const a = carAero(p), mm = carMass(p), m = mm.m, pl = a.pl, g = pl.g, rho = a.rho, P = p.power * 1000, eta = p.engine === "electric" ? 0.93 : 0.85;
  const mu = p.grip, drv = p.drive === "awd" ? 1 : 0.55, Crr = 0.012, meff = m * 1.05;
  const DF = v => 0.5 * rho * v * v * a.ClA, DR = v => 0.5 * rho * v * v * a.CdA;
  const Fdrive = v => Math.min(eta * P / Math.max(v, 0.5), mu * drv * (m * g + DF(v)));
  const net = v => Fdrive(v) - DR(v) - Crr * (m * g + Math.max(0, DF(v)));
  // top speed
  let lo = 1, hi = 250; if (net(lo) <= 0) hi = lo; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (net(mid) > 0) lo = mid; else hi = mid; }
  const vcap = p.engine === "electric" ? 115 : 125, geared = lo > vcap, vtop = Math.min(lo, vcap);
  // straight-line run
  let v = 0, x = 0, t = 0; const run = []; const netC = vv => vv >= vtop ? Math.min(0, net(vv)) : net(vv); let t100 = null, t200 = null, t300 = null, qm = null, qmV = 0;
  while (t < 120) { const acc = netC(v) / meff; v = Math.max(0, v + acc * 0.01); x += v * 0.01; t += 0.01;
    if (!t100 && v >= 100 / 3.6) t100 = t; if (!t200 && v >= 200 / 3.6) t200 = t; if (!t300 && v >= 300 / 3.6) t300 = t;
    if (!qm && x >= 402.3) { qm = t; qmV = v; } if (Math.round(t * 100) % 10 === 0) run.push({ t, v, x }); if (acc < 0.002 && t > 5) break; }
  // braking 200 -> 0
  let vb = 200 / 3.6, xb = 0; while (vb > 0.1) { const dec = (mu * (m * g + DF(vb)) + DR(vb)) / m; vb -= dec * 0.005; xb += vb * 0.005; }
  // lap
  const T = buildTrack(), N = T.pts.length, vmax = new Float64Array(N);
  // banked corner: effective grip (mu + tan b) / (1 - mu tan b); wind changes the airspeed the aero sees
  const muAt = i => { const mz = mu * T.muF[i], tb = Math.tan(T.bank[i]); return tb > 0 ? (mz + tb) / Math.max(0.05, 1 - mz * tb) : mz; };
  const DFw = (i, v) => 0.5 * rho * (v + T.wind[i]) ** 2 * a.ClA * Math.sign(v + T.wind[i] || 1), DRw = (i, v) => 0.5 * rho * (v + T.wind[i]) * Math.abs(v + T.wind[i]) * a.CdA;
  const netAt = (i, v) => Math.min(eta * P / Math.max(v, 0.5), mu * T.muF[i] * drv * (m * g + DFw(i, v))) - DRw(i, v) - Crr * (m * g + Math.max(0, DFw(i, v)));
  let vtopTrack = 0;
  for (let i = 0; i < N; i++) { const k = Math.max(T.kap[i], 1e-5), mz = muAt(i), den = k - mz * rho * a.ClA / (2 * m); let vt = vtop; if (T.wind[i]) { let lo2 = 1, hi2 = 250; for (let j = 0; j < 40; j++) { const md = (lo2 + hi2) / 2; if (netAt(i, md) > 0) lo2 = md; else hi2 = md; } vt = Math.min(lo2, vcap); } vmax[i] = den <= 0 ? vt : Math.min(vt, Math.sqrt(mz * g / den)); }
  const vf = new Float64Array(N), vbk = new Float64Array(N);
  const latFrac = (i, vv) => Math.min(1, vv * vv * T.kap[i] / (muAt(i) * (g + DFw(i, vv) / m)));
  for (let pass = 0; pass < 2; pass++) {
    vf[0] = pass ? vf[N - 1] : vmax[0];
    for (let i = 1; i < N; i++) { const ds = T.s[i] - T.s[i - 1], vv = vf[i - 1], ax = Math.max(0, netAt(i - 1, vv) / meff) * Math.sqrt(Math.max(0, 1 - latFrac(i - 1, vv) ** 2)); vf[i] = Math.min(vmax[i], Math.sqrt(vv * vv + 2 * ax * ds)); }
  }
  vbk[N - 1] = vf[N - 1];
  for (let i = N - 2; i >= 0; i--) { const ds = T.s[i + 1] - T.s[i], vv = vbk[i + 1], dec = ((muAt(i + 1) * (m * g + DFw(i + 1, vv)) + DRw(i + 1, vv)) / m) * Math.sqrt(Math.max(0, 1 - latFrac(i + 1, vv) ** 2)); vbk[i] = Math.min(vf[i], Math.sqrt(vv * vv + 2 * dec * ds)); }
  let lapT = 0; const lap = []; let vMin = 1e9, vLapMax = 0;
  for (let i = 0; i < N; i++) { const ds = i ? T.s[i] - T.s[i - 1] : 0, vv = vbk[i]; if (i) lapT += ds / Math.max(0.5 * (vv + vbk[i - 1]), 0.5);
    vMin = Math.min(vMin, vv); vLapMax = Math.max(vLapMax, vv); vtopTrack = Math.max(vtopTrack, vv); lap.push({ t: lapT, s: T.s[i], v: vv, lat: vv * vv * T.kap[i] / g, x: T.pts[i][0], y: T.pts[i][1], lim: latFrac(i, vv) > 0.97, zone: T.zone[i], mu: muAt(i) }); }
  lapT += (T.len - T.s[N - 1]) / Math.max(vbk[N - 1], 1);
  const vUp = a.ClA > 0.01 ? Math.sqrt(2 * m * g / (rho * a.ClA)) : Infinity;
  const latAt = vv => mu * (m * g + DF(vv)) / (m * g);
  return { kind: "car", geared, aero: a, mass: mm, m, vtop, t100, t200, t300, qm, qmV, brake200: xb, lapT, lap, vMin, vLapMax, vUp, lat100: latAt(100 / 3.6), lat200: latAt(200 / 3.6),
    df200: DF(200 / 3.6) / g, drag200: DR(200 / 3.6), dragPowerTop: DR(vtop) * vtop, run, trackLen: T.len, pw: p.power / (m / 1000), planet: pl };
}

/* =====================================================================
   AIRPLANE
   ===================================================================== */
const AIRFOILS = {
  flat:  { name: "Flat plate", a0: 0, clmax: 0.8, cd0: 0.02, tc: 0.03, mcrit: 0.72 },
  n0012: { name: "NACA 0012 (symmetric)", a0: 0, clmax: 1.35, cd0: 0.0065, tc: 0.12, mcrit: 0.72, m: 0, p: 0 },
  n2412: { name: "NACA 2412 (general)", a0: -2.1, clmax: 1.55, cd0: 0.007, tc: 0.12, mcrit: 0.70, m: 0.02, p: 0.4 },
  n4415: { name: "NACA 4415 (high lift)", a0: -4.0, clmax: 1.75, cd0: 0.0085, tc: 0.15, mcrit: 0.65, m: 0.04, p: 0.4 },
  sc:    { name: "Supercritical SC(2)", a0: -3.0, clmax: 1.6, cd0: 0.0065, tc: 0.12, mcrit: 0.78, m: 0.02, p: 0.7 }
};
function planeModel(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, af = AIRFOILS[p.airfoil], M = MATERIALS[p.mat];
  const S = p.span * p.chord * (1 + p.taper) / 2, AR = p.span * p.span / S, Lam = p.sweep * D2R, cmac = S / p.span;
  const CLa = 2 * Math.PI * AR / (2 + Math.sqrt(AR * AR * (1 + Math.tan(Lam) ** 2) + 4));
  const flapD = [0, 0.3, 0.6, 0.9][p.flaps] || 0, flapCD = [0, 0.01, 0.03, 0.06][p.flaps] || 0;
  const CLmax = 0.9 * af.clmax * Math.cos(Lam) + flapD, CLmaxClean = 0.9 * af.clmax * Math.cos(Lam);
  let e = Lam < 5 * D2R ? 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64 : 4.61 * (1 - 0.045 * Math.pow(AR, 0.68)) * Math.pow(Math.cos(Lam), 0.15) - 3.1;
  e = clamp(e, 0.5, 0.95); const K = 1 / (Math.PI * e * AR);
  // structure & mass
  const tsk = clamp(0.001 * Math.pow(p.span / 10, 0.9), 0.0003, 0.008);
  const wingM = S * 2 * tsk * M.rho * (1 + 0.02 * p.span) * 1.4, fuseM = Math.PI * p.fuseD * p.fuseL * tsk * M.rho * 1.3, tailM = wingM * 0.22;
  let engM = 0, battWh = 0;
  if (p.engine === "prop") engM = p.nEng * (1.25 * p.power + 8);
  if (p.engine === "electric") engM = p.nEng * (0.22 * p.power + 1);
  if (p.engine === "jet") engM = p.nEng * p.thrust * 1000 / (5 * G0);
  const sys = 0.35 * (wingM + fuseM + tailM) + (p.engine === "glider" ? 5 : 25 + 0.05 * (wingM + fuseM + engM)), empty = wingM + fuseM + tailM + engM + sys;
  const base = empty + p.payload;
  const f = p.engine === "glider" ? 0 : clamp(p.fuel, 0, 60) / 100;
  const fuel = base * f / (1 - f);
  if (p.engine === "electric") battWh = fuel * 250;
  const m = base + fuel, W = m * pl.g, mEnd = p.engine === "electric" ? m : base + fuel * 0.05;
  // drag
  const Swf = Math.PI * p.fuseD * p.fuseL * 0.85, ff = p.fuseL / p.fuseD, FF = 1 + 60 / ff ** 3 + ff / 400;
  const cdFuse = (Re) => (0.455 / Math.pow(Math.log10(Math.max(Re, 1e4)), 2.58)) * FF * Swf / S;
  const CD0f = (rho, v, mu) => af.cd0 * 1.05 + cdFuse(rho * v * p.fuseL / mu) + 0.004 + flapCD + (p.engine === "prop" ? 0.012 : p.engine === "electric" ? 0.006 : 0);
  const Mcrit = (af.mcrit) / Math.sqrt(Math.cos(Lam));
  const CDw = (Mn, CL) => { const mc = Mcrit - 0.1 * Math.abs(CL); if (Mn <= mc) return 0; if (Mn < 1) return Math.min(0.06, 20 * (Mn - mc) ** 4); return 0.02 + 4 * af.tc * af.tc / Math.sqrt(Math.max(Mn * Mn - 1, 0.05)) * Math.cos(Lam); };
  const propD = clamp(0.25 * Math.pow(Math.max(p.power, 0.1), 0.4), 0.15, 4.5);
  const thrust = (h, v) => {
    const A = atm(pl, h), sig = A.rho / 1.225;
    if (p.engine === "glider" || A.rho <= 0) return 0;
    if (p.engine === "jet") return p.nEng * p.thrust * 1000 * Math.pow(sig, 0.8) * (1 + 0.15 * Math.min(1, v / A.a));
    const lapse = p.engine === "prop" ? Math.max(0, 1.13 * sig - 0.13) : Math.sqrt(sig), Pw = p.nEng * p.power * 1000 * lapse;
    const Tst = p.nEng * Math.pow(p.power * 1000 * 0.75 * lapse, 2 / 3) * Math.pow(2 * A.rho * Math.PI * propD * propD / 4, 1 / 3);
    return v > 0.75 * A.a ? 0 : Math.min(Tst, 0.8 * Pw / Math.max(v, 1)) * (v > 0.6 * A.a ? 1 - (v / A.a - 0.6) / 0.15 : 1);
  };
  const drag = (h, v, Wt = W) => { const A = atm(pl, h); if (A.rho <= 0) return { D: Infinity, CL: Infinity }; const q = 0.5 * A.rho * v * v, CL = Wt / (q * S), Mn = v / A.a; return { D: q * S * (CD0f(A.rho, v, A.mu) + K * CL * CL + CDw(Mn, CL)), CL, M: Mn }; };
  const vStall = (h, cl = CLmaxClean) => { const A = atm(pl, h); return A.rho > 0 ? Math.sqrt(2 * W / (A.rho * S * cl)) : Infinity; };
  return { pl, af, M, S, AR, Lam, cmac, CLa, CLmax, CLmaxClean, e, K, m, W, empty, fuel, battWh, mEnd, parts: { wing: wingM, fuselage: fuseM, tail: tailM, engines: engM, systems: sys, payload: p.payload, [p.engine === "electric" ? "battery" : "fuel"]: fuel }, thrust, drag, vStall, CD0f, Mcrit, propD, tsk };
}
function simPlane(p) {
  const P = planeModel(p), pl = P.pl, W = P.W, h0 = p.alt0;
  const A0 = atm(pl, h0);
  const vmaxLevel = h => { const vs = P.vStall(h); if (!isFinite(vs)) return null; let best = null; const a = atm(pl, h).a; for (let v = vs; v < Math.min(3.2 * a, 1200); v += Math.max(0.5, vs * 0.015)) { const T = P.thrust(h, v), D = P.drag(h, v).D; if (T >= D) best = v; } return best; };
  const rocMax = h => { const vs = P.vStall(h); if (!isFinite(vs)) return { roc: -Infinity, v: 0 }; let best = -Infinity, bv = 0; const a = atm(pl, h).a; for (let v = vs * 1.05; v < Math.min(3 * a, 1000); v += Math.max(1, vs * 0.03)) { const r = (P.thrust(h, v) - P.drag(h, v).D) * v / W; if (r > best) { best = r; bv = v; } } return { roc: best, v: bv }; };
  const LDmax = 1 / (2 * Math.sqrt(P.K * P.CD0f(A0.rho || 1, 50, A0.mu)));
  const vs0 = P.vStall(h0), vsLand = P.vStall(h0, P.CLmax), vLO = 1.2 * vsLand;
  // takeoff roll
  let v = 0, x = 0, t = 0, canTO = false; const samples = [];
  if (p.engine !== "glider" && isFinite(vLO)) {
    while (t < 300) { const q = 0.5 * A0.rho * v * v, L = q * P.S * 0.3, D = q * P.S * (P.CD0f(A0.rho, Math.max(v, 1), A0.mu) + P.K * 0.09) ;
      const acc = (P.thrust(h0, v) - D - 0.03 * Math.max(0, W - L)) / P.m; if (acc <= 0 && v < vLO) break;
      v += acc * 0.05; x += v * 0.05; t += 0.05; if (Math.round(t * 20) % 10 === 0) samples.push({ t, x, h: 0, v, pitch: 0, ph: "roll" }); if (v >= vLO) { canTO = true; break; } }
  }
  const toDist = canTO ? x : null;
  // climb
  const cruiseAlt = p.cruise; let h = 0, ceil = null; const vmaxSL = vmaxLevel(h0);
  let reached = false;
  if (canTO) {
    samples.push({ t, x, h: 0, v, pitch: 10 * D2R, ph: "rotate" });
    while (t < 7200) { const r = rocMax(h0 + h); if (r.roc < 0.5) { ceil = h0 + h; break; }
      const dt = 2; const vc = Math.min(r.roc, 60); h += vc * dt; x += r.v * dt; t += dt; v = r.v;
      samples.push({ t, x, h, v, pitch: Math.asin(clamp(vc / Math.max(r.v, 1), 0, 1)), ph: "climb" });
      if (h0 + h >= cruiseAlt) { h = cruiseAlt - h0; reached = true; break; } }
  }
  // service ceiling scan (for stats)
  let svc = null; { for (let hh = h0; hh < 30000; hh += 250) { if (rocMax(hh).roc < 0.5) { svc = hh; break; } } if (svc === null) svc = 30000; }
  if (p.engine === "glider") svc = null;
  // cruise
  const hc = reached ? cruiseAlt : h0 + h, vmC = vmaxLevel(hc), vCr = vmC ? Math.max(P.vStall(hc) * 1.3, vmC * 0.85) : null;
  const Ac = atm(pl, hc);
  const dC = vCr ? P.drag(hc, vCr) : null, LDc = dC ? W / dC.D : null;
  if (canTO && vCr) { for (let k = 0; k < 30; k++) { t += 2; x += vCr * 2; samples.push({ t, x, h, v: vCr, pitch: 0.02, ph: "cruise" }); } }
  // glider: tow to cruise altitude, then glide at best L/D
  let glide = null;
  if (p.engine === "glider") {
    const hs = cruiseAlt, vs = P.vStall(hs); let hh = hs - h0, xx = 0, tt = 0; if (isFinite(vs)) {
      const vbg = Math.sqrt(2 * W / ((atm(pl, hs).rho) * P.S * Math.sqrt(P.CD0f(atm(pl, hs).rho, 30, 1.8e-5) / P.K)));
      while (hh > 0 && tt < 20000) { const A = atm(pl, h0 + hh), vv = vbg * Math.sqrt(atm(pl, hs).rho / A.rho), d = P.drag(h0 + hh, vv), sink = d.D * vv / W; hh -= sink * 5; xx += vv * 5; tt += 5; samples.push({ t: tt, x: xx, h: Math.max(0, hh), v: vv, pitch: -Math.asin(clamp(sink / vv, 0, 1)), ph: "glide" }); }
      glide = { dist: xx, time: tt };
    }
  }
  // range / endurance
  let range = null, endur = null;
  if (vCr && LDc && p.engine !== "glider") {
    const ln = Math.log(P.m / P.mEnd);
    if (p.engine === "jet") { const c = 1.6e-4 * (1 + 0.3 * Math.min(1, vCr / Ac.a)); range = vCr / c * LDc * ln; endur = range / vCr; }
    if (p.engine === "prop") { range = 0.8 / (7.46e-7) * LDc * ln; endur = range / vCr; }
    if (p.engine === "electric") { range = P.battWh * 3600 * 0.72 * LDc / W; endur = range / vCr; }
  }
  // structure: wing root bending at 3.8 g
  const Mroot = 3.8 * W * p.span / (3 * Math.PI) * 0.5 * 2, hW = P.af.tc * p.chord, sigma = Mroot / (P.tsk * p.chord * 0.5 * hW) / 2;
  const wingMargin = P.M.sy / sigma;
  const Mc = vCr ? vCr / Ac.a : null;
  const LDfn = hh => { const A = atm(pl, hh); return A.rho > 0 ? 1 / (2 * Math.sqrt(P.K * P.CD0f(A.rho, 60, A.mu))) : 0; };
  return { kind: "plane", P, samples, canTO, toDist, vLO, vs0, vsLand, vmaxSL, ceil, svc, reached, hc, vCr, Mc, LDc, LDmax, range, endur, glide, wingMargin, sigma,
    rocSL: rocMax(h0), wingLoad: P.m / P.S, planet: pl, vmC, contrail: Ac.T < 233 && p.engine === "jet" };
}

/* =====================================================================
   DRONE
   ===================================================================== */
function simDrone(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, A = atm(pl, p.alt0), rho = A.rho, g = pl.g, M = MATERIALS[p.mat];
  const N = p.rotors, D = p.prop, R = D / 2, Ar = Math.PI * R * R, Atot = N * Ar;
  const arm = D * 0.62 / Math.sin(Math.PI / N) * 0.9, da = 0.05 * D + 0.008, tw = clamp(0.001 * Math.sqrt(D / 0.25), 0.0005, 0.004);
  const frame = N * arm * Math.PI * da * tw * M.rho + (0.22 * D + 0.04) ** 2 * 4 * tw * M.rho;
  const motors = N * p.power * 0.00022, escs = N * p.power * 0.00005, props = N * 0.012 * Math.pow(D / 0.25, 1.8), batt = p.battery * 0.0055, avi = 0.06 + 0.002 * N;
  const parts = { frame, motors: motors + escs, props, battery: batt, avionics: avi, payload: p.payload };
  const m = Object.values(parts).reduce((a, b) => a + b, 0), W = m * g;
  const CT = 0.011, ok = rho > 0;
  const ThEach = W / N, OmR = ok ? Math.sqrt(ThEach / (CT * rho * Ar)) : Infinity, tipM = OmR / A.a, rpm = OmR / R * 60 / (2 * Math.PI);
  let FM = 0.6 + 0.1 * Math.min(1, D); if (tipM > 0.7) FM *= Math.max(0.25, 1 - (tipM - 0.7) * 1.8);
  const eta = 0.82;
  const Pideal = ok ? Math.pow(W, 1.5) / Math.sqrt(2 * rho * Atot) : Infinity, Ph = Pideal / FM / eta;
  const Tmax = ok ? N * Math.pow(p.power * eta * FM * Math.sqrt(2 * rho * Ar), 2 / 3) : 0;
  const TW = Tmax / W, canHover = TW > 1.02;
  const tHover = canHover ? p.battery * 3600 * 0.85 / Ph : 0;
  const vh = ok ? Math.sqrt(W / (2 * rho * Atot)) : 0, xP = N * p.power * eta * FM / W;
  const CdA = 1.0 * ((0.3 * D + 0.06) ** 2 * (1 + N / 8)) + 0.3 * N * arm * da * 0.3;
  const Fh = canHover ? Math.sqrt(Math.max(0, Tmax * Tmax * 0.81 - W * W)) : 0, vmax = canHover && ok ? Math.min(Math.sqrt(2 * Fh / (rho * CdA)), 0.2 * OmR * Math.sqrt(TW)) : 0;
  const climb = canHover && ok ? Math.min(Math.max(0, (xP * xP - vh * vh) / xP), Math.sqrt(2 * Math.max(0, Tmax * 0.9 - W) / (rho * CdA * 4))) : 0;
  const tilt = canHover ? Math.acos(clamp(W / (Tmax * 0.9), -1, 1)) : 0;
  const vcr = vmax * 0.6, Pcr = Ph * (1 + 0.5 * (vcr / Math.max(vmax, 1)) ** 3) * 1.05, range = canHover ? vcr * p.battery * 3600 * 0.85 / Pcr : 0;
  const payloadMax = Math.max(0, Tmax / 1.6 / g - (m - p.payload));
  const discLoad = W / Atot;
  // mission profile for animation: climb to 30 m, sprint 150 m out and back, land
  const samples = []; if (canHover && climb > 0.3 && vmax > 1) {
    let t = 0, x = 0, h = 0, bat = 1, it = 0; const vc = Math.min(climb, 8);
    const push = (ph, pitch, v) => samples.push({ t, x, h, v, bat, ph, pitch });
    while (h < 30) { h = Math.min(30, h + vc * 0.1); t += 0.1; bat -= Ph * 1.3 * 0.1 / (p.battery * 3600); push("climb", 0, vc); }
    for (let i = 0; i < 20; i++) { t += 0.1; bat -= Ph * 0.1 / (p.battery * 3600); push("hover", 0, 0); }
    let v = 0; while (x < 150 && it++ < 20000) { v = Math.min(vmax * 0.95, v + 4 * 0.1); x += v * 0.1; t += 0.1; bat -= Pcr * 1.4 * 0.1 / (p.battery * 3600); push("sprint", -tilt * Math.min(1, v / Math.max(vmax, 1)), v); }
    while (v > 0.2) { v = Math.max(0, v - 5 * 0.1); x += v * 0.1; t += 0.1; push("brake", tilt * 0.6, v); }
    while (x > 0.5 && it++ < 20000) { v = Math.min(vmax * 0.95, v + 4 * 0.1, x); x -= v * 0.1; t += 0.1; bat -= Pcr * 1.4 * 0.1 / (p.battery * 3600); push("return", tilt * Math.min(1, v / Math.max(vmax, 1)), -v); }
    while (h > 0) { h = Math.max(0, h - 2 * 0.1); t += 0.1; push("land", 0, 0); }
  }
  return { kind: "drone", pl, A, m, W, parts, N, D, Atot, arm, TW, canHover, Ph, Tmax, tHover, climb, vmax, range, payloadMax, discLoad, tipM, rpm, FM, samples, tilt, windOk: vmax > p.wind * 1.2 };
}

/* =====================================================================
   BOAT
   ===================================================================== */
function simBoat(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, liq = pl.liquids[p.liquid] || Object.values(pl.liquids)[0];
  if (!liq) return { kind: "boat", noLiquid: true, pl };
  const g = pl.g, rho = liq.rho, nu = liq.nu, M = MATERIALS[p.mat], t = p.wall / 1000;
  const cat = p.hull === "catamaran", foil = p.hull === "hydrofoil";
  const b = cat ? p.B / 4.5 : p.B, nh = cat ? 2 : 1;
  const hullArea = nh * p.L * (b + 2 * p.D) * 1.15 + p.L * p.B * 0.8;
  const hull = hullArea * t * M.rho * 1.25;
  const engine = p.power * (p.power < 60 ? 1.6 : 2.6), fuel = p.power * 0.8, foils = foil ? 0.012 * p.L * p.B * 18 : 0;
  const outfit = 22 * p.L * p.B * p.D, keel = p.hull === "displacement" ? 0.3 * hull : 0;
  const parts = { hull, "outfit & interior": outfit, keel, engine, "fuel & systems": fuel, cargo: p.payload, foils };
  const m = Object.values(parts).reduce((a, q) => a + q, 0), V = m / rho;
  const Cb = p.hull === "displacement" ? 0.5 : 0.45, T = V / (nh * Cb * 0.92 * p.L * 0.85 * b);
  const freeboard = p.D - T, sinks = T > p.D * 0.92;
  const S0 = nh * (1.7 * p.L * T + (V / nh) / Math.max(T, 1e-3));
  const Sfoil = foil ? 0.02 * p.L * p.B : 0;
  const vTO = foil ? Math.sqrt(2 * m * g / (rho * Sfoil * 0.9)) : Infinity;
  const disp = Fn => 0.0045 * Math.pow(Fn / 0.35, 6);
  const rw = Fn => {
    if (p.hull === "displacement") return disp(Fn) * clamp(5 / (p.L / p.B), 0.4, 1.8);
    if (cat) return Math.min(disp(Fn) * 0.3, 0.055 + 0.035 * Math.exp(-(((Fn - 0.7) / 0.3) ** 2)));
    return Math.min(disp(Fn), 0.075 + 0.06 * Math.exp(-(((Fn - 0.6) / 0.25) ** 2)));
  };
  const res = v => {
    const Fn = v / Math.sqrt(g * p.L), Re = Math.max(v * p.L / nu, 1e4), Cf = 0.075 / (Math.log10(Re) - 2) ** 2;
    let S = S0, Rw, Rf, lift = 0;
    if (foil) lift = clamp((v / vTO) ** 2, 0, 1);
    const wetK = p.hull === "displacement" ? 1 : clamp(1.2 / (1 + Math.max(0, Fn - 0.4) * 1.3), 0.35, 1);
    S *= wetK;
    const cav = foil && v > 26 ? 1 + ((v - 26) / 5) ** 2 : 1;
    if (foil && lift >= 1) { Rw = m * g / 14 * cav; Rf = 0.5 * rho * v * v * (2 * Sfoil + 0.004 * p.L * p.D) * Cf * 1.3; return { R: Rw + Rf, Rw, Rf, Fn, reg: cav > 1.05 ? "Foiling (cavitating)" : "Foiling" }; }
    Rw = rw(Fn) * m * g * (1 - lift) + (foil ? lift * m * g / 14 : 0);
    Rf = 0.5 * rho * v * v * S * (1 - lift * 0.7) * Cf * 1.2;
    const air = 0.5 * 1.2 * v * v * 0.8 * p.B * (p.D - T + 1.5);
    const reg = p.hull === "displacement" ? (Fn < 0.4 ? "Displacement" : "Fighting its bow wave") : Fn < 0.4 ? "Displacement" : Fn < 1.0 ? "Semi-planing (hump)" : "Planing";
    return { R: Rw + Rf + air, Rw, Rf, Fn, reg };
  };
  const eta = foil || p.hull === "planing" ? 0.6 : 0.55, P = p.power * 1000;
  let lo = 0.05, hi = 80; if (P * eta / lo < res(lo).R) hi = lo; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (P * eta / mid > res(mid).R) lo = mid; else hi = mid; }
  const vtop = sinks ? 0 : lo, rTop = res(Math.max(vtop, 0.1));
  const hullSpeed = 0.4 * Math.sqrt(g * p.L);
  // stability
  let I; if (cat) { const s = p.B - b; I = 2 * (0.7 * p.L * b ** 3 / 12 + 0.7 * p.L * b * (s / 2) ** 2); } else I = 0.7 * p.L * p.B ** 3 / 12;
  const KB = 0.53 * T, BM = I / V;
  const zc = p.D + p.stack / 2, KG = (hull * p.D * 0.45 + outfit * p.D * 0.85 + keel * -0.2 + engine * p.D * 0.2 + fuel * p.D * 0.25 + p.payload * zc + foils * 0) / m;
  const GM = KB + BM - KG, roll = GM > 0 ? 2 * 0.4 * p.B / Math.sqrt(GM) : Infinity;
  // acceleration run
  const samples = []; if (!sinks && GM > 0) { let v = 0.2, x = 0, tt = 0; while (tt < 240) { const r = res(v), F = Math.min(P * eta / Math.max(v, 0.3), P * 0.05); const acc = (F - r.R) / (m * 1.15); v = Math.max(0.1, v + acc * 0.1); x += v * 0.1; tt += 0.1;
      const Fn = r.Fn, trim = p.hull === "displacement" ? Math.min(4, Fn * 6) : foil && v > vTO ? 1 : Fn < 0.4 ? Fn * 6 : Fn < 1 ? 2.5 + 3.5 * Math.exp(-(((Fn - 0.6) / 0.2) ** 2)) : 3;
      if (Math.round(tt * 10) % 3 === 0) samples.push({ t: tt, x, v, Fn, trim: trim * D2R, lift: foil ? clamp((v / vTO) ** 2, 0, 1) : 0, reg: r.reg, R: r.R }); if (acc < 0.005 && tt > 20) break; } }
  const curve = []; for (let i = 1; i <= 60; i++) { const v = i / 60 * Math.max(vtop * 1.3, hullSpeed * 1.5); const r = res(v); curve.push({ v, R: r.R, Rw: r.Rw, Rf: r.Rf, Pn: r.R * v / eta }); }
  return { kind: "boat", pl, liq, m, V, T, freeboard, sinks, S0, vtop, rTop, hullSpeed, GM, KB, BM, KG, roll, parts, samples, curve, vTO: foil ? vTO : null, kelvin: 19.47, wave: 2 * Math.PI * vtop * vtop / g, pwt: p.power / (m / 1000), capsizes: GM <= 0 };
}

/* =====================================================================
   SUBMARINE
   ===================================================================== */
const ZONES = [[0, "Sunlight zone"], [200, "Twilight zone"], [1000, "Midnight zone"], [4000, "Abyssal zone"], [6000, "Hadal zone"]];
const zoneAt = z => { let n = ZONES[0][1]; for (const [d, k] of ZONES) if (z >= d) n = k; return n; };
function simSub(p) {
  const pl = PLANETS[p.planet] || PLANETS.earth, liq = pl.liquids[p.liquid] || Object.values(pl.liquids)[0];
  if (!liq) return { kind: "sub", noLiquid: true, pl };
  const g = pl.g, rho = liq.rho, nu = liq.nu, M = MATERIALS[p.mat], t = p.wall / 1000;
  const sph = p.shape === "sphere", L = sph ? p.D : p.L, D = p.D, r = D / 2;
  const V = sph ? 4 / 3 * Math.PI * r ** 3 : p.shape === "teardrop" ? 0.72 * Math.PI * r * r * L : Math.PI * r * r * (L - D) + 4 / 3 * Math.PI * r ** 3;
  const Sw = sph ? 4 * Math.PI * r * r : p.shape === "teardrop" ? 0.78 * Math.PI * D * L : Math.PI * D * (L - D) + 4 * Math.PI * r * r;
  const shell = Sw * t * M.rho * (sph ? 1.05 : 1.2), sail = p.sail && !sph ? 0.02 * shell : 0;
  const mach = p.power * 3 + 400 * V, tank = V * clamp(p.ballast, 0, 40) / 100 * rho;
  const Vf = p.foam || 0, foamM = Vf * 480;
  const dry = shell + sail + mach + p.payload + foamM;
  const lead = Math.max(0, rho * (V + Vf) - dry - 0.5 * tank);
  const heavy = dry > rho * (V + Vf) - 0.5 * tank;
  const netAt = f => rho * (V + Vf) - (dry + lead + f * tank); // kg of buoyancy (positive = floats up)
  const canSurface = netAt(0) > 0;
  // pressure hull strength
  const pYield = sph ? 2 * M.sy * t / r : M.sy * t / r;
  const nu2 = 0.3, Lf = Math.min(0.5 * D, 0.6 + 0.04 * D);
  const pBuck = sph ? 0.37 * M.E * (t / r) ** 2 : 2.42 * M.E * Math.pow(t / D, 2.5) / (Math.pow(1 - nu2 * nu2, 0.75) * (Lf / D - 0.45 * Math.sqrt(t / D)));
  const pCrush = Math.min(pYield, pBuck), mode = pYield < pBuck ? "yield" : "buckling";
  const crush = pCrush / (rho * g), test = crush / 1.5;
  // speed
  const f = L / D, FF = sph ? 1 : 1 + 1.5 / Math.pow(f, 1.5) + 7 / f ** 3;
  let v = 3; for (let i = 0; i < 6; i++) { const Re = v * L / nu, Cf = 0.075 / (Math.log10(Math.max(Re, 1e4)) - 2) ** 2; const CdS = sph ? 0.47 * Math.PI * r * r : Cf * FF * Sw * (p.sail ? 1.12 : 1) * 1.1; v = Math.cbrt(2 * p.power * 1000 * 0.7 / (rho * CdS)); }
  const vtop = v, Re = v * L / nu;
  // dive profile: flood to 80%, descend at terminal velocity (+ dive planes), trim neutral near target
  const target = p.target, psurf = pl.isa ? P0 : pl.p0 || 0;
  const zmax = Math.min(target, crush, liq.maxDepth); const samples = []; let z = 0, vz = 0, tt = 0, imploded = false;
  const Aplan = sph ? Math.PI * r * r : D * L * 0.85, Cdx = sph ? 0.47 : 1.0, madd = sph ? 0.5 * rho * V : rho * V;
  const net80 = netAt(0.85);
  if (net80 < 0) {
    let next = 0;
    while (tt < 60000) {
      const nb = netAt(heavy ? 0 : 0.85), mt = dry + lead + 0.85 * tank + madd;
      const F = -nb * g - Math.sign(vz) * 0.5 * rho * vz * vz * Cdx * Aplan;
      const dt = Math.abs(vz) > 0.5 ? 1 : 0.5;
      vz += F / mt * dt; const planes = sph ? 0 : vtop * 0.5 * Math.sin(12 * D2R);
      z += (vz + planes) * dt; tt += dt;
      if (z >= crush && crush < liq.maxDepth) { imploded = true; z = crush; samples.push({ t: tt, z, vz, p: psurf + rho * g * z, ph: "implode" }); break; }
      if (z >= liq.maxDepth) { z = liq.maxDepth; samples.push({ t: tt, z, vz: 0, p: psurf + rho * g * z, ph: "bottom" }); break; }
      if (z >= target && !heavy) { samples.push({ t: tt, z: target, vz: 0, p: psurf + rho * g * target, ph: "hold" }); break; }
      if (tt >= next) { samples.push({ t: tt, z, vz: vz + planes, p: psurf + rho * g * z, ph: "dive" }); next = tt + Math.max(1, tt / 150); }
    }
  }
  const pAt = zz => psurf + rho * g * zz, pT = pAt(Math.min(target, liq.maxDepth));
  return { kind: "sub", pl, liq, V, Sw, m: dry + lead, dry, lead, tank, heavy, canSurface, netAt, crush, test, pYield, pBuck, mode, vtop, Re, f, FF, samples, imploded,
    pT, zoneTarget: zoneAt(Math.min(target, liq.maxDepth)), zoneMax: zoneAt(Math.min(test, liq.maxDepth)), porthole: pT * Math.PI * 0.1 * 0.1, thumb: pT * 1e-4 / G0, parts: { "pressure hull": shell + sail, "machinery & outfit": mach, "crew & payload": p.payload, "buoyancy foam": foamM, "trim lead": lead }, Vf, target, zmax };
}

/* ---------------- Vehicle definitions (params, presets) ---------------- */
const VEHICLES = {
  rocket: { name: "Rocket", verb: "Launch", icon: "rocket",
    presets: {
      classroom: { name: "Classroom rocket", p: { L: 0.6, fin: 15, nose: "ogive", noseR: 3, fins: 3, span: 1.2, root: 1.6, tipR: 0.5, sweep: 0.8, mat: "paper", wall: 1, prop: "solid", motor: "C", payload: 0.01, chute: true, tilt: 2, guidance: "vertical", kick: 4, wind: 3, alt0: 0, stages: 1, eng: "k25", nEng: 1, fill: 85, s2frac: 25, eng2: "h110v", nEng2: 1 } },
      highpower: { name: "High-power amateur", p: { L: 2.4, fin: 16, nose: "ogive", noseR: 4, fins: 4, span: 1.3, root: 2, tipR: 0.4, sweep: 1.2, mat: "fiberglass", wall: 2, prop: "solid", motor: "K", payload: 0.8, chute: true, tilt: 3, guidance: "vertical", kick: 4, wind: 4, alt0: 0, stages: 1, eng: "k25", nEng: 1, fill: 85, s2frac: 25, eng2: "h110v", nEng2: 1 } },
      space: { name: "Balloon-launched space shot", p: { L: 4, fin: 20, nose: "ogive", noseR: 5, fins: 4, span: 3, root: 3, tipR: 0.3, sweep: 1.8, mat: "carbon", wall: 2, prop: "solid", motor: "Q", payload: 10, chute: true, tilt: 1, guidance: "vertical", kick: 4, wind: 3, alt0: 25000, stages: 1, eng: "k25", nEng: 1, fill: 85, s2frac: 25, eng2: "h110v", nEng2: 1 } },
      orbital: { name: "Orbital launcher", p: { L: 62, fin: 17, nose: "ogive", noseR: 3, fins: 0, span: 1, root: 1.5, tipR: 0.5, sweep: 1, mat: "alli", wall: 5, prop: "liquid", motor: "P", payload: 8000, chute: false, tilt: 0, guidance: "orbit", kick: 10, wind: 3, alt0: 0, stages: 2, eng: "k850", nEng: 9, fill: 100, s2frac: 24, eng2: "k980v", nEng2: 1 } }
    } },
  car: { name: "Race car", verb: "Run a lap",
    presets: {
      road: { name: "Sports car", p: { L: 4.5, W: 1.9, H: 1.25, nose: "round", wheels: "covered", ride: 110, wing: "none", wingAng: 8, wingSpan: 1.4, wingChord: 0.3, fwing: false, diff: 3, mat: "aluminum", engine: "gas", power: 350, grip: 1.1, drive: "rwd", alt0: 0 } },
      gt: { name: "GT race car", p: { L: 4.7, W: 2.0, H: 1.15, nose: "wedge", wheels: "covered", ride: 70, wing: "single", wingAng: 10, wingSpan: 1.8, wingChord: 0.35, fwing: true, diff: 8, mat: "carbon", engine: "gas", power: 450, grip: 1.45, drive: "rwd", alt0: 0 } },
      open: { name: "Open-wheel racer", p: { L: 5.4, W: 2.0, H: 0.95, nose: "wedge", wheels: "open", ride: 35, wing: "double", wingAng: 14, wingSpan: 1.0, wingChord: 0.35, fwing: true, diff: 12, mat: "carbon", engine: "gas", power: 750, grip: 1.75, drive: "rwd", alt0: 0 } },
      ev: { name: "EV hypercar", p: { L: 4.6, W: 2.0, H: 1.1, nose: "wedge", wheels: "covered", ride: 90, wing: "single", wingAng: 6, wingSpan: 1.6, wingChord: 0.3, fwing: false, diff: 6, mat: "carbon", engine: "electric", power: 1400, grip: 1.3, drive: "awd", alt0: 0 } }
    } },
  plane: { name: "Aircraft", verb: "Fly",
    presets: {
      trainer: { name: "Light trainer", p: { span: 11, chord: 1.6, taper: 0.7, sweep: 0, airfoil: "n2412", flaps: 0, fuseL: 8, fuseD: 1.2, mat: "aluminum", engine: "prop", power: 130, thrust: 20, nEng: 1, fuel: 12, payload: 250, cruise: 2500, alt0: 0 } },
      glider: { name: "Sailplane", p: { span: 18, chord: 0.95, taper: 0.45, sweep: 0, airfoil: "n4415", flaps: 0, fuseL: 7, fuseD: 0.7, mat: "carbon", engine: "glider", power: 0, thrust: 0, nEng: 1, fuel: 0, payload: 90, cruise: 2000, alt0: 0 } },
      airliner: { name: "Jet airliner", p: { span: 36, chord: 7.5, taper: 0.25, sweep: 25, airfoil: "sc", flaps: 0, fuseL: 38, fuseD: 3.9, mat: "alli", engine: "jet", power: 0, thrust: 120, nEng: 2, fuel: 28, payload: 18000, cruise: 11000, alt0: 0 } },
      evtol: { name: "Electric plane", p: { span: 12, chord: 1.1, taper: 0.6, sweep: 0, airfoil: "n2412", flaps: 0, fuseL: 7, fuseD: 1.1, mat: "carbon", engine: "electric", power: 70, thrust: 0, nEng: 2, fuel: 30, payload: 200, cruise: 2000, alt0: 0 } }
    } },
  drone: { name: "Drone", verb: "Fly mission",
    presets: {
      racer: { name: "FPV racer", p: { rotors: 4, prop: 0.127, power: 450, battery: 22, mat: "carbon", payload: 0.05, wind: 8, alt0: 0 } },
      photo: { name: "Camera drone", p: { rotors: 4, prop: 0.24, power: 180, battery: 77, mat: "carbon", payload: 0.25, wind: 8, alt0: 0 } },
      cargo: { name: "Cargo octocopter", p: { rotors: 8, prop: 0.75, power: 2500, battery: 1500, mat: "aluminum", payload: 15, wind: 10, alt0: 0 } },
      mars: { name: "Mars helicopter", p: { rotors: 2, prop: 1.21, power: 180, battery: 40, mat: "carbon", payload: 0.02, wind: 5, alt0: 0, planet: "mars" } }
    } },
  boat: { name: "Boat", verb: "Speed run",
    presets: {
      trawler: { name: "Displacement cruiser", p: { hull: "displacement", L: 14, B: 4.3, D: 2.2, mat: "fiberglass", wall: 12, power: 180, payload: 2000, stack: 1.5, liquid: "sea" } },
      speed: { name: "Speedboat", p: { hull: "planing", L: 8, B: 2.5, D: 1.2, mat: "fiberglass", wall: 8, power: 260, payload: 400, stack: 0.5, liquid: "sea" } },
      cat: { name: "Racing catamaran", p: { hull: "catamaran", L: 15, B: 8, D: 1.6, mat: "carbon", wall: 8, power: 400, payload: 600, stack: 0.5, liquid: "sea" } },
      foil: { name: "Hydrofoil", p: { hull: "hydrofoil", L: 10, B: 3, D: 1.3, mat: "carbon", wall: 7, power: 200, payload: 500, stack: 0.5, liquid: "sea" } }
    } },
  sub: { name: "Submarine", verb: "Dive",
    presets: {
      research: { name: "Research sub", p: { shape: "teardrop", L: 9, D: 2.4, mat: "titanium", wall: 30, ballast: 12, power: 40, payload: 1200, target: 1500, sail: true, liquid: "sea", foam: 0 } },
      attack: { name: "Attack sub", p: { shape: "teardrop", L: 105, D: 10, mat: "hy100", wall: 55, ballast: 10, power: 25000, payload: 350000, target: 300, sail: true, liquid: "sea", foam: 0 } },
      bathy: { name: "Deep sphere", p: { shape: "sphere", L: 2.2, D: 2.2, mat: "titanium", wall: 90, ballast: 20, power: 8, payload: 400, target: 10900, sail: false, liquid: "sea", foam: 12 } },
      titan: { name: "Titan sea probe", p: { shape: "cylinder", L: 6, D: 1.1, mat: "titanium", wall: 6, ballast: 15, power: 1, payload: 300, target: 250, sail: false, liquid: "methane", planet: "titan", foam: 0 } }
    } }
};

/* ---------------- Controls schema ---------------- */
const MAT_ROCKET = ["paper", "balsa", "pla", "fiberglass", "aluminum", "alli", "carbon", "steel", "titanium"];
const PLANET_ALL = ["earth", "mars", "titan", "venus", "moon"], PLANET_WET = ["earth", "titan"];
const SCHEMA = {
  rocket: [
    { g: "Shape", k: "L", l: "Length", type: "range", min: 0.2, max: 120, log: true, u: "m", d: 2, lesson: "drag" },
    { g: "Shape", k: "fin", l: "Slenderness (length ÷ diameter)", type: "range", min: 6, max: 30, step: 0.5, d: 1, lesson: "drag" },
    { g: "Shape", k: "nose", l: "Nose cone", type: "seg", opts: [["cone", "Cone"], ["ogive", "Ogive"], ["parabolic", "Parabolic"], ["blunt", "Blunt"]], lesson: "mach" },
    { g: "Shape", k: "noseR", l: "Nose length", type: "range", min: 1, max: 8, step: 0.1, u: "× dia", d: 1, lesson: "mach" },
    { g: "Shape", k: "fins", l: "Fins", type: "seg", opts: [[0, "None"], [3, "3"], [4, "4"], [6, "6"]], num: true, lesson: "stability" },
    { g: "Shape", k: "span", l: "Fin span", type: "range", min: 0.3, max: 4, step: 0.05, u: "× dia", d: 2, lesson: "stability", show: p => p.fins > 0 },
    { g: "Shape", k: "root", l: "Fin root chord", type: "range", min: 0.5, max: 4, step: 0.05, u: "× dia", d: 2, lesson: "stability", show: p => p.fins > 0 },
    { g: "Shape", k: "tipR", l: "Fin tip ÷ root", type: "range", min: 0, max: 1, step: 0.05, d: 2, lesson: "stability", show: p => p.fins > 0 },
    { g: "Shape", k: "sweep", l: "Fin sweep", type: "range", min: 0, max: 3, step: 0.05, u: "× dia", d: 2, lesson: "stability", show: p => p.fins > 0 },
    { g: "Structure", k: "mat", l: "Material", type: "mat", opts: MAT_ROCKET, lesson: "materials" },
    { g: "Structure", k: "wall", l: "Wall thickness", type: "range", min: 0.3, max: 30, log: true, u: "mm", d: 1, lesson: "buckling" },
    { g: "Structure", k: "payload", l: "Payload", type: "range", min: 0.001, max: 50000, log: true, u: "kg", d: 3, lesson: "rocketeq" },
    { g: "Propulsion", k: "prop", l: "Propulsion", type: "seg", opts: [["solid", "Solid motor"], ["liquid", "Liquid engines"]], lesson: "thrust" },
    { g: "Propulsion", k: "motor", l: "Motor class", type: "select", opts: Object.keys(MOTORS).map(k => [k, `${k} · ${MOTORS[k][0] >= 1000 ? (MOTORS[k][0] / 1000) + " kN·s" : MOTORS[k][0] + " N·s"}`]), lesson: "thrust", show: p => p.prop === "solid" },
    { g: "Propulsion", k: "stages", l: "Stages", type: "seg", opts: [[1, "1"], [2, "2"]], num: true, lesson: "staging", show: p => p.prop === "liquid" },
    { g: "Propulsion", k: "eng", l: "Booster engine", type: "select", opts: Object.keys(ENGINES).map(k => [k, ENGINES[k].name]), lesson: "rocketeq", show: p => p.prop === "liquid" },
    { g: "Propulsion", k: "nEng", l: "Booster engines", type: "range", min: 1, max: 33, step: 1, d: 0, lesson: "thrust", show: p => p.prop === "liquid" },
    { g: "Propulsion", k: "fill", l: "Tank fill", type: "range", min: 10, max: 100, step: 1, u: "%", d: 0, lesson: "rocketeq", show: p => p.prop === "liquid" },
    { g: "Propulsion", k: "s2frac", l: "Upper stage share of length", type: "range", min: 10, max: 50, step: 1, u: "%", d: 0, lesson: "staging", show: p => p.prop === "liquid" && p.stages === 2 },
    { g: "Propulsion", k: "eng2", l: "Upper stage engine", type: "select", opts: Object.keys(ENGINES).map(k => [k, ENGINES[k].name]), lesson: "staging", show: p => p.prop === "liquid" && p.stages === 2 },
    { g: "Propulsion", k: "nEng2", l: "Upper stage engines", type: "range", min: 1, max: 9, step: 1, d: 0, lesson: "staging", show: p => p.prop === "liquid" && p.stages === 2 },
    { g: "Mission", k: "planet", l: "World", type: "planet", opts: PLANET_ALL, lesson: "planets" },
    { g: "Mission", k: "alt0", l: "Launch altitude", type: "range", min: 0, max: 40000, step: 100, u: "m", d: 0, lesson: "atmosphere" },
    { g: "Mission", k: "guidance", l: "Flight path", type: "seg", opts: [["vertical", "Straight up"], ["turn", "Gravity turn"], ["orbit", "Go to orbit"]], lesson: "orbit", show: p => p.prop === "liquid" },
    { g: "Mission", k: "kick", l: "Pitch-over angle", type: "range", min: 0, max: 20, step: 0.5, u: "°", d: 1, lesson: "orbit", show: p => p.prop === "liquid" && p.guidance !== "vertical" },
    { g: "Mission", k: "tilt", l: "Launch rail tilt", type: "range", min: 0, max: 30, step: 0.5, u: "°", d: 1, lesson: "stability" },
    { g: "Mission", k: "wind", l: "Wind", type: "range", min: 0, max: 20, step: 0.5, u: "m/s", d: 1, lesson: "stability" },
    { g: "Mission", k: "chute", l: "Parachute recovery", type: "toggle", lesson: "drag" }
  ],
  car: [
    { g: "Body", k: "L", l: "Length", type: "range", min: 3, max: 6, step: 0.05, u: "m", d: 2, lesson: "drag" },
    { g: "Body", k: "W", l: "Width", type: "range", min: 1.5, max: 2.2, step: 0.01, u: "m", d: 2, lesson: "drag" },
    { g: "Body", k: "H", l: "Height", type: "range", min: 0.8, max: 1.6, step: 0.01, u: "m", d: 2, lesson: "drag" },
    { g: "Body", k: "nose", l: "Nose", type: "seg", opts: [["wedge", "Wedge"], ["round", "Rounded"], ["blunt", "Blunt"]], lesson: "drag" },
    { g: "Body", k: "wheels", l: "Wheels", type: "seg", opts: [["covered", "Covered"], ["open", "Open"]], lesson: "drag" },
    { g: "Body", k: "ride", l: "Ride height", type: "range", min: 15, max: 200, step: 1, u: "mm", d: 0, lesson: "groundeffect" },
    { g: "Aero devices", k: "wing", l: "Rear wing", type: "seg", opts: [["none", "None"], ["single", "Single"], ["double", "Two-element"]], lesson: "downforce" },
    { g: "Aero devices", k: "wingAng", l: "Wing angle", type: "range", min: 0, max: 25, step: 0.5, u: "°", d: 1, lesson: "stall", show: p => p.wing !== "none" },
    { g: "Aero devices", k: "wingSpan", l: "Wing span", type: "range", min: 0.6, max: 2, step: 0.01, u: "m", d: 2, lesson: "induced", show: p => p.wing !== "none" },
    { g: "Aero devices", k: "wingChord", l: "Wing chord", type: "range", min: 0.15, max: 0.6, step: 0.01, u: "m", d: 2, lesson: "downforce", show: p => p.wing !== "none" },
    { g: "Aero devices", k: "fwing", l: "Front wing", type: "toggle", lesson: "cooling" },
    { g: "Aero devices", k: "diff", l: "Diffuser angle", type: "range", min: 0, max: 20, step: 0.5, u: "°", d: 1, lesson: "groundeffect" },
    { g: "Structure", k: "mat", l: "Chassis material", type: "mat", opts: ["fiberglass", "aluminum", "carbon", "steel", "titanium"], lesson: "materials" },
    { g: "Power", k: "engine", l: "Powertrain", type: "seg", opts: [["gas", "Combustion"], ["electric", "Electric"]], lesson: "drag" },
    { g: "Power", k: "power", l: "Power", type: "range", min: 30, max: 1500, log: true, u: "kW", d: 0, lesson: "drag" },
    { g: "Power", k: "grip", l: "Tire grip (μ)", type: "range", min: 0.7, max: 2, step: 0.01, d: 2, lesson: "downforce" },
    { g: "Power", k: "drive", l: "Drive", type: "seg", opts: [["rwd", "Rear"], ["awd", "All-wheel"]], lesson: "downforce" },
    { g: "Environment", k: "planet", l: "World", type: "planet", opts: ["earth", "mars", "titan", "moon"], lesson: "planets" },
    { g: "Environment", k: "alt0", l: "Track altitude", type: "range", min: 0, max: 5000, step: 50, u: "m", d: 0, lesson: "atmosphere" }
  ],
  plane: [
    { g: "Wing", k: "span", l: "Wingspan", type: "range", min: 1, max: 80, log: true, u: "m", d: 1, lesson: "induced" },
    { g: "Wing", k: "chord", l: "Root chord", type: "range", min: 0.1, max: 12, log: true, u: "m", d: 2, lesson: "lift" },
    { g: "Wing", k: "taper", l: "Taper (tip ÷ root)", type: "range", min: 0.2, max: 1, step: 0.05, d: 2, lesson: "induced" },
    { g: "Wing", k: "sweep", l: "Sweep", type: "range", min: 0, max: 45, step: 1, u: "°", d: 0, lesson: "sweep" },
    { g: "Wing", k: "airfoil", l: "Airfoil", type: "select", opts: Object.keys(AIRFOILS).map(k => [k, AIRFOILS[k].name]), lesson: "stall" },
    { g: "Wing", k: "flaps", l: "Flaps", type: "seg", opts: [[0, "Up"], [1, "15°"], [2, "30°"], [3, "40°"]], num: true, lesson: "stall" },
    { g: "Fuselage", k: "fuseL", l: "Fuselage length", type: "range", min: 0.5, max: 70, log: true, u: "m", d: 1, lesson: "drag" },
    { g: "Fuselage", k: "fuseD", l: "Fuselage diameter", type: "range", min: 0.1, max: 7, log: true, u: "m", d: 2, lesson: "drag" },
    { g: "Fuselage", k: "mat", l: "Material", type: "mat", opts: ["balsa", "fiberglass", "aluminum", "alli", "carbon", "titanium"], lesson: "materials" },
    { g: "Power", k: "engine", l: "Engine", type: "seg", opts: [["glider", "Glider"], ["prop", "Piston prop"], ["electric", "Electric"], ["jet", "Jet"]], lesson: "breguet" },
    { g: "Power", k: "power", l: "Power per engine", type: "range", min: 0.05, max: 5000, log: true, u: "kW", d: 1, lesson: "breguet", show: p => p.engine === "prop" || p.engine === "electric" },
    { g: "Power", k: "thrust", l: "Thrust per engine", type: "range", min: 0.1, max: 400, log: true, u: "kN", d: 1, lesson: "thrust", show: p => p.engine === "jet" },
    { g: "Power", k: "nEng", l: "Engines", type: "range", min: 1, max: 4, step: 1, d: 0, lesson: "thrust", show: p => p.engine !== "glider" },
    { g: "Power", k: "fuel", l: "Fuel / battery share", type: "range", min: 0, max: 60, step: 1, u: "%", d: 0, lesson: "breguet", show: p => p.engine !== "glider" },
    { g: "Mission", k: "payload", l: "Payload", type: "range", min: 0.1, max: 100000, log: true, u: "kg", d: 1, lesson: "lift" },
    { g: "Mission", k: "cruise", l: "Cruise altitude", type: "range", min: 100, max: 20000, step: 100, u: "m", d: 0, lesson: "atmosphere" },
    { g: "Mission", k: "alt0", l: "Airport altitude", type: "range", min: 0, max: 4500, step: 50, u: "m", d: 0, lesson: "atmosphere" },
    { g: "Mission", k: "planet", l: "World", type: "planet", opts: PLANET_ALL, lesson: "planets" }
  ],
  drone: [
    { g: "Rotors", k: "rotors", l: "Rotors", type: "seg", opts: [[2, "2"], [3, "3"], [4, "4"], [6, "6"], [8, "8"]], num: true, lesson: "rotor" },
    { g: "Rotors", k: "prop", l: "Rotor diameter", type: "range", min: 0.05, max: 2, log: true, u: "m", d: 3, lesson: "rotor" },
    { g: "Power", k: "power", l: "Motor power (each)", type: "range", min: 5, max: 10000, log: true, u: "W", d: 0, lesson: "rotor" },
    { g: "Power", k: "battery", l: "Battery", type: "range", min: 1, max: 5000, log: true, u: "Wh", d: 0, lesson: "breguet" },
    { g: "Frame", k: "mat", l: "Frame material", type: "mat", opts: ["balsa", "pla", "fiberglass", "aluminum", "carbon", "titanium"], lesson: "materials" },
    { g: "Frame", k: "payload", l: "Payload", type: "range", min: 0, max: 100, step: 0.01, u: "kg", d: 2, lesson: "thrust" },
    { g: "Mission", k: "wind", l: "Wind", type: "range", min: 0, max: 25, step: 0.5, u: "m/s", d: 1, lesson: "drag" },
    { g: "Mission", k: "alt0", l: "Takeoff altitude", type: "range", min: 0, max: 9000, step: 50, u: "m", d: 0, lesson: "atmosphere" },
    { g: "Mission", k: "planet", l: "World", type: "planet", opts: PLANET_ALL, lesson: "planets" }
  ],
  boat: [
    { g: "Hull", k: "hull", l: "Hull type", type: "seg", opts: [["displacement", "Displacement"], ["planing", "Planing"], ["catamaran", "Catamaran"], ["hydrofoil", "Hydrofoil"]], lesson: "planing" },
    { g: "Hull", k: "L", l: "Length", type: "range", min: 2, max: 400, log: true, u: "m", d: 1, lesson: "froude" },
    { g: "Hull", k: "B", l: "Beam (width)", type: "range", min: 0.5, max: 60, log: true, u: "m", d: 2, lesson: "metacentric" },
    { g: "Hull", k: "D", l: "Hull depth", type: "range", min: 0.3, max: 30, log: true, u: "m", d: 2, lesson: "buoyancy" },
    { g: "Structure", k: "mat", l: "Hull material", type: "mat", opts: ["balsa", "hdpe", "fiberglass", "aluminum", "carbon", "steel", "titanium"], lesson: "materials" },
    { g: "Structure", k: "wall", l: "Hull thickness", type: "range", min: 2, max: 60, log: true, u: "mm", d: 1, lesson: "buoyancy" },
    { g: "Power", k: "power", l: "Engine power", type: "range", min: 1, max: 100000, log: true, u: "kW", d: 0, lesson: "froude" },
    { g: "Cargo", k: "payload", l: "Cargo", type: "range", min: 0, max: 500000, log: true, u: "kg", d: 0, lesson: "buoyancy", logMin: 10 },
    { g: "Cargo", k: "stack", l: "Deck cargo height", type: "range", min: 0, max: 20, step: 0.1, u: "m", d: 1, lesson: "metacentric" },
    { g: "Water", k: "planet", l: "World", type: "planet", opts: PLANET_WET, lesson: "planets" },
    { g: "Water", k: "liquid", l: "Water", type: "liquid", lesson: "buoyancy" }
  ],
  sub: [
    { g: "Hull", k: "shape", l: "Hull shape", type: "seg", opts: [["teardrop", "Teardrop"], ["cylinder", "Cylinder"], ["sphere", "Sphere"]], lesson: "crush" },
    { g: "Hull", k: "L", l: "Length", type: "range", min: 1, max: 200, log: true, u: "m", d: 1, lesson: "drag", show: p => p.shape !== "sphere" },
    { g: "Hull", k: "D", l: "Diameter", type: "range", min: 0.5, max: 15, log: true, u: "m", d: 2, lesson: "crush" },
    { g: "Hull", k: "sail", l: "Sail (conning tower)", type: "toggle", lesson: "drag", show: p => p.shape !== "sphere" },
    { g: "Pressure hull", k: "mat", l: "Hull material", type: "mat", opts: ["acrylic", "fiberglass", "aluminum", "carbon", "steel", "hy100", "titanium"], lesson: "crush" },
    { g: "Pressure hull", k: "wall", l: "Hull thickness", type: "range", min: 3, max: 200, log: true, u: "mm", d: 1, lesson: "crush" },
    { g: "Buoyancy", k: "ballast", l: "Ballast tanks", type: "range", min: 2, max: 40, step: 1, u: "% vol", d: 0, lesson: "buoyancy" },
    { g: "Buoyancy", k: "foam", l: "Buoyancy foam", type: "range", min: 0, max: 60, step: 0.5, u: "m³", d: 1, lesson: "buoyancy" },
    { g: "Buoyancy", k: "payload", l: "Crew & payload", type: "range", min: 50, max: 1000000, log: true, u: "kg", d: 0, lesson: "buoyancy" },
    { g: "Propulsion", k: "power", l: "Propulsion power", type: "range", min: 0.5, max: 60000, log: true, u: "kW", d: 1, lesson: "drag" },
    { g: "Mission", k: "target", l: "Target depth", type: "range", min: 10, max: 11000, log: true, u: "m", d: 0, lesson: "pressure" },
    { g: "Mission", k: "planet", l: "World", type: "planet", opts: PLANET_WET, lesson: "planets" },
    { g: "Mission", k: "liquid", l: "Water", type: "liquid", lesson: "pressure" }
  ]
};

/* ---------------- Report (stats, verdict) ---------------- */
const nf = (v, d = 0) => !isFinite(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const Dm = m => !isFinite(m) ? ["∞", ""] : Math.abs(m) < 1000 ? [nf(m, Math.abs(m) < 10 ? 1 : 0), "m"] : [nf(m / 1000, m < 1e5 ? 1 : 0), "km"];
const Mk = kg => kg < 0 ? (([v, u]) => ["−" + v, u])(Mk(-kg)) : kg < 1 ? [nf(kg * 1000, 0), "g"] : kg < 10000 ? [nf(kg, kg < 10 ? 2 : 0), "kg"] : [nf(kg / 1000, kg < 1e5 ? 1 : 0), "t"];
const Tm = s => !isFinite(s) ? ["—", ""] : s < 90 ? [nf(s, s < 10 ? 1 : 0), "s"] : s < 5400 ? [nf(s / 60, 1), "min"] : [nf(s / 3600, 1), "h"];
const lap = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const row = (k, v, u = "", o = {}) => Object.assign({ k, v, u }, o);
function report(kind, p, r) {
  const H = [], G = []; let V = { lvl: "good", t: "" };
  const grp = (t, rows) => G.push({ t, rows: rows.filter(Boolean) });
  if (kind === "rocket") {
    const g = r.g, pl = r.planet;
    const [av, au] = Dm(r.apogee); H.push({ k: "Apogee", v: av, u: au, sub: (p.alt0 > 0 ? `${Dm(r.apogee + p.alt0).join(" ")} above sea level · ` : "") + (r.karman ? "in space" : Aero_layer(pl, r.apogee + p.alt0)) });
    H.push({ k: "Top speed", v: nf(r.maxV * 3.6), u: "km/h", sub: `Mach ${nf(r.maxM, 2)}` });
    H.push({ k: "Max Q", v: nf(r.maxQ / 1000, 1), u: "kPa", sub: `at ${Dm(r.maxQh + p.alt0).join(" ")} altitude` });
    const [tv, tu] = Tm(r.tFlight); H.push({ k: r.orbit ? "Time to orbit" : "Flight time", v: tv, u: tu, sub: r.orbit ? "orbit insertion" : r.landed ? "to touchdown" : "" });
    if (r.failure && r.failure.k === "pad") V = { lvl: "bad", t: `Never left the pad. Thrust-to-weight is ${nf(r.tw0, 2)}: the engine pushes with less force than the rocket weighs. Use a bigger motor, more engines, or a lighter material.`, tip: "thrust" };
    else if (r.failure) V = { lvl: "bad", t: `Structural failure at T+${nf(r.failure && r.events.find(e => e.k === "fail").t, 1)} s: ${r.failure.label}. ${r.failure.k === "heat" ? "Fly slower in thick air, launch higher, or use a heat-tolerant material." : "Use a thicker wall, a stiffer material, or less thrust."}`, tip: r.failure.k === "heat" ? "heating" : "buckling" };
    else if (r.tumbling) V = { lvl: "bad", t: `Unstable: the center of pressure sits ${r.margin0 < 0 ? "ahead of" : "too close to"} the center of gravity (margin ${nf(r.margin0, 2)} diameters). It tumbled instead of flying straight. Make the fins bigger, move weight to the nose, or use a lighter motor.`, tip: "stability" };
    else if (r.orbit && r.orbit.escape) V = { lvl: "good", t: "Escape velocity! It's leaving the planet for good.", tip: "orbit" };
    else if (r.orbit) V = { lvl: "good", t: `Orbit achieved: ${nf(r.orbit.peri / 1000)} × ${nf(r.orbit.apo / 1000)} km, one lap every ${nf(r.orbit.period / 60)} minutes at ${nf(r.orbit.v / 1000, 2)} km/s.`, tip: "orbit" };
    else if (r.karman) V = { lvl: "good", t: `Reached space: ${Dm(r.apogee).join(" ")} up, past the 100 km Kármán line. To stay up there it would need to go sideways at about 7.8 km/s.`, tip: "orbit" };
    else if (p.chute && r.landV > 12) V = { lvl: "warn", t: `Flew to ${Dm(r.apogee).join(" ")}, but landed hard at ${nf(r.landV, 1)} m/s.`, tip: "drag" };
    else if (!p.chute && r.landed) V = { lvl: "warn", t: `Flew to ${Dm(r.apogee).join(" ")} but came down ballistic at ${nf(r.landV * 3.6)} km/h with no parachute.`, tip: "drag" };
    else V = { lvl: "good", t: `Clean flight to ${Dm(r.apogee).join(" ")}${r.maxM > 1 ? `, breaking the sound barrier at ${Dm(r.mach1 ? r.mach1.h : 0).join(" ")}` : ""}. Stable with a ${nf(r.margin0, 1)}-diameter margin.`, tip: "stability" };
    const st = m => m < 0 ? "bad" : m < 1 ? "warn" : m > 4 ? "warn" : "good";
    grp("Vehicle", [row("Liftoff mass", ...Mk(r.m0)), row("Propellant", ...Mk(r.mprop), { sub: `${nf(r.mprop / r.m0 * 100)}% of liftoff mass` }), row("Dry mass", ...Mk(r.mdry)),
      row("Thrust-to-weight", nf(r.tw0, 2), "", { lvl: r.tw0 < 1 ? "bad" : r.tw0 < 1.3 ? "warn" : "good", tip: "thrust" }), row("Δv budget (ideal)", nf(r.dv), "m/s", { tip: "rocketeq" }),
      g.liquid ? row("Stability", "Active", "", { sub: "gimbaled engines steer", tip: "stability" }) : row("Stability at liftoff", nf(r.margin0, 2), "cal", { lvl: st(r.margin0), tip: "stability" }),
      g.liquid ? null : row("Stability at burnout", nf(r.marginBO, 2), "cal", { lvl: st(r.marginBO), tip: "stability" }),
      row("Drag coefficient", nf(r.cd0, 2), "Cd", { tip: "drag" }), row("Diameter", ...Dm(g.d))]);
    grp("Ascent", [row("Max acceleration", nf(r.maxG, 1), "g"), row("Max Mach", nf(r.maxM, 2), "", { tip: "mach" }), row("Max Q", nf(r.maxQ / 1000, 1), "kPa", { sub: `at ${Dm(r.maxQh).join(" ")}, T+${nf(r.maxQt, 1)} s`, tip: "maxq" }),
      r.mach1 ? row("Sound barrier", ...Dm(r.mach1.h), { sub: `T+${nf(r.mach1.t, 1)} s`, tip: "mach" }) : null,
      r.burnOut ? row("Burnout", ...Dm(r.burnOut.h), { sub: `${nf(r.burnOut.v * 3.6)} km/h` }) : null,
      row("Gravity losses", nf(r.gLoss), "m/s", { tip: "rocketeq" }), row("Drag losses", nf(r.dLoss), "m/s", { tip: "drag" })]);
    const Aa = r.apA, rho0 = atm(pl, 0).rho || 1;
    grp("Apogee", [row("Above launch site", ...Dm(r.apogee)), row("Above sea level", ...Dm(r.apogee + p.alt0)), row("Time to apogee", ...Tm(r.apT)), row("Atmosphere layer", Aero_layer(pl, r.apogee + p.alt0), "", { tip: "atmosphere" }),
      row("Air density there", Aa.rho > 0 ? (Aa.rho / rho0 * 100 < 0.01 ? (Aa.rho / rho0 * 100).toExponential(1) : nf(Aa.rho / rho0 * 100, 2)) : "0", "% of surface", { tip: "atmosphere" }), row("Air temperature there", nf(Aa.Td - 273.15), "°C")]);
    if (r.orbit && !r.orbit.escape) grp("Orbit", [row("Perigee", ...Dm(r.orbit.peri)), row("Apogee", ...Dm(r.orbit.apo)), row("Period", nf(r.orbit.period / 60, 1), "min"), row("Orbital speed", nf(r.orbit.v / 1000, 2), "km/s", { tip: "orbit" })]);
    if (!r.orbit) grp("Recovery", [row("Descent", p.chute ? (r.apogee > 3000 ? "Drogue + main chute" : "Parachute") : "Ballistic"), row("Landing speed", nf(r.landV, 1), "m/s", { lvl: r.landV > 12 ? "bad" : r.landV > 7 ? "warn" : "good" }), row("Downrange", ...Dm(r.range))]);
    grp("Structure & heat", [row("Material", g.M.name), row("Peak skin temperature", nf(r.maxSkin - 273.15), "°C", { bar: clamp((r.maxSkin - 273.15) / g.M.Tmax, 0, 1.2), sub: `limit ${g.M.Tmax} °C`, tip: "heating" }),
      row("Peak load ÷ strength", nf(r.maxStress * 100), "%", { bar: clamp(r.maxStress, 0, 1.2), tip: "buckling" })]);
  }
  if (kind === "car") {
    const a = r.aero;
    H.push({ k: "Top speed", v: nf(r.vtop * 3.6), u: "km/h", sub: r.geared ? "limited by gearing" : "drag = power" });
    H.push({ k: "0–100 km/h", v: nf(r.t100, 2), u: "s", sub: r.t200 ? `0–200 in ${nf(r.t200, 1)} s` : "" });
    H.push({ k: "Lap time", v: lap(r.lapT), u: "", sub: `${nf(r.trackLen / 1000, 2)} km circuit` });
    H.push({ k: "Downforce", v: nf(r.df200), u: "kg", sub: "at 200 km/h" });
    if (a.pl.name === "Moon") V = { lvl: "warn", t: "No air on the Moon: wings and diffusers do nothing. Grip comes only from weight, and there's only 1/6 of it.", tip: "planets" };
    else if (a.porpoise) V = { lvl: "warn", t: "Too low: the floor is choking the airflow and the car porpoises (bounces) at speed. Raise the ride height a little.", tip: "groundeffect" };
    else if (a.wingStall) V = { lvl: "warn", t: "Rear wing stalled: the angle is too steep, so the air separates. You get drag without the downforce. Reduce the wing angle.", tip: "stall" };
    else if (a.ClA < 0) V = { lvl: "warn", t: `The body makes lift, not downforce: the car gets lighter as it speeds up (${nf(-r.df200)} kg lighter at 200 km/h). Add a wing or a diffuser.`, tip: "downforce" };
    else if (a.ClA > 1 && (a.balance < 0.3 || a.balance > 0.62)) V = { lvl: "warn", t: `Aero balance is ${nf(a.balance * 100)}% front. With that much ${a.balance < 0.3 ? "rear" : "front"} downforce the car will ${a.balance < 0.3 ? "understeer" : "oversteer"}. Aim for 40–50%.`, tip: "cooling" };
    else if (r.vUp < r.vtop) V = { lvl: "good", t: `Downforce monster: above ${nf(r.vUp * 3.6)} km/h it makes more downforce than it weighs, so in theory it could drive upside down on a ceiling.`, tip: "downforce" };
    else V = { lvl: "good", t: `Pulls ${nf(r.lat200, 2)} g through fast corners and tops out at ${nf(r.vtop * 3.6)} km/h. Balance ${nf(a.balance * 100)}% front.`, tip: "downforce" };
    grp("Aerodynamics", [row("Drag coefficient", nf(a.Cd, 2), "Cd", { tip: "drag" }), row("Frontal area", nf(a.Afront, 2), "m²"), row("Drag area", nf(a.CdA, 2), "CdA m²", { tip: "drag" }), row("Downforce area", nf(a.ClA, 2), "ClA m²", { tip: "downforce" }),
      row("Downforce ÷ drag", nf(a.ClA / a.CdA, 2), "", { tip: "ld" }), row("Aero balance", nf(a.balance * 100), "% front", { tip: "cooling" }), row("Drag at 200 km/h", nf(r.drag200), "N"), row("Power lost to drag at top speed", nf(r.dragPowerTop / 1000), "kW")]);
    grp("Straight line", [row("Top speed", nf(r.vtop * 3.6), "km/h"), row("0–100 km/h", nf(r.t100, 2), "s"), r.t200 ? row("0–200 km/h", nf(r.t200, 2), "s") : null, r.t300 ? row("0–300 km/h", nf(r.t300, 1), "s") : null, r.qm ? row("Quarter mile", nf(r.qm, 2), "s", { sub: `at ${nf(r.qmV * 3.6)} km/h` }) : null, row("Braking 200→0", nf(r.brake200), "m")]);
    grp("Cornering", [row("Grip at 100 km/h", nf(r.lat100, 2), "g"), row("Grip at 200 km/h", nf(r.lat200, 2), "g", { tip: "downforce" }), row("Slowest corner", nf(r.vMin * 3.6), "km/h"), row("Average lap speed", nf(r.trackLen / r.lapT * 3.6), "km/h"), row("Upside-down speed", isFinite(r.vUp) ? nf(r.vUp * 3.6) : "never", isFinite(r.vUp) ? "km/h" : "", { tip: "downforce" })]);
    grp("Vehicle", [row("Mass", ...Mk(r.m)), row("Power-to-weight", nf(r.pw), "kW/t"), row("Air density", nf(a.rho, 3), "kg/m³", { tip: "atmosphere" })]);
  }
  if (kind === "plane") {
    const P = r.P, pl = r.planet;
    if (p.engine === "glider") { H.push({ k: "Glide distance", v: r.glide ? nf(r.glide.dist / 1000, 1) : "—", u: "km", sub: `from ${Dm(p.cruise).join(" ")}` }); H.push({ k: "Glide ratio", v: nf(r.LDmax, 1), u: ": 1", sub: "best L/D" }); }
    else { H.push({ k: "Cruise speed", v: r.vCr ? nf(r.vCr * 3.6) : "—", u: "km/h", sub: r.Mc ? `Mach ${nf(r.Mc, 2)}` : "" }); H.push({ k: "Range", v: r.range ? nf(r.range / 1000) : "—", u: "km", sub: r.endur ? `${nf(r.endur / 3600, 1)} h aloft` : "" }); }
    H.push({ k: "Ceiling", v: r.svc != null ? Dm(r.svc)[0] : "—", u: r.svc != null ? Dm(r.svc)[1] : "", sub: "service ceiling" });
    H.push({ k: "Stall speed", v: isFinite(r.vs0) ? nf(r.vs0 * 3.6) : "—", u: "km/h", sub: "clean, at the airport" });
    if (!isFinite(r.vs0)) V = { lvl: "bad", t: `No air on the ${pl.name}: wings can't make lift. Only rockets fly here.`, tip: "planets" };
    else if (r.wingMargin < 1) V = { lvl: "bad", t: `The wing would snap in a 3.8 g pull-up (strength margin ${nf(r.wingMargin, 2)}). Use a stronger material, a thicker airfoil, or a shorter span.`, tip: "materials" };
    else if (p.engine !== "glider" && !r.canTO) V = { lvl: "bad", t: `Can't take off: it needs ${nf(r.vLO * 3.6)} km/h to lift off but the engines can't get there. Add power, add wing area, or lighten it.`, tip: "lift" };
    else if (p.engine !== "glider" && !r.reached) V = { lvl: "warn", t: `Can't reach ${Dm(p.cruise).join(" ")}: the air gets too thin at ${Dm(r.ceil || 0).join(" ")}. Add power or wing area.`, tip: "atmosphere" };
    else if (r.Mc && r.Mc > P.Mcrit) V = { lvl: "warn", t: `Cruising at Mach ${nf(r.Mc, 2)}, past this wing's critical Mach (${nf(P.Mcrit, 2)}). Shock waves are adding drag. Sweep the wing or use a supercritical airfoil.`, tip: "sweep" };
    else if (p.engine === "glider") V = { lvl: "good", t: `A ${nf(r.LDmax, 0)}:1 glider. From ${Dm(p.cruise).join(" ")} it glides ${nf(r.glide ? r.glide.dist / 1000 : 0, 1)} km with no engine at all.`, tip: "ld" };
    else V = { lvl: "good", t: `Takes off in ${nf(r.toDist)} m, climbs at ${nf(r.rocSL.roc, 1)} m/s, and cruises at ${nf(r.vCr * 3.6)} km/h with L/D ${nf(r.LDc, 1)}${r.contrail ? ", leaving contrails" : ""}.`, tip: "ld" };
    grp("Wing", [row("Wing area", nf(P.S, 1), "m²"), row("Aspect ratio", nf(P.AR, 1), "", { tip: "induced" }), row("Wing loading", nf(r.wingLoad), "kg/m²", { tip: "lift" }), row("Span efficiency", nf(P.e, 2), "e", { tip: "induced" }), row("Max lift coefficient", nf(P.CLmax, 2), "C_L", { tip: "stall" }), row("Critical Mach", nf(P.Mcrit, 2), "", { tip: "sweep" })]);
    grp("Aerodynamics", [row("Best L/D", nf(r.LDmax, 1), "", { tip: "ld" }), r.LDc ? row("Cruise L/D", nf(r.LDc, 1), "") : null, row("Glide ratio", `${nf(r.LDmax, 0)} : 1`, "", { tip: "ld" })]);
    grp("Performance", [p.engine !== "glider" ? row("Takeoff run", r.toDist ? nf(r.toDist) : "—", "m") : null, row("Liftoff speed", nf(r.vLO * 3.6), "km/h"), p.engine !== "glider" ? row("Climb rate", nf(r.rocSL.roc, 1), "m/s") : null,
      row("Service ceiling", r.svc != null ? Dm(r.svc).join(" ") : "—", "", { tip: "atmosphere" }), r.vCr ? row("Cruise", nf(r.vCr * 3.6), "km/h", { sub: `Mach ${nf(r.Mc, 2)} at ${Dm(r.hc).join(" ")}` }) : null, r.vmaxSL ? row("Top speed (sea level)", nf(r.vmaxSL * 3.6), "km/h") : null]);
    if (r.range) grp("Range", [row("Range", nf(r.range / 1000), "km", { tip: "breguet" }), row("Endurance", nf(r.endur / 3600, 1), "h")]);
    grp("Mass & structure", [row("Takeoff mass", ...Mk(P.m)), row("Empty mass", ...Mk(P.empty)), p.engine !== "glider" ? row(p.engine === "electric" ? "Battery" : "Fuel", ...Mk(P.fuel)) : null, row("Wing strength at 3.8 g", nf(r.wingMargin * 100), "%", { lvl: r.wingMargin < 1 ? "bad" : r.wingMargin < 1.5 ? "warn" : "good", tip: "materials" })]);
  }
  if (kind === "drone") {
    H.push({ k: "Flight time", v: nf(r.tHover / 60, 1), u: "min", sub: "hovering" });
    H.push({ k: "Thrust ÷ weight", v: nf(r.TW, 2), u: "", sub: r.TW >= 2 ? "agile" : r.TW >= 1.02 ? "can hover" : "can't hover" });
    H.push({ k: "Top speed", v: nf(r.vmax * 3.6), u: "km/h", sub: "level flight" });
    H.push({ k: "Climb rate", v: nf(r.climb, 1), u: "m/s", sub: "full power" });
    if (!(r.A.rho > 0)) V = { lvl: "bad", t: `No air on the ${r.pl.name}: rotors have nothing to push against.`, tip: "planets" };
    else if (!r.canHover) V = { lvl: "bad", t: `Can't take off: max thrust is ${nf(r.TW * 100)}% of its weight. ${r.pl.name === "Mars" ? "Mars air is 60× thinner: use much bigger rotors, like Ingenuity's 1.2 m blades." : "Use bigger rotors, more power, or a lighter battery."}`, tip: r.pl.name === "Mars" ? "tipmach" : "rotor" };
    else if (r.tipM > 0.8) V = { lvl: "warn", t: `Blade tips hit Mach ${nf(r.tipM, 2)} just to hover. Near the speed of sound they lose efficiency and get loud. Use bigger, slower rotors.`, tip: "tipmach" };
    else if (!r.windOk) V = { lvl: "warn", t: `It can't hold position in a ${p.wind} m/s wind (top speed ${nf(r.vmax, 1)} m/s). Add power.`, tip: "drag" };
    else V = { lvl: "good", t: `Hovers for ${nf(r.tHover / 60, 1)} minutes, reaches ${nf(r.vmax * 3.6)} km/h, and can carry up to ${Mk(r.payloadMax).join(" ")} of payload.`, tip: "rotor" };
    grp("Rotors", [row("Disk area", nf(r.Atot, 3), "m²"), row("Disk loading", nf(r.discLoad), "N/m²", { tip: "rotor" }), row("Tip Mach at hover", nf(r.tipM, 2), "", { lvl: r.tipM > 0.8 ? "bad" : r.tipM > 0.65 ? "warn" : "good", tip: "tipmach" }), row("Hover rpm", nf(r.rpm), "rpm"), row("Figure of merit", nf(r.FM, 2), "", { tip: "rotor" })]);
    grp("Power", [row("Hover power", nf(r.Ph), "W"), row("Max power", nf(p.power * p.rotors), "W"), row("Efficiency", nf(r.m * 1000 / r.Ph, 1), "g/W")]);
    grp("Mission", [row("Hover time", nf(r.tHover / 60, 1), "min"), row("Range", ...Dm(r.range)), row("Max payload", ...Mk(r.payloadMax)), row("Tilt at top speed", nf(r.tilt * 57.3), "°"), row("Air density", nf(r.A.rho, 3), "kg/m³", { tip: "planets" })]);
    grp("Mass", Object.entries(r.parts).filter(e => e[1] > 0).map(([k, v]) => row(k[0].toUpperCase() + k.slice(1), ...Mk(v))).concat([row("Total", ...Mk(r.m))]));
  }
  if (kind === "boat") {
    if (r.noLiquid) { V = { lvl: "bad", t: `There's no liquid on the ${r.pl.name} to float in.`, tip: "buoyancy" }; H.push({ k: "Top speed", v: "—", u: "" }); return { headline: H, groups: G, verdict: V, events: [] }; }
    H.push({ k: "Top speed", v: nf(r.vtop * 1.944, 1), u: "knots", sub: `${nf(r.vtop * 3.6)} km/h` });
    H.push({ k: "Mode", v: r.rTop.reg.split(" (")[0], u: "", sub: `Froude ${nf(r.rTop.Fn, 2)}` });
    H.push({ k: "Draft", v: nf(r.T, 2), u: "m", sub: `${nf(r.freeboard, 2)} m freeboard` });
    H.push({ k: "Stability GM", v: nf(r.GM, 2), u: "m", sub: r.GM > 0 ? `rolls every ${nf(r.roll, 1)} s` : "capsizes" });
    if (r.sinks) V = { lvl: "bad", t: `It sinks: the hull would need to sit ${nf(r.T, 2)} m deep but is only ${nf(p.D, 2)} m tall. Make it bigger or lighter.`, tip: "buoyancy" };
    else if (r.capsizes) V = { lvl: "bad", t: `It capsizes: the center of gravity is above the metacenter (GM = ${nf(r.GM, 2)} m). Make it wider, or lower the deck cargo.`, tip: "metacentric" };
    else if (r.GM < 0.3) V = { lvl: "warn", t: `Tender: GM is only ${nf(r.GM, 2)} m, so it rolls slowly and could capsize in waves. Widen the beam or lower the cargo.`, tip: "metacentric" };
    else if (r.rTop.reg.includes("cavitating")) V = { lvl: "warn", t: "Foils are cavitating: the water boils off the low-pressure side and drag spikes. That caps foil speed around 50–60 knots.", tip: "planing" };
    else if (p.hull === "displacement" && r.rTop.Fn > 0.45) V = { lvl: "warn", t: `It's fighting its own bow wave: ${nf(r.vtop * 1.944, 1)} kn is past hull speed (${nf(r.hullSpeed * 1.944, 1)} kn), so most of the engine power goes into making waves. A planing hull would break free.`, tip: "froude" };
    else V = { lvl: "good", t: `${r.rTop.reg} at ${nf(r.vtop * 1.944, 1)} knots. Stable with GM ${nf(r.GM, 2)} m.`, tip: r.rTop.Fn > 1 ? "planing" : "froude" };
    grp("Hydrostatics", [row("Displacement", ...Mk(r.m)), row("Draft", nf(r.T, 2), "m", { tip: "buoyancy" }), row("Freeboard", nf(r.freeboard, 2), "m", { lvl: r.freeboard < 0.2 ? "bad" : "good" }), row("Wetted area", nf(r.S0, 1), "m²"), row("Liquid", r.liq.name, "", { sub: `${r.liq.rho} kg/m³` })]);
    grp("Stability", [row("Center of buoyancy KB", nf(r.KB, 2), "m"), row("Metacentric radius BM", nf(r.BM, 2), "m"), row("Center of gravity KG", nf(r.KG, 2), "m"), row("GM", nf(r.GM, 2), "m", { lvl: r.GM <= 0 ? "bad" : r.GM < 0.3 ? "warn" : "good", tip: "metacentric" }), r.GM > 0 ? row("Roll period", nf(r.roll, 1), "s") : null]);
    grp("Speed & resistance", [row("Top speed", nf(r.vtop * 1.944, 1), "kn"), row("Froude number", nf(r.rTop.Fn, 2), "", { tip: "froude" }), row("Hull speed", nf(r.hullSpeed * 1.944, 1), "kn", { tip: "froude" }), row("Resistance at top speed", nf(r.rTop.R / 1000, 1), "kN"),
      row("Wave-making share", nf(r.rTop.Rw / Math.max(r.rTop.R, 1e-6) * 100), "%", { tip: "froude" }), row("Power per tonne", nf(r.pwt, 1), "kW/t"), r.vTO ? row("Foils lift the hull at", nf(r.vTO * 1.944, 1), "kn", { tip: "planing" }) : null]);
    grp("Wake", [row("Kelvin wake angle", "19.47", "°", { tip: "kelvin" }), row("Wave length at top speed", nf(r.wave, 1), "m")]);
  }
  if (kind === "sub") {
    if (r.noLiquid) { V = { lvl: "bad", t: `There's no ocean on the ${r.pl.name}.`, tip: "buoyancy" }; H.push({ k: "Crush depth", v: "—", u: "" }); return { headline: H, groups: G, verdict: V, events: [] }; }
    H.push({ k: "Crush depth", v: Dm(r.crush)[0], u: Dm(r.crush)[1], sub: `fails by ${r.mode}` });
    H.push({ k: "Safe test depth", v: Dm(r.test)[0], u: Dm(r.test)[1], sub: r.zoneMax });
    H.push({ k: "Top speed", v: nf(r.vtop * 1.944, 1), u: "knots", sub: "submerged" });
    const last = r.samples[r.samples.length - 1];
    H.push({ k: "Dive time", v: last ? Tm(last.t)[0] : "—", u: last ? Tm(last.t)[1] : "", sub: last ? `to ${Dm(last.z).join(" ")}` : "can't dive" });
    const tgt = Math.min(p.target, r.liq.maxDepth);
    if (r.imploded) V = { lvl: "bad", t: `Imploded at ${Dm(r.crush).join(" ")}: the ${r.mode === "yield" ? "metal yielded" : "hull buckled"} under ${nf(r.pYield < r.pBuck ? r.pYield / 101325 : r.pBuck / 101325)} atmospheres. Use a thicker hull, a stronger material, or a sphere.`, tip: "crush" };
    else if (!r.canSurface) V = { lvl: "bad", t: "Too heavy to float: even with empty tanks it sinks, so it could never come back up. Add buoyancy foam or use a thinner, lighter hull.", tip: "buoyancy" };
    else if (!r.samples.length) V = { lvl: "warn", t: "Too buoyant to dive: flooding the tanks isn't enough to sink it. Enlarge the ballast tanks or add payload.", tip: "buoyancy" };
    else if (tgt > r.test) V = { lvl: "warn", t: `Reached ${Dm(tgt).join(" ")}, beyond the safe test depth of ${Dm(r.test).join(" ")}. It's using up its safety margin.`, tip: "crush" };
    else V = { lvl: "good", t: `Dives to ${Dm(tgt).join(" ")} in the ${r.zoneTarget.toLowerCase()} at ${nf(r.pT / 101325)} atmospheres, with room to spare down to ${Dm(r.test).join(" ")}.`, tip: "pressure" };
    grp("Hull", [row("Volume", nf(r.V, 1), "m³"), row("Mass", ...Mk(r.m)), row("Fineness (L ÷ D)", nf(r.f, 1), "", { tip: "drag" }), row("Wetted area", nf(r.Sw, 1), "m²"), row("Trim lead", ...Mk(r.lead)), row("Buoyancy, tanks empty", ...Mk(r.netAt(0)), { lvl: r.netAt(0) > 0 ? "good" : "bad", tip: "buoyancy" }), row("Buoyancy, tanks flooded", ...Mk(r.netAt(1)), { tip: "buoyancy" })]);
    grp("Pressure", [row("Crush depth", ...Dm(r.crush), { sub: `${r.mode} limit`, tip: "crush" }), row("Test depth", ...Dm(r.test)), row("Pressure at target", nf(r.pT / 101325), "atm", { tip: "pressure" }), row("Force on a 20 cm porthole", nf(r.porthole / 9806.65, 1), "tonnes"), row("On your thumbnail", nf(r.thumb), "kg", { tip: "pressure" }), row("Deepest zone (safe)", r.zoneMax)]);
    grp("Hydrodynamics", [row("Form factor", nf(r.FF, 2), "", { tip: "drag" }), row("Top speed", nf(r.vtop * 1.944, 1), "kn"), row("Reynolds number", r.Re.toExponential(1), "", { tip: "reynolds" })]);
  }
  return { headline: H, groups: G, verdict: V, events: kind === "rocket" ? r.events : [] };
}
function Aero_layer(pl, h) { return layer(pl, h); }

function run(kind, p) {
  if (kind === "rocket") return simRocket(p);
  if (kind === "car") return simCar(p);
  if (kind === "plane") return simPlane(p);
  if (kind === "drone") return simDrone(p);
  if (kind === "boat") return simBoat(p);
  if (kind === "sub") return simSub(p);
}

const api = { SCHEMA, report, nf, Dm, Mk, Tm, G0, PLANETS, MATERIALS, MOTORS, ENGINES, PROPELLANTS, AIRFOILS, LESSONS, VEHICLES, ZONES, atm, layer, zoneAt, motorInfo, rocketGeom, rocketMass, rocketCd, simRocket, simCar, simPlane, simDrone, simBoat, simSub, carAero, planeModel, buildTrack, setTrack, run };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Aero = api;
})(typeof window !== "undefined" ? window : globalThis);
