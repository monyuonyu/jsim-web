import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";
import { EntityIterator } from "./EntityIterator.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

/**
 * Java では interface の Class を受けるが、TS の interface は実行時に無いので、
 * 実体を調べる判定の関数（例: isRandomStreamUser）を受ける。
 */
export class ClonesOfIterableInterface<T extends Entity> extends EntityIterator<T> {
	private readonly ifaceClass: (o: unknown) => boolean;
	constructor(simModel: JaamSimModel, aClass: JClass<T>, iface: (o: unknown) => boolean) {
		super(simModel, aClass);
		this.ifaceClass = iface;
	}

	override matches(entklass: JClass | null, ent: Entity): boolean {
		return jIsAssignableFrom(this.entClass, entklass) && this.ifaceClass(ent);
	}
}
