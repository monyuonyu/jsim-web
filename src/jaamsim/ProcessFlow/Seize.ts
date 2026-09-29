/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2020 JaamSim Software Inc.
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

// Java の stateChanged()（引数なし）は、StateEntity.stateChanged(StateRecord, StateRecord)（状態が変わったときに呼ばれる）と
// 1 つの関数にすると、状態の切り替えのたびに資源の通知が走ってしまうので、resourceStateChanged() にした（docs/renamed.md）。

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { ClassRegistry } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { EventHandle } from "../internal.ts";
import { EventManager } from "../internal.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { AbstractResourceProvider } from "../internal.ts";
import { AbstractLinkedResourceUser } from "../internal.ts";

export class Seize extends AbstractLinkedResourceUser {

	constructor() {
		super();
		this.processPosition.setHidden(true);
		this.workingStateListInput.setHidden(true);
		this.immediateMaintenanceList.setHidden(true);
		this.forcedMaintenanceList.setHidden(true);
		this.opportunisticMaintenanceList.setHidden(true);
		this.immediateBreakdownList.setHidden(true);
		this.forcedBreakdownList.setHidden(true);
		this.opportunisticBreakdownList.setHidden(true);

		this.immediateThresholdList.setHidden(true);
		this.immediateReleaseThresholdList.setHidden(true);

		this.resourceList.setRequired(true);
	}

	resourceStateChanged(): void {
		if (!this.isReadyToStart())
			return;
		AbstractResourceProvider.notifyResourceUsers(this.getResourceList());
	}

	override queueChanged(): void {
		this.resourceStateChanged();
	}

	override thresholdChanged(): void {
		this.resourceStateChanged();
		super.thresholdChanged();
	}

	override observerUpdate(subj: SubjectEntity): void {
		if (!this.stateChangedHandle.isScheduled()) {
			EventManager.scheduleTicks(0, Entity.PRI_LOW, Entity.EVT_FIFO, this.stateChangedTarget, this.stateChangedHandle);
		}
	}

	private readonly stateChangedHandle = new EventHandle();
	private readonly stateChangedTarget: ProcessTarget = new (class extends EntityTarget<Seize> {
		override process(): void {
			this.ent.resourceStateChanged();
		}
	})(this, "stateChanged");

	protected override startProcessing(simTime: number): boolean {
		return false;
	}

	protected override getStepDuration(simTime: number): number {
		return 0.0;
	}

	protected override processStep(simTime: number): void {}

	override isFinished(): boolean {
		return true;  // can always stop when isFinished is called in startStep
	}

	override startNextEntity(): void {
		super.startNextEntity();
		const simTime = EventManager.simSeconds();
		const ent = this.getReceivedEntity(simTime) as DisplayEntity;
		this.sendToNextComponent(ent);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Seize", Seize);
