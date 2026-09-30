/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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

import { Double } from "../internal.ts";
import { DowntimeEntity } from "../internal.ts";
import { Threshold } from "../internal.ts";
import type { ThresholdUser } from "../Thresholds/ThresholdUser.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { EntityListInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { DowntimeUser } from "../states/DowntimeUser.ts";
import { StateEntity } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { AbstractStateUserEntity } from "../internal.ts";

export abstract class StateUserEntity extends AbstractStateUserEntity implements ThresholdUser, DowntimeUser {

	protected readonly immediateThresholdList: EntityListInput<Threshold>;

	protected readonly immediateReleaseThresholdList: EntityListInput<Threshold>;

	protected readonly operatingThresholdList: EntityListInput<Threshold>;

	protected readonly releaseThresholdList: EntityListInput<Threshold>;

	protected readonly immediateMaintenanceList: EntityListInput<DowntimeEntity>;

	protected readonly forcedMaintenanceList: EntityListInput<DowntimeEntity>;

	protected readonly opportunisticMaintenanceList: EntityListInput<DowntimeEntity>;

	protected readonly immediateBreakdownList: EntityListInput<DowntimeEntity>;

	protected readonly forcedBreakdownList: EntityListInput<DowntimeEntity>;

	protected readonly opportunisticBreakdownList: EntityListInput<DowntimeEntity>;

	constructor() {
		super();
		this.immediateThresholdList = new EntityListInput<Threshold>(Threshold, "ImmediateThresholdList", Entity.THRESHOLDS, [] as Threshold[]);
		this.setKeywordDoc(this.immediateThresholdList, "A list of thresholds that must be satisfied for the object to "
		                     + "operate. Operation is stopped immediately when one of the thresholds "
		                     + "closes. If a threshold closes part way though processing an entity, "
		                     + "the work is considered to be partly done and the remainder is "
		                     + "completed once the threshold re-opens.", []);
		this.addInput(this.immediateThresholdList);

		this.immediateReleaseThresholdList = new EntityListInput<Threshold>(Threshold, "ImmediateReleaseThresholdList", Entity.THRESHOLDS, [] as Threshold[]);
		this.setKeywordDoc(this.immediateReleaseThresholdList, "A list of thresholds that must be satisfied for the object to "
		                     + "operate. Operation is stopped immediately when one of the thresholds "
		                     + "closes. If a threshold closes part way though processing an entity, "
		                     + "the work is interrupted and the entity is released.", []);
		this.addInput(this.immediateReleaseThresholdList);

		this.operatingThresholdList = new EntityListInput<Threshold>(Threshold, "OperatingThresholdList", Entity.THRESHOLDS, [] as Threshold[]);
		this.setKeywordDoc(this.operatingThresholdList, "A list of thresholds that must be satisfied for the object to "
		                     + "operate. If a threshold closes part way though processing an entity, "
		                     + "the remaining work is completed and the entity is released before the "
		                     + "object is closed.", []);
		this.addInput(this.operatingThresholdList);

		this.releaseThresholdList = new EntityListInput<Threshold>(Threshold, "ReleaseThresholdList", Entity.THRESHOLDS, [] as Threshold[]);
		this.setKeywordDoc(this.releaseThresholdList, "A list of thresholds that must be satisfied for the object to "
		                     + "operate. If a threshold closes part way though processing an entity, "
		                     + "the remaining work is completed, but the entity is retained "
		                     + "until the threshold re-opens.", []);
		this.releaseThresholdList.setHidden(true);
		this.addInput(this.releaseThresholdList);

		this.immediateMaintenanceList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"ImmediateMaintenanceList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.immediateMaintenanceList, "A list of DowntimeEntities representing planned maintenance that "
		                     + "must be performed immediately, interrupting any work underway at "
		                     + "present.", []);
		this.addInput(this.immediateMaintenanceList);

		this.forcedMaintenanceList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"ForcedMaintenanceList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.forcedMaintenanceList, "A list of DowntimeEntities representing planned maintenance that "
		                     + "must begin as soon as task underway at present is finished.", []);
		this.addInput(this.forcedMaintenanceList);

		this.opportunisticMaintenanceList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"OpportunisticMaintenanceList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.opportunisticMaintenanceList, "A list of DowntimeEntities representing planned maintenance that "
		                     + "can wait until task underway at present is finished and the queue "
		                     + "of tasks is empty.", []);
		this.addInput(this.opportunisticMaintenanceList);

		this.immediateBreakdownList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"ImmediateBreakdownList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.immediateBreakdownList, "A list of DowntimeEntities representing unplanned maintenance that "
		                     + "must be performed immediately, interrupting any work underway at "
		                     + "present.", []);
		this.addInput(this.immediateBreakdownList);

		this.forcedBreakdownList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"ForcedBreakdownList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.forcedBreakdownList, "A list of DowntimeEntities representing unplanned maintenance that "
		                     + "must begin as soon as task underway at present is finished.", []);
		this.addInput(this.forcedBreakdownList);

		this.opportunisticBreakdownList =  new EntityListInput<DowntimeEntity>(DowntimeEntity,
				"OpportunisticBreakdownList", Entity.MAINTENANCE, [] as DowntimeEntity[]);
		this.setKeywordDoc(this.opportunisticBreakdownList, "A list of DowntimeEntities representing unplanned maintenance that "
		                     + "can wait until task underway at present is finished and the queue "
		                     + "of tasks is empty.", []);
		this.addInput(this.opportunisticBreakdownList);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.initStates();
	}

	override lateInit(): void {
		super.lateInit();
		if (!this.isActive())
			return;
		for (const thresh of this.getThresholds()) {
			thresh.registerThresholdUser(this);
		}
		for (const de of this.getDowntimeEntities()) {
			de.registerDowntimeUser(this);
		}
	}

	override startUp(): void {
		super.startUp();
		this.setPresentState();
	}

	initStates(): void {
		this.addState(StateEntity.STATE_IDLE);
		this.addState(StateEntity.STATE_WORKING);
		this.addState(AbstractStateUserEntity.STATE_MAINTENANCE);
		this.addState(AbstractStateUserEntity.STATE_BREAKDOWN);
		this.addState(AbstractStateUserEntity.STATE_STOPPED);
	}

	override kill(): void {
		super.kill();
		for (const thresh of this.getThresholds()) {
			thresh.unregisterThresholdUser(this);
		}
		for (const de of this.getDowntimeEntities()) {
			de.unregisterDowntimeUser(this);
		}
	}

	// ********************************************************************************************
	// THRESHOLDS
	// ********************************************************************************************

	// Java では interface ThresholdUser の関数で、この抽象クラスには書かれていない（子クラスが実装する）。
	// TS では implements した抽象クラスにも宣言が要るので、抽象の宣言だけ置く（実行時には何も生まれない）
	abstract thresholdChanged(): void;

	getThresholds(): Threshold[] {
		const ret: Threshold[] = [...this.operatingThresholdList.getValue()!];
		ret.push(...this.releaseThresholdList.getValue()!);
		ret.push(...this.immediateThresholdList.getValue()!);
		ret.push(...this.immediateReleaseThresholdList.getValue()!);
		return ret;
	}

	isImmediateThresholdClosure(): boolean {
		for (const thresh of this.immediateThresholdList.getValue()!) {
			if (!thresh.isOpen())
				return true;
		}
		return false;
	}

	isImmediateReleaseThresholdClosure(): boolean {
		for (const thresh of this.immediateReleaseThresholdList.getValue()!) {
			if (!thresh.isOpen())
				return true;
		}
		return false;
	}

	isOperatingThresholdClosure(): boolean {
		for (const thr of this.operatingThresholdList.getValue()!) {
			if (!thr.isOpen())
				return true;
		}
		return false;
	}

	isReleaseThresholdClosure(): boolean {
		for (const thr of this.releaseThresholdList.getValue()!) {
			if (!thr.isOpen())
				return true;
		}
		return false;
	}

	// ********************************************************************************************
	// PRESENT STATE
	// ********************************************************************************************

	override isSetup(): boolean {
		return false;
	}

	override isSetdown(): boolean {
		return false;
	}

	/**
	 * Tests whether all the thresholds are open.
	 * @return true if all the thresholds are open.
	 */
	isOpen(): boolean {
		return !this.isStopped();
	}

	/**
	 * Returns whether all work in progress has been completed.
	 * @return true if there is no work in progress
	 */
	isFinished(): boolean {
		return true;
	}

	/**
	 * Returns whether work must stop if a ReleaseThreshold closes.
	 * @return true if work stops for a ReleaseThreshold closure
	 */
	isReadyToRelease(): boolean {
		return true;
	}

	override isStopped(): boolean {
		return this.isImmediateThresholdClosure() || this.isImmediateReleaseThresholdClosure()
				|| (this.isOperatingThresholdClosure() && this.isFinished())
				|| (this.isReleaseThresholdClosure() && this.isReadyToRelease());
	}

	override isMaintenance(): boolean {
		for (const de of this.immediateMaintenanceList.getValue()!) {
			if (de.isDown())
				return true;
		}
		for (const de of this.forcedMaintenanceList.getValue()!) {
			if (de.isDown())
				return true;
		}
		for (const de of this.opportunisticMaintenanceList.getValue()!) {
			if (de.isDown())
				return true;
		}
		return false;
	}

	isImmediateMaintenance(): boolean {
		for (const de of this.immediateMaintenanceList.getValue()!) {
			if (de.isDown())
				return true;
		}
		return false;
	}

	override isBreakdown(): boolean {
		for (const de of this.immediateBreakdownList.getValue()!) {
			if (de.isDown())
				return true;
		}
		for (const de of this.forcedBreakdownList.getValue()!) {
			if (de.isDown())
				return true;
		}
		for (const de of this.opportunisticBreakdownList.getValue()!) {
			if (de.isDown())
				return true;
		}
		return false;
	}

	isImmediateBreakdown(): boolean {
		for (const de of this.immediateBreakdownList.getValue()!) {
			if (de.isDown())
				return true;
		}
		return false;
	}

	isForcedDowntimePending(): boolean {
		for (const de of this.forcedMaintenanceList.getValue()!) {
			if (de.isDowntimePending())
				return true;
		}
		for (const de of this.forcedBreakdownList.getValue()!) {
			if (de.isDowntimePending())
				return true;
		}
		return false;
	}

	isImmediateDowntimePending(): boolean {
		for (const de of this.immediateMaintenanceList.getValue()!) {
			if (de.isDowntimePending())
				return true;
		}
		for (const de of this.immediateBreakdownList.getValue()!) {
			if (de.isDowntimePending())
				return true;
		}
		return false;
	}

	/**
	 * Returns whether the caller can be started.
	 * @return true if the caller can be started
	 */
	isAbleToRestart(): boolean {
		return this.isAvailable() && !this.isForcedDowntimePending() && !this.isImmediateDowntimePending();
	}

	// ********************************************************************************************
	// MAINTENANCE AND BREAKDOWNS
	// ********************************************************************************************

	getDowntimeEntities(): DowntimeEntity[] {
		const ret: DowntimeEntity[] = [...this.immediateMaintenanceList.getValue()!];
		ret.push(...this.immediateBreakdownList.getValue()!);
		ret.push(...this.forcedMaintenanceList.getValue()!);
		ret.push(...this.forcedBreakdownList.getValue()!);
		ret.push(...this.opportunisticMaintenanceList.getValue()!);
		ret.push(...this.opportunisticBreakdownList.getValue()!);
		return ret;
	}

	isDowntimeUser(down: DowntimeEntity): boolean {
		return this.immediateMaintenanceList.getValue()!.includes(down)
				|| this.immediateBreakdownList.getValue()!.includes(down)
		        || this.forcedMaintenanceList.getValue()!.includes(down)
				|| this.forcedBreakdownList.getValue()!.includes(down)
		        || this.opportunisticMaintenanceList.getValue()!.includes(down)
				|| this.opportunisticBreakdownList.getValue()!.includes(down);
	}

	canStartDowntime(down: DowntimeEntity): boolean {

		// Downtime can start when any work in progress has been interrupted and there are no
		// other maintenance or breakdown activities that are being performed. It is okay to start
		// downtime when one or more thresholds are closed.
		const simTime = EventManager.simSeconds();
		return !this.isBusy() && (down.isConcurrent(simTime) || !this.isMaintenance() && !this.isBreakdown());
	}

	prepareForDowntime(down: DowntimeEntity): void {
		if (this.isTraceFlag()) this.trace(0, "prepareForDowntime(%s) - type=%s, busy=%s",
				down, this.getDowntimeType(down), this.isBusy());
	}

	startDowntime(down: DowntimeEntity): void {
		if (this.isTraceFlag()) this.trace(0, "startDowntime(%s)", down);
		this.setPresentState();
	}

	endDowntime(down: DowntimeEntity): void {
		if (this.isTraceFlag()) this.trace(0, "endDowntime(%s)", down);
		this.setPresentState();
	}

	getDowntimeType(down: DowntimeEntity): string {
		if (this.isImmediateDowntime(down))
			return "Immediate";
		if (this.isForcedDowntime(down))
			return "Forced";
		if (this.isOpportunisticDowntime(down))
			return "Opportunistic";
		return "Unknown";
	}

	isImmediateDowntime(down: DowntimeEntity): boolean {
		return this.immediateMaintenanceList.getValue()!.includes(down)
				|| this.immediateBreakdownList.getValue()!.includes(down);
	}

	isForcedDowntime(down: DowntimeEntity): boolean {
		return this.forcedMaintenanceList.getValue()!.includes(down)
				|| this.forcedBreakdownList.getValue()!.includes(down);
	}

	isOpportunisticDowntime(down: DowntimeEntity): boolean {
		return this.opportunisticMaintenanceList.getValue()!.includes(down)
				|| this.opportunisticBreakdownList.getValue()!.includes(down);
	}

	// ********************************************************************************************
	// OUTPUTS
	// ********************************************************************************************

	getOpen(simTime: number): boolean {
		return this.isOpen();
	}

	getNextMaintenanceTime(simTime: number): number {
		let ret = Double.POSITIVE_INFINITY;
		for (const down of this.immediateMaintenanceList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		for (const down of this.forcedMaintenanceList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		for (const down of this.opportunisticMaintenanceList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		return ret;
	}

	getNextBreakdownTime(simTime: number): number {
		let ret = Double.POSITIVE_INFINITY;
		for (const down of this.immediateBreakdownList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		for (const down of this.forcedBreakdownList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		for (const down of this.opportunisticBreakdownList.getValue()!) {
			ret = Math.min(ret, down.getNextStartTime(simTime));
		}
		return ret;
	}

}

defineOutput(StateUserEntity, {
	name: "Open",
	description: "Returns TRUE if all the thresholds specified by the OperatingThresholdList, "
	             + "ImmediateThresholdList, and ImmediateReleaseThresholdList keywords are open.",
	sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.getOpen(simTime),
});

defineOutput(StateUserEntity, {
	name: "NextMaintenanceTime",
	description: "The estimated time at which the next maintenance activity will start.",
	unitType: TimeUnit,
	reportable: false,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getNextMaintenanceTime(simTime),
});

defineOutput(StateUserEntity, {
	name: "NextBreakdownTime",
	description: "The estimated time at which the next breakdown will occur.",
	unitType: TimeUnit,
	reportable: false,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getNextBreakdownTime(simTime),
});
