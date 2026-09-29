// 式の言語（まとまり B）の試験: 字句の分け方と、Entity を使わない式（数と単位だけ）の計算が Java と同じになること。
// 正解の test/B-exp.ref.txt は、JaamSim（Java 版）で同じ式を、同じ作りの ParseContext で評価して作った
// （作り方は docs/todo-B.md の「正解の作り方」）。1 行が「式<TAB>結果」。結果は getOutputString(null) か「ERR 位置 メッセージ」。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// 循環 import のため、ExpEvaluator を ExpParser より先に読み込む
import "../src/jaamsim/input/ExpEvaluator.ts";
import { ExpParser, ExpParser_ParseContext, ExpParser_UnitData, ExpParser_EvalContext } from "../src/jaamsim/input/ExpParser.ts";
import type { ExpParser_OutputResolver, ExpParser_Assigner } from "../src/jaamsim/input/ExpParser.ts";
import { ExpTokenizer } from "../src/jaamsim/input/ExpTokenizer.ts";
import { ExpError } from "../src/jaamsim/input/ExpError.ts";
import { ExpResult } from "../src/jaamsim/input/ExpResult.ts";
import { I18n } from "../src/jaamsim/i18n/I18n.ts";
import type { JClass } from "../src/jaamsim/java/lang.ts";
import { Unit } from "../src/jaamsim/units/Unit.ts";
import { DimensionlessUnit } from "../src/jaamsim/units/DimensionlessUnit.ts";
import { DistanceUnit } from "../src/jaamsim/units/DistanceUnit.ts";
import { TimeUnit } from "../src/jaamsim/units/TimeUnit.ts";
import { AngleUnit } from "../src/jaamsim/units/AngleUnit.ts";
// 単位の掛け算・割り算の表は、すべての単位のクラスが読み込まれている前提
import "../src/jaamsim/units/AccelerationUnit.ts";
import "../src/jaamsim/units/AngularSpeedUnit.ts";
import "../src/jaamsim/units/AreaUnit.ts";
import "../src/jaamsim/units/CostRateUnit.ts";
import "../src/jaamsim/units/CostUnit.ts";
import "../src/jaamsim/units/DensityUnit.ts";
import "../src/jaamsim/units/EnergyDensityUnit.ts";
import "../src/jaamsim/units/EnergyUnit.ts";
import "../src/jaamsim/units/LinearDensityUnit.ts";
import "../src/jaamsim/units/LinearDensityVolumeUnit.ts";
import "../src/jaamsim/units/MassFlowUnit.ts";
import "../src/jaamsim/units/MassUnit.ts";
import "../src/jaamsim/units/PowerUnit.ts";
import "../src/jaamsim/units/PressureUnit.ts";
import "../src/jaamsim/units/RateUnit.ts";
import "../src/jaamsim/units/SpecificEnergyUnit.ts";
import "../src/jaamsim/units/SpeedUnit.ts";
import "../src/jaamsim/units/ViscosityUnit.ts";
import "../src/jaamsim/units/VolumeFlowUnit.ts";
import "../src/jaamsim/units/VolumeUnit.ts";

I18n.setLanguage("en");  // 誤りのメッセージを英語のまま比べる

type UC = JClass<Unit> | null;

class Ctx extends ExpParser_ParseContext {
	constructor() {
		super(new Map([
			["TRUE", ExpResult.makeNumResult(1, DimensionlessUnit)],
			["FALSE", ExpResult.makeNumResult(0, DimensionlessUnit)],
		]), []);
	}
	getUnitByName(n: string): ExpParser_UnitData | null {
		const d = new ExpParser_UnitData();
		switch (n) {
		case "m": d.scaleFactor = 1; d.unitType = DistanceUnit; break;
		case "km": d.scaleFactor = 1000; d.unitType = DistanceUnit; break;
		case "s": d.scaleFactor = 1; d.unitType = TimeUnit; break;
		case "min": d.scaleFactor = 60; d.unitType = TimeUnit; break;
		case "h": d.scaleFactor = 3600; d.unitType = TimeUnit; break;
		case "deg": d.scaleFactor = Math.PI / 180; d.unitType = AngleUnit; break;
		default: return null;
		}
		return d;
	}
	multUnitTypes(a: UC, b: UC): UC { return Unit.getMultUnitType(a, b); }
	divUnitTypes(a: UC, b: UC): UC { return Unit.getDivUnitType(a, b); }
	getValFromLitName(name: string, source: string, pos: number): ExpResult { throw new ExpError(source, pos, "Could not find entity: %s", name); }
	getOutputResolver(_n: string): ExpParser_OutputResolver { throw new ExpError(null, 0, "no outputs"); }
	getConstOutputResolver(_e: ExpResult, _n: string): ExpParser_OutputResolver { throw new ExpError(null, 0, "no outputs"); }
	getAssigner(_n: string): ExpParser_Assigner { throw new ExpError(null, 0, "no assign"); }
	getConstAssigner(_e: ExpResult, _n: string): ExpParser_Assigner { throw new ExpError(null, 0, "no assign"); }
}

function run(line: string): string {
	try {
		const exp = ExpParser.parseExpression(new Ctx(), line);
		const r = exp.evaluate(new ExpParser_EvalContext([]));
		return r.getOutputString(null);
	}
	catch (e) {
		if (e instanceof ExpError)
			return `ERR ${e.pos} ${e.getMessage()}`;
		return `RTE ${(e as Error).message}`;
	}
}

test("字句の分け方", () => {
	const toks = ExpTokenizer.tokenize("a.b(1.5e-3, [Ent 1]) >= \"s\" && null # c # !x");
	assert.deepEqual(toks.map(t => [t.type, t.value, t.pos]), [
		[0, "a", 0], [2, ".", 1], [0, "b", 2], [2, "(", 3], [1, "1.5e-3", 4], [2, ",", 10],
		[3, "Ent 1", 12], [2, ")", 19], [2, ">=", 21], [4, "s", 24], [2, "&&", 28], [5, "null", 31],
		[2, "!", 42], [0, "x", 43],
	]);
	assert.throws(() => ExpTokenizer.tokenize("[a[b]"), (e: ExpError) => e.message === "Nested square brace" && e.pos === 2);
	assert.throws(() => ExpTokenizer.tokenize("1 # x"), (e: ExpError) => e.message === "No closing mark for comment");
});

test("数と単位だけの式が Java と同じ結果になる", () => {
	const lines = readFileSync(new URL("./B-exp.ref.txt", import.meta.url), "utf8").trimEnd().split("\n");
	const bad: string[] = [];
	for (const line of lines) {
		const [src, want] = line.split("\t");
		const got = run(src).replace(/\n/g, "\\n");
		if (got !== want)
			bad.push(`${src}\n  正解: ${want}\n  今:   ${got}`);
	}
	assert.equal(bad.length, 0, `${bad.length} 件ちがう:\n` + bad.join("\n"));
});
