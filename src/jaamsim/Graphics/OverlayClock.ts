/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2023 JaamSim Software Inc.
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
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { StringInput } from "../input/StringInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { IllegalArgumentException } from "../java/lang.ts";
import { LateClasses } from "./LateClasses.ts";
import { OverlayText } from "./OverlayText.ts";

/*
 * 移植の注意:
 * - java.text.SimpleDateFormat（GMT、英語の月・曜日の名前）は、このファイルの SimpleDateFormat に写した。
 *   対応する文字: G y Y M L d D E u a H k K h m s S z Z X F w W と '...' の囲み。
 *   それ以外の英字は Java と同じく IllegalArgumentException("Illegal pattern character 'x'")。
 *   TODO(移植): Java の既定のロケールに依る名前（MMM など）は英語に固定した。1582 年より前の日付は
 *   Java（ユリウス暦）と JS（先発グレゴリオ暦）で違う。週の番号（w W）は ISO ではなく米国式（日曜始まり・1 月 1 日を含む週が 1）。
 * - JaamSimModel.getCalendarDate の戻り値（Java の Date）は、Date でも ms の数でも受ける。
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
		"September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(n: number, width: number): string {
	const neg = n < 0;
	let s = String(Math.abs(n));
	while (s.length < width)
		s = "0" + s;
	return (neg ? "-" : "") + s;
}

/** java.text.SimpleDateFormat の写し（時間帯は GMT に固定） */
export class SimpleDateFormat {
	private readonly tokens: ({ letter: string; count: number } | string)[] = [];

	constructor(pattern: string) {
		let i = 0;
		while (i < pattern.length) {
			const c = pattern[i];
			if (c === "'") {
				// '' は ' 1 つ、'...' はそのままの文字
				if (pattern[i + 1] === "'") {
					this.tokens.push("'");
					i += 2;
					continue;
				}
				let j = i + 1;
				let lit = "";
				while (j < pattern.length) {
					if (pattern[j] === "'") {
						if (pattern[j + 1] === "'") {
							lit += "'";
							j += 2;
							continue;
						}
						break;
					}
					lit += pattern[j];
					j++;
				}
				if (j >= pattern.length)
					throw new IllegalArgumentException("Unterminated quote");
				this.tokens.push(lit);
				i = j + 1;
				continue;
			}
			if (/[A-Za-z]/.test(c)) {
				if (!"GyYMLdDEuaHkKhmsSzZXFwW".includes(c))
					throw new IllegalArgumentException(`Illegal pattern character '${c}'`);
				let n = 1;
				while (pattern[i + n] === c)
					n++;
				this.tokens.push({ letter: c, count: n });
				i += n;
				continue;
			}
			this.tokens.push(c);
			i++;
		}
	}

	format(date: Date | number): string {
		const d = typeof date === "number" ? new Date(date) : date;
		const year = d.getUTCFullYear();
		const month = d.getUTCMonth();
		const day = d.getUTCDate();
		const dow = d.getUTCDay();
		const hour = d.getUTCHours();
		const min = d.getUTCMinutes();
		const sec = d.getUTCSeconds();
		const ms = d.getUTCMilliseconds();
		const startOfYear = Date.UTC(year, 0, 1);
		const dayOfYear = Math.floor((Date.UTC(year, month, day) - startOfYear) / 86400000) + 1;
		const jan1Dow = new Date(startOfYear).getUTCDay();
		let out = "";
		for (const t of this.tokens) {
			if (typeof t === "string") {
				out += t;
				continue;
			}
			const n = t.count;
			switch (t.letter) {
			case "G": out += year > 0 ? "AD" : "BC"; break;
			case "y":
			case "Y": {
				const y = year > 0 ? year : 1 - year;
				out += n === 2 ? pad(y % 100, 2) : pad(y, n);
				break;
			}
			case "M":
			case "L":
				if (n >= 4) out += MONTHS[month];
				else if (n === 3) out += MONTHS[month].slice(0, 3);
				else out += pad(month + 1, n);
				break;
			case "d": out += pad(day, n); break;
			case "D": out += pad(dayOfYear, n); break;
			case "E": out += n >= 4 ? DAYS[dow] : DAYS[dow].slice(0, 3); break;
			case "u": out += pad(dow === 0 ? 7 : dow, n); break;
			case "a": out += hour < 12 ? "AM" : "PM"; break;
			case "H": out += pad(hour, n); break;
			case "k": out += pad(hour === 0 ? 24 : hour, n); break;
			case "K": out += pad(hour % 12, n); break;
			case "h": out += pad(hour % 12 === 0 ? 12 : hour % 12, n); break;
			case "m": out += pad(min, n); break;
			case "s": out += pad(sec, n); break;
			case "S": out += pad(ms, n); break;
			case "z": out += n >= 4 ? "Greenwich Mean Time" : "GMT"; break;
			case "Z": out += "+0000"; break;
			case "X": out += "Z"; break;
			case "F": out += pad(Math.floor((day - 1) / 7) + 1, n); break;
			case "w": out += pad(Math.floor((dayOfYear - 1 + jan1Dow) / 7) + 1, n); break;
			case "W": {
				const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
				out += pad(Math.floor((day - 1 + firstDow) / 7) + 1, n);
				break;
			}
			}
		}
		return out;
	}
}

/**
 * An overlay display of time and/or date.
 * @author Harry King
 *
 */
export class OverlayClock extends OverlayText {

	private readonly startingYear: SampleInput;

	protected readonly dateFormatInput: StringInput;

	private dateFormat: SimpleDateFormat;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.formatText.setHidden(true);
		this.dataSource.setHidden(true);
		this.unitType.setHidden(true);
		this.unit.setHidden(true);

		this.startingYear = SampleInput.ofInt("StartingYear", Entity.KEY_INPUTS, 2000);
		this.setKeywordDoc(this.startingYear, "The year in which the simulation will begin.",
				["2000"]);
		this.startingYear.setIntegerValue(true);
		this.startingYear.setHidden(true);  // not used
		this.addInput(this.startingYear);

		this.dateFormatInput = new StringInput("DateFormat", Entity.KEY_INPUTS, "yyyy-MMM-dd HH:mm:ss.SSS");
		this.setKeywordDoc(this.dateFormatInput, "The Java date format in which the date and time are to be displayed.  " +
				"If spaces are included, enclose the text in single quotes.  " +
				 "e.g. 'yyyy-MMM-dd H:mm:ss.SSS'",
				["'yyyy-MMM-dd HH:mm:ss.SSS'"]);
		this.dateFormatInput.setCallback(OverlayClock.inputCallback);
		this.addInput(this.dateFormatInput);

		// ---- Java のコンストラクタの中身 ----
		this.dateFormat = new SimpleDateFormat(this.dateFormatInput.getValue()!);
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as OverlayClock).updateInputValue();
		},
	} as InputCallback;

	updateInputValue(): void {
		this.dateFormat = new SimpleDateFormat(this.dateFormatInput.getValue()!);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.startingYear.reset();  // Delete an unnecessary input
	}

	override getRenderText(simTime: number): string {
		const millis = this.getJaamSimModel().simTimeToCalendarMillis(simTime);
		const date = this.getJaamSimModel().getCalendarDate(millis) as unknown as Date | number;
		return this.dateFormat.format(date);
	}

}

ClassRegistry.register("com.jaamsim.Graphics.OverlayClock", OverlayClock);
LateClasses.bind("com.jaamsim.Graphics.OverlayClock", OverlayClock);
