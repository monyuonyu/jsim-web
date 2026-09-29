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

// 3 つのコンストラクタ KeywordCommand(Entity, KeywordIndex...)・(Entity, int, KeywordIndex...)・
// (Entity, int, KeywordIndex[], KeywordIndex[]) は、1 つのコンストラクタで引数の形から見分ける（名前は変えていない）。

import type { Entity } from "../basicsim/Entity.ts";
import { InputAgent } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import type { Command } from "./Command.ts";

export class KeywordCommand implements Command {

	private readonly entity: Entity;
	private readonly entityName: string;
	private readonly oldKws: KeywordIndex[];
	protected readonly newKws: KeywordIndex[];
	private readonly index: number;

	constructor(ent: Entity, ...kws: KeywordIndex[]);
	constructor(ent: Entity, kws: KeywordIndex[]);
	constructor(ent: Entity, ind: number, ...kws: KeywordIndex[]);
	constructor(ent: Entity, ind: number, kws0: KeywordIndex[], kws1: KeywordIndex[]);
	constructor(ent: Entity, ...args: (number | KeywordIndex | KeywordIndex[])[]) {
		let ind = 0;
		let rest = args;
		if (typeof rest[0] === "number") {
			ind = rest[0];
			rest = rest.slice(1);
		}
		let kws0: KeywordIndex[];
		let kws1: KeywordIndex[];
		if (rest.length === 2 && Array.isArray(rest[0]) && Array.isArray(rest[1])) {
			kws0 = rest[0];
			kws1 = rest[1];
		}
		else {
			// Java の可変長引数に配列そのものを渡す形（new KeywordCommand(ent, kwArray)）も受ける
			if (rest.length === 1 && Array.isArray(rest[0]))
				kws1 = rest[0];
			else
				kws1 = rest as KeywordIndex[];
			kws0 = KeywordCommand.getPresentKws(ent, kws1);
		}
		this.entity = ent;
		this.entityName = ent.getName();
		this.oldKws = kws0;
		this.newKws = kws1;
		this.index = ind;
	}

	private static getPresentKws(ent: Entity, kws: KeywordIndex[]): KeywordIndex[] {
		const ret: KeywordIndex[] = new Array<KeywordIndex>(kws.length);
		for (let i = 0; i < kws.length; i++) {
			const key = kws[i].keyword;
			const inp = ent.getInput(key)!;
			ret[i] = new KeywordIndex(key, inp.getValueTokenList(), null);
		}
		return ret;
	}

	private static applyKeywords(ent: Entity, kws: KeywordIndex[]): void {
		for (let i = 0; i < kws.length; i++) {
			InputAgent.processKeyword(ent, kws[i]);
		}

		// If necessary, set sessionEdited
		let bool = false;
		for (let i = 0; i < kws.length; i++) {
			const inp = ent.getInput(kws[i].keyword)!;
			bool = bool || inp.isPromptReqd();
		}
		if (bool)
			ent.getJaamSimModel().setSessionEdited(true);
	}

	getEntity(): Entity {
		return this.entity;
	}

	getKws(): KeywordIndex[] {
		return this.newKws;
	}

	execute(): void {
		KeywordCommand.applyKeywords(this.entity, this.newKws);
	}

	undo(): void {
		KeywordCommand.applyKeywords(this.entity, this.oldKws);
	}

	tryMerge(cmd: Command): Command | null {
		if (!(cmd instanceof KeywordCommand)) {
			return null;
		}
		const kwCmd = cmd;
		if (this.entity !== kwCmd.entity || this.index !== kwCmd.index
				|| this.newKws.length !== kwCmd.newKws.length) {
			return null;
		}
		for (let i = 0; i < this.newKws.length; i++) {
			if (this.newKws[i].keyword !== kwCmd.newKws[i].keyword)
				return null;
		}

		return new KeywordCommand(this.entity, this.index, this.oldKws, kwCmd.newKws);
	}

	isChange(): boolean {
		// Java の !Arrays.equals(newKws, oldKws)
		if (this.newKws.length !== this.oldKws.length)
			return true;
		for (let i = 0; i < this.newKws.length; i++) {
			if (!this.newKws[i].equals(this.oldKws[i]))
				return true;
		}
		return false;
	}

	tryRepeat(ent: Entity | null): Command | null {
		if (ent == null || ent === this.entity || this.index !== 0)
			return null;
		for (const kw of this.newKws) {
			const inp = ent.getInput(kw.keyword);
			if (inp == null || inp.getHidden() || inp.isLocked()) {
				return null;
			}
		}
		return new KeywordCommand(ent, ...this.newKws);
	}

	toString(): string {
		let sb = this.entityName;
		if (this.newKws.length === 1)
			sb += " keyword: ";
		else
			sb += " keywords: ";

		for (let i = 0; i < this.newKws.length; i++) {
			if (i > 0)
				sb += ", ";
			sb += this.newKws[i].keyword;
		}
		return sb;
	}

}
