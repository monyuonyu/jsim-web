/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2022 JaamSim Software Inc.
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
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import type { ExpEvaluator_EntityParseContext } from "./ExpEvaluator.ts";
import type { ExpParser_Expression } from "./ExpParser.ts";

export class NamedExpression {

	private readonly name: string;
	private readonly parseContext: ExpEvaluator_EntityParseContext;
	private readonly exp: ExpParser_Expression;
	private readonly unitType: JClass<Unit>;

	constructor(name: string, parseContext: ExpEvaluator_EntityParseContext, exp: ExpParser_Expression, unitType: JClass<Unit>) {
		this.name = name;
		this.parseContext = parseContext;
		this.exp = exp;
		this.unitType = unitType;
	}

	getName(): string {
		return this.name;
	}
	getExpression(): ExpParser_Expression {
		return this.exp;
	}

	getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	getParseContext(): ExpEvaluator_EntityParseContext {
		return this.parseContext;
	}

	getStubDefinition(): string {
		if (this.unitType === DimensionlessUnit) {
			return jformat("{ %s  0 }", this.getName());
		}
		return jformat("{ %s  0[%s]  %s }",
				this.getName(), Unit.getSIUnit(this.unitType), ClassRegistry.simpleName(this.unitType));
	}

}
