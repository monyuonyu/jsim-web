/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2020 JaamSim Software Inc.
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
import { JMath } from "../java/lang.ts";
import { SimDate } from "./SimDate.ts";

/** Java の java.util.Calendar の欄の番号（SimCalendar・SimDate・JaamSimModel が使うもの） */
export const Calendar = {
	YEAR: 1,
	MONTH: 2,
	DATE: 5,
	DAY_OF_MONTH: 5,
	DAY_OF_WEEK: 7,
	HOUR_OF_DAY: 11,
	MINUTE: 12,
	SECOND: 13,
	MILLISECOND: 14,
};

/**
 * Provides the option of a fixed 365 days per year calendar, without leap years.
 * @author Harry King
 *
 * Java 版は GregorianCalendar（GMT）を継承している。TS では継承せず、使う所だけを、
 * 年・月・日・時・分・秒・ミリ秒の欄を持つ形で書いた。暦の計算は JavaScript の Date（UTC）で行う。
 * TODO(移植): Java の GregorianCalendar は 1582-10-15 より前をユリウス暦で数えるが、ここは先発グレゴリオ暦。
 *             また紀元前の年（ERA）は扱っていない。
 */
export class SimCalendar {

	private gregorian = false;  // true for the Gregorian calendar, false for a fixed 365 days/year

	private static readonly epoch = 1970;

	private static readonly millisPerSec = 1000;
	private static readonly millisPerMin = 60 * SimCalendar.millisPerSec;
	private static readonly millisPerHr  = 60 * SimCalendar.millisPerMin;
	private static readonly millisPerDay = 24 * SimCalendar.millisPerHr;
	private static readonly millisPerYr  = 365 * SimCalendar.millisPerDay;

	private static readonly daysInMonth: number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	private static readonly firstDayOfMonth: number[] = SimCalendar.makeFirstDayOfMonth();

	private static makeFirstDayOfMonth(): number[] {
		const ret = new Array<number>(12).fill(0);
		ret[0] = 1;
		for (let i = 1; i < ret.length; i++) {
			ret[i] = ret[i - 1] + SimCalendar.daysInMonth[i - 1];
		}
		return ret;
	}

	// 暦の欄（Java の Calendar が持つ値）
	private fYear = 1970;
	private fMonth = 0;
	private fDay = 1;
	private fHour = 0;
	private fMinute = 0;
	private fSecond = 0;
	private fMillis = 0;

	constructor() {
		// Java: super(TimeZone.getTimeZone("GMT"))。今の時刻で初期化される
		this.setGregorianFields(Date.now());
	}

	/**
	 * Sets whether to use the usual Gregorian calendar with leap years or to use a simplified
	 * calendar with a fixed 365 days per year (no leap years).
	 * @param bool - true for the Gregorian calendar, false for the simple calendar
	 */
	setGregorian(bool: boolean): void {
		this.gregorian = bool;
	}

	isGregorian(): boolean {
		return this.gregorian;
	}

	/**
	 * Returns the month number for the given day of the year.
	 * Does not account for leap years.
	 * @param d - day of year (1 - 365)
	 * @return month number (0 - 11)
	 */
	static getMonthForDay(d: number): number {
		const k = binarySearch(SimCalendar.firstDayOfMonth, d);
		if (k >= 0)
			return k;
		return -k - 2;
	}

	/**
	 * Sets this Calendar's current time from the given long value.
	 * @param millis - time in milliseconds from the epoch
	 */
	setTimeInMillis(millis: number): void {

		// Gregorian calendar
		if (this.gregorian) {
			this.setGregorianFields(millis);
			return;
		}

		// Simple calendar with 365 days per year
		const years = JMath.floorDiv(millis, SimCalendar.millisPerYr);
		const millisInYear = millis - years*SimCalendar.millisPerYr;  // millis in the present year (always > 0)
		const seconds = Math.trunc(millisInYear / SimCalendar.millisPerSec);
		const minutes = Math.trunc(millisInYear / SimCalendar.millisPerMin);
		const hours = Math.trunc(millisInYear / SimCalendar.millisPerHr);
		const days = Math.trunc(millisInYear / SimCalendar.millisPerDay);

		const dayOfYear = (days % 365) + 1;  // dayOfYear = 1 - 365;
		const month = SimCalendar.getMonthForDay(dayOfYear);    // month = 0 - 11
		const dayOfMonth = dayOfYear - SimCalendar.firstDayOfMonth[month] + 1;

		this.set(Calendar.YEAR, years + SimCalendar.epoch);
		this.set(Calendar.MONTH, month);
		this.set(Calendar.DAY_OF_MONTH, dayOfMonth);
		this.set(Calendar.HOUR_OF_DAY, hours % 24);
		this.set(Calendar.MINUTE, minutes % 60);
		this.set(Calendar.SECOND, seconds % 60);
		this.set(Calendar.MILLISECOND, millisInYear % 1000);
	}

	/**
	 * Returns the time in milliseconds from the epoch corresponding to the specified date.
	 * 引数なしなら Java の Calendar.getTimeInMillis()（今の欄の値をグレゴリオ暦で数えた時刻）。
	 * @param year - year
	 * @param month - month (0 - 11)
	 * @param dayOfMonth - day of the month (1 - 31)
	 * @param hourOfDay - hour of the day (0 - 23)
	 * @param minute - minutes (0 - 59)
	 * @param second - seconds (0 - 59)
	 * @param millis - millisecond (0 - 999)
	 * @return time in milliseconds from the epoch
	 */
	getTimeInMillis(): number;
	getTimeInMillis(year: number, month: number, dayOfMonth: number, hourOfDay: number, minute: number, second: number, millis: number): number;
	getTimeInMillis(year?: number, month?: number, dayOfMonth?: number, hourOfDay?: number, minute?: number, second?: number, millis?: number): number {
		if (year === undefined)
			return this.fieldsToMillis();

		// Gregorian calendar
		if (this.gregorian) {
			this.fYear = year;
			this.fMonth = month!;
			this.fDay = dayOfMonth!;
			this.fHour = hourOfDay!;
			this.fMinute = minute!;
			this.fSecond = second!;
			this.fMillis = millis!;
			const ret = this.fieldsToMillis();
			this.setGregorianFields(ret);  // Java の lenient な正規化と同じく、欄を直す
			return ret;
		}

		// Simple calendar with 365 days per year
		let ret = 0;
		ret += (year - SimCalendar.epoch) * SimCalendar.millisPerYr;
		ret += (SimCalendar.firstDayOfMonth[month!] - 1) * SimCalendar.millisPerDay;
		ret += (dayOfMonth! - 1) * SimCalendar.millisPerDay;
		ret += hourOfDay! * SimCalendar.millisPerHr;
		ret += minute! * SimCalendar.millisPerMin;
		ret += second! * SimCalendar.millisPerSec;
		ret += millis!;
		return ret;
	}

	/**
	 * Returns the SimDate containing the date and time data.
	 * @return SimDate
	 */
	getSimDate(): SimDate {
		return new SimDate(this);
	}

	// ---- Java の Calendar から使う所 ----

	set(field: number, value: number): void {
		switch (field) {
		case Calendar.YEAR: this.fYear = value; break;
		case Calendar.MONTH: this.fMonth = value; break;
		case Calendar.DAY_OF_MONTH: this.fDay = value; break;
		case Calendar.HOUR_OF_DAY: this.fHour = value; break;
		case Calendar.MINUTE: this.fMinute = value; break;
		case Calendar.SECOND: this.fSecond = value; break;
		case Calendar.MILLISECOND: this.fMillis = value; break;
		default: throw new Error("SimCalendar.set: unsupported field " + field);
		}
	}

	get(field: number): number {
		switch (field) {
		case Calendar.YEAR: return this.fYear;
		case Calendar.MONTH: return this.fMonth;
		case Calendar.DAY_OF_MONTH: return this.fDay;
		case Calendar.HOUR_OF_DAY: return this.fHour;
		case Calendar.MINUTE: return this.fMinute;
		case Calendar.SECOND: return this.fSecond;
		case Calendar.MILLISECOND: return this.fMillis;
		case Calendar.DAY_OF_WEEK:
			// Java は欄の値をグレゴリオ暦で数え直して曜日を出す（Sunday = 1, ..., Saturday = 7）
			return new Date(this.fieldsToMillis()).getUTCDay() + 1;
		default: throw new Error("SimCalendar.get: unsupported field " + field);
		}
	}

	/** Java の Calendar.getTime()（欄の値をグレゴリオ暦で数えた時刻の Date） */
	getTime(): Date {
		return new Date(this.fieldsToMillis());
	}

	private fieldsToMillis(): number {
		const d = new Date(0);
		d.setUTCFullYear(this.fYear, this.fMonth, this.fDay);  // 0 - 99 年も、そのままの年にする
		d.setUTCHours(this.fHour, this.fMinute, this.fSecond, this.fMillis);
		return d.getTime();
	}

	private setGregorianFields(millis: number): void {
		const d = new Date(millis);
		this.fYear = d.getUTCFullYear();
		this.fMonth = d.getUTCMonth();
		this.fDay = d.getUTCDate();
		this.fHour = d.getUTCHours();
		this.fMinute = d.getUTCMinutes();
		this.fSecond = d.getUTCSeconds();
		this.fMillis = d.getUTCMilliseconds();
	}

}

/** Java の Arrays.binarySearch(int[], key) */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];
		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else
			return mid;
	}
	return -(low + 1);
}
