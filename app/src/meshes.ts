/*
 * 部品の 3D の形（FlexSim の固定資源に似せた、自前の形）。
 * three.js は y が上。JaamSim の (x, y, z) は (x, z, -y) に置く。各部品の原点は床の中心。
 */
import * as THREE from "three";

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
	new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts });

const M = {
	frame: mat(0x5c636b, { metalness: 0.4, roughness: 0.45 }),
	dark: mat(0x3a3f45, { metalness: 0.3 }),
	panel: mat(0xd9dee3),
	blue: mat(0x5b7fa6, { metalness: 0.2 }),
	glass: mat(0x86b8e8, { transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.1 }),
	roller: mat(0xb9c0c7, { metalness: 0.7, roughness: 0.3 }),
	belt: mat(0x2b2e33, { roughness: 0.9 }),
	yellow: mat(0xe8c547),
	red: mat(0xb03030),
	green: mat(0x2f9e44),
};

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
	const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
	g.position.set(x, y, z);
	g.castShadow = true;
	g.receiveShadow = true;
	return g;
}

function cyl(r: number, len: number, m: THREE.Material, x: number, y: number, z: number, axis: "x" | "z" = "z"): THREE.Mesh {
	const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), m);
	if (axis === "z") g.rotation.x = Math.PI / 2;
	else g.rotation.z = Math.PI / 2;
	g.position.set(x, y, z);
	g.castShadow = true;
	return g;
}

/** 状態のランプ（作業台の上）。色は状態で変える */
export function makeLamp(): THREE.Mesh {
	const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x000000 }));
	m.name = "lamp";
	return m;
}

/** sx: 長さ（x）、sy: 奥行き（JaamSim の y）、sz: 高さ */
export function buildMesh(id: string, sx: number, sy: number, sz: number): THREE.Group {
	const g = new THREE.Group();
	switch (id) {
		case "source": {
			// 脚と枠、上にローラー、前に緑の矢印
			for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
				g.add(box(0.06, sz - 0.1, 0.06, M.frame, x * (sx / 2 - 0.05), (sz - 0.1) / 2, z * (sy / 2 - 0.05)));
			g.add(box(sx, 0.08, sy, M.frame, 0, sz - 0.1, 0));
			const n = 6;
			for (let i = 0; i < n; i++)
				g.add(cyl(0.045, sy - 0.1, M.roller, -sx / 2 + (i + 0.5) * sx / n, sz - 0.02, 0));
			g.add(box(sx - 0.1, 0.25, 0.04, M.panel, 0, sz * 0.45, sy / 2 - 0.05));
			const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 3), M.green);
			arrow.rotation.z = -Math.PI / 2;
			arrow.position.set(sx / 2 + 0.2, sz - 0.05, 0);
			g.add(arrow);
			break;
		}
		case "queue": {
			// 床の低い台（青）と、四隅の短い柱
			g.add(box(sx, 0.06, sy, M.blue, 0, 0.03, 0));
			for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
				g.add(box(0.06, 0.25, 0.06, M.frame, x * (sx / 2 - 0.03), 0.125, z * (sy / 2 - 0.03)));
			g.add(box(sx, 0.03, 0.03, M.yellow, 0, 0.07, sy / 2 - 0.015));
			g.add(box(sx, 0.03, 0.03, M.yellow, 0, 0.07, -sy / 2 + 0.015));
			break;
		}
		case "processor": {
			// 台と、機械の箱（窓つき）、上の作業面
			g.add(box(sx, 0.12, sy, M.dark, 0, 0.06, 0));
			g.add(box(sx * 0.9, sz - 0.3, sy * 0.85, M.panel, 0, 0.12 + (sz - 0.3) / 2, 0));
			g.add(box(sx * 0.5, (sz - 0.3) * 0.45, 0.02, M.glass, 0, 0.12 + (sz - 0.3) * 0.55, sy * 0.425 + 0.01));
			g.add(box(sx, 0.08, sy, M.frame, 0, sz - 0.14, 0));
			g.add(box(sx * 0.12, 0.2, sy * 0.12, M.dark, sx * 0.38, sz - 0.0, -sy * 0.38));
			const lamp = makeLamp();
			lamp.position.set(sx * 0.38, sz + 0.18, -sy * 0.38);
			g.add(lamp);
			break;
		}
		case "sink": {
			// 口の開いた箱（中は暗い）と赤い縁
			const w = 0.05;
			g.add(box(sx, 0.05, sy, M.dark, 0, 0.025, 0));
			g.add(box(sx, sz, w, M.frame, 0, sz / 2, sy / 2 - w / 2));
			g.add(box(sx, sz, w, M.frame, 0, sz / 2, -sy / 2 + w / 2));
			g.add(box(w, sz, sy, M.frame, sx / 2 - w / 2, sz / 2, 0));
			g.add(box(w, sz, sy, M.frame, -sx / 2 + w / 2, sz / 2, 0));
			g.add(box(sx + 0.04, 0.06, sy + 0.04, M.red, 0, sz, 0).translateY(0).clone());
			const hole = box(sx - 0.1, 0.02, sy - 0.1, mat(0x15171a), 0, sz * 0.4, 0);
			g.add(hole);
			break;
		}
		default: {
			g.add(box(sx, Math.max(sz, 0.05), sy, M.panel, 0, Math.max(sz, 0.05) / 2, 0));
		}
	}
	return g;
}

/** コンベヤ（点を結ぶ線に沿って。pts は JaamSim の床の座標を three に直したもの） */
export function buildConveyor(pts: THREE.Vector3[], width: number, height: number): THREE.Group {
	const g = new THREE.Group();
	for (let i = 0; i + 1 < pts.length; i++) {
		const a = pts[i], b = pts[i + 1];
		const len = a.distanceTo(b);
		if (len < 1e-6) continue;
		const seg = new THREE.Group();
		seg.position.copy(a).add(b).multiplyScalar(0.5);
		seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
		seg.add(box(len, 0.06, width, M.belt, 0, height - 0.03, 0));
		seg.add(box(len, 0.1, 0.04, M.frame, 0, height, width / 2 + 0.02));
		seg.add(box(len, 0.1, 0.04, M.frame, 0, height, -width / 2 - 0.02));
		const legs = Math.max(2, Math.ceil(len / 1.5) + 1);
		for (let k = 0; k < legs; k++) {
			const x = -len / 2 + 0.05 + k * (len - 0.1) / (legs - 1);
			seg.add(box(0.05, height - 0.06, 0.05, M.frame, x, (height - 0.06) / 2, width / 2 - 0.02));
			seg.add(box(0.05, height - 0.06, 0.05, M.frame, x, (height - 0.06) / 2, -width / 2 + 0.02));
		}
		g.add(seg);
	}
	return g;
}

/** 移動（遅れ）: 床の破線と矢印 */
export function buildPath(pts: THREE.Vector3[]): THREE.Group {
	const g = new THREE.Group();
	const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().setY(0.02))),
		new THREE.LineDashedMaterial({ color: 0x6b737c, dashSize: 0.3, gapSize: 0.15 }));
	line.computeLineDistances();
	g.add(line);
	return g;
}

/** 品物（段ボールの箱） */
const ITEM_MAT = mat(0xc8a165, { roughness: 0.85 });
const ITEM_EDGE = new THREE.LineBasicMaterial({ color: 0x8a6a3a });
export function buildItem(sx: number, sy: number, sz: number): THREE.Object3D {
	const geo = new THREE.BoxGeometry(sx, sz, sy);
	const m = new THREE.Mesh(geo, ITEM_MAT);
	m.castShadow = true;
	m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ITEM_EDGE));
	return m;
}
