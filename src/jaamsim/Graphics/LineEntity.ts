//@@HEADER@@
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { Color4d } from "../math/Color4d.ts";
import { implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof LineEntity と getDisplayModel(LineEntity.class) の代わりは、
 * 同じ名前の値 LineEntity（isInstance を持つ）を使う。見分けは関数の有無による。
 */

export interface LineEntity {
	getJaamSimModel(): JaamSimModel;
	isOutlined(simTime: number): boolean;
	getLineWidth(simTime: number): number;
	getLineColour(simTime: number): Color4d;
}

export const LineEntity = {
	/** o instanceof LineEntity */
	isInstance(o: unknown): o is LineEntity {
		return implementsFunctions(o, ["getJaamSimModel", "isOutlined", "getLineWidth", "getLineColour"]);
	},
};
