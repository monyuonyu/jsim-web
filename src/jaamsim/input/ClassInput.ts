import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { JClass } from "../java/lang.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class ClassInput extends Input<JClass<Entity>>{

	constructor(key: string, cat: string, def: JClass<Entity> | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.value = Input.parseClass(kw.getArg(0));
	}

	// 以下の 2 つは Java には無い。基底の toString・getDefaultString は値の toString() を使い、
	// Java の Class.toString() は "class com.jaamsim.…" になる（JS の関数の toString は源の文になってしまう）ので、同じ形にする。
	// TODO(移植): Java に無い上書き

	override toString(): string {
		return ClassInput.classToString(this.value);
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";
		return ClassInput.classToString(this.defValue);
	}

	/** Java の Class.toString() */
	private static classToString(k: JClass<Entity> | null): string {
		if (k === null)
			return "null";
		return "class " + ClassRegistry.javaName(k);
	}

}
