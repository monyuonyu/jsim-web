import { EntityInput } from "../input/EntityInput.ts";
import { Input } from "../input/Input.ts";
import { StringInput } from "../input/StringInput.ts";
import { StringListInput } from "../input/StringListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, Integer, jstr } from "../java/lang.ts";
import { Entity } from "./Entity.ts";

/**
 * Java はリフレクション（getMethod・invoke）で、名前で関数を呼ぶ。
 * TS では、同じ名前の関数が実体にあり、引数の数が合えば呼ぶ（引数の型では選ばない）。
 * 戻り値の Double と Integer は見分けられないので、整数なら Integer として書く。
 * TODO(移植): Java で double を返す関数が整数の値を返したとき、Java は "5.0"、ここは "5" になる。
 */
export class OutputMethod extends Entity {

	private readonly target: EntityInput<Entity>;

	private readonly method: StringInput;

	private readonly arguments_: StringListInput;  // Java の arguments（JS の予約に近い名前なので _ を付けた）

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.target = new EntityInput<Entity>(Entity, "Target", "Outputs", null);
		this.setKeywordDoc(this.target, "The target Entity we are collecting output from", []);
		this.addInput(this.target);

		this.method = new StringInput("Method", "Outputs", null);
		this.setKeywordDoc(this.method, "The name of the method to call on the target",
				["getAmountLoaded"]);
		this.addInput(this.method);

		this.arguments_ = new StringListInput("Arguments", "Outputs", null);
		this.setKeywordDoc(this.arguments_, "A list of arguments to pass to the target method, these will be "
				+ "interpreted as Entities, then Integers and finally as literal Strings",
				["Entity1 5 'A String'"]);
		this.addInput(this.arguments_);
	}

	getReportLine(): string {
		const str: string[] = [];
		str.push((this.target.getValue() as Entity).getName());
		str.push(" ");
		str.push(String(this.method.getValue()));
		const args = this.arguments_.getValue() as string[] | null;
		if (args != null) {
			for (const arg of args) {
				str.push(" ");
				str.push(arg);
			}
		}

		this.appendOutput(str);
		return str.join("");
	}

	private appendOutput(bld: string[]): void {

		const ent = this.target.getValue() as Entity | null;
		if (ent == null) {
			bld.push("\t#ERROR");
			return;
		}

		let numParams = 0;
		const args = this.arguments_.getValue() as string[] | null;
		if (args != null)
			numParams = args.length;

		const params: unknown[] = new Array<unknown>(numParams);

		for (let i = 0; i < numParams; i++) {
			const arg = args![i];

			// Treat as an Entity if possible
			const e = Input.tryParseEntity(this.getJaamSimModel(), arg, Entity);
			if (e != null) {
				params[i] = e;
				continue;
			}

			// Otherwise, check if it is an Integer
			if (Input.isInteger(arg)) {
				params[i] = Integer.parseInt(arg);
				continue;
			}

			// Last resort, pass through a String directly
			params[i] = arg;
		}

		const meth = (ent as unknown as Record<string, unknown>)[String(this.method.getValue())];
		if (typeof meth !== "function" || meth.length !== numParams) {
			bld.push("\t#ERROR");
			return;
		}

		try {
			const ret: unknown = (meth as (...a: unknown[]) => unknown).apply(ent, params);

			if (typeof ret === "number" && !Number.isInteger(ret)) {
				const d = ret;

				if (Double.isNaN(d)) {
					bld.push("\t#ERROR");
					return;
				}
				else {
					bld.push("\t" + jstr(d));
					return;
				}
			}

			if (typeof ret === "number") {
				bld.push("\t" + String(ret));
				return;
			}

			bld.push("\t#ERROR");
		}
		catch (e) {
			// Java はリフレクションの例外を捨てる（何も足さない）
		}
	}
}

ClassRegistry.register("com.jaamsim.basicsim.OutputMethod", OutputMethod);
