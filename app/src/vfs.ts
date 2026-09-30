/*
 * 資源（部品の定義・アイコン・形）を、ブラウザの中から計算の部分に読ませる。
 * 計算の部分はファイルを URI で読むので、"file:/res/..." を、アプリに同梱した中身に振り向ける。
 */
import { InputAgent, URI } from "../../src/jaamsim/internal.ts";

const texts = import.meta.glob("../../resources/inputs/*", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const urls = import.meta.glob("../../resources/{images,shapes}/**/*", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const RES = "/res/";
const PREFIX = "../../resources/";

/** 利用者のファイル（開いたモデルなど）。道 → 中身 */
const userFiles = new Map<string, string>();

export function putUserFile(path: string, text: string): void {
	userFiles.set(path, text);
}

/** 資源の画像・形の URL（画面で使う） */
export function resourceUrl(resPath: string): string | undefined {
	return urls[PREFIX + resPath.replace(/^<res>\//, "")];
}

export function installVfs(): void {
	InputAgent.setResRoot(new URI("file", RES, null));
	InputAgent.setFileReader((uri: URI) => {
		const path = uri.getPath() as string;
		if (path.startsWith(RES)) {
			const key = PREFIX + path.substring(RES.length);
			if (key in texts) return texts[key];
			if (key in urls) return "";  // 画像などは、あるかどうかだけを見る
		}
		const u = userFiles.get(path);
		if (u !== undefined) return u;
		throw new Error(`${path} (No such file or directory)`);
	});
}
