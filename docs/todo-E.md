# まとまり E の TODO

- ProbabilityDistributions/GeometricDistribution.ts: getSample の (int) を Math.trunc にした。Java の (int) は範囲外を Integer.MIN/MAX_VALUE に丸め NaN を 0 にするので、p = 0（-Infinity）のときだけ結果が違う
