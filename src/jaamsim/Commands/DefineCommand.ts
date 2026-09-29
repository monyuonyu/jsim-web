/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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

// 2 つのコンストラクタ DefineCommand(sim, cls, name)・(sim, cls, proto, name) は、引数の数で見分ける 1 つのコンストラクタにした。

import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { jformat } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import type { Command } from "./Command.ts";

export class DefineCommand implements Command {

	private readonly simModel: JaamSimModel;
	private readonly klass: JClass<Entity>;
	private readonly proto: Entity | null;
	private entity: Entity | null;
	private readonly entityName: string;

	constructor(sim: JaamSimModel, cls: JClass<Entity>, name: string);
	constructor(sim: JaamSimModel, cls: JClass<Entity>, pr: Entity | null, name: string);
	constructor(sim: JaamSimModel, cls: JClass<Entity>, a: Entity | null | string, b?: string) {
		this.simModel = sim;
		this.klass = cls;
		if (b === undefined) {
			this.proto = null;
			this.entityName = a as string;
		}
		else {
			this.proto = a as Entity | null;
			this.entityName = b;
		}
		this.entity = null;
	}

	execute(): void {

		// If the entity has been killed by the undo method, then simply restore it to life
		if (this.entity != null) {
			this.entity.restore();
			this.simModel.setSessionEdited(true);
			return;
		}

		// Create the entity
		if (this.simModel.getNamedEntity(this.entityName) != null) {
			throw new ErrorException(tr("Name is already in use. Should never happen."));
		}
		this.entity = InputAgent.defineEntityWithUniqueName(this.simModel, this.klass, this.proto, this.entityName, "", true);
		this.simModel.setSessionEdited(true);
	}

	undo(): void {
		this.entity!.kill();
		this.simModel.setSessionEdited(true);
	}

	tryMerge(_cmd: Command): Command | null {
		return null;
	}

	isChange(): boolean {
		return true;
	}

	tryRepeat(_ent: Entity | null): Command | null {
		return null;
	}

	toString(): string {
		return jformat(tr("Create: '%s'"), this.entityName);
	}

}
