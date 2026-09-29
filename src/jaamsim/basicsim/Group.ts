/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2022 JaamSim Software Inc.
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
import { tr } from "../i18n/I18n.ts";
import { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { StringInput } from "../input/StringInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Entity } from "./Entity.ts";

/**
 * Group class - for storing a list of objects
 *
 * For input of the form <object> <keyword> <value>:
 * If the group appears as the object in a line of input, then the keyword and value applies to each member of the group.
 * If the group appears as the value in a line of input, then the list of objects is used as the value.
 *
 * 入れ子のクラス Group.GroupListInput・GroupAppendListInput・GroupTypeInput は、
 * 同じファイルの Group_GroupListInput などにした（外側の Group を group で持つ）。
 */
export class Group extends Entity {
	type: JClass | null;
	readonly groupKeywordValues: KeywordIndex[];

	readonly list: Entity[]; // list of objects in group

	protected readonly groupDescription: StringInput;

	private readonly groupListInput: Group_GroupListInput;

	private readonly groupAppendListInput: Group_GroupAppendListInput;

	private readonly groupTypeInput: Group_GroupTypeInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		// Remove all the inputs inherited from Entity
		this.clearInputs();

		this.groupDescription = new StringInput("GroupDescription", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.groupDescription, "A free-form string describing the Group.",
				["'A very useful group'"]);
		this.addInput(this.groupDescription);

		this.groupListInput = new Group_GroupListInput(this);
		this.setKeywordDoc(this.groupListInput, "The list of objects included in the group.",
				["DisplayEntity1 DisplayEntity2"]);
		this.addInput(this.groupListInput);

		this.groupAppendListInput = new Group_GroupAppendListInput(this);
		this.setKeywordDoc(this.groupAppendListInput, "A list of additional objects to be included in " +
				"the already existing list of group objects.  The added " +
				"objects will inherit all inputs previously set for the group.",
				["DisplayEntity3 DisplayEntity4"]);
		this.addInput(this.groupAppendListInput);

		this.groupTypeInput = new Group_GroupTypeInput(this);
		this.setKeywordDoc(this.groupTypeInput, "The object type for the group.",
				["DisplayEntity"]);
		this.addInput(this.groupTypeInput);

		// ---- Java のコンストラクタ ----
		this.list = [];
		this.type = null;
		this.groupKeywordValues = [];
	}

	override getDescription(): string {
		return this.groupDescription.getValue() as string;
	}

	saveGroupKeyword(kw: KeywordIndex): void {
		const toks: string[] = [];
		for (let i = 0; i < kw.numArgs(); i++)
			toks.push(kw.getArg(i));

		const saved = new KeywordIndex(kw.keyword, toks, kw.context);
		this.groupKeywordValues.push(saved);

		// If there can never be elements in the group, throw a warning
		if( this.type == null && this.list.length === 0 ) {
			this.getJaamSimModel().logWarning("The group %s has no elements to apply keyword: %s", String(this), kw.keyword);
		}
	}

	checkType(): void {
		if (this.type == null)
			return;

		for (const each of this.getList()) {
			if (!(each instanceof (this.type as unknown as new () => object)))
				throw new InputErrorException(tr("The Entity: %s is not of Type: %s"), String(each), ClassRegistry.simpleName(this.type));
		}
	}

	getList(): Entity[] {
		return this.list;
	}

	getMembers(_simTime: number): Entity[] {
		return this.list;
	}

	getGroupKeywordValues(_simTime: number): string {
		let sb = "";
		let first = true;
		for (const key of this.groupKeywordValues) {
			if (first)
				first = false;
			else
				sb += ", ";

			sb += key.keyword;
			sb += " { " + key.argString() + " }";
		}
		return sb;
	}
}

class Group_GroupListInput extends Input<string> {
	private readonly group: Group;

	constructor(group: Group) {
		super("List", Entity.KEY_INPUTS, null);
		this.group = group;
	}

	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const g = this.group;
		// If adding to the list
		if( kw.getArg( 0 ) === "++" ) {
			const subKw = new KeywordIndex(kw, 1);

			const addedValues = Input.parseEntityList(thisEnt.getJaamSimModel(), subKw, Entity, true);
			for( const ent of addedValues ) {
				if( g.list.includes( ent ) )
					throw new InputErrorException(tr(Input.INP_ERR_NOTUNIQUE), ent.getName());
				g.list.push( ent );

				// set values of appended objects to the group values
				if ( g.type != null ) {
					for ( let j = 0; j < g.groupKeywordValues.length; j++  ) {
						const grpkw = g.groupKeywordValues[j];
						InputAgent.apply(ent, grpkw);
					}
				}
			}
		}
		// If removing from the list
		else if( kw.getArg( 0 ) === "--" ) {
			const subKw = new KeywordIndex(kw, 1);

			const removedValues = Input.parseEntityList(thisEnt.getJaamSimModel(), subKw, Entity, true);
			for( const ent of removedValues ) {
				if( ! g.list.includes( ent ) )
					thisEnt.getJaamSimModel().logWarning("Could not remove " + String(ent) + " from " + this.getKeyword());
				const i = g.list.indexOf(ent);
				if (i >= 0)
					g.list.splice(i, 1);
			}
		}
		// Otherwise, just set the list normally
		else {
			const temp = Input.parseEntityList(thisEnt.getJaamSimModel(), kw, Entity, true);
			g.list.length = 0;
			g.list.push(...temp);
		}
		g.checkType();
	}

	override setTokens(kw: KeywordIndex): void {
		this.isDef = false;

		const args = kw.getArgArray();
		if (args.length > 0) {

			// Consider the following input case:
			// Group1 List { ++ Entity1 ...
			if (args[0] === "++") {

				this.addTokens(args);
				return;
			}

			// Consider the following input case:
			// Group1 List { -- Entity1 ...
			if (args[0] === "--") {
				if (this.removeTokens(args))
					return;
			}
		}

		this.valueTokens = args;
	}
}

class Group_GroupAppendListInput extends Input<string> {
	private readonly group: Group;

	constructor(group: Group) {
		super("AppendList", Entity.KEY_INPUTS, null);
		this.group = group;
	}

	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const g = this.group;
		const originalListSize = g.list.length;
		const temp = Input.parseEntityList(thisEnt.getJaamSimModel(), kw, Entity, true);
		for (const each of temp) {
			if (!g.list.includes(each))
				g.list.push(each);
		}
		g.checkType();
		// set values of appended objects to the group values
		if ( g.type != null ) {
			for ( let i = originalListSize; i < g.list.length; i ++ ) {
				const ent = g.list[ i ];
				for ( let j = 0; j < g.groupKeywordValues.length; j++  ) {
					const grpkw = g.groupKeywordValues[j];
					InputAgent.apply(ent, grpkw);
				}
			}
		}
	}
}

class Group_GroupTypeInput extends Input<string> {
	private readonly group: Group;

	constructor(group: Group) {
		super("GroupType", Entity.KEY_INPUTS, null);
		this.group = group;
	}

	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.group.type = Input.parseEntityType(thisEnt.getJaamSimModel(), kw.getArg(0));
		this.group.checkType();
	}
}

defineOutput(Group, {
	name: "Members",
	description: "Members of the Group.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getMembers(simTime),
});

defineOutput(Group, {
	name: "InputValues",
	description: "Inputs that have been set for the Group.",
	unitType: DimensionlessUnit,
	sequence: 2,
	returnType: "String",
	get: (e, simTime) => e.getGroupKeywordValues(simTime),
});

ClassRegistry.register("com.jaamsim.basicsim.Group", Group);
