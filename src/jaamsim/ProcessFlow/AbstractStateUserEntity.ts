/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020-2023 JaamSim Software Inc.
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

// 入れ子のクラス VerifyStateConditional・VerifyStateTarget は、このファイルの中の
// AbstractStateUserEntity_VerifyStateConditional・AbstractStateUserEntity_VerifyStateTarget にした（外側の物を受け取る）。
// 出力の isIdle(double) などは、引数なしの isIdle() などと同じ中身なので 1 つにした（引数は無視する）。
// setPresentState() は、StateEntity の setPresentState(String) と 1 つにした（引数が無ければ状態を計算する）。

import { tr } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { StateEntity } from "../internal.ts";

export abstract class AbstractStateUserEntity extends StateEntity {

	private readonly verifyState: BooleanProvInput;

	static readonly STATE_MAINTENANCE = "Maintenance";
	static readonly STATE_BREAKDOWN = "Breakdown";
	static readonly STATE_STOPPED = "Stopped";
	static readonly STATE_BLOCKED = "Blocked";
	static readonly STATE_SETUP = "Setup";
	static readonly STATE_SETDOWN = "Setdown";

	protected static readonly COL_MAINTENANCE: Color4d = ColourInput.RED;
	protected static readonly COL_BREAKDOWN: Color4d = ColourInput.RED;
	protected static readonly COL_STOPPED: Color4d = ColourInput.getColorWithName("gray25")!;
	protected static readonly COL_BLOCKED: Color4d = ColourInput.getColorWithName("gray25")!;
	protected static readonly COL_SETUP: Color4d = ColourInput.getColorWithName("gray25")!;
	protected static readonly COL_SETDOWN: Color4d = ColourInput.getColorWithName("gray25")!;

	// Perform state verification at each event time
	private readonly verifyStateConditional: Conditional;

	// Unused target for VerifyStateConditional
	private readonly verifyStateTarget: ProcessTarget;

	constructor() {
		super();
		this.verifyState = new BooleanProvInput("VerifyState", Entity.OPTIONS, false);
		this.setKeywordDoc(this.verifyState, "If TRUE, the object's state will be recalculated at each event time "
		                     + "to verify that it has been set correctly by the program. "
		                     + "An error message will be generated if the state is not correct.", []);
		this.verifyState.setHidden(true);
		this.addInput(this.verifyState);

		this.verifyStateConditional = new AbstractStateUserEntity_VerifyStateConditional(this);
		this.verifyStateTarget = new AbstractStateUserEntity_VerifyStateTarget(this);
	}

	override startUp(): void {
		super.startUp();

		// Track any state changes
		if (this.verifyState.getNextBoolean(this, 0.0))
			this.doStateVerification();
	}

	override isValidState(state: string): boolean {
		return true;
	}

	/**
	 * Returns whether the entity is working.
	 * @return true if working
	 */
	abstract isBusy(): boolean;

	/**
	 * Returns whether set up is being performed.
	 * @return true if undergoing set up
	 */
	abstract isSetup(): boolean;

	/**
	 * Returns whether set down is being performed.
	 * @return true if undergoing set down
	 */
	abstract isSetdown(): boolean;

	/**
	 * Returns whether scheduled maintenance is being performed.
	 * @return true if undergoing maintenance
	 */
	abstract isMaintenance(): boolean;

	/**
	 * Returns whether a breakdown is being repaired.
	 * @return true if being repaired
	 */
	abstract isBreakdown(): boolean;

	/**
	 * Returns whether an operational limit prevents work.
	 * @return true if an operational limit is exceeded
	 */
	abstract isStopped(): boolean;

	/**
	 * Returns whether the entity is able to work.
	 * @return true if available for work
	 */
	isAvailable(): boolean {
		return !this.isStopped() && !this.isMaintenance() && !this.isBreakdown() && this.isActive();
	}

	/**
	 * Returns whether the entity is not working because it has no tasks to perform.
	 * @return true if idle
	 */
	isIdle(): boolean {
		return !this.isBusy() && this.isAvailable() && !this.isSetup() && !this.isSetdown();
	}

	/**
	 * Returns whether something is not working because something is preventing it from working.
	 * @return true if unable to work
	 */
	isUnableToWork(): boolean {
		return !this.isBusy() && !this.isAvailable() && !this.isSetup() && !this.isSetdown();
	}

	/**
	 * 引数があれば StateEntity の setPresentState(String)。無ければ Java の setPresentState()（状態を計算して設定する）。
	 * 子クラスで上書きするときも、引数があれば super.setPresentState(state) に渡すこと。
	 */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}

		// Inactive
		if (!this.isActive()) {
			this.setPresentState(StateEntity.STATE_INACTIVE);
			return;
		}

		// Working (Busy)
		if (this.isBusy()) {
			this.setPresentState(StateEntity.STATE_WORKING);
			return;
		}

		// Setup
		if (this.isSetup()) {
			this.setPresentState(AbstractStateUserEntity.STATE_SETUP);
			return;
		}

		// Setdown
		if (this.isSetdown()) {
			this.setPresentState(AbstractStateUserEntity.STATE_SETDOWN);
			return;
		}

		// Not working because of maintenance or a closure (UnableToWork)
		if (this.isMaintenance()) {
			this.setPresentState(AbstractStateUserEntity.STATE_MAINTENANCE);
			return;
		}
		if (this.isBreakdown()) {
			this.setPresentState(AbstractStateUserEntity.STATE_BREAKDOWN);
			return;
		}
		if (this.isStopped()) {
			this.setPresentState(AbstractStateUserEntity.STATE_STOPPED);
			return;
		}

		// Not working because there is nothing to do (Idle)
		this.setPresentState(StateEntity.STATE_IDLE);
		return;
	}

	protected getColourForPresentState(): Color4d {

		// Inactive
		if (!this.isActive()) {
			return StateEntity.COL_INACTIVE;
		}

		// Working (Busy)
		if (this.isBusy()) {
			return StateEntity.COL_WORKING;
		}

		// Not working because of maintenance or a closure (UnableToWork)
		if (this.isMaintenance()) {
			return AbstractStateUserEntity.COL_MAINTENANCE;
		}
		if (this.isBreakdown()) {
			return AbstractStateUserEntity.COL_BREAKDOWN;
		}
		if (this.isStopped()) {
			return AbstractStateUserEntity.COL_STOPPED;
		}

		// Setup
		if (this.isSetup()) {
			return AbstractStateUserEntity.COL_SETUP;
		}

		// Setdown
		if (this.isSetdown()) {
			return AbstractStateUserEntity.COL_SETDOWN;
		}

		// Not working because there is nothing to do (Idle)
		return StateEntity.COL_IDLE;
	}

	getTimeInState_Idle(simTime: number): number {
		return this.getTimeInState(simTime, StateEntity.STATE_IDLE);
	}

	getTimeInState_Maintenance(simTime: number): number {
		return this.getTimeInState(simTime, AbstractStateUserEntity.STATE_MAINTENANCE);
	}

	getTimeInState_Breakdown(simTime: number): number {
		return this.getTimeInState(simTime, AbstractStateUserEntity.STATE_BREAKDOWN);
	}

	getTimeInState_Stopped(simTime: number): number {
		return this.getTimeInState(simTime, AbstractStateUserEntity.STATE_STOPPED);
	}

	/**
	 * Loops from one state verification to the next.
	 */
	doStateVerification(): void {
		EventManager.scheduleUntil(this.verifyStateTarget, this.verifyStateConditional, null);
	}

	getUtilisation(simTime: number): number {
		const total = this.getTotalTime(simTime);
		const working = this.getTimeInWorkingState(simTime);
		return working/total;
	}

	getCommitment(simTime: number): number {
		const total = this.getTotalTime(simTime);
		const idle = this.getTimeInState_Idle(simTime);
		return 1.0 - idle/total;
	}

	getAvailability(simTime: number): number {
		const total = this.getTotalTime(simTime);
		const maintenance = this.getTimeInState_Maintenance(simTime);
		const breakdown = this.getTimeInState_Breakdown(simTime);
		return 1.0 - (maintenance + breakdown)/total;
	}

	getReliability(simTime: number): number {
		const working = this.getTimeInWorkingState(simTime);
		const breakdown = this.getTimeInState_Breakdown(simTime);
		return working / (working + breakdown);
	}

}

// Perform state verification at each event time
class AbstractStateUserEntity_VerifyStateConditional implements Conditional {
	constructor(private readonly outer: AbstractStateUserEntity) {}

	evaluate(): boolean {
		const state = this.outer.getState()!.getName();
		this.outer.setPresentState();
		const correctState = this.outer.getState()!.getName();
		if (!(correctState === state))
			this.outer.error(tr("Present state is incorrect: presentState=%s, correctState=%s"),
				state, correctState);
		return false;
	}
}

// Unused target for VerifyStateConditional
class AbstractStateUserEntity_VerifyStateTarget extends ProcessTarget {
	constructor(private readonly outer: AbstractStateUserEntity) {
		super();
	}

	override getDescription(): string {
		return this.outer.getName() + ".verifyState";
	}

	override process(): void {
		// error message has already been generated in the 'evaluate' method
		this.outer.doStateVerification();
	}
}

defineOutput(AbstractStateUserEntity, {
	name: "Idle",
	description: "Returns TRUE if able to work but there is no work to perform. "
	             + "For an EntitySystem, TRUE is returned if all the entities in the system are idle.",
	sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.isIdle(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Working",
	description: "Returns TRUE if work is being performed. "
	             + "For an EntitySystem, TRUE is returned if any of the entities in the system "
	             + "are working.",
	sequence: 2,
	returnType: "boolean",
	get: (e, simTime) => e.isBusy(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Setup",
	description: "Returns TRUE if setup is being performed. "
	             + "For an EntitySystem, TRUE is returned if setup is being performed on any of "
	             + "the entities in the system.",
	sequence: 3,
	returnType: "boolean",
	get: (e, simTime) => e.isSetup(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Setdown",
	description: "Returns TRUE if setdown is being performed. "
	             + "For an EntitySystem, TRUE is returned if setdown is being performed on any of "
	             + "the entities in the system.",
	sequence: 4,
	returnType: "boolean",
	get: (e, simTime) => e.isSetdown(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Maintenance",
	description: "Returns TRUE if maintenance is being performed. "
	             + "For an EntitySystem, TRUE is returned if maintenance is being performed on "
	             + "any of the entities in the system.",
	sequence: 5,
	returnType: "boolean",
	get: (e, simTime) => e.isMaintenance(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Breakdown",
	description: "Returns TRUE if a breakdown is being repaired. "
	             + "For an EntitySystem, TRUE is returned if a breakdown is being repaired on "
	             + "any of the entities in the system.",
	sequence: 6,
	returnType: "boolean",
	get: (e, simTime) => e.isBreakdown(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Stopped",
	description: "Returns TRUE if an operating limit prevents work from being performed. "
	             + "For an EntitySystem, TRUE is returned if an operating limit prevents work "
	             + "from being performed on any of the entities in the system.",
	sequence: 7,
	returnType: "boolean",
	get: (e, simTime) => e.isStopped(),
});

defineOutput(AbstractStateUserEntity, {
	name: "Utilisation",
	description: "The fraction of calendar time (excluding the initialisation period) that "
	             + "this object is in one of the 'working' states. Includes any completed cycles.",
	reportable: true,
	sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getUtilisation(simTime),
});

defineOutput(AbstractStateUserEntity, {
	name: "Commitment",
	description: "The fraction of calendar time (excluding the initialisation period) that "
	             + "this object is in any state other than Idle. Includes any completed cycles.",
	reportable: true,
	sequence: 9,
	returnType: "double",
	get: (e, simTime) => e.getCommitment(simTime),
});

defineOutput(AbstractStateUserEntity, {
	name: "Availability",
	description: "The fraction of calendar time (excluding the initialisation period) that "
	             + "this object is in any state other than Maintenance or Breakdown. "
	             + "Includes any completed cycles.",
	reportable: true,
	sequence: 10,
	returnType: "double",
	get: (e, simTime) => e.getAvailability(simTime),
});

defineOutput(AbstractStateUserEntity, {
	name: "Reliability",
	description: "The ratio of Working time to the sum of Working time and Breakdown time. "
	             + "Working time is the total time spent in any of the 'working' states. "
	             + "All times exclude the initialisation period and include any completed cycles.",
	reportable: true,
	sequence: 11,
	returnType: "double",
	get: (e, simTime) => e.getReliability(simTime),
});
