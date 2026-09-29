/*
 * クラスの名前の表（Java の Class.forName と getClass().getName() の代わり）。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * Entity・Unit を継承した抽象でないクラスは、ファイルの最後で
 *   ClassRegistry.register("com.jaamsim.ProcessFlow.Server", Server);
 * と登録する。名前は Java の完全な名前。
 */
import type { JClass } from "./lang.ts";

const byName = new Map<string, JClass>();
const byClass = new Map<JClass, string>();

export const ClassRegistry = {
	register(javaName: string, cls: JClass): void {
		byName.set(javaName, cls);
		byClass.set(cls, javaName);
	},

	/** Class.forName(name)。無ければ null */
	forName(javaName: string): JClass | null {
		return byName.get(javaName) ?? null;
	},

	/** 単純な名前（"Server"）でも探す */
	forSimpleName(simpleName: string): JClass | null {
		for (const [name, cls] of byName)
			if (name.slice(name.lastIndexOf(".") + 1) === simpleName)
				return cls;
		return null;
	},

	/** obj.getClass().getName() / cls.getName() */
	javaName(objOrClass: object): string {
		const cls = (typeof objOrClass === "function" ? objOrClass : objOrClass.constructor) as JClass;
		for (let c: unknown = cls; c; c = Object.getPrototypeOf(c)) {
			const n = byClass.get(c as JClass);
			if (n !== undefined)
				return n;  // 登録の無い子クラス（抽象など）は、登録のある一番近い親の名前
		}
		return (cls as { name?: string }).name ?? "Object";
	},

	/** obj.getClass().getSimpleName() / cls.getSimpleName() */
	simpleName(objOrClass: object): string {
		const n = ClassRegistry.javaName(objOrClass);
		return n.slice(n.lastIndexOf(".") + 1);
	},

	/** 登録されているクラスの一覧 */
	all(): [string, JClass][] {
		return [...byName.entries()];
	},
};
