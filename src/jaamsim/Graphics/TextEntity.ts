//@@HEADER@@
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { Color4d } from "../math/Color4d.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof TextEntity の代わりは TextEntity.isInstance(o)（関数の有無で見分ける）。
 */

export interface TextEntity {
	getJaamSimModel(): JaamSimModel;
	getFontName(): string;
	getTextHeight(simTime: number): number;
	getTextHeightString(): string;
	getStyle(): number;
	isBold(): boolean;
	isItalic(): boolean;
	getFontColor(simTime: number): Color4d;
	isDropShadow(simTime: number): boolean;
	getDropShadowColor(simTime: number): Color4d;
	getDropShadowOffset(): Vec3d;
}

export const TextEntity = {
	/** o instanceof TextEntity */
	isInstance(o: unknown): o is TextEntity {
		return implementsFunctions(o, ["getJaamSimModel", "getFontName", "getTextHeight",
				"getTextHeightString", "getStyle", "isBold", "isItalic", "getFontColor",
				"isDropShadow", "getDropShadowColor", "getDropShadowOffset"]);
	},
};
