/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2025 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { Entity } from "../internal.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ObjectType } from "../internal.ts";
import { Input } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double, jIsAssignableFrom, NullPointerException } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import { SIUnitFactorInput } from "../internal.ts";

/*
 * 入れ子のクラス: UnitSortOrder は static の unitSortOrder（compare を持つ物）だけにした。
 * MultPair・DivPair は、クラスを鍵にした 2 段の Map にした（MultPair は順番を入れ替えても同じ鍵なので、両方の順で入れる）。
 *
 * 掛け算・割り算の規則（Java の static ブロック）は、最初に使われたときに作る。
 * Unit.ts が子のクラス（RateUnit など）を import すると、読み込みの輪ができて
 * 「class RateUnit extends Unit」の時点で Unit がまだ無い誤りになるため。
 * 子のクラスは ClassRegistry から Java の名前で引く（そのときまでに units の全部が読み込まれている前提）。
 */

const PKG = "com.jaamsim.units.";

function unitClass(simpleName: string): JClass<Unit> {
	const cls = ClassRegistry.forName(PKG + simpleName);
	if (cls === null)
		throw new Error(`Unit class not loaded: ${PKG + simpleName}`);  // 移植の都合の確認（利用者には出ない）
	return cls as JClass<Unit>;
}

export abstract class Unit extends Entity {
	private readonly conversionFactorToSI: SIUnitFactorInput;

	constructor() {
		super();
		// Java の初期化ブロック
		this.active.setDefaultValue(false);

		this.conversionFactorToSI = new SIUnitFactorInput("ConversionFactorToSI", Entity.KEY_INPUTS);
		this.addInput(this.conversionFactorToSI);
		this.setKeywordDoc(this.conversionFactorToSI,
				"Factor to convert from the specified unit to the System International "
				+ "(SI) unit. The factor is entered as A / B, where A is the first entry "
				+ "and B is the second. For example, to convert from miles per hour to "
				+ "m/s, the first factor is 1609.344 (meters in one mile) and the second "
				+ "factor is 3600 (seconds in one hour).",
				["1609.344  3600"]);
	}

	private static readonly siUnit = new Map<JClass<Unit>, string>();

	static setSIUnit(unitType: JClass<Unit>, si: string): void {
		Unit.siUnit.set(unitType, si);
	}

	/**
	 * Get the SI unit for the given unit type.
	 * @param unitType
	 * @return a string describing the SI unit, or if one has not been defined: 'SI'
	 */
	static getSIUnit(unitType: JClass<Unit> | null): string {
		const unit = unitType === null ? undefined : Unit.siUnit.get(unitType);
		if (unit !== undefined)
			return unit;

		return "SI";
	}

	/**
	 * Return the conversion factor to SI units
	 */
	getConversionFactorToSI(): number {
		return this.conversionFactorToSI.getSIFactor();
	}

	/**
	 * Return the conversion factor to the given units
	 */
	getConversionFactorToUnit(unit: Unit): number {
		const f1 = this.getConversionFactorToSI();
		const f2 = unit.getConversionFactorToSI();
		return f1 / f2;
	}

	static getUnitTypeList(simModel: JaamSimModel): string[] {
		const list: string[] = [];
		for (const each of simModel.getClonesOfIterator(ObjectType)) {
			const klass = each.getJavaClass();
			if (klass == null)
				continue;

			if (jIsAssignableFrom(Unit, klass))
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	static getUnitList<T extends Unit>(model: JaamSimModel, ut: JClass<T>): T[] {
		const ret: T[] = [];
		for (const u of model.getClonesOfIterator(ut)) {
			ret.push(u);
		}
		ret.sort((a, b) => Unit.unitSortOrder.compare(a, b));
		return ret;
	}

	// Sorts by increasing SI conversion factor (i.e. smallest unit first)
	static readonly unitSortOrder = {
		compare(u1: Unit, u2: Unit): number {
			return Double.compare(u1.getConversionFactorToSI(), u2.getConversionFactorToSI());
		},
	};

	private static multRules: Map<JClass<Unit>, Map<JClass<Unit>, JClass<Unit>>> | null = null;
	private static divRules: Map<JClass<Unit>, Map<JClass<Unit>, JClass<Unit>>> | null = null;

	/** Java の static ブロック（最初に使われたときに 1 度だけ） */
	private static ensureRules(): void {
		if (Unit.multRules !== null)
			return;
		Unit.multRules = new Map();
		Unit.divRules = new Map();

		const RateUnit = unitClass("RateUnit");
		const TimeUnit = unitClass("TimeUnit");
		const DimensionlessUnit = unitClass("DimensionlessUnit");
		const SpeedUnit = unitClass("SpeedUnit");
		const DistanceUnit = unitClass("DistanceUnit");
		const AccelerationUnit = unitClass("AccelerationUnit");
		const MassFlowUnit = unitClass("MassFlowUnit");
		const MassUnit = unitClass("MassUnit");
		const VolumeFlowUnit = unitClass("VolumeFlowUnit");
		const VolumeUnit = unitClass("VolumeUnit");
		const AngularSpeedUnit = unitClass("AngularSpeedUnit");
		const AngleUnit = unitClass("AngleUnit");
		const PowerUnit = unitClass("PowerUnit");
		const EnergyUnit = unitClass("EnergyUnit");
		const CostRateUnit = unitClass("CostRateUnit");
		const CostUnit = unitClass("CostUnit");
		const ViscosityUnit = unitClass("ViscosityUnit");
		const LinearDensityUnit = unitClass("LinearDensityUnit");
		const PressureUnit = unitClass("PressureUnit");
		const AreaUnit = unitClass("AreaUnit");
		const LinearDensityVolumeUnit = unitClass("LinearDensityVolumeUnit");
		const SpecificEnergyUnit = unitClass("SpecificEnergyUnit");
		const EnergyDensityUnit = unitClass("EnergyDensityUnit");
		const DensityUnit = unitClass("DensityUnit");

		const addMultRule = Unit._addMultRule;

		// Multiplication rules
		addMultRule(                RateUnit,        TimeUnit,  DimensionlessUnit);
		addMultRule(               SpeedUnit,        TimeUnit,       DistanceUnit);
		addMultRule(        AccelerationUnit,        TimeUnit,          SpeedUnit);
		addMultRule(            MassFlowUnit,        TimeUnit,           MassUnit);
		addMultRule(          VolumeFlowUnit,        TimeUnit,         VolumeUnit);
		addMultRule(        AngularSpeedUnit,        TimeUnit,          AngleUnit);
		addMultRule(               PowerUnit,        TimeUnit,         EnergyUnit);
		addMultRule(            CostRateUnit,        TimeUnit,           CostUnit);
		addMultRule(           ViscosityUnit,        TimeUnit,  LinearDensityUnit);

		addMultRule(            DistanceUnit,        RateUnit,          SpeedUnit);
		addMultRule(               SpeedUnit,        RateUnit,   AccelerationUnit);
		addMultRule(                MassUnit,        RateUnit,       MassFlowUnit);
		addMultRule(              VolumeUnit,        RateUnit,     VolumeFlowUnit);
		addMultRule(               AngleUnit,        RateUnit,   AngularSpeedUnit);
		addMultRule(              EnergyUnit,        RateUnit,          PowerUnit);
		addMultRule(                CostUnit,        RateUnit,       CostRateUnit);
		addMultRule(           ViscosityUnit,        RateUnit,       PressureUnit);

		addMultRule(            DistanceUnit,    DistanceUnit,           AreaUnit);
		addMultRule(       LinearDensityUnit,    DistanceUnit,           MassUnit);
		addMultRule( LinearDensityVolumeUnit,    DistanceUnit,         VolumeUnit);
		addMultRule(                AreaUnit,    DistanceUnit,         VolumeUnit);

		addMultRule(               SpeedUnit,       SpeedUnit, SpecificEnergyUnit);
		addMultRule(       LinearDensityUnit,       SpeedUnit,       MassFlowUnit);
		addMultRule( LinearDensityVolumeUnit,       SpeedUnit,     VolumeFlowUnit);
		addMultRule(                AreaUnit,       SpeedUnit,     VolumeFlowUnit);

		addMultRule(       EnergyDensityUnit,      VolumeUnit,         EnergyUnit);
		addMultRule(             DensityUnit,      VolumeUnit,           MassUnit);
		addMultRule(            PressureUnit,      VolumeUnit,         EnergyUnit);

		addMultRule(       EnergyDensityUnit,  VolumeFlowUnit,          PowerUnit);
		addMultRule(             DensityUnit,  VolumeFlowUnit,       MassFlowUnit);
		addMultRule(            PressureUnit,  VolumeFlowUnit,          PowerUnit);
	}

	private static putRule(rules: Map<JClass<Unit>, Map<JClass<Unit>, JClass<Unit>>>,
			a: JClass<Unit>, b: JClass<Unit>, product: JClass<Unit>): void {
		let m = rules.get(a);
		if (m === undefined) {
			m = new Map();
			rules.set(a, m);
		}
		m.set(b, product);
	}

	private static getRule(rules: Map<JClass<Unit>, Map<JClass<Unit>, JClass<Unit>>>,
			a: JClass<Unit> | null, b: JClass<Unit> | null): JClass<Unit> | null {
		// Java は MultPair・DivPair の hashCode で a.hashCode()・b.hashCode() を呼ぶので、null なら NullPointerException
		if (a === null || b === null)
			throw new NullPointerException();
		return rules.get(a)?.get(b) ?? null;
	}

	static addMultRule(a: JClass<Unit>, b: JClass<Unit>, product: JClass<Unit>): void {
		Unit.ensureRules();
		Unit._addMultRule(a, b, product);
	}

	private static _addMultRule(a: JClass<Unit>, b: JClass<Unit>, product: JClass<Unit>): void {
		// MultPair(a, b) は MultPair(b, a) と同じ鍵
		Unit.putRule(Unit.multRules!, a, b, product);
		Unit.putRule(Unit.multRules!, b, a, product);

		// Add the corresponding division rules
		Unit._addDivRule(product, a, b);
		Unit._addDivRule(product, b, a);
	}

	static addDivRule(num: JClass<Unit>, denom: JClass<Unit>, product: JClass<Unit>): void {
		Unit.ensureRules();
		Unit._addDivRule(num, denom, product);
	}

	private static _addDivRule(num: JClass<Unit>, denom: JClass<Unit>, product: JClass<Unit>): void {
		Unit.putRule(Unit.divRules!, num, denom, product);
	}

	// Get the new unit type resulting from multiplying two unit types
	static getMultUnitType(a: JClass<Unit> | null, b: JClass<Unit> | null): JClass<Unit> | null {
		const DimensionlessUnit = unitClass("DimensionlessUnit");
		if (a === DimensionlessUnit)
			return b;
		if (b === DimensionlessUnit)
			return a;

		Unit.ensureRules();
		return Unit.getRule(Unit.multRules!, a, b);
	}

	// Get the new unit type resulting from dividing two unit types
	static getDivUnitType(num: JClass<Unit> | null, denom: JClass<Unit> | null): JClass<Unit> | null {
		const DimensionlessUnit = unitClass("DimensionlessUnit");

		if (denom === DimensionlessUnit)
			return num;

		if (num === denom)
			return DimensionlessUnit;

		Unit.ensureRules();
		return Unit.getRule(Unit.divRules!, num, denom);
	}
}
