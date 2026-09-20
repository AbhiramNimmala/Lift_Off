/* LiftOff Aero Studio: cinematic open screen + guided tour. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

/* ================= open screen ================= */
const intro = $("intro"), cv = $("introC"), x = cv.getContext("2d");
let W, H, D, raf = 0, t0 = performance.now(), running = false, P = [], S = [];
function size() { D = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * D; H = cv.height = innerHeight * D;
  S = Array.from({ length: 240 }, () => [Math.random() * W, Math.random() * H, Math.random() * 1.3 + 0.3, Math.random() * 6.3]);
  P = Array.from({ length: Math.round(innerWidth / 6) }, () => [Math.random(), Math.random(), 0.6 + Math.random() * 0.8]); }
// silhouettes, nose to the right, unit box
const V = [
  [[1, 0], [.55, .11], [-.75, .11], [-.95, .3], [-1, .3], [-.95, .11], [-1, .11], [-1, -.11], [-.95, -.11], [-1, -.3], [-.95, -.3], [-.75, -.11], [.55, -.11]],
  [[1, -.08], [.95, 0], [.45, .05], [.2, .22], [-.3, .24], [-.55, .12], [-.8, .12], [-.85, .36], [-1, .36], [-1, -.08], [-.72, -.12], [.72, -.12]],
  [[1, 0], [.85, .08], [.2, .1], [-.1, .5], [-.25, .5], [-.12, .1], [-.7, .1], [-.9, .42], [-1, .42], [-.95, .05], [-1, -.04], [-.8, -.1], [.8, -.1]],
  [[1, 0], [.9, .13], [.4, .15], [.2, .15], [.15, .34], [-.12, .34], [-.15, .15], [-.6, .13], [-.95, .03], [-1, .1], [-1, -.1], [-.95, -.03], [-.6, -.13], [.9, -.13]]];
function draw(n) {
  const t = Math.max(0, (n - t0) / 1000); x.fillStyle = "#02050b"; x.fillRect(0, 0, W, H);
  // nebula glow
  const g = x.createRadialGradient(W * .68, H * .48, 0, W * .68, H * .48, Math.max(W, H) * .55); g.addColorStop(0, "rgba(40,120,200,.20)"); g.addColorStop(.5, "rgba(20,50,110,.08)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const s of S) { x.globalAlpha = .2 + .6 * Math.abs(Math.sin(t * .5 + s[3])); x.fillStyle = "#d6e6ff"; x.beginPath(); x.arc(s[0], s[1], s[2] * D, 0, 7); x.fill(); } x.globalAlpha = 1;
  // perspective grid floor
  x.strokeStyle = "rgba(88,225,255,.10)"; x.lineWidth = D; const hz = H * .74;
  for (let i = -20; i <= 20; i++) { x.beginPath(); x.moveTo(W * .5 + i * W * .02, hz); x.lineTo(W * .5 + i * W * .16, H); x.stroke(); }
  for (let k = 0; k < 10; k++) { const f = ((k + (t * .35) % 1) / 10) ** 2, y = hz + (H - hz) * f; x.globalAlpha = f; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } x.globalAlpha = 1;
  // hologram body + potential-flow streamlines
  const cx = W * (innerWidth < 760 ? .5 : .7), cy = H * (innerWidth < 760 ? .3 : .47), sc = Math.min(W * .19, H * .26), per = 4, i = Math.floor(t / per) % V.length, ph = (t % per) / per, fade = ph < .15 ? ph / .15 : ph > .85 ? (1 - ph) / .15 : 1;
  const a = sc * 1.05, b = sc * .3;
  for (const p of P) { p[0] -= .0028 * p[2]; if (p[0] < -.05) { p[0] = 1.05; p[1] = Math.random(); }
    let X = cx + (p[0] * 2 - 1) * W * .5, Y = cy + (p[1] - .5) * sc * 2.4; x.beginPath(); x.moveTo(X, Y); let sp = 1;
    for (let k = 0; k < 16; k++) { const qx = (X - cx) / a, qy = (Y - cy) / b, r2 = Math.max(qx * qx + qy * qy, 1.02), rr = Math.sqrt(r2), rx = qx / rr, ry = qy / rr, kk = 1 / (2 * r2 * rr); const vx = -1 + kk * (3 * rx * rx - 1), vy = kk * 3 * rx * ry; sp = Math.hypot(vx, vy); X += vx * 7 * D; Y += vy * 7 * D * (b / a); x.lineTo(X, Y); }
    x.strokeStyle = sp > 1.25 ? "rgba(255,122,61,.55)" : sp < .75 ? "rgba(79,120,255,.5)" : "rgba(88,225,255,.38)"; x.lineWidth = 1.4 * D; x.stroke(); }
  const v = V[i]; x.save(); x.translate(cx, cy); x.beginPath(); v.forEach((q, j) => j ? x.lineTo(q[0] * sc, -q[1] * sc) : x.moveTo(q[0] * sc, -q[1] * sc)); x.closePath();
  x.fillStyle = `rgba(88,225,255,${.08 * fade})`; x.fill(); x.strokeStyle = `rgba(150,242,255,${fade})`; x.lineWidth = 2.6 * D; x.shadowColor = "#58e1ff"; x.shadowBlur = 26 * D; x.stroke(); x.restore(); x.shadowBlur = 0;
  // scan beam
  const sy = cy - sc * .55 + ((t * .7) % 1) * sc * 1.1; const sg = x.createLinearGradient(0, sy - 20 * D, 0, sy + 2 * D); sg.addColorStop(0, "rgba(88,225,255,0)"); sg.addColorStop(1, `rgba(88,225,255,${.25 * fade})`); x.fillStyle = sg; x.fillRect(cx - sc * 1.15, sy - 20 * D, sc * 2.3, 22 * D);
  // orbit ring + satellite
  x.strokeStyle = "rgba(255,176,77,.25)"; x.lineWidth = D; x.beginPath(); x.ellipse(cx, cy, sc * 1.55, sc * .42, -.18, 0, 7); x.stroke();
  const oa = t * .6, ox = cx + Math.cos(oa) * sc * 1.55 * Math.cos(-.18) - Math.sin(oa) * sc * .42 * Math.sin(-.18), oy = cy + Math.cos(oa) * sc * 1.55 * Math.sin(-.18) + Math.sin(oa) * sc * .42 * Math.cos(-.18);
  x.fillStyle = "#ffd9a8"; x.shadowColor = "#ff7a3d"; x.shadowBlur = 16 * D; x.beginPath(); x.arc(ox, oy, 3.5 * D, 0, 7); x.fill(); x.shadowBlur = 0;
  if (running) raf = requestAnimationFrame(draw);
}
function show() { size(); running = true; t0 = performance.now(); intro.classList.add("on"); raf = requestAnimationFrame(draw); setTimeout(() => $("introGo").focus(), 400); }
function hide(then) { intro.classList.add("leaving"); setTimeout(() => { intro.classList.remove("on", "leaving"); running = false; cancelAnimationFrame(raf); then && then(); }, 700); }
addEventListener("resize", () => { if (running) size(); });
$("introGo").onclick = () => hide(() => { if (!store.get("liftoff-tour")) setTimeout(() => startTour(), 300); });
$("introTour").onclick = () => hide(() => setTimeout(startTour, 300));
$("introLearn").onclick = () => hide(() => setTimeout(() => window.ACADEMY && ACADEMY.startLesson((ACADEMY.ALL.find(l => !ACADEMY.state.done.includes(l.id)) || ACADEMY.ALL[0]).id), 300));
$("introSkip").onclick = () => hide();
document.querySelectorAll("#intro [data-veh]").forEach(b => b.onclick = () => hide(() => window.STUDIO_API && STUDIO_API.loadVehicle(b.dataset.veh)));

/* ================= guided tour ================= */
const STEPS = [
  { el: "#vtabs", t: "Pick a vehicle bay", x: "Six bays: rocket, race car, aircraft, drone, boat and submarine. Each has its own physics, 3D model and test.", side: "bottom" },
  { el: "#presets", t: "Start from a proven design", x: "Every bay has four starting points. Pick one, then make it yours.", side: "right" },
  { el: "#controls", t: "Shape it", x: "Drag any slider or pick a material. The hologram reshapes and the physics re-runs instantly. Made a mess? The undo arrow up top takes it back.", side: "right", before: () => { const c = document.querySelector("#controls"); c && (c.scrollTop = 0); } },
  { el: "#verdict", t: "Read the verdict", x: "Green means it works. Yellow means it works with a problem. Red means it fails, and it tells you why.", side: "left" },
  { el: "#vActs", t: "Fix it, or compare", x: "“Fix it, step by step” finds the one change that helps most and explains the physics behind it. “Compare” saves this design as A so you can see exactly what your changes do.", side: "left" },
  { el: "#tiles", t: "Results in plain words", x: "Each box says what the number means and compares it to something you know. Press ? to learn the idea behind it.", side: "left" },
  { el: "#itab,#lesson", t: "The idea behind it", x: "The first time you meet a new idea it opens here. After that it stays tucked in this tab: click it whenever you want to read it again.", side: "right", before: () => { const t = document.getElementById("itab"); if (t) t.dataset.hide = ""; if (window.STUDIO_API) { STUDIO_API.showLesson(STUDIO.lesson || "drag", null, false); STUDIO_API.closeIdea(); } } },
  { el: "#modes", t: "Wind tunnel and courses", x: "The wind tunnel shows the airflow and the forces as arrows. Course lets you build a race track, a flight route over mountains, or a seafloor with trenches, then run your design through it.", side: "bottom" },
  { el: "#cmd", t: "Talk to it like Jarvis", x: "Type, or press the mic and say it: “make the fins bigger”, “titanium hull”, “fix it”, “compare”, “launch”. It changes the design for you and answers back.", side: "top" },
  { el: "#focusB", t: "See just your build", x: "Hide every panel and look at the design by itself. Press F, or say “hide panels”.", side: "top" },
  { el: "#missBtn", t: "Learn from zero", x: "The Academy teaches everything step by step in about 2-minute lessons, with hands-on steps in this lab. Missions are quick challenges that test what you learned.", side: "bottom" },
  { el: "#goBtn", t: "Your first mission: liftoff", x: "Press Launch to fly this rocket. A narrator explains what's happening as it flies.", side: "top", final: true }
];
const spot = $("tourSpot"), card = $("tourCard");
let idx = -1;
function startTour() { if (document.body.classList.contains("testing")) return; idx = 0; $("tour").classList.add("on"); $("lesson").classList.add("off"); render(); }
function endTour(launch) { $("tour").classList.remove("on"); idx = -1; store.set("liftoff-tour", "1");
  if (launch && window.LEARN) { LEARN.startMission(LEARN.M[0]); setTimeout(() => STUDIO_API.startTest(), 500); }
  else if (window.LEARN && !launch) setTimeout(() => { const m = LEARN.M.find(x => !LEARN.isDone(x.id)); if (m) LEARN.startMission(m); }, 300); }
function target(sel) { for (const s of sel.split(",")) { const e = document.querySelector(s.trim()); if (e && e.getClientRects().length && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden") return e; } return null; }
function render() {
  const st = STEPS[idx]; st.before && st.before();
  let el = target(st.el);
  if (!el) { if (idx < STEPS.length - 1) { idx++; return render(); } return endTour(); }
  const r0 = el.getBoundingClientRect();
  if (r0.top < 70 || r0.bottom > innerHeight - 90) { el.scrollIntoView({ block: "center", inline: "nearest" }); return setTimeout(place, 120, el, st); }
  place(el, st);
}
function place(el, st) {
  const r = el.getBoundingClientRect(), pad = 8, vw = innerWidth, vh = innerHeight;
  Object.assign(spot.style, { left: (r.left - pad) + "px", top: (r.top - pad) + "px", width: (r.width + pad * 2) + "px", height: (r.height + pad * 2) + "px" });
  $("tourN").textContent = `${idx + 1} / ${STEPS.length}`; $("tourT").textContent = st.t; $("tourX").textContent = st.x;
  $("tourBack").disabled = idx === 0; $("tourNext").textContent = st.final ? "Launch" : "Next";
  $("tourDots").innerHTML = STEPS.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("");
  // place the card
  const cw = Math.min(360, vw - 24); card.style.width = cw + "px";
  const ch = card.offsetHeight || 190; let L, T, side = st.side;
  if (vw < 760) side = r.top > vh / 2 ? "top" : "bottom";
  if (side === "bottom") { L = r.left + r.width / 2 - cw / 2; T = r.bottom + 18; }
  if (side === "top") { L = r.left + r.width / 2 - cw / 2; T = r.top - ch - 18; }
  if (side === "right") { L = r.right + 18; T = r.top + Math.min(40, r.height / 2 - ch / 2); if (L + cw > vw - 12) { L = r.left + r.width / 2 - cw / 2; T = r.bottom + 18; } }
  if (side === "left") { L = r.left - cw - 18; T = r.top + Math.min(40, r.height / 2 - ch / 2); if (L < 12) { L = r.left + r.width / 2 - cw / 2; T = r.bottom + 18; } }
  if (T + ch > vh - 12) T = Math.max(12, r.top - ch - 18);
  L = Math.max(12, Math.min(vw - cw - 12, L)); T = Math.max(12, Math.min(vh - ch - 12, T));
  card.style.left = L + "px"; card.style.top = T + "px";
  $("tourNext").focus({ preventScroll: true });
}
$("tourNext").onclick = () => { if (STEPS[idx].final) return endTour(true); idx++; render(); };
$("tourBack").onclick = () => { if (idx > 0) { idx--; render(); } };
$("tourEnd").onclick = () => endTour();
addEventListener("resize", () => { if (idx >= 0) render(); });
addEventListener("keydown", e => {
  if (idx < 0) { if (intro.classList.contains("on") && e.key === "Enter" && document.activeElement === document.body) $("introGo").click(); return; }
  if (e.key === "Escape") endTour(); else if (e.key === "ArrowRight") $("tourNext").click(); else if (e.key === "ArrowLeft") $("tourBack").click();
});
$("tourBtn").onclick = () => startTour();

window.INTRO = { show, startTour };
})();
