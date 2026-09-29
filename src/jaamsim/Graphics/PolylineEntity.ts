//@@HEADER@@
import { implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof PolylineEntity と getDisplayModel(PolylineEntity.class) の代わりは、
 * 同じ名前の値 PolylineEntity（isInstance を持つ）を使う。見分けは関数の有無による。
 */

export interface PolylineEntity {
	getPolylineWidth(simTime: number): number;
	isClosed(simTime: number): boolean;
}

export const PolylineEntity = {
	/** o instanceof PolylineEntity */
	isInstance(o: unknown): o is PolylineEntity {
		return implementsFunctions(o, ["getPolylineWidth", "isClosed"]);
	},
};
