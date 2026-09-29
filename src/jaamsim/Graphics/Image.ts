//@@HEADER@@
import { IconModel } from "../DisplayModels/IconModel.ts";
import { ImageModel } from "../DisplayModels/ImageModel.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { AbstractShape } from "./AbstractShape.ts";
import { LateClasses } from "./LateClasses.ts";

/**
 * Displays a two-dimensional picture
 * @author Harry King
 *
 */
export class Image extends AbstractShape {

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ImageModel);
		this.displayModelListInput.addInvalidClass(IconModel);
	}

	override canLabel(): boolean {
		return false;
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Image", Image);
LateClasses.bind("com.jaamsim.Graphics.Image", Image);
