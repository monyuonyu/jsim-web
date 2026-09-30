/*
 * 真ん中の 3D の作業場（FlexSim のモデルの画面にならう）。
 * 操作: 左ドラッグ = 部品を動かす（何も無い所なら画面を平行に動かす）、右ドラッグ = 回す、ホイール = 寄る・離れる、
 *       A を押しながら部品から部品へドラッグ = つなぐ、Q を押しながら = つなぎを外す、Delete = 消す
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { DisplayEntity, Entity } from "../../src/jaamsim/internal.ts";
import { buildConveyor, buildItem, buildMesh, buildPath } from "./meshes.ts";
import type { ModelOps } from "./model.ts";
import { clsName } from "./model.ts";

/** JaamSim (x, y, z) → three */
const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

interface Visual {
	group: THREE.Group;
	label: CSS2DObject;
	key: string;         // 形を作り直すかの目安（大きさ・点）
}

const STATE_COLORS: Record<string, number> = {
	Idle: 0xe0c000, Working: 0x2fbf4a, Blocked: 0xd04040, Stopped: 0xd04040,
	Setup: 0x3b82f6, Maintenance: 0xf08c00, Breakdown: 0xd04040,
};

export class ModelView {
	readonly renderer: THREE.WebGLRenderer;
	readonly labels: CSS2DRenderer;
	readonly scene = new THREE.Scene();
	readonly camera: THREE.PerspectiveCamera;
	private target = new THREE.Vector3(0, 0, 0);
	private radius = 22;
	private theta = 0;              // 横の角度（0 = 手前（JaamSim の -y）から見る）
	private phi = 0.9;              // 真上からの角度
	private visuals = new Map<Entity, Visual>();
	private items = new Map<Entity, THREE.Object3D>();
	private itemGroup = new THREE.Group();
	private linkGroup = new THREE.Group();
	private selBoxes = new THREE.Group();
	private rubber: THREE.Line;
	selection = new Set<Entity>();
	private keys = new Set<string>();
	private raycaster = new THREE.Raycaster();
	private floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

	onSelect: (sel: Entity[]) => void = () => {};
	onDrop: (defId: string, x: number, y: number) => void = () => {};
	onMessage: (msg: string) => void = () => {};

	constructor(readonly host: HTMLElement, readonly ops: ModelOps) {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		host.appendChild(this.renderer.domElement);
		this.labels = new CSS2DRenderer();
		this.labels.domElement.className = "labels";
		host.appendChild(this.labels.domElement);
		this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);

		// 背景（上が淡い青、下が白に近い）と床
		const c = document.createElement("canvas");
		c.width = 2; c.height = 256;
		const cx = c.getContext("2d")!;
		const grad = cx.createLinearGradient(0, 0, 0, 256);
		grad.addColorStop(0, "#9fb4cc");
		grad.addColorStop(1, "#e9eef3");
		cx.fillStyle = grad;
		cx.fillRect(0, 0, 2, 256);
		this.scene.background = new THREE.CanvasTexture(c);

		const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 1 }));
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		floor.name = "floor";
		this.scene.add(floor);
		const minor = new THREE.GridHelper(200, 200, 0xd3d8de, 0xdde2e7);
		minor.position.y = 0.002;
		this.scene.add(minor);
		const major = new THREE.GridHelper(200, 40, 0xb4bcc5, 0xb4bcc5);
		major.position.y = 0.003;
		this.scene.add(major);

		this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a939c, 1.4));
		const sun = new THREE.DirectionalLight(0xffffff, 1.6);
		sun.position.set(30, 50, 20);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		const s = sun.shadow.camera as THREE.OrthographicCamera;
		s.left = s.bottom = -60; s.right = s.top = 60;
		this.scene.add(sun);

		this.scene.add(this.itemGroup, this.linkGroup, this.selBoxes);
		this.rubber = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x000000 }));
		this.rubber.visible = false;
		this.scene.add(this.rubber);

		new ResizeObserver(() => this.resize()).observe(host);
		this.resize();
		this.bindInput();
	}

	resize(): void {
		const w = this.host.clientWidth, h = this.host.clientHeight;
		this.renderer.setSize(w, h);
		this.labels.setSize(w, h);
		this.camera.aspect = w / Math.max(h, 1);
		this.camera.updateProjectionMatrix();
	}

	private updateCamera(): void {
		const sp = new THREE.Spherical(this.radius, this.phi, this.theta);
		this.camera.position.setFromSpherical(sp).add(this.target);
		this.camera.lookAt(this.target);
	}

	/** 全体が見えるようにする */
	fit(): void {
		const objs = this.ops.visibleObjects();
		if (objs.length === 0) { this.target.set(0, 0, 0); this.radius = 22; return; }
		const box = new THREE.Box3();
		for (const e of objs) {
			const p = e.getPosition();
			box.expandByPoint(toThree(p.x, p.y, 0));
		}
		box.getCenter(this.target);
		const size = box.getSize(new THREE.Vector3());
		this.radius = Math.max(8, Math.max(size.x, size.z * 1.6) * 1.15);
	}

	// ---- モデルと合わせる ----

	/** 部品とつなぎを作り直す（モデルが変わった時） */
	rebuild(): void {
		const alive = new Set<Entity>();
		for (const ent of this.ops.visibleObjects()) {
			alive.add(ent);
			const def = this.ops.defOf(ent)!;
			const size = ent.getSize();
			const pts = def.id === "conveyor" || def.id === "delay" ? this.ops.points(ent) : [];
			const key = `${def.id}|${size.x},${size.y},${size.z}|${JSON.stringify(pts)}`;
			let v = this.visuals.get(ent);
			if (v === undefined || v.key !== key) {
				if (v !== undefined) this.scene.remove(v.group);
				const group = new THREE.Group();
				let body: THREE.Group;
				if (pts.length >= 2) {
					const p0 = ent.getPosition();
					const local = pts.map(p => toThree(p[0] - p0.x, p[1] - p0.y, 0));
					body = def.id === "conveyor" ? buildConveyor(local, size.y, size.z) : buildPath(local);
				}
				else body = buildMesh(def.id, size.x, size.y, size.z);
				body.traverse(o => { o.userData.entity = ent; });
				group.add(body);
				const div = document.createElement("div");
				div.className = "obj-label";
				const label = new CSS2DObject(div);
				label.position.set(0, -0.05, size.y / 2 + 0.35);
				group.add(label);
				this.scene.add(group);
				v = { group, label, key };
				this.visuals.set(ent, v);
			}
			(v.label.element as HTMLElement).textContent = ent.getName();
			const p = ent.getPosition();
			v.group.position.copy(toThree(p.x, p.y, 0));
			const o = ent.getOrientation();
			v.group.rotation.y = o.z;
		}
		for (const [ent, v] of this.visuals) {
			if (!alive.has(ent)) {
				this.scene.remove(v.group);
				v.label.element.remove();
				this.visuals.delete(ent);
				this.selection.delete(ent);
			}
		}
		this.rebuildLinks();
		this.rebuildSelection();
	}

	private rebuildLinks(): void {
		this.linkGroup.clear();
		const mat = new THREE.LineBasicMaterial({ color: 0x202020 });
		for (const [a, b] of this.ops.links()) {
			const pa = this.portPos(a, true), pb = this.portPos(b, false);
			this.linkGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pa, pb]), mat));
			// 送る口（赤）と受ける口（緑）の小さな三角
			const dir = pb.clone().sub(pa).normalize();
			const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 12), new THREE.MeshBasicMaterial({ color: 0x202020 }));
			arrow.position.copy(pb).addScaledVector(dir, -0.14);
			arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
			this.linkGroup.add(arrow);
			const out = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xd03030 }));
			out.position.copy(pa);
			this.linkGroup.add(out);
		}
	}

	/** つなぎの端の位置（送る側は右の端、受ける側は左の端、高さは部品の上） */
	private portPos(e: Entity, out: boolean): THREE.Vector3 {
		const ent = e as DisplayEntity;
		const def = this.ops.defOf(ent)!;
		const pts = def.id === "conveyor" || def.id === "delay" ? this.ops.points(ent) : [];
		const h = Math.max(ent.getSize().z, 0.1) + 0.05;
		if (pts.length >= 2) {
			const p = out ? pts[pts.length - 1] : pts[0];
			return toThree(p[0], p[1], h);
		}
		const p = ent.getPosition();
		const s = ent.getSize();
		return toThree(p.x + (out ? s.x / 2 : -s.x / 2), p.y, h);
	}

	private rebuildSelection(): void {
		this.selBoxes.clear();
		for (const ent of this.selection) {
			const v = this.visuals.get(ent);
			if (v === undefined) continue;
			const b = new THREE.Box3().setFromObject(v.group.children[0]);
			const helper = new THREE.Box3Helper(b.expandByScalar(0.06), 0xf5c400);
			this.selBoxes.add(helper);
		}
	}

	setSelection(ents: Entity[]): void {
		this.selection = new Set(ents);
		this.rebuildSelection();
		this.onSelect([...this.selection]);
	}

	/** 描くたびに: 品物の位置と、作業台のランプの色 */
	syncDynamic(simTime: number, running: boolean): void {
		const ents = this.ops.engine.displayEntities();
		for (const e of ents) {
			try { e.updateGraphics(simTime); } catch { /* 描く前の計算の誤りは描画を止めない */ }
		}
		const alive = new Set<Entity>();
		if (this.ops.engine.state !== "idle") {
			for (const e of ents) {
				if (!e.isGenerated() || clsName(e) !== "SimEntity") continue;
				if (!e.getShow(simTime)) continue;
				alive.add(e);
				let m = this.items.get(e);
				if (m === undefined) {
					const s = e.getSize();
					m = buildItem(s.x, s.y, s.z);
					this.items.set(e, m);
					this.itemGroup.add(m);
				}
				const p = e.getGlobalPosition();
				const s = e.getSize();
				const al = e.getAlignment();
				// 位置合わせ（Alignment）の点が Position にある。three の箱は中心なので直す
				m.position.copy(toThree(p.x - al.x * s.x, p.y - al.y * s.y, p.z - al.z * s.z));
				m.rotation.y = e.getOrientation().z;
			}
		}
		for (const [e, m] of this.items) {
			if (!alive.has(e)) {
				this.itemGroup.remove(m);
				this.items.delete(e);
			}
		}
		for (const [ent, v] of this.visuals) {
			const lamp = v.group.getObjectByName("lamp") as THREE.Mesh | undefined;
			if (lamp === undefined) continue;
			const m = lamp.material as THREE.MeshStandardMaterial;
			let col = 0x888888;
			if (this.ops.engine.state !== "idle") {
				const st = (ent as unknown as { getPresentState?(t: number): string }).getPresentState?.(simTime) ?? "";
				col = STATE_COLORS[st] ?? 0x888888;
			}
			m.color.setHex(col);
			m.emissive.setHex(running || this.ops.engine.state !== "idle" ? col : 0);
			m.emissiveIntensity = 0.6;
		}
	}

	render(): void {
		this.updateCamera();
		this.renderer.render(this.scene, this.camera);
		this.labels.render(this.scene, this.camera);
	}

	// ---- 操作 ----

	private ndc(ev: { clientX: number; clientY: number }): THREE.Vector2 {
		const r = this.renderer.domElement.getBoundingClientRect();
		return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
	}

	/** 画面の点の下の床の位置（JaamSim の x, y） */
	floorAt(ev: { clientX: number; clientY: number }): [number, number] | null {
		this.raycaster.setFromCamera(this.ndc(ev), this.camera);
		const hit = this.raycaster.ray.intersectPlane(this.floor, new THREE.Vector3());
		return hit === null ? null : [hit.x, -hit.z];
	}

	pick(ev: { clientX: number; clientY: number }): Entity | null {
		this.raycaster.setFromCamera(this.ndc(ev), this.camera);
		const objs: THREE.Object3D[] = [];
		for (const v of this.visuals.values()) objs.push(v.group);
		const hits = this.raycaster.intersectObjects(objs, true);
		for (const h of hits) {
			const e = h.object.userData.entity as Entity | undefined;
			if (e !== undefined) return e;
		}
		return null;
	}

	private bindInput(): void {
		const el = this.renderer.domElement;
		el.tabIndex = 0;
		let mode: "none" | "pan" | "rotate" | "move" | "link" | "unlink" = "none";
		let last = { x: 0, y: 0 };
		let start = { x: 0, y: 0 };
		let dragEnt: Entity | null = null;
		let grab: [number, number] = [0, 0];
		let moved = false;

		window.addEventListener("keydown", ev => {
			if ((ev.target as HTMLElement).closest("input, textarea, select")) return;
			this.keys.add(ev.key.toLowerCase());
			if (ev.key === "Delete" || ev.key === "Backspace") {
				for (const e of this.selection) this.ops.remove(e);
				this.setSelection([]);
			}
		});
		window.addEventListener("keyup", ev => this.keys.delete(ev.key.toLowerCase()));
		window.addEventListener("blur", () => this.keys.clear());

		el.addEventListener("contextmenu", ev => ev.preventDefault());
		el.addEventListener("pointerdown", ev => {
			el.focus();
			el.setPointerCapture(ev.pointerId);
			last = start = { x: ev.clientX, y: ev.clientY };
			moved = false;
			if (ev.button === 2 || (ev.button === 0 && ev.altKey)) { mode = "rotate"; return; }
			if (ev.button === 1) { mode = "pan"; return; }
			const hit = this.pick(ev);
			if (hit !== null && (this.keys.has("a") || this.keys.has("q"))) {
				mode = this.keys.has("a") ? "link" : "unlink";
				dragEnt = hit;
				return;
			}
			if (hit !== null) {
				if (ev.ctrlKey || ev.shiftKey) {
					const s = new Set(this.selection);
					if (s.has(hit)) s.delete(hit); else s.add(hit);
					this.setSelection([...s]);
				}
				else if (!this.selection.has(hit)) this.setSelection([hit]);
				mode = "move";
				dragEnt = hit;
				const f = this.floorAt(ev);
				const p = this.ops.position(hit);
				grab = f === null ? [0, 0] : [f[0] - p[0], f[1] - p[1]];
				return;
			}
			mode = "pan";
		});
		el.addEventListener("pointermove", ev => {
			const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
			last = { x: ev.clientX, y: ev.clientY };
			if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 3) moved = true;
			if (mode === "rotate") {
				this.theta -= dx * 0.006;
				this.phi = Math.min(1.5, Math.max(0.05, this.phi - dy * 0.006));
			}
			else if (mode === "pan") {
				const scale = this.radius * 0.0016;
				const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
				const fwd = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
				// 床をつかんで動かす感じ（右へドラッグすると床が右へ、下へドラッグすると手前へ）
				this.target.addScaledVector(right, -dx * scale).addScaledVector(fwd, dy * scale / Math.cos(Math.min(this.phi, 1.2)));
			}
			else if (mode === "move" && dragEnt !== null && moved) {
				const f = this.floorAt(ev);
				if (f === null) return;
				const snap = (v: number) => Math.round(v * 4) / 4;  // 0.25 m ごと
				const nx = snap(f[0] - grab[0]), ny = snap(f[1] - grab[1]);
				const [ox, oy] = this.ops.position(dragEnt);
				if (nx === ox && ny === oy) return;
				for (const e of this.selection) {
					const [x, y] = this.ops.position(e);
					this.ops.move(e, x + nx - ox, y + ny - oy);
				}
				this.rebuild();
			}
			else if ((mode === "link" || mode === "unlink") && dragEnt !== null) {
				const f = this.floorAt(ev);
				if (f === null) return;
				const a = this.portPos(dragEnt, true);
				this.rubber.geometry.setFromPoints([a, toThree(f[0], f[1], a.y)]);
				this.rubber.visible = true;
			}
		});
		el.addEventListener("pointerup", ev => {
			if ((mode === "link" || mode === "unlink") && dragEnt !== null) {
				const to = this.pick(ev);
				if (to !== null && to !== dragEnt) {
					if (mode === "link") {
						const msg = this.ops.connect(dragEnt, to);
						if (msg) this.onMessage(msg);
					}
					else {
						this.ops.disconnect(dragEnt, to);
						this.ops.disconnect(to, dragEnt);
					}
				}
				this.rubber.visible = false;
			}
			if (mode === "pan" && !moved && ev.button === 0) this.setSelection([]);
			if (mode === "move" && moved) this.ops.engine.changed();
			mode = "none";
			dragEnt = null;
		});
		el.addEventListener("wheel", ev => {
			ev.preventDefault();
			// カーソルの下に向かって寄る
			const f = this.floorAt(ev);
			const k = Math.exp(ev.deltaY * 0.0012);
			const nr = Math.min(400, Math.max(2, this.radius * k));
			if (f !== null) {
				const p = toThree(f[0], f[1], 0);
				this.target.lerp(p, 1 - nr / this.radius);
			}
			this.radius = nr;
		}, { passive: false });

		// ライブラリから落とす
		this.host.addEventListener("dragover", ev => { ev.preventDefault(); ev.dataTransfer!.dropEffect = "copy"; });
		this.host.addEventListener("drop", ev => {
			ev.preventDefault();
			const id = ev.dataTransfer!.getData("text/x-jsim-object");
			const f = this.floorAt(ev);
			if (id && f !== null) this.onDrop(id, Math.round(f[0] * 4) / 4, Math.round(f[1] * 4) / 4);
		});
	}

	getEntityAt(ev: MouseEvent): Entity | null {
		return this.pick(ev);
	}
}

export type { DisplayEntity };
