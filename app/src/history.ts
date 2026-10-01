/*
 * 元に戻す・やり直す。モデルの変わるたびに .cfg の文字列を控え、戻す時はそれを読み直す
 * （JaamSim の入力は、書き出して読み直すと同じモデルになるので、これがいちばん確か）。
 * 流しても入力は変わらないので、実行の途中（一時停止中・終わった後）の編集も控える。
 * 保存した時の文字列も覚えておき、今と違えば「変更あり」とする（元に戻して保存した時に戻れば変更なし）。
 */
import type { Engine } from "./engine.ts";

export class History {
	private undoStack: string[] = [];
	private redoStack: string[] = [];
	private current = "";
	private timer = 0;
	private restoring = false;
	private pending = false;      // 控えるのを待っている変化がある
	private saved: string | null = "";

	constructor(readonly engine: Engine, readonly onRestore: () => void) {
		this.current = engine.saveText();
		this.saved = this.current;
		engine.onChange(() => this.schedule());
		// ドラッグの途中は控えない（離した時に 1 回だけ）
		window.addEventListener("pointerdown", () => { this.pressed = true; }, true);
		// ライブラリからのドラッグ（HTML のドラッグ＆ドロップ）では pointerup が来ず pointercancel になる
		for (const ev of ["pointerup", "pointercancel", "dragend", "drop"])
			window.addEventListener(ev, () => { this.pressed = false; this.schedule(); }, true);
	}

	private pressed = false;

	/** 控えを調べた後（変更あり・なしが変わったかもしれない時）に呼ぶ */
	onEdit: () => void = () => {};

	/** 新しいモデルを開いた時 */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.current = this.engine.saveText();
		this.saved = this.current;
		this.pending = false;
		clearTimeout(this.timer);
	}

	/** 待っている控えを今すぐ取る */
	flush(): void {
		if (!this.pending || this.restoring) return;
		clearTimeout(this.timer);
		this.record(true);
	}

	/** 保存した（今の状態が保存した物） */
	markSaved(): void {
		this.flush();
		this.saved = this.current;
		this.onEdit();
	}

	/** 保存していない状態にする（言語を変えて読み直した時など） */
	markUnsaved(): void {
		this.saved = null;
		this.onEdit();
	}

	/** 保存した時から変わっているか。check なら待っている控えを先に取る（閉じる前など） */
	isDirty(check = false): boolean {
		if (check) this.flush();
		return this.pending || this.current !== this.saved;
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
		if (this.restoring) return;
		this.pending = true;
		if (this.batching > 0) return;
		clearTimeout(this.timer);
		// ドラッグで動かす間などの細かな変化は、まとめて 1 回にする
		this.timer = window.setTimeout(() => this.record(), 250);
	}

	private record(force = false): void {
		if (this.pressed && !force) { this.schedule(); return; }
		this.pending = false;
		const text = this.engine.saveText();
		if (text !== this.current) {
			this.undoStack.push(this.current);
			if (this.undoStack.length > 100) this.undoStack.shift();
			this.redoStack = [];
			this.current = text;
		}
		this.onEdit();
	}

	canUndo(): boolean { return this.undoStack.length > 0; }
	canRedo(): boolean { return this.redoStack.length > 0; }

	undo(): void {
		clearTimeout(this.timer);
		if (this.pending) this.record(true);
		const prev = this.undoStack.pop();
		if (prev === undefined) return;
		this.redoStack.push(this.current);
		this.restore(prev);
	}

	redo(): void {
		if (this.pending) this.record(true);   // 戻した後に変えていれば、やり直しの控えは消える
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
			this.pending = false;
			clearTimeout(this.timer);
		}
		finally {
			this.restoring = false;
		}
		this.onRestore();
		this.onEdit();
	}
}
