# 日本語の用語集（案）

画面の日本語は、この表に合わせる。物流・生産の現場で通じる言葉を優先し、カタカナ語は定着しているものだけ使う。
（案の段階。本人が触ってみて、しっくり来ない言葉は直す）

## 部品の種類（ObjectType）

| 英語 | 日本語 | メモ |
|---|---|---|
| SimEntity | 品物 | 流れる物（部品・荷物・人）。FlexSim の「フローアイテム」 |
| EntityGenerator | 発生 | 品物を作り出す |
| EntitySink | 出口 | 品物を消す |
| Queue | 待ち行列 | |
| Server | 作業台 | 品物を 1 つずつ処理する |
| EntityDelay | 移動（遅れ） | 決まった時間をかけて運ぶ |
| EntityConveyor | コンベヤ | |
| Branch | 分岐 | |
| Assign | 属性の設定 | |
| Seize / Release | 資源を確保 / 資源を解放 | |
| Resource / ResourcePool | 資源 / 資源の組 | 作業者・フォークリフトなど |
| Combine / Pack / Unpack | 組み合わせ / 梱包 / 開梱 | |
| Duplicate | 複製 | |
| EntityGate | ゲート | |
| EntitySignal | 信号 | |
| Statistics | 統計 | |
| DowntimeEntity | 停止（故障・保全） | |
| TimeSeries | 時系列 | |
| ExpressionLogger | 記録 | |

## 画面

| 英語 | 日本語 |
|---|---|
| Model Builder | 部品の一覧 |
| Object Selector | オブジェクトの一覧 |
| Input Editor | 入力の編集 |
| Output Viewer | 出力 |
| Keyword | 項目 |
| Default | 既定値 |
| Value | 値 |
| Run Duration | 実行時間 |
| Initialization Duration | 助走期間（ウォームアップ） |
| Replication | 反復 |
| Scenario | シナリオ |
| Real Time | 実時間 |
| Pause Time | 一時停止の時刻 |

## 統計・出力

| 英語 | 日本語 |
|---|---|
| NumberAdded | 受け入れた数 |
| NumberProcessed | 処理した数 |
| NumberInProgress | 処理中の数 |
| Utilisation | 稼働率 |
| Working / Idle / Blocked / Stopped | 稼働 / 手待ち / 詰まり / 停止 |
| AverageQueueTime | 平均の待ち時間 |
| QueueLength | 待ちの長さ |
| SampleAverage / SampleMinimum / SampleMaximum | 平均 / 最小 / 最大 |
| StandardDeviation | 標準偏差 |

## 確率分布

正規分布・一様分布・指数分布・三角分布・ガンマ分布・ワイブル分布・対数正規分布・離散分布・ポアソン分布・ベータ分布・アーラン分布 …（数学の標準の訳）

## 決まりごと

- 名前（キーワード名・出力名・部品の種類）は、画面では「日本語（英語の名前）」の形も選べるようにする（ファイルや式の中では英語の名前を使うため）。
- 単位の記号（s、min、h、m、kg）は訳さない。
- 文は「です・ます」にしない（画面の短い文は言い切りの形）。誤りのメッセージは「〜できません」「〜が要ります」の形。
