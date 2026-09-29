/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2024 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
