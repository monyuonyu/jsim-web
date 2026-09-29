//@@HEADER@@
import { IconModel } from "../DisplayModels/IconModel.ts";
import { ImageModel } from "../DisplayModels/ImageModel.ts";
import { Entity } from "../basicsim/Entity.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { IntegerListInput } from "../input/IntegerListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { LateClasses } from "./LateClasses.ts";
import { OverlayEntity } from "./OverlayEntity.ts";

/**
 * OverlayImage displays a 2D image (JPG, PNG, etc.) as an overlay on a View window.
 * @author Matt Chudleight, with modifications by Harry King
 *
 */
export class OverlayImage extends OverlayEntity {

	private readonly size: IntegerListInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ImageModel);
		this.displayModelListInput.addInvalidClass(IconModel);

		const defSize = new IntegerVector(2);
		defSize.add(100);
		defSize.add(100);
		this.size = new IntegerListInput("ImageSize", Entity.GRAPHICS, defSize);
		this.setKeywordDoc(this.size, "The size of the image. Value is in pixels",
				["200 100"]);
		this.size.setValidCount(2);
		this.size.setValidRange(0, 2500);
		this.addInput(this.size);
	}

	getImageSize(): IntegerVector {
		return this.size.getValue();
	}
}

ClassRegistry.register("com.jaamsim.Graphics.OverlayImage", OverlayImage);
LateClasses.bind("com.jaamsim.Graphics.OverlayImage", OverlayImage);
