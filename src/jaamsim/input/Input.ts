/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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
// - getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分けて 1 つにした（引数なしなら value）。
// - getValueTokens(toks) は名前をそのまま残し、引数なしの getValueTokens() は getValueTokenList() にした（docs/renamed.md）。
// - reset() と reset(ent) は reset(ent?) の 1 つ。子で上書きするときは、ent の有無で見分ける。
// - static の assertCount・assertCountRange・assertMonotonic・parseDouble・parseTime・parseInteger・parseString は、
//   引数の型と数で見分ける。
// - getReturnType() は Java の Class<?> の代わりに、OutputRegistry の OutputReturnType の文字列を返す。
// - Java の interface（SampleProvider など）を Class として渡す所は、JInterface（isInstance を持つ物）を渡す。
// - Java の enum の Class は、TS の文字列の enum（値 = 名前）か、values() を持つ物（JEnumClass）。
// - 利用者に見せる文（INP_ERR_… と VALID_…）は、使う所で tr(...) に包む（PORTING.md の 10）。
import { jstr, jIsAssignableFrom, Integer, Double, NumberFormatException } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { BooleanProvConstant } from "../BooleanProviders/BooleanProvConstant.ts";
import { BooleanProvExpression } from "../BooleanProviders/BooleanProvExpression.ts";
import type { BooleanProvider } from "../BooleanProviders/BooleanProvider.ts";
import { ColourProvConstant } from "../ColourProviders/ColourProvConstant.ts";
import { ColourProvExpression } from "../ColourProviders/ColourProvExpression.ts";
import type { ColourProvider } from "../ColourProviders/ColourProvider.ts";
import type { EntityListProvider } from "../EntityProviders/EntityListProvider.ts";
import { EntityProvConstant } from "../EntityProviders/EntityProvConstant.ts";
import { EntityProvExpression } from "../EntityProviders/EntityProvExpression.ts";
import { EntityProvGroup } from "../EntityProviders/EntityProvGroup.ts";
import type { EntityProvider } from "../EntityProviders/EntityProvider.ts";
import { SampleConstant } from "../Samples/SampleConstant.ts";
import { SampleExpression } from "../Samples/SampleExpression.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { isSampleProvider } from "../Samples/SampleProvider.ts";
import { TimeSeriesConstantDouble } from "../Samples/TimeSeriesConstantDouble.ts";
import { StringProvConstant } from "../StringProviders/StringProvConstant.ts";
import { StringProvExpression } from "../StringProviders/StringProvExpression.ts";
import { StringProvSample } from "../StringProviders/StringProvSample.ts";
import type { StringProvider } from "../StringProviders/StringProvider.ts";
import { Entity } from "../basicsim/Entity.ts";
import { Group } from "../basicsim/Group.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ObjectType } from "../basicsim/ObjectType.ts";
import { BooleanVector } from "../datatypes/BooleanVector.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { Color4d } from "../math/Color4d.ts";
import { MathUtils } from "../math/MathUtils.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { ColourInput } from "./ColourInput.ts";
import { BooleanInput } from "./BooleanInput.ts";
import { ExpError } from "./ExpError.ts";
import { InputAgent } from "./InputAgent.ts";
import type { InputCallback } from "./InputCallback.ts";
import { InputErrorException } from "./InputErrorException.ts";
import { KeywordIndex } from "./KeywordIndex.ts";
import type { ListInput } from "./ListInput.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { Parser, jsplit } from "./Parser.ts";
import type { URI } from "./ParseContext.ts";
import { URISyntaxException } from "./ParseContext.ts";
import type { JType } from "./ValueHandle.ts";

/** Java の interface を Class として渡す所の代わり（instanceof の代わりに isInstance で調べる） */
export interface JInterface<T = unknown> {
	/** Java の完全な名前（"com.jaamsim.Samples.SampleProvider" など） */
	readonly javaName: string;
	isInstance(o: unknown): o is T;
}

/** Java の enum の Class の代わり（TS の文字列の enum か、values() を持つ物） */
export type JEnumClass<T> = { values(): T[] } | Record<string, T>;

/** enum の定数の一覧（Java の getEnumConstants()） */
export function enumConstants<T>(aClass: JEnumClass<T>): T[] {
	const vals = (aClass as { values?: unknown }).values;
	if (typeof vals === "function")
		return (vals as () => T[]).call(aClass);
	const rec = aClass as Record<string, T>;
	// 数の enum には逆引き（値 → 名前）が入っているので除く
	return Object.keys(rec).filter(k => !/^\d+$/.test(k)).map(k => rec[k]);
}

/** enum の定数の名前（Java の name()） */
export function enumName<T>(aClass: JEnumClass<T>, v: T): string {
	const nm = (v as { name?: unknown } | null)?.name;
	if (typeof nm === "function")
		return String((nm as () => string).call(v));
	if (typeof (aClass as { values?: unknown }).values !== "function") {
		const rec = aClass as Record<string, T>;
		for (const k of Object.keys(rec))
			if (!/^\d+$/.test(k) && rec[k] === v)
				return k;
	}
	return String(v);
}

/** Java の Enum.valueOf(aClass, name)。無ければ IllegalArgumentException の代わりに null */
function enumValueOf<T>(aClass: JEnumClass<T>, name: string | null): T | null {
	if (name === null)
		return null;
	for (const c of enumConstants(aClass))
		if (enumName(aClass, c) === name)
			return c;
	return null;
}

function enumConstantsString<T>(aClass: JEnumClass<T>): string {
	return "[" + enumConstants(aClass).map(c => enumName(aClass, c)).join(", ") + "]";
}

/** 名前の表（Java の Class.getSimpleName）。JInterface にも使える */
function simpleNameOf(klass: JClass | JInterface): string {
	if (typeof klass === "function")
		return ClassRegistry.simpleName(klass);
	const n = klass.javaName;
	return n.slice(n.lastIndexOf(".") + 1);
}

function javaNameOf(klass: JClass | JInterface): string {
	if (typeof klass === "function")
		return ClassRegistry.javaName(klass);
	return klass.javaName;
}

/** Java の Character.isSpaceChar（Unicode の空白の区切り） */
function isSpaceChar(c: string): boolean {
	return /[\p{Zs}\p{Zl}\p{Zp}]/u.test(c);
}

/**
 * Java の com.jaamsim.ui.NaturalOrderComparator（画面の部品だが、並べる順が結果に効くのでここに写した）。
 * TODO(移植): ui/NaturalOrderComparator.ts を作るなら、そちらへ移す。
 */
export class NaturalOrderComparator {

	private compareRight(a: string, b: string): number {
		let bias = 0;
		let ia = 0;
		let ib = 0;

		// The longest run of digits wins. That aside, the greatest
		// value wins, but we can't know that it will until we've scanned
		// both numbers to know that they have the same magnitude, so we
		// remember it in BIAS.
		for (;; ia++, ib++) {
			const ca = NaturalOrderComparator.charAt(a, ia);
			const cb = NaturalOrderComparator.charAt(b, ib);

			if (!isDigitChar(ca) && !isDigitChar(cb)) {
				return bias;
			}
			else if (!isDigitChar(ca)) {
				return -1;
			}
			else if (!isDigitChar(cb)) {
				return +1;
			}
			else if (ca < cb) {
				if (bias === 0) {
					bias = -1;
				}
			}
			else if (ca > cb) {
				if (bias === 0)
					bias = +1;
			}
			else if (ca === 0 && cb === 0) {
				return bias;
			}
		}
	}

	compare(o1: unknown, o2: unknown): number {
		const a = String(o1);
		const b = String(o2);

		let ia = 0, ib = 0;
		let nza = 0, nzb = 0;
		let ca: number, cb: number;
		let result: number;

		while (true) {
			// only count the number of zeroes leading the last number compared
			nza = nzb = 0;

			ca = NaturalOrderComparator.charAt(a, ia);
			cb = NaturalOrderComparator.charAt(b, ib);

			// skip over leading spaces or zeros
			while (isSpaceChar(String.fromCharCode(ca)) || ca === 48) {
				if (ca === 48) {
					nza++;
				}
				else {
					// only count consecutive zeroes
					nza = 0;
				}

				ca = NaturalOrderComparator.charAt(a, ++ia);
			}

			while (isSpaceChar(String.fromCharCode(cb)) || cb === 48) {
				if (cb === 48) {
					nzb++;
				}
				else {
					// only count consecutive zeroes
					nzb = 0;
				}

				cb = NaturalOrderComparator.charAt(b, ++ib);
			}

			// process run of digits
			if (isDigitChar(ca) && isDigitChar(cb)) {
				if ((result = this.compareRight(a.substring(ia), b.substring(ib))) !== 0) {
					return result;
				}
			}

			if (ca === 0 && cb === 0) {
				// The strings compare the same. Perhaps the caller
				// will want to call strcmp to break the tie.
				return nza - nzb;
			}

			if (ca < cb) {
				return -1;
			}
			else if (ca > cb) {
				return +1;
			}

			++ia;
			++ib;
		}
	}

	/** 文字の値（Java の char）。範囲の外は 0 */
	static charAt(s: string, i: number): number {
		if (i >= s.length) {
			return 0;
		}
		else {
			return s.charCodeAt(i);
		}
	}
}

function isDigitChar(c: number): boolean {
	return c !== 0 && /\p{Nd}/u.test(String.fromCharCode(c));
}

/** Java の toString（ArrayList なら "[a, b]"、double なら jstr）。整数かどうかは isInt で指定する */
export function javaToString(o: unknown, isInt = false): string {
	if (o === null || o === undefined)
		return "null";
	if (typeof o === "number")
		return isInt ? String(o) : jstr(o);
	if (typeof o === "boolean")
		return o ? "true" : "false";
	if (Array.isArray(o))
		return "[" + o.map(e => javaToString(e, isInt)).join(", ") + "]";
	return String(o);
}

export abstract class Input<T> {
	static readonly INP_ERR_COUNT = "Expected an input with %s value(s), received: %s";
	static readonly INP_ERR_RANGECOUNT = "Expected an input with %d to %d values, received: %s";
	static readonly INP_ERR_RANGECOUNTMIN = "Expected an input with at least %d values, received: %s";
	static readonly INP_ERR_EVENCOUNT = "Expected an input with even number of values, received: %s";
	static readonly INP_ERR_ODDCOUNT = "Expected an input with odd number of values, received: %s";
	static readonly INP_ERR_BOOLEAN = "Expected a boolean value, received: %s";
	static readonly INP_ERR_INTEGER = "Expected an integer value, received: %s";
	static readonly INP_ERR_INTEGERRANGE = "Expected an integer between %d and %d, received: %d";
	static readonly INP_ERR_DOUBLE = "Expected an numeric value, received: %s";
	static readonly INP_ERR_DOUBLERANGE = "Expected a number between %f and %f, received: %f";
	static readonly INP_ERR_SAMPLERANGE = "Expected a number between %f and %f, received: %s which returns values between %f and %f";
	static readonly INP_ERR_TIME = "Expected a time value (hh:mm or hh:mm:ss), received: %s";
	static readonly INP_ERR_TIMEVALUE = "Expected a numeric value, 12 numeric values, or a probabilty distribution, received: %s";
	static readonly INP_ERR_BADSUM = "List must sum to %f, received:%f";
	static readonly INP_ERR_SUMRANGE = "Sum of list must be between %s and %s, sum: %s";
	static readonly INP_ERR_MONOTONIC = "List must %s monotonically. Values starting at index %s are %s, %s, ...";
	static readonly INP_ERR_BADCHOICE = "Expected one of %s, received: %s";
	static readonly INP_ERR_ELEMENT = "Error parsing element %d: %s";
	static readonly INP_ERR_ENTNAME = "Could not find an Entity named: %s";
	static readonly INP_ERR_NOUNITFOUND = "A unit is required, could not parse '%s' as a %s";
	static readonly INP_ERR_UNITNOTFOUND = "A unit of type '%s' is required";
	static readonly INP_ERR_NOTUNIQUE = "List must contain unique entries, repeated entry: %s";
	static readonly INP_ERR_NOTVALIDENTRY = "List must not contain: %s";
	static readonly INP_ERR_ENTCLASS = "Expected a %s, %s is a %s";
	static readonly INP_ERR_INTERFACE = "Expected an object implementing %s, %s does not";
	static readonly INP_ERR_UNITS = "Unit types do not match";
	static readonly INP_ERR_UNITUNSPECIFIED = "Unit type has not been specified";
	static readonly INP_ERR_NOTSUBCLASS = "Expected a subclass of %s, got %s";
	static readonly INP_ERR_BADDATE = "Expected a valid RFC8601 datetime, got: %s";
	static readonly INP_ERR_BADCOLOUR = "Expected a valid colour name or RGB value with or without transparency, got: %s";
	static readonly INP_ERR_BADEXP = "Error parsing expression: %s";
	static readonly INP_VAL_LISTSET = "Values found for %s without %s being set";
	static readonly INP_VAL_LISTSIZE = "%s and %s must be of equal size";
	static readonly INP_ERR_BRACES = "List must contain equal numbers of opening and closing braces";
	static readonly INP_ERR_QUOTE = "A String cannot include a single quote or apostrophe (').";

	static readonly EXP_ERR_RESULT_TYPE = "Incorrect result type returned by expression.%n"
	                                               + "Received: %s, expected: %s";
	static readonly EXP_ERR_CLASS = "Incorrect class returned by expression.%n"
	                                         + "Received: %s, expected: %s";
	static readonly EXP_ERR_UNIT = "Incorrect unit type returned by expression.%n"
	                                        + "Received: %s, expected: %s";

	static readonly VALID_ENTITY_NAME = "A local entity name cannot be blank or contain spaces, tabs, braces, single or double quotes, square brackets, hash characters, or periods.";

	static readonly VALID_SAMPLE_PROV = "Accepts a number with units of type %s, an object that returns such a number, or an expression that returns such a number.";
	static readonly VALID_SAMPLE_PROV_DIMLESS = "Accepts a dimensionless number, an object that returns such a number, or an expression that returns such a number.";
	static readonly VALID_SAMPLE_PROV_UNIT = "Accepts a number with or without units, an object that returns such a number, or an expression that returns such a number. "
	                                                     + "An input to the UnitType keyword MUST BE PROVIDED before an input to this keyword can be entered.";
	static readonly VALID_SAMPLE_PROV_INTEGER = "Accepts a dimensionless integer, an object that returns such a number, or an expression that returns such a number.";
	static readonly VALID_STRING_PROV = "Accepts a string or an expression that returns a string. "
	                                                + "Also accepts other types of expressions whose outputs will be converted to a string.";
	static readonly VALID_ENTITY_PROV = "Accepts an entity name or an expression that returns an entity.";
	static readonly VALID_ENTITY_PROV_TYPE = "Accepts the name of an entity of type %s or an expression that returns such an entity.";
	static readonly VALID_BOOLEAN_PROV = "Accepts the text TRUE or FALSE or an expression that returns a dimensionless number (non-zero indicates TRUE, zero indicates FALSE). "
	                                                 + "Inputs of T, t, and 1 are interpreted as TRUE, while F, f, and 0 are interpreted as FALSE.";
	static readonly EXAMPLE_BOOLEAN_PROV: string[] = ["TRUE", "FALSE", "'this.attrib > 0'"];
	static readonly VALID_COLOUR_PROV = "Accepts a colour name or an RGB value, with or without an optional transparency value, "
	                                                + "or an expression that returns a colour name or an array that contains an RGB value with or without a transparency value. "
	                                                + "The RGB and transparency value can be in either integer format (0 - 255) or decimal format (0.0 - 1.0)";
	static readonly EXAMPLE_COLOUR_PROV: string[] = ["red", "255 0 0", "red 0.5", "255 0 0 0.5",
	                                                      "'simTime%1[s] < 0.5[s] ? \"red\" : \"yellow\"'",
	                                                      "'simTime%1[s] < 0.5[s] ? {255, 0, 0} : {255, 255, 0}'"];
	static readonly VALID_TIMESERIES_PROV = "Accepts a number with units of type %s or a TimeSeries that returns such a number.";
	static readonly VALID_TIMESERIES_PROV_UNIT = "Accepts a number with or without units or a TimeSeries that returns such a number. "
	                                                         + "An input to the UnitType keyword MUST BE PROVIDED before an input to this keyword can be entered.";

	static readonly VALID_COLOUR = "Accepts a colour name or an RGB value, with or without an optional transparency value. "
	                                           + "The RGB and transparency value can be in either integer format (0 - 255) or decimal format (0.0 - 1.0)";
	static readonly VALID_INTEGER = "Accepts a dimensionless integer value.";
	static readonly VALID_VALUE = "Accepts a number with units of type %s.";
	static readonly VALID_VALUE_DIMLESS = "Accepts a dimensionless number.";
	static readonly VALID_VALUE_UNIT = "Accepts a number with or without units. "
	                                               + "An input to the UnitType keyword MUST BE PROVIDED before an input to this keyword can be entered.";
	static readonly VALID_ENTITY = "Accepts the name of an entity.";
	static readonly VALID_ENTITY_TYPE = "Accepts the name of an entity of type %s.";
	static readonly VALID_INTERFACE_ENTITY = "Accepts the name of an entity that supports the %s interface.";
	static readonly VALID_BOOLEAN = "Accepts the text TRUE or FALSE. Inputs of T, t, and 1 are interpreted as TRUE, while F, f, and 0 are interpreted as FALSE.";
	static readonly EXAMPLE_BOOLEAN: string[] = ["TRUE", "FALSE"];
	static readonly VALID_STRING = "Accepts a text string. The string must be enclosed by single quotes if it includes a space.";
	static readonly VALID_DATE = "Accepts a calendar date and time in one of the following formats: 'YYYY-MM-DD hh:mm:ss.sss', 'YYYY-MM-DD hh:mm:ss', 'YYYY-MM-DD'";
	static readonly VALID_FILE = "Accepts a file path enclosed by single quotes.";
	static readonly VALID_DIR = "Accepts a directory path enclosed by single quotes.";
	static readonly VALID_EXP_DIMLESS = "Accepts an expression that returns a dimensionless number. A value of zero implies FALSE; non-zero implies TRUE.";
	static readonly VALID_EXP_NUM = "Accepts an expression that returns a number.";
	static readonly VALID_EXP_STR = "Accepts an expression that returns a string.";
	static readonly VALID_EXP_ENT = "Accepts an expression that returns an entity.";
	static readonly VALID_EXP_COL = "Accepts an expression that returns an array or hashmap.";
	static readonly VALID_EXP = "Accepts an expression.";
	static readonly VALID_KEYEVENT = "Accepts a single character representing a key on the keyboard. "
	                                             + "For non-printing keys, enter the key's name such as HOME, ESCAPE, SPACE, F1, etc.";
	static readonly VALID_VALUE_LIST = "Accepts a list of numbers separated by spaces, followed by a unit for these values, if required.";
	static readonly VALID_VALUE_LIST_DIMLESS = "Accepts a list of dimensionless numbers separated by spaces.";
	static readonly VALID_SAMPLE_LIST = "Accepts a list containing numbers with or without units, objects that return such a number, or expressions that return such a number. "
	                                                + "Each entry in the list must be enclosed by braces.";
	static readonly VALID_SAMPLE_LIST_DIMLESS = "Accepts a list containing dimensionless numbers, objects that return such a number, or expressions that return such a number. "
	                                                        + "Each entry in the list can be enclosed by braces.";
	static readonly VALID_SAMPLE_LIST_INTEGER = "Accepts a list containing dimensionless integers, objects that return such a number, or expressions that return such a number. "
            + "Each entry in the list can be enclosed by braces.";
	static readonly VALID_UNIT_TYPE_LIST = "Accepts a list of unit types separated by spaces.";
	static readonly VALID_STRING_PROV_LIST = "Accepts a list of strings or expressions that return strings. "
	                                                     + "Also accepts other types of expressions whose outputs will be converted to strings. "
	                                                     + "Each entry in the list must be enclosed by braces.";
	static readonly VALID_COLOR_LIST = "Accepts a list of colours that are expressed as either a colour name or an RGB value. "
	                                               + "Each entry in the list must be enclosed by braces.";

	static readonly VALID_ENTITY_LIST = "Accepts a list of entity names separated by spaces.";
	static readonly VALID_ENTITY_PROV_LIST = "Accepts a list of entity names or expressions that return an entity. "
	                                                     + "Each entry in the list can be enclosed by braces.";
	static readonly VALID_ENTITY_PROV_LIST_TYPE = "Accepts a list of entity names of type %s or expressions that return such an entity. "
	                                                          + "Each entry in the list can be enclosed by braces.";

	static readonly VALID_EXP_LIST_DIMLESS = "Accepts a list of expressions that return dimensionless numbers.";
	static readonly VALID_EXP_LIST_NUM = "Accepts a list of expressions that return numbers.";
	static readonly VALID_EXP_LIST_STR = "Accepts a list of expressions that return strings.";
	static readonly VALID_EXP_LIST_ENT = "Accepts a list of expressions that return entitys.";
	static readonly VALID_EXP_LIST_COL = "Accepts a list of expressions that return arrays or hashmaps.";
	static readonly VALID_EXP_LIST = "Accepts a list of expressions.";

	static readonly VALID_FORMAT = "Accepts a Java format string for a number. For example, '%.3f' would print a number with three decimal places.";
	static readonly VALID_VEC3D = "Accepts three numbers separated by spaces followed by a unit of type %s. "
	                                          + "If only two numbers are entered, the third value defaults to zero.";
	static readonly VALID_VEC3D_DIMLESS = "Accepts three dimensionless numbers separated by spaces.";
	static readonly VALID_VEC3D_LIST = "Accepts a list of vectors enclosed by braces. "
	                                               + "Each vector consists of three numbers separated by spaces followed by a unit of type %s. "
	                                               + "If a vector has only two numbers, the third value defaults to zero.";

	static readonly VALID_ATTRIB_DEF = "Accepts a list of attribute definitions each consisting of an attribute name followed by an expression "
	                                               + "that sets the initial value for the attribute. "
	                                               + "Each definition in the list must be enclosed by braces.";
	static readonly EXAMPLE_ATTRIB_DEF: string[] = ["{ AAA 1 } { bbb 2[s] } { c '\"abc\"' } { d [Queue1] }",
	                                                                   "{ e '{1,2,3}' } { f '{\"key1\"=10, \"key2\"=4}' } { g '|x|(2*x)' }"];

	static readonly VALID_ATTRIB_ASSIGN = "Accepts a list of attribute assignments each consisting of an left-hand side expression that selects an attribute, "
	                                                  + "an equal sign, and a right-hand side expression that calculates the new value for the attribute. "
	                                                  + "Each assignment in the list must be enclosed by braces. "
	                                                  + "Single quotes are required around assignments that include spaces.";
	static readonly EXAMPLE_ATTRIB_ASSIGN: string[] = ["{ 'this.A = 1' } { 'this.obj.B = 1' } { '[Ent1].C = 1' }",
	                                                                      "{ 'this.D = 1[s] + 0.5*this.SimTime' }",
	                                                                      "{ 'this.Array(this.obj.Index) = 1' }"];

	static readonly VALID_CUSTOM_OUT = "Accepts a list of custom output definitions each consisting of a custom output name, an expression, and a unit type (if required). "
	                                               + "Each definition in the list must be enclosed by braces.";
	static readonly VALID_PASSTHROUGH = "Accepts a list of passthrough keyword definitions each consisting of the name for the new keyword and output followed by the unit type for the new output. "
	                                                + "The unit type defaults to DimensionlessUnit if no unit type is entered. "
	                                                + "Each definition in the list must be enclosed by braces.";
	static readonly VALID_ACTION = "Accepts a list of action name and output name pairs. "
	                                           + "Each action/output pair consists of an action name followed by an output name. "
	                                           + "The names are separated by one or more spaces and enclosed braces.";
	static readonly VALID_SCENARIO_NUMBER = "Accepts a dimensionless number, an expression that returns such a number, or a set of scenario indices separated by hyphens. "
                                                        + "For example, if three scenario indices have been defined with ranges of 3, 5, and 10, "
                                                        + "then scenario number 22 can be expressed as 1-3-2 because 22 = (1-1)*5*10 + (3-1)*10 + 2.";

	static readonly POSITIVE_INFINITY = "Infinity";
	static readonly NEGATIVE_INFINITY = "-Infinity";
	static readonly SEPARATOR = "  ";
	static readonly BRACE_SEPARATOR = " ";

	private keyword: string; // the preferred name for the input keyword
	private readonly category: string;
	private callback: InputCallback | null = null;

	protected defValue: T | null;
	protected value: T | null = null;
	protected protoInput: Input<T> | null = null;

	private edited = false; // indicates if input has been edited for this entity
	private promptReqd = false; // indicates whether to prompt the user to save the configuration file
	private hidden = false; // Hide this input from the EditBox
	protected isDef = false; // Is this input still the default value?
	valueTokens: string[] | null = null; // value from .cfg file（Java は protected。InputAgent が読むので公開）
	private defText: string | null = null; // special text to show in the default column of the Input Editor
	private isReqd = false;     // indicates whether this input must be provided by the user
	private _isValid = false;  // if false, the input is no longer valid and must be re-entered
	private _isLocked = false; // indicates whether the input can be changed through by the user
	private _isInherited = false;  // indicates whether this input is inherited from its prototype
	private _isOutput = false;  // indicates whether this input is available as an output
	private _isReportable = false;  // indicated whether this input is a reportable output

	static readonly uiSortOrder = new NaturalOrderComparator();

	constructor(key: string, cat: string, def: T | null) {
		this.keyword = key;
		this.category = cat;
		this.defValue = def;

		this.promptReqd = true;
		this.hidden = false;
		this.defText = null;
		this.isReqd = false;
		this._isOutput = true;
		this._isReportable = false;

		this.reset();
	}

	doCallback(ent: Entity): void {
		if (this.callback !== null)
			this.callback.callback(ent, this as Input<unknown>);
	}

	setCallback(back: InputCallback | null): void {
		this.callback = back;
	}

	/**
	 * Sets the input to its default value.
	 * reset(ent) は reset() を呼ぶだけ（Java と同じ）。
	 */
	reset(ent?: Entity): void {
		if (ent !== undefined) {
			this.reset();
			return;
		}
		this.value = this.defValue;
		this.valueTokens = null;
		this.edited = false;
		this.isDef = true;
		this._isValid = true;
		this._isInherited = false;
	}

	/**
	 * Deletes any use of the specified entity from this input.
	 * @param ent - entity whose references are to be deleted
	 * @return true if a reference was removed
	 */
	removeReferences(ent: Entity): boolean {
		return false;
	}

	/**
	 * Appends the entities referenced by the value for this input.
	 * @param list - list of entity references
	 */
	appendEntityReferences(list: Entity[]): void {}

	/**
	 * Describes the valid inputs for this type of input.
	 * @return description of valid inputs
	 */
	getValidInputDesc(): string | null {
		return null;
	}

	/**
	 * Provides one or more example input strings for this type of input.
	 * @return examples of valid inputs
	 */
	getExamples(): string[] {
		return [];
	}

	/**
	 * Corrects common input errors that can be detected prior to parsing.
	 * @param str - uncorrected input string
	 * @return corrected input string
	 */
	applyConditioning(str: string): string {
		return str;
	}

	toString(): string {
		return javaToString(this.value, this.isIntegerValue());
	}

	getKeyword(): string {
		return this.keyword;
	}

	setKeyword(str: string): void {
		this.keyword = str;
	}

	getCategory(): string {
		return this.category;
	}

	isSynonym(): boolean {
		return false;
	}

	setDefaultText(str: string | null): void {
		this.defText = str;
	}

	getDefaultText(): string | null {
		return this.defText;
	}

	/**
	 * Sets the default value and returns the input to its new default state.
	 * @param val - new default value
	 */
	setDefaultValue(val: T | null): void {
		this.defValue = val;
		this.reset();
	}

	getDefaultValue(): T | null {
		return this.defValue;
	}

	/**
	 * Returns a string representing the default value for the input using the preferred units
	 * specified for the simulation model.
	 * @param simModel - simulation model
	 * @return string representing the default value
	 */
	getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";
		return javaToString(this.defValue, this.isIntegerValue());
	}

	/**
	 * getValue() … 入力の値（既定なら原型の値）。
	 * getValue(thisEnt, simTime, klass) … 出力として使うときの値（Java の getValue(Entity, double, Class)）。
	 */
	getValue(): T | null;
	getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | JType | null): V | null;
	getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt !== undefined)
			return this.getValue();
		if (this.isDef && this.protoInput !== null)
			return this.protoInput.getValue();
		return this.value;
	}

	/** Java の Class<?> の代わりに、OutputReturnType の文字列（無ければ null） */
	getReturnType(): OutputReturnType | null {
		return null;
	}

	getUnitType(): JClass<Unit> | null {
		return null;
	}

	isIntegerValue(): boolean {
		return false;
	}

	setProtoInput(inp: Input<unknown> | null): void {
		this.protoInput = inp as Input<T> | null;
	}

	getProtoInput(): Input<T> | null {
		return this.protoInput;
	}

	setHidden(hide: boolean): void {
		this.hidden = hide;
	}

	getHidden(): boolean {
		return this.hidden;
	}

	setEdited(bool: boolean): void {
		this.edited = bool;
	}

	isEdited(): boolean {
		return this.edited;
	}

	setPromptReqd(bool: boolean): void {
		this.promptReqd = bool;
	}

	isPromptReqd(): boolean {
		return this.promptReqd;
	}

	setRequired(bool: boolean): void {
		this.isReqd = bool;
	}

	isRequired(): boolean {
		return this.isReqd;
	}

	setValid(bool: boolean): void {
		this._isValid = bool;
	}

	isValid(): boolean {
		return this._isValid;
	}

	setLocked(bool: boolean): void {
		this._isLocked = bool;
	}

	isLocked(): boolean {
		return this._isLocked;
	}

	setInherited(bool: boolean): void {
		this._isInherited = bool;
	}

	isInherited(): boolean {
		return this._isInherited;
	}

	setOutput(bool: boolean): void {
		this._isOutput = bool;
	}

	isOutput(): boolean {
		return this._isOutput && this.getReturnType() !== null;
	}

	setReportable(bool: boolean): void {
		this._isReportable = bool;
	}

	isReportable(): boolean {
		return this._isReportable;
	}

	useExpressionBuilder(): boolean {
		return false;
	}

	getStubDefinition(): string | null {
		return null;
	}

	/**
	 * Returns a string representing the value for this input at the present simulation time and
	 * using the preferred units specified for the simulation model. Any expressions included in
	 * the input are evaluated.
	 * @param thisEnt - entity whose input is being evaluated
	 * @param simTime - present simulation time
	 * @return string representing the input value
	 */
	getPresentValueString(thisEnt: Entity, simTime: number): string {
		return this.getValueString();
	}

	/** @throws InputErrorException */
	validate(): void {
		if (this.isReqd && this.isDefault() && !this.hidden)
			throw new InputErrorException(tr("An input must be provided for the keyword '%s'."), this.keyword);
	}

	setTokens(kw: KeywordIndex): void {
		this.isDef = false;
		this.valueTokens = kw.getArgArray();
	}

	/**
	 * Add the given tokens to the present value tokens
	 */
	addTokens(args: string[]): void {

		// Create an array sized for the addition of new tokens
		let newValueTokens: string[];
		if (this.valueTokens === null) {
			// Copy the new tokens into the array
			newValueTokens = args.slice(1);
		}
		else {
			// Copy the old tokens into the array
			// Copy the new tokens into the array
			newValueTokens = [...this.valueTokens, ...args.slice(1)];
		}

		this.valueTokens = newValueTokens;
	}

	/**
	 * Remove the given tokens from the present value tokens
	 * @return - true if all the tokens were successfully removed
	 */
	removeTokens(args: string[]): boolean {

		const valueTokens = this.valueTokens as string[];  // Java は null なら NullPointerException
		const newSize = valueTokens.length - (args.length - 1);
		if (newSize >= 0) {

			// Create an array sized for the removal of tokens
			const newValueTokens: (string | null)[] = new Array(newSize).fill(null);
			let index = 0;

			// Loop through the original tokens
			for (let i = 0; i < valueTokens.length; i++) {

				// Determine if this token is to be kept
				let keep = true;
				for (let j = 1; j < args.length; j++) {
					if (args[j] === valueTokens[i]) {
						keep = false;
						break;
					}
				}

				// If the token is to be kept, add it to the array
				if (keep) {
					if (index >= newSize)  // Java は配列の外への書き込みで例外になる
						throw new RangeError("Index " + index + " out of bounds for length " + newSize);
					newValueTokens[index] = valueTokens[i];
					index++;
				}
			}

			// If the correct number of items were kept, reset valueTokens
			if (index === newSize) {
				this.valueTokens = newValueTokens as string[];
				return true;
			}
		}
		return false;
	}

	/**
	 * Append the given tokens to the present value tokens
	 */
	appendTokens(args: string[]): void {

		// Determine if braces need to be added around original tokens
		let addBracesAroundOriginalTokens = false;

		// Determine the size for an array with original and new tokens
		if (this.valueTokens !== null) {
			if (this.valueTokens[0] !== "{") {
				addBracesAroundOriginalTokens = true;
			}
		}

		// Determine if braces need to be added around new tokens
		let addBracesAroundNewTokens = false;
		if (args[0] !== "{") {
			addBracesAroundNewTokens = true;
		}

		// Copy the old and new tokens into the array
		const newValueTokens: string[] = [];
		if (addBracesAroundOriginalTokens) {
			newValueTokens.push("{", ...(this.valueTokens as string[]), "}");
		}
		else if (this.valueTokens !== null) {
			newValueTokens.push(...this.valueTokens);
		}
		if (addBracesAroundNewTokens) {
			newValueTokens.push("{", ...args, "}");
		}
		else {
			newValueTokens.push(...args);
		}

		this.valueTokens = newValueTokens;
	}

	/**
	 * Returns whether the input has not been set and is not inherited from its protoInput
	 * @return true if the input has not been set and is not inherited
	 */
	isDefault(): boolean {
		return this.isDef && (this.protoInput === null || this.protoInput.isDefault());
	}

	/**
	 * Returns whether the input has not been set.
	 * （Java の isDef()。フィールドの isDef と名前がぶつかるので getIsDef にした）
	 */
	getIsDef(): boolean {
		return this.isDef;
	}

	getSequenceNumber(): number {
		if (InputAgent.isEarlyInput(this as Input<unknown>))
			return 0;
		return 1;
	}

	/**
	 * Returns an array of white-space delimited strings that can be used to generate the input
	 * file entry for this input value.
	 * （Java の getValueTokens()。引数つきの getValueTokens(toks) と分けるため名前を変えた）
	 * @return array of strings
	 */
	getValueTokenList(): string[] {
		const ret: string[] = [];
		this.getValueTokens(ret);
		return ret;
	}

	/**
	 * Populates an array of white-space delimited strings that can be used to generate the input
	 * file string for this input value.
	 * @param toks - array of strings to be populated
	 */
	getValueTokens(toks: string[]): void {
		if (this.valueTokens === null)
			return;

		for (const each of this.valueTokens)
			toks.push(each);
	}

	/**
	 * Adds the value tokens within a specified pair of opening and closing braces.
	 * @param n - specifies the pair of opening and closing braces to choose
	 * @param toks - array of strings to be populated
	 */
	getSubValueTokens(n: number, toks: string[]): void {
		if (this.valueTokens === null)
			return;

		let index = -1;
		let level = 0;
		for (let i = 0; i < this.valueTokens.length; i++) {
			if (this.valueTokens[i] === "{") {
				level++;
				if (level === 1)
					index++;
				continue;
			}
			if (this.valueTokens[i] === "}") {
				level--;
				if (level === 0 && index === n)
					return;
				continue;
			}
			if (index === n) {
				toks.push(this.valueTokens[i]);
			}
		}
	}

	/**
	 * Returns the input file entry for this input or the entry inherited from its prototype.
	 * @return input file text
	 */
	getValueString(): string {
		if (this.isDef && this.protoInput !== null)
			return this.protoInput.getValueString();
		return this.getInputString();
	}

	/**
	 * Returns the input file entry for this input value.
	 * @return input file text
	 */
	getInputString(): string {
		if (this.isDef) return "";
		const tmp: string[] = [];
		this.getValueTokens(tmp);
		return Input.getValueString(tmp, false);
	}

	/**
	 * Returns the input value that has been inherited from the input's prototype.
	 * @return input file text
	 */
	getInheritedValueString(): string {
		if (this.protoInput === null)
			return "";
		return this.protoInput.getValueString();
	}

	/**
	 * Returns the input file entry for the specified array of white-space delimited strings.
	 * @param tokens - array of strings for the input
	 * @param addLF - true if a newline character is to be added before each inner brace
	 * @return input file text
	 */
	static getValueString(tokens: (string | null)[], addLF: boolean): string {
		if (tokens.length === 0) return "";

		let sb = "";
		for (let i = 0; i < tokens.length; i++) {
			const dat = tokens[i];
			if (dat === null) continue;
			if (i > 0) {
				if (dat === "}" || tokens[i-1] === "{") {
					sb += Input.BRACE_SEPARATOR;
				}
				else if (dat === "{") {
					if (addLF) {
						sb += "\n";
					}
					else {
						sb += Input.BRACE_SEPARATOR;
					}
				}
				else {
					sb += Input.SEPARATOR;
				}
			}

			if (Parser.needsQuoting(dat) && dat !== "{" && dat !== "}")
				sb += "'" + dat + "'";
			else
				sb += dat;
		}
		return sb;
	}

	/**
	 * Returns the value tokens for this input or that were inherited from its prototype input.
	 * @return value tokens
	 */
	getValueArray(): string[] {
		if (this.isDef && this.protoInput !== null)
			return this.protoInput.getValueArray();
		if (this.isDef)
			return [];
		return this.valueTokens as string[];
	}

	/**
	 * Returns the value tokens that has been inherited from the input's prototype.
	 * @return value tokens for the prototype
	 */
	getInheritedValueArray(): string[] {
		if (this.protoInput === null)
			return [];
		return this.protoInput.getValueArray();
	}

	/** @throws InputErrorException */
	abstract parse(thisEnt: Entity, kw: KeywordIndex): void;


	/**
	 * Verifies that the correct number of inputs have been provided.
	 * assertCount(DoubleVector, ...counts)・assertCount(KeywordIndex, ...counts)・assertCount(List<String>, ...counts) の 3 つ。
	 * @throws InputErrorException
	 */
	static assertCount(input: DoubleVector | KeywordIndex | string[], ...counts: number[]): void {
		if (input instanceof KeywordIndex) {
			const kw = input;
			// If there is no constraint on the element count, return
			if (counts.length === 0)
				return;

			// If there is an exact constraint, check the count
			for (const each of counts) {
				if (each === kw.numArgs())
					return;
			}

			// Input size is not equal to any of the specified counts
			if (counts.length === 1)
				throw new InputErrorException(tr(Input.INP_ERR_COUNT), counts[0], kw.argString());
			else {
				let sb = String(counts[0]);
				for (let i=1; i<counts.length-1; i++) {
					sb += ", " + counts[i];
				}
				sb += " or " + counts[counts.length-1];
				throw new InputErrorException(tr(Input.INP_ERR_COUNT), sb, kw.argString());
			}
		}

		// If there is no constraint on the element count, return
		if (counts.length === 0)
			return;

		// If there is an exact constraint, check the count
		const size = Array.isArray(input) ? input.length : input.size();
		for (const each of counts) {
			if (each === size)
				return;
		}

		// Input size is not equal to any of the specified counts
		throw new InputErrorException(tr(Input.INP_ERR_COUNT), "[" + counts.join(", ") + "]", javaToString(input));
	}

	/**
	 * Verifies that the correct number of inputs have been provided.
	 * assertCountRange(KeywordIndex|DoubleVector|List<String>, min, max) の 3 つ。
	 * @param min - minimum number of inputs that are valid
	 * @param max - maximum number of inputs that are valid
	 * @throws InputErrorException
	 */
	static assertCountRange(input: KeywordIndex | DoubleVector | string[], min: number, max: number): void {
		// For a range with a single value, fall back to the exact test
		if (min === max) {
			Input.assertCount(input, min);
			return;
		}

		const size = input instanceof KeywordIndex ? input.numArgs() : Array.isArray(input) ? input.length : input.size();
		const str = input instanceof KeywordIndex ? input.argString() : javaToString(input);
		if (size < min || size > max) {
			if (max === Integer.MAX_VALUE)
				throw new InputErrorException(tr(Input.INP_ERR_RANGECOUNTMIN), min, str);
			throw new InputErrorException(tr(Input.INP_ERR_RANGECOUNT), min, max, str);
		}
	}

	/** @throws InputErrorException */
	static assertCountEven(kw: KeywordIndex): void {
		if ((kw.numArgs() % 2) !== 0)
			throw new InputErrorException(tr(Input.INP_ERR_EVENCOUNT), kw.argString());
	}

	/** @throws InputErrorException */
	static assertCountOdd(kw: KeywordIndex): void {
		if ((kw.numArgs() % 2) === 0)
			throw new InputErrorException(tr(Input.INP_ERR_ODDCOUNT), kw.argString());
	}

	/** @throws InputErrorException */
	static assertNotPresent<T extends Entity>(list: unknown[], ent: T): void {
		if (list.includes(ent))
			throw new InputErrorException(tr(Input.INP_ERR_NOTVALIDENTRY), ent.getName());
	}

	/** @throws InputErrorException */
	static assertSumTolerance(vec: DoubleVector, sum: number, tol: number): void {
		// Vector sum is within tolerance of given sum, no error
		if (Math.abs(vec.sum() - sum) < tol)
			return;

		throw new InputErrorException(tr(Input.INP_ERR_BADSUM), sum, vec.sum());
	}

	/** @throws InputErrorException */
	static assertSumRange(vec: DoubleVector, min: number, max: number): void {
		const sum = vec.sum();
		if ((MathUtils.nearGT(sum, min) || min === Double.NEGATIVE_INFINITY) && (MathUtils.nearLT(sum, max) || max === Double.POSITIVE_INFINITY))
			return;

		throw new InputErrorException(tr(Input.INP_ERR_SUMRANGE), jstr(min), jstr(max), jstr(sum));
	}

	/**
	 * assertMonotonic(DoubleVector, direction) と assertMonotonic(double[], direction)。
	 * @throws InputErrorException
	 */
	static assertMonotonic(vec: DoubleVector | number[], direction: number): void {
		const vals = Array.isArray(vec) ? vec : vec.toArray();
		if (direction === 0)
			return;

		for (let i = 1; i < vals.length; i++) {
			const diff = vals[i] - vals[i - 1];

			if (direction > 0 && diff < 0.0)
				throw new InputErrorException(tr(Input.INP_ERR_MONOTONIC), "increase", i, jstr(vals[i - 1]), jstr(vals[i]));

			if (direction < 0 && diff > 0.0)
				throw new InputErrorException(tr(Input.INP_ERR_MONOTONIC), "decrease", i, jstr(vals[i - 1]), jstr(vals[i]));
		}
	}

	/** @throws InputErrorException */
	static assertBracesMatch(kw: KeywordIndex): void {
		let depth = 0;
		for (let i= 0; i < kw.numArgs(); i++) {
			if (kw.getArg(i) === "{") {
				depth++;
				continue;
			}
			if (kw.getArg(i) === "}") {
				depth--;
				continue;
			}
		}
		if (depth !== 0)
			throw new InputErrorException(tr(Input.INP_ERR_BRACES));
	}

	/**
	 * Converts a file path entry in a configuration file to a URI.
	 * @param kw - keyword input containing the file path data
	 * @return the URI corresponding to the file path data.
	 * @throws InputErrorException
	 */
	static parseURI(sm: JaamSimModel, kw: KeywordIndex): URI {
		Input.assertCount(kw, 1);

		const arg = kw.getArg(0);

		// Convert the file path to a URI
		let uri: URI | null = null;
		try {
			if (kw.context !== null)
				uri = InputAgent.getFileURI(sm, kw.context.context, arg, kw.context.jail);
			else
				uri = InputAgent.getFileURI(sm, null, arg, null);
		}
		catch (ex) {
			if (!(ex instanceof URISyntaxException))
				throw ex;
			throw new InputErrorException(tr("File Entity parse error: %s"), ex.getMessage());
		}

		if (uri === null)
			throw new InputErrorException(tr("Unable to parse the file path:\n%s"), arg);

		if (!uri.isOpaque() && uri.getPath() === null)
			 throw new InputErrorException(tr("Unable to parse the file path:\n%s"), arg);

		return uri;
	}

	/** @throws InputErrorException */
	static parseBoolean(data: string): boolean {
		if ("TRUE" === data) {
			return true;
		}

		if ("FALSE" === data) {
			return false;
		}

		throw new InputErrorException(tr(Input.INP_ERR_BOOLEAN), data);
	}

	/** @throws InputErrorException */
	static parseBooleanVector(kw: KeywordIndex): BooleanVector {
		const temp = new BooleanVector(kw.numArgs());

		for (let i = 0; i < kw.numArgs(); i++) {
			try {
				const element = Input.parseBoolean(kw.getArg(i));
				temp.add(element);
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		return temp;
	}

	/** @throws InputErrorException */
	static parseColorVector(simModel: JaamSimModel, kw: KeywordIndex): Color4d[] {
		const subArgs = kw.getSubArgs();
		const temp: Color4d[] = [];

		for (let i = 0; i < subArgs.length; i++) {
			try {
				const element = Input.parseColour(simModel, subArgs[i]);
				temp.push(element);
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		return temp;
	}

	static parseClass(data: string): JClass<Entity> {
		const proto = ClassRegistry.forName(data);
		if (proto === null)
			throw new InputErrorException(tr("Class not found ") + data);
		// Java の asSubclass(Entity.class)（Entity でなければ ClassCastException）
		if (!jIsAssignableFrom(Entity, proto))
			throw new TypeError(`Cannot cast ${data} to com.jaamsim.basicsim.Entity`);
		return proto as JClass<Entity>;
	}

	/**
	 * parseInteger(data) と parseInteger(data, minValue, maxValue)。
	 * @throws InputErrorException
	 */
	static parseInteger(data: string, minValue: number = Integer.MIN_VALUE, maxValue: number = Integer.MAX_VALUE): number {
		let temp: number;
		try {
			temp = Integer.parseInt(data);
		}
		catch (e) {
			if (!(e instanceof NumberFormatException))
				throw e;
			throw new InputErrorException(tr(Input.INP_ERR_INTEGER), data);
		}

		if (temp < minValue || temp > maxValue)
			throw new InputErrorException(tr(Input.INP_ERR_INTEGERRANGE), minValue, maxValue, temp);

		return temp;
	}

	static isInteger(val: string): boolean {
		try {
			Integer.parseInt(val);
			return true;
		}
		catch (e) {
			if (!(e instanceof NumberFormatException))
				throw e;
			return false;
		}
	}

	static isDouble(val: string): boolean {
		try {
			Double.parseDouble(val);
			return true;
		}
		catch (e) {
			if (!(e instanceof NumberFormatException))
				throw e;
			return false;
		}
	}

	/** @throws InputErrorException */
	static parseIntegerVector(kw: KeywordIndex, minValue: number, maxValue: number): IntegerVector {
		const temp = new IntegerVector(kw.numArgs());

		for (let i = 0; i <kw.numArgs(); i++) {
			try {
				const element = Input.parseInteger(kw.getArg(i), minValue, maxValue);
				temp.add(element);
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		return temp;
	}

	/**
	 * Convert the given String to a double and apply the given conversion factor
	 * parseTime(data, minValue, maxValue) と parseTime(data, minValue, maxValue, factor)。
	 * @throws InputErrorException
	 */
	static parseTime(data: string, minValue: number, maxValue: number, factor = 1.0): number {
		let value = 0.0;

		// check for hh:mm:ss or hh:mm
		if (data.indexOf(":") > -1) {
			const splitDouble = jsplit(data, ":");
			if (splitDouble.length !== 2 && splitDouble.length !== 3)
				throw new InputErrorException(tr(Input.INP_ERR_TIME), data);

			try {
				const hour = Double.parseDouble(splitDouble[0]);
				const min = Double.parseDouble(splitDouble[1]);
				let sec = 0.0;

				if (splitDouble.length === 3)
					sec = Double.parseDouble(splitDouble[2]);

				value = hour + (min / 60.0) + (sec / 3600.0);
			}
			catch (e) {
				if (!(e instanceof NumberFormatException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_TIME), data);
			}
		} else {
			value = Input.parseDouble(data);
		}
		value = value * factor;

		if (value < minValue || value > maxValue)
			throw new InputErrorException(tr(Input.INP_ERR_DOUBLERANGE), minValue, maxValue, value);

		return value;
	}

	private static readonly is8601date = /^\d{4}-\d{2}-\d{2}$/;
	private static readonly is8601short = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;
	private static readonly is8601time = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;
	private static readonly is8601full = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\.\d{1,6}$/;
	private static readonly isextendshort = /^\d{1,}:\d{2}$/;
	private static readonly isextendtime = /^\d{1,}:\d{2}:\d{2}$/;
	private static readonly isextendfull = /^\d{1,}:\d{2}:\d{2}.\d{1,6}$/;
	private static readonly usPerSec = 1000000;
	private static readonly usPerMin = 60 * Input.usPerSec;
	private static readonly usPerHr  = 60 * Input.usPerMin;
	private static readonly usPerDay = 24 * Input.usPerHr;
	static readonly usPerYr  = 365 * Input.usPerDay;

	static isRFC8601DateTime(input: string): boolean {
		if (Input.isRFC8601Date(input)) return true;
		if (Input.isextendshort.test(input)) return true;
		if (Input.isextendtime.test(input)) return true;
		if (Input.isextendfull.test(input)) return true;
		return false;
	}

	static isRFC8601Date(input: string): boolean {
		if (Input.is8601short.test(input)) return true;
		if (Input.is8601time.test(input)) return true;
		if (Input.is8601full.test(input)) return true;
		if (Input.is8601date.test(input)) return true;
		return false;
	}

	/** 小数の秒（1 桁から 6 桁）を、マイクロ秒の整数にする */
	private static parseMicros(usChars: string): number {
		let us = 0;
		switch (usChars.length) {
		case 1: us =  Integer.parseInt(usChars) * 100000; break;
		case 2: us =  Integer.parseInt(usChars) *  10000; break;
		case 3: us =  Integer.parseInt(usChars) *   1000; break;
		case 4: us =  Integer.parseInt(usChars) *    100; break;
		case 5: us =  Integer.parseInt(usChars) *     10; break;
		case 6: us =  Integer.parseInt(usChars) *      1; break;
		}
		return us;
	}

	/**
	 * Parse an RFC8601 date time and returns the corresponding simulation time in seconds from the
	 * start of the simulation run.
	 * An RFC8601 date time looks like YYYY-MM-DD HH:MM:SS.mmm or YYYY-MM-DDTHH:MM:SS.mmm
	 * @param simModel - JaamSimModel
	 * @param input - date string
	 * @return simulation time in seconds
	 */
	static parseRFC8601DateTime(simModel: JaamSimModel, input: string): number {
		if (Input.isRFC8601Date(input)) {
			const date = Input.parseRFC8601Date(input);
			const millis = simModel.getCalendarMillis(date[0], date[1] - 1, date[2], date[3], date[4], date[5], date[6]);
			return simModel.calendarMillisToSimTime(millis);
		}

		// hh:mm format
		if (Input.isextendshort.test(input)) {
			const len = input.length;
			const hh = Integer.parseInt(input.substring(0, len - 3));
			const mm = Integer.parseInt(input.substring(len - 2, len));

			if (mm < 0 || mm > 59)
				throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);

			let ret = 0;
			ret += hh * Input.usPerHr;
			ret += mm * Input.usPerMin;
			return ret * 1e-6;
		}

		// hh:mm:ss format
		if (Input.isextendtime.test(input)) {
			const len = input.length;
			const hh = Integer.parseInt(input.substring(0, len - 6));
			const mm = Integer.parseInt(input.substring(len - 5, len - 3));
			const ss = Integer.parseInt(input.substring(len - 2, len));

			if (mm < 0 || mm > 59 || ss < 0 || ss > 59)
				throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);

			let ret = 0;
			ret += hh * Input.usPerHr;
			ret += mm * Input.usPerMin;
			ret += ss * Input.usPerSec;
			return ret * 1e-6;
		}

		// hh:mm:ss.ssssss format
		if (Input.isextendfull.test(input)) {
			const len = input.indexOf(".");
			// TODO(移植): Java の正規表現は小数点の所が "."（どの文字でもよい）。"." が無いと len が -1 になり、Java は substring で例外になる
			const hh = Integer.parseInt(input.substring(0, len - 6));
			const mm = Integer.parseInt(input.substring(len - 5, len - 3));
			const ss = Integer.parseInt(input.substring(len - 2, len));

			if (mm < 0 || mm > 59 || ss < 0 || ss > 59)
				throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);

			// grab the us values and zero-pad to a full 6-digit number
			const usChars = input.substring(len + 1, input.length);
			const us = Input.parseMicros(usChars);
			let ret = 0;
			ret += hh * Input.usPerHr;
			ret += mm * Input.usPerMin;
			ret += ss * Input.usPerSec;
			ret += us;
			return ret * 1e-6;
		}

		throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);
	}

	/**
	 * Parse an RFC8601 date time and return an array containing the date numbers.
	 * An RFC8601 date time looks like YYYY-MM-DD HH:MM:SS.mmm or YYYY-MM-DDTHH:MM:SS.mmm
	 * @param input - date string
	 * @return integer array containing the year, month (0 - 11), day of month (1 - 31),
	 *         hour of day (0 - 23), minute (0 - 59), second (0 - 59), millisecond (0 - 999)
	 */
	static parseRFC8601Date(input: string): number[] {
		let YY = 0, MM = 0, DD = 0, hh = 0, mm = 0, ss = 0, ms = 0;

		// YY-MM-DD hh:mm format
		if (Input.is8601short.test(input)) {
			YY = Integer.parseInt(input.substring(0, 4));
			MM = Integer.parseInt(input.substring(5, 7));
			DD = Integer.parseInt(input.substring(8, 10));
			hh = Integer.parseInt(input.substring(11, 13));
			mm = Integer.parseInt(input.substring(14, 16));
		}

		// YY-MM-DD hh:mm:ss format
		else if (Input.is8601time.test(input)) {
			YY = Integer.parseInt(input.substring(0, 4));
			MM = Integer.parseInt(input.substring(5, 7));
			DD = Integer.parseInt(input.substring(8, 10));
			hh = Integer.parseInt(input.substring(11, 13));
			mm = Integer.parseInt(input.substring(14, 16));
			ss = Integer.parseInt(input.substring(17, 19));
		}

		// YY-MM-DD hh:mm:ss.sss format
		else if (Input.is8601full.test(input)) {
			YY = Integer.parseInt(input.substring(0, 4));
			MM = Integer.parseInt(input.substring(5, 7));
			DD = Integer.parseInt(input.substring(8, 10));
			hh = Integer.parseInt(input.substring(11, 13));
			mm = Integer.parseInt(input.substring(14, 16));
			ss = Integer.parseInt(input.substring(17, 19));

			// grab the us values and zero-pad to a full 6-digit number
			const usChars = input.substring(20, input.length);
			const us = Input.parseMicros(usChars);
			ms = Math.trunc(us/1000);
		}

		// YY-MM-DD format
		else if (Input.is8601date.test(input)) {
			YY = Integer.parseInt(input.substring(0, 4));
			MM = Integer.parseInt(input.substring(5, 7));
			DD = Integer.parseInt(input.substring(8, 10));
		}

		else {
			throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);
		}

		if (MM < 1 || MM > 12 || DD < 1 || DD > Input.daysInMonth[MM - 1]
				|| hh < 0 || hh > 23 || mm < 0 || mm > 59
				|| ss < 0 || ss > 59 || ms < 0 || ms > 999)
			throw new InputErrorException(tr(Input.INP_ERR_BADDATE), input);

		return [YY, MM, DD, hh, mm, ss, ms];
	}

	private static readonly daysInMonth: number[] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	/**
	 * Convert the given String to a double and apply the given conversion factor
	 * parseDouble(data)・parseDouble(data, minValue, maxValue)・parseDouble(data, minValue, maxValue, factor)。
	 * @throws InputErrorException
	 */
	static parseDouble(data: string, minValue: number = Double.NEGATIVE_INFINITY, maxValue: number = Double.POSITIVE_INFINITY, factor = 1.0): number {
		let temp: number;
		try {
			temp = Double.parseDouble(data) * factor;
		}
		catch (e) {
			if (!(e instanceof NumberFormatException))
				throw e;
			throw new InputErrorException(tr(Input.INP_ERR_DOUBLE), data);
		}

		if (temp < minValue || temp > maxValue)
			throw new InputErrorException(tr(Input.INP_ERR_DOUBLERANGE), minValue, maxValue, temp);

		return temp;
	}

	/**
	 * Convert the given input to a DoubleVector and apply the given conversion factor
	 * @throws InputErrorException
	 */
	static parseDoubles(simModel: JaamSimModel, kw: KeywordIndex, minValue: number, maxValue: number, unitType: JClass<Unit>): DoubleVector {

		if (unitType === UserSpecifiedUnit)
			throw new InputErrorException(tr(Input.INP_ERR_UNITUNSPECIFIED));

		let factor = 1.0;
		const numArgs = kw.numArgs();
		let numDoubles = numArgs;
		let includeIndex = true;

		// Parse the unit portion of the input
		const unitName = Parser.removeEnclosure("[", kw.getArg(numArgs-1), "]");
		const unit = Input.tryParseUnit(simModel, unitName, unitType);


		// A unit is mandatory except for dimensionless values and time values in RFC8601 date/time format
		if (unit === null && unitType !== DimensionlessUnit && unitType !== TimeUnit)
			throw new InputErrorException(tr(Input.INP_ERR_NOUNITFOUND), kw.getArg(numArgs-1), simpleNameOf(unitType));

		if (unit !== null) {
			factor = unit.getConversionFactorToSI();
			numDoubles = numArgs - 1;
		}

		// Parse the numeric portion of the input
		const temp = new DoubleVector(numDoubles);
		for (let i = 0; i < numDoubles; i++) {
			try {
				// Time input
				if (unitType === TimeUnit) {

					// RFC8601 date/time format
					if (Input.isRFC8601DateTime(kw.getArg(i))) {
						const element = Input.parseRFC8601DateTime(simModel, kw.getArg(i));
						if (element < minValue || element > maxValue)
							throw new InputErrorException(tr(Input.INP_ERR_DOUBLERANGE), minValue, maxValue, element);
						temp.add(element);
					}
					// Normal format
					else {
						if (unit === null) {
							includeIndex = false;
							throw new InputErrorException(tr(Input.INP_ERR_NOUNITFOUND), kw.getArg(numArgs-1), simpleNameOf(unitType));
						}
						const element = Input.parseDouble(kw.getArg(i), minValue, maxValue, factor);
						temp.add(element);
					}
				}
				// Non-time input
				else {
					const element = Input.parseDouble(kw.getArg(i), minValue, maxValue, factor);
					temp.add(element);
				}
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				if (includeIndex && numDoubles > 1)
					throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
				else
					throw e;
			}
		}
		return temp;
	}

	/**
	 * parseString(input, validList) と parseString(input, validList, caseSensitive)。
	 * @throws InputErrorException
	 */
	static parseString(input: string, validList: string[], caseSensitive = false): string {
		for (const valid of validList) {
			if (caseSensitive && valid === input)
				return valid;

			if (!caseSensitive && jEqualsIgnoreCaseLocal(valid, input))
				return valid;
		}

		throw new InputErrorException(tr(Input.INP_ERR_BADCHOICE), javaToString(validList), input);
	}

	/** @throws InputErrorException */
	static parseStrings(kw: KeywordIndex, validList: string[], caseSensitive: boolean): string[] {
		const temp: string[] = [];

		for (let i = 0; i < kw.numArgs(); i++) {
			try {
				// Java も caseSensitive を渡していない（大文字と小文字を区別しない）
				const element = Input.parseString(kw.getArg(i), validList);
				temp.push(element);
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		return temp;
	}

	static parseEnum<T>(aClass: JEnumClass<T>, input: string | null): T {
		const ret = enumValueOf(aClass, input);
		if (ret === null)
			throw new InputErrorException(tr(Input.INP_ERR_BADCHOICE), enumConstantsString(aClass), input);
		return ret;
	}

	static parseEnumList<T>(aClass: JEnumClass<T>, kw: KeywordIndex): T[] {
		const ret: T[] = [];
		for (let i=0; i<kw.numArgs(); i++) {
			const v = enumValueOf(aClass, kw.getArg(i));
			if (v === null)
				throw new InputErrorException(tr(Input.INP_ERR_BADCHOICE), enumConstantsString(aClass), kw.getArg(i));
			ret.push(v);
		}
		return ret;
	}

	/** @throws InputErrorException */
	static parseEntityType(simModel: JaamSimModel, input: string): JClass<Entity> {
		const type = Input.tryParseEntity(simModel, input, ObjectType);
		if (type === null)
			throw new InputErrorException(tr("Entity type not found: %s"), input);

		const klass = type.getJavaClass();
		if (klass === null)
			throw new InputErrorException(tr("ObjectType %s does not have a java class set"), input);

		return klass;
	}

	/** @throws InputErrorException */
	static assertUnitsMatch(u1: JClass<Unit> | null, u2: JClass<Unit> | null): void {
		if (u1 !== u2)
			throw new InputErrorException(tr(Input.INP_ERR_UNITS));
	}

	static checkCast<T extends Entity>(klass: JClass<Entity>, parent: JClass<T>): JClass<T> {
		if (!jIsAssignableFrom(parent, klass))
			throw new InputErrorException(tr(Input.INP_ERR_NOTSUBCLASS), javaNameOf(parent), javaNameOf(klass));
		return klass as JClass<T>;
	}

	/**
	 * Java の klass.cast(ent)。ent が null なら null。klass はクラスか JInterface。
	 * @throws InputErrorException
	 */
	static castImplements<T>(ent: Entity | null, klass: JClass<T> | JInterface<T>): T {
		if (ent === null)
			return null as T;
		const ok = typeof klass === "function" ? ent instanceof klass : klass.isInstance(ent);
		if (!ok)
			throw new InputErrorException(tr(Input.INP_ERR_INTERFACE), javaNameOf(klass), ent.getName());
		return ent as unknown as T;
	}

	private static castEntity<T extends Entity>(ent: Entity | null, aClass: JClass<T>): T | null {
		if (ent === null)
			return null;
		if (!(ent instanceof aClass))
			return null;
		return ent as T;
	}

	/** @throws InputErrorException */
	static parseEntity<T extends Entity>(simModel: JaamSimModel, choice: string, aClass: JClass<T>): T {
		const ent = simModel.getNamedEntity(choice);
		if (ent === null) {
			throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), choice);
		}
		const t = Input.castEntity(ent, aClass);
		if (t === null) {
			throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), choice, ClassRegistry.simpleName(ent));
		}
		return t;
	}

	static tryParseEntity<T extends Entity>(simModel: JaamSimModel, choice: string, aClass: JClass<T>): T | null {
		return Input.castEntity(simModel.getNamedEntity(choice), aClass);
	}

	static tryParseUnit<T extends Unit>(simModel: JaamSimModel, choice: string, aClass: JClass<T>): T | null {
		return Input.castEntity(simModel.getNamedEntity(choice), aClass);
	}

	/** @throws InputErrorException */
	static parseUnit(simModel: JaamSimModel, str: string): Unit {
		const u = Input.tryParseUnit(simModel, str, Unit);
		if (u === null)
			throw new InputErrorException(tr("Could not find a unit named: %s"), str);

		return u;
	}

	static parseUnitType(simModel: JaamSimModel, utName: string): JClass<Unit> {
		const ot = Input.parseEntity(simModel, utName, ObjectType);
		const ut = Input.checkCast(ot.getJavaClass() as JClass<Entity>, Unit);
		return ut;
	}

	/** @throws InputErrorException */
	static parseEntityList<T extends Entity>(simModel: JaamSimModel, kw: KeywordIndex, aClass: JClass<T>, unique: boolean): T[] {
		const temp: T[] = [];

		for (let i = 0; i < kw.numArgs(); i++) {
			const ent = simModel.getNamedEntity(kw.getArg(i));
			if (ent === null) {
				throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), kw.getArg(i));
			}

			// If we found a group, expand the list of Entities
			if (ent instanceof Group && aClass !== (Group as unknown as JClass<T>)) {
				const gList = ent.getList();
				for (let j = 0; j < gList.length; j++) {
					const t = Input.castEntity(gList[j], aClass);
					if (t === null) {
						throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), gList[j], ClassRegistry.simpleName(gList[j]));
					}
					temp.push(t);
				}
			} else {
				const t = Input.castEntity(ent, aClass);
				if (t === null) {
					throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), kw.getArg(i), ClassRegistry.simpleName(ent));
				}
				temp.push(t);
			}
		}

		if (unique)
			Input.assertUnique(temp);

		return temp;
	}

	/** @throws InputErrorException */
	static parseListOfEntityLists<T extends Entity>(simModel: JaamSimModel, kw: KeywordIndex, aClass: JClass<T>, unique: boolean): T[][] {
		const subArgs = kw.getSubArgs();
		const temp: T[][] = [];

		for (let i = 0; i < subArgs.length; i++) {
			try {
				const element = Input.parseEntityList(simModel, subArgs[i], aClass, unique);
				temp.push(element);
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		return temp;
	}

	static parseInterfaceEntity<T>(simModel: JaamSimModel, choice: string, aClass: JClass<T> | JInterface<T>): T {

		const ent = simModel.getNamedEntity(choice);
		if (ent === null) {
			throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), choice);
		}

		const temp = Input.castImplements(ent, aClass);
		if (temp === null) {
			throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), choice, ClassRegistry.simpleName(ent));
		}

		return temp;
	}

	/** @throws InputErrorException */
	static parseInterfaceEntityList<T>(simModel: JaamSimModel, kw: KeywordIndex, aClass: JClass<T> | JInterface<T>, unique: boolean): T[] {
		const temp: T[] = [];

		for (let i = 0; i < kw.numArgs(); i++) {
			const ent = simModel.getNamedEntity(kw.getArg(i));
			if (ent === null) {
				throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), kw.getArg(i));
			}

			// If we found a group, expand the list of Entities
			if (ent instanceof Group) {
				const gList = ent.getList();
				for (let j = 0; j < gList.length; j++) {
					const t = Input.castImplements(gList[j], aClass);
					if (t === null) {
						throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), gList[j], ClassRegistry.simpleName(gList[j]));
					}
					temp.push(t);
				}
			} else {
				const t = Input.castImplements(ent, aClass);
				if (t === null) {
					throw new InputErrorException(tr(Input.INP_ERR_ENTCLASS), simpleNameOf(aClass), kw.getArg(i), ClassRegistry.simpleName(ent));
				}
				temp.push(t);
			}
		}

		if (unique)
			Input.assertUniqueInterface(temp);

		return temp;
	}

	static parseColour(simModel: JaamSimModel, kw: KeywordIndex): Color4d {

		Input.assertCountRange(kw, 1, 4);

		// Color names
		if (kw.numArgs() <= 2) {
			const colAtt = ColourInput.getColorWithName(kw.getArg(0));
			if( colAtt === null )
				throw new InputErrorException(tr(Input.INP_ERR_BADCOLOUR), kw.getArg(0));

			if (kw.numArgs() === 1)
				return colAtt;

			let a = Input.parseDouble(kw.getArg(1), 0.0, 255.0);
			if (a > 1.0)
				a /= 255.0;
			return new Color4d(colAtt.r, colAtt.g, colAtt.b, a);
		}

		// RGB
		else {
			const dbuf = Input.parseDoubles(simModel, kw, 0.0, 255.0, DimensionlessUnit);
			let r = dbuf.get(0);
			let g = dbuf.get(1);
			let b = dbuf.get(2);
			let a = 1.0;
			if (dbuf.size() === 4)
				a = dbuf.get(3);

			if (r > 1.0 || g > 1.0 || b > 1.0) {
				r /= 255.0;
				g /= 255.0;
				b /= 255.0;
			}
			if (a > 1.0) {
				a /= 255.0;
			}

			return new Color4d(r, g, b, a);
		}
	}

	static parseColourProvider(kw: KeywordIndex, thisEnt: Entity): ColourProvider {
		Input.assertCountRange(kw, 1, 4);

		// Parse the input as a colour constant
		try {
			const simModel = thisEnt.getJaamSimModel();
			const col = Input.parseColour(simModel, kw);
			return new ColourProvConstant(col);
		}
		catch (e) {
			if (kw.numArgs() > 1)
				throw e;
		}

		// Parse the input as an expression
		try {
			return new ColourProvExpression(kw.getArg(0), thisEnt);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new InputErrorException(e);
		}
	}

	static parseBooleanProvider(kw: KeywordIndex, thisEnt: Entity): BooleanProvider {
		Input.assertCount(kw, 1);

		// Parse the input as an boolean constant
		if (kw.getArg(0) === BooleanInput.TRUE)
			return new BooleanProvConstant(true);

		if (kw.getArg(0) === BooleanInput.FALSE)
			return new BooleanProvConstant(false);

		// Parse the input as an expression
		try {
			return new BooleanProvExpression(kw.getArg(0), thisEnt);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new InputErrorException(e);
		}
	}

	static parseEntityProvider<T extends Entity>(kw: KeywordIndex, thisEnt: Entity, entClass: JClass<T>): EntityProvider<T> {
		Input.assertCount(kw, 1);

		// Parse the input as an Entity
		try {
			const ent = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), entClass);
			return new EntityProvConstant<T>(ent);
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		// Parse the input as an Expression
		try {
			return new EntityProvExpression<T>(kw.getArg(0), thisEnt, entClass);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new InputErrorException(e);
		}
	}

	static parseEntityListProvider<T extends Entity>(kw: KeywordIndex, thisEnt: Entity, entClass: JClass<T>): EntityListProvider<T> {
		Input.assertCount(kw, 1);

		// Parse the input as an Entity
		try {
			const ent = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), entClass);
			return new EntityProvConstant<T>(ent);
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		// Parse the input as a Group
		try {
			const grp = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Group);
			return new EntityProvGroup<T>(grp);
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		// Parse the input as an Expression
		try {
			return new EntityProvExpression<T>(kw.getArg(0), thisEnt, entClass);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new InputErrorException(e);
		}
	}

	static parseStringProvider(kw: KeywordIndex, thisEnt: Entity, unitType: JClass<Unit>): StringProvider {

		// Parse the input as a StringProvExpression
		if (kw.numArgs() === 1) {
			try {
				return new StringProvExpression(kw.getArg(0), thisEnt, unitType);
			} catch (e) {
				if (!(e instanceof ExpError))
					throw e;
			}
		}

		// Parse the input as a SampleProvider object
		try {
			const samp = Input.parseSampleExp(kw, thisEnt, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, unitType);
			return new StringProvSample(samp);
		} catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		// If nothing else works, return the constant string
		Input.assertCount(kw, 1);
		return new StringProvConstant(kw.getArg(0));
	}

	static parseSampleExp(kw: KeywordIndex,
			thisEnt: Entity, minValue: number, maxValue: number, unitType: JClass<Unit>): SampleProvider {

		if (unitType === UserSpecifiedUnit)
			throw new InputErrorException(tr(Input.INP_ERR_UNITUNSPECIFIED));

		if (unitType === DimensionlessUnit)
			Input.assertCount(kw, 1);
		else
			Input.assertCountRange(kw, 1, 2);

		// If there are exactly two inputs, then it must be a number and its unit
		if (kw.numArgs() === 2) {
			const tmp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, minValue, maxValue, unitType);
			return new SampleConstant(unitType, tmp.get(0));
		}

		// If there is only one input, it could be a SampleProvider, a dimensionless constant, or an expression

		// 1) Try parsing a SampleProvider object
		let s: SampleProvider | null = null;
		try {
			const ent = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Entity);
			s = Input.castImplements<SampleProvider>(ent, SampleProviderInterface);
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		if (s !== null) {
			Input.assertUnitsMatch(unitType, s.getUnitType());
			return s;
		}

		// 2) Try parsing a constant value
		let tmp: DoubleVector | null = null;
		try {
			tmp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, DimensionlessUnit);
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		if (tmp !== null) {
			if (unitType !== DimensionlessUnit)
				throw new InputErrorException(tr(Input.INP_ERR_UNITNOTFOUND), simpleNameOf(unitType));
			if (tmp.get(0) < minValue || tmp.get(0) > maxValue)
				throw new InputErrorException(tr(Input.INP_ERR_DOUBLERANGE), minValue, maxValue, tmp.get(0));
			return new SampleConstant(unitType, tmp.get(0));
		}

		// 3) Try parsing an expression
		try {
			const expString = kw.getArg(0);
			return new SampleExpression(expString, thisEnt, unitType);
		}
		catch (e) {
			if (!(e instanceof ExpError))
				throw e;
			throw new InputErrorException(e);
		}
	}

	/**
	 * Split an input (list of strings) down to a single level of nested braces, this may then be called again for
	 * further nesting.
	 * @param input
	 */
	static splitForNestedBraces(input: string[]): string[][] {
		const inputs: string[][] = [];

		let braceDepth = 0;
		let currentLine: string[] | null = null;
		for (let i = 0; i < input.length; i++) {
			if (currentLine === null)
				currentLine = [];

			currentLine.push(input[i]);
			if (input[i] === "{") {
				braceDepth++;
				continue;
			}

			if (input[i] === "}") {
				braceDepth--;
				if (braceDepth === 0) {
					inputs.push(currentLine);
					currentLine = null;
					continue;
				}
			}
		}

		return inputs;
	}

	private static assertUnique(list: Entity[]): void {
		for (let i = 0; i < list.length; i++) {
			const ent = list[i];
			for (let j = i + 1; j < list.length; j++) {
				if (ent === list[j]) {
					throw new InputErrorException(tr(Input.INP_ERR_NOTUNIQUE), ent.getName());
				}
			}
		}
	}

	private static assertUniqueInterface(list: unknown[]): void {
		for (let i = 0; i < list.length; i++) {
			const ent = list[i] as Entity;
			for (let j = i + 1; j < list.length; j++) {
				if (ent === list[j]) {
					throw new InputErrorException(tr(Input.INP_ERR_NOTUNIQUE), ent.getName());
				}
			}
		}
	}

	/**
	 * validateIndexedLists(ListInput keys, ListInput vals) と
	 * validateIndexedLists(ArrayList keys, DoubleVector values, keyName, valueName) の 2 つ。
	 * @throws InputErrorException
	 */
	static validateIndexedLists(keys: ListInput<unknown> | unknown[] | null, vals: ListInput<unknown> | DoubleVector | null,
			keyName?: string, valueName?: string): void {
		if (keyName === undefined) {
			const k = keys as ListInput<unknown>;
			const v = vals as ListInput<unknown>;
			// If no values set, no validation to be done
			if (v.getValue() === null)
				return;

			// values are set but indexed list has not
			if (k.getValue() === null)
				throw new InputErrorException(tr(Input.INP_VAL_LISTSET), k.getKeyword(), v.getKeyword());

			// Both are set, but of differing size
			if (k.getListSize() !== v.getListSize())
				throw new InputErrorException(tr(Input.INP_VAL_LISTSIZE), k.getKeyword(), v.getKeyword());
			return;
		}

		const values = vals as DoubleVector | null;
		// If no values set, no validation to be done
		if (values === null)
			return;

		// values are set but indexed list has not
		if (keys === null)
			throw new InputErrorException(tr(Input.INP_VAL_LISTSET), valueName, keyName);

		// Both are set, but of differing size
		if ((keys as unknown[]).length !== values.size())
			throw new InputErrorException(tr(Input.INP_VAL_LISTSIZE), keyName, valueName);
	}

	/** @throws InputErrorException */
	static validateInputSize(list1: ListInput<unknown>, list2: ListInput<unknown>): void {
		// One list is set but not the other
		if (list1.getValue() !== null && list2.getValue() === null)
			throw new InputErrorException(tr(Input.INP_VAL_LISTSIZE), list1.getKeyword(), list2.getKeyword());

		if (list1.getValue() === null && list2.getValue() !== null)
			throw new InputErrorException(tr(Input.INP_VAL_LISTSIZE), list1.getKeyword(), list2.getKeyword());

		// Both are set, but of differing size
		if (list1.getListSize() !== list2.getListSize())
			throw new InputErrorException(tr(Input.INP_VAL_LISTSIZE), list1.getKeyword(), list2.getKeyword() );
	}

	/**
	 * Returns a list of valid options if the input has limited number of
	 * choices (e.g TRUE or FALSE for BooleanInput).
	 * <p>
	 * This method must be overridden for an input to be shown with a drop-down
	 * menu in the Input Editor.
	 * @param ent TODO
	 */
	getValidOptions(ent: Entity | null): string[] | null {
		return null;
	}

	getDefaultStringForKeyInputs(unitType: JClass<Unit>): string {

		if (this.defValue === null)
			return "";

		if (typeof this.defValue === "boolean") {
			if (this.defValue)
				return "TRUE";

			return "FALSE";
		}

		let tmp = "";
		if (typeof this.defValue === "number") {
			// Java は Double と Integer を型で見分ける。ここでは isIntegerValue() で見分ける
			const isInt = this.isIntegerValue();
			if ((isInt && this.defValue === Integer.MAX_VALUE) || (!isInt && this.defValue === Double.POSITIVE_INFINITY))
				return Input.POSITIVE_INFINITY;

			if ((isInt && this.defValue === Integer.MIN_VALUE) || (!isInt && this.defValue === Double.NEGATIVE_INFINITY))
				return Input.NEGATIVE_INFINITY;

			tmp += isInt ? String(this.defValue) : jstr(this.defValue);
		} else if ((this.defValue as object).constructor === SampleConstant ||
					(this.defValue as object).constructor === TimeSeriesConstantDouble ) {
			return String(this.defValue);
		} else if ((this.defValue as object).constructor === DoubleVector) {
			const def = this.defValue as unknown as DoubleVector;
			if (def.size() === 0)
				return "";

			tmp += jstr(def.get(0));
			for (let i = 1; i < def.size(); i++) {
				tmp += Input.SEPARATOR;
				tmp += jstr(def.get(i));
			}
		} else if ((this.defValue as object).constructor === IntegerVector) {
			const def = this.defValue as unknown as IntegerVector;
			if (def.size() === 0)
				return "";

			tmp += String(def.get(0));
			for (let i = 1; i < def.size(); i++) {
				tmp += Input.SEPARATOR;
				tmp += String(def.get(i));
			}
		} else if ( this.defValue instanceof Entity ) {
			tmp += this.defValue.getName();
		}
		else {
			return "?????";
		}

		tmp += Input.SEPARATOR;
		tmp += Unit.getSIUnit(unitType);
		return tmp;
	}
}

/** Java の String.equalsIgnoreCase */
function jEqualsIgnoreCaseLocal(a: string, b: string | null): boolean {
	if (b === null)
		return false;
	return a.length === b.length && (a.toUpperCase() === b.toUpperCase() || a.toLowerCase() === b.toLowerCase());
}

/** SampleProvider（Java の interface）を Class として渡す所の代わり */
const SampleProviderInterface: JInterface<SampleProvider> = {
	javaName: "com.jaamsim.Samples.SampleProvider",
	isInstance: (o: unknown): o is SampleProvider => isSampleProvider(o),
};
