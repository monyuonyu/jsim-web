/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2023 JaamSim Software Inc.
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

// 移植のメモ:
// - 画面を撮る・動画や PNG を書く所（RenderManager・VideoRecorder・JOptionPane）は描画なので移さない（PORTING 7）。
//   入力と、撮る時刻の予約（事象の順番）は Java と同じにしてある。
// - Java の doCaptureNetwork はスレッドで EventManager.waitSeconds を使って待つ。TS の EventManager には待つ書き方が
//   無いので、待った後の続きを同じ時刻・同じ優先度（PRI_LOW）・LIFO・同じ札（captureHandle）で予約する
//   （doCaptureNetwork → beginCapture → captureFrame の繰り返し）。
// - 入れ子のクラス CaptureNetworkTarget は同じファイルの VideoRecorderEntity_CaptureNetworkTarget。
//   待った後の続きのために VideoRecorderEntity_BeginCaptureTarget と VideoRecorderEntity_CaptureFrameTarget を足した。
import { Double } from "../internal.ts";
import { Entity } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { View } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { IntegerVector } from "../internal.ts";
import { EventHandle } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import { BooleanInput } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { EntityListInput } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { IntegerListInput } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

export class VideoRecorderEntity extends DisplayEntity {

	private readonly captureStartTime: SampleInput;

	private readonly captureInterval: SampleInput;

	private readonly captureFrames: SampleInput;

	private readonly captureArea: IntegerListInput;

	private readonly captureViews: EntityListInput<View>;

	private readonly videoBGColor: ColourProvInput;

	private readonly videoName: StringInput;

	private readonly saveImages: BooleanInput;

	private readonly saveVideo: BooleanInput;

	private hasRunStartup = false;
	private numFramesWritten = 0;
	private readonly captureHandle = new EventHandle();

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as VideoRecorderEntity).updateInputValue();
		},
	};

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.attributeDefinitionList.setHidden(true);

		this.captureStartTime = new SampleInput("CaptureStartTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.captureStartTime, "Simulation time at which to capture the first frame.",
				["200 h"]);
		this.captureStartTime.setUnitType(TimeUnit);
		this.captureStartTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.captureStartTime);

		this.captureInterval = new SampleInput("CaptureInterval", Entity.KEY_INPUTS, 3600.0);
		this.setKeywordDoc(this.captureInterval, "Simulation time between captured frames.",
				["60 s"]);
		this.captureInterval.setUnitType(TimeUnit);
		this.captureInterval.setValidRange(0.1, Double.POSITIVE_INFINITY);
		this.addInput(this.captureInterval);

		this.captureFrames = SampleInput.ofInt("CaptureFrames", Entity.KEY_INPUTS, 0);
		this.setKeywordDoc(this.captureFrames, "Total number of frames to capture for the video.\n"
		                     + "The recorded video assumes 30 frames per second. Therefore, if a "
		                     + "2 minute video is required, the number of frames should be set to "
		                     + "120 x 30 = 3600.",
				["3600"]);
		this.captureFrames.setValidRange(0, 30000);
		this.captureFrames.setIntegerValue(true);
		this.addInput(this.captureFrames);

		const defArea = new IntegerVector(2);
		defArea.add(1920);
		defArea.add(1080);
		this.captureArea = new IntegerListInput("CaptureArea", Entity.KEY_INPUTS, defArea);
		this.setKeywordDoc(this.captureArea, "The size of the video/image, expressed as the number of horizontal "
		                     + "and vertical pixels.\n"
		                     + "The top left hand corner of the captured frames will be the same as "
		                     + "the top left hand corner of the image on the monitor. If the "
		                     + "specified image size is larger than the monitor resolution, then the "
		                     + "image will be extented beyond the bottom and/or right sides of the "
		                     + "monitor.",
				["1920 1080"]);
		this.captureArea.setValidCount(2);
		this.captureArea.setValidRange(0, 3000);
		this.addInput(this.captureArea);

		this.captureViews = new EntityListInput<View>(View, "CaptureViews", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.captureViews, "The list of View windows to be captured.", []);
		this.captureViews.setRequired(true);
		this.addInput(this.captureViews);

		this.videoBGColor = new ColourProvInput("VideoBackgroundColor", Entity.KEY_INPUTS, ColourInput.WHITE);
		this.setKeywordDoc(this.videoBGColor, "The background color for the captured frames.\n"
		                     + "Only the 3D view portion of the specified windows will be captured. "
		                     + "The remainder of the frame, such as the Control Panel or any gaps "
		                     + "between the view windows, will be replaced by the background color.", []);
		this.addInput(this.videoBGColor);
		this.addSynonym(this.videoBGColor, "Colour");

		this.videoName = new StringInput("VideoName", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.videoName, "A label to append to the run name when the AVI file is saved.\n"
		                     + "The saved file will be named <run name>_<VideoName>.avi.",
				["video"]);
		this.addInput(this.videoName);

		this.saveImages = new BooleanInput("SaveImages", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.saveImages, "If TRUE, an individual PNG file will be saved for each frame.", []);
		this.addInput(this.saveImages);

		this.saveVideo = new BooleanInput("SaveVideo", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.saveVideo, "If TRUE, an AVI file containing the video will be saved.\n"
		                     + "The AVI file will be encoded using the VP8 codec, which is NOT "
		                     + "supported by Windows Media Player. Furthermore, the present encoding "
		                     + "algorithm is quite inefficient making the file size much larger than "
		                     + "necessary. Both problems can be solved by recoding the video using "
		                     + "free open-source software such as HandBrake (https://handbrake.fr/).", []);
		this.saveVideo.setCallback(VideoRecorderEntity.inputCallback);
		this.addInput(this.saveVideo);
	}

	override validate(): void {
		super.validate();

		if( ( this.saveImages.getValue() || this.saveVideo.getValue() ) && (this.captureViews.getValue() as View[]).length === 0 )
			throw new InputErrorException( tr("CaptureViews must be set when SaveImages or SaveVideo is TRUE") );
	}

	override earlyInit(): void {
		super.earlyInit();

		this.hasRunStartup = false;
		this.numFramesWritten = 0;
	}

	override startUp(): void {
		super.startUp();

		if (this.saveVideo.getValue() || this.saveImages.getValue())
			EventManager.startProcess(new VideoRecorderEntity_CaptureNetworkTarget(this));

		this.hasRunStartup = true;
	}

	updateInputValue(): void {
		// Start the capture if we are already running and we set the input to true
		if (this.hasRunStartup && this.saveVideo.getValue())
			EventManager.scheduleTicks(0, Entity.PRI_LOW, Entity.EVT_LIFO, new VideoRecorderEntity_CaptureNetworkTarget(this), null);
	}

	/**
	 * Capture JPEG images of the screen at regular simulated intervals
	 */
	doCaptureNetwork(): void {
		const simTime = EventManager.simSeconds();
		const startTime = this.captureStartTime.getNextSample(this, simTime);

		// If the capture network is already in progress, then stop the previous network
		EventManager.killEvent(this.captureHandle);
		// Java: EventManager.waitSeconds(startTime, PRI_LOW, EVT_LIFO, captureHandle) の後に続きを実行する。
		// TODO(移植): Java の waitSeconds は待っている処理の事象で、事象の説明が違う（事象の記録・照合の結果が変わる）
		EventManager.scheduleSeconds(startTime, Entity.PRI_LOW, Entity.EVT_LIFO,
				new VideoRecorderEntity_BeginCaptureTarget(this, simTime), this.captureHandle);
	}

	/**
	 * doCaptureNetwork の、最初の待ちの後の続き（simTime は Java と同じく doCaptureNetwork を始めた時刻）
	 */
	beginCapture(simTime: number): void {
		const simModel = this.getJaamSimModel();

		// 描画: 省略（three.js の画面を作るときに）
		// Java: RenderManager が無ければ初期化し、画面の外に描けなければ
		// "Your hardware does not support Video Recording." を出して終わる。
		// TODO(移植): 画面を撮れないとき（Java で canRenderOffscreen が false）の打ち切りは、撮る所を作るときに入れる

		const width = this.captureArea.getValue()!.get(0);
		const height = this.captureArea.getValue()!.get(1);

		const views = this.captureViews.getValue() as View[];

		const fileName = simModel.getReportFileName("_" + this.videoName.getValue());
		// 描画: 省略（Java は fileName が null なら "Cannot create the file for the Video Recording." を出す）
		const backgroundCol = this.videoBGColor.getNextColour(this, simTime);
		const numFrames = jint(this.captureFrames.getNextSample(this, simTime));
		// 描画: 省略（three.js の画面を作るときに）
		// Java: new VideoRecorder(views, fileName, width, height, numFrames, saveImages, saveVideo, backgroundCol)
		void width; void height; void views; void fileName; void backgroundCol;

		this.captureFrame(simTime, numFrames);
	}

	/**
	 * doCaptureNetwork の while の 1 回分（待ちの後にここへ戻る）
	 */
	captureFrame(simTime: number, numFrames: number): void {
		// Otherwise, start capturing
		if (!(this.saveVideo.getValue() || this.saveImages.getValue())) {
			// 描画: 省略（Java: recorder.freeResources()）
			return;
		}

		// 描画: 省略（Java: RenderManager.inst().blockOnScreenShot(recorder)）
		++this.numFramesWritten;

		if (this.numFramesWritten === numFrames) {
			// 描画: 省略（Java: recorder.freeResources()）
			return;
		}

		// Wait until the next time to capture a frame
		// (priority 10 is used to allow higher priority events to complete first)
		const interval = this.captureInterval.getNextSample(this, simTime);
		// Java: EventManager.waitSeconds(interval, PRI_LOW, EVT_LIFO, captureHandle)
		EventManager.scheduleSeconds(interval, Entity.PRI_LOW, Entity.EVT_LIFO,
				new VideoRecorderEntity_CaptureFrameTarget(this, simTime, numFrames), this.captureHandle);
	}
}

class VideoRecorderEntity_CaptureNetworkTarget extends ProcessTarget {
	readonly rec: VideoRecorderEntity;

	constructor(rec: VideoRecorderEntity) {
		super();
		this.rec = rec;
	}

	override getDescription(): string {
		return this.rec.getName() + ".doCaptureNetwork";
	}

	override process(): void {
		this.rec.doCaptureNetwork();
	}
}

/** Java には無い（waitSeconds の後の続きの代わり） */
class VideoRecorderEntity_BeginCaptureTarget extends ProcessTarget {
	readonly rec: VideoRecorderEntity;
	readonly simTime: number;

	constructor(rec: VideoRecorderEntity, simTime: number) {
		super();
		this.rec = rec;
		this.simTime = simTime;
	}

	override getDescription(): string {
		return this.rec.getName() + ".doCaptureNetwork";
	}

	override process(): void {
		this.rec.beginCapture(this.simTime);
	}
}

/** Java には無い（while の中の waitSeconds の後の続きの代わり） */
class VideoRecorderEntity_CaptureFrameTarget extends ProcessTarget {
	readonly rec: VideoRecorderEntity;
	readonly simTime: number;
	readonly numFrames: number;

	constructor(rec: VideoRecorderEntity, simTime: number, numFrames: number) {
		super();
		this.rec = rec;
		this.simTime = simTime;
		this.numFrames = numFrames;
	}

	override getDescription(): string {
		return this.rec.getName() + ".doCaptureNetwork";
	}

	override process(): void {
		this.rec.captureFrame(this.simTime, this.numFrames);
	}
}

ClassRegistry.register("com.jaamsim.ui.VideoRecorderEntity", VideoRecorderEntity);
