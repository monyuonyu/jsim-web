/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import { BooleanInput } from "../input/BooleanInput.ts";
import type { BooleanProvider } from "./BooleanProvider.ts";

export class BooleanProvConstant implements BooleanProvider {

	private readonly val: boolean;

	constructor(bool: boolean) {
		this.val = bool;
	}

	public getNextBoolean(thisEnt: Entity, simTime: number): boolean {
		return this.val;
	}

	public toString(): string {
		return this.val ? BooleanInput.TRUE : BooleanInput.FALSE;
	}

}
