// 注（移植の方針）:
// - ファイルの読み込みは差し替えられる（setFileReader）。既定は Node.js の fs（ブラウザでは setFileReader で渡す）。
//   読み込みの関数は URI を受けて、中身の文字列を返す（読めなければ例外を投げる）。
// - "<res>/" で始まる道は、resRoot（setResRoot で変えられる）の下を読む。
// - Java の File は道の文字列、BufferedReader は中身の文字列、PrintStream は PrintStream（このファイルの interface）で受ける。
// - 多重定義: apply(ent, kw) と apply(ent, in, kw) は引数の数で、printReport(ent, file, simTime) と
//   printReport(simModel, simTime, file) は最初の引数が Entity かどうかで見分ける。
// - 入れ子の SubModelComparator・EntityComparator は、関数（compare も持つ）の subModelSortOrder・uiEntitySortOrder にした。
// - 利用者に見せる文: simModel.logError・logInpError は中で tr するので、英語のまま渡す。InputErrorException は tr で包む。
import { jformat, jstr, jCompare, jEqualsIgnoreCase, jIsAssignableFrom, NullPointerException } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { AbstractDirectedEntity } from "../Graphics/AbstractDirectedEntity.ts";
import { EntityLabel } from "../Graphics/EntityLabel.ts";
import type { SampleStatistics } from "../Statistics/SampleStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import { FileEntity, JFile } from "../basicsim/FileEntity.ts";
import { Group } from "../basicsim/Group.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ObjectType } from "../basicsim/ObjectType.ts";
import type { Scenario } from "../basicsim/Scenario.ts";
import type { SimRun } from "../basicsim/SimRun.ts";
import { Simulation } from "../basicsim/Simulation.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import { ExpResType } from "./ExpResType.ts";
import { ExpResult } from "./ExpResult.ts";
import { FileInput } from "./FileInput.ts";
import { Input, javaToString } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import { KeywordIndex } from "./KeywordIndex.ts";
import { ParseContext, URI, URISyntaxException } from "./ParseContext.ts";
import { Parser, jsplit, jtrim } from "./Parser.ts";
import type { ValueHandle } from "./ValueHandle.ts";

/** Java の PrintStream の代わり（使う所だけ） */
export interface PrintStream {
	println(s: string): void;
	format(fmt: string, ...args: unknown[]): void;
}

/** ファイルを読む関数（URI → 中身の文字列。読めなければ例外） */
export type FileReaderFn = (uri: URI) => string;

/** 並べ方の関数（Array.sort に渡せる。Java の Comparator のように compare も持つ） */
export type SortOrder<T> = ((a: T, b: T) => number) & { compare(a: T, b: T): number };

function makeSortOrder<T>(cmp: (a: T, b: T) => number): SortOrder<T> {
	const f = ((a: T, b: T) => cmp(a, b)) as SortOrder<T>;
	f.compare = cmp;
	return f;
}

/** 既定の読み込み: Node.js の fs（file: だけ）。BOM は Java と同じく残す */
function defaultFileReader(uri: URI): string {
	if (uri.getScheme() !== "file")
		throw new Error("unknown protocol: " + uri.getScheme());
	const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
	const fs = proc?.getBuiltinModule?.("node:fs") as { readFileSync(p: string): Uint8Array } | undefined;
	if (fs === undefined)
		throw new Error("no file reader (use InputAgent.setFileReader)");
	const path = uri.getPath() as string;
	let buf: Uint8Array;
	try {
		buf = fs.readFileSync(path);
	}
	catch (e) {
		// Java の FileNotFoundException と同じ形の文にする
		const code = (e as { code?: string }).code;
		if (code === "ENOENT")
			throw new Error(`${path} (No such file or directory)`);
		if (code === "EISDIR")
			throw new Error(`${path} (Is a directory)`);
		if (code === "EACCES")
			throw new Error(`${path} (Permission denied)`);
		throw e;
	}
	return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf);
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

function arraysEquals(a: (string | null)[] | null, b: (string | null)[] | null): boolean {
	if (a === b)
		return true;
	if (a === null || b === null)
		return false;
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++)
		if (a[i] !== b[i])
			return false;
	return true;
}

/** Boolean.compare */
function booleanCompare(x: boolean, y: boolean): number {
	return (x === y) ? 0 : (x ? 1 : -1);
}

/** Integer.compare */
function integerCompare(x: number, y: number): number {
	return (x < y) ? -1 : ((x === y) ? 0 : 1);
}

/** Java の URLDecoder.decode(s, UTF-8)（+ は空白） */
function urlDecode(s: string): string {
	return decodeURIComponent(s.replace(/\+/g, " "));
}

/**
 * String.format(floatFmt, x)（x は double）。
 * 書式が %s のときは Java の Double.toString と同じ形にする（jformat は数を %s にすると整数の形になるため）。
 */
function formatDouble(floatFmt: string, x: number): string {
	if (/%(\d+\$)?[-#+ 0,(]*\d*(\.\d+)?[sS]/.test(floatFmt))
		return jformat(floatFmt, jstr(x));
	return jformat(floatFmt, x);
}

export class InputAgent {
	private static readonly recordEditsMarker = "RecordEdits";

	static readonly INP_ERR_DEFINEUSED = "The name: %s has already been used and is a %s";
	static readonly INP_ERR_BADNAME = "An entity name cannot be blank or contain "
	                                  + "spaces, tabs, braces, single or double quotes,\n"
	                                  + "square brackets, hash characters, or periods.\n"
	                                  + "Name: %s";
	private static readonly INP_ERR_BADPARENT = "The parent entity [%s] has not been defined.";
	static readonly INVALID_ENTITY_CHARS: string[] = [" ", "\t", "\n", "{", "}", "'", "\"", "[", "]", "#", "."];

	static readonly EARLY_KEYWORDS: string[] = [ "Prototype",
	                                             "TickLength",
	                                             "ConversionFactorToSI",
	                                             "UnitType", "UnitTypeList", "OutputUnitType",
	                                             "SecondaryUnitType", "XAxisUnitType",
	                                             "GregorianCalendar", "StartDate", "DataFile",
	                                             "AttributeDefinitionList", "CustomOutputList",
	                                             "KeywordList"];
	private static readonly GRAPHICS_PALETTES: string[] = ["Graphics Objects", "View", "Display Models"];
	private static get GRAPHICS_CATEGORIES(): string[] {
		return [Entity.GRAPHICS, Entity.FONT, Entity.FORMAT, Entity.GUI];
	}

	private static readonly COMMA_SEPARATOR = ", ";

	private static readonly MAX_BRACE_DEPTH = 3;

	private static getBraceDepth(simModel: JaamSimModel, tokens: string[], startingBraceDepth: number, startingIndex: number): number {
		let braceDepth = startingBraceDepth;
		for (let i = startingIndex; i < tokens.length; i++) {
			const token = tokens[i];

			if (token === "{")
				braceDepth++;

			if (token === "}")
				braceDepth--;
		}

		return braceDepth;
	}

	/**
	 * 資源のフォルダ（Java では jar の中の /resources/）。
	 * TODO(移植): 既定は、この機体の JaamSim の源の資源のフォルダ。ブラウザなどでは setResRoot で差し替える
	 */
	private static resRoot: URI = new URI("file", "/home/shota/jaamsim-src/src/main/resources/resources/", null).normalize();

	private static fileReader: FileReaderFn = defaultFileReader;

	/** ファイルを読む関数を差し替える（ブラウザ・試験用） */
	static setFileReader(fn: FileReaderFn): void {
		InputAgent.fileReader = fn;
	}

	static getFileReader(): FileReaderFn {
		return InputAgent.fileReader;
	}

	/** 資源のフォルダ（"<res>/" の行き先）を変える。最後は "/" で終える */
	static setResRoot(uri: URI): void {
		InputAgent.resRoot = new URI(uri.getScheme(), uri.getSchemeSpecificPart(), null).normalize();
	}

	static getResRoot(): URI {
		return InputAgent.resRoot;
	}

	private static rethrowWrapped(ex: unknown): never {
		let causedStack = "";
		const stack = (ex as { stack?: string }).stack;
		if (stack !== undefined)
			for (const elm of stack.split("\n").slice(1))
				causedStack += elm.trim() + "\n";
		throw new InputErrorException(tr("Caught exception: %s"), ErrorException.messageOf(ex) + "\n" + causedStack);
	}

	static readResource(simModel: JaamSimModel, res: string | null): void {
		if (res === null)
			return;

		try {
			InputAgent.readStream(simModel, null, null, res);
		}
		catch (ex) {
			if (!(ex instanceof URISyntaxException))
				throw ex;
			InputAgent.rethrowWrapped(ex);
		}

	}

	/**
	 * Reads model inputs from the specified source.
	 * <p>
	 * The specified file path string can be absolute or relative to a reference folder.
	 * It can also contain the keyword '&LTres&GT' for the case of a resource file.
	 * In the case of a relative file path, a 'context' folder must be specified.
	 * A 'context' of null indicates an absolute file path.
	 * A 'jailPrefix' of null indicates no restriction.
	 * <p>
	 * @param simModel - simulation model to be populated
	 * @param jailPrefix - file path to a base folder from which a relative path cannot escape
	 * @param context - URI for the folder that is the reference for relative file paths
	 * @param filePath - file path string for the model inputs
	 * @return true if the inputs were read
	 * @throws URISyntaxException
	 */
	static readStream(simModel: JaamSimModel, jailPrefix: string | null, context: URI | null,
			filePath: string): boolean {
		const resolved = InputAgent.getFileURI(simModel, context, filePath, jailPrefix);
		if (resolved === null)
			throw new NullPointerException();  // Java: resolved.normalize() で NullPointerException

		// Java: resolved.normalize().toURL()（絶対でない URI は MalformedURLException）
		const url: URI = resolved.normalize();
		if (!url.isAbsolute())
			InputAgent.rethrowWrapped(new Error("URI is not absolute"));

		let text: string;
		try {
			text = InputAgent.fileReader(url);
		} catch (e) {
			simModel.logError("Could not read from url: '%s'%n%s", url.toString(), ErrorException.messageOf(e));
			return false;
		}

		InputAgent.readBufferedStream(simModel, text, resolved, jailPrefix);
		return true;
	}

	/**
	 * Java は BufferedReader を受ける。TS では中身の文字列（buf）を受け、Java の readLine と同じに行に分ける。
	 */
	static readBufferedStream(simModel: JaamSimModel, buf: string, resolved: URI | null, root: string | null): void {

		const record: string[] = [];
		let braceDepth = 0;
		let quoted = false;
		let firstLine = "";

		const pc = new ParseContext(resolved, root);

		let line = "";
		for (const str of splitLines(buf)) {
			line = str;

			if (record.length === 0 && line.length > 0)
				firstLine = line;

			const previousRecordSize = record.length;
			quoted = Parser.tokenize(record, line, quoted, true);

			// Print the inputs to the .log file
			simModel.logFileMessage(line);

			// Keep reading the input file until the opening and closing braces are matched
			braceDepth = InputAgent.getBraceDepth(simModel, record, braceDepth, previousRecordSize);

			if (braceDepth < 0 || braceDepth > InputAgent.MAX_BRACE_DEPTH) {
				simModel.logError("Invalid brace depth: %s", braceDepth);
				record.length = 0;
				braceDepth = 0;
				quoted = false;
			}

			if( braceDepth > 0 || quoted || record.length === 0)
				continue;

			// Process the input lines

			if (jEqualsIgnoreCase("DEFINE", record[0])) {
				InputAgent.processDefineRecord(simModel, record);
				record.length = 0;
				continue;
			}

			if (jEqualsIgnoreCase("INCLUDE", record[0])) {
				try {
					InputAgent.processIncludeRecord(simModel, pc, record);
				}
				catch (ex) {
					if (!(ex instanceof URISyntaxException))
						throw ex;
					InputAgent.rethrowWrapped(ex);
				}
				record.length = 0;
				continue;
			}

			if (jEqualsIgnoreCase("RECORDEDITS", record[0])) {
				simModel.setRecordEditsFound(true);
				simModel.setRecordEdits(true);
				record.length = 0;
				continue;
			}

			// Otherwise assume it is a Keyword record
			InputAgent.processKeywordRecord(simModel, [...record], pc);
			record.length = 0;
		}

		// Leftover Input at end of file
		if (record.length > 0) {
			let sb = "";
			sb += "File ended before the last model input was completed:%n";
			if (braceDepth > 0)
				sb += "- missing a closing brace ('}')%n";
			if (quoted)
				sb += "- missing a closing single quote (')%n";
			sb += "The bad input began with the following line:%n";
			// TODO(移植): Java も firstLine を書式の中に入れている（% があると書式として読まれる）。訳の辞書に載るのは定まった部分だけ
			sb += firstLine;
			simModel.logError(sb);
		}
	}

	/** @throws URISyntaxException */
	private static processIncludeRecord(simModel: JaamSimModel, pc: ParseContext, record: string[]): void {
		if (record.length !== 2) {
			simModel.logError("Bad Include record, should be: Include <File>");
			return;
		}
		InputAgent.readStream(simModel, pc.jail, pc.context, record[1].replace(/\\/g, "/"));
	}

	private static processDefineRecord(simModel: JaamSimModel, record: string[]): void {
		if (record.length < 5 ||
		    record[2] !== "{" ||
		    record[record.length - 1] !== "}") {
			simModel.logError("Bad Define record, should be: Define <Type> { <names>... }");
			return;
		}

		let klass: JClass<Entity> | null = null;
		let proto: Entity | null = null;
		try {
			if( jEqualsIgnoreCase(record[ 1 ], "ObjectType") ) {
				klass = ObjectType;
			}
			else {
				const type = simModel.getNamedEntity(record[1]);
				if (type === null)
					throw new InputErrorException(tr("Entity type not found: %s"), record[1]);

				if (type instanceof ObjectType) {
					klass = Input.parseEntityType(simModel, record[1]);
				}
				else {
					proto = type;
					klass = proto.constructor as JClass<Entity>;
				}
			}
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
			simModel.logError("%s", e.getMessage());
			return;
		}

		// Loop over all the new Entity names
		for (let i = 3; i < record.length - 1; i++) {
			InputAgent.defineEntity(simModel, klass, proto, record[i], simModel.isRecordEdits());
		}
	}

	static generateEntityWithName<T extends Entity>(simModel: JaamSimModel, klass: JClass<T>, proto: Entity | null, key: string | null, parent: Entity | null,
			reg: boolean, retain: boolean): T {
		if (key === null)
			throw new ErrorException("Must provide a name for generated Entities");

		if (!InputAgent.isValidName(key))
			throw new ErrorException(InputAgent.INP_ERR_BADNAME, key);

		const ent = simModel.createInstance(klass, proto, key, parent, false, true, reg, retain);
		if (ent === null)
			throw new ErrorException("Could not create new Entity: %s", key);

		return ent;
	}

	static getGeneratedClone(proto: Entity, name: string): Entity {
		const ret = proto.getCloneFromPool();
		if (ret === null)
			return InputAgent.generateEntityWithName(proto.getJaamSimModel(),
					proto.constructor as JClass<Entity>, proto, name, null, false, false);

		ret.setNameInput(name);
		return ret;
	}

	static getUniqueName(sim: JaamSimModel, name: string, sep: string): string {

		// Is the provided name unused?
		if (sim.getNamedEntity(name) === null)
			return name;

		// Try the provided name plus "1", "2", etc. until an unused name is found
		let entityNum = 1;
		while(true) {
			const ret = jformat("%s%s%d", name, sep, entityNum);
			if (sim.getNamedEntity(ret) === null) {
				return ret;
			}
			entityNum++;
		}
	}

	/**
	 * Creates a new entity with a unique name. If an entity already exists with the specified
	 * base name, a separator will be appended followed by the smallest integer required to make
	 * the name unique. If addedEntity is true then this is an entity defined by user interaction
	 * or after the 'AddedRecord' flag is found in the configuration file.
	 * @param simModel - JaamSimModel in which to create the entity
	 * @param klass - class for the entity to be created
	 * @param proto - prototype for the newly defined Entity
	 * @param key - base absolute name for the entity to be created
	 * @param sep - string to append to the name if it is already in use
	 * @param addedEntity - true if the entity is new to the model
	 * @return new entity
	 */
	static defineEntityWithUniqueName<T extends Entity>(simModel: JaamSimModel, klass: JClass<T>, proto: Entity | null, key: string, sep: string, addedEntity: boolean): T | null {
		const name = InputAgent.getUniqueName(simModel, key, sep);
		return InputAgent.defineEntity(simModel, klass, proto, name, addedEntity);
	}

	static isValidName(key: string): boolean {
		if (key.length === 0)
			return false;
		for (let i = 0; i < key.length; ++i) {
			const c = key.charAt(i);
			for (const invChar of InputAgent.INVALID_ENTITY_CHARS) {
				if (c === invChar)
					return false;
			}
		}
		return true;
	}

	/**
	 * Creates a new entity with the specified name. If addedEntity is true then this is an entity
	 * defined by user interaction or after the 'AddedRecord' flag is found in the configuration
	 * file.
	 * @param simModel - JaamSimModel in which to create the entity
	 * @param klass - class for the entity to be created
	 * @param proto - prototype for the entity
	 * @param key - absolute name for the entity to be created
	 * @param addedEntity - true if the entity is new to the model
	 * @return new entity
	 */
	private static defineEntity<T extends Entity>(simModel: JaamSimModel, klass: JClass<T>, proto: Entity | null, key: string, addedEntity: boolean): T | null {
		const existingEnt = Input.tryParseEntity(simModel, key, Entity);
		if (existingEnt !== null) {
			if (existingEnt.getName() === "Grid100x100")  // For backward compatibility with old models
				return null;
			simModel.logError(InputAgent.INP_ERR_DEFINEUSED, key, ClassRegistry.simpleName(existingEnt));
			return null;
		}

		let parent: Entity | null = null;
		let localName = key;

		if (key.includes(".")) {
			let names = jsplit(key, "\\.");
			localName = names[names.length - 1];
			names = names.slice(0, names.length - 1);
			parent = simModel.getEntityFromNames(names);
			if (parent === null) {
				const parentName = key.substring(0, key.length - localName.length - 1);
				simModel.logError(InputAgent.INP_ERR_BADPARENT, parentName);
				return null;
			}
		}

		if (!InputAgent.isValidName(localName)) {
			simModel.logError(InputAgent.INP_ERR_BADNAME, localName);
			return null;
		}

		const ent = simModel.createInstance(klass, proto, localName, parent, addedEntity, false, true, true);

		if (ent === null) {
			simModel.logError("Could not create new child Entity: %s for parent: %s", localName, parent);
			return null;
		}

		return ent;
	}

	static processKeywordRecord(simModel: JaamSimModel, record: string[], context: ParseContext | null): void {
		const ent = Input.tryParseEntity(simModel, record[0], Entity);
		if (ent === null) {
			simModel.logError("Could not find Entity: %s", record[0]);
			return;
		}

		// Validate the tokens have the Entity Keyword { Args... } Keyword { Args... }
		const words = InputAgent.getKeywords(record, context);
		for (const keyword of words) {
			try {
				InputAgent.processKeyword(ent, keyword);
			}
			catch (e) {
				const msg = ErrorException.messageOf(e);
				simModel.logInpError("Entity: %s, Keyword: %s - %s", ent.getName(), keyword.keyword, msg);
				// Java の NullPointerException などは文が null。JS の TypeError・RangeError も同じ扱いにする
				if (msg === null || e instanceof TypeError || e instanceof RangeError) {
					simModel.logStackTrace(e);
				}
			}
		}
	}

	private static getKeywords(input: string[], context: ParseContext | null): KeywordIndex[] {
		const ret: KeywordIndex[] = [];

		let braceDepth = 0;
		let keyWordIdx = 1;
		for (let i = 1; i < input.length; i++) {
			const tok = input[i];
			if ("{" === tok) {
				braceDepth++;
				continue;
			}

			if ("}" === tok) {
				braceDepth--;
				if (braceDepth === 0) {
					// validate keyword form
					const keyword = input[keyWordIdx];
					if (keyword === "{" || keyword === "}" || input[keyWordIdx + 1] !== "{")
						throw new InputErrorException(tr("The input for a keyword must be enclosed by braces. Should be <keyword> { <args> }"));

					ret.push(new KeywordIndex(keyword, input, keyWordIdx + 2, i, context));
					keyWordIdx = i + 1;
					continue;
				}
			}
		}

		if (keyWordIdx !== input.length)
			throw new InputErrorException(tr("The input for a keyword must be enclosed by braces. Should be <keyword> { <args> }"));

		return ret;
	}

	/**
	 * Prepares the keyword and input value for processing.
	 *
	 * @param ent - the entity whose keyword and value has been entered.
	 * @param keyword - the keyword.
	 * @param args - the input value String for the keyword.
	 */
	static applyArgs(ent: Entity, keyword: string, ...args: string[]): void {
		const kw = KeywordIndex.formatArgs(keyword, ...args);
		InputAgent.apply(ent, kw);
	}

	static applyVec3d(ent: Entity, keyword: string, point: Vec3d, ut: JClass<Unit>): void {
		const kw = KeywordIndex.formatVec3dInput(ent, keyword, point, ut);
		InputAgent.apply(ent, kw);
	}

	static applyBoolean(ent: Entity, keyword: string, bool: boolean): void {
		const kw = KeywordIndex.formatBoolean(keyword, bool);
		InputAgent.apply(ent, kw);
	}

	static applyIntegers(ent: Entity, keyword: string, ...args: number[]): void {
		const kw = KeywordIndex.formatIntegers(keyword, ...args);
		InputAgent.apply(ent, kw);
	}

	static applyValue(ent: Entity, keyword: string, val: number, unit: string | null): void {
		const kw = KeywordIndex.formatValue(keyword, val, unit);
		InputAgent.apply(ent, kw);
	}

	/**
	 * apply(ent, kw) … キーワードの名前から入力を探して設定する。
	 * apply(ent, in, kw) … 入力に設定する。
	 */
	static apply(ent: Entity, kw: KeywordIndex): void;
	static apply(ent: Entity, inp: Input<unknown>, kw: KeywordIndex): void;
	static apply(ent: Entity, a: KeywordIndex | Input<unknown>, b?: KeywordIndex): void {
		if (a instanceof KeywordIndex) {
			const kw0 = a;
			const inp = ent.getInput(kw0.keyword);
			if (inp === null) {
				const msg = jformat(tr("Keyword '%s' could not be found"), kw0.keyword);
				throw new ErrorException(ent, msg);
			}
			InputAgent.apply(ent, inp, kw0);
			return;
		}
		const inp = a;
		let kw = b as KeywordIndex;

		if (inp.isLocked() && !ent.isGenerated()) {
			throw new InputErrorException(tr("Input value is locked"));
		}

		let defaultInheritedTokens: string[] | null = null;
		let inheritedTokens: string[] | null = null;
		if (ent.isClone()) {
			defaultInheritedTokens = [...inp.getInheritedValueArray()];
			inheritedTokens = ent.getInheritedValueTokens(inp);
		}

		// Restore the default if the input value is blank or is equal to its inherited value
		let changed = true;
		if (kw.numArgs() === 0 || (ent.isClone()
				&& arraysEquals(inp.getInheritedValueArray(), kw.getArgArray()))) {
			if (inp.getIsDef())
				changed = false;
			inp.reset(ent);

			// Set the inherited value if the input value is blank
			if (ent.isClone() && kw.numArgs() === 0
					&& !arraysEquals(inheritedTokens as string[], defaultInheritedTokens)) {
				kw = new KeywordIndex(kw.keyword, inheritedTokens as string[], kw.context);
				inp.parse(ent, kw);
				inp.setTokens(kw);
			}
		}

		// Ignore the input if it is the same as the present value
		else if (arraysEquals(inp.valueTokens, kw.getArgArray())) {
			changed = false;
		}

		// Otherwise, set the new input value
		else {
			inp.parse(ent, kw);
			inp.setTokens(kw);
		}

		// Mark the input explicitly as 'inherited' if it had to be changed from its inherited
		// value because of a reference to its parent SubModel
		inp.setInherited(ent.isClone() && !inp.getIsDef()
				&& arraysEquals(inp.getValueTokenList(), inheritedTokens));

		// Only mark the keyword edited if we have finished initial configuration
		const simModel = ent.getJaamSimModel();
		if (changed && simModel.isRecordEdits() && !inp.isInherited()) {
			inp.setEdited(true);
			ent.setEdited();
		}

		// Execute the input callback for the entity
		inp.doCallback(ent);

		// Copy the input value to any clones
		for (const clone of ent.getAllClones()) {
			clone.copyInput(ent, inp.getKeyword(), kw.context);
		}

		// Refresh the graphics
		const gui = ent.getJaamSimModel().getGUIListener();
		if (gui !== null)
			gui.updateAll();
	}

	static processKeyword(entity: Entity, key: KeywordIndex): void {
		const input = entity.getInput( key.keyword );
		if (input !== null) {
			InputAgent.apply(entity, input, key);
			return;
		}

		if (!(entity instanceof Group))
			throw new InputErrorException(tr("Not a valid keyword"));

		const grp = entity;
		grp.saveGroupKeyword(key);

		// Store the keyword data for use in the edit table
		for (const ent of grp.getList()) {
			InputAgent.apply(ent, key);
		}
	}

	/** 入力の報告の 1 行（Key Inputs とそれ以外で同じ処理） */
	private static writeInputReportEntry(inputReportFile: FileEntity, entityName: string, inp: Input<unknown>, valueString: string): void {
		inputReportFile.write("\t");
		inputReportFile.write(entityName);
		inputReportFile.write("\t");
		inputReportFile.write(inp.getKeyword());
		inputReportFile.write("\t");
		if (valueString.lastIndexOf("{") > 10) {
			const item1Array = jsplit(jtrim(valueString), " }");

			inputReportFile.write("{ " + item1Array[0] + " }");
			for (let l = 1; l < (item1Array.length); l++) {
				inputReportFile.newLine();
				inputReportFile.write("\t\t\t\t\t");
				inputReportFile.write(item1Array[l] + " } ");
			}
			inputReportFile.write("	}");
		}
		else {
			inputReportFile.write("{ " + valueString + " }");
		}
		inputReportFile.newLine();
	}

	/*
	 * write input file keywords and values
	 *
	 * input file format:
	 *  Define Group { <Group names> }
	 *  Define <Object> { <Object names> }
	 *
	 *  <Object name> <Keyword> { < values > }
	 *
	 */
	static printInputFileKeywords(simModel: JaamSimModel): void {

		// Create report file for the inputs
		const fileName = simModel.getReportFileName(".inp");
		if (fileName === null)
			throw new ErrorException("Cannot create the input report file");
		const f = fileName;
		if (JFile.exists(f) && !JFile.delete(f))
			throw new ErrorException("Cannot delete the existing input report file %s", f);
		const inputReportFile = new FileEntity(simModel, f);

		const objectTypes: ObjectType[] = [];
		for (const type of simModel.getObjectTypes())
			objectTypes.push( type );

		// Sort ObjectTypes by Units, Simulation, and then alphabetically by palette name
		objectTypes.sort((a: ObjectType, b: ObjectType): number => {

			// Put Unit classes first
			if (jIsAssignableFrom(Unit, a.getJavaClass())) {
				if (jIsAssignableFrom(Unit, b.getJavaClass()))
					return 0;
				else
					return -1;
			}
			if (jIsAssignableFrom(Unit, b.getJavaClass())) {
					return 1;
			}

			// Put Simulation classes second
			if (jIsAssignableFrom(Simulation, a.getJavaClass())) {
				if (jIsAssignableFrom(Simulation, b.getJavaClass()))
					return 0;
				else
					return -1;
			}
			if (jIsAssignableFrom(Simulation, b.getJavaClass())) {
					return 1;
			}

			// Sort the rest alphabetically by palette name
			return jCompare(a.getLibraryName(), b.getLibraryName());
		});

		// Loop through the entity classes printing Define statements
		for (const type of objectTypes) {
			const each = type.getJavaClass() as JClass<Entity>;

			// Loop through the instances for this entity class
			let count = 0;
			for (const ent of simModel.getInstanceIterator(each)) {
				if (simModel.isPreDefinedEntity(ent))
					continue;

				count++;

				const entityName = ent.getName();
				if ((count - 1) % 5 === 0) {
					inputReportFile.write("Define");
					inputReportFile.write("\t");
					inputReportFile.write(type.getName());
					inputReportFile.write("\t");
					inputReportFile.write("{ " + entityName);
					inputReportFile.write("\t");
				}
				else if ((count - 1) % 5 === 4) {
					inputReportFile.write(entityName + " }");
					inputReportFile.newLine();
				}
				else {
					inputReportFile.write(entityName);
					inputReportFile.write("\t");
				}
			}

			if (count % 5 !== 0) {
				inputReportFile.write(" }");
				inputReportFile.newLine();
			}
			if (count > 0)
				inputReportFile.newLine();
		}

		for (const type of objectTypes) {
			const each = type.getJavaClass() as JClass<Entity>;

			// Get the list of instances for this entity class
			// sort the list alphabetically
			const cloneList: Entity[] = [];
			for (const ent of simModel.getInstanceIterator(each)) {
				if (simModel.isPreDefinedEntity(ent)) {
					if (! (ent instanceof Simulation) ) {
						continue;
					}
				}

				cloneList.push(ent);
			}

			// Print the entity class name to the report (in the form of a comment)
			if (cloneList.length > 0) {
				inputReportFile.write("\" " + ClassRegistry.simpleName(each) + " \"");
				inputReportFile.newLine();
				inputReportFile.newLine(); // blank line below the class name heading
			}

			cloneList.sort((a: Entity, b: Entity): number => jCompare(a.getName(), b.getName()));

			// Loop through the instances for this entity class
			for (let j = 0; j < cloneList.length; j++) {

				// Make sure the clone is an instance of the class (and not an instance of a subclass)
				if (cloneList[j].constructor !== each)
					continue;

				const ent = cloneList[j];
				const entityName = ent.getName();
				let hasinput = false;

				// Loop through the editable Key Inputs for this instance
				for (const inp of ent.getEditableInputs()) {
					if (inp.isSynonym())
						continue;

					// If the keyword has been used, then add a record to the report
					const valueString = inp.getValueString();
					if (valueString.length === 0)
						continue;

					if (! inp.getCategory().includes(Entity.KEY_INPUTS))
						continue;

					hasinput = true;
					InputAgent.writeInputReportEntry(inputReportFile, entityName, inp, valueString);
				}

				// Loop through the editable keywords
				// (except for Key Inputs) for this instance
				for (const inp of ent.getEditableInputs()) {
					if (inp.isSynonym())
						continue;

					// If the keyword has been used, then add a record to the report
					const valueString = inp.getValueString();
					if (valueString.length === 0)
						continue;

					if (inp.getCategory().includes(Entity.KEY_INPUTS))
						continue;

					hasinput = true;
					InputAgent.writeInputReportEntry(inputReportFile, entityName, inp, valueString);
				}

				// Put a blank line after each instance
				if (hasinput) {
					inputReportFile.newLine();
				}
			}
		}

		// Close out the report
		inputReportFile.flush();
		inputReportFile.close();
	}

	/**
	 * Prints the present state of the model to a new configuration file.
	 *
	 * @param f - the full path and file name for the new configuration file.（Java の File。TS では道の文字列）
	 */
	static printNewConfigurationFileWithName(simModel: JaamSimModel, f: string): void {

		// 1) WRITE LINES FROM THE ORIGINAL CONFIGURATION FILE

		// Copy the original configuration file up to the "RecordEdits" marker (if present)
		// Temporary storage for the copied lines is needed in case the original file is to be overwritten
		const preAddedRecordLines: string[] = [];
		const configFile = simModel.getConfigFile();
		if( configFile !== null ) {
			try {
				// Java は FileReader で読む。TS では読み込みの関数（setFileReader）で読む
				const text = InputAgent.fileReader(JFile.toURI(configFile, false));
				for (const line of splitLines(text)) {
					preAddedRecordLines.push( line );
					if ( line.startsWith( InputAgent.recordEditsMarker ) ) {
						break;
					}
				}
			}
			catch ( e ) {
				throw new ErrorException( e );
			}
		}

		// Create the new configuration file and copy the saved lines
		const file = new FileEntity(simModel, f);
		for( let i=0; i < preAddedRecordLines.length; i++ ) {
			file.format("%s%n", preAddedRecordLines[ i ]);
		}

		// If not already present, insert the "RecordEdits" marker at the end of the original configuration file
		if (!simModel.isRecordEditsFound()) {
			file.format("%n%s%n", InputAgent.recordEditsMarker);
			simModel.setRecordEditsFound(true);
		}

		// 2) WRITE THE DEFINITION STATEMENTS FOR NEW OBJECTS

		// Prepare a sorted list of all the entities that were added to the model
		const newEntities: Entity[] = [];
		for (const ent of simModel.getClonesOfIterator(Entity)) {
			if (!ent.isAdded() || ent.isGenerated())
				continue;
			if (ent instanceof ObjectType || ent.getObjectType() === null)
				continue;
			if (ent instanceof EntityLabel) {
				const label = ent;
				if (!label.getShowInput() && label.isDefault())
					continue;
				if (label.getParent() !== null && label.getPrototype() !== null
					&& label.getParent()!.getPrototype() === label.getPrototype()!.getParent())
					continue;
			}
			newEntities.push(ent);
		}
		newEntities.sort(InputAgent.uiEntitySortOrder);

		// Add a blank line before the first object definition
		if (newEntities.length > 0)
			file.format("%n");

		// Print the Define statements for the entities
		InputAgent.saveDefinitions(newEntities, file);

		// 3) WRITE THE INPUTS

		// Prepare a sorted list of all the entities that were edited
		const entityList: Entity[] = [];
		for (const ent of simModel.getClonesOfIterator(Entity)) {
			if (!ent.isEdited() || !ent.isRegistered())
				continue;
			if (ent instanceof ObjectType || ent.getObjectType() === null)
				continue;
			if (ent instanceof EntityLabel && !ent.getShowInput()
					&& ent.isDefault())
				continue;
			entityList.push(ent);
		}
		entityList.sort(InputAgent.uiEntitySortOrder);

		// Save the inputs for each entity
		InputAgent.saveInputs(entityList, file);

		// Close the new configuration file
		file.flush();
		file.close();

		simModel.setSessionEdited(false);
	}

	/**
	 * Prints the Define statements for the specified lists of entities.
	 * @param newEntities - entities to be defined
	 * @param file - file to which the definitions are to be printed
	 */
	static saveDefinitions(newEntities: Entity[], file: FileEntity): void {

		// Loop through the entities
		let entClass: unknown = null;
		let level = 0;
		let proto: Entity | null = null;
		for (const ent of newEntities) {
			if (ent.isGenerated())
				continue;

			// Is the class different from the last one
			if (ent.constructor !== entClass || ent.getPrototype() !== proto) {

				// Close the previous Define statement
				if (entClass !== null) {
					file.format("}%n");
				}

				// Add a blank line between dependency levels
				if (ent.getDependenceLevel() !== level) {
					level = ent.getDependenceLevel();
					file.format("%n");
				}

				// Start the new Define statement
				entClass = ent.constructor;
				proto = ent.getPrototype();
				let objName = ent.getObjectType()!.getName();
				if (proto !== null)
					objName = proto.getName();
				file.format("Define %s {", objName);
			}

			// Print the entity name to the Define statement
			file.format(" %s ", ent);
		}

		// Close the define statement
		if (newEntities.length > 0)
			file.format("}%n");
	}

	/**
	 * Prints the input statements for the specified lists of entities.
	 * @param entityList - entities whose inputs are to be printed
	 * @param file - file to which the inputs are to be printed
	 */
	static saveInputs(entityList: Entity[], file: FileEntity): void {

		// Write a stub definition for the Attributes and Custom Outputs for each entity
		file.format("%n");
		for (const ent of entityList) {
			if (!ent.isRegistered())
				continue;
			InputAgent.writeStubOutputDefs(file, ent);
		}

		// Loop through the early keywords
		for (let i = 0; i < InputAgent.EARLY_KEYWORDS.length; i++) {

			// Loop through the entities
			let blankLinePrinted = false;
			for (const ent of entityList) {
				if (!ent.isRegistered())
					continue;

				// Print an entry for each entity that used this keyword
				const inp = ent.getInput(InputAgent.EARLY_KEYWORDS[i]);
				if (inp !== null && inp.isEdited()) {
					if (!blankLinePrinted) {
						file.format("%n");
						blankLinePrinted = true;
					}
					InputAgent.writeInputOnFile_ForEntity(file, ent, inp);
				}
			}
		}

		// Non-graphics inputs for non-graphic entities
		let entClass: unknown = null;
		let lastEnt: Entity | null = null;
		for (const ent of entityList) {
			if (!ent.isRegistered() || InputAgent.isGraphicsEntity(ent))
				continue;

			for (const inp of ent.getEditableInputs()) {
				if (inp.isSynonym() || !inp.isEdited() || InputAgent.isEarlyInput(inp) || InputAgent.isGraphicsInput(inp))
					continue;

				// Print a header if the entity class is new
				if (ent.constructor !== entClass) {
					entClass = ent.constructor;
					if (entClass !== Simulation) {
						file.format("%n");
						file.format("# *** %s ***%n", ent.getObjectType());
					}
				}
				if (ent !== lastEnt) {
					lastEnt = ent;
					file.format("%n");
				}

				InputAgent.writeInputOnFile_ForEntity(file, ent, inp);
			}
		}

		// Graphics inputs for non-graphic entities
		lastEnt = null;
		for (const ent of entityList) {
			if (!ent.isRegistered() || InputAgent.isGraphicsEntity(ent))
				continue;

			for (const inp of ent.getEditableInputs()) {
				if (inp.isSynonym() || !inp.isEdited() || InputAgent.isEarlyInput(inp) || !InputAgent.isGraphicsInput(inp))
					continue;

				// Print a header
				if (lastEnt === null) {
					file.format("%n");
					file.format("# *** GRAPHICS INPUTS ***%n");
				}
				if (ent !== lastEnt) {
					lastEnt = ent;
					file.format("%n");
				}

				InputAgent.writeInputOnFile_ForEntity(file, ent, inp);
			}
		}

		// All inputs for graphic entities
		entClass = null;
		lastEnt = null;
		for (const ent of entityList) {
			if (!ent.isRegistered() || !InputAgent.isGraphicsEntity(ent))
				continue;

			for (const inp of ent.getEditableInputs()) {
				if (inp.isSynonym() || !inp.isEdited() || InputAgent.isEarlyInput(inp))
					continue;

				// Print a header if the entity class is new
				if (ent.constructor !== entClass) {
					entClass = ent.constructor;
					if (entClass !== Simulation) {
						file.format("%n");
						file.format("# *** %s ***%n", ent.getObjectType());
					}
				}
				if (ent !== lastEnt) {
					lastEnt = ent;
					file.format("%n");
				}

				InputAgent.writeInputOnFile_ForEntity(file, ent, inp);
			}
		}
	}

	/** @param f - Java の File（TS では道の文字列） */
	static saveEntity(entity: Entity, f: string): void {

		// List the entities to be saved
		const entityList: Entity[] = [];
		entityList.push(entity);
		for (const ent of entity.getDescendants()) {
			if (ent instanceof EntityLabel && !ent.getShowInput()
					&& ent.isDefault())
				continue;
			entityList.push(ent);
		}
		entityList.sort(InputAgent.uiEntitySortOrder);

		// Save the definitions and inputs
		const file = new FileEntity(entity.getJaamSimModel(), f);
		InputAgent.saveDefinitions(entityList, file);
		InputAgent.saveInputs(entityList, file);

		file.flush();
		file.close();
	}

	static isEarlyInput(inp: Input<unknown>): boolean {
		const key = inp.getKeyword();
		return InputAgent.EARLY_KEYWORDS.includes(key);
	}

	static isGraphicsInput(inp: Input<unknown>): boolean {
		const cat = inp.getCategory();
		return InputAgent.GRAPHICS_CATEGORIES.includes(cat);
	}

	static isGraphicsEntity(ent: Entity): boolean {
		const pal = ent.getObjectType()!.getLibraryName();
		return InputAgent.GRAPHICS_PALETTES.includes(pal);
	}

	static writeInputOnFile_ForEntity(file: FileEntity, ent: Entity, inp: Input<unknown>): void {
		try {
			file.format("%s %s { %s }%n", ent.getName(), inp.getKeyword(), inp.getInputString());
		}
		catch (e) {
			ent.getJaamSimModel().logMessage("Error writing Entity:%s Keyword:%s", ent.getName(), inp.getKeyword());
		}
	}

	static writeStubOutputDefs(file: FileEntity, ent: Entity): void {
		for (const inp of ent.getEditableInputs()) {
			if (!inp.isEdited())
				continue;
			const stub = inp.getStubDefinition();
			if (stub === null)
				continue;
			file.format("%s %s { %s }%n", ent.getName(), inp.getKeyword(), stub);
		}
	}

	/**
	 * Prints the column headings for the custom output report.
	 * @param simModel - model whose headings are to be printed
	 * @param labels - true if scenario and replication labels are to be printed for each run
	 * @param reps - true if the results for each replication are to be printed
	 * @param bool - true if confidence intervals are to be printed
	 * @param outStream - PrintStream to which the report will be printed
	 */
	static printRunOutputHeaders(simModel: JaamSimModel, labels: boolean, reps: boolean,
			bool: boolean, outStream: PrintStream): void {
		const simulation = simModel.getSimulation()!;
		let sb = "";

		// Scenario and replication columns
		if (labels) {
			sb += "Scenario" + "\t";
			if (reps)
				sb += "Replication" + "\t";
		}

		// Run parameter columns
		for (const str of simulation.getRunParameterHeaders()) {
			sb += str + "\t";
		}

		// Write the header line for the expressions
		let first = true;
		for (const str of simulation.getRunOutputHeaders()) {
			if (first)
				first = false;
			else
				sb += "\t";
			sb += str;
			if (bool)
				sb += "\t";
		}
		outStream.println(sb);
	}

	/**
	 * Prints the custom output report for the specified scenario.
	 * @param scene - scenario to the reported
	 * @param labels - true if scenario and replication labels are to be printed for each run
	 * @param reps - true if the results for each replication are to be printed
	 * @param bool - true if confidence intervals are to be printed
	 * @param outStream - PrintStream to which the results will be printed
	 */
	static printScenarioOutputs(scene: Scenario, labels: boolean, reps: boolean,
			bool: boolean, outStream: PrintStream): void {
		const replications = scene.getRunsCompleted().length;

		// Sort the completed runs by replication number
		const runList: SimRun[] = scene.getRunsCompleted();
		runList.sort((run1: SimRun, run2: SimRun): number =>
				integerCompare(run1.getReplicationNumber(), run2.getReplicationNumber()));

		// Print the outputs for each replication
		if (reps) {
			for (const run of runList) {
				let sb = "";

				// Scenario and replication numbers
				if (labels) {
					sb += String(scene.getScenarioNumber()) + "\t";
					sb += String(run.getReplicationNumber()) + "\t";
				}

				// Run parameters
				for (const str of run.getRunParameterStrings()) {
					sb += str + "\t";
				}

				// Run outputs
				let first = true;
				for (const str of run.getRunOutputStrings()) {
					if (!first) {
						sb += "\t";
					}
					first = false;
					sb += str;
					if (bool) {
						sb += "\t";
					}
				}
				outStream.println(sb);
			}
		}

		// No need to print the aggregate averages if there is just one replication
		if (replications <= 1 && reps)
			return;

		// Print an error message for any runs that failed
		if (!reps) {
			for (const run of runList) {
				if (!run.isError())
					continue;
				const msg = run.getErrorMessage();
				outStream.format("%s\tError in replication %s - %s%n",
						run.getScenario().getScenarioNumber(), run.getReplicationNumber(), msg);
			}
		}

		// Scenario and replication columns
		let sb = "";
		if (labels) {
			sb += String(scene.getScenarioNumber()) + "\t";
			if (reps)
				sb += "\t";
		}

		// Run parameters
		for (const str of scene.getParameters()) {
			sb += str + "\t";
		}

		// Mean value and confidence interval for each output
		const stats: SampleStatistics[] = scene.getRunStatistics();
		for (let i = 0; i < stats.length; i++) {
			if (i > 0)
				sb += "\t";

			const mean = stats[i].getMean();
			// Mean value
			if (!Number.isNaN(mean))
				sb += jstr(mean);

			// Confidence interval
			const interval95 = stats[i].getConfidenceInterval95();
			if (bool) {
				sb += "\t";
				if (!Number.isNaN(interval95))
					sb += jstr(interval95);
			}
		}

		outStream.println(sb);
	}


	private static readonly OUTPUT_FORMAT = "%s\t%s\t%s\t%s%n";
	private static readonly LIST_OUTPUT_FORMAT = "%s\t%s[%s]\t%s\t%s%n";

	/**
	 * printReport(ent, file, simTime) … Writes the entry in the output report for this entity.
	 * printReport(simModel, simTime, reportFile) … Prints the output report for the simulation run.
	 */
	static printReport(ent: Entity, file: FileEntity, simTime: number): void;
	static printReport(simModel: JaamSimModel, simTime: number, reportFile: FileEntity): void;
	static printReport(a: Entity | JaamSimModel, b: FileEntity | number, c: number | FileEntity): void {
		if (a instanceof Entity)
			InputAgent.printReportForEntity(a, b as FileEntity, c as number);
		else
			InputAgent.printReportForModel(a, b as number, c as FileEntity);
	}

	/**
	 * Writes the entry in the output report for this entity.
	 * @param file - the file in which the outputs are written
	 * @param simTime - simulation time at which the outputs are evaluated
	 */
	private static printReportForEntity(ent: Entity, file: FileEntity, simTime: number): void {
		const simModel = ent.getJaamSimModel();

		// Loop through the outputs
		for (const out of ent.getAllOutputs()) {

			// Should this output appear in the report?
			if (!out.isReportable())
				continue;

			// Determine the preferred unit for this output
			const ut = out.getUnitType() as JClass<Unit>;
			const factor = ent.getJaamSimModel().getDisplayedUnitFactor(ut);
			let unitString = ent.getJaamSimModel().getDisplayedUnit(ut);
			if (ut === Unit || ut === DimensionlessUnit)
				unitString = "-";

			// Numerical output
			if (out.isNumericValue()) {
				try {
					const val = out.getValueAsDouble(simTime, Number.NaN)/factor;
					file.format(InputAgent.OUTPUT_FORMAT,
							ent.getName(), out.getName(), jstr(val), unitString);
				}
				catch (e) {
					file.format(InputAgent.OUTPUT_FORMAT,
							ent.getName(), out.getName(), jstr(Number.NaN), unitString);
				}
			}

			// double[] output
			else if (out.getReturnType() === "double[]") {
				const vec = out.getValue<ArrayLike<number>>(simTime, "double[]");
				for (let i = 0; i < vec.length; i++) {
					file.format(InputAgent.LIST_OUTPUT_FORMAT,
							ent.getName(), out.getName(), i, jstr(vec[i]/factor), unitString);
				}
			}

			// DoubleVector output
			else if (out.getReturnType() === "DoubleVector") {
				const vec = out.getValue<DoubleVector>(simTime, "DoubleVector");
				for (let i=0; i<vec.size(); i++) {
					const val = vec.get(i);
					file.format(InputAgent.LIST_OUTPUT_FORMAT,
							ent.getName(), out.getName(), i, jstr(val/factor), unitString);
				}
			}

			// ArrayList output
			else if (out.getReturnType() === "ArrayList") {
				const array = out.getValue<unknown[]>(simTime, "ArrayList");
				for (let i=0; i<array.length; i++) {
					const obj = array[i];
					// TODO(移植): Java は Double かどうかで分ける。TS では Integer と Double を見分けられないので、数は全部 Double とみなす
					if (typeof obj === "number") {
						const val = obj;
						file.format(InputAgent.LIST_OUTPUT_FORMAT,
								ent.getName(), out.getName(), i, jstr(val/factor), unitString);
					}
					else {
						file.format(InputAgent.LIST_OUTPUT_FORMAT,
							ent.getName(), out.getName(), i, javaToString(obj), unitString);
					}
				}
			}

			// Keyed output
			else if (out.getReturnType() === "LinkedHashMap") {
				const map = out.getValue<Map<unknown, unknown>>(simTime, "LinkedHashMap");
				for (const [key, obj] of map) {
					if (typeof obj === "number") {
						const val = obj;
						file.format(InputAgent.LIST_OUTPUT_FORMAT,
								ent.getName(), out.getName(), javaToString(key), jstr(val/factor), unitString);
					}
					else {
						file.format(InputAgent.LIST_OUTPUT_FORMAT,
								ent.getName(), out.getName(), javaToString(key), javaToString(obj), unitString);
					}
				}
			}
			// Expression based custom outputs
			else if (out.getReturnType() === "ExpResult") {
				const val = InputAgent.getValueAsString(simModel, out, simTime, "%s", factor, "");
				file.format(InputAgent.OUTPUT_FORMAT,
						ent.getName(), out.getName(), val, unitString);
			}

			// All other outputs
			else {
				if (ut !== Unit && ut !== DimensionlessUnit)
					unitString = Unit.getSIUnit(ut);  // other outputs are not converted to preferred units
				const str = javaToString(out.getValue(simTime, out.getReturnType()), out.isIntegerValue());
				file.format(InputAgent.OUTPUT_FORMAT,
						ent.getName(), out.getName(), str, unitString);
			}
		}
	}

	/**
	 * Prints the output report for the simulation run.
	 * @param simModel - simulation model whose report is to be printed
	 * @param simTime - simulation time at which the report is printed
	 * @param reportFile - file in which to print the report
	 */
	private static printReportForModel(simModel: JaamSimModel, simTime: number, reportFile: FileEntity): void {

		// Print run number header when multiple runs are to be performed
		if (simModel.isMultipleRuns())
			reportFile.format("%s%n%n", simModel.getRunHeader());

		// Prepare a sorted list of entities
		const entList: Entity[] = [];
		for (const ent of simModel.getClonesOfIterator(Entity)) {

			if (!ent.isRegistered())
				continue;

			if (!ent.isReportable())
				continue;

			entList.push(ent);
		}
		entList.sort(InputAgent.uiEntitySortOrder);

		// Loop through the entities
		let entClass: unknown = null;
		for (const ent of entList) {

			// Print a header if the entity class is new
			if (ent.constructor !== entClass) {
				entClass = ent.constructor;
				if (entClass !== Simulation) {
					const ot = simModel.getObjectTypeForClass(entClass as JClass<Entity>);
					reportFile.format("*** %s ***%n%n", ot);
				}
			}

			// Print the report for the entity
			InputAgent.printReportForEntity(ent, reportFile, simTime);
			reportFile.format("%n");
		}
	}

	static readonly subModelSortOrder: SortOrder<Entity> = makeSortOrder((ent0: Entity, ent1: Entity): number =>
			integerCompare(ent0.getSubModelLevel(), ent1.getSubModelLevel()));

	static readonly uiEntitySortOrder: SortOrder<Entity> = makeSortOrder((ent0: Entity, ent1: Entity): number => {

		// Place the Simulation entity in the first position
		const isSim0 = (ent0.constructor === Simulation);
		const isSim1 = (ent1.constructor === Simulation);
		let ret = booleanCompare(isSim1, isSim0);  // Simulation goes first
		if (ret !== 0)
			return ret;

		// First sort by dependence level
		ret = integerCompare(ent0.getDependenceLevel(), ent1.getDependenceLevel());
		if (ret !== 0)
			return ret;

		const class0 = ent0.constructor as JClass<Entity>;
		const class1 = ent1.constructor as JClass<Entity>;
		const ot0 = ent0.getJaamSimModel().getObjectTypeForClass(class0)!;
		const ot1 = ent1.getJaamSimModel().getObjectTypeForClass(class1)!;
		const pal0 = ot0.getLibraryName();
		const pal1 = ot1.getLibraryName();

		// If the levels are the same, then sort by graphics vs non-graphics palettes
		const isGraf0 = InputAgent.GRAPHICS_PALETTES.includes(pal0);
		const isGraf1 = InputAgent.GRAPHICS_PALETTES.includes(pal1);
		ret = booleanCompare(isGraf0, isGraf1);  // Non-graphics goes first
		if (ret !== 0)
			return ret;

		// If the graphics types are the same, then sort alphabetically by palette name
		ret = Input.uiSortOrder.compare(pal0, pal1);
		if (ret !== 0)
			return ret;

		// If the palettes are the same, then sort alphabetically by class name
		ret = Input.uiSortOrder.compare(ot0, ot1);
		if (ret !== 0)
			return ret;

		// If the classes are the same, then sort alphabetically by prototype name
		if (ent0.isClone() && ent1.isClone()) {
			ret = Input.uiSortOrder.compare(ent0.getPrototype(), ent1.getPrototype());
			if (ret !== 0)
				return ret;
		}

		// If the prototypes are the same, then sort alphabetically by entity name
		return Input.uiSortOrder.compare(ent0, ent1);
	});

	/**
	 * Returns a formated string for the specified output.
	 * @param simModel - simulation model
	 * @param out - output
	 * @param simTime - present simulation time
	 * @param floatFmt - format string for numerical values
	 * @param factor - divisor to be applied to numerical values
	 * @param unitString - unit to be appended to numerical values
	 * @return formated string for the output
	 */
	static getValueAsString(simModel: JaamSimModel | null, out: ValueHandle, simTime: number, floatFmt: string, factor: number, unitString: string): string {

		if (unitString.length > 0)
			unitString = "[" + unitString +"]";

		// Numeric outputs
		if (out.isNumericValue()) {
			const val = out.getValueAsDouble(simTime, Number.NaN);
			return formatDouble(floatFmt, val/factor) + unitString;
		}

		const retType = out.getReturnType();
		const ret = out.getValue<unknown>(simTime, retType);

		// int[] は TS では数の配列なので、戻り値の型で見分ける（Java は ret instanceof int[]）
		if (retType === "int[]" && ret !== null && ret !== undefined && !(ret instanceof Int32Array))
			return InputAgent.getOutputString(simModel, Int32Array.from(ret as ArrayLike<number>), floatFmt, factor, unitString);

		return InputAgent.getOutputString(simModel, ret, floatFmt, factor, unitString);
	}

	/**
	 * Java の型ごとの分け方を、TS の値の形で行う:
	 * String → 文字列、Double → 数（TODO(移植): Integer・Long の箱の値も数になり、Double として書かれる）、
	 * double[]・double[][]・String[]・ArrayList → 配列（どれも同じ形になる）、int[] → Int32Array、
	 * LinkedHashMap → Map。
	 */
	static getOutputString(simModel: JaamSimModel | null, ret: unknown, floatFmt: string, factor: number, unitString: string): string {
		let sb = "";

		if (ret === null || ret === undefined)
			return "null";

		// String outputs
		if (typeof ret === "string") {
			sb += "\"" + ret + "\"";
			return sb;
		}

		// Entity outputs
		if (ret instanceof Entity || ret instanceof AbstractDirectedEntity) {
			sb += "[" + String(ret) + "]";
			return sb;
		}

		// Floating point number
		if (typeof ret === "number") {
			const val = ret;
			return formatDouble(floatFmt, val/factor) + unitString;
		}

		// int[] outputs
		if (ret instanceof Int32Array) {
			const val = ret;
			sb += "{";
			for (let i=0; i<val.length; i++) {
				if (i > 0)
					sb += InputAgent.COMMA_SEPARATOR;
				const str = String(val[i]);
				sb += str;
			}
			sb += "}";
			return sb;
		}

		// double[] outputs（Float64Array も）
		if (ret instanceof Float64Array) {
			const val = ret;
			sb += "{";
			for (let i=0; i<val.length; i++) {
				if (i > 0)
					sb += InputAgent.COMMA_SEPARATOR;
				const str = formatDouble(floatFmt, val[i]/factor);
				sb += str + unitString;
			}
			sb += "}";
			return sb;
		}

		// Vec3d outputs
		if (ret instanceof Vec3d) {
			const vec = ret;
			sb += "{";
			sb += jstr(vec.x/factor) + unitString + InputAgent.COMMA_SEPARATOR;
			sb += jstr(vec.y/factor) + unitString + InputAgent.COMMA_SEPARATOR;
			sb += jstr(vec.z/factor) + unitString;
			sb += "}";
			return sb;
		}

		// DoubleVector output
		if (ret instanceof DoubleVector) {
			sb += "{";
			const vec = ret;
			for (let i=0; i<vec.size(); i++) {
				const str = formatDouble(floatFmt, vec.get(i)/factor);
				sb += str + unitString;
				if (i < vec.size()-1) {
					sb += InputAgent.COMMA_SEPARATOR;
				}
			}
			sb += "}";
			return sb;
		}

		// double[]・double[][]・String[]・ArrayList output（Java では別々の処理だが、結果の形は同じ）
		if (Array.isArray(ret)) {
			sb += "{";
			const array = ret;
			for (let i=0; i<array.length; i++) {
				if (i > 0)
					sb += InputAgent.COMMA_SEPARATOR;
				const obj = array[i];
				sb += InputAgent.getOutputString(simModel, obj, floatFmt, factor, unitString);
			}
			sb += "}";
			return sb;
		}

		// Keyed outputs
		if (ret instanceof Map) {
			sb += "{";
			const map = ret;
			let first = true;
			for (const [key, obj] of map) {
				if (typeof obj === "number" && obj === 0.0)
					continue;

				if (first)
					first = false;
				else
					sb += InputAgent.COMMA_SEPARATOR;

				sb += InputAgent.getOutputString(simModel, key, floatFmt, factor, unitString);
				sb += "=";
				sb += InputAgent.getOutputString(simModel, obj, floatFmt, factor, unitString);
			}
			sb += "}";
			return sb;
		}

		// Expression result
		if (ret instanceof ExpResult) {
			const result = ret;
			if (result.type === ExpResType.NUMBER) {
				sb += formatDouble(floatFmt, result.value/factor) + unitString;
				return sb;
			}
			return result.getOutputString(simModel);
		}

		// All other outputs
		return javaToString(ret);
	}

	/**
	 * Returns the relative file path for the specified URI.
	 * <p>
	 * The path can start from either the folder containing the present
	 * configuration file or from the resources folder.
	 * <p>
	 * @param uri - the URI to be relativized.
	 * @return the relative file path.
	 */
	static getRelativeFilePath(simModel: JaamSimModel, uri: URI): string {

		// Relativize the file path against the resources folder
		const resString = InputAgent.resRoot.toString();
		let inputString = uri.toString();
		if (inputString.startsWith(resString)) {
			inputString = inputString.substring(resString.length);
			try {
				inputString = urlDecode(inputString);
			}
			catch (e) {}
			return jformat("<res>/%s", inputString);
		}

		// Relativize the file path against the configuration file
		try {
			const configDirURI = JFile.toURI(JFile.getParent(simModel.getConfigFile()!), true);
			return jformat("%s", configDirURI.relativize(uri).getPath());
		}
		catch (ex) {
			return jformat("%s", uri.getPath());
		}
	}

	static getResourceFolderName(uri: URI): string | null {
		const resString = InputAgent.resRoot.toString();
		const inputString = uri.toString();
		if (!inputString.startsWith(resString))
			return null;
		return inputString.substring(resString.length);
	}

	static getExamplesFileInputs(ent: Entity): FileInput[] {
		const ret: FileInput[] = [];
		for (const inp of ent.getEditableInputs()) {

			// Is the input a FileInput whose value has been set?
			if (!(inp instanceof FileInput))
				continue;
			const fileIn = inp;
			const uri = fileIn.getValue();
			if (uri === null)
				continue;

			// Is the file located in the 'examples' folder?
			const folder = InputAgent.getResourceFolderName(uri);
			if (folder !== null && folder.startsWith("examples")) {
				ret.push(fileIn);
			}
		}
		return ret;
	}

	/**
	 * Converts a file path String to a URI.
	 * <p>
	 * The specified file path can be either relative or absolute. In the case
	 * of a relative file path, a 'context' folder must be specified. A context
	 * of null indicates an absolute file path.
	 * <p>
	 * To avoid bad input accessing an inappropriate file, a 'jail' folder can
	 * be specified. The URI to be returned must include the jail folder for it
	 * to be valid.
	 * <p>
	 * @param context - full file path for the folder that is the reference for relative file paths.
	 * @param filePath - string to be resolved to a URI.
	 * @param jailPrefix - file path to a base folder from which a relative cannot escape.
	 * @return the URI corresponding to the context and filePath.
	 * @throws URISyntaxException
	 */
	static getFileURI(sm: JaamSimModel, context: URI | null, filePath: string, jailPrefix: string | null): URI | null {

		// Replace all backslashes with slashes
		let path = filePath.replace(/\\/g, "/");

		const colon = path.indexOf(":");
		const openBrace = path.indexOf("<");
		const closeBrace = path.indexOf(">");
		const firstSlash = path.indexOf("/");

		// Add a leading slash if needed to convert from Windows format (e.g. from "C:" to "/C:")
		if (colon === 1)
			path = jformat("/%s", path);

		// 1) File path starts with a tagged folder, using the syntax "<tagName>/"
		let ret: URI | null = null;
		if (openBrace === 0 && closeBrace !== -1 && firstSlash === closeBrace + 1) {
			const specPath = path.substring(openBrace + 1, closeBrace);

			// Resources folder in the Jar file
			if (specPath === "res") {
				ret = new URI(InputAgent.resRoot.getScheme(), InputAgent.resRoot.getSchemeSpecificPart() + path.substring(closeBrace+2), null).normalize();

			}
		}
		// 2) Normal file path
		else {
			const pathURI = new URI(null, path, null).normalize();

			if (context !== null) {
				if (context.isOpaque()) {
					// Things are going to get messy in here
					const schemeless = new URI(null, context.getSchemeSpecificPart(), null);
					const resolved = schemeless.resolve(pathURI).normalize();

					// Note: we are using the one argument constructor here because the 'resolved' URI is already encoded
					// and we do not want to double-encode (and schemes should never need encoding, I hope)
					ret = new URI(context.getScheme() + ":" + resolved.toString());
				} else {
					ret = context.resolve(pathURI).normalize();
				}
			} else {
				// We have no context, so append a 'file' scheme if necessary
				if (pathURI.getScheme() === null) {
					ret = new URI("file", pathURI.getPath() as string, null);
				} else {
					ret = pathURI;
				}
			}
		}

		// Check that the file path includes the jail folder
		// （Java は ret が null（<tag>/ が res でない）なら NullPointerException）
		if (jailPrefix !== null && (ret as URI).toString().indexOf(jailPrefix) !== 0) {
			sm.logMessage("Failed jail test: %s%njail: %s%ncontext: %s%n",
					(ret as URI).toString(), jailPrefix, String(context));
			return null; // This resolved URI is not in our jail
		}

		return ret;
	}

	/**
	 * Determines whether or not a file exists.
	 * <p>
	 * @param filePath - URI for the file to be tested.
	 * @return true if the file exists, false if it does not.
	 */
	static fileExists(filePath: URI): boolean {
		try {
			InputAgent.fileReader(filePath);
			return true;
		}
		catch (ex) {
			return false;
		}
	}

}
