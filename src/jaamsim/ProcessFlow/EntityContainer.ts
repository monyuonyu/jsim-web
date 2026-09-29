/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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

// 多重定義 getCount(String) と出力の getCount(double) は、getCount(m) の 1 つにした（出力は getCount(null) を呼ぶ）。
// updateGraphics は、中の物の位置・向き・表示の計算（状態）なので残した。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { StringProvInput } from "../StringProviders/StringProvInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { Input } from "../input/Input.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import { Quaternion } from "../math/Quaternion.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { StateEntity } from "../states/StateEntity.ts";
import type { StateRecord } from "../states/StateRecord.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { EntContainer } from "./EntContainer.ts";
import { EntContainerDelegate } from "./EntContainerDelegate.ts";
import { SimEntity } from "./SimEntity.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

export class EntityContainer extends SimEntity implements EntContainer {

	private readonly priority: SampleInput;

	private readonly match: StringProvInput;

	private readonly fifo: BooleanProvInput;

	private readonly setEntityState: BooleanProvInput;

	protected readonly positionOffset: Vec3dInput;

	private readonly spacingInput: SampleInput;

	protected readonly maxPerLineInput: SampleInput;

	protected readonly maxRows: SampleInput;

	protected readonly showEntities: BooleanProvInput;

	private readonly container: EntContainerDelegate;

	constructor() {
		super();
		this.priority = SampleInput.ofInt("Priority", Entity.KEY_INPUTS, 0);
		this.setKeywordDoc(this.priority, "The priority for positioning the received entity in the "
		                     + "EntityContainer. "
		                     + "Priority is integer valued and a lower numerical value indicates a "
		                     + "higher priority. "
		                     + "For example, priority 3 is higher than 4, and priorities 3, 3.2, and "
		                     + "3.8 are equivalent.",
		         ["this.obj.Attrib1"]);
		this.priority.setUnitType(DimensionlessUnit);
		this.priority.setIntegerValue(true);
		this.priority.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.priority);

		this.match = new StringProvInput("Match", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.match, "An expression returning a string value that categorizes the entities "
		                     + "in the EntityContainer. "
		                     + "The expression is evaluated and the value saved when the entity is "
		                     + "first loaded into the EntityContainer. "
		                     + "Expressions that return a dimensionless integer or an object are also "
		                     + "valid. The returned number or object is converted to a string "
		                     + "automatically. A floating point number is truncated to an integer.",
		         ["this.obj.Attrib1"]);
		this.match.setUnitType(DimensionlessUnit);
		this.addInput(this.match);

		this.fifo = new BooleanProvInput("FIFO", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.fifo, "Determines the order in which entities are placed in the "
		                     + "EntityContainer (FIFO or LIFO):\n"
		                     + "TRUE = first in first out (FIFO) order (the default setting),\n"
		                     + "FALSE = last in first out (LIFO) order.", []);
		this.addInput(this.fifo);

		this.setEntityState = new BooleanProvInput("SetEntityState", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.setEntityState, "If TRUE, the states for the entities contained by the EntityContainer "
		                     + "are set to the same state as the EntityContainer. "
		                     + "If FALSE, the entities retain their original state.", []);
		this.addInput(this.setEntityState);

		this.positionOffset = new Vec3dInput("PositionOffset", Entity.FORMAT, new Vec3d(0.0, 0.0, 0.01));
		this.setKeywordDoc(this.positionOffset, "The position of the first entity in the EntityContainer relative to "
		                     + "the EntityContainer.",
		         ["1.0 0.0 0.01 m"]);
		this.positionOffset.setUnitType(DistanceUnit);
		this.addInput(this.positionOffset);

		this.spacingInput = new SampleInput("Spacing", Entity.FORMAT, 0.0);
		this.setKeywordDoc(this.spacingInput, "The amount of graphical space shown between entities in the EntityContainer.",
		         ["1 m"]);
		this.spacingInput.setUnitType(DistanceUnit);
		this.addInput(this.spacingInput);

		this.maxPerLineInput = new SampleInput("MaxPerLine", Entity.FORMAT, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxPerLineInput, "The number of entities in each row inside the EntityContainer.",
		         ["4"]);
		this.maxPerLineInput.setValidRange( 1, Double.POSITIVE_INFINITY);
		this.maxPerLineInput.setIntegerValue(true);
		this.addInput(this.maxPerLineInput);

		this.maxRows = new SampleInput("MaxRows", Entity.FORMAT, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxRows, "The number of rows in each level of entities inside the EntityContainer.",
		         ["4"]);
		this.maxRows.setValidRange(1, Double.POSITIVE_INFINITY);
		this.maxRows.setIntegerValue(true);
		this.addInput(this.maxRows);

		this.showEntities = new BooleanProvInput("ShowEntities", Entity.FORMAT, true);
		this.setKeywordDoc(this.showEntities, "If TRUE, the entities in the EntityContainer are displayed.", []);
		this.addInput(this.showEntities);

		this.container = new EntContainerDelegate();
	}

	override earlyInit(): void {
		super.earlyInit();
		this.container.clear();
	}

	registerEntity(ent: DisplayEntity): void {
		this.container.registerEntity(ent);
	}

	addEntity(ent: DisplayEntity): void {
		const simTime = EventManager.simSeconds();

		// Register the entity so that the outputs are updated before the expressions for priority
		// and match value are evaluated
		this.registerEntity(ent);

		// Determine the priority and match value for the received entity
		const pri = jint(this.priority.getNextSample(this, simTime));

		let m: string | null = null;
		if (!this.match.isDefault())
			m = this.match.getNextString(this, simTime, 1.0, true);

		this.container.addEntity(ent, m, pri, this.isFIFO(simTime), simTime);
	}

	removeEntity(m: string | null): DisplayEntity | null {
		const ent = this.container.removeEntity(m)!;
		ent.setShow(true);
		return ent;
	}

	/** Java の getCount(String m) と、出力の getCount(double simTime)（= getCount(null)） */
	getCount(m: string | null): number {
		return this.container.getCount(m);
	}

	isEmpty(m: string | null): boolean {
		return this.container.isEmpty(m);
	}

	override stateChanged(prev: StateRecord, next: StateRecord): void {
		super.stateChanged(prev, next);

		const simTime = EventManager.simSeconds();
		if (!this.isSetEntityState(simTime))
			return;

		// Set the states for the entities carried by the EntityContainer to the new state
		const itr = this.container.iterator();
		while (itr.hasNext()) {
			const ent = itr.next();
			if (ent instanceof StateEntity)
				(ent as StateEntity).setPresentState(next.getName());
		}
	}

	override kill(): void {
		const itr = this.container.iterator();
		while (itr.hasNext()) {
			const ent = itr.next();
			ent.kill();
		}
		super.kill();
	}

	override dispose(): void {
		const itr = this.container.iterator();
		while (itr.hasNext()) {
			const ent = itr.next();
			ent.dispose();
		}
		this.container.clear();
		super.dispose();
	}

	override clearStatistics(): void {
		super.clearStatistics();
		this.container.clearStatistics();
	}

	/**
	 * Update the position of all entities in the queue. ASSUME that entities
	 * will line up according to the orientation of the queue.
	 */
	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		const visible = this.isShowEntities(simTime);
		const orientQ = new Quaternion();
		orientQ.setEuler3(this.getOrientation());
		const size = this.getSize();
		const tmp = new Vec3d();
		const maxPerLineVal = jint(this.maxPerLineInput.getNextSample(this, simTime));
		const maxRowsVal = jint(this.maxRows.getNextSample(this, simTime));

		// Copy the storage entries to avoid some concurrent modification exceptions
		let entityList: DisplayEntity[];
		try {
			entityList = this.container.getEntityList(null);
		}
		catch (e) {
			return;
		}

		// Find the maximum width and height of the entities
		let maxWidth = 0;
		let maxHeight = 0;
		for (const ent of entityList) {
			maxWidth = Math.max(maxWidth, ent.getGlobalSize().y);
			maxHeight = Math.max(maxHeight, ent.getGlobalSize().z);
		}

		// Update the position of each entity (start at the bottom left of the container)
		let distanceX = -0.5*size.x;
		const distanceY0 = -0.5*size.y + 0.5*maxWidth;
		let i = 0;
		for (const ent of entityList) {

			// Calculate the row and level number for the entity
			const ind = i % maxPerLineVal;
			const row = Math.trunc(i / maxPerLineVal) % maxRowsVal;
			const level = Math.trunc(Math.trunc(i / maxPerLineVal) / maxRowsVal);

			// Reset the x-position for the first entity in a row
			if( i > 0 && ind === 0 ){
				distanceX = -0.5*size.x;
			}

			// Set the region
			ent.setRegion(this.getCurrentRegion());

			// Rotate each entity about its center so it points to the right direction
			ent.setShow(visible);
			ent.setRelativeOrientation(orientQ);

			// Calculate the y- and z- coordinates
			const space = this.spacingInput.getNextSample(this, simTime);
			const distanceY = distanceY0 + row * (space + maxWidth);
			const distanceZ = level * (space + maxHeight);

			// Set Position
			const itemSize = ent.getGlobalSize();
			distanceX += 0.5*itemSize.x;
			tmp.set3(distanceX, distanceY, distanceZ);
			tmp.add3(this.positionOffset.getValue());
			const pos = this.getGlobalPositionForPosition(tmp);
			ent.setGlobalPositionForAlignment(pos, new Vec3d());

			// increment total distance
			distanceX += 0.5*itemSize.x + space;
			i++;
		}
	}

	isFIFO(simTime: number): boolean {
		return this.fifo.getNextBoolean(this, simTime);
	}

	isSetEntityState(simTime: number): boolean {
		return this.setEntityState.getNextBoolean(this, simTime);
	}

	isShowEntities(simTime: number): boolean {
		return this.showEntities.getNextBoolean(this, simTime);
	}

	getLastEntity(simTime: number): DisplayEntity | null {
		return this.container.getLastEntity();
	}

	getNumberAdded(simTime: number): number {
		return this.container.getTotalNumberAdded();
	}

	getNumberRemoved(simTime: number): number {
		return this.container.getTotalNumberProcessed();
	}

	getEntityList(simTime: number): DisplayEntity[] {
		return this.container.getEntityList(null);
	}

	getPriorityValues(simTime: number): number[] {
		return this.container.getPriorityList();
	}

	getMatchValues(simTime: number): string[] {
		return this.container.getTypeList();
	}

	getStorageTimes(simTime: number): number[] {
		return this.container.getStorageTimeList(simTime);
	}

	getMatchValueCount(simTime: number): number {
		return this.container.getEntityTypes().length;
	}

	getUniqueMatchValues(simTime: number): string[] {
		const ret: string[] = [...this.container.getEntityTypes()];
		ret.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return ret;
	}

	getMatchValueCountMap(simTime: number): Map<string, number> {
		const ret = new Map<string, number>();
		for (const m of this.getUniqueMatchValues(simTime)) {
			ret.set(m, this.getCount(m));
		}
		return ret;
	}

	getMatchValueMap(simTime: number): Map<string, DisplayEntity[]> {
		const ret = new Map<string, DisplayEntity[]>();
		for (const m of this.getUniqueMatchValues(simTime)) {
			ret.set(m, this.container.getEntityList(m));
		}
		return ret;
	}

}

EntContainer.register(EntityContainer);

defineOutput(EntityContainer, {
	name: "obj",
	description: "The entity that was loaded most recently.",
	sequence: 0,
	returnType: "Entity",
	get: (e, simTime) => e.getLastEntity(simTime),
});

defineOutput(EntityContainer, {
	name: "NumberAdded",
	description: "The number of entities loaded after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 1,
	returnType: "long",
	get: (e, simTime) => e.getNumberAdded(simTime),
});

defineOutput(EntityContainer, {
	name: "NumberRemoved",
	description: "The number of entities unloaded after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 2,
	returnType: "long",
	get: (e, simTime) => e.getNumberRemoved(simTime),
});

defineOutput(EntityContainer, {
	name: "Count",
	description: "The present number of entities in the EntityContainer.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getCount(null),
});

defineOutput(EntityContainer, {
	name: "EntityList",
	description: "The entities contained by the EntityContainer.",
	unitType: DimensionlessUnit,
	sequence: 4,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});

defineOutput(EntityContainer, {
	name: "PriorityValues",
	description: "The Priority expression value for each entity in the EntityContainer.",
	unitType: DimensionlessUnit,
	sequence: 5,
	returnType: "ArrayList",
	get: (e, simTime) => e.getPriorityValues(simTime),
});

defineOutput(EntityContainer, {
	name: "MatchValues",
	description: "The Match expression value for each entity in the EntityContainer.",
	unitType: DimensionlessUnit,
	sequence: 6,
	returnType: "ArrayList",
	get: (e, simTime) => e.getMatchValues(simTime),
});

defineOutput(EntityContainer, {
	name: "StorageTimes",
	description: "The elapsed time since each entity was placed in the EntityContainer.",
	unitType: TimeUnit,
	sequence: 7,
	returnType: "ArrayList",
	get: (e, simTime) => e.getStorageTimes(simTime),
});

defineOutput(EntityContainer, {
	name: "MatchValueCount",
	description: "The present number of unique Match values in the EntityContainer.",
	unitType: DimensionlessUnit,
	sequence: 8,
	returnType: "int",
	get: (e, simTime) => e.getMatchValueCount(simTime),
});

defineOutput(EntityContainer, {
	name: "UniqueMatchValues",
	description: "The list of unique Match values for the entities in the EntityContainer.",
	sequence: 9,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUniqueMatchValues(simTime),
});

defineOutput(EntityContainer, {
	name: "MatchValueCountMap",
	description: "The number of entities in the EntityContainer for each Match expression value.\n"
	             + "For example, '[EntityContainer1].MatchValueCountMap(\"SKU1\")' returns the "
	             + "number of entities whose Match value is \"SKU1\".",
	unitType: DimensionlessUnit,
	sequence: 10,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getMatchValueCountMap(simTime),
});

defineOutput(EntityContainer, {
	name: "MatchValueMap",
	description: "Provides a list of entities in the EntityContainer for each Match expression "
	             + "value.\n"
	             + "For example, '[EntityContainer1].MatchValueMap(\"SKU1\")' returns a list of "
	             + "entities whose Match value is \"SKU1\".",
	sequence: 11,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getMatchValueMap(simTime),
});

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityContainer", EntityContainer);
