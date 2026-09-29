import { jformat } from "../java/lang.ts";
import { Calendar } from "./SimCalendar.ts";

/** Java の Calendar のうち、SimDate が使う所（SimCalendar が持つ） */
export interface CalendarLike {
	get(field: number): number;
}

/**
 * Java の 3 つのコンストラクタは、引数の数で見分ける:
 *   (YY, MM, DD)、(YY, MM, DD, hh, mm, ss, ms)、(calendar)
 */
export class SimDate {

	public readonly year: number;
	public readonly month: number;
	public readonly dayOfMonth: number;
	public readonly hourOfDay: number;
	public readonly minute: number;
	public readonly second: number;
	public readonly millisecond: number;

	constructor(calendar: CalendarLike);
	constructor(YY: number, MM: number, DD: number);
	constructor(YY: number, MM: number, DD: number, hh: number, mm: number, ss: number, ms: number);
	constructor(a: number | CalendarLike, MM?: number, DD?: number, hh = 0, mm = 0, ss = 0, ms = 0) {
		if (typeof a !== "number") {
			const calendar = a;
			this.year = calendar.get(Calendar.YEAR);
			this.month = calendar.get(Calendar.MONTH) + 1;
			this.dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH);
			this.hourOfDay = calendar.get(Calendar.HOUR_OF_DAY);
			this.minute = calendar.get(Calendar.MINUTE);
			this.second = calendar.get(Calendar.SECOND);
			this.millisecond = calendar.get(Calendar.MILLISECOND);
			return;
		}
		this.year = a;
		this.month = MM!;
		this.dayOfMonth = DD!;
		this.hourOfDay = hh;
		this.minute = mm;
		this.second = ss;
		this.millisecond = ms;
	}

	toArray(): number[] {
		return [this.year, this.month, this.dayOfMonth, this.hourOfDay, this.minute, this.second, this.millisecond];
	}

	toString(): string {
		if (this.hourOfDay === 0 && this.minute === 0 && this.second === 0 && this.millisecond === 0)
			return jformat("%04d-%02d-%02d", this.year, this.month, this.dayOfMonth);

		return jformat("%04d-%02d-%02d %02d:%02d:%02d.%s",
				this.year, this.month, this.dayOfMonth, this.hourOfDay, this.minute, this.second, this.millisecond);
	}

}
