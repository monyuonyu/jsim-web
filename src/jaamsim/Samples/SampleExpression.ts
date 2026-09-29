/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// 入れ子のクラス ExpParser.Expression は ExpParser_Expression、
// ExpEvaluator.EntityParseContext は ExpEvaluator_EntityParseContext と仮定した（別の担当が決める）。

import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import { ExpError } from "../internal.ts";
import { ExpEvaluator } from "../internal.ts";
import type { ExpEvaluator_EntityParseContext } from "../input/ExpEvaluator.ts";
import { ExpParser } from "../internal.ts";
import type { ExpParser_Expression } from "../input/ExpParser.ts";
import { ExpResType } from "../internal.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { tr } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { SampleProvider } from "./SampleProvider.ts";

export class SampleExpression implements SampleProvider {
	private readonly exp: ExpParser_Expression;
	private readonly unitType: JClass<Unit>;
	private readonly parseContext: ExpEvaluator_EntityParseContext;

	/** @throws ExpError */
	constructor(expString: string, thisEnt: Entity, ut: JClass<Unit>) {

		// Check that a unit type has been specified
		if (ut === UserSpecifiedUnit) {
			throw new InputErrorException(tr(Input.INP_ERR_UNITUNSPECIFIED));
		}

		this.unitType = ut;
		this.parseContext = ExpEvaluator.getParseContext(thisEnt, expString);
		this.exp = ExpParser.parseExpression(this.parseContext, expString);
		ExpParser.assertUnitType(this.exp, this.unitType);
		ExpParser.assertResultType(this.exp, ExpResType.NUMBER);
	}

	getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	getNextSample(thisEnt: Entity, simTime: number): number {
		let ret = 0.0;
		try {
			const res: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);

			if (res.type !== ExpResType.NUMBER)
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_RESULT_TYPE),
						res.type, ExpResType.NUMBER);

			if (res.unitType !== this.unitType)
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_UNIT),
						thisEnt.getJaamSimModel().getObjectTypeForClass(res.unitType),
						thisEnt.getJaamSimModel().getObjectTypeForClass(this.unitType));

			ret = res.value;
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(e);
		}
		return ret;
	}

	getMeanValue(simTime: number): number {
		return 0;
	}

	getExpressionString(): string {
		return this.parseContext.getUpdatedSource();
	}

	appendEntityReferences(list: Entity[]): void {
		try {
			ExpParser.appendEntityReferences(this.exp, list);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
		}
	}

	toString(): string {
		return this.getExpressionString();
	}

}
