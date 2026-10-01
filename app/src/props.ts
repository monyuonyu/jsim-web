/*
 * 右の「クイックプロパティ」。選んだ部品の設定と、統計（実行中は時々更新）を出す。
 * 何も選んでいない時は、モデル全体の設定（止める時刻など）。
 */
import type { Entity } from "../../src/jaamsim/internal.ts";
import { getOutputDef } from "../../src/jaamsim/input/OutputRegistry.ts";
import { t } from "./i18n.ts";
import { DISTS, fmt, type DistKind, type ModelOps, type TimeSpec, type TimeUnitName } from "./model.ts";
import type { PropDef, StatDef } from "./catalog.ts";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text) e.textContent = text;
	return e;
};

function section(title: string, open = true): { root: HTMLElement; body: HTMLElement } {
	const root = el("div", "qp-section" + (open ? " open" : ""));
	const head = el("div", "qp-head", title);
	head.onclick = () => root.classList.toggle("open");
	const body = el("div", "qp-body");
	root.append(head, body);
	return { root, body };
}

function row(label: string, ...controls: HTMLElement[]): HTMLElement {
	const r = el("div", "qp-row");
	r.append(el("label", "", label), ...controls);
	return r;
}

/** 数の欄。get は今の値。入れた後は、受け付けられなかった時も含めて、欄を今の値に戻す（空欄は 0 にしない） */
function numInput(get: () => number, onChange: (v: number) => void, step = "any", allowEmpty = false): HTMLInputElement {
	const i = el("input");
	i.type = "number";
	i.step = step;
	const show = () => { const v = get(); i.value = Number.isFinite(v) ? String(Math.round(v * 1e9) / 1e9) : ""; };
	show();
	i.onchange = () => {
		const text = i.value.trim();
		const v = Number(text);
		if (text === "" ? allowEmpty : Number.isFinite(v)) onChange(text === "" ? NaN : v);
		show();
	};
	return i;
}

const UNITS: TimeUnitName[] = ["s", "min", "h"];
const unitLabel = (u: TimeUnitName) => t({ s: "seconds", min: "minutes", h: "hours" }[u]);

export class QuickProps {
	private statCells: { ent: Entity; def: StatDef; cell: HTMLElement }[] = [];
	private current: Entity[] = [];

	/** 停止時間を変えた時（ツールバーの欄も合わせる） */
	onStopTime: () => void = () => {};

	constructor(readonly host: HTMLElement, readonly ops: ModelOps, readonly msg: (s: string) => void) {}

	show(sel: Entity[]): void {
		this.current = sel;
		this.host.innerHTML = "";
		this.statCells = [];
		this.host.append(el("div", "qp-title", t("Quick Properties")));
		if (sel.length === 0) return this.showModel();
		if (sel.length > 1) {
			this.host.append(el("div", "qp-note", t("{0} objects selected", sel.length)));
			return;
		}
		const ent = sel[0];
		const def = this.ops.defOf(ent);
		if (def === undefined) return;

		const head = el("div", "qp-object");
		const icon = el("span", "qp-icon");
		icon.innerHTML = def.icon;
		const name = el("input", "qp-name");
		name.value = ent.getName();
		name.onchange = () => {
			const err = this.ops.rename(ent, name.value.trim());
			if (err) this.msg(err);
			name.value = ent.getName();
		};
		head.append(icon, name, el("span", "qp-type", t(def.label)));
		this.host.append(head);

		if (def.props.length > 0) {
			const s = section(t(def.label));
			for (const p of def.props) s.body.append(this.propRow(ent, p));
			this.host.append(s.root);
		}
		const pos = section(t("Location"), false);
		pos.body.append(row("X (m)", numInput(() => this.ops.position(ent)[0], v => this.ops.move(ent, v, this.ops.position(ent)[1]))));
		pos.body.append(row("Y (m)", numInput(() => this.ops.position(ent)[1], v => this.ops.move(ent, this.ops.position(ent)[0], v))));
		pos.body.append(row(t("Rotation") + " (°)", numInput(() => this.ops.rotation(ent), v => this.ops.rotate(ent, v))));
		this.host.append(pos.root);

		if (def.stats.length > 0) {
			const s = section(t("Statistics"));
			for (const st of def.stats) {
				const cell = el("span", "qp-stat");
				s.body.append(row(t(st.label), cell));
				this.statCells.push({ ent, def: st, cell });
			}
			this.host.append(s.root);
			this.updateStats();
		}
	}

	private propRow(ent: Entity, p: PropDef): HTMLElement {
		const e = this.ops.engine;
		const apply = (v: string) => {
			try { e.setInput(ent, p.key, v); }
			catch (ex) { this.msg(ex instanceof Error ? ex.message : String(ex)); }
		};
		switch (p.kind) {
			case "time": return this.timeEditor(ent, p);
			case "int": {
				const cur = e.getInputString(ent, p.key);
				const i = el("input");
				i.type = "number"; i.step = "1"; i.placeholder = t("(unlimited)");
				i.value = cur;
				i.onchange = () => { apply(i.value.trim()); i.value = e.getInputString(ent, p.key); };
				return row(t(p.label), i);
			}
			case "length": {
				return row(t(p.label) + " (m)", numInput(() => parseFloat(e.getInputString(ent, p.key)) || 0, v => apply(`${fmt(v)} m`)));
			}
			default: {
				const i = el("input");
				i.value = e.getInputString(ent, p.key);
				i.onchange = () => { apply(i.value); i.value = e.getInputString(ent, p.key); };
				return row(t(p.label), i);
			}
		}
	}

	/** 時間: 定数か確率分布。種類を選ぶと、その項目が出る */
	private timeEditor(ent: Entity, p: PropDef): HTMLElement {
		const wrap = el("div", "qp-time");
		const spec = this.ops.getTime(ent, p.key);
		const kind = el("select");
		for (const [k, d] of Object.entries(DISTS)) {
			const o = el("option", "", t(d.label));
			o.value = k;
			kind.append(o);
		}
		kind.value = spec.kind;
		const unit = el("select");
		for (const u of UNITS) { const o = el("option", "", unitLabel(u)); o.value = u; unit.append(o); }
		unit.value = spec.unit;
		const params = el("div", "qp-params");
		const draw = (s: TimeSpec) => {
			params.innerHTML = "";
			DISTS[s.kind].params.forEach((pd, i) => {
				params.append(row(t(pd.label), numInput(() => s.params[i] ?? NaN, v => {
					const old = s.params[i];
					s.params[i] = v;
					// 受け付けられなければ、元の値に戻す
					if (!this.commitTime(ent, p.key, s)) s.params[i] = old;
				})));
			});
		};
		kind.onchange = () => {
			const k = kind.value as DistKind;
			const mean = spec.params[0] ?? 10;
			const guess: Record<DistKind, number[]> = {
				const: [mean], exp: [mean], uniform: [mean * 0.5, mean * 1.5], tri: [mean * 0.5, mean, mean * 1.5],
				normal: [mean, mean * 0.2], lognormal: [Math.log(Math.max(mean, 1e-9)), 0.5], gamma: [mean, 2], weibull: [mean, 2], erlang: [mean, 2],
			};
			spec.kind = k;
			spec.params = guess[k];
			this.commitTime(ent, p.key, spec);
			draw(spec);
		};
		unit.onchange = () => { spec.unit = unit.value as TimeUnitName; this.commitTime(ent, p.key, spec); };
		draw(spec);
		wrap.append(row(t(p.label), kind, unit), params);
		return wrap;
	}

	private commitTime(ent: Entity, key: string, spec: TimeSpec): boolean {
		try { this.ops.setTime(ent, key, spec); return true; }
		catch (ex) { this.msg(ex instanceof Error ? ex.message : String(ex)); return false; }
	}

	private showModel(): void {
		const e = this.ops.engine;
		const s = section(t("Model"));
		const stop = numInput(() => e.stopTime === null ? NaN : e.stopTime / 3600, v => {
			e.stopTime = v > 0 ? v * 3600 : null;
			this.onStopTime();
		}, "any", true);
		stop.placeholder = t("(none)");
		s.body.append(row(t("Stop time") + ` (${t("hours")})`, stop));
		s.body.append(el("div", "qp-note", t("Drag objects from the Library into the model. Hold A and drag from one object to another to connect them.")));
		this.host.append(s.root);
	}

	/** 統計の値を今の時刻で書き直す */
	updateStats(): void {
		const e = this.ops.engine;
		const simTime = e.simTime();
		for (const { ent, def, cell } of this.statCells) {
			if (e.state === "idle") { cell.textContent = "–"; cell.className = "qp-stat"; continue; }
			const od = getOutputDef(ent.constructor as never, def.output);
			let v: unknown;
			try { v = od?.get(ent, simTime); } catch { v = undefined; }
			cell.className = "qp-stat";
			if (typeof v === "number") {
				if (def.kind === "fraction" && def.output === "Utilisation") cell.textContent = `${(v * 100).toFixed(1)} %`;
				else if (def.kind === "time") cell.textContent = `${v.toFixed(2)} ${t("s")}`;
				else if (def.kind === "fraction") cell.textContent = v.toFixed(2);
				else cell.textContent = String(Math.round(v));
			}
			else if (typeof v === "string") {
				cell.textContent = t(v);
				cell.classList.add("state-" + v.toLowerCase());
			}
			else cell.textContent = "–";
		}
	}

	/** モデルが変わった時に、欄の値を今の値にする（ドラッグで動かした時など）。入力の途中なら触らない。
	 *  開いている節・巻き上げの位置はそのまま */
	refreshValues(): void {
		if (this.host.contains(document.activeElement)) return;
		const open = [...this.host.querySelectorAll(".qp-section")].map(x => x.classList.contains("open"));
		const scroll = this.host.scrollTop;
		this.refresh();
		const secs = [...this.host.querySelectorAll(".qp-section")];
		if (secs.length === open.length) secs.forEach((x, i) => x.classList.toggle("open", open[i]));
		this.host.scrollTop = scroll;
	}

	refresh(): void {
		// 選んだ物が消えていたら外す
		this.show(this.current.filter(e => this.ops.find(e.getName()) === e));
	}
}
