/*
 * AI チャットの道具（画面の側で実行する）。AI とのやり取りは Electron の本体の側（electron/ai.cjs）。
 * 決まった操作だけを受け付ける（任意のコードは実行しない）。部品は名前で指す。
 */
import type { DisplayEntity, Entity } from "../../src/jaamsim/internal.ts";
import { getOutputDef } from "../../src/jaamsim/input/OutputRegistry.ts";
import { CATALOG } from "./catalog.ts";
import { DISTS, type DistKind, type ModelOps, type TimeUnitName } from "./model.ts";

export interface ToolResult {
	text: string;
	isError?: boolean;
}

type Input = Record<string, unknown>;

function out(ent: Entity, name: string, simTime: number): unknown {
	try { return getOutputDef(ent.constructor as never, name)?.get(ent, simTime); } catch { return undefined; }
}

function round(v: number): number {
	return Math.round(v * 1000) / 1000;
}

export class AiTools {
	constructor(readonly ops: ModelOps) {}

	private get engine() { return this.ops.engine; }

	private need(input: Input, key: string, kind: "string" | "number"): string | number {
		const v = input[key];
		if (typeof v !== kind || (kind === "string" && (v as string).trim() === "") || (kind === "number" && !Number.isFinite(v)))
			throw new Error(`${key} が正しくない: ${JSON.stringify(v)}`);
		return v as string | number;
	}

	private object(name: unknown): Entity {
		const ent = typeof name === "string" ? this.ops.find(name) : null;
		if (ent === null || !this.ops.visibleObjects().includes(ent as DisplayEntity))
			throw new Error(`部品「${String(name)}」が無い。get_model で名前を確かめる`);
		return ent;
	}

	/** 変える前は、流した結果を消して編集の状態に戻す */
	private editable(): void {
		if (this.engine.state !== "idle") this.engine.reset();
	}

	run(name: string, input: Input): ToolResult {
		try {
			switch (name) {
				case "get_model": return { text: JSON.stringify(this.describe()) };
				case "place_object": return this.place(input);
				case "move_object": return this.move(input);
				case "rename_object": {
					this.editable();
					const ent = this.object(input.name);
					const err = this.ops.rename(ent, String(this.need(input, "new_name", "string")));
					return err ? { text: err, isError: true } : { text: `名前を ${ent.getName()} にした` };
				}
				case "delete_object": {
					this.editable();
					const ent = this.object(input.name);
					const n = ent.getName();
					this.ops.remove(ent);
					return { text: `${n} を消した` };
				}
				case "connect": {
					this.editable();
					const a = this.object(input.from), b = this.object(input.to);
					const err = this.ops.connect(a, b);
					return err ? { text: err, isError: true } : { text: `${a.getName()} → ${b.getName()} をつないだ` };
				}
				case "disconnect": {
					this.editable();
					const a = this.object(input.from), b = this.object(input.to);
					this.ops.disconnect(a, b);
					return { text: `${a.getName()} → ${b.getName()} を外した` };
				}
				case "set_time": return this.setTime(input);
				case "set_property": {
					this.editable();
					const ent = this.object(input.object);
					const key = String(this.need(input, "property", "string"));
					if (ent.getInput(key) === null) return { text: `${ent.getName()} に ${key} という設定は無い`, isError: true };
					this.engine.setInput(ent, key, String(input.value ?? ""));
					return { text: `${ent.getName()} の ${key} を ${this.engine.getInputString(ent, key)} にした` };
				}
				case "run_simulation": {
					const hours = Number(this.need(input, "hours", "number"));
					if (hours <= 0 || hours > 100000) return { text: "hours は 0 より大きく 100000 以下", isError: true };
					const err = this.engine.runFor(hours * 3600);
					if (err) return { text: `流せなかった: ${err}`, isError: true };
					return { text: JSON.stringify(this.stats()) };
				}
				case "get_stats": return { text: JSON.stringify(this.stats()) };
				default: return { text: `知らない道具: ${name}`, isError: true };
			}
		}
		catch (ex) {
			return { text: ex instanceof Error ? ex.message : String(ex), isError: true };
		}
	}

	private place(input: Input): ToolResult {
		this.editable();
		const type = String(this.need(input, "type", "string"));
		const def = CATALOG.find(d => d.id === type && !d.hidden);
		if (!def) return { text: `部品の種類「${type}」は無い。使えるのは ${CATALOG.filter(d => !d.hidden).map(d => d.id).join(", ")}`, isError: true };
		const ent = this.ops.place(def.id, Number(this.need(input, "x", "number")), Number(this.need(input, "y", "number")));
		if (typeof input.name === "string" && input.name.trim() !== "") {
			const err = this.ops.rename(ent, input.name.trim());
			if (err) return { text: `${ent.getName()} を置いた（名前は付けられなかった: ${err}）` };
		}
		return { text: `${ent.getName()}（${def.id}）を置いた` };
	}

	private move(input: Input): ToolResult {
		this.editable();
		const ent = this.object(input.name);
		this.ops.move(ent, Number(this.need(input, "x", "number")), Number(this.need(input, "y", "number")));
		if (typeof input.rotation_deg === "number") this.ops.rotate(ent, input.rotation_deg);
		const [x, y] = this.ops.position(ent);
		return { text: `${ent.getName()} を (${round(x)}, ${round(y)})、向き ${this.ops.rotation(ent)}° にした` };
	}

	private setTime(input: Input): ToolResult {
		this.editable();
		const ent = this.object(input.object);
		const key = String(this.need(input, "property", "string"));
		const kind = String(input.kind) as DistKind;
		const unit = String(input.unit) as TimeUnitName;
		if (!(kind in DISTS)) return { text: `kind「${kind}」は無い`, isError: true };
		if (!["s", "min", "h"].includes(unit)) return { text: `unit「${unit}」は無い`, isError: true };
		if (ent.getInput(key) === null) return { text: `${ent.getName()} に ${key} という設定は無い`, isError: true };
		const params = Array.isArray(input.params) ? input.params.map(Number) : [];
		const want = DISTS[kind].params.length;
		if (params.length !== want || params.some(v => !Number.isFinite(v)))
			return { text: `${kind} の params は ${want} 個の数（${DISTS[kind].params.map(p => p.key || "値").join(", ")}）`, isError: true };
		this.ops.setTime(ent, key, { kind, params, unit });
		return { text: `${ent.getName()} の ${key} を ${kind} ${JSON.stringify(params)} ${unit} にした` };
	}

	/** モデルの説明（AI が読む） */
	describe(): unknown {
		const objs = this.ops.visibleObjects().map(e => {
			const def = this.ops.defOf(e)!;
			const [x, y] = this.ops.position(e);
			const settings: Record<string, unknown> = {};
			for (const p of def.props) {
				if (p.kind === "time") settings[p.key] = this.ops.getTime(e, p.key);
				else settings[p.key] = this.engine.getInputString(e, p.key);
			}
			return { name: e.getName(), type: def.id, x: round(x), y: round(y), rotation_deg: this.ops.rotation(e), settings };
		});
		return {
			objects: objs,
			links: this.ops.links().map(([a, b]) => [a.getName(), b.getName()]),
			state: this.engine.state,
			sim_time_hours: round(this.engine.simTime() / 3600),
			types: CATALOG.filter(d => !d.hidden).map(d => d.id),
		};
	}

	/** 部品ごとの統計（AI が読む） */
	stats(): unknown {
		const t = this.engine.simTime();
		const res: Record<string, unknown> = { sim_time_hours: round(t / 3600), state: this.engine.state };
		for (const e of this.ops.visibleObjects()) {
			const def = this.ops.defOf(e)!;
			const s: Record<string, unknown> = {};
			for (const st of def.stats) {
				const v = out(e, st.output, t);
				if (typeof v === "number") s[st.output] = round(v);
				else if (typeof v === "string") s[st.output] = v;
			}
			const times = out(e, "StateTimes", t);
			if (times instanceof Map && times.size > 0) {
				const total = [...times.values()].reduce((a: number, b: number) => a + b, 0);
				if (total > 0) s.state_fractions = Object.fromEntries([...times].map(([k, v]) => [k, round(v / total)]));
			}
			if (Object.keys(s).length > 0) res[e.getName()] = s;
		}
		return res;
	}
}
