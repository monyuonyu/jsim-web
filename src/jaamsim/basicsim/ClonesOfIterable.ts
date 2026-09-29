import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";
import { EntityIterator } from "./EntityIterator.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

export class ClonesOfIterable<T extends Entity> extends EntityIterator<T> {
	constructor(simModel: JaamSimModel, aClass: JClass<T>) {
		super(simModel, aClass);
	}

	override matches(entklass: JClass | null, _ent: Entity): boolean {
		return jIsAssignableFrom(this.entClass, entklass);
	}
}
