export class WindowDefaults {
	public readonly DEFAULT_GUI_WIDTH: number;
	public readonly DEFAULT_GUI_HEIGHT: number;
	public readonly COL1_WIDTH: number;
	public readonly COL2_WIDTH: number;
	public readonly COL3_WIDTH: number;
	public readonly COL4_WIDTH: number;
	public readonly COL1_START: number;
	public readonly COL2_START: number;
	public readonly COL3_START: number;
	public readonly COL4_START: number;
	public readonly HALF_TOP: number;
	public readonly HALF_BOTTOM: number;
	public readonly TOP_START: number;
	public readonly BOTTOM_START: number;
	public readonly LOWER_HEIGHT: number;
	public readonly LOWER_START: number;
	public readonly VIEW_HEIGHT: number;
	public readonly VIEW_WIDTH: number;
	public readonly VIEW_OFFSET: number;

	constructor(winWidth: number, winHeight: number, guiHeight: number, guiX: number, guiY: number) {
		this.DEFAULT_GUI_WIDTH = winWidth;
		this.DEFAULT_GUI_HEIGHT = guiHeight;
		this.COL1_WIDTH = 220;
		this.COL4_WIDTH = 520;
		const middleWidth = this.DEFAULT_GUI_WIDTH - this.COL1_WIDTH - this.COL4_WIDTH;
		this.COL2_WIDTH = Math.max(520, Math.trunc(middleWidth / 2));
		this.COL3_WIDTH = Math.max(420, middleWidth - this.COL2_WIDTH);
		this.VIEW_WIDTH = this.DEFAULT_GUI_WIDTH - this.COL1_WIDTH;

		this.COL1_START = guiX;
		this.COL2_START = this.COL1_START + this.COL1_WIDTH;
		this.COL3_START = this.COL2_START + this.COL2_WIDTH;
		this.COL4_START = Math.min(this.COL3_START + this.COL3_WIDTH, winWidth - this.COL4_WIDTH);

		this.HALF_TOP = Math.trunc((winHeight - this.DEFAULT_GUI_HEIGHT) / 2);
		this.HALF_BOTTOM = (winHeight - this.DEFAULT_GUI_HEIGHT - this.HALF_TOP);
		this.LOWER_HEIGHT = Math.min(250, Math.trunc((winHeight - this.DEFAULT_GUI_HEIGHT) / 3));
		this.VIEW_HEIGHT = winHeight - this.DEFAULT_GUI_HEIGHT - this.LOWER_HEIGHT;

		this.TOP_START = guiY + this.DEFAULT_GUI_HEIGHT;
		this.BOTTOM_START = this.TOP_START + this.HALF_TOP;
		this.LOWER_START = this.TOP_START + this.VIEW_HEIGHT;

		this.VIEW_OFFSET = 50;
	}
}
