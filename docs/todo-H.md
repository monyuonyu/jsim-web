# まとまり H の TODO

- TimeSeriesThreshold.ts: Java の long の足し算で Long.MAX_VALUE（「もう変わらない」の印）が桁あふれする所（出力 NextOpenTime・NextCloseTime・NextOpenDuration・NextCloseDuration、calcOpenTimeFromTimeToTime）は、longAdd で 2^53-1 を 2^63-1 と見なして Java と同じく折り返した。calcClosedTicksFromTicks・calcOpenTicksFromTicks の中の `ticks + maxTicks (+ lookAhead)` は、どれも有限なので普通の足し算のまま
- Threshold.ts: earlyInit で ThresholdUser を集める所は isThresholdUser（関数の有無）で判定。ProcessFlow/StateUserEntity.ts に `abstract thresholdChanged(): void;` が無いため tsc が StateUserEntity を ThresholdUser と認めない（実行には影響しない。担当 E への要望）
- ExpressionThreshold.ts・SubModelEnd.ts: Java の catch (Exception e) {} は TS ではすべての例外を捕まえる（Java の Error 系＝StackOverflowError なども捕まえてしまう）
- JSONValue.ts・JSONWriter.ts: Java の HashMap の順番は JavaHashOrder で再現。同じ添え字に 9 個以上たまって木になった場合の順番は再現していない（まず起きない）
- JSONParser.ts: Java の ArrayList.get の範囲の外は IndexOutOfBoundsException を投げるようにした（getTok）。addPiece(null) の後の isElementComplete は Java は NullPointerException、TS は TypeError
- DefineViewCommand.ts: RenderManager.inst().createWindow(view)・FrameBox.setSelectedEntity(view, false) は描画なので省略（ShowWindow の入力は入れる）
- GameEntity.ts: handleKeyPressed・handleMouseClicked は画面の操作から呼ばれる。scheduleProcessExternal の予約は Java と同じ（画面を作るときに呼ぶ側をつなぐ）
