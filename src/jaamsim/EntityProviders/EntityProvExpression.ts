/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2023 JaamSim Software Inc.
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
import { ExpResType } from "../input/ExpResType.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { Input } from "../input/Input.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { EntityProvider } from "./EntityProvider.ts";
import type { EntityListProvider } from "./EntityListProvider.ts";

// TODO(移植): 入れ子のクラス ExpParser.Expression は ExpParser_Expression、ExpEvaluator.EntityParseContext は
// ExpEvaluator_EntityParseContext（どちらも ../input/ から）と仮定した。担当が決めた名前に合わせる。
export class EntityProvExpression<T extends Entity> implements EntityProvider<T>, EntityListProvider<T> {

	private readonly exp: ExpParser_Expression;
	private readonly parseContext: ExpEvaluator_EntityParseContext;
	private readonly entClass: JClass<T>;

	/** @throws ExpError */
	constructor(expString: string, thisEnt: Entity, aClass: JClass<T>) {
		this.parseContext = ExpEvaluator.getParseContext(thisEnt, expString);
		this.exp = ExpParser.parseExpression(this.parseContext, expString);
		ExpParser.assertResultType(this.exp, ExpResType.ENTITY);
		this.entClass = aClass;
	}

	public getNextEntity(thisEnt: Entity, simTime: number): T | null {
		let ret: T | null = null;
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);

			if (result.type !== ExpResType.ENTITY) {
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_RESULT_TYPE),
						result.type, ExpResType.ENTITY);
			}

			if (result.entVal !== null && !jIsAssignableFrom(this.entClass, result.entVal.constructor as JClass)) {
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_CLASS),
						ClassRegistry.simpleName(result.entVal), ClassRegistry.simpleName(this.entClass));
			}

			ret = result.entVal as T | null;
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new ErrorException(thisEnt, e);
		}
		return ret;
	}

	public getNextEntityList(thisEnt: Entity, simTime: number, list: T[], unique: boolean): void {
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);

			// Result is a single entity
			if (result.type === ExpResType.ENTITY) {
				const ent: Entity | null = result.entVal;
				if (ent !== null && !jIsAssignableFrom(this.entClass, ent.constructor as JClass)) {
					throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_CLASS),
							ClassRegistry.simpleName(ent), ClassRegistry.simpleName(this.entClass));
				}
				if (ent !== null && (!unique || !list.includes(ent as T))) {
					list.push(ent as T);
				}
			}
			else {
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_RESULT_TYPE),
						result.type, "ENTITY or COLLECTION");
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
