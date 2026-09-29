//@@HEADER@@
import type { Entity } from "../basicsim/Entity.ts";

export class AbstractDirectedEntity<T extends Entity> {

	readonly entity: T;
	readonly direction: boolean;

	static readonly REVERSE = "(R)";

	/** Java の (ent) と (ent, dir) の 2 つのコンストラクタ（dir を省くと true） */
	constructor(ent: T, dir: boolean = true) {
		this.entity = ent;
		this.direction = dir;
	}

	getEntity(): T {
		return this.entity;
	}

	getDirection(): boolean {
		return this.direction;
	}

	toString(): string {
		let ret = this.entity.getName();
		if (!this.direction)
			ret = ret + AbstractDirectedEntity.REVERSE;
		return ret;
	}

	equals(obj: unknown): boolean {
		if (obj === null || obj === undefined) return false;
		if (obj === this) return true;
		if (!(obj instanceof AbstractDirectedEntity)) return false;
		const de = obj as AbstractDirectedEntity<Entity>;
		return de.entity === this.entity && de.direction === this.direction;
	}

}
