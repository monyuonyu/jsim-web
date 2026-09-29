/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// 名前の無いクラス（openChangedConditional・doOpenCloseTarget・setOpenTarget）は、このファイルの
// ExpressionThreshold_OpenChangedConditional・ExpressionThreshold_DoOpenCloseTarget・ExpressionThreshold_SetOpenTarget にした。
// 多重定義 getOpenConditionValue(double)・getOpenConditionValue(double, boolean) は、2 番目の引数の有無で見分ける 1 つの関数にした。
// Java の ExpressionThreshold.super.isOpen()（名前の無いクラスの中から親の isOpen を呼ぶ所）は superIsOpen() にした。

import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityTarget } from "../basicsim/EntityTarget.ts";
import { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import { isSubjectEntity, type SubjectEntity } from "../basicsim/SubjectEntity.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventHandle } from "../events/EventHandle.ts";
import { EventManager } from "../events/EventManager.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpressionInput } from "../input/ExpressionInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { RateUnit } from "../units/RateUnit.ts";
import { Threshold } from "./Threshold.ts";

/** InterfaceEntityListInput に渡す、interface SubjectEntity の Class の代わり（ProcessFlow/LinkedService.ts と同じ作り） */
const SubjectEntityClass = {
	javaName: "com.jaamsim.basicsim.SubjectEntity",
	isInstance(o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
	[Symbol.hasInstance](o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
};

export class ExpressionThreshold extends Threshold implements ObserverEntity {

	private readonly openCondition: ExpressionInput;

	private readonly closeCondition: ExpressionInput;

	private readonly initialOpenValue: BooleanProvInput;

	private readonly pendingOpenColour: ColourProvInput;

	private readonly pendingClosedColour: ColourProvInput;

	private readonly showPendingStates: BooleanProvInput;

	protected readonly watchList: InterfaceEntityListInput<SubjectEntity>;

	private readonly verifyWatchList: BooleanProvInput;

	private lastOpenValue = false; // state of the threshold that was calculated on-demand
	private useLastValue = false;
	private numCalls = 0;
	private numEvals = 0;

	private readonly openChangedConditional: Conditional;
	private readonly doOpenCloseTarget: ProcessTarget;
	private readonly setOpenHandle: EventHandle;
	private readonly setOpenTarget: ProcessTarget;
	private readonly observerUpdateHandle: EventHandle;

	constructor() {
		super();

		this.attributeDefinitionList.setHidden(false);

		this.openCondition = new ExpressionInput("OpenCondition", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.openCondition, "The logical condition for the ExpressionThreshold to open.",
				[ "'[Queue1].QueueLength > 3'" ]);
		this.openCondition.setUnitType(DimensionlessUnit);
		this.openCondition.setResultType(ExpResType.NUMBER);
		this.openCondition.setRequired(true);
		this.openCondition.setCallback(ExpressionThreshold.inputCallback);
		this.addInput(this.openCondition);

		this.closeCondition = new ExpressionInput("CloseCondition", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.closeCondition, "The logical condition for the ExpressionThreshold to close.\n"
				+ "If not specified, the CloseCondition defaults to the opposite of the "
				+ "OpenCondition. If the OpenCondition and CloseCondition are both TRUE, "
				+ "then the ExpressionThreshold is set to open.",
				[ "'[Queue1].QueueLength < 2'" ]);
		this.closeCondition.setUnitType(DimensionlessUnit);
		this.closeCondition.setResultType(ExpResType.NUMBER);
		this.closeCondition.setCallback(ExpressionThreshold.inputCallback);
		this.addInput(this.closeCondition);

		this.initialOpenValue = new BooleanProvInput("InitialOpenValue", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.initialOpenValue, "The initial state for the ExpressionThreshold: "
				+ "TRUE = Open, FALSE = Closed.\n"
				+ "This input is only relevant when the CloseCondition input is used "
				+ "and both the OpenCondition and CloseCondition are FALSE at the "
				+ "start of the simulation run. Otherwise, the initial state is "
				+ "determined explicitly by the OpenCondition and CloseCondition.", []);
		this.initialOpenValue.setCallback(ExpressionThreshold.inputCallback);
		this.addInput(this.initialOpenValue);

		this.pendingOpenColour = new ColourProvInput("PendingOpenColour", Entity.FORMAT, ColourInput.YELLOW);
		this.setKeywordDoc(this.pendingOpenColour, "The colour of the ExpressionThreshold graphic when the threshold "
				+ "condition is open, but the gate is still closed.", []);
		this.addInput(this.pendingOpenColour);
		this.addSynonym(this.pendingOpenColour, "PendingOpenColor");

		this.pendingClosedColour = new ColourProvInput("PendingClosedColour", Entity.FORMAT, ColourInput.PURPLE);
		this.setKeywordDoc(this.pendingClosedColour, "The colour of the ExpressionThreshold graphic when the threshold "
				+ "condition is closed, but the gate is still open.", []);
		this.addInput(this.pendingClosedColour);
		this.addSynonym(this.pendingClosedColour, "PendingClosedColor");

		this.showPendingStates = new BooleanProvInput("ShowPendingStates", Entity.FORMAT, true);
		this.setKeywordDoc(this.showPendingStates, "A Boolean value. If TRUE, the ExpressionThreshold displays the "
				+ "pending open and pending closed states.", []);
		this.addInput(this.showPendingStates);

		this.watchList = new InterfaceEntityListInput<SubjectEntity>(SubjectEntityClass, "WatchList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.watchList, "An optional list of objects to monitor.\n\n"
				+ "If the WatchList input is provided, the ExpressionThreshold evaluates "
				+ "its OpenCondition and CloseCondition expression inputs and set its "
				+ "open/closed state ONLY when triggered by an object in its WatchList. "
				+ "This is much more efficient than the default behaviour which "
				+ "evaluates these expressions at every event time and whenever its "
				+ "state is queried by another object.\n\n"
				+ "Care must be taken to ensure that the WatchList input includes every "
				+ "object that can trigger the OpenCondition or CloseCondition expressions. "
				+ "Normally, the WatchList should include every object that is referenced "
				+ "directly or indirectly by these expressions. "
				+ "The VerfiyWatchList input can be used to ensure that the WatchList "
				+ "includes all the necessary objects.",
				["Object1  Object2"]);
		this.watchList.setIncludeSelf(false);
		this.watchList.setUnique(true);
		this.addInput(this.watchList);

		this.verifyWatchList = new BooleanProvInput("VerifyWatchList", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.verifyWatchList, "Allows the user to verify that the input to the 'WatchList' keyword "
				+ "includes all the objects that affect the ExpressionThreshold's state. "
				+ "When set to TRUE, the ExpressionThreshold uses both the normal logic "
				+ "and the WatchList logic to set its state. "
				+ "An error message is generated if the threshold changes state without "
				+ "being triggered by a WatchList object.", []);
		this.addInput(this.verifyWatchList);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.openChangedConditional = new ExpressionThreshold_OpenChangedConditional(this);
		this.doOpenCloseTarget = new ExpressionThreshold_DoOpenCloseTarget(this);
		this.setOpenHandle = new EventHandle();
		this.setOpenTarget = new ExpressionThreshold_SetOpenTarget(this);
		this.observerUpdateHandle = new EventHandle();
	}

	override validate(): void {
		super.validate();
		ObserverEntity.validate(this);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastOpenValue = this.getInitialOpenValue();
		this.useLastValue = false;
		this.numCalls = 0;
		this.numEvals = 0;
	}

	override lateInit(): void {
		super.lateInit();
		ObserverEntity.registerWithSubjects(this, this.getWatchList());
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, _inp: Input<unknown>): void {
			try {
				(ent as ExpressionThreshold).updateInputValue();
			}
			catch (_e) {
				// Java の catch (Exception e) {}
				// TODO(移植): TS ではすべての例外を捕まえる（Java は Error 系を捕まえない）
			}
		},
	};

	updateInputValue(): void {
		this.lastOpenValue = this.getInitialOpenValue();
	}

	override startUp(): void {
		super.startUp();

		// If there is no WatchList, the open/close expressions are tested after every event
		if (!this.isWatchList() || this.isVerifyWatchList())
			this.doOpenClose();
	}

	override getInitialOpenValue(): boolean {
		const bool = this.initialOpenValue.getNextBoolean(this, 0.0);
		return this.getOpenConditionValue(0.0, bool);
	}

	getWatchList(): SubjectEntity[] {
		return this.watchList.getValue()!;
	}

	isVerifyWatchList(): boolean {
		return this.verifyWatchList.getNextBoolean(this, 0.0);
	}

	isWatchList(): boolean {
		return this.getWatchList().length !== 0;
	}

	/**
	 * Loops from one state change to the next.
	 */
	doOpenClose(): void {
		// Set the present state
		this.setOpen(this.getOpenConditionValue(EventManager.simSeconds()));

		// Wait until the state is ready to change
		EventManager.scheduleUntil(this.doOpenCloseTarget, this.openChangedConditional, null);
	}

	/** Java の ExpressionThreshold.super.isOpen() */
	superIsOpen(): boolean {
		return super.isOpen();
	}

	/**
	 * Returns the state implied by the present values for the OpenCondition
	 * and CloseCondition expressions.
	 * @param simTime - present simulation time.
	 * @param val - present value for the threshold（省くと lastOpenValue）
	 * @return state implied by the OpenCondition and CloseCondition expressions.
	 */
	getOpenConditionValue(simTime: number, val?: boolean): boolean {
		if (val === undefined)
			return this.getOpenConditionValue(simTime, this.lastOpenValue);

		if (this.openCondition.isDefault())
			return super.isOpen();

		// Evaluate the open condition (0 = false, non-zero = true)
		const openCond = this.openCondition.getNextResult(this, simTime).value !== 0;

		// If the open condition is satisfied or there is no close condition, then we are done
		let ret: boolean;
		if (openCond || this.closeCondition.isDefault()) {
			ret = openCond;
		}

		// The open condition is false
		else {

			// If the close condition is satisfied, then the threshold is closed
			const closeCond = this.closeCondition.getNextResult(this, simTime).value !== 0;
			if (closeCond) {
				ret = false;
			}

			// If the open and close conditions are both false, then the state is unchanged
			else {
				ret = val;
			}
		}

		// Save the threshold's last state (unless called by the UI thread)
		if (EventManager.hasCurrent()) {
			this.lastOpenValue = ret;
			this.numCalls++;
			this.numEvals++;
		}
		return ret;
	}

	override isOpen(): boolean {

		// If called from the user interface or if a Controller has been specified,
		// then return the saved state
		if (!EventManager.hasCurrent())
			return super.isOpen();

		if (this.useLastValue && this.isWatchList()) {
			this.numCalls++;
			return super.isOpen();
		}

		// Determine the state implied by the OpenCondition and CloseCondition expressions
		const ret = this.getOpenConditionValue(EventManager.simSeconds());

		// If necessary, schedule an event to change the saved state
		if (ret !== super.isOpen() && EventManager.canSchedule())
			this.performSetOpen();

		// Return the value calculated on demand
		return ret;
	}

	private performSetOpen(): void {
		// The event is scheduled LIFO so it is performed as soon as possible, before the condition
		// can change again.
		if (!this.setOpenHandle.isScheduled()) {
			if (this.isTraceFlag()) this.trace(0, "performSetOpen()");
			EventManager.scheduleTicks(0, Entity.PRI_HIGH, Entity.EVT_LIFO, this.setOpenTarget, this.setOpenHandle);
		}
	}

	/** setOpenTarget の中身（Java の名前の無いクラスの process） */
	processSetOpen(): void {
		const bool = this.getOpenConditionValue(EventManager.simSeconds());
		if (this.isTraceFlag()) this.trace(0, "setOpen(%s)", bool);
		this.setOpen(bool);
		this.useLastValue = true;
	}

	observerUpdate(_subj: SubjectEntity): void {
		this.useLastValue = false;
		if (this.observerUpdateHandle.isScheduled())
			return;
		// Priority set to 99 to ensure that this event executed just before the conditional events
		EventManager.scheduleTicks(0, Entity.PRI_LOWEST, Entity.EVT_LIFO, this.setOpenTarget, this.observerUpdateHandle);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Trap the pending cases
		if (!this.showPendingStates.getNextBoolean(this, simTime))
			return;

		const threshOpen = super.isOpen();
		try {
			if (this.getOpenConditionValue(simTime) === threshOpen)
				return;
		}
		catch (_t) {
			return;
		}


		// Select the colour
		let col: Color4d;
		if (threshOpen)
			col = this.pendingClosedColour.getNextColour(this, simTime);
		else
			col = this.pendingOpenColour.getNextColour(this, simTime);

		// Display the threshold icon
		this.setTagVisibility(ShapeModel.TAG_CONTENTS, true);
		this.setTagVisibility(ShapeModel.TAG_OUTLINES, true);
		this.setTagColour(ShapeModel.TAG_CONTENTS, col);
		this.setTagColour(ShapeModel.TAG_OUTLINES, ColourInput.BLACK);
	}

	override getOpen(simTime: number): boolean {
		return this.getOpenConditionValue(simTime);
	}

	getFracEval(_simTime: number): number {
		return this.numEvals / this.numCalls;
	}

	getEvalRate(simTime: number): number {
		return this.numEvals / simTime;
	}

}

/** Java の名前の無い Conditional（openChangedConditional） */
class ExpressionThreshold_OpenChangedConditional implements Conditional {
	private readonly ent: ExpressionThreshold;

	constructor(ent: ExpressionThreshold) {
		this.ent = ent;
	}

	evaluate(): boolean {
		return this.ent.getOpenConditionValue(EventManager.simSeconds()) !== this.ent.superIsOpen();
	}
}

/** Java の名前の無い EntityTarget（doOpenCloseTarget） */
class ExpressionThreshold_DoOpenCloseTarget extends EntityTarget<ExpressionThreshold> {
	constructor(ent: ExpressionThreshold) {
		super(ent, "doOpenClose");
	}

	override process(): void {
		if (this.ent.isVerifyWatchList())
			this.ent.error(ObserverEntity.ERR_WATCHLIST);
		this.ent.doOpenClose();
	}
}

/** Java の名前の無い EntityTarget（setOpenTarget） */
class ExpressionThreshold_SetOpenTarget extends EntityTarget<ExpressionThreshold> {
	constructor(ent: ExpressionThreshold) {
		super(ent, "setOpen");
	}

	override process(): void {
		this.ent.processSetOpen();
	}
}

defineOutput(ExpressionThreshold, {
	name: "Open",
	description: "If open, then return TRUE.  Otherwise, return FALSE.",
	unitType: DimensionlessUnit, sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.getOpen(simTime),
});

defineOutput(ExpressionThreshold, {
	name: "FracEval",
	description: "Fraction of times that the threshold expression was evaluated out of the "
	           + "total number of times the threshold state was obtained.",
	unitType: DimensionlessUnit, sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getFracEval(simTime),
});

defineOutput(ExpressionThreshold, {
	name: "EvalRate",
	description: "Number of times that the threshold expression is evaluated per unit "
	           + "simulation time.",
	unitType: RateUnit, sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getEvalRate(simTime),
});

ClassRegistry.register("com.jaamsim.Thresholds.ExpressionThreshold", ExpressionThreshold);
