/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2026 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Quaternion } from "../math/Quaternion.ts";
import { Transform } from "../math/Transform.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses } from "./LateClasses.ts";

export class Region extends DisplayEntity {

	protected readonly scaleInput: SampleInput;

	private scale = 1.0;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.addSynonym(this.positionInput, "Origin");

		this.desc.setHidden(true);

		this.scaleInput = new SampleInput("Scale", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.scaleInput, "The graphical scale for the Region's local coordinate system relative "
		                     + "to the coordinate system in which it is embedded. "
		                     + "For example, an input of 0.5 would make objects appear to be one-half "
		                     + "smaller and closer together.",
				["0.5"]);
		this.scaleInput.setUnitType(DimensionlessUnit);
		this.scaleInput.setCallback(Region.inputCallback);
		this.addInput(this.scaleInput);
	}

	override setInputsForDragAndDrop(): void {}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as Region).updateInputValue();
		},
	} as InputCallback;

	updateInputValue(): void {
		this.setScale(this.scaleInput.getNextSample(this, 0.0));
	}

	override resetGraphics(): void {
		super.resetGraphics();
		this.setScale(this.scaleInput.getNextSample(this, 0.0));
	}

	setScale(val: number): void {
		this.scale = val;
	}

	getScale(): number {
		return this.scale;
	}

	getGlobalScale(): number {
		let ret = this.getScale();
		if (this.getCurrentRegion() !== null)
			ret *= this.getCurrentRegion()!.getGlobalScale();
		return ret;
	}

	getGlobalRotation(): Quaternion {
		const ret = new Quaternion();
		ret.setEuler3(this.getOrientation());
		if (this.getCurrentRegion() === null)
			return ret;
		ret.mult(ret, this.getCurrentRegion()!.getGlobalRotation());
		return ret;
	}

	getInternalSize(): Vec3d {
		const ret = this.getSize();
		ret.scale3(1.0/this.getScale());
		return ret;
	}

	/**
	 * Sets the scale factor and internal dimensions for the region.
	 * @param scale - ratio between external and internal coordinates
	 * @param internalSize - size of the region measured in its internal coordinate system
	 */
	setScaleAndSize(scale: number, internalSize: Vec3d): void {
		this.setScale(scale);
		const size = new Vec3d(internalSize);
		size.scale3(scale);
		this.setSize(size);
	}

	/**
	 * Return the transformation that converts the local coordinates for a
	 * point to global coordinates.
	 * @return transformation to global coordinates
	 */
	getRegionTrans(): Transform {
		return new Transform(this.getGlobalPosition(), this.getGlobalRotation(), this.getGlobalScale());
	}

	/**
	 * Return the transformation that converts the local coordinates for a
	 * vector to global coordinates.
	 * @return transformation to global coordinates
	 */
	getRegionTransForVectors(): Transform {
		return new Transform(null, this.getGlobalRotation(), this.getGlobalScale());
	}

	/**
	 * Return the transformation that converts the global coordinates for a
	 * point to local coordinates for the region.
	 * @return transformation to global coordinates
	 */
	getInverseRegionTrans(): Transform {
		const trans = new Transform();
		this.getRegionTrans().inverse(trans);
		return trans;
	}

	/**
	 * Return the transformation that converts the global coordinates for a
	 * vector to local coordinates for the region.
	 * @return transformation to global coordinates
	 */
	getInverseRegionTransForVectors(): Transform {
		const trans = new Transform();
		this.getRegionTransForVectors().inverse(trans);
		return trans;
	}

	override canLabel(): boolean {
		return false;
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Region", Region);
LateClasses.bind("com.jaamsim.Graphics.Region", Region);
