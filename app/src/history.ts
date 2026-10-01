/*
 * 元に戻す・やり直す。モデルの変わるたびに .cfg の文字列を控え、戻す時はそれを読み直す
 * （JaamSim の入力は、書き出して読み直すと同じモデルになるので、これがいちばん確か）。
 * 実行中（リセットしていない間）は控えない。
 */
import type { Engine } from "./engine.ts";

export class History {
	private undoStack: string[] = [];
	private redoStack: string[] = [];
	private current = "";
	private timer = 0;
	private restoring = false;

	constructor(readonly engine: Engine, readonly onRestore: () => void) {
		this.current = engine.saveText();
		engine.onChange(() => this.schedule());
		// ドラッグの途中は控えない（離した時に 1 回だけ）
		window.addEventListener("pointerdown", () => { this.pressed = true; }, true);
		window.addEventListener("pointerup", () => { this.pressed = false; this.schedule(); }, true);
	}

	private pressed = false;

	/** 新しいモデルを開いた時 */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.current = this.engine.saveText();
	}

	private batching = 0;

	/** まとめて 1 段にする（AI の 1 回の依頼の変更など）。end で 1 回だけ控える */
	begin(): void {
		clearTimeout(this.timer);
		this.batching++;
	}

	end(): void {
		if (this.batching > 0) this.batching--;
		if (this.batching === 0) this.record(true);
	}

	private schedule(): void {
		if (this.restoring || this.batching > 0 || this.engine.state !== "idle") return;
		clearTimeout(this.timer);
		// ドラッグで動かす間などの細かな変化は、まとめて 1 回にする
		this.timer = window.setTimeout(() => this.record(), 250);
	}

	private record(force = false): void {
		if (this.engine.state !== "idle" && !force) return;
		if (this.pressed && !force) { this.schedule(); return; }
		const text = this.engine.saveText();
		if (text === this.current) return;
		this.undoStack.push(this.current);
		if (this.undoStack.length > 100) this.undoStack.shift();
		this.redoStack = [];
		this.current = text;
	}

	canUndo(): boolean { return this.undoStack.length > 0; }
	canRedo(): boolean { return this.redoStack.length > 0; }

	undo(): void {
		clearTimeout(this.timer);
		this.record();
		const prev = this.undoStack.pop();
		if (prev === undefined) return;
		this.redoStack.push(this.current);
		this.restore(prev);
	}

	redo(): void {
		const next = this.redoStack.pop();
		if (next === undefined) return;
		this.undoStack.push(this.current);
		this.restore(next);
	}

	private restore(text: string): void {
		this.restoring = true;
		try {
			this.engine.newModel(text, this.engine.modelName);
			this.current = text;
		}
		finally {
			this.restoring = false;
		}
		this.onRestore();
	}
}
