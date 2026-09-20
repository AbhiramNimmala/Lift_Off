/* LiftOff Aero Studio: app shell (state, controls, analysis panel, commands, AI, hangar). */
(() => {
"use strict";
const A = window.Aero, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let toastT; const toast = (m, ms = 2600) => { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); };
window.toast = toast;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- icons ---------- */
const ICON = {
  rocket: '<path d="M12 2c3 2.5 4.5 6 4.5 10l-2 3.5h-5l-2-3.5C7.5 8 9 4.5 12 2z"/><path d="M9.5 15.5L7 18v-4M14.5 15.5L17 18v-4M11 19h2l-1 3z"/>',
  car: '<path d="M2 15l2-4 5-2h6l4 2 3 1v3H2z"/><circle cx="6.5" cy="16" r="2"/><circle cx="17.5" cy="16" r="2"/><path d="M19 9h3"/>',
  plane: '<path d="M2 13l8-1 5-8h2l-2 8 6 1v2l-6 1 2 5h-2l-5-5-8-1z"/>',
  drone: '<circle cx="5" cy="6" r="3"/><circle cx="19" cy="6" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M7 8l3 3M17 8l-3 3M7 16l3-3M17 16l-3-3"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
  boat: '<path d="M3 14h18l-3 5H6z"/><path d="M12 3v11M12 4l6 8h-6"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"/>',
  sub: '<path d="M3 13c0-3 4-4 9-4s9 1 9 4-4 4-9 4-9-1-9-4z"/><path d="M10 9V6h4v3M21 13h2M1 11v4"/><circle cx="8" cy="13" r="1"/><circle cx="12" cy="13" r="1"/>'
};
const VERB = { rocket: "Launch", car: "Run a lap", plane: "Fly", drone: "Fly mission", boat: "Speed run", sub: "Dive" };
const TUN = { rocket: "Wind tunnel", car: "Wind tunnel", plane: "Wind tunnel", drone: "Wind tunnel", boat: "Towing tank", sub: "Water tunnel" };

/* ---------- state ---------- */
const S = { kind: "rocket", p: {}, preset: {}, r: null, rep: null, mode: "build", lastKey: null, runs: [], ai: false, busy: false };
window.STUDIO = S;
/* ---------- undo / redo ---------- */
const HIST = { u: [], r: [] };
function snap() { return { kind: S.kind, p: clone(S.p), name: $("vName").textContent, preset: S.preset[S.kind] }; }
function pushHist() { HIST.u.push(snap()); if (HIST.u.length > 80) HIST.u.shift(); HIST.r.length = 0; histUI(); }
function restore(st) { if (st.kind !== S.kind) loadVehicle(st.kind, undefined, true); S.p = clone(st.p); S.preset[S.kind] = st.preset || null; S._coach = null; rebuild(); $("vName").textContent = st.name; buildPresets(); }
function undo() { if (!HIST.u.length) { toast("Nothing to undo"); return false; } HIST.r.push(snap()); restore(HIST.u.pop()); histUI(); toast("Undone"); return true; }
function redo() { if (!HIST.r.length) { toast("Nothing to redo"); return false; } HIST.u.push(snap()); restore(HIST.r.pop()); histUI(); toast("Redone"); return true; }
function histUI() { const u = $("undoB"), r = $("redoB"); if (u) u.disabled = !HIST.u.length; if (r) r.disabled = !HIST.r.length; }
function presetParams(kind, key) { const pr = A.VEHICLES[kind].presets[key]; return Object.assign({ planet: "earth" }, JSON.parse(JSON.stringify(pr.p))); }
function loadVehicle(kind, key, keepMode) {
  S.kind = kind; key = key || { rocket: "highpower", car: "gt", plane: "trainer", drone: "photo", boat: "speed", sub: "research" }[kind];
  S.preset[kind] = key; S.p = presetParams(kind, key); S._coach = null; S._tiles = null; if ($("lChg")) $("lChg").hidden = true;
  document.querySelectorAll(".vt").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === kind));
  $("vName").textContent = A.VEHICLES[kind].presets[key].name;
  $("goBtn").textContent = VERB[kind]; $("tunnelBtn").textContent = TUN[kind];
  buildPresets(); buildControls(); recompute(true);
  if (!keepMode && S.mode !== "build") setMode("build");
  window.S3D && S3D.setVehicle(kind, S.p, true);
  saveHash();
}

/* ---------- controls ---------- */
function toSlider(c, v) { if (c.log) { const lo = Math.log(Math.max(c.min, c.logMin || c.min || 1e-3)), hi = Math.log(c.max); return (Math.log(Math.max(v, c.logMin || c.min || 1e-3)) - lo) / (hi - lo); } return (v - c.min) / (c.max - c.min); }
function fromSlider(c, f) {
  if (c.log) { const lo = Math.log(Math.max(c.min, c.logMin || c.min || 1e-3)), hi = Math.log(c.max); let v = Math.exp(lo + f * (hi - lo)); const m = Math.pow(10, Math.floor(Math.log10(v)) - 2); v = Math.round(v / m) * m; if (c.logMin && f < 0.002) v = 0; return v; }
  const st = c.step || (c.max - c.min) / 200; return Math.round((c.min + f * (c.max - c.min)) / st) * st;
}
function fmtVal(c, v) {
  if (typeof v !== "number") return v;
  if (c.u === "kg") { const [a, u] = A.Mk(v); return `${a} ${u}`; }
  if (c.u === "m" && v >= 1000) return `${A.nf(v / 1000, v >= 10000 ? 0 : 1)} km`;
  const d = c.d != null ? (c.log && v >= 100 ? 0 : c.log && v < 1 ? Math.max(c.d, 3) : c.d) : 1;
  let s = A.nf(v, d); s = c.u ? `${s} ${c.u}` : s;
  if (c.k === "L" && S.kind === "rocket") s += ` · Ø ${A.nf(v / S.p.fin * (v / S.p.fin < 1 ? 100 : 1), v / S.p.fin < 1 ? 1 : 2)} ${v / S.p.fin < 1 ? "cm" : "m"}`;
  return s;
}
const MATCOL = k => "#" + A.MATERIALS[k].color.toString(16).padStart(6, "0");
function buildPresets() {
  const box = $("presets"); box.innerHTML = "";
  for (const [k, pr] of Object.entries(A.VEHICLES[S.kind].presets)) {
    const b = document.createElement("button"); b.className = "chip"; b.textContent = pr.name; b.setAttribute("aria-pressed", S.preset[S.kind] === k);
    b.onclick = () => { pushHist(); loadVehicle(S.kind, k, true); toast(`Loaded: ${pr.name}`); };
    box.appendChild(b);
  }
}
function buildControls() {
  const box = $("controls"); box.innerHTML = ""; const groups = {};
  for (const c of A.SCHEMA[S.kind]) {
    if (c.show && !c.show(S.p)) continue;
    if (!groups[c.g]) { const d = document.createElement("details"); d.className = "grp"; d.open = true; d.innerHTML = `<summary><span class="cap">${c.g}</span></summary>`; box.appendChild(d); groups[c.g] = d; }
    groups[c.g].appendChild(makeCtl(c));
  }
}
function lessonBtn(c) { return c.lesson ? `<button class="q" data-l="${c.lesson}" aria-label="Explain">?</button>` : ""; }
function makeCtl(c) {
  const w = document.createElement("div"); w.className = "ctl"; const v = S.p[c.k];
  const setv = (val, live) => { if (!w._pushed) { pushHist(); w._pushed = true; } S.p[c.k] = val; S.lastKey = c; onParam(c, live); if (!live) w._pushed = false; };
  if (c.type === "range") {
    w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span><span class="val"></span></div><input type="range" min="0" max="1" step="0.001" aria-label="${esc(c.l)}">`;
    const r = w.querySelector("input"), val = w.querySelector(".val");
    const paint = () => { val.textContent = fmtVal(c, S.p[c.k]); r.style.setProperty("--f", (r.value * 100) + "%"); };
    r.value = clamp(toSlider(c, v), 0, 1); paint();
    r.oninput = () => { setv(fromSlider(c, +r.value), true); paint(); };
    r.onchange = () => { setv(fromSlider(c, +r.value), false); paint(); };
    w._paint = () => { r.value = clamp(toSlider(c, S.p[c.k]), 0, 1); paint(); };
  } else if (c.type === "seg") {
    w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span></div><div class="seg"></div>`;
    const s = w.querySelector(".seg");
    for (const [ov, ol] of c.opts) { const b = document.createElement("button"); b.textContent = ol; b.setAttribute("aria-pressed", String(v) === String(ov)); b.onclick = () => { setv(ov, false); buildControls(); }; s.appendChild(b); }
  } else if (c.type === "select") {
    w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span></div><select aria-label="${esc(c.l)}"></select>`;
    const s = w.querySelector("select"); for (const [ov, ol] of c.opts) { const o = document.createElement("option"); o.value = ov; o.textContent = ol; if (ov === v) o.selected = true; s.appendChild(o); }
    s.onchange = () => setv(s.value, false);
  } else if (c.type === "mat") {
    w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span><span class="val">${A.MATERIALS[v].Tmax} °C max</span></div><div class="mats"></div>`;
    const s = w.querySelector(".mats");
    for (const k of c.opts) { const M = A.MATERIALS[k], b = document.createElement("button"); b.className = "mat"; b.setAttribute("aria-pressed", k === v); b.title = M.note;
      b.innerHTML = `<i style="background:${MATCOL(k)}"></i><b>${M.name}</b><small>${A.nf(M.rho)} kg/m³</small>`; b.onclick = () => { setv(k, false); buildControls(); showLesson("materials", `${M.name}: ${M.note} Density ${A.nf(M.rho)} kg/m³ · yield ${A.nf(M.sy / 1e6)} MPa · max ${M.Tmax} °C`, true); }; s.appendChild(b); }
  } else if (c.type === "planet") {
    w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span></div><div class="seg"></div><div class="note" style="margin:4px 0 0">${A.PLANETS[v].blurb}</div>`;
    const s = w.querySelector(".seg");
    for (const k of c.opts) { const b = document.createElement("button"); b.textContent = A.PLANETS[k].name; b.setAttribute("aria-pressed", k === v); b.onclick = () => { S.p.planet = k; const lq = Object.keys(A.PLANETS[k].liquids); if ("liquid" in S.p && !lq.includes(S.p.liquid)) S.p.liquid = lq[0]; setv(k, false); buildControls(); showLesson("planets", null, true); }; s.appendChild(b); }
  } else if (c.type === "liquid") {
    const lq = A.PLANETS[S.p.planet].liquids; w.innerHTML = `<div class="lab"><span>${c.l}${lessonBtn(c)}</span></div><div class="seg"></div>`;
    const s = w.querySelector(".seg");
    for (const [k, L] of Object.entries(lq)) { const b = document.createElement("button"); b.textContent = L.name.split(" (")[0]; b.title = `${L.name} · ${L.rho} kg/m³`; b.setAttribute("aria-pressed", k === v); b.onclick = () => { setv(k, false); buildControls(); }; s.appendChild(b); }
  } else if (c.type === "toggle") {
    w.innerHTML = `<button class="tog" aria-pressed="${!!v}"><span>${c.l}</span><i></i></button>`;
    const b = w.querySelector("button"); b.onclick = () => { setv(!S.p[c.k], false); b.setAttribute("aria-pressed", !!S.p[c.k]); };
  }
  w.querySelectorAll(".q").forEach(q => q.onclick = e => { e.preventDefault(); showLesson(q.dataset.l); });
  return w;
}
let rafPending = false, lessonTimer;
function onParam(c, live) {
  S.preset[S.kind] = null; document.querySelectorAll("#presets .chip").forEach(b => b.setAttribute("aria-pressed", "false")); $("vName").textContent = "Custom " + A.VEHICLES[S.kind].name.toLowerCase();
  if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; recompute(); window.S3D && S3D.setVehicle(S.kind, S.p); }); }
  if (!S._coach || S._coach.key !== c.k) S._coach = { key: c.k, label: c.l, before: S._tiles };
  if (c.lesson && (!live || S._lastLesson !== c.lesson)) { S._lastLesson = c.lesson; showLesson(c.lesson, null, true); }
  clearTimeout(lessonTimer); lessonTimer = setTimeout(saveHash, 400);
}

/* ---------- analysis ---------- */
let recT = 0;
function recompute(force) {
  const now = performance.now(); if (!force && now - recT < 60) { clearTimeout(recompute._t); recompute._t = setTimeout(() => recompute(true), 70); return; }
  recT = now;
  try { S.r = A.run(S.kind, S.p); S.rep = A.report(S.kind, S.p, S.r); } catch (e) { console.error(e); return; }
  const L = window.LEARN; const prevTiles = S._tiles; S._tiles = L ? L.tiles(S.kind, S.p, S.r) : null;
  renderAnalysis(); updateLessonLive();
  if (L && S._coach && S._coach.before) { const t = L.coach(S._coach.label, S._coach.before, S._tiles, S._coach.key === "xp"); if (t) setChange(t); }
  if (L) L.check();
  if (window.PLUS) PLUS.onRecompute();
}
const LV = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" };
function renderAnalysis() {
  const rep = S.rep; $("verdict").className = rep.verdict.lvl;
  $("vText").innerHTML = esc(rep.verdict.t) + (rep.verdict.tip ? ` <button data-l="${rep.verdict.tip}">Why?</button>` : "");
  $("vText").querySelectorAll("button").forEach(b => b.onclick = () => showLesson(b.dataset.l));
  const L = window.LEARN, simple = L && L.simple, B = S.base && S.base.kind === S.kind ? S.base : null;
  const was = (a, b, better) => { if (!a) return ""; if (a.v === b.v && (a.u || "") === (b.u || "")) return `<div class="was same" title="Same as design A">same as A</div>`; const pa = parseFloat(String(a.v).replace(/,/g, "")), pb = parseFloat(String(b.v).replace(/,/g, "")), arrow = isFinite(pa) && isFinite(pb) && (a.u || "") === (b.u || "") && pa !== pb ? (pb > pa ? " ▲" : " ▼") : ""; return `<div class="was ${better == null ? "" : better ? "up" : "dn"}" title="Design A had ${esc(a.v)} ${esc(a.u || "")}${better == null ? "" : better ? ". Now it's better." : ". Now it's worse."}">A ${esc(a.v)} ${esc(a.u || "")}${arrow}</div>`; };
  if (simple && S._tiles) {
    $("tiles").innerHTML = S._tiles.map((t, i) => { const a = B && B.tiles[i] && B.tiles[i].k === t.k ? B.tiles[i] : null; return `<div class="tile ${t.lvl || ""}"><div class="cap">${esc(t.k)}<button class="q qq" data-l="${t.lesson}" aria-label="What does this mean?">?</button></div><div class="n">${esc(t.v)}<small>${esc(t.u || "")}</small></div><div class="cmp">${esc(t.cmp)}</div>${a ? was(a, t, isFinite(a.n) && isFinite(t.n) && a.n !== t.n ? t.n > a.n : null) : ""}</div>`; }).join("");
    $("tiles").querySelectorAll(".q").forEach(q => q.onclick = () => showLesson(q.dataset.l));
  } else
  $("tiles").innerHTML = rep.headline.map((h, i) => { const a = B && B.rep.headline[i] && B.rep.headline[i].k === h.k ? B.rep.headline[i] : null; return `<div class="tile"><div class="cap">${esc(h.k)}</div><div class="n">${esc(h.v)}<small>${esc(h.u || "")}</small></div><div class="s">${esc(h.sub || "")}</div>${a ? was(a, h, null) : ""}</div>`; }).join("");
  $("vActs").innerHTML = `<button class="hb sm" id="fixB">${rep.verdict.lvl === "good" ? "Improve it, step by step" : "Fix it, step by step"}</button><button class="hb sm" id="cmpB" aria-pressed="${!!B}">${B ? "Comparing with A" : "Compare"}</button>`;
  $("fixB").onclick = () => window.PLUS && PLUS.openFixer(); $("cmpB").onclick = () => window.PLUS && PLUS.compareToggle();
  let html = "";
  if (simple) html += experimentsHTML();
  const parts = massParts(); if (parts) {
    const tot = parts.reduce((a, b) => a + b[1], 0), cols = ["#58e1ff", "#ff7a3d", "#53f2a6", "#ffd166", "#b18cff", "#ff5d6c", "#8aa3bf", "#3fa7ff"];
    html += `<div class="sg"><h4 class="cap">Mass breakdown · ${A.Mk(tot).join(" ")}</h4><div class="mbar">${parts.map((p, i) => `<i style="width:${p[1] / tot * 100}%;background:${cols[i % 8]}" title="${esc(p[0])}"></i>`).join("")}</div><div class="mleg">${parts.map((p, i) => `<span style="--c:${cols[i % 8]}">${esc(p[0])} ${A.nf(p[1] / tot * 100)}%</span>`).join("")}</div></div>`;
  }
  for (const g of rep.groups) {
    html += `<div class="sg"><h4 class="cap">${esc(g.t)}</h4>` + g.rows.map(r => {
      const bar = r.bar != null ? `<div class="bar"><i style="width:${Math.min(100, r.bar * 100)}%;background:${r.bar > 1 ? "var(--bad)" : r.bar > .75 ? "var(--warn)" : "var(--holo)"}"></i></div>` : "";
      return `<div class="sr ${r.lvl || ""}"><span class="k">${esc(r.k)}${r.tip ? ` <button class="q" data-l="${r.tip}" aria-label="Explain">?</button>` : ""}</span><span class="v">${esc(r.v)}<small>${esc(r.u || "")}</small></span>${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ""}${bar}</div>`;
    }).join("") + `</div>`;
  }
  if (simple) { const i = html.indexOf('<div class="sg"><h4 class="cap">Mass'); const j = i >= 0 ? i : html.indexOf('<div class="sg">'); if (j >= 0) html = html.slice(0, j) + `<details class="eng"><summary>Engineering details ▾</summary>` + html.slice(j) + `</details>`; }
  $("stats").innerHTML = html;
  $("stats").querySelectorAll(".q").forEach(q => q.onclick = () => showLesson(q.dataset.l));
  wireExperiments();
  $("goBtn").disabled = false;
}
/* ---------- predict-then-try experiments ---------- */
function experimentsHTML() {
  const X = LEARN.experiments(S.kind, S.p); if (!X.length) return "";
  S._xp = X;
  return `<div class="sg" style="border-top:0;padding-top:0"><h4 class="cap">Try an experiment · guess first</h4>` + X.map((e, i) => `<div class="xp" data-i="${i}"><button class="xb">${esc(e.l)}</button><div class="pq" hidden></div><div class="res" hidden></div></div>`).join("") + `</div>`;
}
function wireExperiments() {
  document.querySelectorAll("#stats .xp").forEach(box => {
    const e = S._xp[+box.dataset.i], pq = box.querySelector(".pq"), res = box.querySelector(".res");
    box.querySelector(".xb").onclick = () => {
      const m = S._tiles[e.metric || 0], [yes, no] = LEARN.PAIR[e.q] || ["More", "Less"];
      pq.innerHTML = `Before you try it: what happens to <b>${esc(m.k.toLowerCase())}</b>?<div class="row2"><button class="hb" data-a="1">${esc(yes)}</button><button class="hb" data-a="0">${esc(no)}</button></div>`; pq.hidden = false;
      pq.querySelectorAll("button").forEach(b => b.onclick = () => runExperiment(e, b.dataset.a === "1"));
    };
  });
}
function runExperiment(e, guessUp) {
  const before = S._tiles, prev = JSON.parse(JSON.stringify(S.p)), idx = e.metric || 0;
  pushHist(); e.do(S.p); S._coach = { key: "xp", label: e.l, before }; rebuild();
  const a = before[idx], b = S._tiles[idx], wentUp = b.n > a.n, same = a.v === b.v || Math.abs(b.n - a.n) <= Math.abs(a.n) * 0.005;
  const right = !same && wentUp === guessUp, L = A.LESSONS[e.lesson];
  showLesson(e.lesson, null, true);
  const box = [...document.querySelectorAll("#stats .xp")].find(x => S._xp[+x.dataset.i] && S._xp[+x.dataset.i].l === e.l);
  const html = `<div class="res ${right ? "ok" : "no"}"><b>${same ? "Barely changed!" : right ? "You called it!" : "Surprise!"}</b> ${esc(a.k)}: ${esc(a.v)} ${esc(a.u || "")} → ${esc(b.v)} ${esc(b.u || "")}. ${esc(L.p.split(". ")[0])}. <button class="hb" style="padding:5px 9px;font-size:11px;margin-top:6px" id="xpUndo">Undo</button></div>`;
  const r = document.createElement("div"); r.innerHTML = html; if (box) box.appendChild(r.firstChild); else $("stats").prepend(r.firstChild);
  const u = document.getElementById("xpUndo"); if (u) u.onclick = () => { S.p = prev; S._coach = null; setChange(""); rebuild(); };
}
function rebuild() { buildControls(); recompute(true); window.S3D && S3D.setVehicle(S.kind, S.p, true); saveHash(); }
function massParts() {
  const r = S.r; if (!r) return null;
  if (S.kind === "rocket") { const acc = {}; for (const q of r.g.parts) acc[q.tag] = (acc[q.tag] || 0) + q.m; acc.propellant = r.mprop; return Object.entries(acc).filter(e => e[1] > 0); }
  const P = S.kind === "plane" ? r.P.parts : S.kind === "car" ? r.mass.parts : r.parts;
  return P ? Object.entries(P).filter(e => e[1] > 0) : null;
}

/* ---------- lessons ---------- */
/* The idea card opens by itself only the first time a concept comes up. After that the
   concept goes to the small idea tab, which reopens the card whenever the student wants. */
const SEEN = new Set(store.get("liftoff-seen", []));
function showLesson(key, extra, auto) {
  const L = A.LESSONS[key]; if (!L) return;
  S.lesson = key; $("lT").textContent = L.t; $("lF").textContent = L.f; $("lX").textContent = L.x;
  $("lP").textContent = extra || L.p || L.x; $("lA").textContent = L.a ? "Think of it like this: " + L.a : ""; $("lA").hidden = !L.a;
  $("lMath").open = !(window.LEARN && LEARN.simple); $("lCap").textContent = "The idea behind it"; updateLessonLive();
  $("itT").textContent = L.t;
  if (auto && (SEEN.has(key) || (innerWidth < 860 && S.mode !== "build"))) { ideaTab(true); return; }
  SEEN.add(key); store.set("liftoff-seen", [...SEEN]);
  openIdea();
}
function openIdea() { if (document.body.classList.contains("testing")) return; $("lesson").classList.remove("off"); $("itab").classList.remove("on"); clearTimeout(showLesson._t); showLesson._t = setTimeout(closeIdea, 25000); }
function closeIdea() { $("lesson").classList.add("off"); ideaTab(false); }
function ideaTab(flash) { const t = $("itab"); if (!S.lesson || document.body.classList.contains("testing") || !$("lesson").classList.contains("off") || t.dataset.hide === "1") { if (!$("lesson").classList.contains("off")) t.classList.remove("on"); return; } t.classList.add("on"); if (flash) { t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); } }
function setChange(txt) { $("lChg").textContent = txt; $("lChg").hidden = !txt; $("itChg").textContent = txt; $("itChg").hidden = !txt; if (txt) { $("itab").dataset.hide = ""; ideaTab(true); } }
function updateLessonLive() {
  const k = S.lesson, r = S.r, el = $("lLive"); if (!k || !r) { el.textContent = ""; return; }
  let t = "";
  try {
    if (S.kind === "rocket") {
      if (k === "stability") t = r.g.liquid ? "Your rocket: steered by gimbaled engines." : `Your rocket: CP ${A.nf(r.g.CP * 100 / (r.g.L < 3 ? 1 : 100), r.g.L < 3 ? 1 : 2)} ${r.g.L < 3 ? "cm" : "m"} from the nose, margin ${A.nf(r.margin0, 2)} diameters.`;
      if (k === "thrust") t = `Your rocket: T/W = ${A.nf(r.tw0, 2)}`;
      if (k === "rocketeq") t = `Your rocket: Δv = ${A.nf(r.dv)} m/s, mass ratio ${A.nf(r.m0 / r.mdry, 2)}`;
      if (k === "drag") t = `Your rocket: Cd ≈ ${A.nf(r.cd0, 2)}, drag losses ${A.nf(r.dLoss)} m/s`;
      if (k === "maxq") t = `Your rocket: max Q ${A.nf(r.maxQ / 1000, 1)} kPa at ${A.Dm(r.maxQh).join(" ")}`;
      if (k === "heating") t = `Your rocket: peak skin ${A.nf(r.maxSkin - 273.15)} °C (limit ${r.g.M.Tmax} °C)`;
      if (k === "atmosphere") t = `Launch site air density: ${A.nf(A.atm(r.planet, S.p.alt0).rho, 3)} kg/m³`;
    } else if (S.kind === "car") {
      if (k === "downforce" || k === "stall") t = `Your car: ${A.nf(r.df200)} kg of downforce at 200 km/h`;
      if (k === "drag") t = `Your car: CdA ${A.nf(r.aero.CdA, 2)} m², top speed ${A.nf(r.vtop * 3.6)} km/h`;
      if (k === "groundeffect") t = `Your car: ride height ${S.p.ride} mm${r.aero.porpoise ? " · porpoising!" : ""}`;
    } else if (S.kind === "plane") {
      if (k === "lift" || k === "stall") t = `Your aircraft: stall speed ${A.nf(r.vs0 * 3.6)} km/h, wing loading ${A.nf(r.wingLoad)} kg/m²`;
      if (k === "induced") t = `Your aircraft: aspect ratio ${A.nf(r.P.AR, 1)}, span efficiency ${A.nf(r.P.e, 2)}`;
      if (k === "ld") t = `Your aircraft: best L/D ${A.nf(r.LDmax, 1)}`;
    } else if (S.kind === "drone") {
      if (k === "rotor") t = `Your drone: hover power ${A.nf(r.Ph)} W, disk loading ${A.nf(r.discLoad)} N/m²`;
      if (k === "tipmach") t = `Your drone: tips at Mach ${A.nf(r.tipM, 2)}, ${A.nf(r.rpm)} rpm`;
    } else if (S.kind === "boat" && !r.noLiquid) {
      if (k === "froude") t = `Your boat: Fn ${A.nf(r.rTop.Fn, 2)} at top speed, hull speed ${A.nf(r.hullSpeed * 1.944, 1)} kn`;
      if (k === "metacentric") t = `Your boat: GM = ${A.nf(r.GM, 2)} m`;
    } else if (S.kind === "sub" && !r.noLiquid) {
      if (k === "crush") t = `Your sub: crush depth ${A.Dm(r.crush).join(" ")} (${r.mode})`;
      if (k === "pressure") t = `At target depth: ${A.nf(r.pT / 101325)} atm`;
      if (k === "buoyancy") t = `Your sub: ${A.Mk(Math.abs(r.netAt(0))).join(" ")} ${r.netAt(0) > 0 ? "positive" : "negative"} buoyancy with empty tanks`;
    }
    if (k === "planets") t = `${A.PLANETS[S.p.planet].name}: g = ${A.nf(A.PLANETS[S.p.planet].g, 2)} m/s², air ${A.nf(A.atm(S.p.planet, 0).rho, 3)} kg/m³`;
  } catch (e) { }
  el.textContent = t;
}
$("lx").onclick = closeIdea;
$("itab").onclick = e => { if (e.target.id === "itX") { $("itab").classList.remove("on"); $("itab").dataset.hide = "1"; return; } openIdea(); };

/* ---------- modes ---------- */
function setMode(m) {
  const prev = S.mode; S.mode = m;
  document.querySelectorAll("#modes button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === m));
  $("tunnel").classList.toggle("hide", m !== "tunnel"); $("legend").classList.toggle("hide", m !== "tunnel");
  document.body.classList.toggle("tun", m === "tunnel"); document.body.classList.toggle("course", m === "course");
  window.S3D && S3D.setMode(m === "course" ? "build" : m);
  if (window.COURSE) { if (m === "course") COURSE.open(); else if (prev === "course") COURSE.close(); }
  if (m === "tunnel") { $("tSpeed").value = { rocket: 0.14, car: 0.6, plane: 0.3, drone: 0.4, boat: 0.4, sub: 0.35 }[S.kind]; $("tAoa").value = 4; tunnelUI(); showLesson(S.kind === "boat" ? "froude" : S.kind === "sub" ? "reynolds" : S.kind === "plane" ? "lift" : "drag", null, true); }
  else window.S3D && S3D.arrows && S3D.arrows(null);
}
document.querySelectorAll("#modes button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
const TMAX = { rocket: 1700, car: 110, plane: 300, drone: 40, boat: 30, sub: 20 };
function tunnelUI() {
  const k = S.kind, v = +$("tSpeed").value * TMAX[k], water = k === "boat" || k === "sub", simple = window.LEARN && LEARN.simple, aoa = +$("tAoa").value;
  $("tsLab").textContent = simple ? (water ? "Water speed" : "Wind speed") : (water ? "Flow speed" : "Airspeed");
  $("tsVal").textContent = water ? `${A.nf(v * 1.944, 1)} kn` : k === "rocket" ? `${A.nf(v * 3.6)} km/h · M ${A.nf(v / 340, 2)}` : `${A.nf(v * 3.6)} km/h`;
  $("taLab").textContent = simple ? (k === "car" ? "Nose tilt" : k === "boat" ? "Tilt (boats stay level)" : "Tilt into the wind") : (k === "car" ? "Pitch (nose down +)" : "Angle of attack");
  $("taVal").textContent = `${aoa}°`;
  $("tAoaW").hidden = k === "boat";
  const f = window.S3D ? S3D.tunnel(v, aoa) : null; if (!f) return;
  S._tun = { v, aoa, frac: +$("tSpeed").value, raw: f.raw || {}, kind: k };
  $("tSimple").hidden = !simple; $("tForces").hidden = !!simple;
  $("tSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.v === "simple") === !!simple)));
  if (!simple) { $("tForces").innerHTML = f.map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join(""); return; }
  const R = f.raw || {}, L = window.LEARN, rows = [];
  const kgOf = N => A.Mk(Math.abs(N) / 9.81), bag = N => { const [a, u] = kgOf(N); return `like holding ${a} ${u}`; };
  if (R.noLiquid) rows.push(["", "There's no liquid on this world, so there's nothing to test."]);
  else if (k === "plane") {
    const frac = R.lift / R.weight;
    rows.push(["up", `<b>Lift ${frac >= 0 ? "holds up" : "pushes down"} ${A.nf(Math.abs(frac) * 100)}% of the plane's weight.</b> ${R.stall ? "The wing has <b>stalled</b>: air broke away from its top, so lift collapsed." : frac >= 1 ? "More than 100%: it would climb." : aoa < 14 ? "Tilt it more, or go faster, for more lift." : "Careful: a little more tilt and the wing stalls."}`]);
    rows.push(["back", `<b>Drag pushes back ${A.nf(Math.abs(R.drag))} N</b> (${bag(R.drag)}). For every 1 N of drag, the wing makes ${A.nf(R.lift / Math.max(R.drag, 1e-6), 0)} N of lift.`]);
  } else if (k === "car") {
    rows.push(["down", `<b>Air presses the car down with ${A.nf(Math.max(0, R.df / 9.81))} kg</b>: ${A.nf(Math.max(0, R.df / R.weight * 100))}% of its own weight. More press means more grip in corners.${R.stall ? " <b>The rear wing has stalled</b>, so it stopped pressing." : ""}`]);
    rows.push(["back", `<b>Drag holds it back with ${A.nf(R.drag)} N</b> (${bag(R.drag)}). Downforce always costs some drag.`]);
  } else if (k === "rocket") {
    rows.push(["back", `<b>Air pushes back ${A.nf(R.drag, R.drag < 10 ? 1 : 0)} N</b>, ${bag(R.drag)}. ${R.mach > 1 ? "It's faster than sound, so a shock wave (the white cone) forms at the nose." : R.mach > 0.8 ? "Close to the speed of sound: drag is about to jump." : "Twice the speed means four times the push."}`]);
    if (aoa) rows.push(["side", `<b>Tilted ${aoa}°, the wind pushes it sideways ${A.nf(Math.abs(R.side), 1)} N.</b> The fins turn that push into a nudge that points the nose back into the wind.`]);
  } else if (k === "drone") {
    rows.push(["back", `<b>Wind pushes back ${A.nf(R.drag, 1)} N</b>, ${bag(R.drag)}. To fly into it, the drone tilts ${A.nf(R.tilt, 1)}° forward so its rotors push against it.`]);
  } else if (k === "boat") {
    rows.push(["wave", `<b>${R.Fn < 0.4 ? "Pushing through the water" : R.Fn < 1 ? "Climbing its own bow wave (the hardest part)" : "Skimming on top of the water"}.</b> The waves it makes are ${A.nf(R.wl, 1)} m apart. When they get as long as the boat, it's stuck behind its own bow wave.`]);
  } else if (k === "sub") {
    rows.push(["back", `<b>Water holds it back ${A.nf(R.drag)} N</b> (${bag(R.drag)}). Water is about 800× denser than air, so even slow subs feel big drag. A long, smooth teardrop shape helps most.`]);
  }
  $("tSimple").innerHTML = rows.map(r => `<p class="tr ${r[0]}">${r[1]}</p>`).join("") + `<p class="tl2">${water ? "Lines show the water flowing past." : "Lines show the air flowing past."} On the surface, <span style="color:#ff5d6c">red</span> = ${water ? "water" : "air"} slamming into it (high pressure), <span style="color:#4f8cff">blue</span> = ${water ? "water" : "air"} rushing past fast (low pressure). Arrows show the forces.</p>`;
}
$("tSeg").querySelectorAll("button").forEach(b => b.onclick = () => window.LEARN && LEARN.setSimple(b.dataset.v === "simple"));
$("tSpeed").oninput = tunnelUI; $("tAoa").oninput = tunnelUI;
window.tunnelUI = tunnelUI;

/* ---------- test ---------- */
function startTest() {
  if (S.busy) return; recompute(true);
  if (!window.TEST) return;
  document.body.classList.add("testing"); $("lesson").classList.add("off"); $("itab").classList.remove("on"); $("tunnel").classList.add("hide"); $("legend").classList.add("hide");
  if (S.mode === "course" && window.COURSE) COURSE.close(true);
  $("bottom").classList.add("hide"); setHangar(false);
  TEST.start(S.kind, S.p, S.r, S.rep, { onEnd: showReport, onExit: exitTest });
  if (window.LEARN) setTimeout(() => LEARN.narrate(S.kind), 400);
}
function exitTest() {
  document.body.classList.remove("testing"); $("hud").classList.add("hide"); $("report").classList.remove("on"); $("bottom").classList.remove("hide");
  TEST.stop(); setMode(S.mode === "tunnel" ? "tunnel" : S.mode === "course" ? "course" : "build"); window.S3D && S3D.setVehicle(S.kind, S.p, true); ideaTab(false);
  if (window.COURSE) COURSE.afterTest && COURSE.afterTest();
}
function showReport() {
  const rep = S.rep; $("rCap").textContent = `${A.VEHICLES[S.kind].name} · test report`;
  $("rH").textContent = rep.verdict.lvl === "good" ? "Mission success" : rep.verdict.lvl === "warn" ? "Mission complete, with issues" : "Mission failed";
  $("rV").innerHTML = `<div id="verdictR" class="${rep.verdict.lvl}" style="border:1px solid;border-radius:11px;padding:10px 12px;font-size:13px;border-color:${LV[rep.verdict.lvl]}">${esc(rep.verdict.t)}</div>`;
  $("rT").innerHTML = (window.LEARN && LEARN.simple && S._tiles) ? S._tiles.map(t => `<div class="tile ${t.lvl || ""}"><div class="cap">${esc(t.k)}</div><div class="n">${esc(t.v)}<small>${esc(t.u || "")}</small></div><div class="cmp">${esc(t.cmp)}</div></div>`).join("") : rep.headline.map(h => `<div class="tile"><div class="cap">${esc(h.k)}</div><div class="n">${esc(h.v)}<small>${esc(h.u || "")}</small></div><div class="s">${esc(h.sub || "")}</div></div>`).join("");
  $("rEv").innerHTML = rep.events.length ? "Timeline: " + rep.events.map(e => `<b style="color:var(--accent2);font-family:var(--mono);font-weight:500">T+${A.nf(e.t, 1)}s</b> ${esc(e.label)}`).join(" · ") : "";
  $("rAI").textContent = ""; $("report").classList.add("on");
  logRun(); if (window.LEARN) LEARN.check(true);
}
$("goBtn").onclick = startTest;
$("rAgain").onclick = () => { $("report").classList.remove("on"); TEST.restart(); };
$("rReplay").onclick = () => { $("report").classList.remove("on"); TEST.replay(); };
$("rBuild").onclick = exitTest;
$("exitT").onclick = exitTest;
$("rAsk").onclick = () => ask(`Explain this test result and one change that would improve it.`, $("rAI"));
$("rPatch").onclick = conceptArt;
window.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("testing")) exitTest(); });

/* ---------- commands (rules first, AI second) ---------- */
const VK = [["rocket", /\b(rocket|missile|launcher|booster)\b/], ["car", /\b(car|racer|f1|formula|kart|vehicle on wheels|hypercar)\b/], ["plane", /\b(plane|aircraft|airplane|jet|glider|airliner|wing)\b/], ["drone", /\b(drone|quad|copter|helicopter|rotor)\b/], ["boat", /\b(boat|ship|yacht|catamaran|hydrofoil|ferry)\b/], ["sub", /\b(sub|submarine|submersible|bathyscaphe)\b/]];
const MATW = { carbon: "carbon", aluminum: "aluminum", aluminium: "aluminum", steel: "steel", titanium: "titanium", balsa: "balsa", wood: "balsa", cardboard: "paper", paper: "paper", fiberglass: "fiberglass", fibreglass: "fiberglass", pla: "pla", plastic: "pla", hdpe: "hdpe", acrylic: "acrylic" };
function applyRules(txt) {
  const t = txt.toLowerCase(), did = []; pushHist();
  for (const [k, re] of VK) if (re.test(t) && k !== S.kind) { loadVehicle(k); did.push(A.VEHICLES[k].name); break; }
  const pk = S.kind, P = A.VEHICLES[pk].presets;
  const pre = pk === "rocket" ? (/orbit/.test(t) ? "orbital" : /space|kármán|karman|100 ?km/.test(t) ? "space" : /high.?power|amateur/.test(t) ? "highpower" : /class|school|small|model/.test(t) ? "classroom" : null)
    : pk === "car" ? (/f1|formula|open.?wheel/.test(t) ? "open" : /\bgt\b|le mans|endurance/.test(t) ? "gt" : /electric|ev\b|tesla/.test(t) ? "ev" : /road|sports/.test(t) ? "road" : null)
    : pk === "plane" ? (/glid|sailplane/.test(t) ? "glider" : /airliner|jet|747|737|a320/.test(t) ? "airliner" : /electric/.test(t) ? "evtol" : /cessna|trainer|light/.test(t) ? "trainer" : null)
    : pk === "drone" ? (/mars|ingenuity/.test(t) ? "mars" : /fpv|racing|racer/.test(t) ? "racer" : /cargo|delivery|heavy/.test(t) ? "cargo" : /camera|photo/.test(t) ? "photo" : null)
    : pk === "boat" ? (/foil/.test(t) ? "foil" : /catamaran|\bcat\b/.test(t) ? "cat" : /speed|fast|planing/.test(t) ? "speed" : /trawler|cruiser|displacement/.test(t) ? "trawler" : null)
    : (/titan/.test(t) ? "titan" : /deep|trench|mariana|challenger|sphere/.test(t) ? "bathy" : /attack|navy|military/.test(t) ? "attack" : /research/.test(t) ? "research" : null);
  if (pre && P[pre] && pre !== S.preset[pk]) { loadVehicle(pk, pre, true); did.push(P[pre].name); }
  for (const pl of ["mars", "titan", "venus", "moon", "earth"]) if (new RegExp("\\b" + pl + "\\b").test(t)) { const opts = A.SCHEMA[S.kind].find(c => c.k === "planet").opts; if (opts.includes(pl)) { S.p.planet = pl; const lq = Object.keys(A.PLANETS[pl].liquids); if ("liquid" in S.p && lq.length) S.p.liquid = lq[0]; did.push("on " + A.PLANETS[pl].name); } }
  for (const [w, m] of Object.entries(MATW)) if (new RegExp("\\b" + w).test(t)) { const c = A.SCHEMA[S.kind].find(c => c.type === "mat"); if (c && c.opts.includes(m)) { S.p.mat = m; did.push(A.MATERIALS[m].name); } break; }
  const gen = window.PLUS ? PLUS.genericRules(t) : []; did.push(...gen);
  const bump = (keys, f, label) => { if (gen.length) return; bump0(keys, f, label); };
  const bump0 = (keys, f, label) => { for (const k of keys) if (k in S.p && typeof S.p[k] === "number") { const c = A.SCHEMA[S.kind].find(c => c.k === k); S.p[k] = clamp(S.p[k] * f, c ? c.min : -Infinity, c ? c.max : Infinity); } did.push(label); };
  if (/\b(longer|bigger|larger)\b/.test(t)) bump(["L", "span", "prop", "D"], 1.25, "bigger");
  if (/\b(shorter|smaller|tiny)\b/.test(t)) bump(["L", "span", "prop", "D"], 0.8, "smaller");
  if (/\b(lighter)\b/.test(t)) bump(["wall", "payload"], 0.7, "lighter");
  if (/\b(heavier)\b/.test(t)) bump(["wall", "payload"], 1.4, "heavier");
  if (/more (power|thrust)|faster|stronger engine/.test(t)) bump(["power", "thrust", "nEng"], 1.3, "more power");
  if (/less (power|thrust)|slower/.test(t)) bump(["power", "thrust"], 0.75, "less power");
  if (/downforce/.test(t) && S.kind === "car") { S.p.wing = "double"; S.p.wingAng = 14; S.p.fwing = true; S.p.diff = 12; did.push("max downforce"); }
  if (!gen.length && /bigger fins|more fins|stable/.test(t) && S.kind === "rocket") { S.p.span = Math.min(4, S.p.span * 1.3); S.p.fins = Math.max(S.p.fins, 4); did.push("bigger fins"); }
  const num = t.match(/(length|span|power|thrust|payload|depth|altitude|speed|wing angle|angle)\s*(?:of|to|=)?\s*([\d.]+)\s*(km|m|kw|kn|kg|t|°)?/);
  if (num) { const map = { length: "L", span: "span", power: "power", thrust: "thrust", payload: "payload", depth: "target", altitude: S.kind === "plane" ? "cruise" : "alt0", "wing angle": "wingAng", angle: S.kind === "car" ? "wingAng" : "tilt" }; const k = map[num[1]]; let v = +num[2]; if (num[3] === "km") v *= 1000; if (num[3] === "t") v *= 1000; if (k && k in S.p) { S.p[k] = v; did.push(`${num[1]} ${num[2]}${num[3] || ""}`); } }
  const act = /\b(launch|fly|go|run|dive|test|send it)\b/.test(t), tun = /tunnel|tank/.test(t);
  if (did.length) { buildControls(); recompute(true); window.S3D && S3D.setVehicle(S.kind, S.p, true); saveHash(); }
  if (!did.length) HIST.u.pop(), histUI();
  return { did, act, tun, question: /\?|^(why|how|what|explain|should|can|which|is|does)\b/.test(t) };
}
async function command(voice) {
  const txt = $("cmd").value.trim(); if (!txt) return;
  $("cmd").value = "";
  if (window.PLUS && await PLUS.preCommand(txt, voice)) return;
  const before = S._tiles, kind0 = S.kind;
  const res = applyRules(txt);
  if (res.question || (!res.did.length && !res.act && !res.tun)) { if (!res.did.length && !res.question && S.ai) { const ok = await aiDesign(txt); if (ok) return; } ask(txt, null, voice); return; }
  const eff = res.did.length && kind0 === S.kind && window.LEARN ? LEARN.coach("the design", before, S._tiles).replace(/^You changed the design: ?/, "").replace(/^You changed the design\. /, "") : "";
  const msg = res.did.length ? `Done: ${res.did.join(", ")}.${eff ? " " + eff.charAt(0).toUpperCase() + eff.slice(1) : ""}` : res.tun ? "Opening the wind tunnel." : "Launching.";
  if (window.PLUS) PLUS.say(msg, voice); else toast(msg);
  if (res.tun) setMode("tunnel");
  if (res.act) setTimeout(startTest, 400);
}
$("cmd").addEventListener("keydown", e => { if (e.key === "Enter") command(false); });
$("sendB").onclick = () => { if ($("cmd").value.trim()) command(false); else { $("cmd").focus(); window.PLUS && PLUS.showHelp(); } };
$("ask").onclick = () => { if ($("cmd").value.trim()) command(); else ask("What's the weakest part of this design, and how do I fix it?"); };

/* ---------- AI engineer (backend: OpenAI / Grok / Claude, Token Company compression, cost ledger) ---------- */
const API = location.protocol.startsWith("http") && !/claude\.ai|claudeusercontent/.test(location.host) ? "" : null;
async function api(path, body, method) {
  if (API === null) throw new Error("offline");
  const r = await fetch(API + path, { method: method || (body ? "POST" : "GET"), headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(r.status); return r.json();
}
function summary() { const rep = S.rep; return { vehicle: S.kind, params: S.p, verdict: rep.verdict.t, headline: rep.headline.map(h => `${h.k}: ${h.v} ${h.u || ""}`), stats: rep.groups.map(g => g.t + ": " + g.rows.map(r => `${r.k} ${r.v}${r.u ? " " + r.u : ""}`).join("; ")) }; }
function localAnswer(q) {
  const rep = S.rep, L = A.LESSONS[rep.verdict.tip] || A.LESSONS.drag;
  return `${rep.verdict.t}\n\n${L.t}: ${L.x} (${L.f})`;
}
/* ---------- Meta Llama 3.2, on the student's own device (WebLLM: no key, no server) ---------- */
const LLAMA = { engine: null, loading: false, model: "Llama-3.2-1B-Instruct-q4f16_1-MLC" };
async function loadLlama() {
  if (LLAMA.engine || LLAMA.loading) return;
  const b = $("llamaB");
  if (!navigator.gpu) { toast("Meta Llama runs on your device's GPU. Open LiftOff in Chrome or Edge on a laptop to use it.", 4200); return; }
  LLAMA.loading = true; b.textContent = "Llama 0%"; toast("Downloading Meta Llama 3.2 (about 0.9 GB, once). It then runs fully on this device.", 4500);
  try {
    const webllm = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm");
    LLAMA.engine = await webllm.CreateMLCEngine(LLAMA.model, { initProgressCallback: p => { b.textContent = `Llama ${Math.round((p.progress || 0) * 100)}%`; } });
    b.textContent = "Llama ✓"; b.classList.add("on"); b.setAttribute("aria-pressed", "true");
    toast("Meta Llama 3.2 is running on this device. Ask it anything about your design.");
  } catch (e) { console.error(e); b.textContent = "Llama"; toast("Llama couldn't start here. The built-in engineer still answers.", 4000); }
  LLAMA.loading = false;
}
async function llamaAnswer(q) {
  const c = summary();
  const sys = "You are LiftOff's flight engineer, teaching a student through their own design. Use ONLY the numbers given (they come from a physics engine). Answer in at most 90 words, plain language. Explain the physics behind the result, then give exactly one concrete change to try.";
  const r = await LLAMA.engine.chat.completions.create({ temperature: 0.4, max_tokens: 220, messages: [{ role: "system", content: sys }, { role: "user", content: `Question: ${q}\n\nVehicle: ${c.vehicle}\nVerdict: ${c.verdict}\nResults: ${c.headline.join("; ")}\n${c.stats.slice(0, 3).join("\n")}` }] });
  return r.choices[0].message.content.trim();
}
$("llamaB").onclick = () => { if (LLAMA.engine) { ask("What's the weakest part of this design, and how do I fix it?"); return; } loadLlama(); };

async function ask(q, target, voice) {
  const out = target || null;
  if (!out) showLesson(S.rep.verdict.tip || "drag", null, false);
  let text, who = "Flight engineer";
  if (out) out.textContent = "Thinking…";
  try {
    if (LLAMA.engine) { text = await llamaAnswer(q); who = "Engineer · Meta Llama 3.2 (on device)"; }
    else { if (!S.ai) throw new Error("no ai"); const r = await api("/ask", { question: q, context: summary() }); text = r.answer; if (r.cost) toast(`Engineer answered · ${r.cost}`); }
  } catch (e) { text = localAnswer(q); }
  if (out) out.textContent = text; else { $("lCap").textContent = who; $("lT").textContent = q.length > 70 ? q.slice(0, 67) + "…" : q; $("lP").textContent = text; $("lA").hidden = true; $("lMath").open = false; $("lLive").textContent = ""; openIdea(); clearTimeout(showLesson._t); }
  if (voice && window.PLUS) PLUS.speak(text.split("\n")[0]);
}
async function aiDesign(txt) {
  try {
    const schema = A.SCHEMA[S.kind].map(c => ({ k: c.k, type: c.type, min: c.min, max: c.max, opts: c.opts && c.opts.map(o => Array.isArray(o) ? o[0] : o) }));
    const r = await api("/studio/design", { prompt: txt, vehicle: S.kind, params: S.p, schema });
    if (r && r.patch && Object.keys(r.patch).length) { Object.assign(S.p, r.patch); buildControls(); recompute(true); S3D.setVehicle(S.kind, S.p, true); toast(`AI engineer: ${r.note || "design updated"}`); return true; }
  } catch (e) { }
  return false;
}
async function conceptArt() {
  $("rAI").textContent = "Rendering concept art…";
  try { const r = await api("/render", { vehicle: S.kind, params: S.p, verdict: S.rep.verdict.t }); if (r.url) { $("rAI").innerHTML = `<img src="${esc(r.url)}" alt="AI concept art of this design" style="width:100%;border-radius:12px;border:1px solid var(--line)">`; return; } $("rAI").textContent = r.error || "Concept art needs an xAI key on the ground station."; }
  catch (e) { $("rAI").textContent = "Concept art runs on the ground station (Grok Imagine). Start the backend to use it."; }
}

/* voice + Jarvis-style commands live in studio-plus.js */

/* ---------- hangar (MongoDB + Elastic when online, memory otherwise) ---------- */
function runRecord() { const labels = {}; for (const c of A.SCHEMA[S.kind]) labels[c.k] = c.l.toLowerCase(); return { id: Date.now().toString(36), t: new Date().toISOString(), vehicle: S.kind, name: $("vName").textContent, params: JSON.parse(JSON.stringify(S.p)), labels, verdict: S.rep.verdict, headline: S.rep.headline, metric: S.rep.headline[0] }; }
async function logRun() {
  const rec = runRecord(); S.runs.unshift(rec); renderHangar();
  try { await api("/runs", rec); } catch (e) { }
}
function renderHangar(list, insight) {
  const L = list || S.runs; const box = $("hlist");
  box.innerHTML = (insight ? `<div class="insight">${esc(insight)}</div>` : "") + (L.length ? "" : `<div style="color:var(--muted);font-size:12.5px">No test runs yet. Build something and hit ${VERB[S.kind]}.</div>`) +
    L.map((r, i) => `<button class="run" data-i="${i}"><span class="cmpR" data-i="${i}" role="button" title="Compare the current design with this one">Compare</span><b>${esc(r.name)}</b><span class="m">${esc(r.metric.k)}: ${esc(r.metric.v)} ${esc(r.metric.u || "")}</span><span>${esc(r.verdict.t.slice(0, 110))}${r.verdict.t.length > 110 ? "…" : ""}</span></button>`).join("");
  box.querySelectorAll(".run").forEach(b => b.onclick = () => { const r = L[+b.dataset.i]; pushHist(); loadVehicle(r.vehicle, undefined, true); S.p = Object.assign({}, r.params); rebuild(); $("vName").textContent = r.name; toast("Design restored"); });
  box.querySelectorAll(".run .cmpR").forEach(b => b.onclick = e => { e.stopPropagation(); const r = L[+b.dataset.i]; if (window.PLUS) PLUS.pinDesign(r.vehicle, r.params, r.name); });
}
function setHangar(on) { $("hangar").classList.toggle("on", on); $("hangarB").setAttribute("aria-pressed", on); $("hangarBtn").setAttribute("aria-pressed", on); if (on) renderHangar(); }
$("hangarBtn").onclick = () => setHangar(!$("hangar").classList.contains("on"));
$("hangarB").onclick = () => setHangar(!$("hangar").classList.contains("on"));
$("hangarX").onclick = () => setHangar(false);
window.addEventListener("keydown", e => { const typing0 = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); if ((e.metaKey || e.ctrlKey) && !typing0 && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); } });
$("undoB").onclick = undo; $("redoB").onclick = redo;
window.addEventListener("keydown", e => { const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); if (e.key === "Escape" && $("hangar").classList.contains("on")) setHangar(false); else if (!typing && (e.key === "h" || e.key === "H") && !document.body.classList.contains("testing")) setHangar(!$("hangar").classList.contains("on")); });
$("hq").addEventListener("keydown", async e => {
  if (e.key !== "Enter") return; const q = $("hq").value.trim(); if (!q) { renderHangar(); return; }
  try { const r = await api("/runs/search?q=" + encodeURIComponent(q)); renderHangar(r.runs || [], r.insight); return; } catch (err) { }
  const t = q.toLowerCase(); let L = S.runs;
  for (const [k, re] of VK) if (re.test(t)) L = L.filter(r => r.vehicle === k);
  if (/space|kármán/.test(t)) L = L.filter(r => /space|orbit/i.test(r.verdict.t));
  if (/fail|crash|broke|sank|sink/.test(t)) L = L.filter(r => r.verdict.lvl === "bad");
  if (/success|good/.test(t)) L = L.filter(r => r.verdict.lvl === "good");
  renderHangar(L, L.length ? `${L.length} matching run${L.length > 1 ? "s" : ""} (searched on this device).` : "No matches on this device.");
});

/* ---------- record a test (download + Dropbox via ground station) ---------- */
let mrec = null, mchunks = [];
$("recBtn").onclick = () => {
  if (mrec) { mrec.stop(); return; }
  try { const st = $("gl").captureStream(30); mrec = new MediaRecorder(st, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" }); } catch (e) { toast("Recording isn't supported in this browser"); return; }
  mchunks = []; mrec.ondataavailable = e => e.data.size && mchunks.push(e.data);
  mrec.onstop = async () => { const blob = new Blob(mchunks, { type: "video/webm" }); mrec = null; $("recBtn").textContent = "● Rec"; $("recBtn").style.color = "";
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `liftoff-${S.kind}-${Date.now()}.webm`; a.click();
    const last = S.runs[0]; if (last && API !== null) { const fd = new FormData(); fd.append("file", blob, a.download); try { const r = await fetch(`/runs/${last.id}/video`, { method: "POST", body: fd }); if (r.ok) toast("Saved to Dropbox"); } catch (e) { } } };
  mrec.start(); $("recBtn").textContent = "■ Stop"; $("recBtn").style.color = "var(--bad)"; toast("Recording the test…");
};

/* ---------- share link ---------- */
function saveHash() { try { history.replaceState(null, "", "#" + btoa(unescape(encodeURIComponent(JSON.stringify({ k: S.kind, p: S.p }))))); } catch (e) { } }
function readHash() { try { if (location.hash.length < 5) return null; return JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))); } catch (e) { return null; } }

/* ---------- boot ---------- */
function buildTabs() {
  const nav = $("vtabs");
  for (const k of Object.keys(A.VEHICLES)) {
    const b = document.createElement("button"); b.className = "vt"; b.dataset.k = k; b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${ICON[k]}</svg><span>${A.VEHICLES[k].name}</span>`;
    b.onclick = () => { loadVehicle(k); toast(`${A.VEHICLES[k].name} bay`); };
    nav.appendChild(b);
  }
}
async function boot() {
  buildTabs();
  const lines = ["Aero solver ............ <b>online</b>", "Atmosphere · ISA-1976 + 4 worlds ... <b>loaded</b>", `Materials database ..... <b>${Object.keys(A.MATERIALS).length} entries</b>`, "Propulsion catalog ..... <b>" + (Object.keys(A.MOTORS).length + Object.keys(A.ENGINES).length) + " engines</b>", "Vehicle bays ........... <b>6 ready</b>"];
  const log = $("bootLog"), bar = $("bootBar"), fast = /fast/.test(location.search);
  try { const h = await api("/health"); S.ai = !!(h && h.ai && h.ai.llm); lines.push(`Ground station ......... <b>${S.ai ? "AI online" : "online"}</b>`); } catch (e) { lines.push("Ground station ......... <b>offline mode</b>"); }
  $("aiDot").classList.toggle("on", S.ai);
  for (let i = 0; i < lines.length; i++) { log.innerHTML += lines[i] + "\n"; bar.style.width = ((i + 1) / lines.length * 100) + "%"; if (!fast) await new Promise(r => setTimeout(r, 190)); }
  const h = readHash();
  if (h && A.VEHICLES[h.k]) { loadVehicle(h.k); S.p = Object.assign(S.p, h.p); buildControls(); recompute(true); S3D.setVehicle(S.kind, S.p, true); $("vName").textContent = "Shared design"; }
  else loadVehicle("rocket", "highpower");
  setTimeout(() => $("boot").classList.add("done"), fast ? 0 : 250);
  if (!fast && !h && window.INTRO) setTimeout(() => INTRO.show(), 150);
}
window.addEventListener("load", boot);
window.STUDIO_API = { rebuild, rerender: () => { recompute(true); if (S.mode === "tunnel") tunnelUI(); }, recompute, loadVehicle, setMode, startTest, exitTest, showLesson, openIdea, closeIdea, setChange, api, applyRules, ask, command, pushHist, undo, redo, histUI, toSlider, fromSlider, fmtVal, buildControls, buildPresets, saveHash, tunnelUI, logRun, get LLAMA() { return LLAMA; }, loadLlama };
})();
