/*
 * 読み込みの順番を決める道具（循環する import で、親のクラスより先に子のクラスが評価されるのを防ぐ）。
 *
 * やり方（いわゆる internal.ts の型）:
 *  1. src/jaamsim の全ファイルについて、「読み込んだ時点で要る名前」を集める
 *     （extends の親、static の初期値、ファイルの一番上で実行される文。関数やメソッドの中身は除く）
 *  2. それを満たす順番にファイルを並べ、src/jaamsim/internal.ts に `export * from` で書く
 *  3. --rewrite を付けると、各ファイルの（値の）import を internal.ts からに書き換える
 *
 * 使い方: node --import tsx tools/make-internal.ts [--rewrite]
 */
import { createRequire } from "node:module";
const ts: typeof import("ts5") = createRequire(import.meta.url)("ts5");
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = new URL("../src/jaamsim/", import.meta.url).pathname;
const INTERNAL = join(ROOT, "internal.ts");

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (n.endsWith(".ts") && p !== INTERNAL) out.push(p);
	}
	return out;
}

const files = walk(ROOT).sort();

interface Info {
	file: string;
	exports: Set<string>;        // 値として書き出す名前
	typeExports: Set<string>;    // 型だけの名前
	needs: Set<string>;          // 読み込んだ時点で要る名前（ほかのファイルの物）
	src: ts.SourceFile;
}

function hasExport(node: ts.Node): boolean {
	return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
}

/** 関数・メソッドの中身は読み込みの時点では走らないので、たどらない */
function collectIdents(node: ts.Node, out: Set<string>): void {
	if (ts.isFunctionLike(node) && !ts.isClassStaticBlockDeclaration(node))
		return;
	// class X extends Y の Y（中身の class 式でも）: 型として扱われるが、読み込みの時点で要る
	if (ts.isExpressionWithTypeArguments(node)) {
		collectIdents(node.expression, out);
		return;
	}
	if (ts.isTypeNode(node))
		return;
	if (ts.isIdentifier(node))
		out.add(node.text);
	if (ts.isPropertyAccessExpression(node)) {
		collectIdents(node.expression, out);  // 右の名前（x.foo の foo）は変数でない
		return;
	}
	if (ts.isPropertyAssignment(node)) {
		if (ts.isComputedPropertyName(node.name)) collectIdents(node.name, out);
		collectIdents(node.initializer, out);
		return;
	}
	ts.forEachChild(node, c => collectIdents(c, out));
}

const infos: Info[] = [];
for (const file of files) {
	const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
	const info: Info = { file, exports: new Set(), typeExports: new Set(), needs: new Set(), src };
	const topNeeds = new Set<string>();
	for (const st of src.statements) {
		if (ts.isImportDeclaration(st)) continue;
		if (ts.isExportDeclaration(st)) {
			// export { X } from "./Y.ts"（再輸出）: 名前は書き出すが、読み込みの時点では何も要らない
			if (st.exportClause && ts.isNamedExports(st.exportClause))
				for (const e of st.exportClause.elements)
					(st.isTypeOnly || e.isTypeOnly ? info.typeExports : info.exports).add(e.name.text);
			continue;
		}
		if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
			if (hasExport(st)) info.typeExports.add(st.name.text);
			continue;
		}
		if (ts.isClassDeclaration(st)) {
			if (st.name && hasExport(st)) info.exports.add(st.name.text);
			for (const h of st.heritageClauses ?? [])
				if (h.token === ts.SyntaxKind.ExtendsKeyword)
					for (const t of h.types) collectIdents(t.expression, topNeeds);
			for (const m of st.members) {
				const isStatic = ts.canHaveModifiers(m) && (ts.getModifiers(m) ?? []).some(x => x.kind === ts.SyntaxKind.StaticKeyword);
				if (ts.isPropertyDeclaration(m) && isStatic && m.initializer) collectIdents(m.initializer, topNeeds);
				if (ts.isClassStaticBlockDeclaration(m)) ts.forEachChild(m.body, c => collectIdents(c, topNeeds));
				if (ts.isPropertyDeclaration(m) && m.name && ts.isComputedPropertyName(m.name)) collectIdents(m.name, topNeeds);
			}
			continue;
		}
		if (ts.isFunctionDeclaration(st)) {
			if (st.name && hasExport(st)) info.exports.add(st.name.text);
			continue;
		}
		if (ts.isEnumDeclaration(st)) {
			if (hasExport(st)) info.exports.add(st.name.text);
			collectIdents(st, topNeeds);
			continue;
		}
		if (ts.isVariableStatement(st)) {
			for (const d of st.declarationList.declarations) {
				if (ts.isIdentifier(d.name) && hasExport(st)) info.exports.add(d.name.text);
				if (d.initializer) collectIdents(d.initializer, topNeeds);
			}
			continue;
		}
		collectIdents(st, topNeeds);  // 一番上の文（登録など）
	}
	info.needs = topNeeds;
	infos.push(info);
}

// 名前 → 書き出しているファイル
const owner = new Map<string, Info[]>();
for (const i of infos)
	for (const n of i.exports) {
		const l = owner.get(n) ?? [];
		l.push(i);
		owner.set(n, l);
	}

const dups = [...owner.entries()].filter(([, l]) => l.length > 1);
if (dups.length > 0) {
	console.log(`同じ名前を書き出しているファイル: ${dups.length} 件`);
	for (const [n, l] of dups)
		console.log(`  ${n}: ${l.map(i => relative(ROOT, i.file)).join(", ")}`);
}

// 依存（読み込みの時点で要る、ほかのファイルの名前）
const deps = new Map<Info, Set<Info>>();
for (const i of infos) {
	const s = new Set<Info>();
	for (const n of i.needs) {
		if (i.exports.has(n)) continue;
		const imported = importedFrom(i, n);
		if (imported) s.add(imported);
	}
	deps.set(i, s);
}

/** ファイルの中で、その名前をどのファイルから import しているか */
function importedFrom(i: Info, name: string): Info | null {
	for (const st of i.src.statements) {
		if (!ts.isImportDeclaration(st) || !st.importClause) continue;
		const spec = (st.moduleSpecifier as ts.StringLiteral).text;
		if (!spec.startsWith(".")) continue;
		const target = join(dirname(i.file), spec);
		const names: string[] = [];
		if (st.importClause.name) names.push(st.importClause.name.text);
		const nb = st.importClause.namedBindings;
		if (nb && ts.isNamedImports(nb))
			for (const e of nb.elements) names.push(e.name.text);
		if (names.includes(name)) {
			// internal.ts から import している（書き換えた後）なら、その名前を書き出しているファイルを探す
			if (target === INTERNAL) {
				const l = owner.get(name);
				return l ? l[l.length - 1] : null;  // 再輸出と元がある時は、元（EventManager.ts など）が後ろ
			}
			const t = infos.find(x => x.file === target);
			if (!t) return null;
			// 再輸出（events/ProcessTarget.ts など）は、元のファイルまでたどる
			return t;
		}
	}
	return null;
}

// 並べる（依存が先）。輪になったら知らせて、見つけた順で続ける
const order: Info[] = [];
const state = new Map<Info, number>();  // 1: 途中、2: 済み
const cycles: string[] = [];
function visit(i: Info, stack: Info[]): void {
	const st = state.get(i);
	if (st === 2) return;
	if (st === 1) {
		cycles.push([...stack.slice(stack.indexOf(i)), i].map(x => relative(ROOT, x.file)).join(" → "));
		return;
	}
	state.set(i, 1);
	for (const d of deps.get(i)!) visit(d, [...stack, i]);
	state.set(i, 2);
	order.push(i);
}
// 土台（Java の標準の代わり・乱数・事象・多言語・数学・データ型）は、ほかの物が関数の中から使うので先に置く
// （関数を通した依存は、ソースを読むだけでは分からないため）
const FIRST = ["java/", "rng/", "events/", "i18n/", "math/", "datatypes/"];
const rank = (i: Info) => {
	const r = relative(ROOT, i.file);
	const k = FIRST.findIndex(p => r.startsWith(p));
	return k < 0 ? FIRST.length : k;
};
for (const i of [...infos].sort((a, b) => rank(a) - rank(b))) visit(i, []);

if (cycles.length > 0) {
	console.log(`読み込みの時点で輪になっている所: ${cycles.length} 件（手で直す）`);
	for (const c of cycles) console.log("  " + c);
}

const lines = [
	"// 自動で作ったファイル（tools/make-internal.ts）。手で直さない。",
	"// 全部のモジュールを「読み込みの時点で要る物が先」の順に並べる。各ファイルはここから import する。",
	...order.map(i => `export * from "./${relative(ROOT, i.file)}";`),
	"",
];
writeFileSync(INTERNAL, lines.join("\n"));
console.log(`internal.ts: ${order.length} ファイル`);

if (process.argv.includes("--rewrite")) {
	let changed = 0;
	for (const i of infos) {
		let text = readFileSync(i.file, "utf8");
		const rel = relative(dirname(i.file), INTERNAL);
		const internalSpec = rel.startsWith(".") ? rel : "./" + rel;
		const edits: { start: number; end: number; text: string }[] = [];
		for (const st of i.src.statements) {
			if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
			const spec = (st.moduleSpecifier as ts.StringLiteral).text;
			if (!spec.startsWith(".")) continue;
			const target = join(dirname(i.file), spec);
			if (!infos.some(x => x.file === target)) continue;  // src/jaamsim の外（テストなど）
			if (st.importClause.name) continue;  // 既定の import は使っていない前提
			const nb = st.importClause.namedBindings;
			if (!nb || !ts.isNamedImports(nb)) continue;
			// 値の名前は internal.ts から、型だけの名前はそのまま
			const values = nb.elements.filter(e => !e.isTypeOnly);
			const types = nb.elements.filter(e => e.isTypeOnly);
			const parts: string[] = [];
			if (values.length > 0)
				parts.push(`import { ${values.map(e => e.getText(i.src)).join(", ")} } from "${internalSpec}";`);
			if (types.length > 0)
				parts.push(`import { ${types.map(e => e.getText(i.src)).join(", ")} } from "${spec}";`);
			edits.push({ start: st.getStart(i.src), end: st.getEnd(), text: parts.join("\n") });
		}
		if (edits.length === 0) continue;
		for (const e of edits.sort((a, b) => b.start - a.start))
			text = text.slice(0, e.start) + e.text + text.slice(e.end);
		writeFileSync(i.file, text);
		changed++;
	}
	console.log(`import を書き換えたファイル: ${changed}`);
}
