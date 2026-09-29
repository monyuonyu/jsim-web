/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020-2026 JaamSim Software Inc.
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
import type { Command } from "./Command.ts";

export class ListCommand implements Command {

	private readonly list: Command[];

	private static readonly ELLIPSIS = "...";
	private static readonly MAX_LENGTH = 40;

	constructor(lst: Command[]) {
		this.list = lst;
	}

	execute(): void {
		for (const cmd of this.list) {
			cmd.execute();
		}
	}

	undo(): void {
		for (const cmd of this.list) {
			cmd.undo();
		}
	}

	tryMerge(cmd: Command): Command | null {
		if (!(cmd instanceof ListCommand)) {
			return null;
		}
		const arrayCmd = cmd;
		if (this.list.length !== arrayCmd.list.length)
			return null;

		const newList: Command[] = [];
		for (let i = 0; i < this.list.length; i++) {
			const mergedCmd = this.list[i].tryMerge(arrayCmd.list[i]);
			if (mergedCmd == null)
				return null;
			newList.push(mergedCmd);
		}
		return new ListCommand(newList);
	}

	isChange(): boolean {
		for (const cmd of this.list) {
			if (cmd.isChange())
				return true;
		}
		return false;
	}

	tryRepeat(ent: Entity | null): Command | null {
		if (ent == null)
			return null;
		const newList: Command[] = [];
		for (let i = 0; i < this.list.length; i++) {
			const cmd = this.list[i].tryRepeat(ent);
			if (cmd == null)
				return null;
			newList.push(cmd);
		}
		return new ListCommand(newList);
	}

	toString(): string {
		let sb = "";
		for (let i = 0; i < this.list.length; i++) {
			if (i > 0)
				sb += "; ";
			if (sb.length > ListCommand.MAX_LENGTH) {
				sb += ListCommand.ELLIPSIS;
				break;
			}
			sb += String(this.list[i]);
		}
		return sb;
	}

}
