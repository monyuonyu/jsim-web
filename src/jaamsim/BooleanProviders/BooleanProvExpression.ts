/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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
import { ExpError } from "../input/ExpError.ts";
import { ExpEvaluator } from "../input/ExpEvaluator.ts";
import type { ExpEvaluator_EntityParseContext } from "../input/ExpEvaluator.ts";
import { ExpParser } from "../input/ExpParser.ts";
import type { ExpParser_Expression } from "../input/ExpParser.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { Input } from "../input/Input.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { tr } from "../i18n/I18n.ts";
import type { BooleanProvider } from "./BooleanProvider.ts";

// TODO(移植): 入れ子のクラス ExpParser.Expression は ExpParser_Expression、ExpEvaluator.EntityParseContext は
// ExpEvaluator_EntityParseContext（どちらも ../input/ から）と仮定した。担当が決めた名前に合わせる。
export class BooleanProvExpression implements BooleanProvider {

	private readonly exp: ExpParser_Expression;
	private readonly parseContext: ExpEvaluator_EntityParseContext;

	/** @throws ExpError */
	constructor(expString: string, thisEnt: Entity) {
		this.parseContext = ExpEvaluator.getParseContext(thisEnt, expString);
		this.exp = ExpParser.parseExpression(this.parseContext, expString);
		ExpParser.assertResultType(this.exp, ExpResType.NUMBER);
	}

	public getNextBoolean(thisEnt: Entity, simTime: number): boolean {
		let ret: boolean;
		try {
			const res: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);

			if (res.type !== ExpResType.NUMBER)
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_RESULT_TYPE),
						res.type, ExpResType.NUMBER);

			if (res.unitType !== DimensionlessUnit)
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_UNIT),
						thisEnt.getJaamSimModel().getObjectTypeForClass(res.unitType),
						thisEnt.getJaamSimModel().getObjectTypeForClass(DimensionlessUnit));

			ret = res.value !== 0;
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new ErrorException(thisEnt, e);
		}
		return ret;
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
