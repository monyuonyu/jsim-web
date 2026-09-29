/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { Double, Integer } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { Gamma } from "../math/Gamma.ts";
import { MRG1999a } from "../rng/MRG1999a.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Distribution } from "./Distribution.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/** Java の Double.doubleToLongBits（NaN は 0x7ff8000000000000L にそろえる） */
function doubleToLongBits(x: number): bigint {
	if (Number.isNaN(x))
		return 0x7ff8000000000000n;
	const dv = new DataView(new ArrayBuffer(8));
	dv.setFloat64(0, x);
	return dv.getBigInt64(0);
}

export class BetaDistribution extends Distribution {
	private readonly alphaInput: SampleInput;

	private readonly betaInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.locationInput.setHidden(false);
		this.scaleInput.setHidden(false);

		this.alphaInput = new SampleInput("AlphaParam", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.alphaInput, "The alpha tuning parameter.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.alphaInput.setUnitType(DimensionlessUnit);
		this.alphaInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.alphaInput);

		this.betaInput = new SampleInput("BetaParam", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.betaInput, "The beta tuning parameter.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.betaInput.setUnitType(DimensionlessUnit);
		this.betaInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.betaInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const alpha = this.alphaInput.getNextSample(this, simTime);
		const beta = this.betaInput.getNextSample(this, simTime);
		return location + BetaDistribution.getSample(alpha, beta, scale, this.rng);
	}

	protected override getMean(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const alpha = this.alphaInput.getNextSample(this, simTime);
		const beta = this.betaInput.getNextSample(this, simTime);
		return location + BetaDistribution.getMean(alpha, beta, scale);
	}

	protected override getStandardDev(simTime: number): number {
		const scale = this.getScaleInput(simTime);
		const alpha = this.alphaInput.getNextSample(this, simTime);
		const beta = this.betaInput.getNextSample(this, simTime);
		return BetaDistribution.getStandardDev(alpha, beta, scale);
	}

	protected override getMin(simTime: number): number {
		const location = this.getLocationInput(simTime);
		return location;
	}

	protected override getMax(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		return location + scale;
	}

	static getSample(alpha: number, beta: number, scale: number, rng: MRG1999a): number {
		// Effectively calculate the inverse CDF
		const val = rng.nextUniform();

		let low = 0;
		let high = 1;
		let guess = 0.5;

		let lowVal = 0;
		let highVal = 1;

		while (true) {
			const attempt = BetaDistribution.regularizedBeta(guess, alpha, beta, 1E-14,
					Integer.MAX_VALUE);

			if (BetaDistribution.near(val, attempt, 1E-9)) {
				return guess * scale;
			}

			if (val < attempt) {
				high = guess;
				highVal = attempt;
			} else {
				low = guess;
				lowVal = attempt;
			}

			const ratio = (val - lowVal) / (highVal - lowVal);
			guess = low + (high - low) * ratio;
		}
	}

	static getMean(alpha: number, beta: number, scale: number): number {
		return (alpha / (alpha + beta)) * scale;
	}

	static getStandardDev(alpha: number, beta: number, scale: number): number {
		const apbSqrd = (alpha + beta) * (alpha + beta);
		return (Math.sqrt(alpha * beta / (apbSqrd * (alpha + beta + 1)))) * scale;
	}

	/*
	 * All code below this point is derived from the beta function implementation of the
	 * Apache Commons Math library and can be downloaded from:
	 * http://commons.apache.org/proper/commons-math/download_math.cgi
	 *
	 */
	/** maxIterations は Java の int */
	static regularizedBeta(x: number, a: number,
			b: number, epsilon: number, maxIterations: number): number {
		let ret: number;

		if (Double.isNaN(x) || Double.isNaN(a) || Double.isNaN(b) || x < 0
				|| x > 1 || a <= 0 || b <= 0) {
			ret = Double.NaN;
		} else if (x > (a + 1) / (2 + b + a) && 1 - x <= (b + 1) / (2 + b + a)) {
			ret = 1 - BetaDistribution.regularizedBeta(1 - x, b, a, epsilon, maxIterations);
		} else {
			ret = Math.exp((a * Math.log(x)) + (b * Math.log1p(-x))
					- Math.log(a) - BetaDistribution.logBeta(a, b))
					* 1.0 / BetaDistribution.evaluateFraction(a, b, x, epsilon, maxIterations);
		}

		return ret;
	}

	private static readonly HALF_LOG_TWO_PI = .9189385332046727;

	/** Java の long 0x8000000000000000L（= Long.MIN_VALUE） */
	private static readonly SGN_MASK: bigint = -0x8000000000000000n;

	/** long の計算は BigInt で行い、Java の long のあふれまで同じにする */
	private static equals(x: number, y: number, maxUlps: number): boolean {
		let xInt = doubleToLongBits(x);
		let yInt = doubleToLongBits(y);

		// Make lexicographically ordered as a two's-complement integer.
		if (xInt < 0n) {
			xInt = BigInt.asIntN(64, BetaDistribution.SGN_MASK - xInt);
		}
		if (yInt < 0n) {
			yInt = BigInt.asIntN(64, BetaDistribution.SGN_MASK - yInt);
		}

		// Math.abs(long)（Long.MIN_VALUE はそのまま Long.MIN_VALUE）
		const diff = BigInt.asIntN(64, xInt - yInt);
		const absDiff = diff < 0n ? BigInt.asIntN(64, -diff) : diff;
		const isEqual = absDiff <= BigInt(maxUlps);

		return isEqual && !Double.isNaN(x) && !Double.isNaN(y);
	}

	private static near(x: number, y: number, eps: number): boolean {
		return BetaDistribution.equals(x, y, 1) || Math.abs(y - x) <= eps;
	}

	/** n は Java の int */
	private static getB(a: number, b: number, n: number, x: number): number {
		let ret: number;
		let m: number;
		if (n % 2 === 0) { // even
			m = n / 2.0;
			ret = (m * (b - m) * x) / ((a + (2 * m) - 1) * (a + (2 * m)));
		} else {
			m = (n - 1.0) / 2.0;
			ret = -((a + m) * (a + b + m) * x)
					/ ((a + (2 * m)) * (a + (2 * m) + 1.0));
		}
		return ret;
	}

	// This evaluates and continued fraction for the beta distribution
	// I have no idea how the math actually works though...
	/** maxIterations は Java の int */
	private static evaluateFraction(alpha: number, beta: number, x: number, epsilon: number, maxIterations: number): number {
		const small = 1e-50;
		let hPrev = 1.0;

		// use the value of small as epsilon criteria for zero checks
		if (BetaDistribution.near(hPrev, 0.0, small)) {
			hPrev = small;
		}

		let n = 1;
		let dPrev = 0.0;
		let cPrev = hPrev;

		while (n < maxIterations) {
			const a = 1.0;
			const b = BetaDistribution.getB(alpha, beta, n, x);

			let dN = a + b * dPrev;
			if (BetaDistribution.near(dN, 0.0, small)) {
				dN = small;
			}
			let cN = a + b / cPrev;
			if (BetaDistribution.near(cN, 0.0, small)) {
				cN = small;
			}

			dN = 1 / dN;
			const deltaN = cN * dN;
			const hN = hPrev * deltaN;

			if (Double.isInfinite(hN)) {
				throw new Error(tr("Fraction did not converge"));
			}
			if (Double.isNaN(hN)) {
				throw new Error(tr("Fraction did not converge"));
			}

			if (Math.abs(deltaN - 1.0) < epsilon) {
				return hN;
			}

			dPrev = dN;
			cPrev = cN;
			hPrev = hN;
			n++;
		}

		throw new Error(tr("Fraction did not converge"));

	}

	static logBeta(p: number, q: number): number {
		if (Double.isNaN(p) || Double.isNaN(q) || (p <= 0.0) || (q <= 0.0)) {
			return Double.NaN;
		}

		const a = Math.min(p, q);
		const b = Math.max(p, q);
		if (a >= 10.0) {
			const w = BetaDistribution.sumDeltaMinusDeltaSum(a, b);
			const h = a / b;
			const c = h / (1.0 + h);
			const u = -(a - 0.5) * Math.log(c);
			const v = b * Math.log1p(h);
			if (u <= v) {
				return (((-0.5 * Math.log(b) + BetaDistribution.HALF_LOG_TWO_PI) + w) - u) - v;
			} else {
				return (((-0.5 * Math.log(b) + BetaDistribution.HALF_LOG_TWO_PI) + w) - v) - u;
			}
		} else if (a > 2.0) {
			if (b > 1000.0) {
				const n = jint(Math.floor(a - 1.0));
				let prod = 1.0;
				let ared = a;
				for (let i = 0; i < n; i++) {
					ared -= 1.0;
					prod *= ared / (1.0 + ared / b);
				}
				return (Math.log(prod) - n * Math.log(b))
						+ (Gamma.logGamma(ared) + BetaDistribution.logGammaMinusLogGammaSum(
								ared, b));
			} else {
				let prod1 = 1.0;
				let ared = a;
				while (ared > 2.0) {
					ared -= 1.0;
					const h = ared / b;
					prod1 *= h / (1.0 + h);
				}
				if (b < 10.0) {
					let prod2 = 1.0;
					let bred = b;
					while (bred > 2.0) {
						bred -= 1.0;
						prod2 *= bred / (ared + bred);
					}
					return Math.log(prod1)
							+ Math.log(prod2)
							+ (Gamma.logGamma(ared) + (Gamma.logGamma(bred) - BetaDistribution.logGammaSum(
									ared, bred)));
				} else {
					return Math.log(prod1) + Gamma.logGamma(ared)
							+ BetaDistribution.logGammaMinusLogGammaSum(ared, b);
				}
			}
		} else if (a >= 1.0) {
			if (b > 2.0) {
				if (b < 10.0) {
					let prod = 1.0;
					let bred = b;
					while (bred > 2.0) {
						bred -= 1.0;
						prod *= bred / (a + bred);
					}
					return Math.log(prod)
							+ (Gamma.logGamma(a) + (Gamma.logGamma(bred) - BetaDistribution.logGammaSum(
									a, bred)));
				} else {
					return Gamma.logGamma(a) + BetaDistribution.logGammaMinusLogGammaSum(a, b);
				}
			} else {
				return Gamma.logGamma(a) + Gamma.logGamma(b)
						- BetaDistribution.logGammaSum(a, b);
			}
		} else {
			if (b >= 10.0) {
				return Gamma.logGamma(a) + BetaDistribution.logGammaMinusLogGammaSum(a, b);
			} else {
				// The following command is the original NSWC implementation.
				// return Gamma.logGamma(a) +
				// (Gamma.logGamma(b) - Gamma.logGamma(a + b));
				// The following command turns out to be more accurate.
				return Math.log(Gamma.gamma(a)
						* Gamma.gamma(b) / Gamma.gamma(a + b));
			}
		}
	}

	private static logGammaSum(a: number, b: number): number {

		const x = (a - 1.0) + (b - 1.0);
		if (x <= 0.5) {
			return Gamma.logGamma1p(1.0 + x);
		} else if (x <= 1.5) {
			return Gamma.logGamma1p(x) + Math.log1p(x);
		} else {
			return Gamma.logGamma1p(x - 1.0) + Math.log(x * (1.0 + x));
		}
	}

	private static logGammaMinusLogGammaSum(a: number,
			b: number): number {
		/*
		 * d = a + b - 0.5
		 */
		let d: number;
		let w: number;
		if (a <= b) {
			d = b + (a - 0.5);
			w = BetaDistribution.deltaMinusDeltaSum(a, b);
		} else {
			d = a + (b - 0.5);
			w = BetaDistribution.deltaMinusDeltaSum(b, a);
		}

		const u = d * Math.log1p(a / b);
		const v = a * (Math.log(b) - 1.0);

		return u <= v ? (w - u) - v : (w - v) - u;
	}

	private static readonly DELTA: number[] = [
			.833333333333333333333333333333E-01,
			-.277777777777777777777777752282E-04,
			.793650793650793650791732130419E-07,
			-.595238095238095232389839236182E-09,
			.841750841750832853294451671990E-11,
			-.191752691751854612334149171243E-12,
			.641025640510325475730918472625E-14,
			-.295506514125338232839867823991E-15,
			.179643716359402238723287696452E-16,
			-.139228964661627791231203060395E-17,
			.133802855014020915603275339093E-18,
			-.154246009867966094273710216533E-19,
			.197701992980957427278370133333E-20,
			-.234065664793997056856992426667E-21,
			.171348014966398575409015466667E-22 ];

	private static deltaMinusDeltaSum(a: number, b: number): number {

		const DELTA = BetaDistribution.DELTA;
		const h = a / b;
		const p = h / (1.0 + h);
		const q = 1.0 / (1.0 + h);
		const q2 = q * q;
		/*
		 * s[i] = 1 + q + ... - q**(2 * i)
		 */
		const s: number[] = new Array<number>(DELTA.length).fill(0.0);
		s[0] = 1.0;
		for (let i = 1; i < s.length; i++) {
			s[i] = 1.0 + (q + q2 * s[i - 1]);
		}
		/*
		 * w = Delta(b) - Delta(a + b)
		 */
		const sqrtT = 10.0 / b;
		const t = sqrtT * sqrtT;
		let w = DELTA[DELTA.length - 1] * s[s.length - 1];
		for (let i = DELTA.length - 2; i >= 0; i--) {
			w = t * w + DELTA[i] * s[i];
		}
		return w * p / b;
	}

	private static sumDeltaMinusDeltaSum(p: number, q: number): number {

		const DELTA = BetaDistribution.DELTA;
		const a = Math.min(p, q);
		const b = Math.max(p, q);
		const sqrtT = 10.0 / a;
		const t = sqrtT * sqrtT;
		let z = DELTA[DELTA.length - 1];
		for (let i = DELTA.length - 2; i >= 0; i--) {
			z = t * z + DELTA[i];
		}
		return z / a + BetaDistribution.deltaMinusDeltaSum(a, b);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.BetaDistribution", BetaDistribution);
