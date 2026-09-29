/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2019 JaamSim Software Inc.
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
import { jstr, Double, Long } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { TimeSeries } from "../Samples/TimeSeries.ts";
import { TimeSeriesData } from "../Samples/TimeSeriesData.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import { KeywordIndex } from "./KeywordIndex.ts";
import { Parser } from "./Parser.ts";

export class TimeSeriesDataInput extends Input<TimeSeriesData> {
	private unitType: JClass<Unit> | null = null;
	private tickLength = 0.0;  // simulation clock tick length used to convert times into ticks
	private maxValue = Double.POSITIVE_INFINITY;
	private minValue = Double.NEGATIVE_INFINITY;

	constructor(key: string, cat: string, def: TimeSeriesData | null) {
		super(key, cat, def);
		this.unitType = DimensionlessUnit;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const simModel = thisEnt.getJaamSimModel();
		const ts = thisEnt as unknown as TimeSeries;

		let braceOpened = false;

		if (this.unitType === UserSpecifiedUnit)
			throw new InputErrorException(tr(Input.INP_ERR_UNITUNSPECIFIED));

		let offset = 0;
		if (ts.isOffsetToFirst())
			offset = -1;

		let lastTime = Long.MIN_VALUE;

		const times = new DoubleVector(Math.trunc(kw.numArgs()/4));
		const values = new DoubleVector(Math.trunc(kw.numArgs()/4));

		// Determine records in the time series
		// Records have form: (e.g.) yyyy-MM-dd HH:mm value units
		// where units are optional
		const each: string[] = [];
		for (let i=0; i < kw.numArgs(); i++) {

			//skip over opening brace if present
			if (kw.getArg(i) === "{" ) {
				braceOpened = true;
				continue;
			}

			each.length = 0;

			// Load one record into 'each' containing an individual timeseries record
			for (let j = i; j < kw.numArgs(); j++, i++){
				if (kw.getArg(j) === "}") {
					braceOpened = false;
					break;
				}

				if (!braceOpened)
					throw new InputErrorException(tr("Expected an opening brace ( { ). Received: %s"), kw.getArg(j));

				each.push(kw.getArg(j));
			}

			// Time input in RFC8601 date/time format
			let recordus: number;
			if (Input.isRFC8601DateTime(each[0])) {
				Input.assertCountRange(each, 2, 3);
				const simTime = Input.parseRFC8601DateTime(simModel, each[0]);
				recordus = simModel.getEventManager().secondsToNearestTick(simTime);
				each.shift();
			}
			// Time input in number/unit format
			else {
				// Parse the unit portion of the time input
				Input.assertCountRange(each, 3, 4);
				const unitName = Parser.removeEnclosure("[", each[1], "]");
				const unit = Input.tryParseUnit(thisEnt.getJaamSimModel(), unitName, TimeUnit);
				if (unit === null)
					throw new InputErrorException(tr(Input.INP_ERR_NOUNITFOUND), each[1], "TimeUnit");

				// Parse the numeric portion of the time input
				const factor = unit.getConversionFactorToSI();
				// TODO(移植): Java の (long) の型変換（NaN は 0、範囲の外は Long の端に丸める）は Math.trunc で代えた
				recordus = Math.trunc(Input.parseDouble(each[0], Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, factor)*1e6);
				each.shift();
				each.shift();
			}

			// Make sure the times are in increasing order
			if (recordus <= lastTime)
				throw new InputErrorException(tr("The times must be given in increasing order."));

			lastTime = recordus;

			// set the offset to the number of whole years from the first record
			if (offset === -1)
				offset = recordus;

			const usOffset = recordus - offset;

			// Value portion of the record
			const valKw = new KeywordIndex("", each, null);
			const v = Input.parseDoubles(thisEnt.getJaamSimModel(), valKw, this.minValue, this.maxValue, this.unitType as JClass<Unit>);

			// Store the time and value for this record
			times.add( usOffset/(1.0e6*this.tickLength) );
			values.add(v.get(0));
		}

		if (braceOpened)
			throw new InputErrorException(tr("Final closing brace ( } ) is missing."));

		// Confirm that the first simulation time is less than or equal to zero
		if (times.get(0) > 0.0)
			throw new InputErrorException(tr("First simulation time must be less than or equal to "
					+ "zero. Received %s seconds."), jstr(times.get(0)));

		// Set the value to a new time series data object
		this.value = new TimeSeriesData(times, values, simModel.getEventManager());
	}

	setUnitType(u: JClass<Unit>): void {
		if (u !== this.unitType)
			this.reset();
		this.unitType = u;
	}

	setTickLength(val: number): void {
		this.tickLength = val;
	}

	getTickLength(): number {
		return this.tickLength;
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

}
