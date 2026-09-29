/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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
//
// 入れ子のクラス・interface は、同じファイルの ExpParser_Xxx（公開のもの）か、ファイルの中だけのクラス（非公開のもの）にした。
// 公開のもの（ParseContext EvalContext Expression Assignment ExpNode LambdaClosure UnitData と interface）は、
// 同じ名前の namespace にも入れてあるので、Java と同じく ExpParser.ParseContext などと書ける。
//
// Java の静的初期化（static { ExpOperators.InitOperatorsAndFuncs(); }）は、循環 import で落ちないように、
// 演算子・関数の表を初めて引くときに行う（ensureInit）。
import type { JClass } from "../java/lang.ts";
import { jformat, Double, IndexOutOfBoundsException } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import { ExpCollections, StringHashMap } from "./ExpCollections.ts";
import { ExpError } from "./ExpError.ts";
import { ExpOperators } from "./ExpOperators.ts";
import { ExpResType } from "./ExpResType.ts";
import { ExpResult } from "./ExpResult.ts";
import { ExpTokenizer } from "./ExpTokenizer.ts";
import type { ExpTokenizer_Token } from "./ExpTokenizer.ts";
import { ExpValResult } from "./ExpValResult.ts";

type UnitClass = JClass<Unit>;

export interface ExpParser_UnOpFunc {
	/** @throws ExpError */
	checkTypeAndUnits(context: ExpParser_ParseContext, val: ExpResult, source: string, pos: number): void;
	/** @throws ExpError */
	apply(context: ExpParser_ParseContext, val: ExpResult): ExpResult;
	validate(context: ExpParser_ParseContext, val: ExpValResult, source: string, pos: number): ExpValResult;
}

export interface ExpParser_BinOpFunc {
	/** @throws ExpError */
	checkTypeAndUnits(context: ExpParser_ParseContext, lval: ExpResult, rval: ExpResult, source: string, pos: number): void;
	/** @throws ExpError */
	apply(context: ExpParser_ParseContext, lval: ExpResult, rval: ExpResult, source: string, pos: number): ExpResult;
	validate(context: ExpParser_ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult;
}

export interface ExpParser_LazyBinOpFunc {
	/** @throws ExpError */
	apply(pc: ExpParser_ParseContext, ec: ExpParser_EvalContext | null, lval: ExpParser_ExpNode, rval: ExpParser_ExpNode, source: string, pos: number): ExpResult;
	validate(context: ExpParser_ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult;
}

export interface ExpParser_CallableFunc {
	/** @throws ExpError */
	checkUnits(context: ExpParser_ParseContext, args: ExpResult[], source: string, pos: number): void;
	/** @throws ExpError。戻り値が null のこともある（定数の畳み込みのときの乱数の関数など） */
	call(context: ExpParser_EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult | null;
	validate(context: ExpParser_ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult;
}

export class ExpParser_UnitData {
	public scaleFactor = 0;
	public unitType: UnitClass | null = null;
}

export interface ExpParser_OutputResolver {
	/** @throws ExpError */
	resolve(ec: ExpParser_EvalContext | null, ent: ExpResult): ExpResult;
	validate(entValRes: ExpValResult): ExpValResult;
}
export interface ExpParser_Assigner {
	/** @throws ExpError */
	assign(ent: ExpResult, indices: ExpResult[] | null, val: ExpResult): void;
}

class ParseClosure {
	public parseConstants: Map<string, ExpResult> = new Map();
	public freeVars: string[] = [];
	public boundVars: string[] = [];
}

export abstract class ExpParser_ParseContext {
	public closureStack: ParseClosure[] = [];

	constructor(constVals: Map<string, ExpResult>, dynVars: string[]) {
		const initClosure = new ParseClosure();
		initClosure.parseConstants = constVals;
		initClosure.boundVars = dynVars;
		this.closureStack.push(initClosure);
	}
	public abstract getUnitByName(name: string): ExpParser_UnitData | null;
	public abstract multUnitTypes(a: UnitClass | null, b: UnitClass | null): UnitClass | null;
	public abstract divUnitTypes(num: UnitClass | null, denom: UnitClass | null): UnitClass | null;

	/** @throws ExpError */
	public abstract getValFromLitName(name: string, source: string, pos: number): ExpResult;
	/** @throws ExpError */
	public abstract getOutputResolver(name: string): ExpParser_OutputResolver;
	/** @throws ExpError */
	public abstract getConstOutputResolver(constEnt: ExpResult, name: string): ExpParser_OutputResolver;


	/** @throws ExpError */
	public abstract getAssigner(attribName: string): ExpParser_Assigner;
	/** @throws ExpError */
	public abstract getConstAssigner(constEnt: ExpResult, attribName: string): ExpParser_Assigner;

	public pushClosure(close: ParseClosure): void {
		this.closureStack.push(close);
	}
	public popClosure(): ParseClosure {
		return this.closureStack.splice(this.closureStack.length - 1, 1)[0];
	}

	public isVarName(varName: string): boolean {
		// Check the constant vars and bound vars for the whole stack to see if this is a valid variable
		for (const close of this.closureStack) {
			if (close.parseConstants.has(varName)) {
				return true;
			}
			if (close.boundVars.includes(varName)) {
				return true;
			}
		}
		return false;
	}

	public isVarConstant(varName: string): boolean {
		for (const close of this.closureStack) {
			if (close.parseConstants.has(varName)) {
				return true;
			}
		}
		return false;
	}

	/** @throws ExpError */
	public referenceVar(varName: string, source: string, pos: number): void {
		let pastVar = false;
		for (let i = 0; i < this.closureStack.length; i++) {
			const closure = this.closureStack[i];
			if (pastVar) {
				if (!closure.freeVars.includes(varName))
					closure.freeVars.push(varName);
			} else {
				if (closure.boundVars.includes(varName)) {
					pastVar = true;
				}
			}
		}
		if (!pastVar) {
			// Trying to reference an variable not bound on the entire closure stack
			throw new ExpError(source, pos, jformat(tr("Unknown variable: %s"), varName));
		}
	}

	public getVarIndex(varName: string): number {
		// The index logic is that bound variables take the first indices, then free variables follow
		// in the order they are referenced
		const topClose = this.closureStack[this.closureStack.length - 1];
		if (topClose.boundVars.includes(varName)) {
			return topClose.boundVars.indexOf(varName);
		}

		return topClose.freeVars.indexOf(varName) + topClose.boundVars.length;
	}

	/** @throws ExpError */
	public getValFromConstVar(varName: string, source: string, pos: number): ExpResult {
		for (const close of this.closureStack) {
			if (close.parseConstants.has(varName)) {
				return close.parseConstants.get(varName)!;
			}
		}
		throw new ExpError(source, pos, jformat(tr("Unknown constant variable: %s"), varName));

	}
}

export class ExpParser_EvalContext {
	private readonly closureStack: (ExpResult | null)[][] = [];

	constructor(dynamicVals: (ExpResult | null)[]) {
		this.closureStack.push(dynamicVals);
	}

	public pushClosure(closure: (ExpResult | null)[]): void {
		this.closureStack.push(closure);
	}
	public popClosure(): void {
		this.closureStack.splice(this.closureStack.length - 1, 1);
	}
	public getCurrentClosure(): (ExpResult | null)[] {
		return this.closureStack[this.closureStack.length - 1];
	}
}

interface ExpressionWalker {
	/** @throws ExpError */
	visit(exp: ExpParser_ExpNode): void;
	/** @throws ExpError */
	updateRef(exp: ExpParser_ExpNode): ExpParser_ExpNode;
}

/** Java の StackOverflowError（JS では RangeError: Maximum call stack size exceeded） */
function isStackOverflow(e: unknown): boolean {
	return e instanceof RangeError && /call stack/i.test(e.message);
}

////////////////////////////////////////////////////////////////////
// Expression types

export class ExpParser_Expression {
	public readonly source: string;

	public validationResult: ExpValResult | null = null;

	// Java は実行中のスレッドの一覧。JS は 1 本なので、実行中かどうかだけを持つ
	protected executing = false;

	/** Java では private（同じ ExpParser の中からだけ使う） */
	rootNode: ExpParser_ExpNode | null = null;
	constructor(source: string) {
		this.source = source;
	}
	/** @throws ExpError */
	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		if (this.executing) {
			throw new ExpError(this.source, 0, tr("Cannot evaluate an expression with recursive self-references"));
		}

		this.executing = true;

		let res: ExpResult | null = null;
		try {
			res = this.rootNode!.evaluate(ec);
		}
		catch (e) {
			if (!isStackOverflow(e)) throw e;
			throw new ExpError(this.source, 0, tr("Cannot evaluate an expression with excessive recursion"));
		}
		finally {
			this.executing = false;
		}
		return res;
	}
	setRootNode(node: ExpParser_ExpNode): void {
		this.rootNode = node;
	}

	public toString(): string {
		return this.source;
	}
}

export class ExpParser_Assignment extends ExpParser_Expression {
	public entExp: ExpParser_ExpNode | null = null;
	public attribIndices: ExpParser_ExpNode[] | null = null;
	public valueExp: ExpParser_ExpNode | null = null;
	public assigner: ExpParser_Assigner | null = null;
	attribPos = 0;
	constructor(source: string) {
		super(source);
	}
	/** @throws ExpError */
	public override evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		if (this.executing) {
			throw new ExpError(this.source, this.entExp!.tokenPos, tr("Expression recursion detected"));
		}

		this.executing = true;
		try {
			const ent = this.entExp!.evaluate(ec);
			const value = this.valueExp!.evaluate(ec);
			let indices: ExpResult[] | null = null;
			if (this.attribIndices !== null) {
				indices = new Array<ExpResult>(this.attribIndices.length);
				for (let i = 0; i < this.attribIndices.length; ++i) {
					indices[i] = this.attribIndices[i].evaluate(ec);
				}
			}
			if (ent.type !== ExpResType.ENTITY)
				throw new ExpError(this.source, this.entExp!.tokenPos, tr("Can not execute assignment, not assigning to an entity"));
			if (ent.entVal === null)
				throw new ExpError(this.source, this.entExp!.tokenPos, tr("Trying to assign to a null entity"));

			this.assigner!.assign(ent, indices, value);

			return value;
		}
		catch (ex) {
			// Add the position for exceptions related to the attribute name and the values of its indices
			throw fixError(ex, this.source, this.attribPos);
		}
		finally {
			this.executing = false;
		}
	}
}

export abstract class ExpParser_ExpNode {
	public readonly context: ExpParser_ParseContext;
	public readonly exp: ExpParser_Expression;
	public readonly tokenPos: number;
	/** @throws ExpError */
	public abstract evaluate(ec: ExpParser_EvalContext | null): ExpResult;
	public abstract validate(): ExpValResult;
	constructor(context: ExpParser_ParseContext, exp: ExpParser_Expression, pos: number) {
		this.context = context;
		this.tokenPos = pos;
		this.exp = exp;
	}
	/** @throws ExpError */
	abstract walk(w: ExpressionWalker): void;
	// Get a version of this node that skips runtime checks if safe to do so,
	// otherwise return null
	public getNoCheckVer(): ExpParser_ExpNode | null {
		return null;
	}
}

class Constant extends ExpParser_ExpNode {
	public val: ExpResult;
	constructor(context: ExpParser_ParseContext, val: ExpResult, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.val = val;
	}
	public evaluate(_ec: ExpParser_EvalContext | null): ExpResult {
		return this.val;
	}

	public validate(): ExpValResult {
		return ExpValResult.makeValidRes(this.val.type, this.val.unitType);
	}

	walk(w: ExpressionWalker): void {
		w.visit(this);
	}
}

class Variable extends ExpParser_ExpNode {
	public varIndex: number;
	constructor(context: ExpParser_ParseContext, varIndex: number, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.varIndex = varIndex;
	}
	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const close = ec!.getCurrentClosure();
		return close[this.varIndex]!;
	}

	public validate(): ExpValResult {

		// Predefined variables
		const topClose = this.context.closureStack[this.context.closureStack.length - 1];
		const varName = topClose.boundVars[this.varIndex];
		if (varName === undefined)  // Java では IndexOutOfBoundsException
			throw new IndexOutOfBoundsException(`Index ${this.varIndex} out of bounds for length ${topClose.boundVars.length}`);
		if (varName === "this" || varName === "parent" || varName === "sub")
			return ExpValResult.makeValidRes(ExpResType.ENTITY, null);
		if (varName === "simTime")
			return ExpValResult.makeValidRes(ExpResType.NUMBER, TimeUnit);

		// User-defined local variables
		return ExpValResult.makeUndecidableRes();
	}

	walk(w: ExpressionWalker): void {
		w.visit(this);
	}
}

export class ExpParser_LambdaClosure {
	private readonly body: ExpParser_ExpNode;
	private readonly vars: (ExpResult | null)[];
	private readonly numParams: number;

	constructor(body: ExpParser_ExpNode, vars: (ExpResult | null)[], numParams: number) {
		this.body = body;
		this.vars = vars;
		this.numParams = numParams;
	}

	/** @throws ExpError */
	public evaluate(ec: ExpParser_EvalContext | null, params: (ExpResult | null)[]): ExpResult {
		// Fill in the context

		const close: (ExpResult | null)[] = [];
		for (let i = 0; i < this.vars.length; ++i) {
			if (i < params.length)
				close.push(params[i]);
			else {
				close.push(this.vars[i]);
			}
		}
		ec!.pushClosure(close);
		const ret = this.body.evaluate(ec);
		ec!.popClosure();

		return ret;
	}

	public getNumParams(): number {
		return this.numParams;
	}
}

class LambdaNode extends ExpParser_ExpNode {
	private lambdaBody: ExpParser_ExpNode;
	private readonly varMap: number[];
	private readonly numParams: number;
	constructor(context: ExpParser_ParseContext, lambdaBody: ExpParser_ExpNode, varMap: number[], numParams: number, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.lambdaBody = lambdaBody;
		this.varMap = varMap;
		this.numParams = numParams;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const close = ec!.getCurrentClosure();

		const vars: (ExpResult | null)[] = [];

		for (const i of this.varMap) {
			if (i < 0) {
				vars.push(null);
			} else {
				vars.push(close[i]!.getCopy());
			}
		}
		const lc = new ExpParser_LambdaClosure(this.lambdaBody, vars, this.numParams);
		return ExpResult.makeLambdaResult(lc);
	}

	public validate(): ExpValResult {
		return ExpValResult.makeUndecidableRes();
	}

	walk(w: ExpressionWalker): void {
		this.lambdaBody.walk(w);
		this.lambdaBody = w.updateRef(this.lambdaBody);

		w.visit(this);
	}
}

class ResolveOutput extends ExpParser_ExpNode {
	public entNode: ExpParser_ExpNode;
	public outputName: string;

	private readonly resolver: ExpParser_OutputResolver;

	/** @throws ExpError */
	constructor(context: ExpParser_ParseContext, outputName: string, entNode: ExpParser_ExpNode, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);

		this.entNode = entNode;
		this.outputName = outputName;

		try {
			if (entNode instanceof Constant) {
				this.resolver = context.getConstOutputResolver(entNode.evaluate(null), outputName);
			} else {
				this.resolver = context.getOutputResolver(outputName);
			}
		} catch (ex) {
			throw (fixError(ex, exp.source, pos));
		}

	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		try {
			const ent = this.entNode.evaluate(ec);

			return this.resolver.resolve(ec, ent);
		} catch (ex) {
			throw fixError(ex, this.exp.source, this.tokenPos);
		}

	}
	public validate(): ExpValResult {
		const entValRes = this.entNode.validate();

		if (    entValRes.state === ExpValResult.State.ERROR ||
		        entValRes.state === ExpValResult.State.UNDECIDABLE) {
			fixValidationErrors(entValRes, this.exp.source, this.tokenPos);
			return entValRes;
		}
		const res = this.resolver.validate(entValRes);
		fixValidationErrors(res, this.exp.source, this.tokenPos);
		return res;
	}

	walk(w: ExpressionWalker): void {
		this.entNode.walk(w);
		this.entNode = w.updateRef(this.entNode);

		w.visit(this);
	}
}

class ResolveChild extends ExpParser_ExpNode {
	public entNode: ExpParser_ExpNode;
	public childName: string;

	constructor(context: ExpParser_ParseContext, outputName: string, entNode: ExpParser_ExpNode, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);

		this.entNode = entNode;
		this.childName = outputName;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const ent = this.entNode.evaluate(ec);
		if (ent.type !== ExpResType.ENTITY) {
			throw new ExpError(this.exp.source, this.tokenPos, tr("Can only get children from entities"));
		}

		const child = ent.entVal!.getChild(this.childName);
		return ExpResult.makeEntityResult(child);
	}

	public validate(): ExpValResult {
		const entValRes = this.entNode.validate();

		if (    entValRes.state === ExpValResult.State.ERROR ||
		        entValRes.state === ExpValResult.State.UNDECIDABLE) {
			fixValidationErrors(entValRes, this.exp.source, this.tokenPos);
			return entValRes;
		}

		if (entValRes.type !== ExpResType.ENTITY) {
			return ExpValResult.makeErrorRes(new ExpError(this.exp.source, this.tokenPos, tr("Can only get children from entities")));
		}
		// Child resolution can only return entities
		return ExpValResult.makeValidRes(ExpResType.ENTITY, DimensionlessUnit);
	}

	walk(w: ExpressionWalker): void {
		this.entNode.walk(w);
		this.entNode = w.updateRef(this.entNode);

		w.visit(this);
	}
}

class IndexCollection extends ExpParser_ExpNode {
	public collection: ExpParser_ExpNode;
	public indices: ExpParser_ExpNode[];

	constructor(context: ExpParser_ParseContext, collection: ExpParser_ExpNode, indices: ExpParser_ExpNode[], exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);

		this.collection = collection;
		this.indices = indices;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		try {
			const colRes = this.collection.evaluate(ec);
			const indResults: ExpResult[] = [];
			for (const ind of this.indices) {
				indResults.push(ind.evaluate(ec));
			}

			if (colRes.type === ExpResType.COLLECTION) {
				if (indResults.length !== 1) {
					throw new ExpError(this.exp.source, this.tokenPos, tr("Collections can only be indexed with a single index"));
				}
				return colRes.colVal!.index(indResults[0]);
			}
			if (colRes.type === ExpResType.LAMBDA) {
				if (indResults.length !== colRes.lcVal!.getNumParams()) {
					throw new ExpError(this.exp.source, this.tokenPos, tr("Invalid number of parameter for lambda. Got: %d, expected: %d"),
							indResults.length, colRes.lcVal!.getNumParams());
				}
				return colRes.lcVal!.evaluate(ec, indResults);
			}

			throw new ExpError(this.exp.source, this.tokenPos, tr("Expression does not evaluate to a collection or lambda type."));

		} catch (ex) {
			throw fixError(ex, this.exp.source, this.tokenPos);
		}
	}
	public validate(): ExpValResult {
		const colValRes = this.collection.validate();

		if (colValRes.state === ExpValResult.State.ERROR) {
			fixValidationErrors(colValRes, this.exp.source, this.tokenPos);
			return colValRes;
		}
		if (colValRes.state === ExpValResult.State.UNDECIDABLE) {
			return colValRes;
		}
		if (colValRes.type !== ExpResType.COLLECTION && colValRes.type !== ExpResType.LAMBDA) {
			return ExpValResult.makeErrorRes(new ExpError(this.exp.source, this.tokenPos, tr("Expression does not evaluate to a collection or lambda type.")));
		}

		for (const ind of this.indices) {
			const indValRes = ind.validate();

			if (indValRes.state === ExpValResult.State.ERROR) {
				fixValidationErrors(indValRes, this.exp.source, this.tokenPos);
				return indValRes;
			}
			if (indValRes.state === ExpValResult.State.UNDECIDABLE) {
				return indValRes;
			}
		}

		// TODO: validate collection types
		return ExpValResult.makeUndecidableRes();
	}

	walk(w: ExpressionWalker): void {
		this.collection.walk(w);
		this.collection = w.updateRef(this.collection);

		for (let i = 0; i < this.indices.length; ++i) {
			this.indices[i].walk(w);
			const updated = w.updateRef(this.indices[i]);
			this.indices[i] = updated;
		}

		w.visit(this);
	}
}

class BuildArray extends ExpParser_ExpNode {
	public values: ExpParser_ExpNode[];
	public keys: string[] | null;

	constructor(context: ExpParser_ParseContext, valueExps: ExpParser_ExpNode[], keys: string[] | null, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);

		this.values = valueExps;
		this.keys = keys;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		try {
			const res: ExpResult[] = [];
			for (const e of this.values) {
				res.push(e.evaluate(ec));
			}
			if (this.keys === null) {
				// This is an array literal

				// Using the heuristic that if the eval context is null, this is probably an evaluation as part of constant folding
				// even if this is wrong, the behavior will be correct, but possibly a bit slower
				const isConstant = ec === null;
				return ExpCollections.makeAssignableArrrayCollection(res, isConstant);
			} else {
				// This is a map literal
				const map = new StringHashMap<ExpResult>();
				for (let i = 0; i < this.keys.length; ++i) {
					map.put(this.keys[i], res[i]);
				}
				const isConstant = ec === null;
				return ExpCollections.makeAssignableMapCollection(map, isConstant);
			}
		} catch (ex) {
			throw fixError(ex, this.exp.source, this.tokenPos);
		}

	}
	public validate(): ExpValResult {
		for (const val of this.values) {
			const valRes = val.validate();

			if (    valRes.state === ExpValResult.State.ERROR ||
			        valRes.state === ExpValResult.State.UNDECIDABLE) {
				fixValidationErrors(valRes, this.exp.source, this.tokenPos);
				return valRes;
			}
		}

		return ExpValResult.makeValidRes(ExpResType.COLLECTION, DimensionlessUnit);
	}

	walk(w: ExpressionWalker): void {
		for (let i = 0; i < this.values.length; ++i) {
			this.values[i].walk(w);
			this.values[i] = w.updateRef(this.values[i]);
		}

		w.visit(this);
	}
}


class UnaryOp extends ExpParser_ExpNode {
	public subExp: ExpParser_ExpNode;
	protected readonly func: ExpParser_UnOpFunc;
	public name: string;
	public canSkipRuntimeChecks = false;
	constructor(name: string, context: ExpParser_ParseContext, subExp: ExpParser_ExpNode, func: ExpParser_UnOpFunc, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.subExp = subExp;
		this.func = func;
		this.name = name;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const subExpVal = this.subExp.evaluate(ec);
		this.func.checkTypeAndUnits(this.context, subExpVal, this.exp.source, this.tokenPos);
		return this.func.apply(this.context, subExpVal);
	}

	public validate(): ExpValResult {
		const res = this.func.validate(this.context, this.subExp.validate(), this.exp.source, this.tokenPos);
		if (res.state === ExpValResult.State.VALID)
			this.canSkipRuntimeChecks = true;

		return res;

	}

	walk(w: ExpressionWalker): void {
		this.subExp.walk(w);

		this.subExp = w.updateRef(this.subExp);

		w.visit(this);
	}

	public override getNoCheckVer(): ExpParser_ExpNode | null {
		if (this.canSkipRuntimeChecks)
			return new UnaryOpNoChecks(this);
		else
			return null;
	}
	public override toString(): string {
		return "UnaryOp: " + this.name;
	}
}

class UnaryOpNoChecks extends UnaryOp {
	constructor(uo: UnaryOp) {
		super(uo.name, uo.context, uo.subExp, (uo as unknown as { func: ExpParser_UnOpFunc }).func, uo.exp, uo.tokenPos);
	}

	public override evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const subExpVal = this.subExp.evaluate(ec);
		return this.func.apply(this.context, subExpVal);
	}

}

class BinaryOp extends ExpParser_ExpNode {
	public lSubExp: ExpParser_ExpNode;
	public rSubExp: ExpParser_ExpNode;
	public canSkipRuntimeChecks = false;
	public name: string;

	protected readonly func: ExpParser_BinOpFunc | null;
	constructor(name: string, context: ExpParser_ParseContext, lSubExp: ExpParser_ExpNode, rSubExp: ExpParser_ExpNode, func: ExpParser_BinOpFunc | null, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.lSubExp = lSubExp;
		this.rSubExp = rSubExp;
		this.func = func;
		this.name = name;
	}

	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const lRes = this.lSubExp.evaluate(ec);
		const rRes = this.rSubExp.evaluate(ec);
		this.func!.checkTypeAndUnits(this.context, lRes, rRes, this.exp.source, this.tokenPos);
		return this.func!.apply(this.context, lRes, rRes, this.exp.source, this.tokenPos);
	}

	public validate(): ExpValResult {
		const lRes = this.lSubExp.validate();
		const rRes = this.rSubExp.validate();

		const res = this.func!.validate(this.context, lRes, rRes, this.exp.source, this.tokenPos);
		if (res.state === ExpValResult.State.VALID)
			this.canSkipRuntimeChecks = true;

		return res;
	}

	walk(w: ExpressionWalker): void {
		this.lSubExp.walk(w);
		this.rSubExp.walk(w);

		this.lSubExp = w.updateRef(this.lSubExp);
		this.rSubExp = w.updateRef(this.rSubExp);

		w.visit(this);
	}
	public override getNoCheckVer(): ExpParser_ExpNode | null {
		if (this.canSkipRuntimeChecks)
			return new BinaryOpNoChecks(this);
		else
			return null;
	}
	public override toString(): string {
		return "BinaryOp: " + this.name;
	}
}

class BinaryOpNoChecks extends BinaryOp {
	constructor(bo: BinaryOp) {
		super(bo.name, bo.context, bo.lSubExp, bo.rSubExp, (bo as unknown as { func: ExpParser_BinOpFunc }).func, bo.exp, bo.tokenPos);
	}

	public override evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const lRes = this.lSubExp.evaluate(ec);
		const rRes = this.rSubExp.evaluate(ec);
		return this.func!.apply(this.context, lRes, rRes, this.exp.source, this.tokenPos);
	}

}

class LazyBinaryOp extends BinaryOp {

	protected readonly lazyFunc: ExpParser_LazyBinOpFunc;
	constructor(name: string, context: ExpParser_ParseContext, lSubExp: ExpParser_ExpNode, rSubExp: ExpParser_ExpNode, func: ExpParser_LazyBinOpFunc, exp: ExpParser_Expression, pos: number) {
		super(name, context, lSubExp, rSubExp, null, exp, pos);
		this.lazyFunc = func;
	}

	public override evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		return this.lazyFunc.apply(this.context, ec, this.lSubExp, this.rSubExp, this.exp.source, this.tokenPos);
	}

	public override getNoCheckVer(): ExpParser_ExpNode | null {
		return null;
	}
	public override validate(): ExpValResult {
		const lRes = this.lSubExp.validate();
		const rRes = this.rSubExp.validate();

		const res = this.lazyFunc.validate(this.context, lRes, rRes, this.exp.source, this.tokenPos);

		return res;
	}
}

class Conditional extends ExpParser_ExpNode {
	private condExp: ExpParser_ExpNode;
	private trueExp: ExpParser_ExpNode;
	private falseExp: ExpParser_ExpNode;
	constructor(context: ExpParser_ParseContext, c: ExpParser_ExpNode, t: ExpParser_ExpNode, f: ExpParser_ExpNode, exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.condExp = c;
		this.trueExp = t;
		this.falseExp = f;
	}
	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const condRes = this.condExp.evaluate(ec); //constCondRes != null ? constCondRes : condExp.evaluate(ec);
		if (condRes.value === 0)
			return this.falseExp.evaluate(ec);
		else
			return this.trueExp.evaluate(ec);
	}

	public validate(): ExpValResult {
		const condRes = this.condExp.validate();
		const trueRes = this.trueExp.validate();
		const falseRes = this.falseExp.validate();

		if (	condRes.state  === ExpValResult.State.ERROR ||
				trueRes.state  === ExpValResult.State.ERROR ||
				falseRes.state === ExpValResult.State.ERROR) {
			// Error state, merge all returned errors
			const errors: ExpError[] = [];
			if (condRes.errors !== null)
				errors.push(...condRes.errors);
			if (trueRes.errors !== null)
				errors.push(...trueRes.errors);
			if (falseRes.errors !== null)
				errors.push(...falseRes.errors);
			return ExpValResult.makeErrorRes(errors);
		}
		else if (	condRes.state  === ExpValResult.State.UNDECIDABLE ||
					trueRes.state  === ExpValResult.State.UNDECIDABLE ||
					falseRes.state === ExpValResult.State.UNDECIDABLE) {
			return ExpValResult.makeUndecidableRes();
		}

		// All valid case

		// Check that both sides of the branch return the same type
		if (trueRes.type !== falseRes.type) {

			const typeError = new ExpError(this.exp.source, this.tokenPos,
					tr("Type mismatch in conditional. True branch is %s, false branch is %s"),
					String(trueRes.type), String(falseRes.type));
			return ExpValResult.makeErrorRes(typeError);
		}

		// Check that both sides of the branch return the same unit types, for numerical types
		if (trueRes.type === ExpResType.NUMBER && trueRes.unitType !== falseRes.unitType) {

			const unitError = new ExpError(this.exp.source, this.tokenPos,
					tr("Unit mismatch in conditional. True branch is %s, false branch is %s"),
					ClassRegistry.simpleName(trueRes.unitType!), ClassRegistry.simpleName(falseRes.unitType!));
			return ExpValResult.makeErrorRes(unitError);
		}
		return ExpValResult.makeValidRes(trueRes.type, trueRes.unitType);
	}

	walk(w: ExpressionWalker): void {
		this.condExp.walk(w);
		this.trueExp.walk(w);
		this.falseExp.walk(w);

		this.condExp = w.updateRef(this.condExp);
		this.trueExp = w.updateRef(this.trueExp);
		this.falseExp = w.updateRef(this.falseExp);

		w.visit(this);
	}
	public override toString(): string {
		return "Conditional";
	}
}

class FuncCall extends ExpParser_ExpNode {
	readonly args: ExpParser_ExpNode[];
	readonly function: ExpParser_CallableFunc;
	private canSkipRuntimeChecks = false;
	readonly name: string;
	constructor(name: string, context: ExpParser_ParseContext, func: ExpParser_CallableFunc, args: ExpParser_ExpNode[], exp: ExpParser_Expression, pos: number) {
		super(context, exp, pos);
		this.function = func;
		this.args = args;
		this.name = name;
	}

	/** 注意: Java と同じく、定数の畳み込み（ec が null）のときに null を返す関数がある */
	public evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const argVals = new Array<ExpResult>(this.args.length);
		for (let i = 0; i < this.args.length; ++i) {
			argVals[i] = this.args[i].evaluate(ec);
		}
		this.function.checkUnits(this.context, argVals, this.exp.source, this.tokenPos);
		return this.function.call(ec, argVals, this.exp.source, this.tokenPos) as ExpResult;
	}
	public validate(): ExpValResult {
		const argVals = new Array<ExpValResult>(this.args.length);
		for (let i = 0; i < this.args.length; ++i) {
			argVals[i] = this.args[i].validate();
		}

		const res = this.function.validate(this.context, argVals, this.exp.source, this.tokenPos);
		if (res.state === ExpValResult.State.VALID)
			this.canSkipRuntimeChecks = true;
		return res;
	}
	walk(w: ExpressionWalker): void {
		for (let i = 0; i < this.args.length; ++i) {
			this.args[i].walk(w);
		}

		for (let i = 0; i < this.args.length; ++i) {
			this.args[i] = w.updateRef(this.args[i]);
		}

		w.visit(this);
	}
	public override getNoCheckVer(): ExpParser_ExpNode | null {
		if (this.canSkipRuntimeChecks)
			return new FuncCallNoChecks(this);
		else
			return null;
	}
	public override toString(): string {
		return "Function: " + this.name;
	}
}

class FuncCallNoChecks extends FuncCall {
	constructor(fc: FuncCall) {
		super(fc.name, fc.context, fc.function, fc.args, fc.exp, fc.tokenPos);
	}

	public override evaluate(ec: ExpParser_EvalContext | null): ExpResult {
		const argVals = new Array<ExpResult>(this.args.length);
		for (let i = 0; i < this.args.length; ++i) {
			argVals[i] = this.args[i].evaluate(ec);
		}
		return this.function.call(ec, argVals, this.exp.source, this.tokenPos) as ExpResult;
	}

}

// Some errors can be throw without a known source or position, update such errors with the given info
function fixError(ex: unknown, source: string, pos: number): ExpError {
	// Java の catch (Exception) は StackOverflowError（Error）を捕まえないので、そのまま投げ直す
	if (isStackOverflow(ex))
		throw ex;
	if (!(ex instanceof ExpError) || ex.source === null) {
		const msg = ex instanceof ExpError ? ex.getMessage()
				: ex instanceof Error ? ex.message : String(ex);
		return new ExpError(source, pos, msg, ex instanceof Error ? ex : null);
	}
	return ex;
}

function fixValidationErrors(res: ExpValResult, source: string, pos: number): void {
	if (res.state === ExpValResult.State.ERROR ) {
		for (let i = 0; i < res.errors.length; ++i) {
			res.errors[i] = fixError(res.errors[i], source, pos);
		}
	}
}

///////////////////////////////////////////////////////////
// Entries for user definable operators and functions

class UnaryOpEntry {
	public symbol = "";
	public function: ExpParser_UnOpFunc | null = null;
	public bindingPower = 0;
}

class BinaryOpEntry {
	public symbol = "";
	public function: ExpParser_BinOpFunc | null = null;
	public lazyFunction: ExpParser_LazyBinOpFunc | null = null;
	public bindingPower = 0;
	public rAssoc = false;
	public isLazy = false;
}

class FunctionEntry {
	public name = "";
	public function: ExpParser_CallableFunc | null = null;
	public numMinArgs = 0;
	public numMaxArgs = 0;
}

/**
 * A utility class to make dealing with a list of tokens easier
 *
 */
class TokenList {
	private readonly tokens: ExpTokenizer_Token[];
	private pos: number;

	constructor(tokens: ExpTokenizer_Token[]) {
		this.tokens = tokens;
		this.pos = 0;
	}

	/** @throws ExpError */
	public expect(type: number, val: string, source: string): void {
		if (this.pos === this.tokens.length) {
			throw new ExpError(source, source.length, jformat(tr("Expected \"%s\", past the end of input"), val));
		}

		const nextTok = this.tokens[this.pos];

		if (nextTok.type !== type || nextTok.value !== val) {
			throw new ExpError(source, nextTok.pos, jformat(tr("Expected \"%s\", got \"%s\""), val, nextTok.value));
		}
		this.pos++;
	}

	public next(): ExpTokenizer_Token | null {
		if (this.pos >= this.tokens.length) {
			return null;
		}
		return this.tokens[this.pos++];
	}

	public peek(): ExpTokenizer_Token | null {
		if (this.pos >= this.tokens.length) {
			return null;
		}
		return this.tokens[this.pos];
	}

}

class ConstOptimizer implements ExpressionWalker {

	public visit(_exp: ExpParser_ExpNode): void {
		// N/A
	}

	/**
	 * Give a node a chance to swap itself out with a different subtree.
	 */
	public updateRef(origNode: ExpParser_ExpNode): ExpParser_ExpNode {
		// Note: Below we are passing 'null' as an EvalContext, this is not typically
		// acceptable, but is 'safe enough' when we know the expression is a constant
		if (origNode instanceof UnaryOp) {
			const uo = origNode;
			if (uo.subExp instanceof Constant) {
				// This is an unary operation on a constant, we can replace it with a constant
				const val = uo.evaluate(null);
				return new Constant(uo.context, val, origNode.exp, uo.tokenPos);
			}
		}
		if (origNode instanceof BinaryOp) {
			const bo = origNode;
			if ((bo.lSubExp instanceof Constant) && (bo.rSubExp instanceof Constant)) {
				// both sub expressions are constants, so replace the binop with a constant
				const val = bo.evaluate(null);
				return new Constant(bo.context, val, origNode.exp, bo.tokenPos);
			}
		}
		if (origNode instanceof FuncCall) {
			const fc = origNode;
			let constArgs = true;
			for (let i = 0; i < fc.args.length; ++i) {
				if (!(fc.args[i] instanceof Constant)) {
					constArgs = false;
				}
			}
			if (constArgs) {
				const val = fc.evaluate(null) as ExpResult | null;
				if (val !== null)
					return new Constant(fc.context, val, origNode.exp, fc.tokenPos);
			}
		}
		if (origNode instanceof BuildArray) {
			const ba = origNode;
			let constArgs = true;
			for (const val of ba.values) {
				if (!(val instanceof Constant))
					constArgs = false;
			}
			if (constArgs) {
				const val = ba.evaluate(null);
				return new Constant(ba.context, val, origNode.exp, ba.tokenPos);
			}
		}
		return origNode;
	}
}

const CONST_OP = new ConstOptimizer();

class RuntimeCheckOptimizer implements ExpressionWalker {

	public visit(_exp: ExpParser_ExpNode): void {
		// N/A
	}

	public updateRef(exp: ExpParser_ExpNode): ExpParser_ExpNode {
		const noCheckVer = exp.getNoCheckVer();
		if (noCheckVer !== null)
			return noCheckVer;
		else
			return exp;
	}
}
const RTC_OP = new RuntimeCheckOptimizer();

class EntityListBuilder implements ExpressionWalker {

	private entityList: Entity[];

	constructor(list: Entity[]) {
		this.entityList = list;
	}

	public visit(exp: ExpParser_ExpNode): void {
		if (exp instanceof Constant) {
			const ent = exp.val.entVal;
			if (ent === null || this.entityList.includes(ent))
				return;
			this.entityList.push(ent);
		}
	}

	public updateRef(exp: ExpParser_ExpNode): ExpParser_ExpNode {
		return exp;
	}
}

export class ExpParser {

	private static unaryOps: UnaryOpEntry[] = [];
	private static binaryOps: BinaryOpEntry[] = [];
	private static functions: FunctionEntry[] = [];

	////////////////////////////////////////////////////////
	// Statically initialize the operators and functions
	private static inited = false;

	/** Java の static { ExpOperators.InitOperatorsAndFuncs(); } を、初めて使うときに行う */
	private static ensureInit(): void {
		if (ExpParser.inited)
			return;
		ExpParser.inited = true;
		ExpOperators.InitOperatorsAndFuncs();
	}

	public static addUnaryOp(symbol: string, bindPower: number, func: ExpParser_UnOpFunc): void {
		const oe = new UnaryOpEntry();
		oe.symbol = symbol;
		oe.function = func;
		oe.bindingPower = bindPower;
		ExpParser.unaryOps.push(oe);
	}

	public static addBinaryOp(symbol: string, bindPower: number, rAssoc: boolean, func: ExpParser_BinOpFunc): void {
		const oe = new BinaryOpEntry();
		oe.symbol = symbol;
		oe.function = func;
		oe.bindingPower = bindPower;
		oe.rAssoc = rAssoc;
		oe.isLazy = false;
		ExpParser.binaryOps.push(oe);
	}

	public static addLazyBinaryOp(symbol: string, bindPower: number, rAssoc: boolean, func: ExpParser_LazyBinOpFunc): void {
		const oe = new BinaryOpEntry();
		oe.symbol = symbol;
		oe.lazyFunction = func;
		oe.bindingPower = bindPower;
		oe.rAssoc = rAssoc;
		oe.isLazy = true;
		ExpParser.binaryOps.push(oe);
	}

	public static addFunction(name: string, numMinArgs: number, numMaxArgs: number, func: ExpParser_CallableFunc): void {
		const fe = new FunctionEntry();
		fe.name = name;
		fe.function = func;
		fe.numMinArgs = numMinArgs;
		fe.numMaxArgs = numMaxArgs;
		ExpParser.functions.push(fe);
	}

	private static getUnaryOp(symbol: string): UnaryOpEntry | null {
		ExpParser.ensureInit();
		for (const oe of ExpParser.unaryOps) {
			if (oe.symbol === symbol)
				return oe;
		}
		return null;
	}
	private static getBinaryOp(symbol: string): BinaryOpEntry | null {
		ExpParser.ensureInit();
		for (const oe of ExpParser.binaryOps) {
			if (oe.symbol === symbol)
				return oe;
		}
		return null;
	}

	private static getFunctionEntry(funcName: string): FunctionEntry | null {
		ExpParser.ensureInit();
		for (const fe of ExpParser.functions) {
			if (fe.name === funcName){
				return fe;
			}
		}
		return null;
	}

	public static getFunctionNames(): string[] {
		ExpParser.ensureInit();
		const ret: string[] = [];
		for (const fe of ExpParser.functions) {
			ret.push(fe.name);
		}
		ret.sort(Input.uiSortOrder);
		return ret;
	}

	private static optimizeAndValidateExpression(input: string, expNode: ExpParser_ExpNode, exp: ExpParser_Expression): ExpParser_ExpNode {
		expNode.walk(CONST_OP);
		expNode = CONST_OP.updateRef(expNode); // Finally, give the entire expression a chance to optimize itself into a constant

		// Run the validation
		const valRes = expNode.validate();
		if (valRes.state === ExpValResult.State.ERROR) {
			if (valRes.errors.length === 0) {
				throw new ExpError(input, 0, tr("An unknown expression error occurred. This is probably a bug. Please inform the developers."));
			}

			// We received at least one error while validating.
			throw valRes.errors[0];
		}

		// Now that validation is complete, we can run the optimizer that removes runtime checks on validated nodes
		expNode.walk(RTC_OP);
		expNode = RTC_OP.updateRef(expNode); // Give the top level node a chance to optimize

		exp.validationResult = valRes;

		return expNode;
	}

	/**
	 * Java の appendEntityReferences(Assignment, list)・(Expression, list)・(ExpNode, list) をまとめたもの。
	 * @throws ExpError
	 */
	public static appendEntityReferences(obj: ExpParser_Assignment | ExpParser_Expression | ExpParser_ExpNode, list: Entity[]): void {
		if (obj instanceof ExpParser_Assignment) {
			const assign = obj;

			// Entity whose attribute is to be assigned (left hand side)
			if (assign.entExp !== null)
				ExpParser.appendEntityReferences(assign.entExp, list);

			// Value to be assigned to the attribute (right hand side)
			if (assign.valueExp !== null)
				ExpParser.appendEntityReferences(assign.valueExp, list);

			// Any indices associated with the entity's attribute
			if (assign.attribIndices !== null) {
				for (const node of assign.attribIndices) {
					ExpParser.appendEntityReferences(node, list);
				}
			}
			return;
		}
		if (obj instanceof ExpParser_Expression) {
			ExpParser.appendEntityReferences(obj.rootNode!, list);
			return;
		}
		const elb = new EntityListBuilder(list);
		obj.walk(elb);
	}

	public static assertUnitType(exp: ExpParser_Expression, unitType: UnitClass | null): void {
		if (exp.validationResult!.state !== ExpValResult.State.VALID
				|| exp.validationResult!.type !== ExpResType.NUMBER)
			return;

		if (exp.validationResult!.unitType !== unitType) {
			throw new InputErrorException(tr("Invalid unit returned by an expression.%n"
					+ "Received: %s, expected: %s"),
					ClassRegistry.simpleName(exp.validationResult!.unitType!),
					ClassRegistry.simpleName(unitType!));
		}
	}

	/**
	 * Java の assertResultType(Expression, ExpResType) と assertResultType(Expression, ExpResType...) をまとめたもの。
	 * 型が 1 つなら前者、2 つ以上なら後者のメッセージになる。
	 */
	public static assertResultType(exp: ExpParser_Expression, ...types: ExpResType[]): void {
		if (exp.validationResult!.state !== ExpValResult.State.VALID)
			return;

		if (types.length === 1) {
			const type = types[0];
			if (exp.validationResult!.type !== type) {
				throw new InputErrorException(tr("Incorrect result type returned by expression.%n"
						+ "Received: %s, expected: %s"),
						String(exp.validationResult!.type), String(type));
			}
			return;
		}

		for (const type of types) {
			if (type === exp.validationResult!.type)
				return;
		}
		throw new InputErrorException(tr("Incorrect result type returned by expression.%n"
				+ "Received: %s, expected one of: %s"),
				String(exp.validationResult!.type), "[" + types.join(", ") + "]");
	}


	/**
	 * The main entry point to the expression parsing system, will either return a valid
	 * expression that can be evaluated, or throw an error.
	 * @throws ExpError
	 */
	public static parseExpression(context: ExpParser_ParseContext, input: string): ExpParser_Expression {
		const ts = ExpTokenizer.tokenize(input);

		const tokens = new TokenList(ts);

		const ret = new ExpParser_Expression(input);
		let expNode = ExpParser.parseExp(context, tokens, 0, ret);

		// Make sure we've parsed all the tokens
		const peeked = tokens.peek();
		if (peeked !== null) {
			throw new ExpError(input, peeked.pos, tr("Unexpected additional values"));
		}

		expNode = ExpParser.optimizeAndValidateExpression(input, expNode, ret);

		ret.setRootNode(expNode);

		return ret;
	}

	private static parseExp(context: ExpParser_ParseContext, tokens: TokenList, bindPower: number, exp: ExpParser_Expression): ExpParser_ExpNode {
		let lhs = ExpParser.parseOpeningExp(context, tokens, bindPower, exp);
		// Parse as many indices as are present
		while (true) {
			const peeked = tokens.peek();

			if (peeked === null || peeked.type !== ExpTokenizer.SYM_TYPE) {
				break;
			}

			if (peeked.value === ".") {
				tokens.next(); // consume
				const outputName = tokens.next();
				if (outputName === null) {
					throw new ExpError(exp.source, peeked.pos, tr("Expected Identifier after '.'"));
				}
				if (outputName.type === ExpTokenizer.VAR_TYPE) {
					lhs = new ResolveOutput(context, outputName.value, lhs, exp, peeked.pos);
					continue;
				}
				if (outputName.type === ExpTokenizer.SQ_TYPE) {
					lhs = new ResolveChild(context, outputName.value, lhs, exp, peeked.pos);
					continue;
				}
				throw new ExpError(exp.source, peeked.pos, tr("Value after '.' must be an entity name or output"));
			}

			if (peeked.value === "(") {
				const indices = ExpParser.parseIndices(context, tokens, exp);

				lhs = new IndexCollection(context, lhs, indices, exp, peeked.pos);
				continue;
			}

			// Not an index or output. Move on
			break;
		}

		// Now peek for a binary op to modify this expression
		while (true) {
			const peeked = tokens.peek();
			if (peeked === null || peeked.type !== ExpTokenizer.SYM_TYPE) {
				break;
			}
			const binOp = ExpParser.getBinaryOp(peeked.value);
			if (binOp !== null && binOp.bindingPower > bindPower) {
				// The next token is a binary op and powerful enough to bind us
				lhs = ExpParser.handleBinOp(context, tokens, lhs, binOp, exp, peeked.pos);
				continue;
			}
			// Specific check for binding the conditional (?:) operator
			if (peeked.value === "?" && bindPower === 0) {
				lhs = ExpParser.handleConditional(context, tokens, lhs, exp, peeked.pos);
				continue;
			}
			break;
		}

		// We have bound as many operators as we can, return it
		return lhs;
	}

	private static handleBinOp(context: ExpParser_ParseContext, tokens: TokenList, lhs: ExpParser_ExpNode, binOp: BinaryOpEntry, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {
		tokens.next(); // Consume the operator

		// For right associative operators, we weaken the binding power a bit at application time (but not testing time)
		const assocMod = binOp.rAssoc ? -0.5 : 0;
		const rhs = ExpParser.parseExp(context, tokens, binOp.bindingPower + assocMod, exp);

		if (binOp.isLazy)
			return new LazyBinaryOp(binOp.symbol, context, lhs, rhs, binOp.lazyFunction!, exp, pos);
		else
			return new BinaryOp(binOp.symbol, context, lhs, rhs, binOp.function!, exp, pos);
	}

	private static handleConditional(context: ExpParser_ParseContext, tokens: TokenList, lhs: ExpParser_ExpNode, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {
		tokens.next(); // Consume the '?'

		const trueExp = ExpParser.parseExp(context, tokens, 0, exp);

		tokens.expect(ExpTokenizer.SYM_TYPE, ":", exp.source);

		const falseExp = ExpParser.parseExp(context, tokens , 0, exp);

		return new Conditional(context, lhs, trueExp, falseExp, exp, pos);
	}

	/** @throws ExpError */
	public static parseAssignment(context: ExpParser_ParseContext, input: string): ExpParser_Assignment {

		const ts = ExpTokenizer.tokenize(input);

		const tokens = new TokenList(ts);

		const ret = new ExpParser_Assignment(input);
		let lhsNode = ExpParser.parseExp(context, tokens, 0, ret);

		tokens.expect(ExpTokenizer.SYM_TYPE, "=", input);

		let rhsNode = ExpParser.parseExp(context, tokens, 0, ret);

		// Make sure we've parsed all the tokens
		const peeked = tokens.peek();
		if (peeked !== null) {
			throw new ExpError(input, peeked.pos, tr("Unexpected additional values"));
		}

		rhsNode = ExpParser.optimizeAndValidateExpression(input, rhsNode, ret);
		ret.valueExp = rhsNode;

		// Parsing is done, now we need to unwind the lhs expression to get the necessary components

		// Note we use a linked list here, as we will be adding nodes in reverse order
		const indexExps: ExpParser_ExpNode[] = [];

		// Check for an optional index at the end
		while(lhsNode instanceof IndexCollection) {
			// the lhs ended with an index, split that off
			const ind = lhsNode;
			if (ind.indices.length !== 1)
				throw new ExpError(input, lhsNode.tokenPos, tr("Assignment to collections can only take a single index"));

			let indexExp = ind.indices[0];
			indexExp = ExpParser.optimizeAndValidateExpression(input, indexExp, ret);

			indexExps.unshift(indexExp);  // LinkedList.push（先頭に足す）
			lhsNode = ind.collection;

		}
		if (indexExps.length > 0) {

			ret.attribIndices = indexExps.slice();
		} else {
			ret.attribIndices = null;
		}

		// Now make sure the last node of the lhs ends with a output resolve
		if (!(lhsNode instanceof ResolveOutput)) {
			throw new ExpError(input, lhsNode.tokenPos, tr("Assignment left side must end with an output, followed by optional indices"));
		}

		const lhsResolve = lhsNode;
		let entNode = lhsResolve.entNode;

		entNode = ExpParser.optimizeAndValidateExpression(input, entNode, ret);
		ret.entExp = entNode;

		if (ret.entExp instanceof Constant) {
			const ent = ret.entExp.evaluate(null);
			ret.assigner = context.getConstAssigner(ent, lhsResolve.outputName);
		} else {
			ret.assigner = context.getAssigner(lhsResolve.outputName);
		}
		ret.attribPos = lhsNode.tokenPos;

		return ret;

	}

	// The first half of expression parsing, parse a simple expression based on the next token
	private static parseOpeningExp(context: ExpParser_ParseContext, tokens: TokenList, _bindPower: number, exp: ExpParser_Expression): ExpParser_ExpNode {
		const nextTok = tokens.next(); // consume the first token

		if (nextTok === null) {
			throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of string"));
		}

		if (nextTok.type === ExpTokenizer.NUM_TYPE) {
			return ExpParser.parseConstant(context, nextTok.value, tokens, exp, nextTok.pos);
		}
		if (nextTok.type === ExpTokenizer.STRING_TYPE) {

			// Return a literal string constant
			return new Constant(context, ExpResult.makeStringResult(nextTok.value), exp, nextTok.pos);
		}

		if (nextTok.type === ExpTokenizer.SQ_TYPE) {
			const namedVal = context.getValFromLitName(nextTok.value, exp.source, nextTok.pos);
			return new Constant(context, namedVal, exp, nextTok.pos);
		}

		if (nextTok.type === ExpTokenizer.NULL_TYPE) {
			return new Constant(context, ExpResult.makeEntityResult(null), exp, nextTok.pos);
		}

		if (nextTok.type === ExpTokenizer.VAR_TYPE) {
			const peeked = tokens.peek();
			if (peeked !== null && peeked.type === ExpTokenizer.SYM_TYPE && peeked.value === "=") {
				return ExpParser.parseLocalVar(context, nextTok.value, tokens, exp, nextTok.pos);
			}
			if (context.isVarName(nextTok.value)) {
				if (context.isVarConstant(nextTok.value)) {
					const namedVal = context.getValFromConstVar(nextTok.value, exp.source, nextTok.pos);
					return new Constant(context, namedVal, exp, nextTok.pos);
				} else {
					context.referenceVar(nextTok.value, exp.source, nextTok.pos);
					const varIndex = context.getVarIndex(nextTok.value);

					return new Variable(context, varIndex, exp, nextTok.pos);
				}
			} else if (ExpParser.getFunctionEntry(nextTok.value) !== null){
				return ExpParser.parseFuncCall(context, nextTok.value, tokens, exp, nextTok.pos);
			} else {
				throw new ExpError(exp.source, nextTok.pos, tr("Unknown variable or function: %s"), nextTok.value);
			}
		}

		// The next token must be a symbol
		if (nextTok.value === "{") {

			return ExpParser.parseArray(context, tokens, exp, nextTok.pos);
		}

		if (nextTok.value === "|") {
			return ExpParser.parseLambda(context, tokens, exp, nextTok.pos);
		}

		// handle parenthesis
		if (nextTok.value === "(") {
			const expNode = ExpParser.parseExp(context, tokens, 0, exp);
			tokens.expect(ExpTokenizer.SYM_TYPE, ")", exp.source); // Expect the closing paren
			return expNode;
		}

		const oe = ExpParser.getUnaryOp(nextTok.value);
		if (oe !== null) {
			const expNode = ExpParser.parseExp(context, tokens, oe.bindingPower, exp);
			return new UnaryOp(oe.symbol, context, expNode, oe.function!, exp, nextTok.pos);
		}

		// We're all out of tricks here, this is an unknown expression
		throw new ExpError(exp.source, nextTok.pos, tr("Can not parse expression"));
	}

	private static parseConstant(context: ExpParser_ParseContext, constant: string, tokens: TokenList, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {
		let mult = 1;
		let ut: UnitClass | null = DimensionlessUnit;

		const peeked = tokens.peek();

		if (peeked !== null && peeked.type === ExpTokenizer.SQ_TYPE) {
			// This constant is followed by a square quoted token, it must be the unit

			tokens.next(); // Consume unit token

			const unit = context.getUnitByName(peeked.value);
			if (unit === null) {
				throw new ExpError(exp.source, peeked.pos, tr("Unknown unit: %s"), peeked.value);
			}
			mult = unit.scaleFactor;
			ut = unit.unitType;
		}

		return new Constant(context, ExpResult.makeNumResult(Double.parseDouble(constant) * mult, ut), exp, pos);
	}

	private static parseIndices(context: ExpParser_ParseContext, tokens: TokenList, exp: ExpParser_Expression): ExpParser_ExpNode[] {
		tokens.next(); // consume '('
		let peeked = tokens.peek();
		if (peeked === null) {
			throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in argument list"));
		}
		if (peeked.value === ")") {
			// Empty list
			tokens.next();
			return [];
		}

		const indices: ExpParser_ExpNode[] = [];
		while (true) {
			const indexExp = ExpParser.parseExp(context, tokens, 0, exp);
			indices.push(indexExp);

			peeked = tokens.peek();
			if (peeked === null) {
				throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in argument list"));
			}
			if (peeked.value === ")") {
				break;
			}
			if (peeked.value === ",") {
				tokens.next();
				continue;
			}
			throw new ExpError(exp.source, peeked.pos, tr("Unexpected token in index list"));
		}

		tokens.expect(ExpTokenizer.SYM_TYPE, ")", exp.source);
		return indices;
	}

	private static parseArray(context: ExpParser_ParseContext, tokens: TokenList, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {
		let foundComma = true;

		let isArray = false;
		let isMap = false;

		const exps: ExpParser_ExpNode[] = [];
		let keys: string[] | null = null;
		while(true) {
		// Parse an array
			let peeked = tokens.peek();
			if (peeked !== null && peeked.value === "}") {
				tokens.next(); // consume
				break;
			}

			if (!foundComma) {
				throw new ExpError(exp.source, npe(peeked).pos, tr("Expected ',' or '}' in literal array."));
			}
			foundComma = false;

			// We do not know if this is an array or map, so parse the first value,
			if (!isArray && !isMap) {
				const key = ExpParser.parseExp(context, tokens, 0, exp);
				peeked = tokens.peek();

				// Check if the next token is an equals sign, and the first expression is a string literal
				// if so, this is a map
				if (npe(peeked).value === "=") {
					isMap = true;
					keys = [];

					if (!(key instanceof Constant) || (key.val.type !== ExpResType.STRING)) {
						throw new ExpError(exp.source, npe(peeked).pos, tr("Map literals must use strings as keys."));
					}
					keys.push(key.val.stringVal!);
					tokens.next(); // skip "="
					exps.push(ExpParser.parseExp(context, tokens, 0, exp));
					peeked = tokens.peek();
				} else {
					isArray = true;
					exps.push(key);
				}
			} else {
				// Regular iterations
				if (isArray) {
					exps.push(ExpParser.parseExp(context, tokens, 0, exp));
					peeked = tokens.peek();
				}
				if (isMap) {
					const key = ExpParser.parseExp(context, tokens, 0, exp);

					if (!(key instanceof Constant) || (key.val.type !== ExpResType.STRING)) {
						throw new ExpError(exp.source, npe(peeked).pos, tr("Map literals must use strings as keys."));
					}

					keys!.push(key.val.stringVal!);
					tokens.expect(ExpTokenizer.SYM_TYPE, "=", exp.source);
					exps.push(ExpParser.parseExp(context, tokens, 0, exp));
					peeked = tokens.peek();
				}
			}

			if (peeked !== null && peeked.value === ",") {
				tokens.next();
				foundComma = true;
			}
		}
		return new BuildArray(context, exps, keys, exp, pos);

	}

	private static parseLambda(context: ExpParser_ParseContext, tokens: TokenList, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {
		let peeked = tokens.peek();
		if (peeked === null) {
			throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in lambda parameter list"));
		}

		const vars: string[] = [];
		if (peeked.value !== "|") {
			while (true) {
				if (peeked!.type !== ExpTokenizer.VAR_TYPE) {
					throw new ExpError(exp.source, peeked!.pos, tr("Expected variable name in lambda parameter list"));
				}
				if (context.isVarName(peeked!.value)) {
					throw new ExpError(exp.source, peeked!.pos, tr("Variable name is the same as existing variable."));
				}
				if (ExpParser.getFunctionEntry(peeked!.value) !== null) {
					throw new ExpError(exp.source, peeked!.pos, tr("Variable name is the same as built-in function name."));
				}
				vars.push(peeked!.value);
				// consume var name
				tokens.next();
				peeked = tokens.peek();
				if (peeked === null) {
					throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in lambda parameter list"));
				}
				if (peeked.value === "|") {
					break;
				}
				if (peeked.value === ",") {
					tokens.next();
					peeked = tokens.peek();
					// Java: 次の周回で peeked が null だと NullPointerException
					npe(peeked);
					continue;
				}
				throw new ExpError(exp.source, peeked.pos, tr("Unexpected token in lambda parameter list"));
			}
		}
		tokens.expect(ExpTokenizer.SYM_TYPE, "|", exp.source);

		tokens.expect(ExpTokenizer.SYM_TYPE, "(", exp.source);

		const pc = new ParseClosure();
		pc.boundVars = vars;

		context.pushClosure(pc);
		const lambdaBody = ExpParser.parseExp(context, tokens, 0, exp);
		context.popClosure();

		tokens.expect(ExpTokenizer.SYM_TYPE, ")", exp.source);

		// Create the mapping needed to capture the free variables needed when this lambda is executed
		const varMap = new Array<number>(pc.boundVars.length + pc.freeVars.length);
		for (let i = 0; i < varMap.length; ++i) {
			if (i < pc.boundVars.length) {
				varMap[i] = -1;
			} else {
				varMap[i] = context.getVarIndex(pc.freeVars[i - pc.boundVars.length]);
			}
		}

		return new LambdaNode(context, lambdaBody, varMap, vars.length, exp, pos);

	}

	private static parseLocalVar(context: ExpParser_ParseContext, varName: string, tokens: TokenList, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {

		if (context.isVarName(varName)) {
			throw new ExpError(exp.source, pos, tr("Can not declare a local variable with the same name as existing variable: %s"), varName);
		}

		tokens.expect(ExpTokenizer.SYM_TYPE, "=", exp.source);
		const varBody = ExpParser.parseExp(context, tokens, 0, exp);
		tokens.expect(ExpTokenizer.SYM_TYPE, ";", exp.source);

		const pc = new ParseClosure();
		pc.boundVars.push(varName);

		context.pushClosure(pc);
		const mainExp = ExpParser.parseExp(context, tokens, 0, exp);
		context.popClosure();

		// Create the mapping needed to capture the free variables needed when this lambda is executed
		const varMap = new Array<number>(pc.freeVars.length + 1);
		for (let i = 0; i < varMap.length; ++i) {
			if (i < 1) {
				varMap[i] = -1;
			} else {
				varMap[i] = context.getVarIndex(pc.freeVars[i - 1]);
			}
		}

		// Treat a local variable as an implicit lambda of a single variable followed immediately by it's evaluation
		const ln = new LambdaNode(context, mainExp, varMap, 1, exp, pos);

		const indices: ExpParser_ExpNode[] = [];
		indices.push(varBody);

		const evalNode = new IndexCollection(context, ln, indices, exp, pos);
		return evalNode;
	}


	private static parseFuncCall(context: ExpParser_ParseContext, funcName: string, tokens: TokenList, exp: ExpParser_Expression, pos: number): ExpParser_ExpNode {

		const fe = ExpParser.getFunctionEntry(funcName);
		if (fe === null) {
			throw new ExpError(exp.source, pos, tr("Uknown function or variable: \"%s\""), funcName);
		}

		tokens.expect(ExpTokenizer.SYM_TYPE, "(", exp.source);
		const args: ExpParser_ExpNode[] = [];

		const peeked = tokens.peek();
		if (peeked === null) {
			throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in argument list"));
		}
		let isEmpty = false;
		if (peeked.value === ")") {
			// Special case with empty argument list
			isEmpty = true;
			tokens.next(); // Consume closing parens
		}

		while (!isEmpty) {
			const nextArg = ExpParser.parseExp(context, tokens, 0, exp);
			args.push(nextArg);

			const nextTok = tokens.next();
			if (nextTok === null) {
				throw new ExpError(exp.source, exp.source.length, tr("Unexpected end of input in argument list."));
			}
			if (nextTok.value === ")") {
				break;
			}

			if (nextTok.value === ",") {
				continue;
			}

			// Unexpected token
			throw new ExpError(exp.source, nextTok.pos, tr("Unexpected token in arguement list"));
		}

		if (fe.numMinArgs >= 0 && args.length < fe.numMinArgs){
			throw new ExpError(exp.source, pos, tr("Function \"%s\" expects at least %d arguments. %d provided."),
							funcName, fe.numMinArgs, args.length);
		}

		if (fe.numMaxArgs >= 0 && args.length > fe.numMaxArgs){
			throw new ExpError(exp.source, pos, tr("Function \"%s\" expects at most %d arguments. %d provided."),
							funcName, fe.numMaxArgs, args.length);
		}

		return new FuncCall(fe.name, context, fe.function!, args, exp, pos);
	}

}

/** Java で null の物のフィールドを読んで NullPointerException になる所（同じく例外にする） */
function npe<T>(x: T | null): T {
	if (x === null)
		throw new TypeError("NullPointerException");
	return x;
}


// Java と同じく ExpParser.ParseContext などと書けるようにする
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ExpParser {
	export type UnOpFunc = ExpParser_UnOpFunc;
	export type BinOpFunc = ExpParser_BinOpFunc;
	export type LazyBinOpFunc = ExpParser_LazyBinOpFunc;
	export type CallableFunc = ExpParser_CallableFunc;
	export type OutputResolver = ExpParser_OutputResolver;
	export type Assigner = ExpParser_Assigner;
	export type UnitData = ExpParser_UnitData;
	export const UnitData = ExpParser_UnitData;
	export type ParseContext = ExpParser_ParseContext;
	export const ParseContext = ExpParser_ParseContext;
	export type EvalContext = ExpParser_EvalContext;
	export const EvalContext = ExpParser_EvalContext;
	export type Expression = ExpParser_Expression;
	export const Expression = ExpParser_Expression;
	export type Assignment = ExpParser_Assignment;
	export const Assignment = ExpParser_Assignment;
	export type ExpNode = ExpParser_ExpNode;
	export const ExpNode = ExpParser_ExpNode;
	export type LambdaClosure = ExpParser_LambdaClosure;
	export const LambdaClosure = ExpParser_LambdaClosure;
}
