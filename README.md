# jsim-web

物流・生産の流れを試せる、日本語の離散事象シミュレーター（FlexSim のようなもの）を目指して作っている。
土台は [JaamSim](https://github.com/jaamsim/jaamsim)（Java、Apache-2.0）。これを TypeScript に全部移し、
ブラウザと Electron（Windows・Linux のアプリ）で動かす。

## 今の状態（2026-09-30）

- **計算の部分（画面なし）は移し終えた。** 約 400 ファイル・8 万行。
  JaamSim の例題 91 個を Java 版と TS 版で流し、全部の出力（1 つの例題で数千〜数十万行）を突き合わせて、
  90 個が完全に一致した（残りの 1 個は、TS 版が遅くて試験の時間切れになったもの）。
- **画面はまだ無い。** 次に three.js で 3D の画面を作り、Electron でアプリにする。
- 画面の言葉は最初から日本語（多言語にできる。`src/jaamsim/i18n`）。用語は `docs/glossary-ja.md`（案）。
- 速さは今、Java 版のおよそ半分。

## 動かし方（今できること）

Node.js 22 以降が要る。

```sh
npm install
npm test                                            # 試験
node --import tsx tools/run-model.ts test/models/m1.cfg   # モデル（.cfg）を最後まで流し、結果の出力を表示する
```

JaamSim の `.cfg` ファイルがそのまま読める。部品の定義（`autoload.cfg` など）とアイコンは `resources/` に同梱している
（別の場所のものを使うときは、環境変数 `JAAMSIM_RES` でそのフォルダを指す）。

## 作り方の約束

`docs/PORTING.md` にまとめた（Java の 1 ファイル → TypeScript の 1 ファイル、名前は Java と同じ、
数の文字列化は Java と同じ結果になるようにする、など）。
Java 版と結果を比べる道具は `ref/`（Java 側）と `tools/`（`cmp-examples.sh` で例題を全部比べる）。

## ライセンス

Apache License 2.0（`LICENSE`）。JaamSim の著作権表示は `NOTICE` と各ファイルの先頭に残している。

## 送る情報

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

- AI チャットは、同梱の Claude Agent SDK（claude）で動く。利用者が自分の Anthropic の API キーを入れて依頼を送った時だけ、依頼の文と、AI が道具で読んだモデルの内容を Anthropic の API（api.anthropic.com）に送る。扱いは [Anthropic のプライバシーポリシー](https://www.anthropic.com/legal/privacy)による
- AI チャットを使わなければ、何も送らない。更新の確認などの通信もしない
- API キーは、この PC の利用者のデータの場所に、OS の鍵の仕組みで暗号にして置く（「API キー…」から消せる）
