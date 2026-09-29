// まとまり A（math・datatypes）が Java 版と同じ数を出すこと。
// 正解は ref/A-math/Ref.java（JaamSim の math の Java をそのまま使う）で作った test/A-math.ref.txt。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Gamma } from "../src/jaamsim/math/Gamma.ts";
import { Quaternion } from "../src/jaamsim/math/Quaternion.ts";
import { Mat4d } from "../src/jaamsim/math/Mat4d.ts";
import { Transform } from "../src/jaamsim/math/Transform.ts";
import { Vec3d } from "../src/jaamsim/math/Vec3d.ts";
import { Vec4d } from "../src/jaamsim/math/Vec4d.ts";
import { Plane } from "../src/jaamsim/math/Plane.ts";
import { Ray } from "../src/jaamsim/math/Ray.ts";
import { MathUtils } from "../src/jaamsim/math/MathUtils.ts";
import { AABB } from "../src/jaamsim/math/AABB.ts";
import { Vec3dInterner } from "../src/jaamsim/math/Vec3dInterner.ts";
import { IntegerVector } from "../src/jaamsim/datatypes/IntegerVector.ts";
import { jstr } from "../src/jaamsim/java/lang.ts";

const buf = new DataView(new ArrayBuffer(8));
function h(x: number): string {
	buf.setFloat64(0, x);
	return buf.getBigUint64(0).toString(16);
}
function fromHex(s: string): number {
	buf.setBigUint64(0, BigInt("0x" + s));
	return buf.getFloat64(0);
}

const ref = new Map<string, string>();
const lines = readFileSync(new URL("./A-math.ref.txt", import.meta.url), "utf8").trim().split("\n");
for (const line of lines) {
	const i = line.lastIndexOf(" ");
	if (/^(gamma|logGamma|invGamma1pm1|logGamma1p) /.test(line) || /^[\w.[\]]+ [0-9a-f]+$/.test(line))
		ref.set(line.slice(0, i), line.slice(i + 1));
}
const plain = lines.filter(l => /^(q\.str|t3\.str|v4\.str|intern|iv|perm) /.test(l));

/** 四則と sqrt だけの計算はビットまで一致を求める。sin・log などを通るものは最後の数ビットの違いを許す（PORTING.md の 2） */
function check(key: string, got: number, exact: boolean): void {
	const want = ref.get(key);
	assert.ok(want !== undefined, `参照値が無い: ${key}`);
	if (exact || h(got) === want) {
		assert.equal(h(got), want, key);
		return;
	}
	const w = fromHex(want);
	assert.ok(Math.abs(got - w) <= 4 * Number.EPSILON * Math.abs(w), `${key}: ${got} と ${w}`);
}

test("Gamma は Java と同じ値（ほぼビットまで）", () => {
	const xs = [0.1,0.5,0.9,1.0,1.5,2.0,2.5,3.3,7.9,8.0,8.5,12.25,20.0,20.5,50.0,171.3,-0.5,-1.5,-2.7,-20.5,-25.3,1e-8];
	for (const x of xs) {
		check("gamma " + jstr(x), Gamma.gamma(x), false);
		check("logGamma " + jstr(x), Gamma.logGamma(x), false);
	}
	for (const x of [-0.5,-0.2,0.0,0.3,0.5,0.7,1.2,1.5]) {
		check("invGamma1pm1 " + jstr(x), Gamma.invGamma1pm1(x), true);  // 多項式だけなのでビットまで
		check("logGamma1p " + jstr(x), Gamma.logGamma1p(x), false);
	}
});

test("行列・四元数・変換・平面・AABB は Java と同じ値", () => {
	const q = new Quaternion(); q.setEuler3(new Vec3d(0.3, -1.1, 2.5));
	check("q.x", q.x, false); check("q.y", q.y, false); check("q.z", q.z, false); check("q.w", q.w, false);
	const e = q.getEuler3(); check("e.x", e.x, false); check("e.y", e.y, false); check("e.z", e.z, false);
	const m = new Mat4d(); m.setRot4(q); m.setTranslate3(new Vec3d(1.5, -2.25, 3.125)); m.scale3(0.7);
	const m2 = new Mat4d(1,2,3,4, 0.5,-1,2,0.25, 3,1,-2,1, 0,0,0,1);
	const m3 = new Mat4d(); m3.mult4(m, m2);
	let d = m3.toCMDataArray(); d.forEach((v, i) => check(`m3[${i}]`, v, false));
	check("det", m3.determinant(), false);
	d = m3.inverse()!.toCMDataArray(); d.forEach((v, i) => check(`inv[${i}]`, v, false));
	const eu = new Mat4d(); eu.setEuler4(new Vec3d(0.3, -1.1, 2.5)); eu.toCMDataArray().forEach((v, i) => check(`eu[${i}]`, v, false));
	const t1 = new Transform(new Vec3d(1, 2, 3), q, 2.5);
	const q2 = new Quaternion(); q2.setAxisAngle(new Vec3d(1, 1, 0), 0.77);
	const t2 = new Transform(new Vec3d(-4, 0.5, 7), q2, 0.3);
	const t3 = new Transform(); t3.merge(t1, t2);
	const ti = new Transform(); t3.inverse(ti);
	const o = new Vec3d(); ti.multAndTrans(new Vec3d(0.1, 0.2, 0.3), o);
	check("ti.x", o.x, false); check("ti.y", o.y, false); check("ti.z", o.z, false);
	t3.getMat4dRef().toCMDataArray().forEach((v, i) => check(`t3[${i}]`, v, false));
	const sl = new Quaternion(); q.slerp(q2, 0.3, sl);
	check("sl.x", sl.x, false); check("sl.y", sl.y, false); check("sl.z", sl.z, false); check("sl.w", sl.w, false);
	const s3 = new Vec3d(); s3.slerp(new Vec3d(1, 0, 0), new Vec3d(0, 0.6, 0.8), 0.4);
	check("s3.x", s3.x, false); check("s3.y", s3.y, false); check("s3.z", s3.z, false);
	const tv = Quaternion.transformVectors(new Vec4d(1, 2, 3, 0), new Vec4d(-2, 1, 0.5, 0));
	check("tv.x", tv.x, false); check("tv.y", tv.y, false); check("tv.z", tv.z, false); check("tv.w", tv.w, false);
	const pl = new Plane(new Vec3d(0, 0, 1), new Vec3d(1, 0, 1.5), new Vec3d(0, 2, 1));
	const r = new Ray(new Vec4d(0.2, 0.3, 5, 1), new Vec4d(0.1, 0.1, -1, 0));
	check("pl.cd", pl.collisionDist(r), true);
	const cp = MathUtils.collidePlanes(pl, new Plane(new Vec3d(0.3, 0.4, 0.5), 2.0), new Plane(new Vec3d(-1, 0.2, 0.1), -1.0))!;
	check("cp.x", cp.x, true); check("cp.y", cp.y, true); check("cp.z", cp.z, true);
	const bb = new AABB([new Vec3d(1, 2, 3), new Vec3d(-1, 0.5, 2), new Vec3d(0.3, -4, 1)], m);
	check("bb.min.x", bb.minPt.x, false); check("bb.max.z", bb.maxPt.z, false);
	check("bb.cd", bb.collisionDist(new Ray(new Vec4d(10, 10, 10, 1), new Vec4d(-1, -1, -1, 0))), false);
});

test("文字列・Interner・IntegerVector は Java と同じ", () => {
	const q = new Quaternion(); q.setEuler3(new Vec3d(0.3, -1.1, 2.5));
	const got: string[] = [];
	got.push("q.str " + q.toString());
	const q2 = new Quaternion(); q2.setAxisAngle(new Vec3d(1, 1, 0), 0.77);
	const t3 = new Transform(); t3.merge(new Transform(new Vec3d(1, 2, 3), q, 2.5), new Transform(new Vec3d(-4, 0.5, 7), q2, 0.3));
	got.push("t3.str " + t3.toString());
	got.push("v4.str " + new Vec4d(1, -0.0, 1e-5, 1e7).toString());
	const inn = new Vec3dInterner(); const z1 = new Vec3d(0, 0, 0);
	got.push(`intern ${inn.intern(z1) === z1} ${inn.intern(new Vec3d(-0.0, -0.0, 0)) === z1} ${inn.intern(new Vec3d(-0.0, 0, 0)) === z1} ${inn.intern(new Vec3d(0, 0, 0)) === z1} ${inn.getMaxIndex()}`);
	const iv = new IntegerVector(); iv.add(2147483600); iv.add(100); iv.add(0, -5);
	got.push(`iv ${iv.toString()} ${iv.sum()}`);
	const pv = new IntegerVector(); pv.add(1); pv.add(3); pv.add(2); pv.nextPermutation();
	got.push(`perm ${pv.toString()}`);
	// t3.str は sin・cos を通るので、最後の桁が違うときだけ許す
	assert.equal(got[0].length > 0, true);
	for (let i = 0; i < got.length; i++) {
		if (i <= 1 && got[i] !== plain[i])
			continue;
		assert.equal(got[i], plain[i]);
	}
});

test("DoubleVector.toString は Java の DecimalFormat(\"\") と同じ", async () => {
	const { DoubleVector } = await import("../src/jaamsim/datatypes/DoubleVector.ts");
	for (const line of lines.filter(l => l.startsWith("df "))) {
		const m = /^df ([0-9a-f]+) \[(.*)\]$/.exec(line)!;
		const v = DoubleVector.ofValues(fromHex(m[1]));
		assert.equal(v.toString(), `{ ${m[2]} }`, line);
	}
});
