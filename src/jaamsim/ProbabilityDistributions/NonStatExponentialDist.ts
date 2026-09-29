/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
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
 */

import { Double, Long } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { TimeSeries } from "../internal.ts";
import type { TimeSeriesProvider } from "../Samples/TimeSeriesProvider.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { TimeSeriesInput } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Non-Stationary Exponential Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 479.
 */
export class NonStatExponentialDist extends Distribution {

	private readonly expectedArrivals: TimeSeriesInput;

	private readonly scaleFactor: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.unitType.setHidden(true);
		this.unitType.setDefaultValue(TimeUnit);
		this.setUnitType(TimeUnit);

		this.expectedArrivals = new TimeSeriesInput("ExpectedArrivals", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.expectedArrivals, "A time series containing the expected cumulative number of arrivals "
		                     + "as a function of time.",
		         ["TimeSeries1"]);
		this.expectedArrivals.setUnitType(DimensionlessUnit);
		this.expectedArrivals.setRequired(true);
		this.addInput(this.expectedArrivals);

		this.scaleFactor = new SampleInput("ScaleFactor", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.scaleFactor, "An optional factor that multiplies the data from the "
		                     + "'ExpectedArrival' input. "
		                     + "For example, an input of 2 will double the number of expected "
		                     + "arrivals at any given time.",
		         ["2.0"]);
		this.scaleFactor.setUnitType(DimensionlessUnit);
		this.addInput(this.scaleFactor);
	}

	override validate(): void {
		super.validate();

		if (!(this.expectedArrivals.getValue() instanceof TimeSeries))
			throw new InputErrorException(tr("The ExpectedArrivals input must be a TimeSeries, "
					+ "not a constant."));

		const ts = this.expectedArrivals.getValue() as TimeSeries;

		if (!ts.isMonotonic(1))
			throw new InputErrorException(tr("The ExpectedArrivals input must be a TimeSeries "
					+ "that increases monotonically."));

		if (ts.getMinValue() !== 0.0)
			throw new InputErrorException(tr("The ExpectedArrivals input must be a TimeSeries "
					+ "that starts with zero expected arrivals at time zero."));
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	private getScaleFactor(simTime: number): number {
		return this.scaleFactor.getNextSample(this, simTime);
	}

	protected override getSample(simTime: number): number {

		const ticksNow = EventManager.simTicks();  // ignore the simTime passed as an argument
		const ts: TimeSeriesProvider = this.expectedArrivals.getValue();
		const factor = this.getScaleFactor(simTime);
		const valueNow = factor * ts.getInterpolatedCumulativeValueForTicks(ticksNow);
		const valueNext = valueNow - Math.log(this.rng.nextUniform());
		const ticksNext = ts.getInterpolatedTicksForValue(valueNext/factor);

		if (ticksNext === Long.MAX_VALUE)
			return Double.POSITIVE_INFINITY;

		if (ticksNext < ticksNow)
			this.error(tr("Negative time advance"));

		return this.getJaamSimModel().getEventManager().ticksToSeconds(ticksNext - ticksNow);
	}

	protected override getMean(simTime: number): number {
		if (this.expectedArrivals.getValue() == null)
			return Double.NaN;
		const factor = this.getScaleFactor(simTime);
		const arrivals = factor * this.expectedArrivals.getValue().getMaxValue();
		const dt = this.getJaamSimModel().getEventManager().ticksToSeconds( this.expectedArrivals.getValue().getMaxTicksValue() );
		return dt/arrivals;
	}

	protected override getStandardDev(simTime: number): number {
		return Double.NaN;
	}

	protected override getMin(simTime: number): number {
		if (this.expectedArrivals.isDefault())
			return Double.NaN;
		return this.expectedArrivals.getValue().getMinValue();
	}

	protected override getMax(simTime: number): number {
		if (this.expectedArrivals.isDefault())
			return Double.NaN;
		return this.expectedArrivals.getValue().getMaxValue();
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.NonStatExponentialDist", NonStatExponentialDist);
