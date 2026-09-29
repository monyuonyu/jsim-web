/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注: Java の値は java.awt.image.BufferedImage（ImageIO.read で読んだ画像）。画像を使うのは描画だけなので、
//     ここでは画像を読まず、画像のファイルの URI を持つ物（BufferedImage の代わり）を値にする。
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { URI } from "./ParseContext.ts";

/** java.awt.image.BufferedImage の代わり（画像のファイルの URI だけ） */
export interface BufferedImage {
	readonly uri: URI;
}

export class ImageInput extends Input<BufferedImage> {

	constructor(key: string, cat: string, def: BufferedImage | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		let temp: BufferedImage | null;
		const uri = Input.parseURI(thisEnt.getJaamSimModel(), kw);

		// Confirm that the file exists
		if (!InputAgent.fileExists(uri))
			throw new InputErrorException(tr("The specified file does not exist.\n" +
					"File path = %s"), kw.getArg(0));

		try {
			// 描画: 省略（three.js の画面を作るときに）。Java は temp = ImageIO.read(uri.toURL())
			// TODO(移植): 画像として読めるか（Java では読めなければ "Bad image file"、形式が分からなければ null）を調べていない
			if (!uri.isAbsolute())
				throw new Error("URI is not absolute");  // Java の toURL() の IllegalArgumentException
			temp = { uri };
		}
		catch (ex) {
			throw new InputErrorException(tr("Bad image file"));
		}

		this.value = temp;
	}

}
