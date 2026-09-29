import type { View } from "../Graphics/View.ts";
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import type { Entity } from "./Entity.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

/**
 * 画面への通知の受け手。
 * 後半の「?」の付いた関数は Java 版に無いもの。Java 版で GUIFrame の static 関数を直接呼んでいた所
 * （RunManager・EventTracer など）を、この受け手に置き換えるために足した。無ければ何もしない。
 */
export interface GUIListener {
	invokeErrorDialogBox(title: string, msg: string): void;
	updateObjectSelector(ent: Entity): void;
	updateModelBuilder(): void;
	updateInputEditor(ent: Entity): void;
	updateAll(): void;
	deleteEntity(ent: Entity): void;
	renameEntity(ent: Entity, newName: string): void;
	addView(v: View): void;
	removeView(v: View): void;
	createWindow(v: View): void;
	closeWindow(v: View): void;
	allowResizing(bool: boolean): void;
	gui_tickUpdate(tick: number): void;
	gui_timeRunning(): void;
	gui_handleError(sm: JaamSimModel, t: unknown): void;

	/** GUIFrame.invokeErrorDialog(title, pre, message, post) の代わり */
	invokeErrorDialog?(title: string, pre: string, message: string, post: string): void;
	/** GUIFrame.updateUI() の代わり */
	updateUI?(): void;
	/** GUIFrame.shutdown(errorCode) の代わり */
	shutdown?(errorCode: number): void;
	/** EventViewer.getInstance() の代わり（事象の一覧の画面が開いていれば、その受け手） */
	getEventViewer?(): EventTraceListener | null;
	/** GUIFrame.getRunManager().pause() の代わり */
	pauseRunManager?(): void;
}
