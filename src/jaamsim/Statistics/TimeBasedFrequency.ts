/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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

// double[]・int[] は number[]（0 で埋める）。
// Java の配列の範囲外は例外になるので、System.arraycopy と範囲外の添字は checkIndex/arraycopy で例外にした。
// 多重定義 getBinTimes(t) / getBinTimes(t, val0, val1) などは、引数の数で見分けた（名前は変えていない）。

import { ErrorException } from "../internal.ts";
import { IndexOutOfBoundsException, jformat, jstr } from "../internal.ts";

/** Java の new double[n] など（0 で埋めた配列。負の長さは例外） */
function newArray(n: number): number[] {
	if (n < 0)
		throw new IndexOutOfBoundsException("NegativeArraySizeException: " + n);
	return new Array<number>(n).fill(0);
}

/** Java の配列の添字の確かめ（範囲外は ArrayIndexOutOfBoundsException） */
function checkIndex(arr: number[], i: number): number {
	if (i < 0 || i >= arr.length)
		throw new IndexOutOfBoundsException("Index " + i + " out of bounds for length " + arr.length);
	return i;
}

/** Java の System.arraycopy（範囲外は例外） */
function arraycopy(src: number[], srcPos: number, dest: number[], destPos: number, length: number): void {
	if (srcPos < 0 || destPos < 0 || length < 0
			|| srcPos + length > src.length || destPos + length > dest.length)
		throw new IndexOutOfBoundsException("arraycopy: last source index " + (srcPos + length)
				+ " out of bounds for length " + src.length);
	for (let i = 0; i < length; i++)
		dest[destPos + i] = src[srcPos + i];
}

export class TimeBasedFrequency {

	private startTime: number;   // time at which recording begins
	private lastTime = 0.0;    // time at which the last value was recorded
	private lastVal = 0;    // last value that was recorded
	private binTimes: number[];  // total time recorded for each bin
	private firstVal: number;  // value for the first bin
	private minVal: number;  // minimum value recorded
	private maxVal: number;  // maximum value recorded

	/**
	 * Constructs an object that collects frequency statistics on the total time that
	 * individual integer values are observed. A separate bin is maintained for each integer
	 * in the range of values that are observed.
	 * @param val0 - lowest integer in the initial range of values to record
	 * @param val1 - highest integer in the initial range of values to record
	 */
	constructor(val0: number, val1: number) {
		this.startTime = -1.0;
		this.firstVal = val0;
		this.binTimes = newArray(val1 - val0 + 1);
		this.minVal = val0;
		this.maxVal = val0;
	}

	clear(): void {
		this.startTime = -1.0;
		this.lastTime = -1.0;
		this.binTimes.fill(0.0);
		this.maxVal = this.minVal;
	}

	private resize(val0: number, val1: number): void {
		if (val0 > this.firstVal || val1 < this.firstVal + this.binTimes.length - 1)
			throw new ErrorException("Invalid resizing of bin array.");

		const offset = this.firstVal - val0;
		const num = val1 - val0 + 1;
		const newBinTimes = newArray(num);
		arraycopy(this.binTimes, 0, newBinTimes, offset, this.binTimes.length);
		this.binTimes = newBinTimes;
		this.firstVal = val0;
	}

	private resizeForValue(val: number): void {
		let val0 = this.firstVal;
		let val1 =  this.firstVal + this.binTimes.length - 1;
		if (val >= val0 && val <= val1)
			return;

		if (val < val0) {
			val0 = Math.min(val, val0 - this.binTimes.length);
		}
		else if (val > val1) {
			val1 = Math.max(val, val1 + this.binTimes.length);
		}
		this.resize(val0, val1);
	}

	/**
	 * Records the specified integer value at the specified time.
	 * @param t - time at which the value occurs
	 * @param val - integer value to be recorded
	 */
	addValue(t: number, val: number): void {
		this.resizeForValue(val);

		if (this.startTime < 0.0) {
			this.startTime = t;
			this.lastTime = t;
			this.minVal = val;
			this.maxVal = val;
			this.lastVal = val;
			//System.out.println(this);
			return;
		}

		const index = this.lastVal - this.firstVal;
		this.binTimes[checkIndex(this.binTimes, index)] += t - this.lastTime;
		this.minVal = Math.min(this.minVal, val);
		this.maxVal = Math.max(this.maxVal, val);
		this.lastTime = t;
		this.lastVal = val;
		//System.out.println(this);
	}

	/**
	 * Returns the total time recorded for the integer values up to the specified time.
	 * @param t - specified time
	 * @return total time
	 */
	getTotalTime(t: number): number {
		return t - this.startTime;
	}

	/**
	 * Returns the minimum integer value that was recorded.
	 * @return minimum integer value
	 */
	getMin(): number {
		return this.minVal;
	}

	/**
	 * Returns the maximum integer value that was recorded.
	 * @return maximum integer value
	 */
	getMax(): number {
		return this.maxVal;
	}

	/**
	 * Returns the total time during which the specified integer value applied up to the
	 * specified time.
	 * @param t - specified time
	 * @param val - specified integer value
	 * @return total time
	 */
	getBinTime(t: number, val: number): number {
		const index = val - this.firstVal;
		let ret = this.binTimes[checkIndex(this.binTimes, index)];
		if (val === this.lastVal) {
			ret += t - this.lastTime;
		}
		return ret;
	}

	/**
	 * Returns the total time during which the specified integer value applied up to the
	 * specified time as a fraction of the total time.
	 * @param t - specified time
	 * @param val - specified integer value
	 * @return faction of total time
	 */
	getBinFraction(t: number, val: number): number {
		return this.getBinTime(t, val)/(t - this.startTime);
	}

	/**
	 * Returns an array of the integer values covering the range between the lowest and highest
	 * values that were recorded.
	 * @return array of integer values
	 */
	getBinValues(): number[] {
		const num = this.maxVal - this.minVal + 1;
		const ret = newArray(num);
		for (let i = 0; i < num; i++) {
			ret[i] = this.minVal + i;
		}
		return ret;
	}

	/**
	 * getBinTimes(t):
	 * Returns an array containing the total time that each integer value applied up to the
	 * specified time, covering the range between the lowest and highest values.
	 *
	 * getBinTimes(t, val0, val1):
	 * Returns an array containing the total time that each integer value applied up to the
	 * specified time, covering the range between the specified first and last values.
	 * @param t - specified time
	 * @param val0 - first integer value for the returned array
	 * @param val1 - last integer value for the returned array
	 * @return array of total times
	 */
	getBinTimes(t: number, val0?: number, val1?: number): number[] {
		if (val0 === undefined || val1 === undefined)
			return this.getBinTimes(t, this.minVal, this.maxVal);

		const ret = newArray(val1 - val0 + 1);
		const srcPos = Math.max(val0 - this.firstVal, 0);
		const destPos = Math.max(this.firstVal - val0,  0);
		const num = Math.min(val1 - val0 + 1, this.binTimes.length - srcPos);
		arraycopy(this.binTimes, srcPos, ret, destPos, num);

		const index = this.lastVal - val0;
		ret[checkIndex(ret, index)] += t - this.lastTime;
		return ret;
	}

	/**
	 * getBinFractions(t):
	 * Returns an array containing the fractional time that each integer value applied,
	 * covering the range between the lowest and highest values.
	 *
	 * getBinFractions(t, val0, val1):
	 * Returns an array containing the fractional time that each integer value applied,
	 * covering the range between the specified first and last values.
	 * @param t - specified time
	 * @param val0 - first integer value for the returned array
	 * @param val1 - last integer value for the returned array
	 * @return array of values between 0 and 1
	 */
	getBinFractions(t: number, val0?: number, val1?: number): number[] {
		if (val0 === undefined || val1 === undefined)
			return this.getBinFractions(t, this.minVal, this.maxVal);

		const ret = this.getBinTimes(t, val0, val1);
		const total = t - this.startTime;
		for (let i = 0; i < ret.length; i++) {
			ret[i] = ret[i]/total;
		}
		return ret;
	}

	/**
	 * getBinCumulativeFractions(t):
	 * Returns an array containing the fractional time that each integer value or less applied,
	 * covering the range between the lowest and highest values.
	 *
	 * getBinCumulativeFractions(t, val0, val1):
	 * Returns an array containing the fractional time that each integer value or less applied,
	 * covering the range between the specified first and last values.
	 * @param t - specified time
	 * @param val0 - first integer value for the returned array
	 * @param val1 - last integer value for the returned array
	 * @return array of values that increase monotonically to 1
	 */
	getBinCumulativeFractions(t: number, val0?: number, val1?: number): number[] {
		if (val0 === undefined || val1 === undefined)
			return this.getBinCumulativeFractions(t, this.minVal, this.maxVal);

		const ret = this.getBinTimes(t, val0, val1);
		const total = t - this.startTime;
		ret[checkIndex(ret, 0)] /= total;
		for (let i = 1; i < ret.length; i++) {
			ret[i] = ret[i - 1] + ret[i]/total;
		}
		return ret;
	}

	toString(): string {
		// Java の Arrays.toString(double[]): "[1.0, 2.0]"
		const bins = "[" + this.binTimes.map(x => jstr(x)).join(", ") + "]";
		return jformat("startTime=%s, lastTime=%s, lastVal=%s, minVal=%s, maxVal=%s,"
				+ "firstVal=%s, binTimes=%s",
				jstr(this.startTime), jstr(this.lastTime), String(this.lastVal), String(this.minVal),
				String(this.maxVal), String(this.firstVal), bins);
	}

}
