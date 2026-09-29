/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019 JaamSim Software Inc.
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
// 注（多重定義の扱い）:
// - Java は reset() を上書きしている。reset(ent?) の 1 つにし、ent があれば基底へ任せる（基底の reset(ent) は reset() を呼ぶ）。
// - Java の File は道（パス）の文字列にした（basicsim/FileEntity.ts の JFile と同じ）。getDir() は道の文字列を返す。
import type { Entity } from "../basicsim/Entity.ts";
import { FileSystem, JFile } from "../internal.ts";
import { tr } from "../internal.ts";
import { IllegalArgumentException } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { URI } from "../internal.ts";
import { StringInput } from "../internal.ts";

export class DirInput extends StringInput {
	private dir: URI | null = null;

	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
		this.dir = null;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);

		let temp = Input.parseURI(thisEnt.getJaamSimModel(), kw);

		// If there is no context (e.g. reading from Input Editor),
		// and a config file exists, then resolve the config file uri against this one
		const configFile = thisEnt.getJaamSimModel().getConfigFile();
		if( kw.context === null && configFile !== null ) {
			// Java: getConfigFile().getParentFile().toURI()
			const configDirURI = JFile.toURI(JFile.getParent(configFile), true);
			// Java: URI.resolve(String)（URI.create で作ってから resolve）
			temp = configDirURI.resolve(new URI(temp.getSchemeSpecificPart()));
		}

		try {
			const f = fileFromURI(temp);
			if (fileExists(f) && !isDirectory(f))
				throw new InputErrorException(tr("File Entity parse error: %s is not a directory"), kw.getArg(0));
		}
		catch (e) {
			if (!(e instanceof IllegalArgumentException))
				throw e;
			throw new InputErrorException(tr("Unable to parse the directory:\n%s"), kw.getArg(0));
		}

		this.value = kw.getArg(0);
		this.dir = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_DIR);
	}

	override reset(ent?: Entity): void {
		if (ent !== undefined) {
			super.reset(ent);
			return;
		}
		super.reset();
		this.dir = null;
	}

	/** Java は File を返す。ここでは道の文字列 */
	getDir(): string | null {
		if (this.dir === null) {
			return null;
		}

		try {
			const f = fileFromURI(this.dir);
			return f;
		}
		catch (e) {
			if (!(e instanceof IllegalArgumentException))
				throw e;
		}

		return null;
	}
}

/**
 * Java の new File(URI) の道（File.getPath()）。File にできない URI なら IllegalArgumentException（Java と同じ文）。
 */
export function fileFromURI(uri: URI): string {
	if (!uri.isAbsolute())
		throw new IllegalArgumentException("URI is not absolute");
	if (uri.isOpaque())
		throw new IllegalArgumentException("URI is not hierarchical");
	const scheme = uri.getScheme();
	if (scheme === null || scheme.toLowerCase() !== "file")
		throw new IllegalArgumentException("URI scheme is not \"file\"");
	if (uri.getAuthority() !== null)
		throw new IllegalArgumentException("URI has an authority component");
	if (uri.getFragment() !== null)
		throw new IllegalArgumentException("URI has a fragment component");
	if (uri.getQuery() !== null)
		throw new IllegalArgumentException("URI has a query component");
	let p = uri.getPath() as string;
	if (p === "")
		throw new IllegalArgumentException("URI path component is empty");
	// java.io.File は道を正規化する（"//" を 1 つに、最後の "/" を除く）
	p = p.replace(/\/+/g, "/");
	if (p.length > 1 && p.endsWith("/"))
		p = p.substring(0, p.length - 1);
	return p;
}

type NodeFs = { statSync(p: string, o: { throwIfNoEntry: boolean }): { isDirectory(): boolean } | undefined };

function nodeFs(): NodeFs | undefined {
	const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
	return proc?.getBuiltinModule?.("node:fs") as NodeFs | undefined;
}

/**
 * Java の File.exists()。
 * TODO(移植): Node なら fs で調べ、無ければ FileSystem.backend（FileEntity.ts）で調べる。InputAgent の setFileReader とは別の仕組み
 */
function fileExists(path: string): boolean {
	const fs = nodeFs();
	if (fs !== undefined)
		return fs.statSync(path, { throwIfNoEntry: false }) !== undefined;
	return FileSystem.backend.exists(path);
}

/**
 * Java の File.isDirectory()。
 * TODO(移植): FileSystem.backend にフォルダかどうかを調べる関数が無いので、Node でないときはフォルダとみなす
 */
function isDirectory(path: string): boolean {
	const fs = nodeFs();
	if (fs !== undefined)
		return fs.statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
	return true;
}
