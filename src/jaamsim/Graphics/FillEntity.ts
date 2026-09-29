//@@HEADER@@
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { Color4d } from "../math/Color4d.ts";
import { implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof FillEntity と getDisplayModel(FillEntity.class) の代わりは、
 * 同じ名前の値 FillEntity（isInstance を持つ）を使う。見分けは関数の有無による。
 */

export interface FillEntity {
	getJaamSimModel(): JaamSimModel;
	isFilled(simTime: number): boolean;
	getFillColour(simTime: number): Color4d;
}

export const FillEntity = {
	/** o instanceof FillEntity */
	isInstance(o: unknown): o is FillEntity {
		return implementsFunctions(o, ["getJaamSimModel", "isFilled", "getFillColour"]);
	},
};
