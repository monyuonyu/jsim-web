/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

// 出力の getMatchValue(double) の上書きは、LinkedService で getMatchValue() と 1 つにした関数を上書きする
// （EntityGenerator は setMatchValue を呼ばないので、getMatchValue() も Java と同じく null のまま）。

import { tr } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { EntityProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { TextBasics } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput, hideOutput } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { EntityGen } from "../internal.ts";
import { LinkedService } from "../internal.ts";

/** Java の (int) x（double → int。0 の方向へ切り捨て、範囲外は端、NaN は 0） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/**
 * EntityGenerator creates sequence of DisplayEntities at random intervals, which are placed in a target Queue.
 */
export class EntityGenerator extends LinkedService implements EntityGen {

	private readonly firstArrivalTime: SampleInput;

	private readonly interArrivalTime: SampleInput;

	private readonly entitiesPerArrival: SampleInput;

	private readonly prototypeEntity: EntityProvInput<DisplayEntity>;

	private readonly baseName: StringInput;

	private readonly maxNumber: SampleInput;

	private readonly initialNumber: SampleInput;

	private numberGenerated = 0;  // Number of entities generated so far
	private presentIAT = 0.0;

	constructor() {
		super();
		this.defaultEntity.setHidden(true);
		this.stateAssignment.setHidden(true);
		this.waitQueue.setHidden(true);
		this.match.setHidden(true);
		this.watchList.setHidden(true);
		this.processPosition.setHidden(true);
		this.opportunisticMaintenanceList.setHidden(true);
		this.opportunisticBreakdownList.setHidden(true);
		this.selectionCondition.setHidden(true);
		this.nextEntity.setHidden(true);

		this.firstArrivalTime = new SampleInput("FirstArrivalTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.firstArrivalTime, "The arrival time for the first generated entity.",
		         ["3.0 h", "ExponentialDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.firstArrivalTime.setUnitType(TimeUnit);
		this.firstArrivalTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.firstArrivalTime);

		this.interArrivalTime = new SampleInput("InterArrivalTime", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.interArrivalTime, "The inter-arrival time between generated entities.",
		         ["3.0 h", "ExponentialDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.interArrivalTime.setUnitType(TimeUnit);
		this.interArrivalTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.interArrivalTime);

		this.entitiesPerArrival = SampleInput.ofInt("EntitiesPerArrival", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.entitiesPerArrival, "The number of entities to be generated for each arrival.",
		         ["3", "TimeSeries1", "'1 + 2*[DiscreteDistribution1].Value'"]);
		this.entitiesPerArrival.setUnitType(DimensionlessUnit);
		this.entitiesPerArrival.setIntegerValue(true);
		this.entitiesPerArrival.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.entitiesPerArrival);

		this.prototypeEntity = new EntityProvInput<DisplayEntity>(DisplayEntity, "PrototypeEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.prototypeEntity, "The prototype for entities to be generated. "
		                     + "The generated entities will be copies of this entity.",
		         ["Proto", "'choose( this.NumberGenerated%2+1, [Proto1], [Proto2])'"]);
		this.prototypeEntity.setRequired(true);
		this.prototypeEntity.addInvalidClass(TextBasics);
		this.prototypeEntity.addInvalidClass(OverlayEntity);
		this.addInput(this.prototypeEntity);

		this.baseName = new StringInput("BaseName", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.baseName, "The base for the names assigned to the generated entities. "
		                     + "The generated entities will be named Name1, Name2, etc.",
		         ["Customer", "Package"]);
		this.baseName.setDefaultText("Generator Name");
		this.addInput(this.baseName);

		this.maxNumber = new SampleInput("MaxNumber", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxNumber, "The maximum number of entities to be generated.",
		         ["3", "InputValue1", "[InputValue1].Value"]);
		this.maxNumber.setUnitType(DimensionlessUnit);
		this.maxNumber.setIntegerValue(true);
		this.maxNumber.setValidRange(0, Double.POSITIVE_INFINITY);
		this.maxNumber.setDefaultText(Input.POSITIVE_INFINITY);
		this.addInput(this.maxNumber);

		this.initialNumber = SampleInput.ofInt("InitialNumber", Entity.KEY_INPUTS, 0);
		this.setKeywordDoc(this.initialNumber, "The number of entities to be generated simultaneously at the start of the run.",
		         ["3", "InputValue1", "[InputValue1].Value"]);
		this.initialNumber.setUnitType(DimensionlessUnit);
		this.initialNumber.setIntegerValue(true);
		this.initialNumber.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.initialNumber);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.numberGenerated = 0;
		this.presentIAT = 0.0;
	}

	override addEntity( ent: DisplayEntity ): void {
		this.error(tr("An entity cannot be sent to an EntityGenerator."));
	}

	override startUp(): void {
		super.startUp();

		// Start generating entities
		this.restart();
	}

	protected override startProcessing(simTime: number): boolean {

		// Stop if the last entity been generated
		if (!this.maxNumber.isDefault()
				&& this.numberGenerated >= this.maxNumber.getNextSample(this, simTime))
			return false;

		// Select the inter-arrival time for the next entity
		const initNumber = jint(this.initialNumber.getNextSample(this, simTime));
		if (this.numberGenerated < initNumber)
			this.presentIAT = 0.0;
		else if (this.numberGenerated === initNumber)
			this.presentIAT = this.firstArrivalTime.getNextSample(this, simTime);
		else
			this.presentIAT = this.interArrivalTime.getNextSample(this, simTime);

		if (this.presentIAT === Double.POSITIVE_INFINITY)
			return false;

		return true;
	}

	protected override processStep(simTime: number): void {

		// Do any of the thresholds stop the generator?
		if (!this.isOpen()) {
			return;
		}

		// Set the name for the entities
		let name = this.baseName.getValue();
		if (name === null) {
			name = this.getName() + "_";
			name = name.split(".").join("_");
		}

		// Create the new entities
		const num = jint(this.entitiesPerArrival.getNextSample(this, EventManager.simSeconds()));
		for (let i=0; i<num; i++) {
			const proto = this.prototypeEntity.getNextEntity(this, simTime) as DisplayEntity;
			this.numberGenerated++;
			const entName = name + this.numberGenerated;
			const ent = InputAgent.getGeneratedClone(proto, entName) as DisplayEntity;
			ent.earlyInit();
			ent.lateInit();

			// Set the obj output to the assembled part
			this.receiveEntity(ent);
			this.setEntityState(ent);

			// Assign attributes
			this.assignAttributesAtStart(simTime);

			// Send the entity to the next element in the chain
			this.sendToNextComponent(ent);
		}
	}

	protected override getStepDuration(simTime: number): number {
		return this.presentIAT;
	}

	override isFinished(): boolean {
		return true;  // can always stop when isFinished is called in startStep
	}

	setPrototypeEntity(proto: DisplayEntity): void {
		const kw = KeywordIndex.formatArgs(this.prototypeEntity.getKeyword(), proto.getName());
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		try {
			const ent = this.prototypeEntity.getNextEntity(this, 0.0);
			if (ent !== null) {
				ret.push(ent);
			}
		}
		catch (e) {}
		return ret;
	}

	// Delete 'MatchValue' output
	// TODO(移植): Java では @Output なしの上書きで出力 MatchValue が消える。TS では null を返す出力として残る
	override getMatchValue(simTime?: number): string | null {
		return null;
	}

	getNumberGenerated(simTime: number): number {
		return this.numberGenerated;
	}

	getPresentIAT(simTime: number): number {
		return this.presentIAT;
	}

	getElapsedTime(simTime: number): number {
		return this.presentIAT - this.getRemainingDuration(simTime);
	}

}

EntityGen.register(EntityGenerator);

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityGenerator", EntityGenerator);

defineOutput(EntityGenerator, {
	name: "NumberGenerated",
	description: "The total number of entities generated, including the initialization period.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "int",
	get: (e, simTime) => e.getNumberGenerated(simTime),
});

defineOutput(EntityGenerator, {
	name: "PresentIAT",
	description: "The total working time required before the next entity is created.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getPresentIAT(simTime),
});

defineOutput(EntityGenerator, {
	name: "ElapsedTime",
	description: "The working time that has been completed towards the creation of the next "
	             + "entity.",
	unitType: TimeUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getElapsedTime(simTime),
});

// Java は @Output の付かない関数で上書きして、次の出力を消している
hideOutput(EntityGenerator, "MatchValue");
