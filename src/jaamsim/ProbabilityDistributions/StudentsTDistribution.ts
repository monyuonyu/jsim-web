/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021 JaamSim Software Inc.
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
 * Java の Arrays.binarySearch(int[], int) と同じ結果（同じ値が複数あるときの位置も同じ）。
 * 見つからなければ -(挿入位置 + 1)。
 */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];
		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else
			return mid; // key found
	}
	return -(low + 1);  // key not found.
}

export class StudentsTDistribution {

	private static degreesOfFreedom: number[] = [
			     1,     2,     3,     4,     5,     6,     7,     8,     9,    10,
			    11,    12,    13,    14,    15,    16,    17,    18,    19,    20,
			    21,    22,    23,    24,    25,    26,    27,    28,    29,    30,
			    40,    50,    60,    80,   100,   120];

	private static confidenceIntervalFactor95: number[] = [
			12.710, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
			 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
			 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
			 2.021, 2.009, 2.000, 1.990, 1.984, 1.980, 1.960];

	/**
	 * Return the Student's T factor corresponding to a 95% confidence interval for the specified
	 * number of degrees of freedom.
	 * Adapted from the Wikipedia article "Student's t-distribution", downloaded July 1, 2021.
	 * @param n - degrees of freedom（Java の int）
	 * @return factor for a 95% confidence interval
	 */
	static getConfidenceIntervalFactor95(n: number): number {
		const k = binarySearch(StudentsTDistribution.degreesOfFreedom, n);
		const index = (k >= 0) ? k : -k - 1;
		return StudentsTDistribution.confidenceIntervalFactor95[index];
	}

}
