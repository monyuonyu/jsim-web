// 注: Java の Class<T>（enum）は JEnumClass<T>（Input.ts）。
import type { Entity } from "../basicsim/Entity.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { enumConstants, enumName, Input } from "./Input.ts";
import type { JEnumClass } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class EnumListInput<T> extends ArrayListInput<T> {

	private readonly type: JEnumClass<T>;

	constructor(atype: JEnumClass<T>, key: string, cat: string, def: T[] | null) {
		super(key, cat, def);
		this.type = atype;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseEnumList(this.type, kw);
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		const tmp: string[] = [];
		for (const each of enumConstants(this.type))
			tmp.push(enumName(this.type, each));
		return tmp;
	}

}
