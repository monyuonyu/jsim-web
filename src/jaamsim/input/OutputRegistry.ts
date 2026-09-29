/*
 * 出力（Java の @Output の付いた関数）の表。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * 使い方（クラスのファイルの最後で）:
 *   defineOutput(LinkedComponent, {
 *     name: "NumberAdded", description: "…", unitType: DimensionlessUnit,
 *     reportable: true, sequence: 1, returnType: "long",
 *     get: (e, simTime) => e.getNumberAdded(simTime),
 *   });
 */
import type { JClass } from "../java/lang.ts";

/** Java の戻り値の型（表示の形を決めるのに使う） */
export type OutputReturnType =
	| "double" | "long" | "int" | "boolean" | "String" | "Entity"
	| "double[]" | "int[]" | "DoubleVector" | "IntegerVector"
	| "ArrayList" | "LinkedHashMap" | "HashMap" | "Vec3d" | "Color4d" | "ExpResult" | "Object";

export interface OutputSpec<T = unknown> {
	name: string;
	description?: string;
	unitType?: JClass;              // 既定は DimensionlessUnit（登録する側で渡す）
	reportable?: boolean;           // 既定 false
	sequence?: number;              // 既定 100
	returnType: OutputReturnType;
	get: (ent: T, simTime: number) => unknown;
}

export interface OutputDef extends OutputSpec<unknown> {
	/** 定義したクラス */
	declaringClass: JClass;
}

const table = new Map<JClass, OutputDef[]>();

export function defineOutput<T>(cls: JClass<T>, spec: OutputSpec<T>): void {
	let list = table.get(cls);
	if (list === undefined) {
		list = [];
		table.set(cls, list);
	}
	list.push({ reportable: false, sequence: 100, description: "", ...spec, declaringClass: cls } as OutputDef);
}

/**
 * クラスとその親の出力を、親から順に集める（同じ名前は子の定義が勝つ）。
 * Java 版 OutputHandle が行う並べ替え（sequence など）は、使う側で行う。
 */
export function getOutputDefs(cls: JClass): OutputDef[] {
	const chain: JClass[] = [];
	for (let c: unknown = cls; c && c !== Function.prototype; c = Object.getPrototypeOf(c))
		chain.unshift(c as JClass);
	const byName = new Map<string, OutputDef>();
	for (const c of chain)
		for (const d of table.get(c) ?? [])
			byName.set(d.name, d);
	return [...byName.values()];
}

/** この名前の出力の定義（無ければ null） */
export function getOutputDef(cls: JClass, name: string): OutputDef | null {
	for (let c: unknown = cls; c && c !== Function.prototype; c = Object.getPrototypeOf(c)) {
		const d = table.get(c as JClass)?.find(o => o.name === name);
		if (d !== undefined)
			return d;
	}
	return null;
}
