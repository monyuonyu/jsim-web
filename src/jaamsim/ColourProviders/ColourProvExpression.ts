/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2023 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
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
 */
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { ExpError } from "../input/ExpError.ts";
import { ExpEvaluator } from "../input/ExpEvaluator.ts";
import type { ExpEvaluator_EntityParseContext } from "../input/ExpEvaluator.ts";
import { ExpParser } from "../input/ExpParser.ts";
import type { ExpParser_Expression } from "../input/ExpParser.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpResult } from "../input/ExpResult.ts";
import { Input } from "../input/Input.ts";
import { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { tr } from "../i18n/I18n.ts";
import type { ColourProvider } from "./ColourProvider.ts";

// TODO(移植): 入れ子のクラス ExpParser.Expression は ExpParser_Expression、ExpEvaluator.EntityParseContext は
// ExpEvaluator_EntityParseContext と仮定した（ExpResult.Collection は ExpResult の namespace にある）。担当が決めた名前に合わせる。
export class ColourProvExpression implements ColourProvider {
	private readonly exp: ExpParser_Expression;
	private readonly parseContext: ExpEvaluator_EntityParseContext;

	/** @throws ExpError */
	constructor(expString: string, thisEnt: Entity) {
		this.parseContext = ExpEvaluator.getParseContext(thisEnt, expString);
		this.exp = ExpParser.parseExpression(this.parseContext, expString);
		ExpParser.assertResultType(this.exp, ExpResType.STRING, ExpResType.COLLECTION);
	}

	public getNextColour(thisEnt: Entity, simTime: number): Color4d {
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);

			if (result.type === ExpResType.STRING) {
				const ret: Color4d | null = ColourInput.getColorWithName(result.stringVal as string);
				if (ret === null)
					throw new ExpError(this.exp.source, 0, tr(Input.INP_ERR_BADCOLOUR), result.stringVal);
				return ret;
			}

			else if (result.type === ExpResType.COLLECTION) {
				// Java では colVal が null なら NullPointerException（ここでも TypeError になる）
				const col: ExpResult.Collection = result.colVal as ExpResult.Collection;
				if (col.getSize() < 3 || col.getSize() > 4) {
					const colStr: string = col.getOutputString(thisEnt.getJaamSimModel());
					throw new ExpError(this.exp.source, 0, tr(Input.INP_ERR_BADCOLOUR), colStr);
				}

				let r: number = col.index(ExpResult.makeNumResult(1, DimensionlessUnit)).value;
				let g: number = col.index(ExpResult.makeNumResult(2, DimensionlessUnit)).value;
				let b: number = col.index(ExpResult.makeNumResult(3, DimensionlessUnit)).value;
				if (r > 1.0 || g > 1.0 || b > 1.0) {
					r /= 255.0;
					g /= 255.0;
					b /= 255.0;
				}

				let a = 1.0;
				if (col.getSize() === 4) {
					a = col.index(ExpResult.makeNumResult(4, DimensionlessUnit)).value;
					if (a > 1.0)
						a /= 255.0;
				}

				return new Color4d(r, g, b, a);
			}

			else {
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_RESULT_TYPE),
						result.type, "STRING or COLLECTION");
			}
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new ErrorException(thisEnt, e);
		}
	}

	public appendEntityReferences(list: Entity[]): void {
		try {
			ExpParser.appendEntityReferences(this.exp, list);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
		}
	}

	public toString(): string {
		return this.parseContext.getUpdatedSource();
	}

}
