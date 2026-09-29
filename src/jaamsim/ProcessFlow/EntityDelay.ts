/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2024 JaamSim Software Inc.
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

// 入れ子のクラス EntityDelayEntry・RemoveDisplayEntityTarget は、このファイルの EntityDelay_EntityDelayEntry・
// EntityDelay_RemoveDisplayEntityTarget にした。
// LinkedHashMap<Long, EntityDelayEntry> は Map（入れた順）にした。
// setPresentState() は StateEntity の setPresentState(String) と 1 つにした（引数が無ければ状態を計算する）。
// updateGraphics は、線の上を動く物の位置・向きの計算（状態）なので残した。

import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { PolylineModel } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { LineEntity } from "../internal.ts";
import { PolylineInfo } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { CompoundEntity } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { TimeUnit } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端の値） */
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
 * Moves one or more Entities along a path with a specified travel time. Entities can have different travel times, which
 * are represented as varying speeds.
 */
export class EntityDelay extends LinkedComponent implements LineEntity {

	private readonly duration: SampleInput;

	private readonly allowOvertaking: BooleanProvInput;

	private readonly minSeparation: SampleInput;

	private readonly animation: BooleanProvInput;

	private readonly rotateEntities: BooleanProvInput;

	private readonly widthInput: SampleInput;

	private readonly colorInput: ColourProvInput;

	private exitTicks = 0;  // ticks at which the previous entity will leave the path
	private readonly entityMap = new Map<number, EntityDelay_EntityDelayEntry>();  // Entities being handled

	constructor() {
		super();
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.stateGraphics.setHidden(false);

		this.duration = new SampleInput("Duration", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.duration, "The delay time for the path.",
		         [ "3.0 h", "NormalDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'" ]);
		this.duration.setUnitType(TimeUnit);
		this.duration.setValidRange(0, Double.POSITIVE_INFINITY);
		this.duration.setRequired(true);
		this.addInput(this.duration);

		this.allowOvertaking = new BooleanProvInput("AllowOvertaking", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.allowOvertaking, "If TRUE, an entity can pass a second entity that started ahead of it. "
		                     + "If FALSE, the entity's duration is increased sufficiently for it to "
		                     + "arrive no earlier than the previous entity.", []);
		this.addInput(this.allowOvertaking);

		this.minSeparation = new SampleInput("MinSeparation", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.minSeparation, "The minimum time between the previous entity leaving the path and "
		                     + "the present entity leaving the path. "
		                     + "Applicable only when AllowOvertaking is FALSE.",
		         [ "3.0 h", "NormalDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'" ]);
		this.minSeparation.setUnitType(TimeUnit);
		this.minSeparation.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.minSeparation);

		this.animation = new BooleanProvInput("Animation", Entity.FORMAT, true);
		this.setKeywordDoc(this.animation, "If TRUE, an entity is moved along the specified path to "
		                     + "indicate its progression through the delay activity.", []);
		this.animation.setCallback(EntityDelay.inputCallback);
		this.addInput(this.animation);

		this.rotateEntities = new BooleanProvInput("RotateEntities", Entity.FORMAT, false);
		this.setKeywordDoc(this.rotateEntities, "If TRUE, the entities are rotated to match the direction of "
		                     + "the path.", []);
		this.addInput(this.rotateEntities);

		this.widthInput = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.widthInput, "The width in pixels of the line representing the EntityDelay.",
		         ["1"]);
		this.widthInput.setValidRange(1, Double.POSITIVE_INFINITY);
		this.widthInput.setIntegerValue(true);
		this.widthInput.setDefaultText("PolylineModel");
		this.addInput(this.widthInput);
		this.addSynonym(this.widthInput, "Width");

		this.colorInput = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.colorInput, "The colour of the line representing the EntityDelay.", []);
		this.colorInput.setDefaultText("PolylineModel");
		this.addInput(this.colorInput);
		this.addSynonym(this.colorInput, "Colour");
		this.addSynonym(this.colorInput, "Color");
	}

	static override readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as EntityDelay).updateAnimationValue();
		},
	} as InputCallback;

	updateAnimationValue(): void {
		if (!this.isAnimation(0.0))
			this.entityMap.clear();
	}

	override earlyInit(): void {
		super.earlyInit();
		this.exitTicks = -1;
		this.entityMap.clear();
	}

	override getInitialState(): string {
		return "Idle";
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);

		// Select the delay time for this entity
		const simTime = EventManager.simSeconds();
		let dur = this.duration.getNextSample(this, simTime);
		let durTicks = EventManager.current().secondsToNearestTick(dur);

		// Adjust the duration for the previous entity's exit time
		if (!this.isAllowOvertaking(simTime)) {
			const sep = this.minSeparation.getNextSample(this, simTime);
			const sepTicks = EventManager.current().secondsToNearestTick(sep);
			const simTicks = EventManager.simTicks();
			durTicks = Math.max(durTicks, this.exitTicks - simTicks + sepTicks);
			this.exitTicks = simTicks + durTicks;
		}

		// Add the entity to the list of entities being delayed
		if (this.isAnimation(simTime)) {
			dur = EventManager.current().ticksToSeconds(durTicks);
			const entry = new EntityDelay_EntityDelayEntry(ent, simTime, dur);
			this.entityMap.set(ent.getEntityNumber(), entry);
		}

		const target = new EntityDelay_RemoveDisplayEntityTarget(this, ent);
		EventManager.scheduleTicks(durTicks, Entity.PRI_NORMAL, Entity.EVT_FIFO, target, null);

		// Set the present state to Working
		this.setPresentState();
	}

	removeDisplayEntity(ent: DisplayEntity): void {

		// Remove the entity from the lists
		const simTime = EventManager.simSeconds();
		if (this.isAnimation(simTime))
			this.entityMap.delete(ent.getEntityNumber());

		// Send the entity to the next component
		this.sendToNextComponent(ent);
		this.setPresentState();

		// Notify any observers
		this.notifyObservers();
	}

	/**
	 * 引数があれば StateEntity の setPresentState(String)。無ければ Java の EntityDelay.setPresentState()。
	 */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}
		if (this.getNumberInProgress() > 0) {
			this.setPresentState("Working");
		}
		else {
			this.setPresentState("Idle");
		}
	}

	isOutlined(simTime: number): boolean {
		return true;
	}

	getLineWidth(simTime: number): number {
		if (this.widthInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return jint(this.widthInput.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.colorInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.colorInput.getNextColour(this, simTime);
	}

	isAllowOvertaking(simTime: number): boolean {
		return this.allowOvertaking.getNextBoolean(this, simTime);
	}

	isAnimation(simTime: number): boolean {
		return this.animation.getNextBoolean(this, simTime);
	}

	isRotateEntities(simTime: number): boolean {
		return this.rotateEntities.getNextBoolean(this, simTime);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (!this.usePointsInput())
			return;

		// Copy the list to avoid concurrent modification exceptions
		const copiedList = [...this.entityMap.values()];

		// If the EntityDelay is not visible show the entities at the sub-model's process position
		if (!this.getShow() && this.getVisibleParent() instanceof CompoundEntity) {
			const ce = this.getVisibleParent() as CompoundEntity;
			for (const entry of copiedList) {
				entry.ent.moveToProcessPosition(ce, ce.getProcessPosition());
			}
			return;
		}

		// Loop through the entities on the path
		for (const entry of copiedList) {
			// Calculate the distance travelled by this entity
			const frac = ( simTime - entry.startTime ) / entry.duration;

			// Set the region for the entity
			entry.ent.setRegion(this.getCurrentRegion());

			// Set the position for the entity
			const localPos = PolylineInfo.getPositionOnPolyline(this.getCurvePoints(), frac);
			entry.ent.setGlobalPosition(this.getGlobalPosition(localPos));

			// Set the orientation for the entity
			if (this.isRotateEntities(simTime)) {
				const orient = PolylineInfo.getOrientationOnPolyline(this.getCurvePoints(), frac);
				entry.ent.setRelativeOrientation(orient);
			}
		}
	}

	getEntityList(simTime: number): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		for (const entry of this.entityMap.values()) {
			ret.push(entry.ent);
		}
		return ret;
	}

}

class EntityDelay_EntityDelayEntry {
	readonly ent: DisplayEntity;
	readonly startTime: number;
	readonly duration: number;

	constructor(e: DisplayEntity, start: number, dur: number) {
		this.ent = e;
		this.startTime = start;
		this.duration = dur;
	}
}

class EntityDelay_RemoveDisplayEntityTarget extends EntityTarget<EntityDelay> {
	private readonly delayedEnt: DisplayEntity;

	constructor(d: EntityDelay, e: DisplayEntity) {
		super(d, "removeDisplayEntity");
		this.delayedEnt = e;
	}

	override process(): void {
		this.ent.removeDisplayEntity(this.delayedEnt);
	}
}

defineOutput(EntityDelay, {
	name: "EntityList",
	description: "The entities being processed at present.",
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityDelay", EntityDelay);
