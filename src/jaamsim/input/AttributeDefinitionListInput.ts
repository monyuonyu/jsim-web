/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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
import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { ArrayListInput } from "../internal.ts";
import { AttributeHandle } from "../internal.ts";
import { ExpError } from "../internal.ts";
import { ExpEvaluator } from "../internal.ts";
import { ExpParser } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { NamedExpression } from "../internal.ts";
import { Parser } from "../internal.ts";

/**
 * AttributeDefinitionListInput is an object for parsing inputs consisting of a list of
 * Attribute definitions using the syntax:
 * Entity AttributeDefinitionList { { AttibuteName1 Value1 } { AttibuteName2 Value2 } ... }
 * @author Harry King
 */
export class AttributeDefinitionListInput extends ArrayListInput<NamedExpression> {

	constructor(key: string, cat: string, def: NamedExpression[] | null) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeededToDefinitions(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {

		// Divide up the inputs by the inner braces
		const subArgs = kw.getSubArgs();
		const temp: NamedExpression[] = [];

		// Ensure that no attribute names are repeated
		const nameSet = new Set<string>();
		for (const subArg of subArgs) {
			if (subArg.numArgs() === 0)
				continue;
			const name = subArg.getArg(0);
			if (nameSet.has(name))
				throw new InputErrorException(tr("Duplicate attribute name: %s"), name);
			nameSet.add(name);
		}

		// Parse the inputs within each inner brace
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			Input.assertCount(subArg, 2);
			try {
				// Parse the attribute name
				const name = subArg.getArg(0);
				const vh = thisEnt.getOutputHandle(name);
				if (vh !== null && !(vh instanceof AttributeHandle)) {
					throw new InputErrorException(tr("Attribute name is the same as existing output name: %s"), name);
				}

				const unitType: JClass<Unit> = DimensionlessUnit;

				// Parse the expression
				const expString = subArg.getArg(1);
				const pc = ExpEvaluator.getParseContext(thisEnt, expString);
				const exp = ExpParser.parseExpression(pc, expString);

				// Save the data for this attribute
				const ne = new NamedExpression(name, pc, exp, unitType);
				temp.push(ne);

			} catch (e) {
				if (e instanceof ExpError)
					throw new InputErrorException(e);
				if (e instanceof InputErrorException)
					throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
				throw e;
			}
		}

		// Save the data for each attribute
		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ATTRIB_DEF);
	}

	override getExamples(): string[] {
		return Input.EXAMPLE_ATTRIB_DEF;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;
		for (let i = 0; i < this.value.length; i++) {
			const ne = this.value[i];
			toks.push("{");
			toks.push(ne.getName());
			toks.push(ne.getParseContext().getUpdatedSource());
			toks.push("}");
		}
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		try {
			for (const ne of this.value) {
				ExpParser.appendEntityReferences(ne.getExpression(), list);
			}
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getStubDefinition(): string {
		let sb = "";
		let first = true;
		for (const ne of this.value as NamedExpression[]) {  // Java は value が null なら NullPointerException
			if (first) {
				first = false;
			}
			else {
				sb += Input.BRACE_SEPARATOR;
			}
			sb += ne.getStubDefinition();
		}
		return sb;
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null || this.isDef)
			return "";

		let sb = "";
		for (let i = 0; i < this.value.length; i++) {
			const ne = this.value[i];
			if (i > 0)
				sb += Input.BRACE_SEPARATOR;

			// Opening brace and attribute name
			sb += "{" + Input.BRACE_SEPARATOR;
			sb += ne.getName() + Input.SEPARATOR;

			// Present value
			try {
				const res = ExpEvaluator.evaluateExpression(ne.getExpression(), thisEnt, simTime);
				sb += res.toString();
			}
			catch (e) {
				if (!(e instanceof ExpError))
					throw e;
				throw new ErrorException(thisEnt, this.getKeyword(), i + 1, e);
			}

			// Closing brace
			sb += Input.BRACE_SEPARATOR + "}";
		}
		return sb;
	}

}
