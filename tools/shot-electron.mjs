// Electron の窓を撮る: xvfb-run node tools/shot-electron.mjs 出力.png [待つミリ秒]
// 環境変数 SHOT_JS があれば、撮る前にその JS を窓の中で実行する
import { _electron as electron } from "playwright-core";
const [out, wait = "4000"] = process.argv.slice(2);
const app = await electron.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "."], env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" } });
const w = await app.firstWindow();
w.on("console", m => console.log("[console]", m.text()));
w.on("pageerror", e => console.log("[pageerror]", e.message));
await w.waitForTimeout(+wait);
if (process.env.SHOT_JS) { console.log("[eval]", await w.evaluate(process.env.SHOT_JS)); await w.waitForTimeout(+(process.env.SHOT_WAIT ?? "1000")); }
await w.screenshot({ path: out });
console.log("title:", await w.title());
await app.close();
