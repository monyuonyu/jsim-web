/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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

// 入れ子のクラス EndStepTarget は、このファイルの中の Device_EndStepTarget にした。
// 多重定義の updateProgress() と updateProgress(double dt) は、中身の違う final と abstract なので分けた:
//   final の updateProgress() → updateProgressToNow()（docs/renamed.md）。abstract の updateProgress(dt) は元の名前。

import { Double } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { DowntimeEntity } from "../BasicObjects/DowntimeEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityTarget } from "../basicsim/EntityTarget.ts";
import { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../basicsim/SubjectEntityDelegate.ts";
import { EventHandle } from "../events/EventHandle.ts";
import { EventManager } from "../events/EventManager.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { StateUserEntity } from "./StateUserEntity.ts";

export abstract class Device extends StateUserEntity implements ObserverEntity, SubjectEntity {

	private lastUpdateTime = 0.0; // simulation time at which the process was updated last
	private duration = 0.0; // calculated duration of the process time step
	private remainingDuration = 0.0; // remaining duration of the process time step
	private endTicks = 0;  // planned simulation time in ticks at the end of the next process step
	private readyToRelease = false;  // indicates that an entity was prevented from being released by a ReleaseThreshold
	private stepCompleted = false;  // indicates that the last process time step was completed
	private processing = false;  // indicates that the process loop is active
	private startUpTicks = 0;  // clock ticks at which device was started most recently

	private readonly subject = new SubjectEntityDelegate(this);

	constructor() {
		super();
	}

	override validate(): void {
		super.validate();
		ObserverEntity.validate(this);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.duration = 0.0;
		this.remainingDuration = 0.0;
		this.endTicks = 0;
		this.lastUpdateTime = 0.0;
		this.readyToRelease = false;
		this.stepCompleted = true;
		this.processing = false;
		this.startUpTicks = -1;

		// Clear the list of observers
		this.subject.clear();
	}

	override lateInit(): void {
		super.lateInit();
		ObserverEntity.registerWithSubjects(this, this.getWatchList());
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	observerUpdate(subj: SubjectEntity): void {
		this.performUnscheduledUpdate();
	}

	getWatchList(): SubjectEntity[] {
		return [];
	}

	/**
	 * Restarts the processing loop.
	 */
	restart(): void {

		// If already working, do nothing
		if (this.processing || this.isSetup() || this.isSetdown()) {
			if (this.isTraceFlag()) this.trace(0, "restart - ALREADY STARTED");
			this.setPresentState();
			return;
		}

		// If cannot restart, clear any setup that has already taken place
		if (!this.isAbleToRestart()) {
			if (this.isTraceFlag()) this.trace(0, "restart - UNABLE TO RESTART");
			this.setProcessStopped();
			this.setPresentState();
			return;
		}

		// Start work
		if (this.isTraceFlag()) this.trace(0, "restart - START WORK");
		this.processing = true;
		this.startUpTicks = EventManager.simTicks();
		this.lastUpdateTime = EventManager.simSeconds();
		this.startStep();
	}

	override isBusy(): boolean {
		return this.processing && !this.isSetup() && !this.isSetdown();
	}

	/**
	 * Returns the simulation time in clock ticks at which the device was started most recently.
	 * @return start time in clock ticks
	 */
	getStartUpTicks(): number {
		return this.startUpTicks;
	}

	setStartUpTicks(ticks: number): void {
		this.startUpTicks = ticks;
	}

	/**
	 * Starts the next time step for the process.
	 */
	private startStep(): void {
		if (this.isTraceFlag()) {
			this.trace(0, "startStep");
			this.traceLine(1, "isAvailable=%s, forcedDowntimePending=%s, immediateDowntimePending=%s",
					this.isAvailable(), this.isForcedDowntimePending(), this.isImmediateDowntimePending());
		}

		const simTime = EventManager.simSeconds();

		// Is the process loop is already working?
		if (this.endStepHandle.isScheduled()) {
			this.error(tr("Processing is already in progress."));
		}

		// Stop if any of the thresholds, maintenance, or breakdowns close the operation
		// or if a forced downtime is about to begin
		if (this.isReadyToStop()) {
			this.stopProcessing();
			return;
		}
		this.setReadyToRelease(false);

		// Start the next time step
		if (this.isNewStepReqd(this.stepCompleted)) {
			const bool = this.startProcessing(simTime);
			if (!bool) {
				this.stopProcessing();
				return;
			}
			this.duration = this.getStepDuration(simTime);
			this.remainingDuration = this.duration;
		}

		// Trap errors
		if (Double.isNaN(this.remainingDuration))
			this.error(tr("Cannot calculate duration"));
		if (this.remainingDuration === Double.POSITIVE_INFINITY)
			this.error(tr("Infinite duration"));

		// Set the state for the time step
		const durTicks = EventManager.current().secondsToNearestTick(this.remainingDuration);
		if (durTicks > 0) {
			this.setPresentState();
		}

		// Schedule the completion of the time step
		this.stepCompleted = false;
		this.endTicks = EventManager.simTicks() + durTicks;
		if (this.isTraceFlag()) this.traceLine(1, "remainingDuration=%.6f", this.remainingDuration);
		EventManager.scheduleTicks(durTicks, Entity.PRI_NORMAL, Entity.EVT_FIFO, this.endStepTarget, this.endStepHandle);

		// Notify other processes that are dependent on this one
		if (this.isNewStepReqd(this.stepCompleted)) {
			this.processChanged();
		}

		// Notify any observers
		this.notifyObservers();
	}

	private readonly endStepTarget: ProcessTarget = new Device_EndStepTarget(this);
	private readonly endStepHandle = new EventHandle();

	/**
	 * Completes the processing of an entity.
	 */
	endStep(): void {
		if (this.isTraceFlag()) this.trace(0, "endStep");
		const simTime = EventManager.simSeconds();

		// Update the process for the time that has elapsed
		this.updateProgressToNow();

		// If the full step was completed or if there was an immediate release type threshold
		// closure, then determine whether to change state and/or to continue to the next step
		if (EventManager.simTicks() === this.endTicks || this.isImmediateReleaseThresholdClosure()) {
			this.stepCompleted = true;
			this.duration = 0.0;
			this.processStep(simTime);
		}

		// Start the next time step
		this.startStep();
	}

	/**
	 * Updates the process calculations at the end of the time step.
	 * （Java の final の updateProgress()。abstract の updateProgress(double) と分けるため名前を変えた）
	 */
	protected updateProgressToNow(): void {
		if (this.isTraceFlag()) this.trace(1, "updateProgress");
		const simTime = EventManager.simSeconds();

		if (this.isBusy()) {
			const dt = simTime - this.lastUpdateTime;
			this.remainingDuration = Math.max(0.0, this.remainingDuration - dt);
			this.updateProgress(dt);
		}
		this.lastUpdateTime = simTime;
	}

	override isReadyToRelease(): boolean {
		return this.readyToRelease;
	}

	setReadyToRelease(bool: boolean): void {
		this.readyToRelease = bool;
	}

	isReadyToStop(): boolean {
		return !this.isAvailable() || this.isImmediateDowntimePending()
				|| (this.isForcedDowntimePending() && this.isFinished());
	}

	/**
	 * Halts further processing.
	 */
	private stopProcessing(): void {
		if (this.isTraceFlag()) this.trace(0, "stopProcessing");

		this.processing = false;

		// Set any actions that must be done prior to calling processChanged
		this.prepareToStop();

		// Notify other processes that are dependent on this one
		this.processChanged();

		// Set the process to its stopped condition
		this.setProcessStopped();

		// Update the state
		this.setPresentState();

		// Notify any observers
		this.notifyObservers();
	}

	/**
	 * Interrupts the present time step for the process so that a new one can be started based on
	 * new conditions.
	 */
	unscheduledUpdate(): void {

		// If process is being set up, wait for it to complete
		if (this.isSetup()) {
			if (this.isTraceFlag()) this.trace(0, "unscheduledUpdate - SETUP IN PROGRESS");
			return;
		}

		// If process is being set down, wait for it to complete
		if (this.isSetdown()) {
			if (this.isTraceFlag()) this.trace(0, "unscheduledUpdate - SETDOWN IN PROGRESS");
			return;
		}

		// If the process is working, perform its next update immediately
		if (this.endStepHandle.isScheduled()) {
			if (this.isTraceFlag()) this.trace(0, "unscheduledUpdate - WORK IN PROGRESS");
			EventManager.killEvent(this.endStepHandle);
			EventManager.scheduleTicks(0, Entity.PRI_NORMAL, Entity.EVT_FIFO, this.endStepTarget, this.endStepHandle);
			return;
		}

		// If the process is stopped, then restart it
		if (this.isTraceFlag()) this.trace(0, "unscheduledUpdate - RESTART");
		this.restart();
	}

	/**
	 * Schedules an update
	 */
	performUnscheduledUpdate(): void {
		if (this.isTraceFlag()) this.trace(0, "performUnscheduledUpdate");

		if (!this.unscheduledUpdateHandle.isScheduled()) {
			EventManager.scheduleTicks(0, Entity.PRI_LOW, Entity.EVT_FIFO, this.unscheduledUpdateTarget, this.unscheduledUpdateHandle);
		}
	}

	private readonly unscheduledUpdateHandle = new EventHandle();
	private readonly unscheduledUpdateTarget: ProcessTarget = new (class extends EntityTarget<Device> {
		override process(): void {
			this.ent.unscheduledUpdate();
		}
	})(this, "unscheduledUpdate");

	/**
	 * Revises the time for the next event by stopping the present process and starting a new one.
	 */
	protected resetProcess(): void {
		if (this.isTraceFlag()) {
			this.trace(0, "resetProcess");
			this.traceLine(1, "endActionHandle.isScheduled()=%s", this.endStepHandle.isScheduled());
		}

		// Set the present process to completed
		this.stepCompleted = true;

		// End the present process prematurely
		if (this.endStepHandle.isScheduled()) {
			EventManager.killEvent(this.endStepHandle);
			EventManager.scheduleTicks(0, Entity.PRI_NORMAL, Entity.EVT_FIFO, this.endStepTarget, this.endStepHandle);
		}
	}

	/**
	 * Performs the process calculations at the start of a new process time step.
	 * @param simTime - present simulation time
	 * @return indicates whether to continue processing
	 */
	protected abstract startProcessing(simTime: number): boolean;

	/**
	 * Returns the duration of the next process time step.
	 * @param simTime - present simulation time
	 * @return time step duration
	 */
	protected abstract getStepDuration(simTime: number): number;

	/**
	 * Performs the process calculations at the end of the time step.
	 * @param dt - elapsed simulation time
	 */
	protected abstract updateProgress(dt: number): void;

	/**
	 * Performs any calculations related to the state of the process and returns a boolean to
	 * specify whether to start a new time step.
	 * @param simTime - present simulation time
	 */
	protected abstract processStep(simTime: number): void;

	/**
	 * Alerts other processes that the present process has changed.
	 */
	protected abstract processChanged(): void;

	/**
	 * Determines whether to start a new time step or to complete the present one.
	 * @param completed - indicate whether the present time step duration was completed in full
	 * @return whether to start a new time step
	 */
	protected abstract isNewStepReqd(completed: boolean): boolean;

	/**
	 * Performs any actions that must be done to stop the process prior to calling
	 * setProcessChanged.
	 */
	protected prepareToStop(): void {}

	/**
	 * Set the process to its stopped condition.
	 */
	protected abstract setProcessStopped(): void;

	/**
	 * Returns the time at which the last update was performed.
	 * @return time for the last update
	 */
	protected getLastUpdateTime(): number {
		return this.lastUpdateTime;
	}

	isUpdated(simTime: number): boolean {
		return (simTime === this.lastUpdateTime);
	}

	protected getDuration(): number {
		return this.duration;
	}

	protected getRemainingDuration(simTime: number): number {
		let ret = this.remainingDuration;
		if (this.isBusy()) {
			ret -= simTime - this.lastUpdateTime;
		}
		return ret;
	}

	// ********************************************************************************************
	// THRESHOLDS
	// ********************************************************************************************

	thresholdChanged(): void {
		if (this.isTraceFlag()) {
			this.trace(0, "thresholdChanged");
			this.traceLine(1, "isImmediateReleaseThresholdClosure=%s, isImmediateThresholdClosure=%s",
				this.isImmediateReleaseThresholdClosure(), this.isImmediateThresholdClosure());
		}

		// If an immediate closure, interrupt the present activity and hold the entity
		if (this.isImmediateThresholdClosure() || this.isImmediateReleaseThresholdClosure()) {
			this.performUnscheduledUpdate();
			return;
		}

		// Otherwise, check whether processing can be restarted
		this.restart();
	}

	// ********************************************************************************************
	// MAINTENANCE AND BREAKDOWNS
	// ********************************************************************************************

	override prepareForDowntime(down: DowntimeEntity): void {
		super.prepareForDowntime(down);

		// If the device is idle already, then downtime can start right away
		if (!this.isBusy())
			return;

		// For an immediate downtime, interrupt the present process
		if (this.isImmediateDowntime(down)) {
			this.performUnscheduledUpdate();
			return;
		}
	}

	override endDowntime(down: DowntimeEntity): void {
		super.endDowntime(down);
		this.restart();
	}

}

/**
 * EndActionTarget
 */
class Device_EndStepTarget extends EntityTarget<Device> {
	constructor(ent: Device) {
		super(ent, "endStep");
	}

	override process(): void {
		this.ent.endStep();
	}
}
