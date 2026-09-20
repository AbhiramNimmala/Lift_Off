/* LiftOff Aero Studio: the Academy. Step-by-step lessons for complete beginners:
   short explanations with animated diagrams, quick questions, and hands-on steps in the real lab. */
(() => {
"use strict";
const A = window.Aero, $ = id => document.getElementById(id), S = window.STUDIO, API = () => window.STUDIO_API;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), PI = Math.PI;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

/* ================================================================= LAB SETUP HELPERS */
const T = () => (S.mode === "tunnel" && S._tun ? S._tun : null);
function lab(kind, preset, extra, mode, tun) {
  return () => { const api = API(); api.pushHist(); api.loadVehicle(kind, preset); if (extra) { Object.assign(S.p, extra); api.rebuild(); }
    api.setMode(mode || "build");
    if (mode === "tunnel" && tun) { if (tun.speed != null) $("tSpeed").value = tun.speed; if (tun.aoa != null) $("tAoa").value = tun.aoa; api.tunnelUI(); } };
}
function focusCtl(key) { if (!key) return; setTimeout(() => { const c = A.SCHEMA[S.kind].find(x => x.k === key); if (!c) return; const el = [...document.querySelectorAll("#controls .ctl")].find(w => w.querySelector(".lab span") && w.querySelector(".lab span").textContent.trim().startsWith(c.l)); document.querySelectorAll(".ctl.pulse").forEach(e => e.classList.remove("pulse")); if (el) { el.classList.add("pulse"); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 250); }
function focusEl(sel) { setTimeout(() => { const el = document.querySelector(sel); if (el) { el.classList.add("apulse"); el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => el.classList.remove("apulse"), 6000); } }, 250); }

/* ================================================================= CURRICULUM */
const U = [
  { t: "Air is real stuff", sub: "Drag and shape", L: [
    { id: "u1l1", t: "Air pushes back", min: 2, steps: [
      { k: "read", dg: "air", t: "Air is made of stuff", x: "Air feels like nothing, but it's made of trillions of tiny molecules zooming around. Anything that moves has to shove them out of the way. The push you feel back is called <b>drag</b>. Hold your hand out of a car window and you feel it." },
      { k: "read", dg: "speed2", t: "Faster means much more push", x: "Here's the surprise: go <b>twice as fast</b> and drag gets <b>four times</b> bigger. Three times as fast? <b>Nine times</b> the drag. Engineers say drag grows with speed <i>squared</i>. It's why fast things are shaped so carefully." },
      { k: "quiz", q: "A cyclist speeds up from 10 km/h to 30 km/h: three times faster. How much more drag does she feel?", o: ["3 times more", "6 times more", "9 times more", "The same"], a: 2, why: "Drag grows with speed × speed. 3 × 3 = 9 times the push." },
      { k: "lab", t: "Feel it in the wind tunnel", x: "Drag the <b>Wind speed</b> slider from slow all the way to fast. Watch the orange <b>Drag</b> arrow grow.", setup: lab("car", "gt", null, "tunnel", { speed: 0.12, aoa: 0 }), el: "#tSpeed", check: () => T() && T().frac >= 0.85, ok: "Four times the speed, sixteen times the push. That's speed squared." },
      { k: "read", dg: "speed2", t: "Remember", x: "<b>Drag</b> is the air pushing back on anything that moves through it. It grows with speed <b>squared</b>: double the speed, four times the drag." }
    ] },
    { id: "u1l2", t: "Shape matters", min: 2, steps: [
      { k: "read", dg: "shapes", t: "Blunt vs smooth", x: "Two objects the same size can have very different drag. A flat plate stops the air dead and leaves a big swirling wake. A smooth, pointed shape lets air slide around it and close up neatly behind." },
      { k: "quiz", q: "Why are fish, birds and jets pointy at the front and tapered at the back?", o: ["It looks cool", "So water or air slides around them smoothly", "To make them heavier", "It doesn't matter"], a: 1, why: "Smooth shapes let the flow slide around without a big swirling wake, so there's much less drag." },
      { k: "lab", t: "Blunt vs pointed", x: "This rocket has a flat, blunt nose. Switch the <b>Nose cone</b> to <b>Ogive</b> (a smooth pointed curve) and watch <b>How high it goes</b>.", setup: () => { lab("rocket", "highpower", { nose: "blunt" })(); focusCtl("nose"); }, check: () => S.kind === "rocket" && S.p.nose !== "blunt", ok: "The pointed nose lets air slide around instead of slamming into it, so it flies higher." },
      { k: "read", dg: "shapes", t: "The tail matters too", x: "Behind a blunt back end, the air swirls into a low-pressure wake that pulls backward like a vacuum. That's why a <b>teardrop</b>, round in front and tapered behind, is the lowest-drag shape of all." }
    ] }
  ] },
  { t: "How things fly", sub: "Lift, weight, thrust, drag", L: [
    { id: "u2l1", t: "The four forces", min: 2, steps: [
      { k: "read", dg: "forces", t: "Four forces, always", x: "Everything that flies feels four forces. <b>Weight</b> pulls it down. <b>Lift</b> holds it up. <b>Thrust</b> pushes it forward. <b>Drag</b> holds it back. Flying is keeping these four in balance." },
      { k: "quiz", q: "A plane cruises at a steady speed and height. Which is true?", o: ["Lift is bigger than weight", "Lift equals weight, and thrust equals drag", "There's no drag while cruising", "Thrust equals weight"], a: 1, why: "Steady flight means balanced forces. If lift beat weight it would climb; if drag beat thrust it would slow down." },
      { k: "lab", t: "Meet the forces", x: "Green = <b>lift</b>, gray = <b>weight</b>, orange = <b>drag</b>. Raise the <b>Wind speed</b> until lift holds up 100% of the weight.", setup: lab("plane", "trainer", null, "tunnel", { speed: 0.12, aoa: 5 }), el: "#tSpeed", check: () => T() && T().kind === "plane" && T().raw.lift >= T().raw.weight, ok: "That's the slowest this plane can fly at this tilt. Any slower and the wing can't hold it up." }
    ] },
    { id: "u2l2", t: "How a wing makes lift", min: 2, steps: [
      { k: "read", dg: "wing", t: "Push air down, get pushed up", x: "A wing meets the air tilted slightly up (its <b>angle of attack</b>) and is curved on top. It turns the passing air <b>downward</b>. Push air down, and the air pushes the wing up. That's <b>lift</b>." },
      { k: "read", dg: "wingp", t: "The pressure view", x: "Air rushing over the curved top speeds up, and its <b>pressure drops</b>. Air underneath slows and pushes a bit harder. Low pressure above plus higher pressure below lifts the wing. It's the same lift, explained two ways." },
      { k: "quiz", q: "What happens to lift if you tilt the wing a little more into the wind?", o: ["More lift", "Less lift", "No change"], a: 0, why: "More tilt turns more air downward, so there's more lift, up to a limit (you'll meet that limit next)." },
      { k: "lab", t: "Tilt it", x: "Raise <b>Tilt into the wind</b> to 10° and watch the green lift arrow grow.", setup: lab("plane", "trainer", null, "tunnel", { speed: 0.25, aoa: 2 }), el: "#tAoa", check: () => T() && T().kind === "plane" && T().aoa >= 10, ok: "More tilt, more air turned downward, more lift." }
    ] },
    { id: "u2l3", t: "Stall", min: 2, steps: [
      { k: "read", dg: "stall", t: "When a wing gives up", x: "Tilt a wing too far, usually past about 15°, and the air can't follow the curved top anymore. It breaks away into swirls and <b>lift suddenly collapses</b>. That's a <b>stall</b>. It has nothing to do with the engine." },
      { k: "lab", t: "Stall the wing", x: "Keep tilting: raise <b>Tilt into the wind</b> past 18° and watch the airflow on top and the lift.", setup: lab("plane", "trainer", null, "tunnel", { speed: 0.3, aoa: 10 }), el: "#tAoa", check: () => T() && T().kind === "plane" && T().raw.stall, ok: "Stalled! The flow broke away from the top and lift fell off a cliff." },
      { k: "quiz", q: "A stall happens when…", o: ["The engine stops", "The wing tilts so far that air breaks away from its top", "The plane flies too high", "It runs out of fuel"], a: 1, why: "A stall is about airflow over the wing, not the engine. Pilots recover by lowering the nose." }
    ] }
  ] },
  { t: "Staying stable", sub: "Why things fly straight or tip over", L: [
    { id: "u3l1", t: "Balance point and push point", min: 3, steps: [
      { k: "read", dg: "cgcp", t: "Two special points", x: "Every object has a <b>balance point</b> (center of gravity, CG), where its weight acts, and a <b>push point</b> (center of pressure, CP), where the air's push acts. To fly straight, the push point must sit <b>behind</b> the balance point." },
      { k: "read", dg: "cgcp", t: "Like a weathervane", x: "Knock the nose sideways and the air pushes on the fins at the back, swinging the nose back into the wind, like a weathervane or a dart. If the push point is in front instead, the air swings it the wrong way and it <b>tumbles</b>." },
      { k: "quiz", q: "You put bigger fins on the back of a rocket. Its push point moves…", o: ["Toward the back: more stable", "Toward the front: less stable", "It doesn't move"], a: 0, why: "Bigger fins catch more air at the back, which pulls the push point backward. More stable." },
      { k: "lab", t: "Make it tumble", x: "Shrink the <b>Fin span</b> slider until <b>Flies straight?</b> says <b>No</b>.", setup: () => { lab("rocket", "classroom")(); focusCtl("span"); }, check: () => S.kind === "rocket" && S.r && !S.r.g.liquid && S.r.margin0 < 0.3, ok: "The push point slid in front of the balance point. It would tumble." },
      { k: "lab", t: "Fix it", x: "Now bring the fins back until <b>Flies straight?</b> says <b>Yes</b>.", setup: () => focusCtl("span"), check: () => S.kind === "rocket" && S.r && S.r.margin0 >= 1, ok: "Fixed. Engineers aim for the push point 1 to 2 body widths behind the balance point." }
    ] },
    { id: "u3l2", t: "Why boats don't tip over", min: 2, steps: [
      { k: "read", dg: "boat", t: "The water pushes back", x: "A boat's weight pulls down at its balance point. The water pushes up at the middle of the underwater part. When a <b>wide</b> boat leans, more of one side sinks in, the water's push shifts sideways and swings it back upright." },
      { k: "read", dg: "boatx", t: "Too tall, too narrow", x: "Stack heavy cargo high, or make the boat narrow, and the balance point climbs too high. Now leaning makes it lean even more, and it <b>capsizes</b>." },
      { k: "lab", t: "Capsize the speedboat", x: "Raise <b>Deck cargo height</b> until <b>Hard to tip over?</b> says <b>No</b>.", setup: () => { lab("boat", "speed", { payload: 1500, stack: 1 })(); focusCtl("stack"); }, check: () => S.kind === "boat" && S.r && S.r.capsizes, ok: "Over it goes. Weight up high makes a boat tippy." },
      { k: "quiz", q: "Which boat is hardest to tip over?", o: ["Tall and narrow", "Wide, with heavy cargo down low", "Narrow, with cargo stacked high"], a: 1, why: "Wide and low: the water's push swings it back upright before it can go over." }
    ] }
  ] },
  { t: "High and fast", sub: "Thin air, sound barrier, rockets", L: [
    { id: "u4l1", t: "The air gets thin", min: 2, steps: [
      { k: "read", dg: "layers", t: "Less air as you climb", x: "Air is thickest at the ground. About every 5.5 km up, half of it is gone. At the height airliners fly (11 km) only a quarter is left. At 100 km, the edge of space, there's almost none." },
      { k: "quiz", q: "Why do airliners cruise around 11 km up?", o: ["It's colder up there", "Thin air means less drag, so they burn less fuel", "To avoid birds", "Only because of air traffic rules"], a: 1, why: "Less air to push through means less drag, so each kilometre costs less fuel." },
      { k: "lab", t: "Launch from high up", x: "Most of a rocket's drag happens in thick air near the ground. Raise the <b>Launch altitude</b> to 20 km or more (like launching from a balloon) and watch <b>How high it goes</b>.", setup: () => { lab("rocket", "space", { alt0: 0 })(); focusCtl("alt0"); }, check: () => S.kind === "rocket" && S.p.alt0 >= 20000, ok: "Starting above most of the air, the same rocket flies many times higher." }
    ] },
    { id: "u4l2", t: "The sound barrier", min: 2, steps: [
      { k: "read", dg: "mach", t: "Sound is a wave", x: "Sound is a pressure wave moving through air at about 1,200 km/h. A slow plane's sound spreads out ahead of it. At the speed of sound the waves can't get away. They pile up into a <b>shock wave</b>: the sonic boom." },
      { k: "lab", t: "Break the sound barrier", x: "Push the <b>Wind speed</b> past <b>Mach 1</b> and watch the white shock cone appear at the nose.", setup: lab("rocket", "highpower", null, "tunnel", { speed: 0.14, aoa: 0 }), el: "#tSpeed", check: () => T() && T().kind === "rocket" && T().raw.mach > 1.02, ok: "Supersonic! The cone is the shock wave, and drag jumps across it." },
      { k: "quiz", q: "What is Mach 2?", o: ["2,000 km/h", "Twice the speed of sound", "Twice as fast as a car"], a: 1, why: "Mach number is speed compared to the speed of sound. Mach 2 is twice as fast as sound." }
    ] },
    { id: "u4l3", t: "How rockets work", min: 2, steps: [
      { k: "read", dg: "rocket", t: "Throw stuff, get pushed", x: "A rocket throws hot exhaust out the back very fast. Push stuff one way and you're pushed the other way: that's <b>thrust</b>. Rockets don't need air to push against, so they work in space." },
      { k: "read", dg: "rocket", t: "Lighter and lighter", x: "As it burns fuel it gets lighter, so the same push speeds it up more and more. That's why most of a rocket is fuel tank, and why big rockets drop their empty stages." },
      { k: "lab", t: "Bigger motor", x: "Pick a bigger <b>Motor class</b> until this classroom rocket flies higher than 350 m.", setup: () => { lab("rocket", "classroom")(); focusCtl("motor"); }, check: () => S.kind === "rocket" && S.r && S.r.apogee > 350, ok: "Each motor letter has about twice the push of the one before." },
      { k: "quiz", q: "Why do big rockets drop their empty lower stage?", o: ["It's too hot to keep", "To stop carrying dead weight", "It's required by law"], a: 1, why: "An empty tank is dead weight. Dropping it lets the upper stage speed up much more with the fuel it has left." }
    ] }
  ] },
  { t: "Water worlds", sub: "Floating, pressure, waves", L: [
    { id: "u5l1", t: "Why things float", min: 2, steps: [
      { k: "read", dg: "float", t: "Water pushes up", x: "Put something in water and it pushes water out of the way. The water pushes back up with a force equal to the <b>weight of the water it moved</b>. If that beats the object's weight, it floats." },
      { k: "quiz", q: "A steel ship floats but a steel ball sinks. Why?", o: ["Ships use lighter steel", "The hollow ship pushes aside much more water for its weight", "Salt water holds it up", "The engines hold it up"], a: 1, why: "A hollow hull moves a lot of water for very little steel, so the water's push up beats its weight." },
      { k: "lab", t: "Load it until it sinks", x: "Add <b>Cargo</b> and watch <b>Sits in the water</b> go deeper. Keep going until it sinks.", setup: () => { lab("boat", "trawler")(); focusCtl("payload"); }, check: () => S.kind === "boat" && S.r && S.r.sinks, ok: "Too heavy: it would need to push aside more water than its hull can." }
    ] },
    { id: "u5l2", t: "Pressure grows with depth", min: 3, steps: [
      { k: "read", dg: "pressure", t: "Water is heavy", x: "Every 10 m down, the water above adds another <b>atmosphere</b> of squeeze. At the bottom of the Mariana Trench (11 km) it's over <b>1,000 times</b> the air pressure around you: like a car balanced on your thumbnail." },
      { k: "lab", t: "Crush it", x: "Raise the <b>Target depth</b> past this sub's crush depth. Then press <b>Dive</b> if you want to watch.", setup: () => { lab("sub", "research")(); focusCtl("target"); }, check: () => S.kind === "sub" && S.r && S.p.target > S.r.crush, ok: "Past the crush depth. The hull can't hold back the squeeze." },
      { k: "read", dg: "pressure", t: "How engineers fight back", x: "A <b>sphere</b> spreads the squeeze evenly, and thick, strong walls resist it. That's why the deepest subs ever built are balls of thick titanium." },
      { k: "quiz", q: "About how much pressure does a diver feel 30 m down?", o: ["1 atmosphere", "4 atmospheres", "30 atmospheres"], a: 1, why: "1 atmosphere of air on top, plus 3 more from 30 m of water: 4 in total." }
    ] },
    { id: "u5l3", t: "Bow waves and planing", min: 2, steps: [
      { k: "read", dg: "wave", t: "Stuck behind a wave", x: "A boat pushing through water makes a bow wave. The faster it goes, the longer that wave gets. Once the wave is as long as the boat, the boat is stuck climbing its own wave: its <b>hull speed</b>." },
      { k: "read", dg: "plane", t: "Skimming on top", x: "A flat-bottomed boat with lots of power climbs on top of its bow wave and <b>skims</b> across the surface, like a skipping stone. That's <b>planing</b>, and it's how speedboats go so fast." },
      { k: "lab", t: "Get on plane", x: "Switch this cruiser's <b>Hull type</b> to <b>Planing</b>, then add <b>Engine power</b> until it skims.", setup: () => { lab("boat", "trawler")(); focusCtl("hull"); }, check: () => S.kind === "boat" && S.r && !S.r.noLiquid && S.r.rTop.reg === "Planing", ok: "On plane! It's riding on top of the water instead of plowing through it." }
    ] }
  ] },
  { t: "Rotors and other worlds", sub: "Drones, Mars and Titan", L: [
    { id: "u6l1", t: "How drones fly", min: 2, steps: [
      { k: "read", dg: "rotor", t: "Spinning wings", x: "Each rotor is a spinning wing. It throws air <b>downward</b>, and the air pushes the drone up. Hovering costs power every second, which is why drone batteries run out fast." },
      { k: "read", dg: "rotor", t: "Big and slow wins", x: "Moving a lot of air gently takes less power than moving a little air hard. So <b>big, slow rotors</b> are more efficient than small, fast ones. That's why helicopters have such long blades." },
      { k: "quiz", q: "Why do helicopters have such long blades?", o: ["To look impressive", "Moving lots of air slowly takes less power", "They're safer"], a: 1, why: "Big rotors push a lot of air gently, which is the most efficient way to make lift." },
      { k: "lab", t: "Longer flight", x: "Make this drone fly longer than <b>45 minutes</b>. Try a bigger <b>Battery</b> or bigger rotors.", setup: () => { lab("drone", "photo")(); focusCtl("battery"); }, check: () => S.kind === "drone" && S.r && S.r.tHover / 60 > 45, ok: "More stored energy, or more efficient rotors, means longer in the air." }
    ] },
    { id: "u6l2", t: "Flying on other worlds", min: 2, steps: [
      { k: "read", dg: "planets", t: "New rules", x: "Mars has 38% of Earth's gravity but only <b>1% of its air</b>, so wings and rotors have almost nothing to push on. Titan, Saturn's moon, has thick air and weak gravity: a person could strap on wings and fly." },
      { k: "lab", t: "Fly on Mars", x: "This drone can't lift off on Mars. Make its <b>Rotor diameter</b> bigger until it can.", setup: () => { lab("drone", "photo", { planet: "mars" })(); focusCtl("prop"); }, check: () => S.kind === "drone" && S.p.planet === "mars" && S.r && S.r.canHover, ok: "It flies! In thin air each rotor needs to be much bigger, just like NASA's Ingenuity." },
      { k: "quiz", q: "Why did NASA's Ingenuity helicopter on Mars need big, very fast rotors?", o: ["Mars is very windy", "The air is so thin each rotor has little to push on", "Mars gravity is stronger"], a: 1, why: "Thin air means each sweep of the rotor moves very little air, so it needs big blades spinning fast." }
    ] }
  ] }
];
const ALL = []; U.forEach((u, ui) => u.L.forEach((l, li) => ALL.push({ ...l, ui, li, unit: u })));

/* ================================================================= DIAGRAMS (animated canvas) */
const DG = {};
const col = { holo: "#58e1ff", holo2: "#8cf0ff", acc: "#ff7a3d", good: "#53f2a6", warn: "#ffd166", bad: "#ff5d6c", mut: "#8aa3bf", ink: "#e8f3ff", gray: "#9aa6b5" };
function arrow(g, x0, y0, x1, y1, c, w = 3, lbl) { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0), h = 6 + w * 2; g.beginPath(); g.moveTo(x1 + Math.cos(a) * 2, y1 + Math.sin(a) * 2); g.lineTo(x1 - Math.cos(a - 0.45) * h, y1 - Math.sin(a - 0.45) * h); g.lineTo(x1 - Math.cos(a + 0.45) * h, y1 - Math.sin(a + 0.45) * h); g.closePath(); g.fill(); if (lbl) { g.font = "600 12px IBM Plex Sans, Arial"; g.fillText(lbl, x1 + (x1 >= x0 ? 8 : -8 - g.measureText(lbl).width), y1 + (y1 > y0 ? 14 : -6)); } }
function txt(g, s, x, y, c = col.mut, size = 12, align = "left") { g.font = `600 ${size}px IBM Plex Sans, Arial`; g.fillStyle = c; g.textAlign = align; g.fillText(s, x, y); g.textAlign = "left"; }
const parts = {};
function flowParts(id, n, W, H) { if (!parts[id] || parts[id].W !== W) parts[id] = { W, P: Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8 })) }; return parts[id].P; }
function airfoil(g, cx, cy, c, a, fill = "rgba(88,225,255,.18)", stroke = col.holo) { g.save(); g.translate(cx, cy); g.rotate(-a); g.beginPath(); for (let i = 0; i <= 40; i++) { const x = i / 40, t = 0.12, yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4), yc = 0.04 / 0.16 * (0.8 * x - x * x) * (x < 0.4 ? 1 : 0.16 / 0.36 * (0.36 / 0.16)); g.lineTo((x - 0.35) * c, -(yc + yt) * c); } for (let i = 40; i >= 0; i--) { const x = i / 40, t = 0.12, yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4), yc = 0.04 / 0.16 * (0.8 * x - x * x); g.lineTo((x - 0.35) * c, -(yc - yt) * c); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); g.restore(); }
DG.air = (g, W, H, t) => { const P = flowParts("air", 170, W, H), px = W * 0.62; g.fillStyle = col.gray; g.fillRect(px, H * 0.25, 10, H * 0.5); txt(g, "your hand", px - 14, H * 0.2, col.ink, 12);
  for (const p of P) { p.x -= 1.4 * p.s; p.y += (Math.random() - 0.5) * 0.8; if (p.x > px - 30 && p.x < px + 12 && p.y > H * 0.24 && p.y < H * 0.76) { p.x = px + 12 + Math.random() * 4; } if (p.x < 0) { p.x = W; p.y = Math.random() * H; } const bunch = p.x > px && p.x < px + 40 && p.y > H * 0.24 && p.y < H * 0.76; g.fillStyle = bunch ? col.acc : "rgba(140,240,255,.7)"; g.beginPath(); g.arc(p.x, p.y, bunch ? 2.6 : 2, 0, 7); g.fill(); }
  arrow(g, px - 6, H * 0.5, px - 60, H * 0.5, col.acc, 4, "drag"); txt(g, "air molecules →", 12, H - 12, col.mut); };
DG.speed2 = (g, W, H, t) => { const k = (t * 0.5) % 3, bars = [1, 2, 3]; txt(g, "speed", 24, 22, col.holo2, 12); txt(g, "drag", W / 2 + 14, 22, col.acc, 12);
  bars.forEach((s, i) => { const on = k >= i, y = 44 + i * ((H - 70) / 3), bh = (H - 90) / 3 * 0.7; g.fillStyle = on ? col.holo : "rgba(88,225,255,.15)"; g.fillRect(24, y, (W / 2 - 60) * s / 3, bh); txt(g, `${s}×`, 30 + (W / 2 - 60) * s / 3, y + bh * 0.7, col.ink, 13);
    const d = s * s, grow = on ? clamp((k - i) * 2, 0, 1) : 0; g.fillStyle = col.acc; g.globalAlpha = on ? 1 : 0.15; g.fillRect(W / 2 + 14, y, (W / 2 - 60) * d / 9 * (on ? grow : 1), bh); g.globalAlpha = 1; txt(g, `${d}×`, W / 2 + 20 + (W / 2 - 60) * d / 9, y + bh * 0.7, col.ink, 13); }); };
DG.shapes = (g, W, H, t) => { const P = flowParts("shapes", 220, W, H), mid = H / 2, cxA = W * 0.28, cxB = W * 0.72;
  g.fillStyle = col.gray; g.fillRect(cxA - 4, H * 0.3, 8, H * 0.4); g.save(); g.translate(cxB, mid); g.beginPath(); g.ellipse(0, 0, 44, 22, 0, PI / 2, PI * 1.5); g.quadraticCurveTo(70, -2, 80, 0); g.quadraticCurveTo(70, 2, 0, 22); g.closePath(); g.fillStyle = "rgba(88,225,255,.25)"; g.fill(); g.strokeStyle = col.holo; g.lineWidth = 2; g.stroke(); g.restore();
  txt(g, "flat plate", cxA, 18, col.ink, 12, "center"); txt(g, "teardrop", cxB + 18, 18, col.ink, 12, "center"); g.strokeStyle = "rgba(88,225,255,.15)"; g.beginPath(); g.moveTo(W / 2, 26); g.lineTo(W / 2, H - 10); g.stroke();
  for (const p of P) { const left = p.x < W / 2; let vx = 1.6, vy = 0; if (left) { const dx = p.x - cxA, dy = p.y - mid; if (dx > -40 && dx < 0 && Math.abs(dy) < H * 0.22) vy = Math.sign(dy || 1) * 1.8; if (dx > 4 && dx < 90 && Math.abs(dy) < H * 0.2) { vx = 0.4; vy = Math.sin(t * 6 + p.y) * 2; } }
    else { const dx = p.x - cxB, dy = p.y - mid; if (dx > -60 && dx < 80 && Math.abs(dy) < 40) vy = Math.sign(dy || 1) * 0.9 * Math.cos((dx + 60) / 140 * PI) ; }
    p.x += vx * p.s; p.y += vy; if (p.x > W || (left && p.x > W / 2) ) { p.x = left ? W / 2 + 2 : 0; if (!left) p.x = 0; p.y = 26 + Math.random() * (H - 36); } if (!left && p.x < W / 2) p.x = W / 2 + 1;
    if (p.x < 0) p.x = 0; g.fillStyle = left && p.x > cxA && p.x < cxA + 90 && Math.abs(p.y - mid) < H * 0.2 ? col.acc : "rgba(140,240,255,.65)"; g.fillRect(p.x, p.y, 2.2, 2.2); }
  txt(g, "big swirling wake = lots of drag", 10, H - 8, col.acc, 11); txt(g, "smooth = little drag", W / 2 + 10, H - 8, col.good, 11); };
function planeShape(g, cx, cy, s) { g.save(); g.translate(cx, cy); g.scale(s, s); g.beginPath(); g.moveTo(60, 0); g.quadraticCurveTo(50, -9, 20, -9); g.lineTo(-45, -7); g.lineTo(-60, -26); g.lineTo(-68, -26); g.lineTo(-62, -4); g.lineTo(-60, 5); g.lineTo(20, 9); g.quadraticCurveTo(52, 9, 60, 0); g.fillStyle = "rgba(88,225,255,.2)"; g.fill(); g.strokeStyle = col.holo; g.lineWidth = 2 / s; g.stroke(); g.beginPath(); g.moveTo(10, 2); g.lineTo(-18, 30); g.lineTo(-28, 30); g.lineTo(-10, 2); g.fillStyle = "rgba(88,225,255,.3)"; g.fill(); g.stroke(); g.restore(); }
DG.forces = (g, W, H, t) => { const cx = W / 2, cy = H / 2 + 6, p = 1 + Math.sin(t * 2) * 0.06; planeShape(g, cx, cy, 1.2);
  arrow(g, cx, cy - 16, cx, cy - 16 - 55 * p, col.good, 4, "Lift"); arrow(g, cx, cy + 16, cx, cy + 16 + 55 * p, col.gray, 4, "Weight"); arrow(g, cx + 76, cy, cx + 76 + 55 * p, cy, col.holo2, 4, "Thrust"); arrow(g, cx - 84, cy, cx - 84 - 50 * p, cy, col.acc, 4, "Drag"); };
function wingFlow(g, W, H, t, a, stall, press) { const cx = W * 0.42, cy = H * 0.52, c = W * 0.42; if (press) { const gr = g.createRadialGradient(cx, cy - 26, 4, cx, cy - 20, c * 0.6); gr.addColorStop(0, "rgba(79,140,255,.55)"); gr.addColorStop(1, "rgba(79,140,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, cy); const gr2 = g.createRadialGradient(cx, cy + 20, 4, cx, cy + 20, c * 0.5); gr2.addColorStop(0, "rgba(255,93,108,.4)"); gr2.addColorStop(1, "rgba(255,93,108,0)"); g.fillStyle = gr2; g.fillRect(0, cy, W, H - cy); txt(g, "low pressure (fast air)", 12, 20, "#8fb3ff", 12); txt(g, "higher pressure", 12, H - 10, "#ff8a95", 12); }
  airfoil(g, cx, cy, c, a);
  for (let k = -4; k <= 4; k++) { const y0 = cy + k * 17; g.strokeStyle = "rgba(140,240,255,.55)"; g.lineWidth = 1.4; g.beginPath(); for (let x = 0; x <= W; x += 6) { const dx = (x - cx) / (c * 0.6), near = Math.exp(-(k * k) / 10); let y = y0 - near * 14 * Math.exp(-dx * dx) * Math.sign(k || 1) * (k === 0 ? 0 : 1); if (x > cx + c * 0.3) y += (x - cx - c * 0.3) * Math.tan(a) * 0.9 * near * (stall && k < 0 ? 0 : 1); if (stall && k <= 0 && k >= -2 && x > cx - c * 0.1) y += Math.sin(x * 0.12 - t * 8 + k) * 7; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const L = stall ? 26 : 30 + a * 180; arrow(g, cx, cy - 30, cx, cy - 30 - L, col.good, 4, stall ? "lift collapses" : "Lift"); if (!stall && !press) arrow(g, cx + c * 0.62, cy + 22, cx + c * 0.62 + 20, cy + 22 + 40 * Math.tan(a) + 10, col.holo2, 2.5, "air pushed down"); }
DG.wing = (g, W, H, t) => wingFlow(g, W, H, t, (6 + Math.sin(t) * 3) * PI / 180, false, false);
DG.wingp = (g, W, H, t) => wingFlow(g, W, H, t, 6 * PI / 180, false, true);
DG.stall = (g, W, H, t) => { wingFlow(g, W, H, t, 20 * PI / 180, true, false); txt(g, "20° tilt: flow breaks away on top", 12, H - 10, col.warn, 12); };
DG.cgcp = (g, W, H, t) => { const rows = [[H * 0.3, 1, "Push point behind: flies straight"], [H * 0.76, -1, "Push point in front: tumbles"]];
  for (const [cy, sgn, lbl] of rows) { const cx = W * 0.5, ang = sgn > 0 ? Math.sin(t * 2.2) * 0.35 * Math.exp(-((t * 0.7) % 3)) : clamp(((t * 0.7) % 3) * 0.9, 0, PI * 0.9);
    g.save(); g.translate(cx, cy); g.rotate(ang); g.fillStyle = "rgba(88,225,255,.2)"; g.strokeStyle = col.holo; g.lineWidth = 2; g.beginPath(); g.moveTo(70, 0); g.lineTo(46, -7); g.lineTo(-54, -7); g.lineTo(-54, 7); g.lineTo(46, 7); g.closePath(); g.fill(); g.stroke();
    const fs = sgn > 0 ? 1 : 0.35; g.beginPath(); g.moveTo(-36, -7); g.lineTo(-56, -7 - 20 * fs); g.lineTo(-58, -7); g.moveTo(-36, 7); g.lineTo(-56, 7 + 20 * fs); g.lineTo(-58, 7); g.stroke();
    const cg = sgn > 0 ? 10 : -10, cp = sgn > 0 ? -26 : 22; g.fillStyle = "#fff"; g.beginPath(); g.arc(cg, 0, 5, 0, 7); g.fill(); g.fillStyle = col.acc; g.beginPath(); g.arc(cp, 0, 5, 0, 7); g.fill(); g.restore();
    txt(g, lbl, 12, cy - 30, sgn > 0 ? col.good : col.bad, 12); }
  txt(g, "● balance point (CG)", W - 150, H * 0.5, col.ink, 11); txt(g, "● push point (CP)", W - 150, H * 0.5 + 16, col.acc, 11); arrow(g, 26, H * 0.5 + 4, 70, H * 0.5 + 4, col.holo2, 2, "wind"); };
function boatSec(g, W, H, t, wide, capsize) { const cx = W / 2, wl = H * 0.55, ang = capsize ? clamp(((t * 0.5) % 3) * 0.9, 0, 1.9) : Math.sin(t * 1.3) * 0.28;
  g.fillStyle = "rgba(20,90,150,.55)"; g.fillRect(0, wl, W, H - wl); g.strokeStyle = "rgba(160,220,255,.6)"; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, wl + Math.sin(x * 0.05 + t * 2) * 2); g.stroke();
  const bw = wide ? 70 : 32, bh = 34; g.save(); g.translate(cx, wl); g.rotate(ang); g.fillStyle = "rgba(230,236,245,.9)"; g.beginPath(); g.moveTo(-bw, -bh * 0.8); g.lineTo(bw, -bh * 0.8); g.lineTo(bw * 0.8, bh * 0.4); g.lineTo(-bw * 0.8, bh * 0.4); g.closePath(); g.fill();
  if (!wide) { g.fillStyle = "#c9895a"; g.fillRect(-18, -bh * 0.8 - 46, 36, 46); } const gy = wide ? -4 : -40; g.fillStyle = "#fff"; g.beginPath(); g.arc(0, gy, 5, 0, 7); g.fill(); g.strokeStyle = "#333"; g.stroke(); arrow(g, 0, gy, 0, gy + 30, col.gray, 2.5); g.restore();
  const bx = cx + Math.sin(ang) * (wide ? 60 : 14) * (capsize ? -1 : 1), by = wl + 14; g.fillStyle = col.good; g.beginPath(); g.arc(bx, by, 5, 0, 7); g.fill(); arrow(g, bx, by, bx, by - 34, col.good, 2.5, "water pushes up");
  txt(g, wide ? "Wide and low: swings back upright" : "Tall and narrow: rolls over", 12, 20, wide ? col.good : col.bad, 12); txt(g, "● weight   ● water's push", 12, H - 10, col.mut, 11); }
DG.boat = (g, W, H, t) => boatSec(g, W, H, t, true, false);
DG.boatx = (g, W, H, t) => boatSec(g, W, H, t, false, true);
DG.layers = (g, W, H, t) => { const top = 22, bot = H - 20, y = km => bot - Math.log10(1 + km) / Math.log10(101) * (bot - top); const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, "#02050b"); gr.addColorStop(1, "#1d5d96"); g.fillStyle = gr; g.fillRect(W * 0.1, top, W * 0.35, bot - top);
  for (let i = 0; i < 260; i++) { const f = (i * 0.6180339) % 1, km = Math.pow(10, f * 2) - 1, dens = Math.exp(-km / 8); if (((i * 7919) % 97) / 97 > dens) continue; g.fillStyle = "rgba(200,235,255,.8)"; g.fillRect(W * 0.1 + ((i * 37) % 100) / 100 * W * 0.35, y(km) + Math.sin(t + i) * 1.5, 2, 2); }
  for (const [kmv, n] of [[0, "Ground: all the air"], [5.5, "5.5 km: half the air"], [8.85, "Everest"], [11, "Airliners: a quarter"], [30, "Weather balloons: 1%"], [100, "Edge of space"]]) { g.strokeStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.moveTo(W * 0.1, y(kmv)); g.lineTo(W * 0.5, y(kmv)); g.stroke(); txt(g, n, W * 0.53, y(kmv) + 4, col.ink, 12); } };
DG.mach = (g, W, H, t) => { const sup = (t % 8) > 4, v = sup ? 1.8 : 0.6, cy = H / 2, period = 4, ph = t % period, x0 = W * 0.15, sx = x0 + ph / period * (W * 0.7);
  for (let k = 0; k < 9; k++) { const te = ph - k * 0.4; if (te < 0) continue; const ex = x0 + te / period * (W * 0.7), r = (ph - te) / period * (W * 0.7) / v; g.strokeStyle = `rgba(140,240,255,${0.7 - k * 0.06})`; g.lineWidth = 1.5; g.beginPath(); g.arc(ex, cy, r, 0, 7); g.stroke(); }
  g.fillStyle = col.acc; g.beginPath(); g.arc(sx, cy, 6, 0, 7); g.fill(); txt(g, sup ? "Faster than sound: waves pile into a shock cone" : "Slower than sound: waves spread out ahead", 12, 20, sup ? col.warn : col.good, 12); };
DG.rocket = (g, W, H, t) => { const P = flowParts("rk", 90, W, H), cx = W / 2, cy = H * 0.3 + Math.sin(t) * 3; const fuel = 1 - ((t * 0.15) % 1);
  g.fillStyle = "rgba(88,225,255,.2)"; g.strokeStyle = col.holo; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 50); g.lineTo(cx + 13, cy - 26); g.lineTo(cx + 13, cy + 40); g.lineTo(cx - 13, cy + 40); g.lineTo(cx - 13, cy - 26); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "rgba(255,176,77,.55)"; g.fillRect(cx - 11, cy + 38 - 60 * fuel, 22, 60 * fuel);
  for (const p of P) { if (!p.a || p.y > H) { p.x = cx + (Math.random() - 0.5) * 12; p.y = cy + 44; p.a = 1; p.vx = (Math.random() - 0.5) * 1.5; } p.y += 3.2 * p.s; p.x += p.vx; g.fillStyle = `rgba(255,${120 + Math.round(p.s * 80)},60,${clamp(1 - (p.y - cy) / (H - cy), 0, 1)})`; g.fillRect(p.x, p.y, 3, 3); }
  arrow(g, cx + 34, cy + 30, cx + 34, cy - 20, col.good, 3.5, "thrust"); arrow(g, cx - 34, cy + 50, cx - 34, cy + 95, col.acc, 3, "exhaust"); txt(g, `fuel ${Math.round(fuel * 100)}%`, 12, H - 10, col.warn, 12); };
DG.float = (g, W, H, t) => { const wl = H * 0.45; g.fillStyle = "rgba(20,90,150,.55)"; g.fillRect(0, wl, W, H - wl); const bob = Math.sin(t * 1.5) * 3;
  g.fillStyle = "rgba(230,236,245,.9)"; g.beginPath(); g.moveTo(W * 0.14, wl - 20 + bob); g.lineTo(W * 0.42, wl - 20 + bob); g.lineTo(W * 0.38, wl + 22 + bob); g.lineTo(W * 0.18, wl + 22 + bob); g.closePath(); g.fill(); g.strokeStyle = "rgba(255,255,255,.4)"; g.setLineDash([3, 3]); g.strokeRect(W * 0.18, wl + bob, W * 0.2, 22); g.setLineDash([]); txt(g, "water pushed aside", W * 0.12, wl + 44 + bob, col.holo2, 11);
  arrow(g, W * 0.28, wl + 26 + bob, W * 0.28, wl - 30 + bob, col.good, 3, "push up"); txt(g, "Hollow steel ship floats", W * 0.1, 20, col.good, 12);
  const sy = clamp(wl - 20 + (t % 4) * 30, wl - 20, H - 26); g.fillStyle = "#7d8794"; g.fillRect(W * 0.66, sy, 30, 22); txt(g, "Solid steel block sinks", W * 0.56, 20, col.bad, 12); arrow(g, W * 0.66 + 15, sy + 26, W * 0.66 + 15, sy + 56, col.gray, 3); };
DG.pressure = (g, W, H, t) => { const top = 24, bot = H - 14, gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, "#1b7fb3"); gr.addColorStop(0.4, "#0a3d66"); gr.addColorStop(1, "#010610"); g.fillStyle = gr; g.fillRect(W * 0.08, top, W * 0.4, bot - top);
  const marks = [[0, "surface · 1 atm"], [10, "10 m · 2 atm"], [100, "100 m · 11 atm"], [1000, "1 km · 100 atm"], [3800, "Titanic · 380 atm"], [10935, "Mariana Trench · 1,100 atm"]], y = z => top + Math.log10(1 + z) / Math.log10(11000) * (bot - top);
  for (const [z, n] of marks) { g.strokeStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.moveTo(W * 0.08, y(z)); g.lineTo(W * 0.5, y(z)); g.stroke(); txt(g, n, W * 0.53, y(z) + 4, col.ink, 12); }
  const zz = (Math.sin(t * 0.5) * 0.5 + 0.5) * 10935, sy = y(zz), sx = W * 0.28, L = 6 + Math.log10(1 + zz) * 5; g.fillStyle = "#ffd166"; g.beginPath(); g.ellipse(sx, sy, 16, 9, 0, 0, 7); g.fill();
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2, x0 = sx + Math.cos(a) * (22 + L), y0 = sy + Math.sin(a) * (15 + L); arrow(g, x0, y0, sx + Math.cos(a) * 19, sy + Math.sin(a) * 12, col.bad, 1.6); } };
DG.wave = (g, W, H, t) => { const wl = H * 0.55, cx = W * 0.5; g.fillStyle = "rgba(20,90,150,.5)"; g.fillRect(0, wl, W, H - wl); g.strokeStyle = "rgba(200,235,255,.8)"; g.lineWidth = 2; g.beginPath(); const Lw = 90 + Math.sin(t * 0.6) * 50; for (let x = 0; x <= W; x += 4) g.lineTo(x, wl - 10 * Math.cos((x - cx - 40) / Lw * 2 * PI - t * 3) * Math.exp(-Math.max(0, cx - x) / 180)); g.stroke();
  g.fillStyle = "rgba(230,236,245,.95)"; g.beginPath(); g.moveTo(cx - 60, wl - 14); g.lineTo(cx + 50, wl - 14); g.lineTo(cx + 64, wl - 24); g.lineTo(cx + 40, wl + 8); g.lineTo(cx - 60, wl + 8); g.closePath(); g.fill(); txt(g, "bow wave gets longer as it speeds up", 12, 20, col.holo2, 12); };
DG.plane = (g, W, H, t) => { const wl = H * 0.6, lift = (Math.sin(t * 0.8) * 0.5 + 0.5); g.fillStyle = "rgba(20,90,150,.5)"; g.fillRect(0, wl, W, H - wl); const cx = W * 0.5, y0 = wl - 6 - lift * 14, ang = -0.12 * (1 - lift) - 0.03;
  g.save(); g.translate(cx, y0); g.rotate(ang); g.fillStyle = "rgba(230,236,245,.95)"; g.beginPath(); g.moveTo(-70, -12); g.lineTo(60, -12); g.lineTo(78, -2); g.lineTo(60, 8); g.lineTo(-70, 8); g.closePath(); g.fill(); g.restore();
  for (let k = 0; k < 14; k++) { const x = cx - 80 - k * 16 - (t * 60) % 16; g.fillStyle = `rgba(255,255,255,${0.6 - k * 0.04})`; g.beginPath(); g.arc(x, wl - 2 + Math.sin(k) * 2, 3 + k * 0.3, 0, 7); g.fill(); } txt(g, lift > 0.5 ? "Planing: skimming on top" : "Plowing: pushing through", 12, 20, lift > 0.5 ? col.good : col.warn, 12); };
DG.rotor = (g, W, H, t) => { const P = flowParts("rot", 140, W, H), cx = W / 2, cy = H * 0.3; g.fillStyle = "rgba(88,225,255,.25)"; g.strokeStyle = col.holo; g.lineWidth = 2; g.fillRect(cx - 20, cy - 8, 40, 16); g.strokeRect(cx - 20, cy - 8, 40, 16);
  for (const sx of [-1, 1]) { const rx = cx + sx * 60; g.beginPath(); g.moveTo(cx + sx * 20, cy); g.lineTo(rx, cy); g.stroke(); const s = Math.cos(t * 30) * 45; g.strokeStyle = "rgba(140,240,255,.8)"; g.beginPath(); g.moveTo(rx - s, cy - 10); g.lineTo(rx + s, cy - 10); g.stroke(); g.strokeStyle = col.holo; }
  for (const p of P) { if (!p.a || p.y > H) { const sx = Math.random() < 0.5 ? -1 : 1; p.x = cx + sx * 60 + (Math.random() - 0.5) * 80; p.y = cy - 6; p.a = 1; } p.y += 2.4 * p.s; g.fillStyle = "rgba(140,240,255,.6)"; g.fillRect(p.x, p.y, 2, 2); }
  arrow(g, cx, cy - 14, cx, cy - 60, col.good, 3.5, "lift"); txt(g, "air thrown down", 12, H - 10, col.holo2, 12); };
DG.planets = (g, W, H, t) => { const Pn = [["Earth", 1, 1], ["Mars", 0.38, 0.013], ["Moon", 0.17, 0], ["Titan", 0.14, 4.4], ["Venus", 0.9, 54]], bw = (W - 40) / Pn.length;
  txt(g, "gravity", 16, 18, col.holo2, 12); txt(g, "air (log scale)", 80, 18, col.acc, 12);
  Pn.forEach(([n, gr, air], i) => { const x = 20 + i * bw, bh = H - 70; g.fillStyle = col.holo; g.fillRect(x, H - 36 - bh * gr * 0.9, bw * 0.3, bh * gr * 0.9); const al = air > 0 ? clamp((Math.log10(air) + 2) / 4, 0.02, 1) : 0; g.fillStyle = col.acc; g.fillRect(x + bw * 0.36, H - 36 - bh * al * 0.9, bw * 0.3, bh * al * 0.9); txt(g, n, x + bw * 0.33, H - 18, col.ink, 12, "center"); }); };

/* ================================================================= STATE */
const ST = store.get("liftoff-academy", { done: [], at: {} });
function saveST() { store.set("liftoff-academy", ST); window.LEARN && LEARN.progressUI(); }
function progress() { return { n: ST.done.length, N: ALL.length }; }
let cur = null, stepI = 0, raf = 0, coachT = 0, answered = null;

/* ================================================================= DOM */
const modal = document.createElement("section"); modal.id = "acad"; modal.className = "glass brk"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-label", "Academy lesson"); document.body.appendChild(modal);
const coach = document.createElement("section"); coach.id = "acoach"; coach.className = "glass brk"; coach.setAttribute("aria-live", "polite"); document.body.appendChild(coach);
function openHub(tab) {
  tab = tab || "academy"; if (tab === "missions") { LEARN.openList(); return; }
  const box = $("alist"), next = ALL.find(l => !ST.done.includes(l.id));
  box.innerHTML = `<p class="alead">Start from zero. Each lesson takes about 2 minutes: a short explanation, a quick question, and a hands-on step in the real lab. ${next ? "" : "<b style='color:var(--good)'>You've finished every lesson!</b>"}</p>
    ${next ? `<button class="hb go acont" id="aCont">${ST.done.length ? "Continue" : "Start"}: ${esc(next.t)}</button>` : ""}` +
    U.map((u, ui) => `<div class="mg"><div class="cap">Unit ${ui + 1} · ${esc(u.t)} <span style="opacity:.6">· ${esc(u.sub)}</span></div>${u.L.map(l => { const d = ST.done.includes(l.id), gi = ALL.findIndex(x => x.id === l.id); return `<button class="mi ${d ? "done" : ""}" data-l="${l.id}"><span class="ck">${d ? "✓" : gi + 1}</span><span><b>${esc(l.t)}</b><small>${l.steps.length} steps · about ${l.min} min${ST.at[l.id] && !d ? ` · step ${ST.at[l.id] + 1}` : ""}</small></span></button>`; }).join("")}</div>`).join("");
  box.hidden = false; $("mlist").hidden = true; $("missions").classList.add("on");
  document.querySelectorAll("#missions .ltabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.t === "academy")));
  box.querySelectorAll(".mi").forEach(b => b.onclick = () => startLesson(b.dataset.l));
  const c = $("aCont"); if (c) c.onclick = () => startLesson(next.id);
}
document.querySelectorAll("#missions .ltabs button").forEach(b => b.onclick = () => openHub(b.dataset.t));
$("missBtn").onclick = () => openHub("academy");
function startLesson(id, step) {
  cur = ALL.find(l => l.id === id); if (!cur) return; stepI = step != null ? step : (ST.at[id] && !ST.done.includes(id) ? ST.at[id] : 0);
  $("missions").classList.remove("on"); stopCoach(); if (window.LEARN && LEARN.current) LEARN.hideCard();
  if (document.body.classList.contains("testing")) API().exitTest();
  showStep();
}
function showStep() {
  const st = cur.steps[stepI]; ST.at[cur.id] = stepI; saveST(); answered = null;
  const dots = cur.steps.map((s, i) => `<i class="${i === stepI ? "on" : i < stepI ? "past" : ""}" title="${s.k}"></i>`).join("");
  let body = "";
  if (st.k === "read") body = `<div class="abody"><canvas class="adg" id="aDg"></canvas><div class="atext"><h3>${esc(st.t)}</h3><p>${st.x}</p></div></div>`;
  if (st.k === "quiz") body = `<div class="abody quiz"><div class="atext"><div class="cap">Quick question</div><h3>${esc(st.q)}</h3><div class="aopts">${st.o.map((o, i) => `<button class="aopt" data-i="${i}">${esc(o)}</button>`).join("")}</div><p class="afb" id="aFb" hidden></p></div></div>`;
  if (st.k === "lab") body = `<div class="abody lab"><div class="alabicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 001.3 2h13.4A1.5 1.5 0 0020 19l-6-10V3"/><path d="M7 14h10"/></svg></div><div class="atext"><div class="cap">Hands-on · in the real lab</div><h3>${esc(st.t)}</h3><p>${st.x}</p><button class="hb go" id="aGo">Go to the lab</button></div></div>`;
  modal.innerHTML = `<button class="x" id="aX" aria-label="Close lesson">×</button><div class="ahd"><div class="cap">Academy · Unit ${cur.ui + 1} · ${esc(cur.unit.t)}</div><h2>${esc(cur.t)}</h2><div class="adots">${dots}</div></div>${body}
    <div class="afoot"><button class="hb" id="aBack" ${stepI === 0 ? "disabled" : ""}>Back</button><span class="astep">Step ${stepI + 1} of ${cur.steps.length}</span><button class="hb go" id="aNext" ${st.k === "quiz" || st.k === "lab" ? "disabled" : ""}>${stepI === cur.steps.length - 1 ? "Finish" : "Next"}</button></div>`;
  modal.classList.add("on"); document.body.classList.add("acad-on");
  $("aX").onclick = closeModal; $("aBack").onclick = () => { if (stepI > 0) { stepI--; showStep(); } }; $("aNext").onclick = next;
  if (st.k === "read") startDiagram(st.dg);
  if (st.k === "quiz") modal.querySelectorAll(".aopt").forEach(b => b.onclick = () => { if (answered != null) return; answered = +b.dataset.i; const ok = answered === st.a; b.classList.add(ok ? "ok" : "no"); modal.querySelectorAll(".aopt")[st.a].classList.add("ok"); const fb = $("aFb"); fb.hidden = false; fb.className = "afb " + (ok ? "ok" : "no"); fb.innerHTML = `<b>${ok ? "Right!" : "Not quite."}</b> ${esc(st.why)}`; $("aNext").disabled = false; });
  if (st.k === "lab") { $("aGo").onclick = () => goLab(st); if (st._done) $("aNext").disabled = false; }
  $("aNext").focus({ preventScroll: true });
}
function next() { if (stepI < cur.steps.length - 1) { stepI++; showStep(); } else finish(); }
function closeModal() { modal.classList.remove("on"); document.body.classList.remove("acad-on"); cancelAnimationFrame(raf); }
function startDiagram(id) {
  cancelAnimationFrame(raf); const c = $("aDg"); if (!c || !DG[id]) return; const g = c.getContext("2d"), t0 = performance.now();
  const loop = now => { if (!modal.classList.contains("on") || !document.body.contains(c)) return; const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, r.width, r.height); g.fillStyle = "rgba(2,8,16,.6)"; g.fillRect(0, 0, r.width, r.height); try { DG[id](g, r.width, r.height, (now - t0) / 1000); } catch (e) { console.error(e); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}
function goLab(st) {
  closeModal(); try { st.setup && st.setup(); } catch (e) { console.error(e); } if (st.el) focusEl(st.el);
  coach.innerHTML = `<button class="x" id="acX" aria-label="Pause lesson">×</button><div class="cap">Academy · ${esc(cur.t)} · step ${stepI + 1} of ${cur.steps.length}</div><h3>${esc(st.t)}</h3><p>${st.x}</p><div class="mrow"><button class="hb" id="acBack">Back to the lesson</button><span class="mstat" id="acStat">Try it now</span></div>`;
  coach.classList.add("on"); document.body.classList.add("acoach-on");
  $("acX").onclick = stopCoach; $("acBack").onclick = () => { stopCoach(); showStep(); };
  clearInterval(coachT); let okAt = 0;
  coachT = setInterval(() => { let ok = false; try { ok = !!st.check(); } catch (e) { ok = false; }
    if (ok && !okAt) { okAt = performance.now(); st._done = true; const s = $("acStat"); if (s) { s.textContent = "✓ Done"; s.style.color = "var(--good)"; }
      coach.querySelector("p").innerHTML = `<b style="color:var(--good)">Nice!</b> ${esc(st.ok)}`; coach.classList.add("win");
      const b = document.createElement("button"); b.className = "hb go"; b.textContent = stepI === cur.steps.length - 1 ? "Finish the lesson" : "Continue"; b.onclick = () => { stopCoach(); next(); }; coach.querySelector(".mrow").prepend(b); } }, 300);
}
function stopCoach() { clearInterval(coachT); coach.classList.remove("on", "win"); document.body.classList.remove("acoach-on"); }
function finish() {
  if (!ST.done.includes(cur.id)) ST.done.push(cur.id); delete ST.at[cur.id]; saveST();
  const nx = ALL.find(l => !ST.done.includes(l.id)), lessonsInUnit = cur.unit.L, unitDone = lessonsInUnit.every(l => ST.done.includes(l.id));
  modal.innerHTML = `<button class="x" id="aX" aria-label="Close">×</button><div class="ahd"><div class="cap" style="color:var(--good)">Lesson complete${unitDone ? ` · Unit ${cur.ui + 1} done` : ""}</div><h2>${esc(cur.t)}</h2></div>
    <div class="abody"><div class="atext"><p class="big">You now know: ${esc(summaryOf(cur))}</p><p>${ST.done.length} of ${ALL.length} lessons done.</p></div></div>
    <div class="afoot"><button class="hb" id="aHub">All lessons</button><span></span>${nx ? `<button class="hb go" id="aNextL">Next: ${esc(nx.t)}</button>` : `<b style="color:var(--good)">You finished the Academy!</b>`}</div>`;
  modal.classList.add("on"); if (window.LEARN) LEARN.confetti();
  $("aX").onclick = closeModal; $("aHub").onclick = () => { closeModal(); openHub("academy"); }; const n = $("aNextL"); if (n) n.onclick = () => startLesson(nx.id, 0);
}
function summaryOf(l) { return { u1l1: "drag is air pushing back, and it grows with speed squared.", u1l2: "smooth, pointed, tapered shapes have far less drag than blunt ones.", u2l1: "flight is a balance of lift, weight, thrust and drag.", u2l2: "a wing makes lift by turning air downward, with low pressure on top.", u2l3: "tilt a wing too far and it stalls: lift collapses.", u3l1: "the push point must sit behind the balance point to fly straight.", u3l2: "wide, low boats right themselves; tall, narrow ones capsize.", u4l1: "air thins fast with height, so there's less drag up high.", u4l2: "at the speed of sound, pressure waves pile into a shock wave.", u4l3: "rockets push exhaust out the back, and get lighter as they burn.", u5l1: "things float when they push aside more water than they weigh.", u5l2: "every 10 m of water adds one more atmosphere of squeeze.", u5l3: "boats climb their own bow wave; flat hulls can skim on top.", u6l1: "rotors throw air down; big, slow rotors are the most efficient.", u6l2: "gravity and air change completely from world to world." }[l.id] || l.t; }
addEventListener("keydown", e => { if (!modal.classList.contains("on")) return; const n = $("aNext"), b = $("aBack"); if (e.key === "Escape") closeModal(); if (e.key === "ArrowRight" && n && !n.disabled) n.click(); if (e.key === "ArrowLeft" && b && !b.disabled) b.click(); });

window.ACADEMY = { openHub, startLesson, stopCoach, progress, closeModal, U, ALL, DG, get state() { return ST; } };
if (window.LEARN) LEARN.progressUI();
})();
