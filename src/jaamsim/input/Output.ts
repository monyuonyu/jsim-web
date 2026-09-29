/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注: Java の注釈 @Output。TS では型だけ（実際には OutputRegistry.ts の defineOutput で登録する。PORTING.md の 6）。
import type { JClass } from "../java/lang.ts";
import type { Unit } from "../units/Unit.ts";

export interface Output {
	name: string;
	description?: string;             // 既定 ""
	unitType?: JClass<Unit>;          // 既定 DimensionlessUnit
	reportable?: boolean;             // 既定 false
	sequence?: number;                // 既定 100（出力を並べる順）
}
