/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2024 JaamSim Software Inc.
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
// 注: Java は @Output の注釈をリフレクションで読む。TS では OutputRegistry（defineOutput で登録した表）から読む。
// - OutputStaticInfo（入れ子のクラス）は、このファイルの中の OutputHandle_OutputStaticInfo にした（公開しない）。
// - getValueAsDouble(simTime, def) と getValueAsDouble(simTime, def, u) は、引数の数で見分ける。
// - Java の出力の表は HashMap<String, …>。その順番（getAllOutputHandles の並び）が、同じ sequence の出力の並びに効くので、
//   Java の HashMap の順番（javaHashMapOrder）をまねて並べる。
import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { getOutputDefs } from "./OutputRegistry.ts";
import type { OutputDef, OutputReturnType } from "./OutputRegistry.ts";
import { ValueHandle } from "./ValueHandle.ts";
import type { JType } from "./ValueHandle.ts";

/** Java の String.hashCode（int） */
export function javaStringHash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++)
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}

/**
 * Java の HashMap<String, …> に keys をこの順で入れたときの、取り出しの順番（keySet・values の順）。
 * 表の大きさは 16 から始まり、要素の数が 0.75 倍を超えると 2 倍になる。同じ箱の中は入れた順。
 * （同じ箱に 8 つ以上入って木になる場合は考えない）
 */
export function javaHashMapOrder(keys: string[]): string[] {
	const uniq: string[] = [];
	const seen = new Set<string>();
	for (const k of keys) {
		if (seen.has(k))
			continue;
		seen.add(k);
		uniq.push(k);
	}
	let cap = 16;
	while (uniq.length > cap * 0.75)
		cap *= 2;
	const idx = (k: string) => {
		const h = javaStringHash(k);
		return (h ^ (h >>> 16)) & (cap - 1);
	};
	return uniq.map((k, i) => ({ k, i, b: idx(k) }))
		.sort((a, b) => a.b - b.b || a.i - b.i)
		.map(e => e.k);
}

/**
 * A data class containing the 'static' (ie: class derived) information for a single output
 */
class OutputHandle_OutputStaticInfo {
	readonly method: OutputDef;
	readonly name: string;
	readonly desc: string;
	readonly reportable: boolean;
	readonly unitType: JClass<Unit>;
	readonly sequence: number;

	constructor(m: OutputDef) {
		this.method = m;
		this.desc = m.description ?? "";
		this.reportable = m.reportable ?? false;
		this.name = m.name;
		this.unitType = (m.unitType ?? DimensionlessUnit) as JClass<Unit>;
		this.sequence = m.sequence ?? 100;
	}
}

/**
 * OutputHandle is a class that represents all the useful runtime information for an output,
 * specifically a reference to the runtime annotation and the method it points to
 * @author matt.chudleigh
 *
 */
export class OutputHandle extends ValueHandle {
	readonly outputInfo: OutputHandle_OutputStaticInfo;
	readonly unitType: JClass<Unit> | null;

	private static readonly outputInfoCache = new Map<JClass, Map<string, OutputHandle_OutputStaticInfo>>();

	private constructor(e: Entity, info: OutputHandle_OutputStaticInfo) {
		super(e);
		this.outputInfo = info;
		if (this.outputInfo.unitType === UserSpecifiedUnit)
			this.unitType = e.getUserUnitType();
		else
			this.unitType = this.outputInfo.unitType;
	}

	// Note: this method will not include attributes in the list. For a complete list use
	// Entity.hasOutput()
	static hasOutput(klass: JClass<Entity>, outputName: string): boolean {
		return OutputHandle.getOutputInfoImp(klass).get(outputName) !== undefined;
	}

	private static getOutputInfoImp(klass: JClass): Map<string, OutputHandle_OutputStaticInfo> {
		let ret = OutputHandle.outputInfoCache.get(klass);
		if (ret !== undefined)
			return ret;

		// klass has not been cached yet, generate info
		// （Java は klass.getMethods() の @Output を集める。TS では OutputRegistry の表から集める）
		// TODO(順番): Java の getMethods() の順番（同じ箱に入った名前どうしの順）は JVM しだい。ここでは登録の順（親から）
		const defs = getOutputDefs(klass);
		const byName = new Map<string, OutputHandle_OutputStaticInfo>();
		for (const m of defs) {
			const info = new OutputHandle_OutputStaticInfo(m);
			byName.set(info.name, info);
		}
		ret = new Map<string, OutputHandle_OutputStaticInfo>();
		for (const name of javaHashMapOrder([...byName.keys()]))
			ret.set(name, byName.get(name)!);
		OutputHandle.outputInfoCache.set(klass, ret);
		return ret;
	}

	static getOutputHandle(e: Entity, outputName: string): OutputHandle | null {
		const info = OutputHandle.getOutputInfoImp(e.constructor as JClass).get(outputName);
		if (info === undefined)
			return null;

		const ret = new OutputHandle(e, info);
		return ret;
	}

	/**
	 * Return a list of the OuputHandles for the given entity.
	 * @param e = the entity whose OutputHandles are to be returned.
	 * @return = ArrayList of OutputHandles.
	 */
	static getAllOutputHandles(e: Entity): ValueHandle[] {
		const klass = e.constructor as JClass;
		const ret: ValueHandle[] = [];
		for (const p of OutputHandle.getOutputInfoImp(klass).values()) {
			const oh = new OutputHandle(e, p);
			ret.push(oh); // required to get the correct unit type for the output
		}

		return ret;
	}

	/**
	 * Returns true if any of the outputs for the specified class will be printed to the
	 * output report.（引数なしなら、この出力が報告に載るか）
	 * @param klass - class whose outputs are to be checked.
	 * @return true if any of the outputs are reportable.
	 */
	static isReportable(klass: JClass<Entity>): boolean {
		for (const p of OutputHandle.getOutputInfoImp(klass).values()) {
			if (p.reportable)
				return true;
		}
		return false;
	}

	/**
	 * Java: klass.isAssignableFrom(method.getReturnType())。
	 * TS では戻り値の型は名前の文字列なので、分かる範囲で調べる（クラスを渡されて見分けられない所は通す）。
	 */
	private static isAssignableReturn(klass: JType | null, retType: OutputReturnType): boolean {
		if (klass === null || klass === undefined || klass === "Object" || klass === Object)
			return true;
		if (typeof klass === "string")
			return klass === retType;
		if (retType === "Entity")
			return jIsAssignableFrom(klass, Entity) || jIsAssignableFrom(Entity, klass);
		// TODO(移植): クラスと名前の文字列（"DoubleVector" など）を比べる手段が無いので、通す
		return true;
	}

	override getValue<T>(simTime: number, klass: JType | null): T {
		let ret: T | null = null;
		if (!OutputHandle.isAssignableReturn(klass, this.outputInfo.method.returnType))
			return null as T;
		try {
			ret = this.outputInfo.method.get(this.ent, simTime) as T;
		}
		catch (ex) {
			// Java: InvocationTargetException → new ErrorException(ex.getTargetException())
			throw new ErrorException(ex);
		}
		return ret as T;
	}

	override canCache(): boolean {
		return true;
	}

	/**
	 * Checks the output for all possible numerical types and returns a double representing the value
	 * getValueAsDouble(simTime, def) と getValueAsDouble(simTime, def, u)。
	 * @param simTime
	 * @param def - the default value if the return is null or not a number value
	 */
	override getValueAsDouble(simTime: number, def: number, u?: Unit | null): number {
		if (u !== undefined) {
			let ret = this.getValueAsDouble(simTime, def);
			const ut = this.getUnitType();
			if (u === null)
				return ret;

			if (u.constructor !== ut)
				throw new ErrorException("Unit Mismatch");

			ret /= u.getConversionFactorToSI();
			return ret;
		}

		const retType = this.getReturnType();

		if (retType === "double") {
			const val = this.getValue<number | null>(simTime, "double");
			if (val === null || val === undefined) return def;  // Java は double なら null にならない
			return val;
		}

		if (retType === "int") {
			const val = this.getValue<number | null>(simTime, "int");
			if (val === null || val === undefined) return def;
			return val;
		}

		if (retType === "boolean") {
			const val = this.getValue<boolean | null>(simTime, "boolean");
			if (val === null || val === undefined) return def;
			return val ? 1.0 : 0.0;
		}

		if (retType === "long") {
			const val = this.getValue<number | null>(simTime, "long");
			if (val === null || val === undefined) return def;
			return val;
		}

		return def;
	}

	override getReturnType(): OutputReturnType {
		return this.outputInfo.method.returnType;
	}

	override getDeclaringClass(): JClass {
		return this.outputInfo.method.declaringClass;
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

	override getDescription(): string {
		return this.outputInfo.desc;
	}

	override getTitle(): string {
		return ClassRegistry.simpleName(this.getDeclaringClass());
	}

	override getName(): string {
		return this.outputInfo.name;
	}

	/** static の isReportable(klass) と同じ名前（こちらは引数なし） */
	override isReportable(): boolean {
		return this.outputInfo.reportable;
	}

	override getSequence(): number {
		return this.outputInfo.sequence;
	}

	override toString(): string {
		return this.getName();
	}
}

