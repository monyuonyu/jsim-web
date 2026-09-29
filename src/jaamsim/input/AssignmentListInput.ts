/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { ExpError } from "./ExpError.ts";
import { ExpEvaluator } from "./ExpEvaluator.ts";
import type { ExpEvaluator_EntityParseContext } from "./ExpEvaluator.ts";
import { ExpParser } from "./ExpParser.ts";
import type { ExpParser_Assignment } from "./ExpParser.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { Parser } from "./Parser.ts";


export class AssignmentListInput extends ArrayListInput<ExpParser_Assignment> {

	private parseContextList: ExpEvaluator_EntityParseContext[] | null = null;

	constructor(key: string, cat: string, def: ExpParser_Assignment[] | null){
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addSubstringQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {

		// Divide up the inputs by the inner braces
		const subArgs = kw.getSubArgs();
		const temp: ExpParser_Assignment[] = [];
		const pcList: ExpEvaluator_EntityParseContext[] = [];

		// Parse the inputs within each inner brace
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			Input.assertCount(subArg, 1);
			try {
				// Parse the assignment expression
				const assignmentString = subArg.getArg(0);
				const pc = ExpEvaluator.getParseContext(thisEnt, assignmentString);
				const ass = ExpParser.parseAssignment(pc, assignmentString);

				// Save the data for this assignment
				pcList.push(pc);
				temp.push(ass);

			} catch (e) {
				if (!(e instanceof ExpError))
					throw e;
				throw new InputErrorException(e);
			}
		}

		// Save the data for each assignment
		this.parseContextList = pcList;
		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ATTRIB_ASSIGN);
	}

	override getExamples(): string[] {
		return Input.EXAMPLE_ATTRIB_ASSIGN;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		for (let i = 0; i < this.value.length; i++) {
			toks.push("{");
			toks.push((this.parseContextList as ExpEvaluator_EntityParseContext[])[i].getUpdatedSource());
			toks.push("}");
		}
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		return "";
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		try {
			for (const assign of this.value) {
				ExpParser.appendEntityReferences(assign, list);
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

	executeAssignments(thisEnt: Entity, simTime: number): void {
		try {
			for (const ass of this.getValue() as ExpParser_Assignment[]) {
				ExpEvaluator.evaluateExpression(ass, thisEnt, simTime);
			}
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new ErrorException(thisEnt, this.getKeyword(), e);
		}
	}

}
