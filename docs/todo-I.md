# まとまり I（CalculationObjects・FluidObjects）の TODO

- Controller.ts: earlyInit の並べ替え。Java の Collections.sort（TimSort）も Array.prototype.sort も安定なので並びは同じだが、比べる回数・順番が違う。SequenceNumber に確率分布など乱数を引くものを使うと、乱数を引く回数が Java と変わる（普通は定数なので効かない）
- WaveGenerator/SineWave・FluidPipe: Math.sin・Math.log10 は JS の関数（最後の 1 桁が Java と違うことがある。PORTING 2 で許されている）
- SquareWave.ts: Math.IEEEremainder は JS に無いので、fdlibm の e_remainder と同じ手順をファイルの中に書いた（試験はしていない）
