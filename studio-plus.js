/* LiftOff Aero Studio: compare designs, step-by-step fix-it coach, focus view,
   and Jarvis-style typed or spoken commands with spoken replies (browser speech: no key). */
(() => {
"use strict";
const A = window.Aero, $ = id => document.getElementById(id);
const S = window.STUDIO, API = () => window.STUDIO_API, L = () => window.LEARN;
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nextFrame = () => new Promise(r => setTimeout(r, 0));
const toast = (m, ms) => window.toast && window.toast(m, ms);
const ctlOf = (kind, k) => A.SCHEMA[kind].find(c => c.k === k);
const optLabel = (c, v) => { if (c.type === "mat") return A.MATERIALS[v].name; if (c.type === "planet") return A.PLANETS[v].name; if (c.type === "toggle") return v ? "on" : "off"; const o = (c.opts || []).find(o => String(Array.isArray(o) ? o[0] : o) === String(v)); return o ? (Array.isArray(o) ? o[1] : o) : String(v); };
const valText = (c, v) => (c.type === "range" ? API().fmtVal(c, v) : optLabel(c, v));
function evalP(kind, p) { const r = A.run(kind, p), rep = A.report(kind, p, r), tiles = L() ? L().tiles(kind, p, r) : []; return { r, rep, tiles }; }

/* ======================================================================= FOCUS VIEW */
function setFocus(on) {
  document.body.classList.toggle("focus", on);
  if (on && window.S3D) S3D.orbit.auto = true;
  setTimeout(() => dispatchEvent(new Event("resize")), 60);
}
$("focusB").onclick = () => setFocus(true);
$("focusX").onclick = () => setFocus(false);
addEventListener("keydown", e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains("testing")) return;
  if (e.key === "f" || e.key === "F") setFocus(!document.body.classList.contains("focus"));
  if (e.key === "Escape" && document.body.classList.contains("focus")) setFocus(false);
});

/* ======================================================================= COMPARE */
function pinDesign(kind, p, name) {
  const e = evalP(kind, p);
  S.base = { kind, p: clone(p), name: name || "Design A", tiles: e.tiles, rep: e.rep };
  window.S3D && S3D.setGhost(kind, p);
  API().rerender();
  if (kind !== S.kind) toast(`Pinned ${name} as design A. Switch to the ${A.VEHICLES[kind].name.toLowerCase()} bay to compare.`, 4000);
  else toast("Saved this design as A (the orange ghost). Change anything: every result now shows A next to it.", 4600);
  say("Design A saved. Change something and I'll compare.", false);
}
function clearBase() { S.base = null; window.S3D && S3D.setGhost(null); $("cmpBox").classList.remove("on"); API().rerender(); toast("Stopped comparing"); }
function compareToggle() { if (!S.base) pinDesign(S.kind, S.p, $("vName").textContent); else openCompare(); }
function paramDiff(kind, a, b) {
  const out = [];
  for (const c of A.SCHEMA[kind]) { if (!(c.k in a) && !(c.k in b)) continue; if (JSON.stringify(a[c.k]) === JSON.stringify(b[c.k])) continue; out.push({ c, a: a[c.k], b: b[c.k] }); }
  return out;
}
const box = document.createElement("section"); box.id = "cmpBox"; box.className = "glass brk"; box.setAttribute("aria-label", "Compare designs"); document.body.appendChild(box);
function openCompare() {
  const B = S.base; if (!B) return;
  let html = `<button class="x" id="cmpX" aria-label="Close">×</button><div class="cap">Side by side</div><h2>Design A vs now</h2>`;
  if (B.kind !== S.kind) {
    html += `<p class="muted">Design A is a ${esc(A.VEHICLES[B.kind].name.toLowerCase())}. Switch to that bay to compare.</p><div class="mrow"><button class="hb go" id="cmpGo">Go to the ${esc(A.VEHICLES[B.kind].name.toLowerCase())} bay</button><button class="hb" id="cmpStop">Stop comparing</button></div>`;
    box.innerHTML = html; box.classList.add("on");
    $("cmpX").onclick = () => box.classList.remove("on"); $("cmpStop").onclick = clearBase;
    $("cmpGo").onclick = () => { API().loadVehicle(B.kind); openCompare(); }; return;
  }
  const T = S._tiles || [], lv = { good: "Works", warn: "Works, with a problem", bad: "Fails" };
  html += `<div class="cgrid"><div class="ch"></div><div class="ch a"><i></i>A · ${esc(B.name)}</div><div class="ch b"><i></i>Now · ${esc($("vName").textContent)}</div>`;
  html += `<div class="ck">Verdict</div><div class="cv ${B.rep.verdict.lvl}">${lv[B.rep.verdict.lvl]}</div><div class="cv ${S.rep.verdict.lvl}">${lv[S.rep.verdict.lvl]}</div>`;
  T.forEach((t, i) => { const a = B.tiles[i]; if (!a || a.k !== t.k) return; const better = isFinite(a.n) && isFinite(t.n) && a.v !== t.v ? (t.n > a.n ? "up" : "dn") : "";
    html += `<div class="ck">${esc(t.k)}</div><div class="cv">${esc(a.v)} <small>${esc(a.u || "")}</small></div><div class="cv ${better}">${esc(t.v)} <small>${esc(t.u || "")}</small>${better ? `<em>${better === "up" ? "▲" : "▼"}</em>` : ""}</div>`; });
  html += `</div>`;
  const D = paramDiff(S.kind, B.p, S.p);
  html += `<h4 class="cap" style="margin:14px 0 6px">What you changed</h4>` + (D.length ? `<div class="cdiff">${D.map(d => `<div><span>${esc(d.c.l)}</span><b>${esc(valText(d.c, d.a))} → ${esc(valText(d.c, d.b))}</b></div>`).join("")}</div>` : `<p class="muted">Nothing yet. Change a slider and come back.</p>`);
  // why: the ideas behind the parameters that changed
  const les = [...new Set(D.map(d => d.c.lesson).filter(Boolean))].slice(0, 3);
  if (les.length) html += `<h4 class="cap" style="margin:14px 0 6px">Why the results changed</h4>` + les.map(k => { const Ls = A.LESSONS[k]; return `<div class="cwhy"><b>${esc(Ls.t)}</b><p>${esc(Ls.p)}</p>${Ls.a ? `<p class="ana">Think of it like this: ${esc(Ls.a)}</p>` : ""}</div>`; }).join("");
  html += `<div class="cai" id="cmpAI"></div><div class="mrow"><button class="hb" id="cmpExplain">Explain the aerodynamics</button><button class="hb" id="cmpBack">Go back to A</button><button class="hb" id="cmpNew">Make this the new A</button><button class="hb" id="cmpStop">Stop comparing</button></div>`;
  box.innerHTML = html; box.classList.add("on");
  $("cmpX").onclick = () => box.classList.remove("on");
  $("cmpStop").onclick = clearBase;
  $("cmpNew").onclick = () => { pinDesign(S.kind, S.p, $("vName").textContent); openCompare(); };
  $("cmpBack").onclick = () => { API().pushHist(); S.p = clone(B.p); API().rebuild(); $("vName").textContent = B.name; box.classList.remove("on"); toast("Back to design A. Undo brings your changes back."); };
  $("cmpExplain").onclick = () => explainCompare(D);
}
async function explainCompare(D) {
  const out = $("cmpAI"), B = S.base; out.textContent = "Thinking…";
  const T = S._tiles || [], lines = T.map((t, i) => B.tiles[i] ? `${t.k}: ${B.tiles[i].v} ${B.tiles[i].u || ""} -> ${t.v} ${t.u || ""}` : "").filter(Boolean);
  const q = `Two ${A.VEHICLES[S.kind].name.toLowerCase()} designs. Changes: ${D.map(d => `${d.c.l} ${valText(d.c, d.a)} -> ${valText(d.c, d.b)}`).join("; ") || "none"}. Results: ${lines.join("; ")}. Explain, in plain words for a beginner, the aerodynamics of why the results changed.`;
  const LL = API().LLAMA;
  if (LL && LL.engine) { try { const r = await LL.engine.chat.completions.create({ temperature: 0.4, max_tokens: 260, messages: [{ role: "system", content: "You are LiftOff's flight engineer. Use only the numbers given. Plain language, at most 110 words." }, { role: "user", content: q }] }); out.textContent = r.choices[0].message.content.trim(); return; } catch (e) { } }
  if (S.ai) try { const r = await API().api("/ask", { question: q, context: { vehicle: S.kind, params: S.p } }); if (r && r.answer) { out.textContent = r.answer; return; } } catch (e) { }
  // built-in explanation: biggest result changes + the idea behind each changed part
  const big = T.map((t, i) => ({ t, a: B.tiles[i] })).filter(x => x.a && x.a.v !== x.t.v).slice(0, 2);
  const parts = D.slice(0, 3).map(d => { const Ls = A.LESSONS[d.c.lesson]; const dir = d.c.type === "range" ? (d.b > d.a ? "raised" : "lowered") : "changed"; return `You ${dir} ${d.c.l.toLowerCase()}${Ls ? `: ${Ls.p.split(". ")[0].toLowerCase()}` : ""}.`; });
  out.textContent = (big.length ? `The biggest effect: ${big.map(x => `${x.t.k.toLowerCase()} went from ${x.a.v} ${x.a.u || ""} to ${x.t.v} ${x.t.u || ""}`).join(", and ")}. ` : "The results barely moved. ") + parts.join(" ");
}

/* ======================================================================= FIX-IT COACH */
const SKIP = new Set(["planet", "liquid", "alt0", "target", "cruise", "wind", "tilt", "guidance", "kick", "payload", "prop", "stages", "engine"]);
const PHR = {
  rocket: { span: ["Make the fins bigger", "Make the fins smaller"], root: ["Make the fins longer", "Make the fins shorter"], L: ["Make the rocket longer", "Make the rocket shorter"], fin: ["Make it skinnier", "Make it fatter"], wall: ["Make the walls thicker", "Make the walls thinner"], noseR: ["Make the nose longer and pointier", "Make the nose shorter"], sweep: ["Sweep the fins back more", "Sweep the fins back less"], nEng: ["Add engines", "Remove engines"], fill: ["Fill the tanks more", "Fill the tanks less"] },
  car: { wingAng: ["Tilt the rear wing up more", "Flatten the rear wing"], ride: ["Raise the car", "Lower the car"], diff: ["Steepen the diffuser", "Flatten the diffuser"], power: ["Add engine power", "Reduce engine power"], H: ["Make it taller", "Make it lower"], wingSpan: ["Make the wing wider", "Make the wing narrower"], wingChord: ["Make the wing deeper", "Make the wing shallower"] },
  plane: { span: ["Make the wings longer", "Make the wings shorter"], chord: ["Make the wings wider (chord)", "Make the wings narrower (chord)"], sweep: ["Sweep the wings back more", "Sweep the wings back less"], fuel: ["Carry more fuel", "Carry less fuel"], power: ["Add engine power", "Reduce engine power"], thrust: ["Add thrust", "Reduce thrust"] },
  drone: { prop: ["Use bigger rotors", "Use smaller rotors"], power: ["Use stronger motors", "Use weaker motors"], battery: ["Use a bigger battery", "Use a smaller battery"] },
  boat: { B: ["Make it wider", "Make it narrower"], L: ["Make it longer", "Make it shorter"], D: ["Make the hull deeper", "Make the hull shallower"], stack: ["Stack the cargo higher", "Stack the cargo lower"], power: ["Add engine power", "Reduce engine power"], wall: ["Make the hull thicker", "Make the hull thinner"] },
  sub: { wall: ["Make the hull thicker", "Make the hull thinner"], D: ["Make it wider", "Make it narrower"], L: ["Make it longer", "Make it shorter"], foam: ["Add buoyancy foam", "Remove buoyancy foam"], ballast: ["Make the ballast tanks bigger", "Make the ballast tanks smaller"], power: ["Add propulsion power", "Reduce propulsion power"] }
};
function phrase(kind, c, a, b) {
  const P = PHR[kind] && PHR[kind][c.k];
  if (c.type === "range") return P ? P[b > a ? 0 : 1] : `${b > a ? "Increase" : "Decrease"} the ${c.l.toLowerCase().replace(/\s*\(.*\)/, "")}`;
  if (c.type === "mat") return `Build it from ${A.MATERIALS[b].name.toLowerCase()}`;
  if (c.type === "toggle") return `${b ? "Add" : "Remove"} the ${c.l.toLowerCase()}`;
  return `Switch ${c.l.toLowerCase().replace(/\s*\(.*\)/, "")} to ${optLabel(c, b)}`;
}
function candVals(c, v, wide) {
  if (c.type === "range") {
    const f0 = API().toSlider(c, v), out = [], steps = wide ? [-0.4, -0.2, -0.08, 0.08, 0.2, 0.4] : [-0.3, -0.12, 0.12, 0.3];
    for (const d of steps) { const f = clamp(f0 + d, 0, 1); if (Math.abs(f - f0) < 0.02) continue; const nv = API().fromSlider(c, f); if (nv !== v && !out.includes(nv)) out.push(nv); }
    return out;
  }
  if (c.type === "toggle") return [!v];
  if (c.opts) return c.opts.map(o => Array.isArray(o) ? o[0] : o).filter(o => String(o) !== String(v));
  return [];
}
const LVN = { bad: 0, warn: 1, good: 2 };
function fixScore(e, base) {
  let s = LVN[e.rep.verdict.lvl] * 100;
  e.tiles.forEach((t, i) => { if (t.lvl === "bad") s -= 12; else if (t.lvl === "warn") s -= 4; const b = base.tiles[i];
    if (t.lvl != null && t.lvl !== "" && b && isFinite(t.n) && isFinite(b.n)) s += 3 * Math.tanh((t.n - b.n) / (Math.abs(b.n) + 1)); });
  const t0 = e.tiles[0], b0 = base.tiles[0]; if (t0 && b0 && isFinite(t0.n) && isFinite(b0.n) && t0.n > 0 && b0.n > 0) s += 0.3 * Math.tanh(Math.log(t0.n / b0.n));
  return s;
}
const isFixed = e => e.rep.verdict.lvl === "good" && !e.tiles.some(t => t.lvl === "bad");
function improveScore(e, base, gi) {
  if (LVN[e.rep.verdict.lvl] < LVN[base.rep.verdict.lvl]) return -Infinity;
  const bad = e.tiles.filter(t => t.lvl === "bad").length, bad0 = base.tiles.filter(t => t.lvl === "bad").length; if (bad > bad0) return -Infinity;
  const t = e.tiles[gi], b = base.tiles[gi]; if (!t || !b || !isFinite(t.n) || !isFinite(b.n)) return -Infinity;
  return (t.n - b.n) / (Math.abs(b.n) + 1e-9);
}
const FX = { open: false, goal: "fix", step: null, busy: false, applied: [], excl: new Set(), token: 0, auto: false };
const drawer = document.createElement("aside"); drawer.id = "vfix"; drawer.className = "glass brk"; drawer.setAttribute("aria-label", "Fix-it coach"); document.body.appendChild(drawer);
function goals() {
  const T = S._tiles || [], g = [["fix", "Fix what's wrong"]];
  T.forEach((t, i) => { if (t.lvl === undefined || t.lvl === "" || /speed|high|far|time|grip|carry|dive|glide|down/i.test(t.k)) if (isFinite(t.n)) g.push([String(i), `Improve: ${t.k.toLowerCase()}`]); });
  if (window.COURSE && COURSE.canScore && COURSE.canScore()) g.push(["course", "Pass my course"]);
  return g;
}
function openFixer(goal) {
  FX.open = true; FX.applied = []; FX.excl = new Set();
  FX.goal = goal != null ? String(goal) : (S.rep && S.rep.verdict.lvl !== "good" ? "fix" : "0");
  drawer.classList.add("on"); document.body.classList.add("fixing"); renderFixer(); findStep();
}
function closeFixer() { FX.open = false; FX.token++; FX.auto = false; drawer.classList.remove("on"); document.body.classList.remove("fixing"); }
function renderFixer(bodyHTML) {
  const lvl = S.rep.verdict.lvl, G = goals();
  if (!G.find(g => g[0] === FX.goal)) FX.goal = "fix";
  drawer.innerHTML = `<button class="x" id="fxX" aria-label="Close">×</button><div class="phead"><div class="cap">Fix-it coach</div><h2>${FX.goal === "fix" ? "Fix it" : FX.goal === "course" ? "Beat the course" : "Improve it"}, step by step</h2>
    <label class="fgoal">Goal <select id="fxGoal">${G.map(g => `<option value="${g[0]}" ${g[0] === FX.goal ? "selected" : ""}>${esc(g[1])}</option>`).join("")}</select></label></div>
    <div class="pbody"><div class="diag ${lvl}"><i class="dot"></i><div><b>${lvl === "good" ? "It works." : lvl === "warn" ? "It works, with a problem." : "It fails."}</b> ${esc(S.rep.verdict.t)}</div></div>
    <div id="fxBody">${bodyHTML || ""}</div>
    ${FX.applied.length ? `<div class="fdone"><div class="cap">Steps you applied</div>${FX.applied.map((a, i) => `<div class="fd"><span class="ck">✓</span><span>${esc(a.t)}<small>${esc(a.chg)}</small></span></div>`).join("")}<button class="hb sm" id="fxUndoAll">Undo all ${FX.applied.length} step${FX.applied.length > 1 ? "s" : ""}</button></div>` : ""}
    </div>`;
  $("fxX").onclick = closeFixer;
  $("fxGoal").onchange = e => { FX.goal = e.target.value; FX.excl = new Set(); renderFixer(); findStep(); };
  const u = $("fxUndoAll"); if (u) u.onclick = () => { for (let i = 0; i < FX.applied.length; i++) API().undo(); FX.applied = []; renderFixer(); findStep(); };
}
async function findStep() {
  const tok = ++FX.token; FX.busy = true; FX.step = null;
  const kind = S.kind, p0 = clone(S.p), base = evalP(kind, p0), goal = FX.goal;
  if (goal === "fix" && isFixed(base)) { FX.busy = false; FX.step = null; renderFixer(doneHTML(base)); wireDone(); if (FX.auto) autoFinish(); return; }
  const cands = [];
  for (const c of A.SCHEMA[kind]) {
    if ((SKIP.has(c.k) && !(kind === "drone" && c.k === "prop")) || (c.show && !c.show(p0)) || FX.excl.has(c.k)) continue;
    for (const v of candVals(c, p0[c.k], true)) { const q = clone(p0); q[c.k] = v; if (c.k === "mat" && kind === "sub" && v === "acrylic") continue; cands.push({ c, v, q }); }
  }
  // order: controls tied to the current problem first (same lesson, or named in the verdict), so a time budget still finds the fix
  const tip = base.rep.verdict.tip, vt = base.rep.verdict.t.toLowerCase(), vw = vt.split(/[^a-z]+/).filter(w => w.length >= 4);
  const pri = c => (c.lesson === tip ? 2 : 0) + (c.l.toLowerCase().split(/[^a-z]+/).some(w => w.length >= 4 && vt.includes(w)) || vw.some(w => c.l.toLowerCase().includes(w)) ? 3 : 0);
  cands.sort((a, b) => pri(b.c) - pri(a.c));
  let best = null, bestS = -Infinity, n = 0, t0 = performance.now(), last = t0; const evals = [];
  const baseS = goal === "fix" ? fixScore(base, base) : goal === "course" ? COURSE.score(kind, p0, base.r) : 0;
  renderFixer(progressHTML(0, cands.length));
  for (const cd of cands) {
    if (tok !== FX.token) return;
    let e, sc; try { e = evalP(kind, cd.q); sc = goal === "fix" ? fixScore(e, base) : goal === "course" ? COURSE.score(kind, cd.q, e.r) : improveScore(e, base, +goal); } catch (err) { sc = -Infinity; }
    // prefer the smaller, simpler change when two help about equally
    const size = cd.c.type === "range" ? Math.abs(API().toSlider(cd.c, cd.v) - API().toSlider(cd.c, p0[cd.c.k])) * 1.5 : 1;
    const adj = sc - size * (goal === "fix" || goal === "course" ? 1 : 0.02);
    if (adj > bestS) { bestS = adj; best = { ...cd, e, sc }; }
    if (isFinite(sc)) evals.push({ cd, sc, size, t0: e && e.tiles[0] && isFinite(e.tiles[0].n) ? e.tiles[0].n : -Infinity });
    n++;
    const now = performance.now();
    if (now - last > 80) { last = now; const pb = $("fxProg"); if (pb) { pb.style.width = (n / cands.length * 100) + "%"; $("fxProgN").textContent = `${n} of ${cands.length}`; } await nextFrame(); }
    if (now - t0 > (goal === "fix" || goal === "course" ? (best && best.sc - baseS > 50 ? 5000 : 16000) : 6000) && best && best.sc > baseS) break;
  }
  if (tok !== FX.token) return;
  const need = goal === "fix" ? 0.6 : goal === "course" ? 0.5 : 0.01;
  // stuck on a plateau? some problems need two changes at once (a thicker hull AND more foam): try pairs
  if ((goal === "fix" || goal === "course") && (!best || best.sc - baseS <= need) && evals.length > 1) {
    const sorted = evals.slice().sort((a, b) => b.sc - a.sc), tops = [], seenK = new Set();
    for (const x of sorted) { if (!seenK.has(x.cd.c.k)) { seenK.add(x.cd.c.k); tops.push(x); } if (tops.length >= 4) break; }
    // plus the changes that push the main result furthest, even if they break something else on their own
    for (const x of evals.slice().sort((a, b) => b.t0 - a.t0)) { if (tops.length >= 7) break; if (!tops.includes(x)) tops.push(x); }
    const others = sorted.slice(0, 40); let n2 = 0; const t1 = performance.now(), N2 = tops.length * others.length;
    renderFixer(progressHTML(0, N2).replace("testing changes in the simulator", "trying two changes at once"));
    outer: for (const a of tops) for (const b2 of others) {
      if (tok !== FX.token) return; if (b2.cd.c.k === a.cd.c.k) continue;
      const q = clone(a.cd.q); q[b2.cd.c.k] = b2.cd.v; let e, sc; try { e = evalP(kind, q); sc = goal === "fix" ? fixScore(e, base) : COURSE.score(kind, q, e.r); } catch (err) { sc = -Infinity; }
      const adj = sc - (a.size + b2.size); if (adj > bestS) { bestS = adj; best = { c: a.cd.c, v: a.cd.v, q, e, sc, pair: b2.cd }; }
      n2++; const now = performance.now(); if (now - last > 80) { last = now; const pb = $("fxProg"); if (pb) { pb.style.width = (n2 / N2 * 100) + "%"; $("fxProgN").textContent = `${n2} of ${N2}`; } await nextFrame(); }
      if (now - t1 > 12000) break outer;
    }
  }
  FX.busy = false;
  const gain = best ? best.sc - baseS : 0;
  if (!best || !(gain > need)) { FX.step = null; renderFixer(doneHTML(base)); wireDone(); if (FX.auto) autoFinish(); return; }
  const coach = L() ? L().coach("", base.tiles, best.e.tiles).replace(/^You changed : ?/, "").replace(/^You changed \. /, "") : "";
  const ch = [{ c: best.c, v: best.v }]; if (best.pair) ch.push({ c: best.pair.c, v: best.pair.v });
  const ph = ch.map(x => phrase(kind, x.c, p0[x.c.k], x.v));
  FX.step = { c: best.c, changes: ch, v: best.v, from: p0[best.c.k], q: best.q, e: best.e, t: ph.map((x, i) => i ? x.charAt(0).toLowerCase() + x.slice(1) : x).join(" and "), chg: ch.map(x => `${x.c.l}: ${valText(x.c, p0[x.c.k])} → ${valText(x.c, x.v)}`).join("\n"), pred: coach, lvl: best.e.rep.verdict.lvl, pairNote: !!best.pair };
  renderFixer(stepHTML(FX.step)); wireStep();
  if (FX.auto) setTimeout(() => { if (FX.auto && FX.step) applyStep(); }, 900);
}
function progressHTML(n, N) { return `<div class="fprog"><div class="cap">The engineer is testing changes in the simulator</div><div class="pb"><i id="fxProg" style="width:${N ? n / N * 100 : 0}%"></i></div><small id="fxProgN">${n} of ${N}</small></div>`; }
function stepHTML(st) {
  const les = [...new Set(st.changes.map(x => x.c.lesson).filter(Boolean))], Ls = A.LESSONS[les[0]] || {}, L2 = les[1] ? A.LESSONS[les[1]] : null;
  return `<div class="fstep"><div class="cap">Step ${FX.applied.length + 1}${st.pairNote ? " · two changes together" : ""}</div><h3>${esc(st.t)}</h3>${st.chg.split("\n").map(c => `<div class="fchg">${esc(c)}</div>`).join("")}${st.pairNote ? `<p class="pred" style="color:var(--muted)">Neither change works alone here: it takes both.</p>` : ""}
    <p class="pred"><b>The simulator predicts:</b> ${esc(st.pred ? st.pred.charAt(0).toUpperCase() + st.pred.slice(1) : "small improvement")}${st.lvl !== S.rep.verdict.lvl ? ` <span class="lv ${st.lvl}">Verdict: ${st.lvl === "good" ? "works" : st.lvl === "warn" ? "works, with a problem" : "fails"}</span>` : ""}</p>
    <div class="mrow"><button class="hb go" id="fxApply">Apply this step</button><button class="hb" id="fxWhy" aria-expanded="false">Explain the aerodynamics</button><button class="hb" id="fxSkip">Try something else</button></div>
    <div class="fexp" id="fxExp" hidden><b>${esc(Ls.t || "")}</b><p>${esc(Ls.p || "")}</p>${Ls.a ? `<p class="ana">Think of it like this: ${esc(Ls.a)}</p>` : ""}${L2 ? `<b>${esc(L2.t)}</b><p>${esc(L2.p)}</p>` : ""}<details><summary>The math, for the curious</summary><div class="f">${esc(Ls.f || "")}</div><p>${esc(Ls.x || "")}</p></details><button class="hb sm" id="fxAsk">Ask the AI engineer why</button><div id="fxAI"></div></div>
    <button class="linkb" id="fxAll">Or fix everything at once</button></div>`;
}
function wireStep() {
  $("fxApply").onclick = applyStep;
  $("fxWhy").onclick = () => { const x = $("fxExp"); x.hidden = !x.hidden; $("fxWhy").setAttribute("aria-expanded", String(!x.hidden)); };
  $("fxSkip").onclick = () => { FX.step.changes.forEach(x => FX.excl.add(x.c.k)); findStep(); };
  $("fxAll").onclick = () => { FX.auto = true; applyStep(); };
  $("fxAsk").onclick = async () => { const st = FX.step, out = $("fxAI"); out.textContent = "Thinking…"; const q = `Why does "${st.t}" (${st.chg}) help this ${A.VEHICLES[S.kind].name.toLowerCase()}? Predicted: ${st.pred}`;
    const LL = API().LLAMA; if (LL && LL.engine) { try { const r = await LL.engine.chat.completions.create({ temperature: 0.4, max_tokens: 200, messages: [{ role: "system", content: "You are LiftOff's flight engineer. Plain language for a beginner, at most 90 words." }, { role: "user", content: q }] }); out.textContent = r.choices[0].message.content.trim(); return; } catch (e) { } }
    if (S.ai) try { const r = await API().api("/ask", { question: q, context: { vehicle: S.kind, params: S.p } }); if (r && r.answer) { out.textContent = r.answer; return; } } catch (e) { }
    const Ls = A.LESSONS[st.c.lesson]; out.textContent = Ls ? `${Ls.p} ${Ls.a ? "Think of it like this: " + Ls.a : ""}` : ""; };
}
function applyStep() {
  const st = FX.step; if (!st) return;
  API().pushHist(); S.p = clone(st.q); S._coach = { key: "fix", label: st.t, before: S._tiles }; API().rebuild();
  FX.applied.push({ t: st.t, chg: st.chg }); FX.excl = new Set();
  window.S3D && S3D.orbit && (S3D.orbit.auto = true);
  say(`${st.t}. ${st.pred ? st.pred.charAt(0).toUpperCase() + st.pred.slice(1) : ""}`, FX.voice);
  if (FX.applied.length >= 8) { FX.auto = false; renderFixer(doneHTML(evalP(S.kind, S.p))); wireDone(); return; }
  findStep();
}
function doneHTML(base) {
  const good = base.rep.verdict.lvl === "good", t0 = S._tiles && S._tiles[0];
  const msg = FX.goal === "fix" ? (good ? (FX.applied.length ? `Fixed! It works now${t0 ? `: ${t0.k.toLowerCase()} ${t0.v} ${t0.u || ""}` : ""}.` : "Nothing to fix: this design already works. Pick a goal above to improve it.") : FX.applied.length ? "That's as far as single changes go. It's better, but still has a problem." : "I couldn't find a single change that helps. Try a different starting design, or change two things at once.")
    : FX.goal === "course" ? (COURSE.passes && COURSE.passes() ? "It beats your course now!" : "No single change helps it on this course any more.")
    : (FX.applied.length ? "That's the best I can find with one change at a time." : "No single change improves this any further. It's already well tuned for that goal.");
  return `<div class="fstep done"><div class="cap">${FX.applied.length ? `${FX.applied.length} step${FX.applied.length > 1 ? "s" : ""} applied` : "Result"}</div><h3>${esc(msg)}</h3>
    <div class="mrow">${good || FX.goal !== "fix" ? `<button class="hb go" id="fxTest">${esc($("goBtn").textContent)} to test it</button>` : ""}${!good && FX.goal === "fix" ? "" : `<button class="hb" id="fxMore">Improve something else</button>`}</div></div>`;
}
function wireDone() { const t = $("fxTest"); if (t) t.onclick = () => { if (S.mode === "course" && window.COURSE) COURSE.run(); else { closeFixer(); API().startTest(); } }; const m = $("fxMore"); if (m) m.onclick = () => { FX.goal = FX.goal === "fix" ? "0" : "fix"; FX.excl = new Set(); renderFixer(); findStep(); }; }
function autoFinish() { FX.auto = false; const n = FX.applied.length; say(n ? `Done. I made ${n} change${n > 1 ? "s" : ""}. ${S.rep.verdict.lvl === "good" ? "It works now." : "It's better, but not perfect."}` : "I couldn't find a change that helps.", FX.voice); }
function onRecompute() {
  if (FX.open && !FX.busy && !FX.auto && FX.step && JSON.stringify(S.p) !== JSON.stringify(FX.step.q)) { clearTimeout(onRecompute._t); onRecompute._t = setTimeout(() => { if (FX.open && !FX.busy) findStep(); }, 700); }
  if (box.classList.contains("on")) { clearTimeout(onRecompute._c); onRecompute._c = setTimeout(openCompare, 250); }
}

/* ======================================================================= JARVIS: VOICE + REPLIES */
let SR = null, listening = false, lastHeard = 0, voices = [];
const jv = $("jv"), jvT = $("jvT");
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[▲▼→×]/g, m => ({ "▲": "up", "▼": "down", "→": "to", "×": " times" }[m])).slice(0, 320));
    const pick = ["Google UK English Male", "Daniel", "Microsoft Ryan", "Arthur", "Google US English"]; u.voice = voices.find(v => pick.some(p => v.name.includes(p))) || voices.find(v => /^en/.test(v.lang)) || null; u.rate = 1.04; u.pitch = 0.95; speechSynthesis.speak(u); } catch (e) { }
}
let jvTimer = 0;
function say(text, voice) {
  if (!text) return; jvT.textContent = text; jv.classList.add("on"); clearTimeout(jvTimer);
  jvTimer = setTimeout(() => { if (!listening) jv.classList.remove("on"); }, Math.min(12000, 3500 + text.length * 45));
  if (voice) speak(text);
}
function micUI(on) { $("mic").classList.toggle("rec", on); jv.classList.toggle("listen", on); if (on) { jvT.textContent = "Say a command: “make the fins bigger”, “fix it”, “compare”, “launch”."; jv.classList.add("on"); } else { clearTimeout(jvTimer); jvTimer = setTimeout(() => jv.classList.remove("on"), 2500); } }
function stopListen() { listening = false; try { SR && SR.stop(); } catch (e) { } micUI(false); }
function startListen() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { if (S.ai) return deepgramOnce(); toast("Voice works in Chrome or Edge. You can type the exact same commands here.", 4200); $("cmd").focus(); return; }
  try { SR = new R(); } catch (e) { toast("Voice isn't available here. Type your command instead."); return; }
  SR.lang = "en-US"; SR.continuous = true; SR.interimResults = true;
  SR.onresult = e => { let fin = "", tmp = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else tmp += t; }
    lastHeard = Date.now(); $("cmd").value = (fin || tmp).trim(); if (fin.trim()) heard(fin.trim()); };
  SR.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") { listening = false; micUI(false); toast("The microphone is blocked. Allow it in your browser, or type your command.", 4200); } };
  SR.onend = () => { if (listening && Date.now() - lastHeard < 60000) { try { SR.start(); } catch (e) { stopListen(); } } else stopListen(); };
  try { SR.start(); listening = true; lastHeard = Date.now(); micUI(true); } catch (e) { toast("Couldn't start the microphone."); }
}
async function deepgramOnce() {
  try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }), rec = new MediaRecorder(st), ch = []; rec.ondataavailable = e => ch.push(e.data);
    rec.onstop = async () => { st.getTracks().forEach(t => t.stop()); micUI(false); try { const r = await (await fetch("/stt", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Blob(ch, { type: "audio/webm" }) })).json(); if (r.transcript) heard(r.transcript); else toast("Didn't catch that"); } catch (e) { toast("Voice failed"); } };
    rec.start(); micUI(true); setTimeout(() => rec.state !== "inactive" && rec.stop(), 5000); } catch (e) { toast("Microphone unavailable. Type your command instead."); }
}
function heard(txt) {
  const t = txt.replace(/^(hey |ok |okay )?(liftoff|lift off|jarvis|computer|friday)[,.!]?\s*/i, "").trim(); if (!t) return;
  if (/^(stop|stop listening|that's all|thanks|thank you|goodbye)\b/i.test(t)) { say("Standing by.", true); stopListen(); return; }
  $("cmd").value = t; API().command(true);
}
$("mic").onclick = () => listening ? stopListen() : startListen();
$("mic").title = "Talk to LiftOff: say what to change, like “make the fins bigger” or “fix it”";

/* ---------- commands the studio doesn't know yet ---------- */
const NUM = "(-?[\\d.]+)\\s*(km|m|mm|cm|kw|kn|kg|t|°|deg|degrees|%|wh|w)?";
function labelsFor(kind) { return A.SCHEMA[kind].map(c => ({ c, names: [c.l.toLowerCase().replace(/\s*\(.*?\)/g, "").trim(), ...(ALIAS[kind] && ALIAS[kind][c.k] || [])] })); }
const ALIAS = {
  rocket: { span: ["fin size", "fin span", "fins span", "fins"], root: ["fin chord", "fin length"], wall: ["wall", "walls", "thickness"], L: ["length", "height"], alt0: ["launch height", "launch altitude"], chute: ["parachute", "chute"], nEng: ["engines", "engine count"] },
  car: { wingAng: ["wing angle", "wing tilt"], ride: ["ride height", "height off the road"], diff: ["diffuser"], fwing: ["front wing"], power: ["power", "horsepower"], grip: ["tire grip", "grip", "tyre grip"] },
  plane: { span: ["wingspan", "wing span", "wings"], sweep: ["sweep", "wing sweep"], flaps: ["flaps"], cruise: ["cruise altitude", "cruising altitude"], fuel: ["fuel"] },
  drone: { prop: ["rotor size", "rotors size", "propeller size", "props", "rotor diameter"], battery: ["battery"], rotors: ["rotors", "rotor count", "propellers"] },
  boat: { B: ["beam", "width"], stack: ["cargo height", "stack"], payload: ["cargo"], hull: ["hull"] },
  sub: { wall: ["hull thickness", "wall", "walls", "thickness"], target: ["target depth", "depth"], foam: ["foam", "buoyancy foam"], shape: ["hull shape", "shape"] }
};
function unitScale(c, u) { if (!u) return 1; u = u.toLowerCase(); if (u === "km" && c.u === "m") return 1000; if (u === "t" && c.u === "kg") return 1000; if (u === "cm" && c.u === "m") return 0.01; if (u === "mm" && c.u === "m") return 0.001; return 1; }
function genericRules(t) {
  const kind = S.kind, did = [];
  for (const { c, names } of labelsFor(kind)) {
    if (c.show && !c.show(S.p)) continue;
    for (const nm of names) {
      if (nm.length < 3 || !t.includes(nm)) continue;
      const e = nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (c.type === "range") {
        let m = t.match(new RegExp(`(?:set|make|change|put)?\\s*(?:the\\s+)?${e}\\s*(?:to|=|at|of)\\s*${NUM}`)); if (!m) { const m2 = t.match(new RegExp(`${NUM}\\s+${e}`)); if (m2 && m2[2]) m = m2; }
        if (m) { const num = m[1] && !isNaN(+m[1]) ? +m[1] : +m[m.length - 2]; const u = m[m.length - 1]; let v = num * unitScale(c, u); v = clamp(v, c.logMin && v === 0 ? 0 : c.min, c.max); S.p[c.k] = v; did.push(`${c.l.toLowerCase()} ${API().fmtVal(c, v)}`); break; }
        const inc = new RegExp(`\\b(increase|raise|more|bigger|larger|longer|thicker|higher|add)\\b[^.]*?${e}|${e}[^.]*?\\b(up|higher|bigger|more)\\b`).test(t), dec = new RegExp(`\\b(decrease|reduce|lower|less|smaller|shorter|thinner|cut)\\b[^.]*?${e}|${e}[^.]*?\\b(down|lower|smaller|less)\\b`).test(t);
        if (inc !== dec && (inc || dec)) { const f = API().toSlider(c, S.p[c.k]), nv = API().fromSlider(c, clamp(f + (inc ? 0.12 : -0.12), 0, 1)); if (nv !== S.p[c.k]) { S.p[c.k] = nv; did.push(`${c.l.toLowerCase()} ${inc ? "up" : "down"} to ${API().fmtVal(c, nv)}`); } break; }
      } else if (c.type === "toggle") {
        const on = new RegExp(`(add|turn on|enable|with|use)\\s+(a\\s+|the\\s+)?${e}|${e}\\s+on\\b`).test(t), off = new RegExp(`(remove|turn off|disable|without|no)\\s+(a\\s+|the\\s+)?${e}|${e}\\s+off\\b`).test(t);
        if (on !== off) { S.p[c.k] = on; did.push(`${c.l.toLowerCase()} ${on ? "on" : "off"}`); break; }
      } else if (c.opts && c.type !== "mat" && c.type !== "planet" && c.type !== "liquid") {
        for (const o of c.opts) { const ov = Array.isArray(o) ? o[0] : o, ol = String(Array.isArray(o) ? o[1] : o).toLowerCase().replace(/\s*[·(].*$/, "").trim();
          if (/^\d+$/.test(ol) ? new RegExp(`\\b${ol}\\s+${e}`).test(t) : ol.length >= 4 && t.includes(ol)) { if (String(S.p[c.k]) !== String(ov)) { S.p[c.k] = ov; did.push(`${c.l.toLowerCase()}: ${String(Array.isArray(o) ? o[1] : o)}`); } break; } }
      }
    }
  }
  // option names that are distinctive on their own ("ogive", "sphere", "planing", "catamaran", "supercritical")
  for (const c of A.SCHEMA[kind]) { if (!(c.type === "seg" || c.type === "select") || (c.show && !c.show(S.p)) || c.k === "motor") continue;
    for (const o of c.opts) { const ov = Array.isArray(o) ? o[0] : o, ol = String(Array.isArray(o) ? o[1] : o).toLowerCase().replace(/\s*[·(].*$/, "").trim();
      if (ol.length >= 5 && !/^(none|single|rear|up)$/.test(ol) && new RegExp(`\\b${ol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t) && String(S.p[c.k]) !== String(ov)) { S.p[c.k] = ov; did.push(`${c.l.toLowerCase()}: ${String(Array.isArray(o) ? o[1] : o)}`); } } }
  const mm = t.match(/\b([a-s])\s*(?:class\s*)?motor\b|\bmotor\s*(?:class\s*)?([a-s])\b/); if (kind === "rocket" && mm && S.p.prop !== "liquid") { const L2 = (mm[1] || mm[2]).toUpperCase(); if (A.MOTORS[L2]) { S.p.motor = L2; did.push(`${L2} motor`); } }
  return did;
}
const GOALW = [[/high|altitude|apogee|space/, /how high|highest/i], [/fast|speed|quick/, /speed|0 to/i], [/far|range|distance|glide/, /far|glide/i], [/deep|depth/, /deep/i], [/long|endurance|time|battery/, /time/i], [/grip|corner/, /grip/i], [/carry|lift|payload/, /carry|lifting/i], [/stable|tip/, /tip|straight/i]];
function goalFrom(t) { const T = S._tiles || []; for (const [re, tre] of GOALW) if (re.test(t)) { const i = T.findIndex(x => tre.test(x.k)); if (i >= 0) return String(i); } return "0"; }
async function preCommand(txt, voice) {
  const t = txt.toLowerCase().trim(); FX.voice = !!voice;
  if (/^(undo|go back|revert|undo that)\b/.test(t)) { const ok = API().undo(); say(ok ? "Undone." : "Nothing to undo.", voice); return true; }
  if (/^redo\b/.test(t)) { const ok = API().redo(); say(ok ? "Redone." : "Nothing to redo.", voice); return true; }
  if (/^(help|what can (you|i) (do|say)|commands)\b/.test(t)) { showHelp(); say("Here's what you can say.", voice); return true; }
  if (/\b(hide|close)\b.*\bpanels?\b|\bfocus( mode| view)?\b|\bjust (show|see) the (build|model|design)\b/.test(t)) { setFocus(true); say("Panels hidden. Say “show panels” to bring them back.", voice); return true; }
  if (/\b(show|open|bring back)\b.*\bpanels?\b|\bexit focus\b/.test(t)) { setFocus(false); say("Panels are back.", voice); return true; }
  if (/\b(stop|clear|end)\b.*\bcompar/.test(t)) { if (S.base) clearBase(); say("Stopped comparing.", voice); return true; }
  if (/\b(compare|pin (this|it)|save (this|it) as (a|design a)|side by side)\b/.test(t)) { if (!S.base) pinDesign(S.kind, S.p, $("vName").textContent); else openCompare(); if (S.base && voice) say("Here's the comparison.", voice); return true; }
  if (/\b(fix|repair|debug)\b.*\b(step by step|one (step )?at a time|show me|walk me|slowly|coach)\b/.test(t)) { FX.auto = false; openFixer("fix"); say("Let's fix it one step at a time.", voice); return true; }
  if (/^(fix|repair)( it| this| my (design|rocket|car|plane|drone|boat|sub|submarine)| the (design|problem)| everything)?[.!]*$|\bmake it work\b|\bfix (it|this) for me\b/.test(t)) { if (S.rep.verdict.lvl === "good") { say("It already works. I'll look for an improvement instead.", voice); FX.auto = true; openFixer(goalFrom(t)); return true; } FX.auto = true; openFixer("fix"); say("On it. Testing changes in the simulator.", voice); return true; }
  if (/\b(improve|optimi[sz]e|make it better|tune it)\b/.test(t)) { const auto = !/\bstep by step\b/.test(t); FX.auto = auto; openFixer(goalFrom(t)); say(auto ? "Working on it." : "Let's improve it step by step.", voice); return true; }
  if (/\b(academy|teach me|lessons?|tutorial|start learning)\b/.test(t) && window.ACADEMY) { ACADEMY.openHub("academy"); say("Opening the Academy.", voice); return true; }
  if (/\bmissions?\b/.test(t) && window.LEARN) { window.ACADEMY ? ACADEMY.openHub("missions") : LEARN.openList(); say("Here are the missions.", voice); return true; }
  if (window.COURSE && (S.mode === "course" || /\b(course|race ?track|circuit|terrain|sea ?floor|flight path|obstacle|trench|canyon|mountain|buoy|waypoint|delivery route)\b/.test(t))) { const r = COURSE.command(t); if (r) { say(r, voice); return true; } }
  if (/\b(build mode|back to build)\b/.test(t)) { API().setMode("build"); say("Build mode.", voice); return true; }
  if (/\bstop listening\b/.test(t)) { stopListen(); return true; }
  return false;
}
function showHelp() {
  const h = $("help"), ex = {
    rocket: ["make the fins bigger", "carbon fiber", "set wall thickness to 3 mm", "4 fins", "ogive nose", "fix it", "launch it"],
    car: ["add a rear wing", "set wing angle to 12", "lower the car", "more power", "fix it", "run a lap"],
    plane: ["make the wings longer", "flaps down 30", "jet engine", "improve range", "fly it"],
    drone: ["bigger rotors", "set battery to 200 wh", "fly it on Mars", "fix it"],
    boat: ["planing hull", "make it wider", "stack the cargo higher", "improve speed"],
    sub: ["sphere hull", "titanium", "set hull thickness to 90 mm", "fix it", "dive"]
  }[S.kind];
  const all = [...ex, "compare", "fix it step by step", "undo", "hide panels", "open the course", "teach me"];
  h.innerHTML = `<div class="cap">Type or say any of these</div><div class="chips">${all.map(x => `<button class="chip">${esc(x)}</button>`).join("")}</div>`;
  h.hidden = false; h.querySelectorAll(".chip").forEach(b => b.onclick = () => { $("cmd").value = b.textContent; h.hidden = true; API().command(false); });
  clearTimeout(showHelp._t); showHelp._t = setTimeout(() => h.hidden = true, 12000);
}
$("cmd").addEventListener("focus", () => { if (!$("cmd").value) showHelp(); });
$("cmd").addEventListener("input", () => { $("help").hidden = true; });
document.addEventListener("pointerdown", e => { if (!e.target.closest("#help,#cmd,#sendB")) $("help").hidden = true; });

function topH() { const t = $("top"); if (t) document.documentElement.style.setProperty("--topH", t.offsetHeight + "px"); }
addEventListener("resize", topH); setTimeout(topH, 50); setTimeout(topH, 1200);
window.PLUS = { topH, setFocus, pinDesign, clearBase, compareToggle, openCompare, openFixer, closeFixer, onRecompute, preCommand, genericRules, say, speak, showHelp, startListen, stopListen, FX, evalP, fixScore };
})();
