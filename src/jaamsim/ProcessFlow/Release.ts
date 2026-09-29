/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleListInput } from "../Samples/SampleListInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { AbstractResourceProvider } from "../resourceObjects/AbstractResourceProvider.ts";
import { ResourceProvider } from "../resourceObjects/ResourceProvider.ts";
import { ResourceUserDelegate } from "../resourceObjects/ResourceUserDelegate.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { LinkedComponent } from "./LinkedComponent.ts";

export class Release extends LinkedComponent {

	private readonly resourceList: InterfaceEntityListInput<ResourceProvider>;

	private readonly numberOfUnitsList: SampleListInput;

	private resUserDelegate: ResourceUserDelegate | null = null;

	constructor() {
		super();
		this.resourceList = new InterfaceEntityListInput<ResourceProvider>(ResourceProvider, "ResourceList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.resourceList, "The Resources from which units are to be released.",
		         ["Resource1 Resource2"]);
		this.resourceList.setRequired(true);
		this.addInput( this.resourceList);
		this.addSynonym(this.resourceList, "Resource");

		this.numberOfUnitsList = SampleListInput.ofInt("NumberOfUnits", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfUnitsList, "The number of units to release from the Resources specified by the "
		                     + "'ResourceList' keyword. "
		                     + "The last value in the list is used if the number of resources is "
		                     + "greater than the number of values. "
		                     + "Only an integer number of resource units can be released. "
		                     + "A decimal value will be truncated to an integer.",
		         ["2 1", "{ 2 } { 1 }", "{ DiscreteDistribution1 } { 'this.obj.attrib1 + 1' }"]);
		this.numberOfUnitsList.setValidRange(0, Double.POSITIVE_INFINITY);
		this.numberOfUnitsList.setDimensionless(true);
		this.numberOfUnitsList.setUnitType(DimensionlessUnit);
		this.numberOfUnitsList.setIntegerValue(true);
		this.addInput(this.numberOfUnitsList);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.resUserDelegate = new ResourceUserDelegate(this.resourceList.getValue());
	}

	override addEntity( ent: DisplayEntity ): void {
		super.addEntity(ent);
		this.releaseResources(ent);
		this.sendToNextComponent( ent );
	}

	/**
	 * Release the specified Resources.
	 */
	releaseResources(ent: DisplayEntity): void {
		const simTime = EventManager.simSeconds();
		const resList = this.resourceList.getValue();

		// Release the Resources
		const nums = this.numberOfUnitsList.getNextIntegers(this, simTime, resList.length);
		this.resUserDelegate!.releaseResources(nums, ent);

		// Notify any resource users that are waiting for these Resources
		AbstractResourceProvider.notifyResourceUsers(resList);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Release", Release);
