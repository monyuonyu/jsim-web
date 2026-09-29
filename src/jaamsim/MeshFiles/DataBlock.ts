/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2015 JaamSim Software Inc.
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

/*
 * 名前の付いたバイナリのデータの塊（3D の形の保存に使う）。バイトの並びは Java と同じく上位が先（big-endian）。
 * Java の入れ子のクラス DataBlock.Error は DataBlock_Error（DataBlock.Error でも引ける）。
 */
import { Mat4d } from "../internal.ts";

export class DataBlock_Error extends Error {}

export class DataBlock {
	static Error = DataBlock_Error;

	private readonly name: string;
	private readonly data: Uint8Array;
	private readonly view: DataView;
	private dataSize = 0;
	private readPos = 0;
	private readonly children: DataBlock[];

	/** new DataBlock(名前, 大きさ) で空の塊を、new DataBlock(名前, バイト列, 子の一覧) でファイルから読んだ塊を作る */
	constructor(name: string, bufferSizeOrData: number | Uint8Array, children?: DataBlock[]) {
		this.name = name;
		if (typeof bufferSizeOrData === "number") {
			this.data = new Uint8Array(bufferSizeOrData);
			this.children = [];
		}
		else {
			this.data = bufferSizeOrData;
			this.children = children ?? [];
			this.dataSize = bufferSizeOrData.length;
		}
		this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
	}

	getDataSize(): number { return this.dataSize; }

	setReadPosition(pos: number): void {
		if (pos > this.dataSize)
			throw new DataBlock_Error("Read set past end of block");
		this.readPos = pos;
	}

	getReadPosition(): number { return this.readPos; }
	atEnd(): boolean { return this.readPos === this.dataSize; }
	getData(): Uint8Array { return this.data; }
	getChildren(): DataBlock[] { return this.children; }
	addChildBlock(child: DataBlock): void { this.children.push(child); }
	getName(): string { return this.name; }

	private checkWriteSize(newSize: number): void {
		if (this.dataSize + newSize > this.data.length)
			throw new DataBlock_Error("DataBlock write too large");
	}

	private checkReadSize(newSize: number): void {
		if (this.readPos + newSize > this.dataSize)
			throw new DataBlock_Error("DataBlock read too large");
	}

	writeData(d: Uint8Array): void {
		this.checkWriteSize(d.length);
		this.data.set(d, this.dataSize);
		this.dataSize += d.length;
	}

	writeByte(b: number): void {
		this.checkWriteSize(1);
		this.view.setInt8(this.dataSize++, b);
	}

	writeDouble(d: number): void {
		this.checkWriteSize(8);
		this.view.setFloat64(this.dataSize, d);
		this.dataSize += 8;
	}

	/** Java の long（ここでは 2^53 未満の整数か bigint） */
	writeLong(l: number | bigint): void {
		this.checkWriteSize(8);
		this.view.setBigInt64(this.dataSize, BigInt(l));
		this.dataSize += 8;
	}

	writeFloat(f: number): void {
		this.checkWriteSize(4);
		this.view.setFloat32(this.dataSize, f);
		this.dataSize += 4;
	}

	writeInt(i: number): void {
		this.checkWriteSize(4);
		this.view.setInt32(this.dataSize, i);
		this.dataSize += 4;
	}

	writeString(s: string): void {
		const utf8 = new TextEncoder().encode(s);
		this.checkWriteSize(s.length + 1);  // Java と同じく、文字の数で確かめる（バイトの数ではない）
		this.data.set(utf8, this.dataSize);
		this.dataSize += utf8.length;
		this.data[this.dataSize++] = 0;  // 終わりの 0
	}

	writeMat4d(mat: Mat4d): void {
		this.checkWriteSize(8 * 16);
		this.writeDouble(mat.d00); this.writeDouble(mat.d01); this.writeDouble(mat.d02); this.writeDouble(mat.d03);
		this.writeDouble(mat.d10); this.writeDouble(mat.d11); this.writeDouble(mat.d12); this.writeDouble(mat.d13);
		this.writeDouble(mat.d20); this.writeDouble(mat.d21); this.writeDouble(mat.d22); this.writeDouble(mat.d23);
		this.writeDouble(mat.d30); this.writeDouble(mat.d31); this.writeDouble(mat.d32); this.writeDouble(mat.d33);
	}

	readByte(): number {
		this.checkReadSize(1);
		return this.view.getInt8(this.readPos++);
	}

	readInt(): number {
		this.checkReadSize(4);
		const ret = this.view.getInt32(this.readPos);
		this.readPos += 4;
		return ret;
	}

	readFloat(): number {
		this.checkReadSize(4);
		const ret = this.view.getFloat32(this.readPos);
		this.readPos += 4;
		return ret;
	}

	readLong(): number {
		this.checkReadSize(8);
		const ret = Number(this.view.getBigInt64(this.readPos));
		this.readPos += 8;
		return ret;
	}

	readDouble(): number {
		this.checkReadSize(8);
		const ret = this.view.getFloat64(this.readPos);
		this.readPos += 8;
		return ret;
	}

	readString(): string {
		// 次の 0 を探す（Java と同じ数え方）
		const startPos = this.readPos;
		while (this.readPos++ < this.dataSize) {
			if (this.data[this.readPos] === 0)
				break;
		}
		if (this.readPos === this.dataSize)
			throw new DataBlock_Error("Read string past end of block");
		const size = this.readPos - startPos;
		this.readPos++;  // 0 を飛ばす
		return new TextDecoder("utf-8").decode(this.data.subarray(startPos, startPos + size));
	}

	readMat4d(): Mat4d {
		const ret = new Mat4d();
		ret.d00 = this.readDouble(); ret.d01 = this.readDouble(); ret.d02 = this.readDouble(); ret.d03 = this.readDouble();
		ret.d10 = this.readDouble(); ret.d11 = this.readDouble(); ret.d12 = this.readDouble(); ret.d13 = this.readDouble();
		ret.d20 = this.readDouble(); ret.d21 = this.readDouble(); ret.d22 = this.readDouble(); ret.d23 = this.readDouble();
		ret.d30 = this.readDouble(); ret.d31 = this.readDouble(); ret.d32 = this.readDouble(); ret.d33 = this.readDouble();
		return ret;
	}

	/** この名前の最初の子（無ければ null） */
	findChildByName(name: string): DataBlock | null {
		for (const b of this.children)
			if (b.name === name)
				return b;
		return null;
	}

	toString(): string {
		return this.name;
	}
}
