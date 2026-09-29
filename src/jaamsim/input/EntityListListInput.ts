import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import type { JClass } from "../java/lang.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class EntityListListInput<T extends Entity> extends ArrayListInput<T[]> {
	private entClass: JClass<T>;
	private unique: boolean; // flag to determine if inner lists must be unique or not

	constructor(aClass: JClass<T>, key: string, cat: string, def: T[][] | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.unique = true;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const subArgs = kw.getSubArgs();
		// Check if number of outer lists violate minCount or maxCount
		if (subArgs.length < this.minCount || subArgs.length > this.maxCount)
			throw new InputErrorException(tr(Input.INP_ERR_RANGECOUNT), this.minCount, this.maxCount, kw.argString());

		this.value = Input.parseListOfEntityLists(thisEnt.getJaamSimModel(), kw, this.entClass, this.unique);
	}

	setUnique(unique: boolean): void {
		this.unique = unique;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		for (const each of this.defValue) {

			// blank space between elements
			if (tmp.length > 0)
				tmp += Input.SEPARATOR;

			if (each === null) {
				tmp += "";
				continue;
			}
			if (each.length === 0) {
				tmp += "";
				continue;
			}

			tmp += "{";
			tmp += Input.SEPARATOR;
			for (const ent of each) {
				tmp += ent.getName();
				tmp += Input.SEPARATOR;
			}
			tmp += "}";
		}
		return tmp;
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;

		let ret = false;
		for (const list of this.value) {
			// Java の list.removeAll(Collections.singleton(ent))
			let changed = false;
			for (let i = list.length - 1; i >= 0; i--) {
				if (list[i] === ent) {
					list.splice(i, 1);
					changed = true;
				}
			}
			ret = ret || changed;
		}
		return ret;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const entList of this.value) {
			for (const ent of entList) {
				if (ent === null || list.includes(ent))
					continue;
				list.push(ent);
			}
		}
	}

}
