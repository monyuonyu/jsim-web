/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2022 JaamSim Software Inc.
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

/**
 * L'Ecuyer (1999a) の複合 MRG。Java 版（com.jaamsim.rng.MRG1999a）と同じ数の列を出す。
 *
 * 乱数を 1 つ作る計算（nextUniform）は、途中の値が 2^53 未満に収まるので普通の数で正確に計算できる。
 * 種を進める計算（advanceStream など）は 64 ビットの掛け算が要るので BigInt で行う（種を決めるときだけ）。
 */
const m1 = 4294967087;
const m2 = 4294944443;
const norm = 2.328306549295727688e-10; // 1.0 / (m1 + 1)

const M1 = 4294967087n;
const M2 = 4294944443n;

const streamAdvance: bigint[][] = [
	[2427906178n, 3580155704n, 949770784n],
	[226153695n, 1230515664n, 3580155704n],
	[1988835001n, 986791581n, 1230515664n],
	[1464411153n, 277697599n, 1610723613n],
	[32183930n, 1464411153n, 1022607788n],
	[2824425944n, 32183930n, 2093834863n],
];

const substreamAdvance: bigint[][] = [
	[82758667n, 1871391091n, 4127413238n],
	[3672831523n, 69195019n, 1871391091n],
	[3672091415n, 3528743235n, 69195019n],
	[1511326704n, 3759209742n, 1610795712n],
	[4292754251n, 1511326704n, 3889917532n],
	[3859662829n, 4292754251n, 3708466080n],
];

const seedCacheSize = 20;
const seedCacheIncrement = 5000;

// 種の表（advanceStream を seedCacheIncrement 回ずつ進めたもの）。Java 版は起動時に全部作るが、ここは使うときに作る
const seedCache: bigint[][] = [[12345n, 12345n, 12345n, 12345n, 12345n, 12345n]];

function cachedSeeds(idx: number): bigint[] {
	while (seedCache.length <= idx) {
		const seeds = seedCache[seedCache.length - 1].slice();
		for (let i = 0; i < seedCacheIncrement; i++)
			advanceStream(seeds);
		seedCache.push(seeds);
	}
	return seedCache[idx].slice();
}

function mixHalf1(a: bigint[], s: bigint[]): bigint {
	let tmp = (a[0] * s[0]) % M1;
	tmp = (a[1] * s[1] + tmp) % M1;
	tmp = (a[2] * s[2] + tmp) % M1;
	return tmp;
}

function mixHalf2(a: bigint[], s: bigint[]): bigint {
	let tmp = (a[0] * s[3]) % M2;
	tmp = (a[1] * s[4] + tmp) % M2;
	tmp = (a[2] * s[5] + tmp) % M2;
	return tmp;
}

function advance(table: bigint[][], seeds: bigint[]): void {
	const s0 = mixHalf1(table[0], seeds);
	const s1 = mixHalf1(table[1], seeds);
	const s2 = mixHalf1(table[2], seeds);
	const s3 = mixHalf2(table[3], seeds);
	const s4 = mixHalf2(table[4], seeds);
	const s5 = mixHalf2(table[5], seeds);
	seeds[0] = s0; seeds[1] = s1; seeds[2] = s2;
	seeds[3] = s3; seeds[4] = s4; seeds[5] = s5;
}

export function advanceStream(seeds: bigint[]): void {
	advance(streamAdvance, seeds);
}

export function advanceSubstream(seeds: bigint[]): void {
	advance(substreamAdvance, seeds);
}

export class MRG1999a {
	// 内部の状態（0 以上 2^32 未満の数）
	private s0 = 0; private s1 = 0; private s2 = 0;
	private s3 = 0; private s4 = 0; private s5 = 0;

	private stream = -1;
	private substream = 0;
	private initSeeds: bigint[] = [];

	constructor(stream = 0, substream = 0) {
		this.setSeedStream(stream, substream);
	}

	static fromSeeds(s0: number, s1: number, s2: number, s3: number, s4: number, s5: number): MRG1999a {
		const r = new MRG1999a();
		r.setSeed(s0, s1, s2, s3, s4, s5);
		return r;
	}

	getStreamNumber(): number {
		return this.stream;
	}

	setSeedStream(stream: number, substream: number): void {
		if (stream < 0)
			throw new Error("Stream numbers must be positive");
		if (substream < 0)
			throw new Error("Substream numbers must be positive");

		let seeds: bigint[];
		let initSubstream = 0;

		// 同じ流れなら、保存した部分流から進める
		if (stream === this.stream && substream >= this.substream) {
			initSubstream = this.substream;
			seeds = this.initSeeds.slice();
		}
		else {
			const cacheSeedIdx = Math.min(Math.floor(stream / seedCacheIncrement), seedCacheSize - 1);
			seeds = cachedSeeds(cacheSeedIdx);
			for (let i = cacheSeedIdx * seedCacheIncrement; i < stream; i++)
				advanceStream(seeds);
		}

		for (let i = initSubstream; i < substream; i++)
			advanceSubstream(seeds);

		this.setSeed(Number(seeds[0]), Number(seeds[1]), Number(seeds[2]),
		             Number(seeds[3]), Number(seeds[4]), Number(seeds[5]));

		this.stream = stream;
		this.substream = substream;
		this.initSeeds = seeds;
	}

	setSeed(s0: number, s1: number, s2: number, s3: number, s4: number, s5: number): void {
		if (s0 === 0 && s1 === 0 && s2 === 0)
			throw new Error("The first three seeds cannot all be 0");
		if (s3 === 0 && s4 === 0 && s5 === 0)
			throw new Error("The last three seeds cannot all be 0");
		if (s0 >= m1 || s1 >= m1 || s2 >= m1)
			throw new Error("The first three seeds must be < " + m1);
		if (s3 >= m1 || s4 >= m1 || s5 >= m1)
			throw new Error("The last three seeds must be < " + m2);
		if (s0 < 0 || s1 < 0 || s2 < 0 || s3 < 0 || s4 < 0 || s5 < 0)
			throw new Error("All seeds must be > 0");
		this.s0 = s0; this.s1 = s1; this.s2 = s2;
		this.s3 = s3; this.s4 = s4; this.s5 = s5;
	}

	/** 0 と 1 の間の一様乱数（U(0,1)）を 1 つ返す */
	nextUniform(): number {
		// 途中の値は最大でも約 6.0e15 で、2^53（約 9.0e15）未満なので正確に計算できる
		let p1 = (1403580 * this.s1 - 810728 * this.s0) % m1;
		if (p1 < 0) p1 += m1;
		this.s0 = this.s1; this.s1 = this.s2; this.s2 = p1;

		let p2 = (527612 * this.s5 - 1370589 * this.s3) % m2;
		if (p2 < 0) p2 += m2;
		this.s3 = this.s4; this.s4 = this.s5; this.s5 = p2;

		let p = p1 - p2;
		if (p <= 0) p += m1;
		return p * norm;
	}

	toString(): string {
		return `${this.s0}, ${this.s1}, ${this.s2}, ${this.s3}, ${this.s4}, ${this.s5}`;
	}
}
