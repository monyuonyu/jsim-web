/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Integer } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { AbstractUnpack } from "./AbstractUnpack.ts";
import type { EntContainer } from "./EntContainer.ts";

export class Unpack extends AbstractUnpack {

	constructor() {
		super();
	}

	protected override disposeContainer(c: EntContainer): void {
		(c as unknown as DisplayEntity).dispose();
	}

	protected override getNumberToRemove(): number {
		return Integer.MAX_VALUE;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Unpack", Unpack);
