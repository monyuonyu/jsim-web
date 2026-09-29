/*
 * 表示の部品（Graphics・DisplayModels）のクラスを、後から名前で引くための表。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * Java には対応するファイルが無い（移植のための補助）。
 *
 * 理由: Java のコードは DisplayEntity が子のクラス（Region・OverlayEntity・EntityLabel）を、
 * DisplayModel が DisplayEntity を、View が Region を…というように、互いに参照している。
 * ES のモジュールでは、読み込みの輪の中で「まだ評価の終わっていないクラスを extends する」と
 * 実行時に誤り（ReferenceError）になる。そこで、親のクラス以外の表示の部品は、実行時には
 * この表から Java の完全な名前で引く（import は型だけにする）。
 *
 * 各クラスはファイルの最後で LateClasses.bind("com.jaamsim.Graphics.Region", Region) と登録する。
 * 表に無い名前は ClassRegistry（抽象でないクラスの表）も探す（CompoundEntity など、他の担当のクラス）。
 * 注意: 登録はそのファイルが読み込まれたときに行われるので、全部のクラスをまとめて読み込む所が要る。
 */
import { ClassRegistry } from "../internal.ts";
import type { JClass } from "../java/lang.ts";

const table = new Map<string, JClass>();

export const LateClasses = {
	/** クラスを登録する（Java の完全な名前で） */
	bind(javaName: string, cls: JClass): void {
		table.set(javaName, cls);
	},

	/** クラスを引く。無ければ null */
	find<T = unknown>(javaName: string): JClass<T> | null {
		const c = table.get(javaName) ?? ClassRegistry.forName(javaName);
		return (c ?? null) as JClass<T> | null;
	},

	/** クラスを引く。無ければ誤り（読み込まれていない） */
	get<T = unknown>(javaName: string): JClass<T> {
		const c = LateClasses.find<T>(javaName);
		if (c === null)
			throw new Error(`LateClasses: class not loaded: ${javaName}`);
		return c;
	},

	/** o instanceof （その名前のクラス）。クラスがまだ読み込まれていなければ false */
	isInstance(o: unknown, javaName: string): boolean {
		const c = LateClasses.find(javaName);
		return c !== null && o instanceof (c as abstract new (...args: never[]) => unknown);
	},
};

// jint は java/lang.ts の物を使う（同じ中身だった）
export { jint } from "../java/lang.ts";

/** Java の List.equals（要素を equals で比べる）。null どうしも同じとみなす */
export function jListEquals(a: readonly unknown[] | null | undefined, b: readonly unknown[] | null | undefined): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const x = a[i], y = b[i];
		if (x === y) continue;
		if (x == null || y == null) return false;
		const eq = (x as { equals?: (o: unknown) => boolean }).equals;
		if (typeof eq !== "function" || !eq.call(x, y)) return false;
	}
	return true;
}
