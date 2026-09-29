//@@HEADER@@
import type { Vec3d } from "../math/Vec3d.ts";
import { AbstractDirectedEntity } from "./AbstractDirectedEntity.ts";
import type { DisplayEntity } from "./DisplayEntity.ts";

export class DirectedEntity extends AbstractDirectedEntity<DisplayEntity> {

	/** Java の (ent) と (ent, dir) の 2 つのコンストラクタ（dir を省くと true） */
	constructor(ent: DisplayEntity, dir: boolean = true) {
		super(ent, dir);
	}

	getSourcePoint(): Vec3d {
		return this.entity.getSourcePoint(this.direction);
	}

	getSinkPoint(): Vec3d {
		return this.entity.getSinkPoint(this.direction);
	}

	static getList(list: DisplayEntity[], dir: boolean): DirectedEntity[] {
		const ret: DirectedEntity[] = [];
		for (const ent of list) {
			ret.push(new DirectedEntity(ent, dir));
		}
		return ret;
	}

}
