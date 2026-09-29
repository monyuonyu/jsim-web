//HEADER
import { jformat } from "../java/lang.ts";

/**
 * 式の誤り（Java の ExpError。Java では検査例外）。
 *
 * Java の 3 つのコンストラクタを 1 つにまとめた:
 *   new ExpError(source, pos, msg)             … msg をそのまま使う（% も書式として読まない）
 *   new ExpError(source, pos, msg, cause)      … cause が Error のとき（原因つき）
 *   new ExpError(source, pos, fmt, ...args)    … String.format(fmt, args) と同じ（jformat）
 * 注意: 書式に double を %s で渡すときは、呼ぶ側で jstr にしておく。
 */
export class ExpError extends Error {
	public readonly source: string | null;
	public readonly pos: number;

	constructor(source: string | null, pos: number, msg: string | null, ...args: unknown[]) {
		let message: string | null = msg;
		let cause: unknown = undefined;
		if (args.length === 1 && (args[0] instanceof Error || args[0] === null)) {
			// ExpError(String source, int pos, String msg, Throwable cause)
			cause = args[0] ?? undefined;
		}
		else if (args.length > 0) {
			// ExpError(String source, int pos, String fmt, Object... args)
			message = jformat(msg ?? "null", ...args);
		}
		super(message ?? "", cause !== undefined ? { cause } : undefined);
		this.name = "ExpError";
		this.source = source;
		this.pos = pos;
		// Java の getMessage() が null を返す場合と区別するため
		this.javaMessage = message;
	}

	private readonly javaMessage: string | null;

	/** Java の getMessage()（null のこともある） */
	getMessage(): string | null {
		return this.javaMessage;
	}

	/** Java の getCause() */
	getCause(): unknown {
		return (this as { cause?: unknown }).cause ?? null;
	}
}
