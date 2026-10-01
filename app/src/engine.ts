/*
 * 画面と計算の部分（JaamSim の移植）をつなぐ。
 * - モデルを作る・部品を足す・入力を当てる・つなぐ
 * - 実行の操作（リセット・実行・1 歩・停止・速さ・止める時刻）。描く間ごとに少しずつ時間を進める
 */
import {
	JaamSimModel, InputAgent, KeywordIndex, Entity, DisplayEntity, Input, Log, FileSystem, InputErrorException,
} from "../../src/jaamsim/internal.ts";
import type { RunListener } from "../../src/jaamsim/basicsim/RunListener.ts";
import { installVfs, putUserFile } from "./vfs.ts";

export type RunState = "idle" | "running" | "paused" | "ended";

export class Engine {
	sm!: JaamSimModel;
	state: RunState = "idle";
	/** 実行の速さ（実時間 1 秒あたりのシミュレーションの秒） */
	speed = 10;
	/** 止める時刻（秒）。null なら止めない */
	stopTime: number | null = null;
	/** 実行の誤り（あれば） */
	error: string | null = null;
	private readonly listeners = new Set<() => void>();
	private logIndex = 0;
	readonly log: string[] = [];

	constructor() {
		installVfs();
		Log.addListener({ update: () => { for (const l of Log.getLog(this.logIndex)) { this.log.push(l); this.logIndex++; } } });
		this.newModel();
	}

	/** 変わったことを画面に知らせる */
	onChange(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	changed(): void {
		for (const fn of this.listeners) fn();
	}

	/** モデルの名前（開いたファイルの名前） */
	modelName = "";

	newModel(cfgText?: string, name = "model"): void {
		this.modelName = name;
		this.sm = new JaamSimModel(name);
		this.sm.autoLoad();
		// 読む前から記録を始める。ファイルから読んだ物も「足した物・変えた物」になり、保存（saveText）で全部書き出せる
		this.sm.setRecordEdits(true);
		if (cfgText !== undefined)
			this.readText(cfgText);
		// 画面の側で時間を進めるので、実時間の設定は使わない
		const sim = this.sm.getSimulation()!;
		InputAgent.applyArgs(sim, "RealTime", "FALSE");
		if (cfgText === undefined)
			InputAgent.applyArgs(sim, "RunDuration", "1000000", "h");
		this.state = "idle";
		this.error = null;
		this.changed();
	}

	/** 入力の文字列（.cfg の中身）を読む */
	readText(text: string, path = "/model/model.cfg"): void {
		putUserFile(path, text);
		const before = this.log.length;
		try {
			this.sm.configure(path);
		}
		catch (ex) {
			// 作りかけのモデル（つないでいない部品など）も開く。入力の誤りは知らせるだけ（JaamSim の画面と同じ）
			if (!(ex instanceof InputErrorException)) throw ex;
			this.warning = this.log.slice(before).filter(l => /error/i.test(l)).join("\n") || String(ex);
		}
	}

	/** 開いた時の入力の誤り（画面が知らせたら null に戻す） */
	warning: string | null = null;

	/** 部品を足す（名前が重なれば _1 などを付ける） */
	define(type: string, name: string): Entity {
		this.sm.defineEntity(type, name);
		// 足したものは、名前の一覧の一番後ろ
		let last: Entity | null = null;
		for (const e of this.sm.getClonesOfIterator(Entity)) last = e;
		// JaamSim の画面で置いた時と同じ既定（乱数の番号・床に載せる位置合わせなど）
		last!.setInputsForDragAndDrop();
		this.changed();
		return last!;
	}

	/** 入力を当てる。value は .cfg の { } の中と同じ書き方（例: "10 s"、"Queue1"） */
	setInput(ent: Entity, keyword: string, value: string): void {
		const kw = KeywordIndex.formatInput(keyword, value);
		InputAgent.apply(ent, kw);
		this.changed();
	}

	getInputString(ent: Entity, keyword: string): string {
		const inp = ent.getInput(keyword) as Input<unknown> | null;
		return inp === null ? "" : inp.getValueString();
	}

	remove(ent: Entity): void {
		ent.kill();
		this.changed();
	}

	displayEntities(): DisplayEntity[] {
		const out: DisplayEntity[] = [];
		for (const e of this.sm.getClonesOfIterator(DisplayEntity)) out.push(e);
		return out;
	}

	simTime(): number {
		return this.state === "idle" ? 0 : this.sm.getSimTime();
	}

	// ---- 実行の操作 ----

	reset(): void {
		if (this.state !== "idle")
			this.sm.reset();
		this.state = "idle";
		this.error = null;
		this.changed();
	}

	private ensureStarted(): boolean {
		if (this.state !== "idle")
			return true;
		// 入力の確かめ（Java の configure の後半と同じ）
		const errs: string[] = [];
		for (const e of this.sm.getClonesOfIterator(Entity)) {
			if (e.hasClone()) continue;
			try { e.validate(); }
			catch (ex) { errs.push(`${e.getName()}: ${ex instanceof Error ? ex.message : String(ex)}`); }
		}
		if (errs.length > 0) {
			this.error = errs.join("\n");
			this.changed();
			return false;
		}
		const listener = {
			runEnded: () => { this.state = "ended"; this.changed(); },
			handleRuntimeError: (_m: unknown, t: unknown) => {
				this.error = t instanceof Error ? t.message : String(t);
				this.state = "paused";
				this.changed();
			},
		} as unknown as RunListener;
		this.sm.start(listener, null, false);
		this.state = "paused";
		return true;
	}

	run(): void {
		if (!this.ensureStarted()) return;
		if (this.state === "ended") return;
		this.state = "running";
		this.changed();
	}

	stop(): void {
		if (this.state === "running") {
			this.state = "paused";
			this.changed();
		}
	}

	/** 次の事象を 1 つだけ実行する */
	step(): void {
		if (!this.ensureStarted()) return;
		const em = this.sm.getEventManager();
		em.resumeTicks(Number.MAX_SAFE_INTEGER, true);
		if (this.state === "running") this.state = "paused";
		this.changed();
	}

	/** 描く間ごとに呼ぶ。realDt は前の呼び出しからの実時間（秒） */
	advance(realDt: number): void {
		if (this.state !== "running") return;
		const em = this.sm.getEventManager();
		let target = this.sm.getSimTime() + Math.min(realDt, 0.25) * this.speed;
		if (this.stopTime !== null && target >= this.stopTime) {
			target = this.stopTime;
			this.state = "paused";
		}
		const ticks = em.secondsToNearestTick(target);
		if (ticks > em.getTicks())
			em.resumeTicks(ticks);
		if (this.state === "paused") this.changed();
	}

	/** 最初から流して、simSeconds（秒）の時点まで一気に進める（AI の道具が使う）。誤りがあれば文で返す */
	runFor(simSeconds: number): string | null {
		this.reset();
		if (!this.ensureStarted()) {
			const e = this.error;
			this.error = null;
			return e ?? "始められない";
		}
		const em = this.sm.getEventManager();
		em.resumeTicks(em.secondsToNearestTick(simSeconds));
		if (this.state === "running") this.state = "paused";
		this.changed();
		const e = this.error;
		this.error = null;
		return e;
	}

	/** モデルを .cfg の文字列にする */
	saveText(): string {
		// JaamSim の保存は「元のファイルをそのまま写し、後に変えた所を足す」。この画面では元のファイルは写さず、
		// 今のモデルを全部書き出す（読んだ物も記録の対象にしてあるので、全部が「足した物・変えた物」に入る）
		const path = "/model/save.cfg";
		const m = this.sm as unknown as { configFile: string | null };
		const cfg = m.configFile;
		m.configFile = null;
		this.sm.setRecordEditsFound(false);
		try {
			InputAgent.printNewConfigurationFileWithName(this.sm, path);
		}
		finally {
			m.configFile = cfg;
		}
		return FileSystem.backend.readText(path) ?? "";
	}
}
