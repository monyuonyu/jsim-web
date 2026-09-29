/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2023 JaamSim Software Inc.
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

// setPresentState() は、StateEntity の setPresentState(String) と 1 つにした（引数が無ければ open から状態を決める）。
// updateGraphics は、色と表示するかどうか（状態）の計算なので残した。

import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { ShapeModel } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { jRemove } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { StateEntity } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { isThresholdUser } from "../internal.ts";
import { type ThresholdUser } from "./ThresholdUser.ts";

export class Threshold extends StateEntity implements SubjectEntity {

	private readonly openColour: ColourProvInput;

	private readonly closedColour: ColourProvInput;

	private readonly showWhenOpen: BooleanProvInput;

	private readonly showWhenClosed: BooleanProvInput;

	private readonly userList: ThresholdUser[];
	private open: boolean;
	private openCount = 0;
	private closedCount = 0;

	private static readonly STATE_OPEN = "Open";
	private static readonly STATE_CLOSED = "Closed";

	private readonly subject: SubjectEntityDelegate;

	constructor() {
		super();

		// Java のフィールドの初期値（初期化ブロックの前に書かれている）
		this.subject = new SubjectEntityDelegate(this);

		// Java の初期化ブロック
		this.workingStateListInput.setHidden(true);

		this.openColour = new ColourProvInput("OpenColour", Entity.FORMAT, ColourInput.GREEN);
		this.setKeywordDoc(this.openColour, "The colour of the threshold graphic when the threshold is open.", []);
		this.addInput(this.openColour);
		this.addSynonym(this.openColour, "OpenColor");

		this.closedColour = new ColourProvInput("ClosedColour", Entity.FORMAT, ColourInput.RED);
		this.setKeywordDoc(this.closedColour, "The colour of the threshold graphic when the threshold is closed.", []);
		this.addInput(this.closedColour);
		this.addSynonym(this.closedColour, "ClosedColor");

		this.showWhenOpen = new BooleanProvInput("ShowWhenOpen", Entity.FORMAT, true);
		this.setKeywordDoc(this.showWhenOpen, "A Boolean value.  If TRUE, the threshold is displayed when it is open.", []);
		this.addInput(this.showWhenOpen);

		this.showWhenClosed = new BooleanProvInput("ShowWhenClosed", Entity.FORMAT, true);
		this.setKeywordDoc(this.showWhenClosed, "A Boolean value.  If TRUE, the threshold is displayed when it is closed.", []);
		this.addInput(this.showWhenClosed);

		// Java のコンストラクタの本体
		this.userList = [];
		this.open = true;
	}

	override earlyInit(): void {
		super.earlyInit();
		this.open = this.getInitialOpenValue();
		this.openCount = 0;
		this.closedCount = 0;

		this.userList.length = 0;
		// TODO(移植): ThresholdUser の判定は関数の有無（isThresholdUser）。StateUserEntity.ts に abstract thresholdChanged が無く、tsc は ThresholdUser と認めない
		for (const each of this.getJaamSimModel().getClonesOfIterator(Entity, isThresholdUser)) {
			const tu = each as unknown as ThresholdUser;
			if (tu.getThresholds().includes(this))
				this.registerThresholdUser(tu);
		}

		// Clear the list of observers
		this.subject.clear();
	}

	registerThresholdUser(tu: ThresholdUser): void {
		if (!this.isActive() || this.userList.includes(tu))
			return;
		this.userList.push(tu);
	}

	unregisterThresholdUser(tu: ThresholdUser): void {
		jRemove(this.userList, tu);
	}

	getInitialOpenValue(): boolean {
		return true;
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(_simTime?: number): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	override getInitialState(): string {
		if (this.getInitialOpenValue())
			return Threshold.STATE_OPEN;
		else
			return Threshold.STATE_CLOSED;
	}

	override isValidState(state: string): boolean {
		return Threshold.STATE_OPEN === state || Threshold.STATE_CLOSED === state;
	}

	override isValidWorkingState(state: string): boolean {
		return Threshold.STATE_OPEN === state;
	}

	isOpen(): boolean {
		return this.open;
	}

	setOpen(bool: boolean): void {
		// If setting to the same value as current, return
		if (this.open === bool)
			return;

		if (this.isTraceFlag()) this.trace(0, "setOpen(%s)", bool);

		this.open = bool;

		// Set the new state
		this.setPresentState();
		if (this.open) {
			this.openCount++;
		}
		else {
			this.closedCount++;
		}

		this.getJaamSimModel().updateThresholdUsers(this.userList);

		// Notify any observers
		this.notifyObservers();
	}

	/** 引数があれば StateEntity の setPresentState(String)。無ければ Java の setPresentState() */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}
		if (this.open) {
			this.setPresentState(Threshold.STATE_OPEN);
		}
		else {
			this.setPresentState(Threshold.STATE_CLOSED);
		}
	}

	override clearStatistics(): void {
		this.openCount = 0;
		this.closedCount = 0;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Determine the colour for the square
		let col: Color4d;
		if (this.open)
			col = this.openColour.getNextColour(this, simTime);
		else
			col = this.closedColour.getNextColour(this, simTime);

		// Show or hide the threshold
		if (!this.showWhenOpen.isDefault() || !this.showWhenClosed.isDefault()) {
			if (this.open)
				this.setShow(this.getShowInput() && this.showWhenOpen.getNextBoolean(this, simTime));
			else
				this.setShow(this.getShowInput() && this.showWhenClosed.getNextBoolean(this, simTime));
		}

		this.setTagColour( ShapeModel.TAG_CONTENTS, col );
		this.setTagColour( ShapeModel.TAG_OUTLINES, ColourInput.BLACK );
	}

	getUserList(_simTime: number): ThresholdUser[] {
		return this.userList;
	}

	getOpen(_simTime: number): boolean {
		return this.open;
	}

	getOpenFraction(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const openTicks = this.getTicksInState(simTicks, this.getState(Threshold.STATE_OPEN));
		const closedTicks = this.getTicksInState(simTicks, this.getState(Threshold.STATE_CLOSED));
		const totTicks = openTicks + closedTicks;

		return openTicks / totTicks;
	}

	getClosedFraction(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const openTicks = this.getTicksInState(simTicks, this.getState(Threshold.STATE_OPEN));
		const closedTicks = this.getTicksInState(simTicks, this.getState(Threshold.STATE_CLOSED));
		const totTicks = openTicks + closedTicks;

		return closedTicks / totTicks;
	}

	getOpenCount(_simTime: number): number {
		return this.openCount;
	}

	getClosedCount(_simTime: number): number {
		return this.closedCount;
	}

}

defineOutput(Threshold, {
	name: "UserList",
	description: "The objects that are stopped by this Threshold.",
	sequence: 0,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUserList(simTime),
});

defineOutput(Threshold, {
	name: "Open",
	description: "If open, then return TRUE.  Otherwise, return FALSE.",
	unitType: DimensionlessUnit, sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.getOpen(simTime),
});

defineOutput(Threshold, {
	name: "OpenFraction",
	description: "The fraction of total simulation time that the threshold is open.",
	unitType: DimensionlessUnit, reportable: true, sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getOpenFraction(simTime),
});

defineOutput(Threshold, {
	name: "ClosedFraction",
	description: "The fraction of total simulation time that the threshold is closed.",
	unitType: DimensionlessUnit, sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getClosedFraction(simTime),
});

defineOutput(Threshold, {
	name: "OpenCount",
	description: "The number of times the threshold's state has changed from closed to open.",
	unitType: DimensionlessUnit, sequence: 4,
	returnType: "long",
	get: (e, simTime) => e.getOpenCount(simTime),
});

defineOutput(Threshold, {
	name: "ClosedCount",
	description: "The number of times the threshold's state has changed from open to closed.",
	unitType: DimensionlessUnit, sequence: 5,
	returnType: "long",
	get: (e, simTime) => e.getClosedCount(simTime),
});

ClassRegistry.register("com.jaamsim.Thresholds.Threshold", Threshold);
