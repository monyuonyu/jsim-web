/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jIsAssignableFrom, jRemove } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class EntityListInput<T extends Entity> extends ArrayListInput<T> {
	private entClass: JClass<T>;
	private unique: boolean; // flag to determine if list must be unique or not
	private even: boolean;  // flag to determine if there must be an even number of entries
	private includeSubclasses: boolean;  // flag to determine if subclasses are valid
	private includeSelf: boolean; // flag to determine whether to include the calling entity in the entityList
	private validClasses: JClass<Entity>[]; // list of valid classes (including subclasses).  if empty, then all classes are valid
	private invalidClasses: JClass<Entity>[]; // list of invalid classes (including subclasses).

	constructor(aClass: JClass<T>, key: string, cat: string, def: T[] | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.unique = true;
		this.even = false;
		this.includeSubclasses = true;
		this.includeSelf = true;
		this.validClasses = [];
		this.invalidClasses = [];
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {

		// If adding to the list
		if( kw.getArg( 0 ) === "++" ) {
			const subKw = new KeywordIndex(kw, 1);

			let newValue: T[];
			if( this.value === null )
				newValue = [];
			else
				newValue = [...this.value];

			Input.assertCountRange(subKw, 0, this.maxCount - newValue.length);
			if( this.even ) {
				if ((kw.numArgs() % 2) === 0)
					throw new InputErrorException(tr(Input.INP_ERR_EVENCOUNT), kw.argString());
			}

			const addedValues = Input.parseEntityList(thisEnt.getJaamSimModel(), subKw, this.entClass, this.unique);
			for( const val of addedValues ) {
				if( this.unique && newValue.includes( val ) )
					throw new InputErrorException(tr(Input.INP_ERR_NOTUNIQUE), val.getName());
				newValue.push( val );
			}
			this.value = newValue;
			return;
		}

		// If removing from the list
		if( kw.getArg( 0 ) === "--" ) {
			const subKw = new KeywordIndex(kw, 1);

			// Java では value が null なら NullPointerException（ここでも TypeError になる）
			const value = this.value as T[];
			Input.assertCountRange(subKw, 0, value.length - this.minCount );
			if( this.even ) {
				if ((kw.numArgs() % 2) === 0)
					throw new InputErrorException(tr(Input.INP_ERR_EVENCOUNT), kw.argString());
			}

			const newValue = [...value];
			const removedValues = Input.parseEntityList(thisEnt.getJaamSimModel(), subKw, this.entClass, this.unique);
			for( const val of removedValues ) {
				if( ! newValue.includes( val ) )
					thisEnt.getJaamSimModel().logWarning("Could not remove " + String(val) + " from " + this.getKeyword() );
				jRemove(newValue, val);
			}
			this.value = newValue;
			return;
		}

		// Otherwise, just set the list normally
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		if( this.even )
			Input.assertCountEven(kw);

		this.value = Input.parseEntityList(thisEnt.getJaamSimModel(), kw, this.entClass, this.unique);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ENTITY_LIST);
	}

	override getExamples(): string[] {
		let name = ClassRegistry.simpleName(this.entClass);
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			name = "Entity";
		}
		return [name+"1 "+name+"2"];
	}

	setUnique(unique: boolean): void {
		this.unique = unique;
	}
	setEven(bool: boolean): void {
		this.even = bool;
	}
	setIncludeSubclasses(bool: boolean): void {
		this.includeSubclasses = bool;
	}

	setIncludeSelf(bool: boolean): void {
		this.includeSelf = bool;
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		for(const each of ent.getJaamSimModel().getClonesOfIterator(this.entClass) ) {
			if(!each.isRegistered())
				continue;

			if( ! this.isValidClass( each ))
				continue;

			if(! this.includeSubclasses) {
				if( each.constructor !== this.entClass ) {
					continue;
				}
			}

			if(each.getEditableInputs().includes( this as Input<unknown> ) && ! this.includeSelf ) {
				continue;
			}

			list.push(each.getName());
		}

		// Include the default values
		const defVal = this.getDefaultValue();
		if (defVal !== null) {
			for (const def of defVal) {
				const name = def.getName();
				if (list.includes(name))
					continue;
				list.push(name);
			}
		}

		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		for (let i = 0; i < this.value.length; i++)
			toks.push(this.value[i].getName());
	}

	override setTokens(kw: KeywordIndex): void {
		this.isDef = false;

		const args = kw.getArgArray();
		if (args.length > 0) {

			// Consider the following input case:
			// Object1 Keyword1 { ++ Entity1 ...
			if (args[0] === "++") {
				this.addTokens(args);
				return;
			}

			// Consider the following input case:
			// Object1 Keyword1 { -- Entity1 ...
			if (args[0] === "--") {
				if (this.removeTokens(args))
					return;
			}
		}

		this.valueTokens = args;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		tmp += this.defValue[0].getName();
		for (let i = 1; i < this.defValue.length; i++) {
			tmp += Input.SEPARATOR;
			tmp += this.defValue[i].getName();
		}
		return tmp;
	}

	isValidClass( ent: Entity ): boolean {

		for (const c of this.invalidClasses) {
			if (jIsAssignableFrom( c, ent.constructor as JClass )) {
				return false;
			}
		}

		if( this.validClasses.length === 0 )
			return true;

		for( const c of this.validClasses ) {
			if( jIsAssignableFrom( c, ent.constructor as JClass ) ) {
				return true;
			}
		}

		return false;
	}

	addValidClass(aClass: JClass<Entity>): void {
		jRemove(this.invalidClasses, aClass);
		this.validClasses.push(aClass);
	}

	addInvalidClass(aClass: JClass<Entity>): void {
		jRemove(this.validClasses, aClass);
		this.invalidClasses.push(aClass);
	}

	clearValidClasses(): void {
		this.validClasses.length = 0;
		this.invalidClasses.length = 0;
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;
		// Java の value.removeAll(Collections.singleton(ent))（同じ配列の中から消す）
		return removeAll(this.value, ent);
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const ent of this.value) {
			if (ent === null || list.includes(ent))
				continue;
			list.push(ent);
		}
	}

	override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}

}

/** Java の list.removeAll(Collections.singleton(o))。消した物があれば true */
function removeAll<E>(list: E[], o: unknown): boolean {
	let changed = false;
	for (let i = list.length - 1; i >= 0; i--) {
		if (list[i] === o) {
			list.splice(i, 1);
			changed = true;
		}
	}
	return changed;
}
