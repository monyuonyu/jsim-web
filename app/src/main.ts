/*
 * 画面の組み立て: メニュー・ツールバー（実行の操作）・ライブラリ・3D の作業場・クイックプロパティ・状態の行
 */
import { Engine } from "./engine.ts";
import { ModelOps } from "./model.ts";
import { ModelView } from "./scene.ts";
import { QuickProps } from "./props.ts";
import { Dashboard } from "./dashboard.ts";
import { History } from "./history.ts";
import { AiTools } from "./ai-tools.ts";
import { AiChat } from "./ai-chat.ts";
import { CATALOG, categoryLabel, type Category } from "./catalog.ts";
import { t, LANGS, getLang, setLang } from "./i18n.ts";

const $ = (id: string) => document.getElementById(id)!;
const engine = new Engine();
const ops = new ModelOps(engine);
let view: ModelView;
try {
	view = new ModelView($("view"), ops);
}
catch (ex) {
	// 3D（WebGL）が使えない PC。アプリ（Electron）なら、ソフトウェアの描画で起動し直してみる
	const h = (window as unknown as { jsimHost?: { relaunchSoftGL?(): Promise<boolean> } }).jsimHost;
	void h?.relaunchSoftGL?.();
	// 起動し直せない時（ブラウザ・もうソフトウェアで描いている）は、画面の枠だけ出して知らせる
	$("view").innerHTML = `<div style="padding:40px;color:#b00">${t("3D graphics (WebGL) are not available on this PC.")}<br>${String(ex)}</div>`;
	throw ex;
}
const props = new QuickProps($("props"), ops, toast);
const dash = new Dashboard($("dashboard"), ops);
const history = new History(engine, () => { view.setSelection([]); view.rebuild(); });
let clipboard: string[] = [];
const aiChat = new AiChat($("ai"), new AiTools(ops), history, toast);
// 右の欄の切り替え（クイックプロパティ / AI チャット）
$("rtab-props").textContent = t("Quick Properties");
$("rtab-ai").textContent = t("AI Chat");
function showRight(which: "props" | "ai"): void {
	$("rtab-props").classList.toggle("active", which === "props");
	$("rtab-ai").classList.toggle("active", which === "ai");
	($("props") as HTMLElement).hidden = which !== "props";
	($("ai") as HTMLElement).hidden = which !== "ai";
}
$("rtab-props").onclick = () => showRight("props");
$("rtab-ai").onclick = () => showRight("ai");
void aiChat;

function copySel(): void { clipboard = [...view.selection].map(e => e.getName()); }
function paste(): void {
	const made = clipboard.map(n => ops.find(n)).filter(e => e !== null).map(e => ops.duplicate(e!));
	if (made.length > 0) view.setSelection(made);
}
function deleteSel(): void { for (const e of view.selection) ops.remove(e); view.setSelection([]); }
let fileName: string | null = null;
let dirty = false;

document.title = t("jsim - Simulation");
$("tab-model").textContent = t("Model");
$("tab-dash").textContent = t("Dashboard");
function showTab(which: "model" | "dash"): void {
	$("tab-model").classList.toggle("active", which === "model");
	$("tab-dash").classList.toggle("active", which === "dash");
	$("view").style.display = which === "model" ? "" : "none";
	$("dashboard").classList.toggle("show", which === "dash");
	dash.setVisible(which === "dash");
	if (which === "model") view.resize();
}
$("tab-model").onclick = () => showTab("model");
$("tab-dash").onclick = () => showTab("dash");

// ---- お知らせ ----
let toastTimer = 0;
function toast(msg: string): void {
	const el = $("toast");
	el.textContent = msg;
	el.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => el.classList.remove("show"), 3500);
}

// ---- アイコン ----
const ic = (d: string, fill = "none") =>
	`<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
	new: ic(`<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>`),
	open: ic(`<path d="M3 7h6l2 2h10v10H3z"/>`),
	save: ic(`<path d="M5 3h12l3 3v15H5z"/><path d="M8 3v5h8V3M8 21v-7h8v7"/>`),
	reset: `<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2-5" fill="none" stroke="#1f6fb2" stroke-width="2.2" stroke-linecap="round"/><path d="M4 3v5h5" fill="none" stroke="#1f6fb2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	run: `<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#2f9e44"/></svg>`,
	stop: `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" fill="#c92a2a"/></svg>`,
	step: `<svg viewBox="0 0 24 24"><path d="M5 5l9 7-9 7z" fill="#2f9e44"/><rect x="16" y="5" width="3" height="14" fill="#2f9e44"/></svg>`,
	fit: ic(`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`),
};

// ---- メニュー ----
type MenuItem = { label: string; key?: string; run: () => void } | "-";
function buildMenus(): void {
	const menus: [string, MenuItem[]][] = [
		[t("File"), [
			{ label: t("New Model"), key: "Ctrl+N", run: newModel },
			{ label: t("Open Model..."), key: "Ctrl+O", run: openModel },
			{ label: t("Save"), key: "Ctrl+S", run: () => saveModel(false) },
			{ label: t("Save As..."), run: () => saveModel(true) },
			"-",
			{ label: t("Open Sample Model"), run: sampleModel },
		]],
		[t("Edit"), [
			{ label: t("Undo"), key: "Ctrl+Z", run: () => history.undo() },
			{ label: t("Redo"), key: "Ctrl+Y", run: () => history.redo() },
			"-",
			{ label: t("Copy"), key: "Ctrl+C", run: copySel },
			{ label: t("Paste"), key: "Ctrl+V", run: paste },
			{ label: t("Delete"), key: "Del", run: deleteSel },
			"-",
			{ label: t("Select All"), key: "Ctrl+A", run: () => view.setSelection(ops.visibleObjects()) },
		]],
		[t("View"), [
			{ label: t("Fit Model in View"), key: "F", run: () => view.fit() },
			{ label: t("Model"), run: () => showTab("model") },
			{ label: t("Dashboard"), run: () => showTab("dash") },
			"-",
			...LANGS.map(([code, name]) => ({ label: (getLang() === code ? "✓ " : "") + name, run: () => setLang(code) })),
		]],
		[t("Execute"), [
			{ label: t("Reset"), run: () => engine.reset() },
			{ label: t("Run"), key: "Space", run: () => engine.run() },
			{ label: t("Stop"), run: () => engine.stop() },
			{ label: t("Step"), run: () => engine.step() },
		]],
		[t("Help"), [
			{ label: t("How to Use"), run: () => toast(t("Drag objects from the Library into the model. Hold A and drag from one object to another to connect them.")) },
			{ label: t("About jsim"), run: () => toast(t("jsim — a discrete-event simulator based on JaamSim (Apache-2.0)")) },
		]],
	];
	const bar = $("menubar");
	for (const [title, items] of menus) {
		const m = document.createElement("div");
		m.className = "menu";
		m.textContent = title;
		const list = document.createElement("div");
		list.className = "menu-items";
		for (const it of items) {
			if (it === "-") { list.append(Object.assign(document.createElement("div"), { className: "menu-sep" })); continue; }
			const row = document.createElement("div");
			row.className = "menu-item";
			row.innerHTML = `<span></span><span class="key"></span>`;
			(row.children[0] as HTMLElement).textContent = it.label;
			(row.children[1] as HTMLElement).textContent = it.key ?? "";
			row.onclick = ev => { ev.stopPropagation(); bar.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")); it.run(); };
			list.append(row);
		}
		m.append(list);
		m.onclick = ev => { ev.stopPropagation(); const was = m.classList.contains("open"); bar.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")); if (!was) m.classList.add("open"); };
		m.onmouseenter = () => { if (bar.querySelector(".menu.open") && !m.classList.contains("open")) { bar.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")); m.classList.add("open"); } };
		bar.append(m);
	}
	document.addEventListener("click", () => bar.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open")));
}

// ---- ツールバー ----
const tb: Record<string, HTMLButtonElement> = {};
let timeEl: HTMLElement, speedEl: HTMLElement, stopEl: HTMLInputElement;
function buildToolbar(): void {
	const bar = $("toolbar");
	const btn = (id: keyof typeof ICONS, label: string, run: () => void) => {
		const b = document.createElement("button");
		b.className = "tb-btn";
		b.innerHTML = ICONS[id] + `<span>${label}</span>`;
		b.title = label;
		b.onclick = run;
		tb[id] = b;
		bar.append(b);
	};
	const sep = () => bar.append(Object.assign(document.createElement("div"), { className: "tb-sep" }));
	btn("new", t("New"), newModel);
	btn("open", t("Open"), openModel);
	btn("save", t("Save"), () => saveModel(false));
	sep();
	btn("fit", t("Fit"), () => view.fit());
	sep();
	btn("reset", t("Reset"), () => engine.reset());
	btn("run", t("Run"), () => engine.run());
	btn("stop", t("Stop"), () => engine.stop());
	btn("step", t("Step"), () => engine.step());
	sep();
	const g1 = document.createElement("div");
	g1.className = "tb-group";
	g1.innerHTML = `<span></span><span class="tb-time"></span>`;
	(g1.children[0] as HTMLElement).textContent = t("Run Time:");
	timeEl = g1.children[1] as HTMLElement;
	bar.append(g1);
	const g2 = document.createElement("div");
	g2.className = "tb-group";
	g2.innerHTML = `<span></span><input type="number" min="0" step="any">`;
	(g2.children[0] as HTMLElement).textContent = t("Stop Time (h):");
	stopEl = g2.children[1] as HTMLInputElement;
	stopEl.placeholder = t("(none)");
	stopEl.onchange = () => { const v = Number(stopEl.value); engine.stopTime = stopEl.value !== "" && v > 0 ? v * 3600 : null; };
	bar.append(g2);
	const g3 = document.createElement("div");
	g3.className = "tb-group";
	g3.innerHTML = `<span></span><input type="range" min="0" max="100" value="33"><span class="tb-speed"></span>`;
	(g3.children[0] as HTMLElement).textContent = t("Run Speed:");
	const slider = g3.children[1] as HTMLInputElement;
	speedEl = g3.children[2] as HTMLElement;
	// 0.1 倍 〜 10 万倍（対数）
	const setSpeed = () => { engine.speed = Math.pow(10, -1 + Number(slider.value) / 100 * 6); speedEl.textContent = fmtSpeed(engine.speed); };
	slider.oninput = setSpeed;
	setSpeed();
	bar.append(g3);
}

function fmtSpeed(v: number): string {
	return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function fmtTime(s: number): string {
	const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
	const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
	return d > 0 ? t("{0}d", d) + " " + hms : hms;
}

// ---- ライブラリ ----
function buildLibrary(): void {
	const lib = $("library");
	lib.innerHTML = "";
	const title = document.createElement("div");
	title.className = "dock-title";
	title.textContent = t("Library");
	lib.append(title);
	const cats: Category[] = ["fixed", "conveyor", "resource", "logic"];
	for (const c of cats) {
		const g = document.createElement("div");
		g.className = "lib-group";
		const head = document.createElement("div");
		head.className = "lib-group-head";
		head.textContent = categoryLabel(c);
		head.onclick = () => g.classList.toggle("closed");
		const items = document.createElement("div");
		items.className = "lib-items";
		for (const d of CATALOG.filter(x => x.category === c && !x.hidden)) {
			const it = document.createElement("div");
			it.className = "lib-item";
			it.draggable = true;
			it.innerHTML = d.icon + "<span></span>";
			(it.lastElementChild as HTMLElement).textContent = t(d.label);
			it.title = t("Drag into the model");
			it.ondragstart = ev => { ev.dataTransfer!.setData("text/x-jsim-object", d.id); ev.dataTransfer!.effectAllowed = "copy"; };
			items.append(it);
		}
		g.append(head, items);
		lib.append(g);
	}
}

// ---- ファイル ----
function confirmDiscard(): boolean {
	return !dirty || confirm(t("Discard the changes to the present model?"));
}

function newModel(): void {
	if (!confirmDiscard()) return;
	engine.newModel();
	history.clear();
	fileName = null;
	filePath = null;
	dirty = false;
	view.setSelection([]);
	view.fit();
}

/** Electron で動いている時のファイルの窓口（preload.cjs） */
interface Host {
	openModel(): Promise<{ path: string; name: string; text: string } | null>;
	saveModel(path: string | null, text: string, as: boolean): Promise<{ path: string; name: string } | null>;
}
const host = (window as unknown as { jsimHost?: Host }).jsimHost;
let filePath: string | null = null;

function loadText(text: string, name: string): void {
	try {
		engine.newModel(text, name);
		history.clear();
		fileName = name;
		dirty = false;
		view.setSelection([]);
		view.fit();
	}
	catch (ex) {
		toast(t("Could not open the model: {0}", ex instanceof Error ? ex.message : String(ex)));
		engine.newModel();
	}
}

function openModel(): void {
	if (!confirmDiscard()) return;
	if (host) {
		void host.openModel().then(r => { if (r) { filePath = r.path; loadText(r.text, r.name); } });
		return;
	}
	const input = $("file-open") as HTMLInputElement;
	input.value = "";
	input.onchange = async () => {
		const f = input.files?.[0];
		if (!f) return;
		loadText(await f.text(), f.name);
	};
	input.click();
}

function saveModel(as: boolean): void {
	if (host) {
		void host.saveModel(filePath, engine.saveText(), as).then(r => {
			if (r) { filePath = r.path; fileName = r.name; dirty = false; updateButtons(); }
		});
		return;
	}
	let name = fileName ?? "model.cfg";
	if (as || fileName === null) {
		const n = prompt(t("File name"), name);
		if (!n) return;
		name = n.endsWith(".cfg") ? n : n + ".cfg";
	}
	const text = engine.saveText();
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
	a.download = name;
	a.click();
	URL.revokeObjectURL(a.href);
	fileName = name;
	dirty = false;
}

/** 見本: ソース → キュー → プロセッサ 2 台 → コンベヤ → シンク */
function sampleModel(): void {
	if (!confirmDiscard()) return;
	engine.newModel();
	const src = ops.place("source", -8, 0);
	const q = ops.place("queue", -4, 0);
	const p1 = ops.place("processor", 0, 2);
	const p2 = ops.place("processor", 0, -2);
	const conv = ops.place("conveyor", 5, 0);
	const sink = ops.place("sink", 10, 0);
	ops.setTime(src, "InterArrivalTime", { kind: "exp", params: [6], unit: "s" });
	ops.setTime(p1, "ServiceTime", { kind: "tri", params: [8, 10, 14], unit: "s" });
	ops.setTime(p2, "ServiceTime", { kind: "tri", params: [8, 10, 14], unit: "s" });
	ops.connect(src, q);
	ops.connect(q, p1);
	ops.connect(q, p2);
	ops.connect(p1, conv);
	ops.connect(p2, conv);
	ops.connect(conv, sink);
	history.clear();
	dirty = false;
	view.setSelection([]);
	view.fit();
}

// ---- つなぎ込み ----
view.onSelect = sel => props.show(sel);

// 右クリックのメニュー
function contextMenu(items: [string, () => void][], x: number, y: number): void {
	document.querySelector(".ctx-menu")?.remove();
	const m = document.createElement("div");
	m.className = "ctx-menu menu-items";
	m.style.display = "block";
	for (const [label, run] of items) {
		if (label === "-") { m.append(Object.assign(document.createElement("div"), { className: "menu-sep" })); continue; }
		const r = document.createElement("div");
		r.className = "menu-item";
		r.textContent = label;
		r.onclick = () => { m.remove(); run(); };
		m.append(r);
	}
	m.style.left = `${x}px`;
	m.style.top = `${y}px`;
	document.body.append(m);
	const close = (ev: Event) => { if (!m.contains(ev.target as Node)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
	setTimeout(() => document.addEventListener("pointerdown", close, true));
}
view.onContextMenu = (ent, x, y) => {
	if (ent === null) {
		contextMenu([
			[t("Paste"), paste],
			[t("Fit Model in View"), () => view.fit()],
		], x, y);
		return;
	}
	contextMenu([
		[t("Properties..."), () => openProperties(ent)],
		["-", () => {}],
		[t("Rotate 90°"), () => { for (const e of view.selection) ops.rotate(e, ops.rotation(e) + 90); }],
		[t("Disconnect All"), () => { for (const e of view.selection) ops.disconnectAll(e); }],
		["-", () => {}],
		[t("Copy"), copySel],
		[t("Duplicate"), () => { copySel(); paste(); }],
		[t("Delete"), deleteSel],
	], x, y);
};

// プロパティの窓（FlexSim でダブルクリックした時の窓）
function openProperties(ent: import("../../src/jaamsim/internal.ts").Entity): void {
	document.querySelector(".prop-window")?.remove();
	const w = document.createElement("div");
	w.className = "prop-window";
	const head = document.createElement("div");
	head.className = "prop-window-head";
	head.textContent = t("Properties") + " - " + ent.getName();
	const close = document.createElement("button");
	close.textContent = "×";
	close.onclick = () => w.remove();
	head.append(close);
	const body = document.createElement("div");
	body.className = "prop-window-body";
	w.append(head, body);
	document.body.append(w);
	const qp = new QuickProps(body, ops, toast);
	qp.show([ent]);
	body.querySelector(".qp-title")?.remove();
	body.querySelectorAll(".qp-section").forEach(s => s.classList.add("open"));
	// 見出しをつかんで動かす
	let drag: [number, number] | null = null;
	head.onpointerdown = ev => {
		const r = w.getBoundingClientRect();
		w.style.transform = "none";
		w.style.left = `${r.left}px`;
		w.style.top = `${r.top}px`;
		drag = [ev.clientX - r.left, ev.clientY - r.top];
		head.setPointerCapture(ev.pointerId);
	};
	head.onpointermove = ev => { if (drag) { w.style.left = `${ev.clientX - drag[0]}px`; w.style.top = `${ev.clientY - drag[1]}px`; } };
	head.onpointerup = () => { drag = null; };
	const timer = window.setInterval(() => { if (!document.body.contains(w)) clearInterval(timer); else qp.updateStats(); }, 300);
}
view.onDoubleClick = ent => openProperties(ent);
view.onMessage = toast;
view.onDrop = (id, x, y) => {
	try {
		const ent = ops.place(id, x, y);
		view.setSelection([ent]);
	}
	catch (ex) { toast(ex instanceof Error ? ex.message : String(ex)); }
};

let lastState = engine.state;
engine.onChange(() => {
	dirty = true;
	view.rebuild();
	if (engine.error) { toast(engine.error); engine.error = null; }
	if (engine.warning) { toast(t("The model has input errors. Fix them before running.") + "\n" + engine.warning); engine.warning = null; }
	if (engine.state !== lastState) { lastState = engine.state; props.updateStats(); }
	updateButtons();
});

function updateButtons(): void {
	const s = engine.state;
	tb.run.disabled = s === "running" || s === "ended";
	tb.stop.disabled = s !== "running";
	tb.step.disabled = s === "running" || s === "ended";
	tb.reset.disabled = s === "idle";
	$("statusbar").textContent = [
		t({ idle: "Ready", running: "Running", paused: "Stopped", ended: "Finished" }[s]),
		t("{0} objects", ops.visibleObjects().length),
		fileName ?? t("(unsaved)"),
	].join("   |   ");
}

window.addEventListener("keydown", ev => {
	if ((ev.target as HTMLElement).closest("input, textarea, select")) return;
	if (ev.ctrlKey && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveModel(false); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "o") { ev.preventDefault(); openModel(); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "n") { ev.preventDefault(); newModel(); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "a") { ev.preventDefault(); view.setSelection(ops.visibleObjects()); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "z") { ev.preventDefault(); history.undo(); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "y") { ev.preventDefault(); history.redo(); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "c") { ev.preventDefault(); copySel(); }
	else if (ev.ctrlKey && ev.key.toLowerCase() === "v") { ev.preventDefault(); paste(); }
	else if (ev.key === "Escape") { document.querySelector(".ctx-menu")?.remove(); document.querySelector(".prop-window")?.remove(); }
	else if (ev.key === " ") { ev.preventDefault(); if (engine.state === "running") engine.stop(); else engine.run(); }
	else if (ev.key.toLowerCase() === "f" && !ev.ctrlKey) view.fit();
});
window.addEventListener("beforeunload", ev => { if (dirty) ev.preventDefault(); });

buildMenus();
buildToolbar();
buildLibrary();
props.show([]);
updateButtons();
if (new URLSearchParams(location.search).has("sample")) sampleModel();

// ---- 描く ----
let prev = performance.now();
let statTimer = 0;
let dashTimer = 0;
function frame(now: number): void {
	const dt = (now - prev) / 1000;
	prev = now;
	try { engine.advance(dt); }
	catch (ex) { engine.stop(); toast(ex instanceof Error ? ex.message : String(ex)); }
	view.syncDynamic(engine.simTime(), engine.state === "running");
	view.render();
	timeEl.textContent = fmtTime(engine.simTime());
	dash.sample();
	statTimer += dt;
	if (statTimer > 0.25) { statTimer = 0; props.updateStats(); }
	dashTimer += dt;
	if (dashTimer > 0.5) { dashTimer = 0; dash.draw(); }
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { jsim: unknown }).jsim = { engine, ops, view, showTab, showRight, history, aiTools: (aiChat as unknown as { tools: AiTools }).tools };
