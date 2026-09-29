/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2023 JaamSim Software Inc.
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

// 入れ子のクラス DoActionTarget は、このファイルの GameEntity_DoActionTarget にした。
// handleKeyPressed・handleKeyReleased・handleMouseClicked は画面の操作を受ける所だが、状態（予約）を変えるので残した。

import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventHandle } from "../internal.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { DisplayEntity } from "../internal.ts";
import { KeyEventInput } from "../internal.ts";
import type { Vec3d } from "../math/Vec3d.ts";

export abstract class GameEntity extends DisplayEntity {

	private readonly actionKey: KeyEventInput;

	private readonly doActionTarget: ProcessTarget;
	private readonly doActionHandle: EventHandle;

	constructor() {
		super();

		this.actionKey = new KeyEventInput("ActionKey", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.actionKey, "An optional keyboard key that will cause the entity to perform its action.",
				["A", "F1", "ESCAPE"]);
		this.actionKey.setDefaultValue("SPACE");
		this.addInput(this.actionKey);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.doActionTarget = new GameEntity_DoActionTarget(this);
		this.doActionHandle = new EventHandle();
	}

	override handleKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): boolean {

		// Detect the specified key event
		if (this.actionKey.getValue() != null && keyCode === this.actionKey.getValue()) {
			this.scheduleAction();
			return true;
		}

		// Otherwise perform the normal action for the key
		const ret = super.handleKeyPressed(keyCode, keyChar, shift, control, alt);
		return ret;
	}

	override handleKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): void {

		// Detect the selected key event
		if (this.actionKey.getValue() != null && keyCode === this.actionKey.getValue()) {
			return;
		}

		// Otherwise perform the normal action for the key
		super.handleKeyReleased(keyCode, keyChar, shift, control, alt);
	}

	override handleMouseClicked(count: number, globalCoord: Vec3d,
			shift: boolean, control: boolean, alt: boolean): void {
		super.handleMouseClicked(count, globalCoord, shift, control, alt);

		// Single click performs the action
		if (count === 1) {
			this.scheduleAction();
			return;
		}
	}

	private scheduleAction(): void {
		this.setState();
		if (this.doActionHandle.isScheduled() || !this.getJaamSimModel().isRealTime())
			return;
		this.getJaamSimModel().getEventManager().scheduleProcessExternal(0, Entity.PRI_HIGHEST, Entity.EVT_LIFO, this.doActionTarget, this.doActionHandle);
	}

	/**
	 * Performs any actions to occur immediately after the object is clicked, prior to any events.
	 */
	setState(): void {}

	/**
	 * Performs any actions to occur after the event that is scheduled when the object is clicked.
	 */
	abstract doAction(): void;

}

/**
 * DoActionTarget
 */
class GameEntity_DoActionTarget extends EntityTarget<GameEntity> {
	constructor(ent: GameEntity) {
		super(ent, "doAction");
	}

	override process(): void {
		this.ent.doAction();
	}
}
