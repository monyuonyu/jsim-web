/*
 * 部品の一覧（左の「ライブラリ」に並ぶもの）。
 * 見た目は FlexSim の固定資源に合わせ、中身は JaamSim の部品（ProcessFlow）を使う。
 */
import { t } from "./i18n.ts";

export type Category = "fixed" | "conveyor" | "logic" | "resource";

/** 右の設定欄に出す項目 */
export interface PropDef {
	key: string;            // JaamSim のキーワード
	label: string;          // 画面の名前（英語。t で訳す）
	kind: "time" | "int" | "number" | "length" | "bool" | "text";
}

/** 統計に出す出力 */
export interface StatDef {
	output: string;         // JaamSim の出力の名前
	label: string;
	kind: "count" | "time" | "fraction" | "state";
}

export interface ObjDef {
	id: string;
	cls: string;            // JaamSim のクラス
	label: string;          // 英語の名前（t で訳す）
	category: Category;
	size: [number, number, number];   // m（x, y, z）
	/** 品物を直接受け取れるか。false なら、つながれた時は内側の待ち行列で受ける（作業台） */
	direct: boolean;
	/** 次へ送れるか（出口は送らない） */
	output: boolean;
	props: PropDef[];
	stats: StatDef[];
	icon: string;           // ライブラリの絵（SVG）
	/** ライブラリに出さない（JaamSim のモデルを開いた時に描くだけ） */
	hidden?: boolean;
	/** 形がない部品（一般の箱で描く）の上面の色 */
	color?: number;
	/** 次への送り先を一覧で持つ（分岐） */
	list?: boolean;
}

const svg = (body: string) =>
	`<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const STATE_STATS: StatDef[] = [
	{ output: "State", label: "State", kind: "state" },
	{ output: "Utilisation", label: "Utilization", kind: "fraction" },
];

export const CATALOG: ObjDef[] = [
	{
		id: "source", cls: "EntityGenerator", label: "Source", category: "fixed",
		size: [1.2, 1.2, 0.8], direct: false, output: true,
		props: [
			{ key: "InterArrivalTime", label: "Inter-arrival time", kind: "time" },
			{ key: "FirstArrivalTime", label: "First arrival time", kind: "time" },
			{ key: "EntitiesPerArrival", label: "Items per arrival", kind: "int" },
			{ key: "MaxNumber", label: "Maximum number", kind: "int" },
		],
		stats: [{ output: "NumberGenerated", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="14" width="22" height="12" rx="1" fill="#8a929c"/><rect x="7" y="9" width="18" height="6" fill="#c6ccd3" stroke="#6b737c"/><path d="M12 5h8l-4 5z" fill="#2f9e44"/>`),
	},
	{
		id: "queue", cls: "Queue", label: "Queue", category: "fixed",
		size: [2.0, 1.2, 0.1], direct: true, output: true,
		props: [
			{ key: "MaxPerLine", label: "Items per row", kind: "int" },
			{ key: "Spacing", label: "Spacing", kind: "length" },
		],
		stats: [
			{ output: "QueueLength", label: "Content", kind: "count" },
			{ output: "NumberAdded", label: "Input", kind: "count" },
			{ output: "NumberProcessed", label: "Output", kind: "count" },
			{ output: "QueueLengthAverage", label: "Average content", kind: "fraction" },
			{ output: "QueueLengthMaximum", label: "Maximum content", kind: "count" },
			{ output: "AverageQueueTime", label: "Average staytime", kind: "time" },
		],
		icon: svg(`<rect x="3" y="20" width="26" height="4" fill="#5b7fa6"/><rect x="5" y="13" width="6" height="7" fill="#c8a165"/><rect x="13" y="13" width="6" height="7" fill="#c8a165"/><rect x="21" y="13" width="6" height="7" fill="#c8a165"/>`),
	},
	{
		id: "processor", cls: "Server", label: "Processor", category: "fixed",
		size: [1.6, 1.4, 1.1], direct: false, output: true,
		props: [
			{ key: "ServiceTime", label: "Process time", kind: "time" },
		],
		stats: [
			...STATE_STATS,
			{ output: "NumberAdded", label: "Input", kind: "count" },
			{ output: "NumberProcessed", label: "Output", kind: "count" },
		],
		icon: svg(`<rect x="4" y="22" width="24" height="5" fill="#4a5058"/><rect x="6" y="8" width="20" height="14" rx="1" fill="#d7dde3" stroke="#6b737c"/><rect x="10" y="12" width="12" height="6" fill="#7fb2e5"/><circle cx="24" cy="6" r="2.5" fill="#2f9e44"/>`),
	},
	{
		id: "sink", cls: "EntitySink", label: "Sink", category: "fixed",
		size: [1.2, 1.2, 0.8], direct: true, output: false,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }],
		icon: svg(`<path d="M6 10h20l-2 17H8z" fill="#5a6068"/><rect x="5" y="8" width="22" height="3" fill="#b03030"/>`),
	},
	{
		id: "conveyor", cls: "EntityConveyor", label: "Conveyor", category: "conveyor",
		size: [5, 0.8, 0.9], direct: true, output: true,
		props: [
			{ key: "TravelTime", label: "Travel time", kind: "time" },
		],
		stats: [
			{ output: "NumberInProgress", label: "Content", kind: "count" },
			{ output: "NumberAdded", label: "Input", kind: "count" },
			{ output: "NumberProcessed", label: "Output", kind: "count" },
		],
		icon: svg(`<rect x="2" y="13" width="28" height="6" fill="#3c4148"/><g fill="#9aa3ad"><rect x="4" y="19" width="2" height="8"/><rect x="26" y="19" width="2" height="8"/></g><path d="M8 16h14m-3-2 3 2-3 2" stroke="#e8c547" stroke-width="1.5" fill="none"/>`),
	},
	{
		id: "delay", cls: "EntityDelay", label: "Transport delay", category: "logic",
		size: [4, 0.3, 0.05], direct: true, output: true,
		props: [{ key: "Duration", label: "Duration", kind: "time" }],
		stats: [{ output: "NumberInProgress", label: "Content", kind: "count" }],
		icon: svg(`<path d="M4 16h24" stroke="#6b737c" stroke-width="2" stroke-dasharray="3 2"/><path d="M24 12l4 4-4 4" fill="none" stroke="#6b737c" stroke-width="2"/>`),
	},
	{
		id: "branch", cls: "Branch", label: "Branch", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, list: true, color: 0x7048e8,
		props: [{ key: "Choice", label: "Choice (expression)", kind: "text" }],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#7048e8"/>`),
	},
	{
		id: "assign", cls: "Assign", label: "Assign attributes", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0x1098ad,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#1098ad"/>`),
	},
	{
		id: "duplicate", cls: "Duplicate", label: "Duplicate", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0x0ca678,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#0ca678"/>`),
	},
	{
		id: "gate", cls: "EntityGate", label: "Gate", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0xf59f00,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#f59f00"/>`),
	},
	{
		id: "seize", cls: "Seize", label: "Seize resource", category: "resource",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0xe8590c,
		props: [{ key: "ResourceList", label: "Resources", kind: "text" }],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#e8590c"/>`),
	},
	{
		id: "release", cls: "Release", label: "Release resource", category: "resource",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0xe8590c,
		props: [{ key: "ResourceList", label: "Resources", kind: "text" }],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#e8590c"/>`),
	},
	{
		id: "resource", cls: "Resource", label: "Resource", category: "resource",
		size: [1.0, 1.0, 1.2], direct: false, output: false, color: 0xd6336c,
		props: [{ key: "Capacity", label: "Capacity", kind: "int" }],
		stats: [{ output: "UnitsInUse", label: "Units in use", kind: "count" }, { output: "Utilisation", label: "Utilization", kind: "fraction" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#d6336c"/>`),
	},
	{
		id: "stats", cls: "Statistics", label: "Statistics", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, color: 0x495057,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#495057"/>`),
	},
	{
		id: "entproc", cls: "EntityProcessor", label: "Multi-processor", category: "fixed",
		size: [1.8, 1.4, 1.1], direct: false, output: true, hidden: true, color: 0x5c7cfa,
		props: [{ key: "ServiceTime", label: "Process time", kind: "time" }, { key: "Capacity", label: "Capacity", kind: "int" }],
		stats: [...STATE_STATS, { output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#5c7cfa"/>`),
	},
	{
		id: "combine", cls: "Combine", label: "Combiner", category: "fixed",
		size: [1.6, 1.4, 1.0], direct: false, output: true, hidden: true, color: 0x3b5bdb,
		props: [{ key: "ServiceTime", label: "Process time", kind: "time" }],
		stats: [...STATE_STATS, { output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#3b5bdb"/>`),
	},
	{
		id: "pack", cls: "Pack", label: "Pack", category: "fixed",
		size: [1.6, 1.4, 1.0], direct: false, output: true, hidden: true, color: 0x3b5bdb,
		props: [{ key: "ServiceTime", label: "Process time", kind: "time" }],
		stats: [...STATE_STATS, { output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#3b5bdb"/>`),
	},
	{
		id: "unpack", cls: "Unpack", label: "Separator", category: "fixed",
		size: [1.6, 1.4, 1.0], direct: false, output: true, hidden: true, color: 0x3b5bdb,
		props: [{ key: "ServiceTime", label: "Process time", kind: "time" }],
		stats: [...STATE_STATS, { output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#3b5bdb"/>`),
	},
	{
		id: "container", cls: "EntityContainer", label: "Container", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0x868e96,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#868e96"/>`),
	},
	{
		id: "logger", cls: "EntityLogger", label: "Logger", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0x495057,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#495057"/>`),
	},
	{
		id: "addto", cls: "AddTo", label: "Add to container", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0x868e96,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#868e96"/>`),
	},
	{
		id: "removefrom", cls: "RemoveFrom", label: "Remove from container", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0x868e96,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#868e96"/>`),
	},
	{
		id: "setgraphics", cls: "SetGraphics", label: "Set graphics", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0x868e96,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#868e96"/>`),
	},
	{
		id: "launcher", cls: "EntityLauncher", label: "Launcher", category: "logic",
		size: [1.0, 1.0, 0.6], direct: false, output: true, hidden: true, color: 0x2f9e44,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#2f9e44"/>`),
	},
	{
		id: "assemble", cls: "Assemble", label: "Assemble", category: "fixed",
		size: [1.6, 1.4, 1.0], direct: false, output: true, hidden: true, color: 0x3b5bdb,
		props: [{ key: "ServiceTime", label: "Process time", kind: "time" }],
		stats: [...STATE_STATS, { output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#3b5bdb"/>`),
	},
	{
		id: "signal", cls: "EntitySignal", label: "Signal", category: "logic",
		size: [1.0, 1.0, 0.6], direct: true, output: true, hidden: true, color: 0xf59f00,
		props: [],
		stats: [{ output: "NumberAdded", label: "Input", kind: "count" }, { output: "NumberProcessed", label: "Output", kind: "count" }],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#f59f00"/>`),
	},
	{
		id: "pool", cls: "ResourcePool", label: "Resource pool", category: "resource",
		size: [1.0, 1.0, 1.2], direct: false, output: false, hidden: true, color: 0xd6336c,
		props: [],
		stats: [],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#d6336c"/>`),
	},
	{
		id: "resunit", cls: "ResourceUnit", label: "Resource unit", category: "resource",
		size: [0.8, 0.8, 1.6], direct: false, output: false, hidden: true, color: 0xd6336c,
		props: [],
		stats: [],
		icon: svg(`<rect x="5" y="10" width="22" height="14" rx="2" fill="#dfe4e9" stroke="#6b737c"/><rect x="5" y="10" width="22" height="4" fill="#d6336c"/>`),
	},
];

export function defById(id: string): ObjDef {
	return CATALOG.find(d => d.id === id)!;
}

export function defByClass(cls: string): ObjDef | undefined {
	return CATALOG.find(d => d.cls === cls);
}

export function categoryLabel(c: Category): string {
	return t({ fixed: "Fixed Resources", conveyor: "Conveyors", logic: "Logic", resource: "Resources" }[c]);
}
