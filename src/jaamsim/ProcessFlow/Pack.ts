/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { InterfaceEntityInput } from "../input/InterfaceEntityInput.ts";
import { StringInput } from "../input/StringInput.ts";
import { AbstractPack } from "./AbstractPack.ts";
import { EntContainer } from "./EntContainer.ts";

export class Pack extends AbstractPack {

	protected readonly prototypeEntityContainer: InterfaceEntityInput<EntContainer>;

	private readonly baseName: StringInput;

	private numberGenerated = 0;  // Number of EntityContainers generated so far

	constructor() {
		super();
		this.prototypeEntityContainer = new InterfaceEntityInput<EntContainer>(EntContainer, "PrototypeEntityContainer", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.prototypeEntityContainer, "The prototype for EntityContainers to be generated. "
		                     + "The generated EntityContainers will be copies of this entity.",
		         ["EntityContainer1"]);
		this.prototypeEntityContainer.setRequired(true);
		this.addInput(this.prototypeEntityContainer);

		this.baseName = new StringInput("BaseName", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.baseName, "The base for the names assigned to the generated EntityContainers. "
		                     + "The generated containers will be named Name1, Name2, etc.",
		         ["Container", "Box"]);
		this.baseName.setDefaultText("Pack Name");
		this.addInput(this.baseName);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.numberGenerated = 0;
	}

	protected override isContainerAvailable(): boolean {
		return true;
	}

	protected override getNextContainer(): EntContainer {
		this.numberGenerated++;

		// Set the name for the container
		let name = this.baseName.getValue();
		if (name === null) {
			name = this.getName() + "_";
			name = name.split(".").join("_");  // Java の String.replace（全部を置き換える）
		}
		name = name + this.numberGenerated;

		const proto = this.prototypeEntityContainer.getValue() as unknown as DisplayEntity;
		const ret = InputAgent.getGeneratedClone(proto, name) as DisplayEntity;
		ret.earlyInit();
		ret.lateInit();
		return ret as unknown as EntContainer;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Pack", Pack);
