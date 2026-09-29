//@@HEADER@@
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { AbstractShape } from "./AbstractShape.ts";
import { LateClasses } from "./LateClasses.ts";

/**
 * Two dimension geometric objects such a rectangles, circles, etc.
 * @author Harry King
 *
 */
export class Shape extends AbstractShape {

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ShapeModel);

		this.filled.setDefaultValue(true);
		this.outlined.setDefaultValue(true);
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Shape", Shape);
LateClasses.bind("com.jaamsim.Graphics.Shape", Shape);
