/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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
import { jformat } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { Color4d } from "../math/Color4d.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { ColourInput } from "./ColourInput.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class ColorListInput extends ArrayListInput<Color4d>  {

	constructor(key: string, cat: string, def: Color4d[] | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		this.value = Input.parseColorVector(thisEnt.getJaamSimModel(), kw);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_COLOR_LIST);
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		for (let i = 0; i < this.defValue.length; i++) {

			// blank space between elements
			if (tmp.length > 0)
				tmp += Input.SEPARATOR;

			const col = this.defValue[i];
			const colorName = ColourInput.getColorName(col);
			if (colorName === null)
				tmp += jformat("{%s%.0f%s%.0f%s%.0f%s}", Input.SEPARATOR, col.r * 255,
				   Input.SEPARATOR, col.g * 255, Input.SEPARATOR, col.b * 255, Input.SEPARATOR );
			else
				tmp += jformat("{%s%s%s}", Input.SEPARATOR, colorName, Input.SEPARATOR);
		}

		return tmp;
	}
}
