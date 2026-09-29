// 注: Java の Class<T>（interface のことが多い）は JClass<T> | JInterface<T>（Input.ts）で受ける。
import { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { jIsAssignableFrom, jRemove } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { Input } from "./Input.ts";
import type { JInterface } from "./Input.ts";
import { interfacePredicate } from "./InterfaceEntityInput.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class InterfaceEntityListInput<T> extends ArrayListInput<T> {
	private entClass: JClass<T> | JInterface<T>;
	private unique: boolean; // flag to determine if list must be unique or not
	private even: boolean;  // flag to determine if there must be an even number of entries
	private includeSelf: boolean; // flag to determine whether to include the calling entity in the entityList
	private validClasses: JClass<Entity>[]; // list of valid classes (including subclasses).  if empty, then all classes are valid
	private invalidClasses: JClass<Entity>[]; // list of invalid classes (including subclasses).

	constructor(aClass: JClass<T> | JInterface<T>, key: string, cat: string, def: T[] | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.unique = true;
		this.even = false;
		this.includeSelf = true;
		this.validClasses = [];
		this.invalidClasses = [];
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		if( this.even )
			Input.assertCountEven(kw);

		this.value = Input.parseInterfaceEntityList(thisEnt.getJaamSimModel(), kw, this.entClass, this.unique);
	}

	setUnique(unique: boolean): void {
		this.unique = unique;
	}
	setEven(bool: boolean): void {
		this.even = bool;
	}

	setIncludeSelf(bool: boolean): void {
		this.includeSelf = bool;
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		for(const each of simModel.getClonesOfIterator(Entity, interfacePredicate(this.entClass)) ) {
			if(!each.isRegistered())
				continue;

			if (!this.isValidClass(each))
				continue;

			if (each.getEditableInputs().includes(this as Input<unknown>) && !this.includeSelf)
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		tmp += (this.defValue[0] as unknown as Entity).getName();
		for (let i = 1; i < this.defValue.length; i++) {
			tmp += Input.SEPARATOR;
			tmp += (this.defValue[i] as unknown as Entity).getName();
		}
		return tmp;
	}

	isValidClass(ent: Entity): boolean {
		for (const c of this.invalidClasses) {
			if (jIsAssignableFrom(c, ent.constructor as JClass)) {
				return false;
			}
		}

		if (this.validClasses.length === 0)
			return true;
		for (const c of this.validClasses) {
			if (jIsAssignableFrom(c, ent.constructor as JClass)) {
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

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		for (let i = 0; i < this.value.length; i++) {
			toks.push((this.value[i] as unknown as Entity).getName());
		}
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;
		// Java の value.removeAll(Collections.singleton(ent))（同じ配列の中から消す）
		let ret = false;
		for (let i = this.value.length - 1; i >= 0; i--) {
			if ((this.value[i] as unknown) === ent) {
				this.value.splice(i, 1);
				ret = true;
			}
		}
		return ret;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const ent of this.value) {
			if (ent === null || list.includes(ent as unknown as Entity))
				continue;
			list.push(ent as unknown as Entity);
		}
	}

	override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}

}
