/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
 * 事象の管理（Java 版 com.jaamsim.events.EventManager を移したもの）。
 *
 * Java 版はスレッドで「待つ」処理（waitTicks・waitUntil）にも対応しているが、部品の側は使っていない
 * （すべて scheduleTicks などの予約で書かれている）。そこでスレッドは持たず、
 * - startProcess・interruptEvent は、その場で process() を呼ぶ（Java 版も、呼んだ側は終わるまで待つ）
 * - 事象の順番は Java 版と同じ: 時刻 → 優先度（小さい方が先）→ 同じなら FIFO は後ろへ・LIFO は前へ
 * - 条件つきの事象（scheduleUntil）は、時刻を進める直前にまとめて調べる
 * 実時間での再生は、呼ぶ側が run() に渡す目標の時刻を少しずつ進めて行う。
 */

export abstract class ProcessTarget {
	abstract getDescription(): string;
	abstract process(): void;
	toString(): string {
		return this.getDescription();
	}
}

export interface Conditional {
	evaluate(): boolean;
}

/** 予約した事象を後から取り消したり、前倒ししたりするための札 */
export class EventHandle {
	/** @internal */
	event: BaseEvent | null = null;

	isScheduled(): boolean {
		return this.event !== null;
	}

	toString(): string {
		return String(this.isScheduled());
	}
}

abstract class BaseEvent {
	target: ProcessTarget | null = null;
	handle: EventHandle | null = null;
}

class Event extends BaseEvent {
	node: EventNode | null = null;
	next: Event | null = null;
}

class ConditionalEvent extends BaseEvent {
	constructor(readonly cond: Conditional, target: ProcessTarget, handle: EventHandle | null) {
		super();
		this.target = target;
		this.handle = handle;
	}
}

class EventNode {
	head: Event | null = null;
	tail: Event | null = null;
	removed = false;

	constructor(readonly schedTick: number, readonly priority: number) {}

	addEvent(e: Event, fifo: boolean): void {
		if (this.head === null) {
			this.head = e;
			this.tail = e;
			e.next = null;
			return;
		}
		if (fifo) {
			this.tail!.next = e;
			this.tail = e;
			e.next = null;
		}
		else {
			e.next = this.head;
			this.head = e;
		}
	}

	removeEvent(evt: Event): void {
		if (this.head === evt) {
			this.head = evt.next;
			if (evt.next === null)
				this.tail = null;
			return;
		}
		let prev = this.head!;
		while (prev.next !== evt)
			prev = prev.next!;
		prev.next = evt.next;
		if (evt.next === null)
			this.tail = prev;
	}
}

function nodeLess(a: EventNode, b: EventNode): boolean {
	if (a.schedTick !== b.schedTick)
		return a.schedTick < b.schedTick;
	return a.priority < b.priority;
}

/** 時刻と優先度で並べた事象の束の集まり（Java 版は赤黒木。ここはヒープと表で同じ順番を作る） */
class EventTree {
	private heap: EventNode[] = [];
	private byKey = new Map<string, EventNode>();

	private static key(tick: number, prio: number): string {
		return tick + ":" + prio;
	}

	createOrFindNode(tick: number, prio: number): EventNode {
		const k = EventTree.key(tick, prio);
		let node = this.byKey.get(k);
		if (node !== undefined)
			return node;
		node = new EventNode(tick, prio);
		this.byKey.set(k, node);
		this.push(node);
		return node;
	}

	removeNode(node: EventNode): boolean {
		const k = EventTree.key(node.schedTick, node.priority);
		if (this.byKey.get(k) !== node)
			return false;
		this.byKey.delete(k);
		node.removed = true;  // ヒープからは、先頭に来たときに捨てる
		return true;
	}

	getNextNode(): EventNode | null {
		while (this.heap.length > 0 && this.heap[0].removed)
			this.pop();
		return this.heap.length > 0 ? this.heap[0] : null;
	}

	nodes(): EventNode[] {
		return [...this.byKey.values()].sort((a, b) => (nodeLess(a, b) ? -1 : nodeLess(b, a) ? 1 : 0));
	}

	reset(): void {
		this.heap = [];
		this.byKey.clear();
	}

	private push(n: EventNode): void {
		const h = this.heap;
		h.push(n);
		let i = h.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (!nodeLess(h[i], h[p]))
				break;
			[h[i], h[p]] = [h[p], h[i]];
			i = p;
		}
	}

	private pop(): void {
		const h = this.heap;
		const last = h.pop()!;
		if (h.length === 0)
			return;
		h[0] = last;
		let i = 0;
		for (;;) {
			const l = 2 * i + 1, r = l + 1;
			let m = i;
			if (l < h.length && nodeLess(h[l], h[m])) m = l;
			if (r < h.length && nodeLess(h[r], h[m])) m = r;
			if (m === i)
				break;
			[h[i], h[m]] = [h[m], h[i]];
			i = m;
		}
	}
}

export class ProcessError extends Error {}

/** 時刻の進み・誤りを受け取る相手（Java 版 EventTimeListener） */
export interface EventTimeListener {
	tickUpdate(tick: number): void;
	timeRunning(): void;
	handleError(t: unknown): void;
}

const noopListener: EventTimeListener = {
	tickUpdate() {},
	timeRunning() {},
	handleError() {},
};

/** 内部の時刻の上限（Java 版の Long.MAX_VALUE の代わり。2^53 - 1） */
export const MAX_TICK = Number.MAX_SAFE_INTEGER;

let currentManager: EventManager | null = null;
let scheduleDisabled = false;

export class EventManager {
	private readonly eventTree = new EventTree();
	private readonly condEvents: ConditionalEvent[] = [];

	private currentTick = 0;
	private nextTick = 0;
	private targetTick = MAX_TICK;
	private executeEvents = false;
	private running = false;
	private oneEvent = false;
	private oneSimTime = false;

	private ticksPerSecond = 0;
	private secsPerTick = 0;

	private timelistener: EventTimeListener = noopListener;

	constructor(readonly name: string) {
		this.setTickLength(1e-6);
	}

	setTimeListener(l: EventTimeListener | null): void {
		this.timelistener = l ?? noopListener;
	}

	clear(): void {
		this.currentTick = 0;
		this.nextTick = 0;
		this.oneEvent = false;
		this.oneSimTime = false;
		this.targetTick = MAX_TICK;
		for (const node of this.eventTree.nodes()) {
			for (let e = node.head; e !== null; e = e.next) {
				if (e.handle !== null) {
					e.handle.event = null;
					e.handle = null;
				}
			}
		}
		this.eventTree.reset();
		for (const c of this.condEvents) {
			if (c.handle !== null)
				c.handle.event = null;
		}
		this.condEvents.length = 0;
	}

	// ---- 実行 ----

	/**
	 * 目標の時刻（tick）まで事象を実行する。事象が無くなるか、目標に着くか、pause() で止まる。
	 * Java 版 resumeTicks + execute の、スレッドを除いたもの。
	 */
	resumeTicks(targetTicks: number, doOneEvent = false, doOneTime = false): void {
		if (doOneEvent)
			this.oneEvent = true;
		if (doOneTime)
			this.oneSimTime = true;
		if (this.currentTick < targetTicks)
			this.targetTick = targetTicks;
		else
			this.targetTick = MAX_TICK;
		this.executeEvents = true;
		this.execute();
	}

	resumeSeconds(simTime: number, doOneEvent = false, doOneTime = false): void {
		this.resumeTicks(this.secondsToNearestTick(simTime), doOneEvent, doOneTime);
	}

	pause(): void {
		this.executeEvents = false;
	}

	isRunning(): boolean {
		return this.running;
	}

	private execute(): void {
		const prev = currentManager;
		currentManager = this;
		this.running = true;
		this.timelistener.timeRunning();
		try {
			for (;;) {
				const nextNode = this.eventTree.getNextNode();
				if (nextNode === null || this.currentTick >= this.targetTick)
					this.executeEvents = false;

				if (!this.executeEvents)
					break;

				// 次の事象が今の時刻なら実行する
				if (nextNode!.schedTick === this.currentTick) {
					const nextEvent = nextNode!.head!;
					const nextTarget = nextEvent.target!;
					this.removeEvent(nextEvent);
					if (this.oneEvent) {
						this.oneEvent = false;
						this.executeEvents = false;
					}
					if (!this.executeTarget(nextTarget))
						break;
					continue;
				}

				// 時刻を進める前に、条件つきの事象を調べる
				if (nextNode!.schedTick > this.nextTick) {
					if (this.condEvents.length > 0) {
						this.evaluateConditions();
						if (!this.executeEvents)
							continue;
					}
					this.nextTick = this.eventTree.getNextNode()!.schedTick;
					if (this.nextTick === this.currentTick)
						continue;
					if (this.oneSimTime) {
						this.executeEvents = false;
						this.oneSimTime = false;
						continue;
					}
				}

				// 次の事象の時刻へ進める
				if (this.targetTick < this.nextTick)
					this.currentTick = this.targetTick;
				else
					this.currentTick = this.nextTick;
				this.timelistener.tickUpdate(this.currentTick);
			}
		}
		finally {
			this.running = false;
			currentManager = prev;
		}
		this.timelistener.timeRunning();
	}

	/** 処理を実行する。誤りが起きたら止めて false を返す */
	private executeTarget(t: ProcessTarget): boolean {
		try {
			t.process();
			return true;
		}
		catch (e) {
			this.executeEvents = false;
			this.timelistener.handleError(e);
			return false;
		}
	}

	private evaluateConditions(): void {
		scheduleDisabled = true;
		try {
			for (let i = 0; i < this.condEvents.length;) {
				const c = this.condEvents[i];
				if (c.cond.evaluate()) {
					this.condEvents.splice(i, 1);
					const node = this.eventTree.createOrFindNode(this.currentTick, 0);
					const evt = new Event();
					evt.node = node;
					evt.target = c.target;
					evt.handle = c.handle;
					if (evt.handle !== null)
						evt.handle.event = evt;
					node.addEvent(evt, true);
					continue;
				}
				i++;
			}
		}
		catch (e) {
			this.executeEvents = false;
			this.timelistener.handleError(e);
		}
		finally {
			scheduleDisabled = false;
		}
	}

	private removeEvent(evt: Event): void {
		const node = evt.node!;
		node.removeEvent(evt);
		if (node.head === null) {
			if (!this.eventTree.removeNode(node))
				throw new ProcessError("Tried to remove an eventnode that could not be found");
		}
		evt.node = null;
		evt.target = null;
		if (evt.handle !== null) {
			evt.handle.event = null;
			evt.handle = null;
		}
	}

	// ---- 予約（Java 版の static 関数と同じく、実行中の EventManager に対して行う） ----

	static current(): EventManager {
		if (currentManager === null)
			throw new ProcessError("Non-process thread called Process.current()");
		return currentManager;
	}

	static hasCurrent(): boolean {
		return currentManager !== null;
	}

	static canSchedule(): boolean {
		return currentManager !== null && !scheduleDisabled;
	}

	static simTicks(): number {
		return EventManager.current().currentTick;
	}

	static simSeconds(): number {
		return EventManager.current().getSeconds();
	}

	static scheduleTicks(waitLength: number, eventPriority: number, fifo: boolean,
	                     t: ProcessTarget, handle: EventHandle | null): void {
		EventManager.current()._scheduleTicks(waitLength, eventPriority, fifo, t, handle);
	}

	static scheduleSeconds(secs: number, eventPriority: number, fifo: boolean,
	                       t: ProcessTarget, handle: EventHandle | null): void {
		const evt = EventManager.current();
		evt._scheduleTicks(evt.secondsToNearestTick(secs), eventPriority, fifo, t, handle);
	}

	static scheduleUntil(t: ProcessTarget, cond: Conditional, handle: EventHandle | null): void {
		EventManager.current()._schedUntil(t, cond, handle);
	}

	/** 処理をその場で実行する（Java 版は別のスレッドで始め、終わるまで待つ） */
	static startProcess(t: ProcessTarget): void {
		EventManager.current().assertCanSchedule();
		t.process();
	}

	/** 予約した事象を、実行せずに取り消す */
	static killEvent(handle: EventHandle | null): void {
		const em = EventManager.current();
		em.assertCanSchedule();
		if (handle === null || handle.event === null)
			return;
		em.getTargetFromHandle(handle);
	}

	/** 予約した事象を取り消して、その場で実行する */
	static interruptEvent(handle: EventHandle | null): void {
		const em = EventManager.current();
		em.assertCanSchedule();
		if (handle === null || handle.event === null)
			return;
		em.getTargetFromHandle(handle).process();
	}

	/** 実行中でないときに外から予約する（Java 版 scheduleProcessExternal） */
	scheduleProcessExternal(waitLength: number, eventPriority: number, fifo: boolean,
	                        t: ProcessTarget, handle: EventHandle | null): void {
		const schedTick = this.calculateEventTime(waitLength);
		this.addEvent(schedTick, eventPriority, fifo, t, handle);
		const next = this.eventTree.getNextNode()!;
		if (this.nextTick > next.schedTick)
			this.nextTick = next.schedTick;
	}

	private _scheduleTicks(waitLength: number, eventPriority: number, fifo: boolean,
	                       t: ProcessTarget, handle: EventHandle | null): void {
		this.assertCanSchedule();
		this.addEvent(this.calculateEventTime(waitLength), eventPriority, fifo, t, handle);
	}

	private addEvent(schedTick: number, eventPriority: number, fifo: boolean,
	                 t: ProcessTarget, handle: EventHandle | null): void {
		const node = this.eventTree.createOrFindNode(schedTick, eventPriority);
		const evt = new Event();
		evt.node = node;
		evt.target = t;
		evt.handle = handle;
		if (handle !== null) {
			if (handle.isScheduled())
				throw new ProcessError("Tried to schedule using an EventHandle already in use");
			handle.event = evt;
		}
		node.addEvent(evt, fifo);
	}

	private _schedUntil(t: ProcessTarget, cond: Conditional, handle: EventHandle | null): void {
		this.assertCanSchedule();
		const evt = new ConditionalEvent(cond, t, handle);
		if (handle !== null) {
			if (handle.isScheduled())
				throw new ProcessError("Tried to scheduleUntil using a handle already in use");
			handle.event = evt;
		}
		this.condEvents.push(evt);
	}

	private getTargetFromHandle(handle: EventHandle): ProcessTarget {
		const base = handle.event!;
		const t = base.target!;
		handle.event = null;
		base.handle = null;
		if (base instanceof Event) {
			this.removeEvent(base);
		}
		else {
			const i = this.condEvents.indexOf(base as ConditionalEvent);
			if (i >= 0)
				this.condEvents.splice(i, 1);
		}
		return t;
	}

	private calculateEventTime(waitLength: number): number {
		if (waitLength < 0)
			throw new ProcessError("Negative duration wait is invalid, waitLength = " + waitLength);
		const t = this.currentTick + waitLength;
		return t > MAX_TICK ? MAX_TICK : t;
	}

	private assertCanSchedule(): void {
		if (scheduleDisabled)
			throw new ProcessError("Schedule operations are not allowed during conditional evaluation");
	}

	// ---- 時刻 ----

	getTicks(): number {
		return this.currentTick;
	}

	getSeconds(): number {
		return this.currentTick * this.secsPerTick;
	}

	setTickLength(tickLength: number): void {
		this.secsPerTick = tickLength;
		this.ticksPerSecond = Math.round(1e9 / this.secsPerTick) / 1e9;
	}

	/** 秒を、いちばん近い tick に丸める（Java 版と同じ計算） */
	secondsToNearestTick(seconds: number): number {
		// Java の Math.round(double) と JavaScript の Math.round は、.5 の扱い（正の方向へ）も同じ
		const ticks = Math.round(seconds * this.ticksPerSecond);
		return Math.max(-MAX_TICK, Math.min(MAX_TICK, ticks));
	}

	ticksToSeconds(ticks: number): number {
		return ticks * this.secsPerTick;
	}

	/** 予約されている事象の一覧（時刻・優先度・説明） */
	getEventDataList(): { ticks: number; priority: number; description: string }[] {
		const out: { ticks: number; priority: number; description: string }[] = [];
		for (const node of this.eventTree.nodes())
			for (let e = node.head; e !== null; e = e.next)
				out.push({ ticks: node.schedTick, priority: node.priority, description: e.target!.getDescription() });
		return out;
	}

	toString(): string {
		return this.name;
	}
}
