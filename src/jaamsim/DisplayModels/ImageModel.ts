/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * TypeScript への移植 (C) 2026 shota
 */
import { BooleanProvInput } from "../internal.ts";
import { LateClasses } from "../internal.ts";
import { Entity } from "../internal.ts";
import { FileInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { jEqualsIgnoreCase } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { AbstractShapeModel } from "../internal.ts";

/*
 * 移植の注意:
 * - 描画: 省略（three.js の画面を作るときに）。入れ子のクラス Binding（背景の四角と画像）と
 *   OverlayBinding（画面に重ねる画像と選択の枠）は移さない。要点は docs/todo-F.md に書いた。
 * - 出力 PixelSize は描画の部品（RenderManager.getImageDims）が要る。Java でも描画が無い
 *   （RenderManager.isGood() が false）ときは {0, 0} を返すので、今は常に {0, 0} を返す。
 * - FileInput の値（Java の URI）は FileInput の移植に合わせる（型は getValue の戻り値のまま）。
 */

export class ImageModel extends AbstractShapeModel {

	private readonly imageFile: FileInput;

	private readonly transparent: BooleanProvInput;

	private readonly compressedTexture: BooleanProvInput;

	static readonly VALID_FILE_EXTENSIONS: string[] = ["JPG", "PNG", "GIF", "BMP", "PCX"];
	static readonly VALID_FILE_DESCRIPTIONS: string[] = [
			"JPEG Image (*.jpg)",
			"Portable Network Graphics (*.png)",
			"Graphics Interchange Format (*.gif)",
			"Windows Bitmap (*.bmp)",
			"Personal Computer Exchange (*.pcx)"];

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.imageFile = new FileInput( "ImageFile", Entity.KEY_INPUTS, null );
		this.setKeywordDoc(this.imageFile, "The file containing the image to show, valid formats are: BMP, JPG, PNG, PCX, GIF.",
				["../images/CompanyIcon.png"]);
		this.imageFile.setFileType("Image");
		this.imageFile.setValidFileExtensions(...ImageModel.VALID_FILE_EXTENSIONS);
		this.imageFile.setValidFileDescriptions(...ImageModel.VALID_FILE_DESCRIPTIONS);
		this.addInput( this.imageFile);

		this.transparent = new BooleanProvInput("Transparent", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.transparent, "Indicates the loaded image has an alpha channel (transparency information) that should be used", []);
		this.addInput(this.transparent);

		this.compressedTexture = new BooleanProvInput("CompressedTexture", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.compressedTexture, "Indicates the loaded image should use texture compression in video memory", []);
		this.addInput(this.compressedTexture);

	}

	/**
	 * 描画: 省略（three.js の画面を作るときに）。
	 * Java は OverlayImage なら new OverlayBinding(ent, this)、それ以外は new Binding(ent, this)
	 */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, "com.jaamsim.Graphics.DisplayEntity");
	}

	getImageFile(): ReturnType<FileInput["getValue"]> {
		return this.imageFile.getValue()!;
	}

	/**
	 * Compares the specified file extension to the list of valid extensions.
	 *
	 * @param str - the file extension to be tested.
	 * @return TRUE if the extension is valid.
	 */
	static isValidExtension(str: string): boolean {

		for (const ext of ImageModel.VALID_FILE_EXTENSIONS) {
			if (jEqualsIgnoreCase(str, ext))
				return true;
		}
		return false;
	}

	/**
	 * 描画: 省略（three.js の画面を作るときに）。
	 * Java は RenderManager.inst().getImageDims(uri) で画像の大きさを得る。描画が無ければ {0, 0}。
	 */
	getPixelSize(simTime: number): number[] {
		const ret: number[] = [0, 0];
		// RenderManager.isGood() が false の場合と同じ
		return ret;
	}

}

defineOutput(ImageModel, {
	name: "PixelSize",
	description: "Height and width of the image in pixels.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "int[]",
	get: (e, simTime) => e.getPixelSize(simTime),
});

ClassRegistry.register("com.jaamsim.DisplayModels.ImageModel", ImageModel);
LateClasses.bind("com.jaamsim.DisplayModels.ImageModel", ImageModel);
