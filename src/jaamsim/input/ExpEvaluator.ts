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
//
// 入れ子のクラスは、公開のもの（EntityParseContext・EntityEvalContext）を ExpEvaluator_Xxx として書き出し、
// 同じ名前の namespace にも入れた（ExpEvaluator.EntityParseContext と書ける）。非公開のものはファイルの中だけのクラス。
//
// 注意（循環 import）: このファイルは ExpParser のクラスを extends するので、ExpParser.ts が先に読み込まれている必要がある。
// ExpParser.ts を最初に import すると、ExpParser → ExpCollections → ExpEvaluator の順になり extends で落ちる。
// 使う側は ExpEvaluator.ts（か Entity.ts）を先に import すること。
import type { JClass } from "../java/lang.ts";
import { jIsAssignableFrom } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { AbstractDirectedEntity } from "../Graphics/AbstractDirectedEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { ExpCollections } from "./ExpCollections.ts";
import { ExpError } from "./ExpError.ts";
import { ExpParser_EvalContext, ExpParser_ParseContext, ExpParser_UnitData } from "./ExpParser.ts";
import type { ExpParser_Assigner, ExpParser_Expression, ExpParser_OutputResolver } from "./ExpParser.ts";
import { ExpResType } from "./ExpResType.ts";
import { ExpResult } from "./ExpResult.ts";
import { ExpValResult } from "./ExpValResult.ts";
import { Input } from "./Input.ts";
import { ValueHandle } from "./ValueHandle.ts";

type UnitClass = JClass<Unit>;

/**
 * 出力の戻り値の型（Java の Class<?>）。移植ではクラス（コンストラクタ）か、
 * OutputRegistry の returnType の名前（"double" "String" "Entity" "ExpResult" など）のどちらか。
 */
type RetType = unknown;

function isExpResultType(k: RetType): boolean {
	return k === ExpResult || k === "ExpResult";
}
function isStringType(k: RetType): boolean {
	return k === String || k === "String";
}
function isEntityType(k: RetType): boolean {
	return k === "Entity" || (typeof k === "function" && jIsAssignableFrom(Entity, k as JClass));
}
function isNumberOrBooleanType(k: RetType): boolean {
	return ValueHandle.isNumericType(k as never) ||
			k === "boolean" || k === "Boolean" || k === Boolean;
}
function isDirectedEntityType(k: RetType): boolean {
	return typeof k === "function" && jIsAssignableFrom(AbstractDirectedEntity, k as JClass);
}

export class ExpEvaluator_EntityParseContext extends ExpParser_ParseContext {
	private readonly model: JaamSimModel;
	private readonly source: string;

	// TODO(順番): Java は HashMap<Entity, String>（順番は実体の hash で決まる）。名前の置き換えの順番が違うことがある
	private readonly entityReferences = new Map<Entity, string>();

	private addEntityReference(ent: Entity): void {
		this.entityReferences.set(ent, ent.getName());
	}

	// Return a version of the expression string updated for an entities that have changed their names
	// since the expression was parsed
	public getUpdatedSource(): string {
		let ret = this.source;
		for (const [ent, oldName] of this.entityReferences) {
			if (ent.getName() !== null && ent.getName() === oldName && !ent.isDead()) {
				// This name did not change
				continue;
			}
			let newName = ent.getName();
			if (ent.getName() === null || ent.isDead()) {
				// An entity with a null name means the entity has been deleted
				newName = "**DeletedEntity**";
			}
			// Java の String.replace は、すべて（文字どおりに）置き換える
			ret = ret.split("[" + oldName + "]").join("[" + newName + "]");
		}
		return ret;
	}

	constructor(ent: Entity, constants: Map<string, ExpResult>, dynamicVars: string[], source: string) {
		super(constants, dynamicVars);
		this.model = ent.getJaamSimModel();
		this.source = source;
	}

	public getUnitByName(name: string): ExpParser_UnitData | null {
		const unit = Input.tryParseUnit(this.model, name, Unit);
		if (unit === null || unit === undefined) {
			return null;
		}

		const ret = new ExpParser_UnitData();
		ret.scaleFactor = unit.getConversionFactorToSI();
		ret.unitType = unit.constructor as UnitClass;

		this.addEntityReference(unit);
		return ret;
	}

	public multUnitTypes(a: UnitClass | null, b: UnitClass | null): UnitClass | null {
		return Unit.getMultUnitType(a, b);
	}

	public divUnitTypes(num: UnitClass | null, denom: UnitClass | null): UnitClass | null {
		return Unit.getDivUnitType(num, denom);
	}

	public getValFromLitName(name: string, source: string, pos: number): ExpResult {
		const ent = this.model.getNamedEntity(name);
		if (ent === null || ent === undefined) {
			throw new ExpError(source, pos, tr("Could not find entity: %s"), name);
		}

		this.addEntityReference(ent);
		return ExpResult.makeEntityResult(ent);
	}

	public getOutputResolver(name: string): ExpParser_OutputResolver {
		return new EntityResolver(name);
	}

	public getConstOutputResolver(constEnt: ExpResult, name: string): ExpParser_OutputResolver {

		if (constEnt.type !== ExpResType.ENTITY) {
			throw new ExpError(null, 0, tr("Can not index a non-entity type"));
		}

		if (constEnt.entVal === null) {
			throw new ExpError(null, 0, tr("Trying to resolve output on null entity"));
		}
		const oh = constEnt.entVal.getOutputHandle(name);

		if (oh === null || oh === undefined) {
			throw new ExpError(null, 0, tr("Could not find output '%s' on entity '%s'"), name, constEnt.entVal.getName());
		}

		if (oh.canCache()) {
			return new CachedResolver(oh);
		} else {
			return new EntityResolver(name);
		}
	}

	public getAssigner(attribName: string): ExpParser_Assigner {
		return new EntityAssigner(attribName);
	}

	public getConstAssigner(_constEnt: ExpResult, attribName: string): ExpParser_Assigner {
		// TODO: const optimization
		return new EntityAssigner(attribName);
	}

}

class CachedResolver implements ExpParser_OutputResolver {

	private readonly handle: ValueHandle;
	private readonly type: ExpResType | null;
	private readonly isExpResult: boolean;

	/** @throws ExpError */
	constructor(oh: ValueHandle) {

		this.handle = oh;

		const retType = oh.getReturnType();
		if (isExpResultType(retType)) {
			this.isExpResult = true;
			this.type = null;
		} else {
			this.isExpResult = false;
			this.type = ExpEvaluator.getTypeForClass(retType);
			if (this.type === null) {
				throw new ExpError(null, 0,
						tr("Output '%s' on entity '%s' returns a type that is incompatible with "
						+ "the expression engine"),
						oh.getName(), oh.ent.getName());
			}
		}
	}

	public resolve(ec: ExpParser_EvalContext | null, _ent: ExpResult): ExpResult {
		let simTime = 0;
		if (ec !== null) {
			const eec = ec as ExpEvaluator_EntityEvalContext;
			simTime = eec.simTime;
		}

		if (this.isExpResult) {
			return this.handle.getValue(simTime, "ExpResult") as ExpResult;
		}

		switch (this.type) {
		case ExpResType.NUMBER: {
			const val = this.handle.getValueAsDouble(simTime, 0);
			return ExpResult.makeNumResult(val, this.handle.getUnitType());
		}
		case ExpResType.ENTITY:
			return ExpResult.makeEntityResult(this.handle.getValue(simTime, Entity) as Entity | null);
		case ExpResType.STRING:
			return ExpResult.makeStringResult(this.handle.getValue(simTime, String) as string | null);
		case ExpResType.COLLECTION:
			return ExpCollections.wrapCollection(this.handle.getValue(simTime, this.handle.getReturnType() as never), this.handle.getUnitType());
		default:
			return ExpResult.makeNumResult(this.handle.getValueAsDouble(simTime, 0), this.handle.getUnitType());
		}
	}

	public validate(_entValRes: ExpValResult): ExpValResult {
		if (this.handle === null) {
			// There is no cached output handle, so we can not decide
			return ExpValResult.makeUndecidableRes();
		}

		let ut: UnitClass | null = DimensionlessUnit;
		if (this.type === ExpResType.NUMBER)
			ut = this.handle.getUnitType();

		if (this.isExpResult) {
			return ExpValResult.makeUndecidableRes();
		}

		return ExpValResult.makeValidRes(this.type, ut);

	}

}

class EntityResolver implements ExpParser_OutputResolver {

	private readonly outputName: string;

	constructor(name: string) {
		this.outputName = name;
	}

	public resolve(ec: ExpParser_EvalContext | null, entRes: ExpResult): ExpResult {

		let simTime = 0;
		if (ec !== null) {
			const eec = ec as ExpEvaluator_EntityEvalContext;
			simTime = eec.simTime;
		}

		if (entRes.type !== ExpResType.ENTITY) {
			throw new ExpError(null, 0, tr("Can not look up output on non-entity type"));
		}

		const ent = entRes.entVal;
		if (ent === null) {
			throw new ExpError(null, 0, tr("Trying to resolve output on null entity"));
		}

		const oh = ent.getOutputHandle(this.outputName);
		if (oh === null || oh === undefined) {
			throw new ExpError(null, 0, tr("Could not find output '%s' on entity '%s'"), this.outputName, ent.getName());
		}

		const res = ExpEvaluator.getResultFromOutput(oh, simTime);

		if (res === null)
			throw new ExpError(null, 0, tr("Output %s, on entity %s does not return a type compatible with expressions."),
			                   oh.getName(), oh.ent.getName());

		return res;

	}

	public validate(entValRes: ExpValResult): ExpValResult {

		if (entValRes.type !== ExpResType.ENTITY) {
			return ExpValResult.makeErrorRes(new ExpError(null, 0, tr("Can not evalutate output on non-entity type")));
		}

		return ExpValResult.makeUndecidableRes();
	}

}

class EntityAssigner implements ExpParser_Assigner {

	private readonly attribName: string;
	constructor(attribName: string) {
		this.attribName = attribName;
	}

	public assign(ent: ExpResult, indices: ExpResult[] | null, val: ExpResult): void {
		const assignEnt = ent.entVal!;
		assignEnt.setAttribute(this.attribName, indices, val);
	}

}

export class ExpEvaluator_EntityEvalContext extends ExpParser_EvalContext {

	public readonly simTime: number;
	public readonly thisEnt: Entity;

	constructor(thisEnt: Entity, simTime: number, dynamicVals: (ExpResult | null)[]) {
		super(dynamicVals);
		this.simTime = simTime;
		this.thisEnt = thisEnt;
	}

}

/**
 * Utility class to bridge the expression parser and attribute assignment
 * @author Matt Chudleigh
 *
 */
export class ExpEvaluator {

	/** Java では private（このファイルの CachedResolver から使う） */
	static getTypeForClass(klass: RetType): ExpResType | null {

		if (isStringType(klass)) {
			return ExpResType.STRING;
		} else if (isEntityType(klass)){
			return ExpResType.ENTITY;
		} else if (isNumberOrBooleanType(klass)) {
			return ExpResType.NUMBER;
		} else if (ExpCollections.isCollectionClass(klass)){
			return ExpResType.COLLECTION;
		} else if (isDirectedEntityType(klass)){
			return ExpResType.ENTITY;
		} else {
			return null;
		}
	}

	/** Java では private（このファイルの EntityResolver から使う） */
	static getResultFromOutput(oh: ValueHandle, simTime: number): ExpResult | null {
		const retType = oh.getReturnType();
		if (isExpResultType(retType)) {
			// This is already an expression, so return it
			return oh.getValue(simTime, "ExpResult") as ExpResult;
		}
		if (isStringType(retType)) {
			return ExpResult.makeStringResult(oh.getValue(simTime, String) as string | null);
		}
		if (isEntityType(retType)) {
			return ExpResult.makeEntityResult(oh.getValue(simTime, Entity) as Entity | null);
		}
		if (isNumberOrBooleanType(retType)) {
			return ExpResult.makeNumResult(oh.getValueAsDouble(simTime, 0), oh.getUnitType());
		}

		if (ExpCollections.isCollectionClass(retType)) {
			return ExpCollections.wrapCollection(oh.getValue(simTime, retType as never), oh.getUnitType());
		}

		if (isDirectedEntityType(retType)) {
			const de = oh.getValue(simTime, AbstractDirectedEntity) as AbstractDirectedEntity<Entity>;
			return ExpResult.makeEntityResult(de.getEntity());
		}

		// No known type
		return null;
	}

	/** @throws ExpError */
	public static getResultFromObject(val: unknown, unitType: UnitClass | null): ExpResult {
		if (val === null || val === undefined)
			return ExpResult.makeEntityResult(null);

		if (val instanceof ExpResult) {
			return val;
		}
		if (typeof val === "string") {
			return ExpResult.makeStringResult(val);
		}
		if (val instanceof Entity) {
			return ExpResult.makeEntityResult(val);
		}
		// Java の Double と Integer（JS では同じ数）
		if (typeof val === "number") {
			return ExpResult.makeNumResult(val, unitType);
		}
		if (ExpCollections.isCollectionObject(val)) {
			return ExpCollections.wrapCollection(val, unitType);
		}
		if (val instanceof AbstractDirectedEntity) {
			const de = val;
			return ExpResult.makeEntityResult(de.getEntity());
		}
		const simpleName = typeof val === "boolean" ? "Boolean"
				: typeof val === "object" || typeof val === "function" ? ClassRegistry.simpleName(val as object)
				: typeof val;
		throw new ExpError(null, 0, tr("Unknown type in expression: %s"), simpleName);
	}

	// Java の static な表（循環 import で落ちないように、初めて使うときに作る）
	private static constantsMap: Map<string, ExpResult> | null = null;
	private static get constants(): Map<string, ExpResult> {
		if (ExpEvaluator.constantsMap === null) {
			ExpEvaluator.constantsMap = new Map<string, ExpResult>();
			ExpEvaluator.constantsMap.set("TRUE", ExpResult.makeNumResult(1, DimensionlessUnit));
			ExpEvaluator.constantsMap.set("FALSE", ExpResult.makeNumResult(0, DimensionlessUnit));
		}
		return ExpEvaluator.constantsMap;
	}

	public static getParseContext(thisEnt: Entity, source: string): ExpEvaluator_EntityParseContext {
		const varNames: string[] = [];
		varNames.push("this");
		varNames.push("parent");
		varNames.push("sub");
		varNames.push("simTime");
		return new ExpEvaluator_EntityParseContext(thisEnt, ExpEvaluator.constants, varNames, source);
	}

	/** @throws ExpError */
	public static evaluateExpression(exp: ExpParser_Expression | null, thisEnt: Entity, simTime: number): ExpResult {
		if (exp === null)
			return ExpResult.makeEntityResult(null);

		const varVals: (ExpResult | null)[] = [];
		const parent = thisEnt.getParent();
		varVals.push(ExpResult.makeEntityResult(thisEnt));
		varVals.push(ExpResult.makeEntityResult(parent));
		varVals.push(ExpResult.makeEntityResult(parent));
		varVals.push(ExpResult.makeNumResult(simTime, TimeUnit));

		const evalContext = new ExpEvaluator_EntityEvalContext(thisEnt, simTime, varVals);
		return exp.evaluate(evalContext);
	}

}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ExpEvaluator {
	export type EntityParseContext = ExpEvaluator_EntityParseContext;
	export const EntityParseContext = ExpEvaluator_EntityParseContext;
	export type EntityEvalContext = ExpEvaluator_EntityEvalContext;
	export const EntityEvalContext = ExpEvaluator_EntityEvalContext;
}
