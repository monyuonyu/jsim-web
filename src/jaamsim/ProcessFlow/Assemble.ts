/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

// updateGraphics は、組み立てた物の位置（状態）を決めるので残した。

import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { OverlayEntity } from "../Graphics/OverlayEntity.ts";
import { TextBasics } from "../Graphics/TextBasics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { StringInput } from "../input/StringInput.ts";
import { StateEntity } from "../states/StateEntity.ts";
import { AbstractCombine } from "./AbstractCombine.ts";
import { EntityGen } from "./EntityGen.ts";

export class Assemble extends AbstractCombine implements EntityGen {

	private readonly prototypeEntity: EntityInput<DisplayEntity>;

	private readonly baseName: StringInput;

	private assembledEntity: DisplayEntity | null = null;	// the generated entity representing the assembled part
	private numberGenerated = 0;  // Number of entities generated so far

	constructor() {
		super();
		this.prototypeEntity = new EntityInput<DisplayEntity>(DisplayEntity, "PrototypeEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.prototypeEntity, "The prototype for entities representing the assembled parts.", []);
		this.prototypeEntity.setRequired(true);
		this.prototypeEntity.addInvalidClass(TextBasics);
		this.prototypeEntity.addInvalidClass(OverlayEntity);
		this.addInput(this.prototypeEntity);

		this.baseName = new StringInput("BaseName", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.baseName, "The base for the names assigned to the entities representing the "
		                     + "assembled parts. "
		                     + "The entities will be named Name1, Name2, etc.",
		         ["Customer", "Package"]);
		this.baseName.setDefaultText("Assemble Name");
		this.addInput(this.baseName);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.assembledEntity = null;
		this.numberGenerated = 0;
	}

	protected override startProcessing(simTime: number): boolean {

		// Do the queues have enough entities?
		const queueList = this.getQueues();

		const oldEnt = this.getReceivedEntity(simTime);
		this.setReceivedEntity(queueList[0].getFirst());
		const numList = this.getNumberRequired(simTime);
		this.setReceivedEntity(oldEnt);

		if (this.isMatchRequired(simTime)) {
			const m = AbstractCombine.selectMatchValue(queueList, numList, this.isFirstQueue(simTime));
			if (m === null) {
				return false;
			}
			this.setMatchValue(m);
		}
		else {
			if (!AbstractCombine.sufficientEntities(queueList, numList, null)) {
				return false;
			}
		}

		// Remove the appropriate entities from each queue
		this.clearConsumedEntityList();
		for (let i = 0; i < queueList.length; i++) {
			for (let n = 0; n < numList[i]; n++) {
				const ent = queueList[i].removeFirst(this.getMatchValue());
				if (ent === null)
					this.error(tr("An entity with the specified match value %s was not found in %s."),
							this.getMatchValue(), queueList[i]);
				this.addConsumedEntity(ent);
			}
		}

		// Create the entity representing the assembled part
		this.numberGenerated++;
		const proto = this.prototypeEntity.getValue()!;
		let name = this.baseName.getValue();
		if (name === null) {
			name = this.getName() + "_";
			name = name.split(".").join("_");  // Java の String.replace（全部を置き換える）
		}
		name = name + this.numberGenerated;

		// Create the new entity
		const assembledEntity = InputAgent.getGeneratedClone(proto, name) as DisplayEntity;
		this.assembledEntity = assembledEntity;
		assembledEntity.earlyInit();
		assembledEntity.lateInit();

		// Set the obj output to the assembled part
		this.receiveEntity(assembledEntity);
		this.setEntityState(assembledEntity);

		// Set the state for the assembled part
		if (!this.stateAssignment.isDefault() && assembledEntity instanceof StateEntity) {
			const state = this.stateAssignment.getNextString(this, simTime);
			(assembledEntity as StateEntity).setPresentState(state);
		}
		return true;
	}

	protected override processStep(simTime: number): void {

		// Send the assembled part to the next element in the chain
		this.sendToNextComponent(this.assembledEntity!);
		this.assembledEntity = null;
	}

	override isFinished(): boolean {
		return this.assembledEntity === null;
	}

	setPrototypeEntity(proto: DisplayEntity): void {
		const kw = KeywordIndex.formatArgs(this.prototypeEntity.getKeyword(), proto.getName());
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		if (this.prototypeEntity.getValue() !== null)
			ret.push(this.prototypeEntity.getValue()!);
		return ret;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.assembledEntity === null)
			return;
		this.moveToProcessPosition(this.assembledEntity);
	}

}

EntityGen.register(Assemble);

ClassRegistry.register("com.jaamsim.ProcessFlow.Assemble", Assemble);
