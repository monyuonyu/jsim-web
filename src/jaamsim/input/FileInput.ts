/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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
// - getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分けて 1 つにした（Input.ts と同じ）。
// - getFileNameExtensionFilters() と static の getFileNameExtensionFilters(type, fileExt, fileDesc) は、
//   TS では同じ名前の static と普通の関数を並べて持てるので、名前はそのまま。
// - javax.swing.filechooser.FileNameExtensionFilter は画面の部品だが、中身は説明と拡張子だけなので、
//   同じ名前の小さなクラスをこのファイルに置いた（画面を作るときに使う）。
// - Java の File は道（パス）の文字列（DirInput.ts の fileFromURI）。
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { IllegalArgumentException, jEqualsIgnoreCase } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { fileFromURI } from "./DirInput.ts";
import { Input } from "./Input.ts";
import { InputAgent } from "./InputAgent.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import type { URI } from "./ParseContext.ts";
import { Parser, jtrim } from "./Parser.ts";


export class FileInput extends Input<URI> {
	private fileType: string | null;  // the type of file, e.g. "Image" or "3D"
	private validFileExtensions: string[] | null;  // supported file extensions
	private validFileDescriptions: string[] | null;  // description of each supported file extension
	private ent: Entity | null = null;

	constructor(key: string, cat: string, def: URI | null) {
		super(key, cat, def);
		this.fileType = null;
		this.validFileExtensions = null;
		this.validFileDescriptions = null;
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseURI(thisEnt.getJaamSimModel(), kw);

		// Confirm that the file exists
		if (!InputAgent.fileExists(temp))
			throw new InputErrorException(tr("The specified file does not exist.\n"
					+ "File path = %s\n"
					+ "URI=%s"), kw.getArg(0), temp);

		if (!this.isValidExtension(temp))
			throw new InputErrorException(tr("Invalid file extension: %s.\nValid extensions are: %s"),
					temp.getPath(), arraysToString(this.validFileExtensions));

		this.ent = thisEnt;
		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_FILE);
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.ent === null || this.isDef)
			return;

		toks.push(InputAgent.getRelativeFilePath(this.ent.getJaamSimModel(), this.value));
	}

	static getTokensFromURI(uri: URI): string[][] | null {

		const tokens: string[][] = [];
		let rec: string[] = [];

		// Java: uri.toURL()（絶対でない URI は IllegalArgumentException。これは Java でも捕まえない）
		if (!uri.isAbsolute())
			throw new IllegalArgumentException("URI is not absolute");

		// Java: uri.toURL().openStream() で読む。TS では InputAgent の読み込みの関数で読む
		let text: string;
		try {
			text = InputAgent.getFileReader()(uri);
		}
		catch (e) {
			// MalformedURLException・IOException
			return null;
		}

		for (const line of splitLines(text)) {
			Parser.tokenize(rec, line, true);
			if (rec.length === 0)
				continue;

			tokens.push(rec);
			rec = [];
		}
		return tokens;

	}

	/**
	 * Set the file type description for this file input.
	 *
	 * @param type - description of the file type, for example "Image" or "3D".
	 */
	setFileType(type: string | null): void {
		this.fileType = type;
	}

	/**
	 * Sets the list of supported file extensions for this file input.
	 *
	 * @param ext - array of supported file extensions.
	 */
	setValidFileExtensions(...ext: string[]): void {
		this.validFileExtensions = ext;
	}

	/**
	 * Sets the list of descriptions for the supported file extensions.
	 *
	 * @param desc - array of descriptions for the supported file extensions.
	 */
	setValidFileDescriptions(...desc: string[]): void {
		this.validFileDescriptions = desc;
	}

	private getFileExtention(u: URI): string {
		const name = u.toString();
		const idx = name.lastIndexOf(".");
		if (idx < 0)
			return "";

		return jtrim(name.substring(idx + 1));
	}

	private isValidExtension(u: URI): boolean {
		if (this.validFileExtensions === null)
			return true;

		const ext = this.getFileExtention(u);
		for (const val of this.validFileExtensions) {
			if (jEqualsIgnoreCase(val, ext))
				return true;
		}

		return false;
	}

	/**
	 * Returns an array of file name extension filters, one for each of the
	 * supported file types.
	 *
	 * @return an array of file extension filters.
	 */
	getFileNameExtensionFilters(): FileNameExtensionFilter[] {
		return FileInput.getFileNameExtensionFilters(this.fileType, this.validFileExtensions, this.validFileDescriptions);
	}

	/**
	 * Returns an array of file name extension filters, one for each of the
	 * supported file types.
	 *
	 * @param fileExt - the valid file extension for each type of file.
	 * @param fileDesc - the description field for each type of file.
	 * @return an array of file extension filters.
	 */
	static getFileNameExtensionFilters(type: string | null, fileExt: string[] | null, fileDesc: string[] | null): FileNameExtensionFilter[] {
		let typeFilter: FileNameExtensionFilter | null = null;
		if (type !== null && fileExt !== null) {
			let desc = "";
			desc += "All Supported " + type + " Files (";

			for (let i = 0; i < fileExt.length; i++) {
				if (i > 0)
					desc += "; ";
				desc += "*." + fileExt[i].toLowerCase();
			}
			desc += ")";

			typeFilter = new FileNameExtensionFilter(desc, ...fileExt);
		}

		let temp: FileNameExtensionFilter[] | null = null;
		if (fileExt !== null && fileDesc !== null) {
			temp = [];
			for (let i = 0; i < fileExt.length; i++) {
				// Java では fileDesc が短いと ArrayIndexOutOfBoundsException
				if (i >= fileDesc.length)
					throw new RangeError("Index " + i + " out of bounds for length " + fileDesc.length);
				temp[i] = new FileNameExtensionFilter(fileDesc[i], fileExt[i]);
			}
		}

		const ret: FileNameExtensionFilter[] = [];

		if (typeFilter !== null) {
			ret.push(typeFilter);
		}

		if (temp !== null) {
			for (let i = 0; i < temp.length; i++) {
				ret.push(temp[i]);
			}
		}

		return ret;
	}

	override getValue(): URI | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		const val = this.getValue();
		if (val === null)
			return "";
		// Java: new File(getValue()).getPath()
		const file = fileFromURI(val);
		return file;
	}

	override getReturnType(): OutputReturnType | null {
		return "String";
	}
}

/**
 * javax.swing.filechooser.FileNameExtensionFilter の代わり（説明と拡張子だけ）。
 * 描画: ファイルを選ぶ画面は、three.js の画面を作るときに。
 */
export class FileNameExtensionFilter {
	private readonly description: string;
	private readonly extensions: string[];
	private readonly lowerCaseExtensions: string[];

	constructor(description: string, ...extensions: string[]) {
		if (extensions === null || extensions.length === 0)
			throw new IllegalArgumentException("Extensions must be non-null and not empty");
		this.description = description;
		this.extensions = [];
		this.lowerCaseExtensions = [];
		for (let i = 0; i < extensions.length; i++) {
			if (extensions[i] === null || extensions[i] === undefined || extensions[i].length === 0)
				throw new IllegalArgumentException("Each extension must be non-null and not empty");
			this.extensions[i] = extensions[i];
			this.lowerCaseExtensions[i] = extensions[i].toLowerCase();
		}
	}

	getDescription(): string {
		return this.description;
	}

	getExtensions(): string[] {
		return [...this.extensions];
	}

	/** 道の文字列（ファイル名）が、どれかの拡張子で終わるか（Java の accept(File)。フォルダの扱いは省いた） */
	accept(path: string): boolean {
		const i = path.lastIndexOf(".");
		if (i > 0 && i < path.length - 1) {
			const desiredExtension = path.substring(i + 1).toLowerCase();
			for (const extension of this.lowerCaseExtensions) {
				if (desiredExtension === extension)
					return true;
			}
		}
		return false;
	}

	toString(): string {
		return "javax.swing.filechooser.FileNameExtensionFilter[description=" + this.description
				+ " extensions=[" + this.extensions.join(", ") + "]]";
	}
}

/** Java の Arrays.toString(Object[]) */
function arraysToString(a: string[] | null): string {
	if (a === null)
		return "null";
	return "[" + a.join(", ") + "]";
}

/** Java の BufferedReader.readLine で 1 行ずつに分ける（\n、\r、\r\n。最後の改行の後の空の行は数えない） */
function splitLines(text: string): string[] {
	if (text.length === 0)
		return [];
	const lines = text.split(/\r\n|\r|\n/);
	if (/(\r\n|\r|\n)$/.test(text))
		lines.pop();
	return lines;
}
