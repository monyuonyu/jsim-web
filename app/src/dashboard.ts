/*
 * ダッシュボード（FlexSim のダッシュボードにならう）。実行中に値を集め、グラフで出す。
 * - 状態: プロセッサごとの状態の割合（横の積み上げ棒）。JaamSim の StateTimes から
 * - 数の推移: キューの今の数の推移（折れ線）
 * - 出口の数の推移: シンクの入力数（折れ線）
 * - 平均滞在時間: キューごと（棒）
 */
import type { Entity } from "../../src/jaamsim/internal.ts";
import { getOutputDef } from "../../src/jaamsim/input/OutputRegistry.ts";
import type { ModelOps } from "./model.ts";
import { t } from "./i18n.ts";

const STATE_COLOR: Record<string, string> = {
	Idle: "#e0c000", Working: "#2fbf4a", Blocked: "#d04040", Stopped: "#9aa3ad",
	Setup: "#3b82f6", Setdown: "#6aa0f7", Maintenance: "#f08c00", Breakdown: "#b02020",
};
const LINE_COLORS = ["#1f6fb2", "#e8590c", "#2f9e44", "#ae3ec9", "#c92a2a", "#0c8599", "#5c940d", "#862e9c"];

function out(ent: Entity, name: string, simTime: number): unknown {
	try { return getOutputDef(ent.constructor as never, name)?.get(ent, simTime); } catch { return undefined; }
}

interface Series { name: string; pts: [number, number][] }

export class Dashboard {
	private content = new Map<Entity, Series>();
	private output = new Map<Entity, Series>();
	private lastSample = -1;
	private visible = false;

	constructor(readonly host: HTMLElement, readonly ops: ModelOps) {}

	reset(): void {
		this.content.clear();
		this.output.clear();
		this.lastSample = -1;
	}

	setVisible(v: boolean): void {
		this.visible = v;
		if (v) this.draw();
	}

	/** 描く間ごとに呼ぶ。時刻が進んでいれば値を記録する */
	sample(): void {
		const e = this.ops.engine;
		if (e.state === "idle") { if (this.lastSample >= 0) this.reset(); return; }
		const now = e.simTime();
		if (now <= this.lastSample) return;
		this.lastSample = now;
		for (const ent of this.ops.visibleObjects()) {
			const id = this.ops.defOf(ent)?.id;
			if (id === "queue") this.push(this.content, ent, now, Number(out(ent, "QueueLength", now) ?? 0));
			if (id === "sink") this.push(this.output, ent, now, Number(out(ent, "NumberAdded", now) ?? 0));
		}
	}

	private push(map: Map<Entity, Series>, ent: Entity, x: number, y: number): void {
		let s = map.get(ent);
		if (s === undefined) { s = { name: ent.getName(), pts: [] }; map.set(ent, s); }
		s.name = ent.getName();
		const last = s.pts[s.pts.length - 1];
		if (last !== undefined && last[1] === y && s.pts.length > 1 && s.pts[s.pts.length - 2][1] === y) last[0] = x;
		else s.pts.push([x, y]);
		// 多くなりすぎたら間引く（形は保つ）
		if (s.pts.length > 4000) s.pts = s.pts.filter((_, i) => i % 2 === 0 || i === s!.pts.length - 1);
	}

	draw(): void {
		if (!this.visible) return;
		const e = this.ops.engine;
		const now = e.simTime();
		this.host.innerHTML = "";
		const grid = document.createElement("div");
		grid.className = "dash-grid";
		this.host.append(grid);
		const card = (title: string) => {
			const c = document.createElement("div");
			c.className = "dash-card";
			const h = document.createElement("div");
			h.className = "dash-title";
			h.textContent = title;
			const body = document.createElement("div");
			body.className = "dash-body";
			c.append(h, body);
			grid.append(c);
			return body;
		};

		// 状態
		const st = card(t("State"));
		const procs = this.ops.visibleObjects().filter(x => this.ops.defOf(x)?.id === "processor");
		if (procs.length === 0) st.append(this.note(t("No processors")));
		const used = new Set<string>();
		for (const p of procs) {
			const times = out(p, "StateTimes", now) as Map<string, number> | undefined;
			const row = document.createElement("div");
			row.className = "dash-state-row";
			const label = document.createElement("span");
			label.textContent = p.getName();
			const bar = document.createElement("div");
			bar.className = "dash-bar";
			const total = times ? [...times.values()].reduce((a, b) => a + b, 0) : 0;
			if (times && total > 0) {
				for (const [name, v] of times) {
					if (v <= 0) continue;
					used.add(name);
					const seg = document.createElement("div");
					seg.style.width = `${(v / total) * 100}%`;
					seg.style.background = STATE_COLOR[name] ?? "#888";
					seg.title = `${t(name)} ${(v / total * 100).toFixed(1)} %`;
					if (v / total > 0.08) seg.textContent = `${(v / total * 100).toFixed(0)}%`;
					bar.append(seg);
				}
			}
			row.append(label, bar);
			st.append(row);
		}
		if (used.size > 0) {
			const legend = document.createElement("div");
			legend.className = "dash-legend";
			for (const n of used) legend.innerHTML += `<span><i style="background:${STATE_COLOR[n] ?? "#888"}"></i>${t(n)}</span>`;
			st.append(legend);
		}

		// 数の推移
		const c1 = card(t("Queue content over time"));
		if (this.content.size === 0) c1.append(this.note(t("Run the model to see the graph.")));
		else c1.append(this.lineChart([...this.content.values()], true));

		// 出口の数
		const c2 = card(t("Items exited over time"));
		if (this.output.size === 0) c2.append(this.note(t("Run the model to see the graph.")));
		else c2.append(this.lineChart([...this.output.values()], false));

		// 平均滞在時間
		const c3 = card(t("Average staytime (s)"));
		const queues = this.ops.visibleObjects().filter(x => this.ops.defOf(x)?.id === "queue");
		const vals = queues.map(q => [q.getName(), e.state === "idle" ? 0 : Number(out(q, "AverageQueueTime", now) ?? 0)] as [string, number]);
		if (vals.length === 0) c3.append(this.note(t("No queues")));
		else c3.append(this.barChart(vals));
	}

	private note(s: string): HTMLElement {
		const d = document.createElement("div");
		d.className = "qp-note";
		d.textContent = s;
		return d;
	}

	private canvas(): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
		const c = document.createElement("canvas");
		const w = 520, h = 220, r = window.devicePixelRatio || 1;
		c.width = w * r; c.height = h * r;
		c.style.width = "100%"; c.style.maxWidth = `${w}px`; c.style.aspectRatio = `${w} / ${h}`;
		const g = c.getContext("2d")!;
		g.scale(r, r);
		g.font = "11px sans-serif";
		return [c, g, w, h];
	}

	private axes(g: CanvasRenderingContext2D, w: number, h: number, xMax: number, yMax: number, xLabel: (v: number) => string): { X: (v: number) => number; Y: (v: number) => number } {
		const L = 44, R = 10, T = 10, B = 26;
		const X = (v: number) => L + (v / xMax) * (w - L - R);
		const Y = (v: number) => h - B - (v / yMax) * (h - T - B);
		g.strokeStyle = "#e3e8ed"; g.fillStyle = "#5b6570"; g.lineWidth = 1;
		for (let i = 0; i <= 4; i++) {
			const v = (yMax / 4) * i, y = Y(v);
			g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke();
			g.textAlign = "right"; g.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), L - 4, y + 4);
		}
		for (let i = 0; i <= 4; i++) {
			const v = (xMax / 4) * i;
			g.textAlign = "center"; g.fillText(xLabel(v), X(v), h - 8);
		}
		g.strokeStyle = "#9aa4af";
		g.beginPath(); g.moveTo(L, T); g.lineTo(L, h - B); g.lineTo(w - R, h - B); g.stroke();
		return { X, Y };
	}

	private lineChart(series: Series[], step: boolean): HTMLElement {
		const [c, g, w, h] = this.canvas();
		const xMax = Math.max(1, ...series.flatMap(s => s.pts.map(p => p[0])));
		const yMax = niceMax(Math.max(1, ...series.flatMap(s => s.pts.map(p => p[1]))));
		const { X, Y } = this.axes(g, w, h, xMax, yMax, v => fmtAxisTime(v, xMax));
		const wrap = document.createElement("div");
		series.forEach((s, i) => {
			g.strokeStyle = LINE_COLORS[i % LINE_COLORS.length];
			g.lineWidth = 1.6;
			g.beginPath();
			s.pts.forEach(([x, y], k) => {
				if (k === 0) g.moveTo(X(x), Y(y));
				else {
					if (step) g.lineTo(X(x), Y(s.pts[k - 1][1]));
					g.lineTo(X(x), Y(y));
				}
			});
			g.stroke();
		});
		const legend = document.createElement("div");
		legend.className = "dash-legend";
		series.forEach((s, i) => { legend.innerHTML += `<span><i style="background:${LINE_COLORS[i % LINE_COLORS.length]}"></i></span>`; (legend.lastElementChild as HTMLElement).append(s.name); });
		wrap.append(c, legend);
		return wrap;
	}

	private barChart(vals: [string, number][]): HTMLElement {
		const [c, g, w, h] = this.canvas();
		const yMax = niceMax(Math.max(1, ...vals.map(v => v[1])));
		const L = 44, R = 10, T = 10, B = 26;
		const Y = (v: number) => h - B - (v / yMax) * (h - T - B);
		g.strokeStyle = "#e3e8ed"; g.fillStyle = "#5b6570";
		for (let i = 0; i <= 4; i++) {
			const v = (yMax / 4) * i, y = Y(v);
			g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke();
			g.textAlign = "right"; g.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), L - 4, y + 4);
		}
		const bw = (w - L - R) / vals.length;
		vals.forEach(([name, v], i) => {
			const x = L + i * bw + bw * 0.2;
			g.fillStyle = LINE_COLORS[0];
			g.fillRect(x, Y(v), bw * 0.6, Y(0) - Y(v));
			g.fillStyle = "#1f2328"; g.textAlign = "center";
			g.fillText(name, x + bw * 0.3, h - 8);
			g.fillText(v.toFixed(1), x + bw * 0.3, Y(v) - 4);
		});
		return c;
	}
}

function niceMax(v: number): number {
	const p = Math.pow(10, Math.floor(Math.log10(v)));
	for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
	return 10 * p;
}

function fmtAxisTime(v: number, max: number): string {
	if (max >= 7200) return `${(v / 3600).toFixed(1)}h`;
	if (max >= 120) return `${(v / 60).toFixed(0)}m`;
	return `${v.toFixed(0)}s`;
}
