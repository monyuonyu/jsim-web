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

import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { jformat } from "../java/lang.ts";
import type { Command } from "./Command.ts";

export class DeleteCommand implements Command {

	private readonly entity: Entity;

	constructor(ent: Entity) {
		this.entity = ent;
	}

	execute(): void {
		this.entity.kill();
		this.entity.getJaamSimModel().setSessionEdited(true);
	}

	undo(): void {
		this.entity.restore();
		this.entity.getJaamSimModel().setSessionEdited(true);
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
		return jformat(tr("Delete: '%s'"), this.entity.getName());
	}

}
