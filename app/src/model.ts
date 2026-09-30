/*
 * 画面の操作（置く・つなぐ・動かす・消す・時間の設定）を、JaamSim の部品の入力に直す。
 *
 * FlexSim と JaamSim のつなぎ方の違い:
 * - FlexSim は作業台（Processor）に直接つなげる。JaamSim の Server は前に待ち行列（WaitQueue）が要る。
 *   そこで作業台を置いた時に、見えない待ち行列（名前の後ろに INNER）を一緒に作り、直接つながれた物はそこへ送る。
 *   待ち行列からつないだ時は、その待ち行列を WaitQueue にする。
 */
import { Entity, DisplayEntity, Vec3d, InputAgent, ClassRegistry } from "../../src/jaamsim/internal.ts";
import type { Engine } from "./engine.ts";
import { CATALOG, defByClass, defById, type ObjDef } from "./catalog.ts";
import { t } from "./i18n.ts";

export const INNER = "_in";
const ITEM_NAME = "Box";

export type DistKind = "const" | "exp" | "uniform" | "tri" | "normal" | "lognormal" | "gamma" | "weibull" | "erlang";
export type TimeUnitName = "s" | "min" | "h";

export interface TimeSpec {
	kind: DistKind;
	params: number[];
	unit: TimeUnitName;
}

/** 分布の種類ごとの JaamSim のクラスと、項目（キーワードと画面の名前、時間か） */
export const DISTS: Record<DistKind, { cls: string | null; label: string; params: { key: string; label: string; time: boolean }[] }> = {
	const: { cls: null, label: "Constant", params: [{ key: "", label: "Value", time: true }] },
	exp: { cls: "ExponentialDistribution", label: "Exponential", params: [{ key: "Mean", label: "Mean", time: true }] },
	uniform: { cls: "UniformDistribution", label: "Uniform", params: [{ key: "MinValue", label: "Minimum", time: true }, { key: "MaxValue", label: "Maximum", time: true }] },
	tri: { cls: "TriangularDistribution", label: "Triangular", params: [{ key: "MinValue", label: "Minimum", time: true }, { key: "Mode", label: "Mode", time: true }, { key: "MaxValue", label: "Maximum", time: true }] },
	normal: { cls: "NormalDistribution", label: "Normal", params: [{ key: "Mean", label: "Mean", time: true }, { key: "StandardDeviation", label: "Std. deviation", time: true }] },
	lognormal: { cls: "LogNormalDistribution", label: "Lognormal", params: [{ key: "NormalMean", label: "Normal mean", time: false }, { key: "NormalStandardDeviation", label: "Normal std. dev.", time: false }] },
	gamma: { cls: "GammaDistribution", label: "Gamma", params: [{ key: "Mean", label: "Mean", time: true }, { key: "Shape", label: "Shape", time: false }] },
	weibull: { cls: "WeibullDistribution", label: "Weibull", params: [{ key: "Scale", label: "Scale", time: true }, { key: "Shape", label: "Shape", time: false }] },
	erlang: { cls: "ErlangDistribution", label: "Erlang", params: [{ key: "Mean", label: "Mean", time: true }, { key: "Shape", label: "Shape", time: false }] },
};

export class ModelOps {
	constructor(readonly engine: Engine) {}

	get sm() { return this.engine.sm; }

	find(name: string): Entity | null {
		return this.sm.getNamedEntity(name);
	}

	defOf(ent: Entity): ObjDef | undefined {
		return defByClass(clsName(ent));
	}

	/** 画面に部品として出すもの（一覧にあるクラスで、作業台の内側の待ち行列でないもの） */
	visibleObjects(): DisplayEntity[] {
		return this.engine.displayEntities().filter(e =>
			!e.isGenerated() && this.defOf(e) !== undefined && !this.isInner(e));
	}

	isInner(e: Entity): boolean {
		return e.getName().endsWith(INNER) && this.find(e.getName().slice(0, -INNER.length)) !== null;
	}

	innerQueue(ent: Entity): Entity | null {
		return this.find(ent.getName() + INNER);
	}

	/** 流れる品物の型（無ければ作る） */
	itemPrototype(): Entity {
		let item = this.find(ITEM_NAME);
		if (item === null) {
			item = this.engine.define("SimEntity", ITEM_NAME);
			this.engine.setInput(item, "Size", "0.5 0.5 0.4 m");
			this.engine.setInput(item, "Alignment", "0 0 -0.5");
			this.engine.setInput(item, "Position", "0 -1000 0 m");
		}
		return item;
	}

	/** 部品を置く。x, y は床の上の位置（m） */
	place(defId: string, x: number, y: number): Entity {
		const def = defById(defId);
		const base = t(def.label).replace(/\s+/g, "");
		let n = 1;
		while (this.find(base + n) !== null) n++;
		const ent = this.engine.define(def.cls, base + n);
		const e = this.engine;
		e.setInput(ent, "Size", `${def.size.join(" ")} m`);
		switch (def.id) {
			case "source":
				e.setInput(ent, "PrototypeEntity", this.itemPrototype().getName());
				e.setInput(ent, "FirstArrivalTime", "0 s");
				this.setTime(ent, "InterArrivalTime", { kind: "exp", params: [10], unit: "s" });
				break;
			case "queue":
				e.setInput(ent, "MaxPerLine", "4");
				e.setInput(ent, "Spacing", "0.1 m");
				break;
			case "processor": {
				this.setTime(ent, "ServiceTime", { kind: "const", params: [10], unit: "s" });
				const q = this.engine.define("Queue", ent.getName() + INNER);
				e.setInput(q, "Size", "0.6 0.6 0.1 m");
				e.setInput(q, "MaxPerLine", "1");
				e.setInput(ent, "WaitQueue", q.getName());
				e.setInput(ent, "ProcessPosition", `0 0 ${def.size[2]} m`);
				break;
			}
			case "conveyor":
				e.setInput(ent, "TravelTime", "10 s");
				break;
			case "delay":
				this.setTime(ent, "Duration", { kind: "const", params: [5], unit: "s" });
				break;
		}
		this.move(ent, x, y);
		return ent;
	}

	/** 位置（m、床の上）を変える。作業台の内側の待ち行列とコンベヤの点も一緒に動かす */
	move(ent: Entity, x: number, y: number): void {
		const de = ent as DisplayEntity;
		const e = this.engine;
		const def = this.defOf(ent)!;
		if (def.id === "conveyor" || def.id === "delay") {
			const half = def.size[0] / 2;
			const old = this.points(de);
			let pts: [number, number][];
			if (old.length >= 2) {
				const c = old.reduce((a, p) => [a[0] + p[0] / old.length, a[1] + p[1] / old.length], [0, 0]);
				pts = old.map(p => [p[0] - c[0] + x, p[1] - c[1] + y]);
			}
			else
				pts = [[x - half, y], [x + half, y]];
			// コンベヤは品物がベルトの上を通るように、点の高さをベルトの高さにする
			const z = def.id === "conveyor" ? def.size[2] : 0;
			e.setInput(ent, "Points", pts.map(p => `{ ${fmt(p[0])} ${fmt(p[1])} ${fmt(z)} m }`).join(" "));
		}
		e.setInput(ent, "Position", `${fmt(x)} ${fmt(y)} 0.0 m`);
		const q = def.id === "processor" ? this.innerQueue(ent) : null;
		if (q !== null) {
			// 内側の待ち行列は、作業台の入口の側（向きに合わせて回す）
			const rz = de.getOrientation().z, d = -def.size[0] / 2 - 0.4;
			e.setInput(q, "Position", `${fmt(x + d * Math.cos(rz))} ${fmt(y + d * Math.sin(rz))} 0.0 m`);
		}
	}

	/** 向き（度、床の上で左回り） */
	rotation(ent: Entity): number {
		return Math.round((ent as DisplayEntity).getOrientation().z * 180 / Math.PI * 1000) / 1000;
	}

	rotate(ent: Entity, deg: number): void {
		const def = this.defOf(ent);
		const norm = ((deg % 360) + 360) % 360;
		if (def?.id === "conveyor" || def?.id === "delay") {
			// コンベヤは点を中心のまわりに回す
			const pts = this.points(ent as DisplayEntity);
			const [cx, cy] = this.position(ent);
			const d = (norm - this.rotation(ent)) * Math.PI / 180;
			const np = pts.map(([x, y]) => [cx + (x - cx) * Math.cos(d) - (y - cy) * Math.sin(d), cy + (x - cx) * Math.sin(d) + (y - cy) * Math.cos(d)]);
			const z = def.id === "conveyor" ? def.size[2] : 0;
			this.engine.setInput(ent, "Points", np.map(p => `{ ${fmt(p[0])} ${fmt(p[1])} ${fmt(z)} m }`).join(" "));
		}
		this.engine.setInput(ent, "Orientation", `0 0 ${fmt(norm)} deg`);
		const [x, y] = this.position(ent);
		if (def?.id !== "conveyor" && def?.id !== "delay") this.move(ent, x, y);
	}

	points(de: DisplayEntity): [number, number][] {
		const pts = (de as unknown as { getPoints(): Vec3d[] | null }).getPoints?.() ?? [];
		return (pts ?? []).map(p => [p.x, p.y]);
	}

	position(ent: Entity): [number, number] {
		const p = (ent as DisplayEntity).getPosition();
		return [p.x, p.y];
	}

	/** つなぐ（a の品物を b へ） */
	connect(a: Entity, b: Entity): string | null {
		const da = this.defOf(a), db = this.defOf(b);
		if (da === undefined || db === undefined) return null;
		if (!da.output) return t("A sink cannot send items.");
		if (a === b) return null;
		if (!db.direct && db.id === "source") return t("A source cannot receive items.");
		// 待ち行列 → 作業台: 作業台がその待ち行列から取る
		if (da.id === "queue" && db.id === "processor") {
			this.engine.setInput(b, "WaitQueue", a.getName());
			return null;
		}
		if (da.id === "queue") {
			return t("A queue can only be connected to a processor. Put a processor between them.");
		}
		const target = db.direct ? b : this.innerQueue(b);
		if (target === null) return null;
		// 作業台に待ち行列からつないでいたら、内側の待ち行列に戻す
		this.engine.setInput(a, "NextComponent", target.getName());
		return null;
	}

	disconnect(a: Entity, b: Entity): void {
		const db = this.defOf(b);
		if (this.defOf(a)?.id === "queue" && db?.id === "processor") {
			const q = this.innerQueue(b);
			if (q !== null) this.engine.setInput(b, "WaitQueue", q.getName());
			return;
		}
		const next = this.engine.getInputString(a, "NextComponent");
		const target = db?.direct ? b : this.innerQueue(b);
		if (target !== null && next === target.getName())
			this.engine.setInput(a, "NextComponent", "");
	}

	/** 画面に描くつながり [送る側, 受ける側] */
	links(): [Entity, Entity][] {
		const out: [Entity, Entity][] = [];
		for (const ent of this.visibleObjects()) {
			const def = this.defOf(ent)!;
			if (def.id === "processor") {
				const wq = this.find(this.engine.getInputString(ent, "WaitQueue"));
				if (wq !== null && !this.isInner(wq)) out.push([wq, ent]);
			}
			if (!def.output || def.id === "queue") continue;
			const next = this.find(this.engine.getInputString(ent, "NextComponent"));
			if (next === null) continue;
			if (this.isInner(next)) {
				const owner = this.find(next.getName().slice(0, -INNER.length));
				if (owner !== null) out.push([ent, owner]);
			}
			else out.push([ent, next]);
		}
		return out;
	}

	/** 写しを作る（設定も写す。つなぎは写さない） */
	duplicate(ent: Entity, dx = 1.5, dy = -1.5): Entity {
		const def = this.defOf(ent)!;
		const [x, y] = this.position(ent);
		const copy = this.place(def.id, x + dx, y + dy);
		for (const p of def.props) {
			if (p.kind === "time") this.setTime(copy, p.key, this.getTime(ent, p.key));
			else {
				const v = this.engine.getInputString(ent, p.key);
				if (v !== "") this.engine.setInput(copy, p.key, v);
			}
		}
		const rot = this.rotation(ent);
		if (rot !== 0) this.rotate(copy, rot);
		return copy;
	}

	/** つなぎを全部外す */
	disconnectAll(ent: Entity): void {
		for (const [a, b] of this.links())
			if (a === ent || b === ent) this.disconnect(a, b);
	}

	/** 消す（内側の待ち行列・分布も一緒に。ほかの部品からの参照も外す） */
	remove(ent: Entity): void {
		const name = ent.getName();
		for (const other of this.visibleObjects()) {
			if (other === ent) continue;
			this.disconnect(other, ent);
		}
		const extra: Entity[] = [];
		const q = this.innerQueue(ent);
		if (q !== null) extra.push(q);
		for (const e of this.engine.displayEntities())
			if (e.getName().startsWith(name + "_") && !e.isGenerated()) extra.push(e);
		for (const e of new Set(extra)) this.engine.remove(e);
		this.engine.remove(ent);
	}

	rename(ent: Entity, name: string): string | null {
		const old = ent.getName();
		if (name === old || name === "") return null;
		if (!/^[^\s{}"'#.]+$/.test(name)) return t("The name cannot contain spaces or the characters {0}.", "{ } \" ' # .");
		if (this.find(name) !== null) return t("The name is already used.");
		const q = this.innerQueue(ent);
		const helpers = this.engine.displayEntities().filter(e => e.getName().startsWith(old + "_") && !e.isGenerated());
		InputAgent.applyArgs(ent, "Name", name);
		if (q !== null) InputAgent.applyArgs(q, "Name", name + INNER);
		for (const h of helpers) InputAgent.applyArgs(h, "Name", name + h.getName().substring(old.length));
		this.engine.changed();
		return null;
	}

	// ---- 時間の設定（定数か確率分布） ----

	helperName(ent: Entity, key: string): string {
		return `${ent.getName()}_${key}`;
	}

	getTime(ent: Entity, key: string): TimeSpec {
		const v = this.engine.getInputString(ent, key).trim();
		const m = v.match(/^(-?[\d.eE+-]+)\s*(s|min|h)?$/);
		if (m) return { kind: "const", params: [Number(m[1])], unit: (m[2] as TimeUnitName) ?? "s" };
		const d = this.find(v);
		if (d !== null) {
			for (const [kind, spec] of Object.entries(DISTS)) {
				if (spec.cls !== clsName(d)) continue;
				let unit: TimeUnitName = "s";
				const params = spec.params.map(p => {
					const s = this.engine.getInputString(d, p.key).trim();
					const mm = s.match(/^(-?[\d.eE+-]+)\s*(s|min|h)?$/);
					if (mm && mm[2]) unit = mm[2] as TimeUnitName;
					return mm ? Number(mm[1]) : NaN;
				});
				return { kind: kind as DistKind, params, unit };
			}
		}
		return { kind: "const", params: [0], unit: "s" };
	}

	setTime(ent: Entity, key: string, spec: TimeSpec): void {
		const e = this.engine;
		const hname = this.helperName(ent, key);
		let helper = this.find(hname);
		const def = DISTS[spec.kind];
		if (def.cls === null) {
			e.setInput(ent, key, `${fmt(spec.params[0])} ${spec.unit}`);
			if (helper !== null) e.remove(helper);
			return;
		}
		if (helper !== null && clsName(helper) !== def.cls) {
			e.setInput(ent, key, "0 s");
			e.remove(helper);
			helper = null;
		}
		if (helper === null) {
			helper = e.define(def.cls, hname);
			e.setInput(helper, "UnitType", "TimeUnit");
			e.setInput(helper, "Position", "0 -1000 0 m");
		}
		def.params.forEach((p, i) => {
			const v = spec.params[i];
			if (Number.isFinite(v))
				e.setInput(helper!, p.key, p.time ? `${fmt(v)} ${spec.unit}` : fmt(v));
		});
		if (spec.kind !== "uniform" && spec.kind !== "tri")
			e.setInput(helper, "MinValue", `0 ${spec.unit}`);  // 時間は負にしない
		e.setInput(ent, key, hname);
	}
}

export function fmt(v: number): string {
	return String(Math.round(v * 1e6) / 1e6);
}

export { CATALOG };

/** JaamSim のクラスの名前（縮めて固めても変わらない、登録の名前） */
export function clsName(e: Entity): string {
	return ClassRegistry.simpleName(e);
}
