import { jformat } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { URI } from "../input/ParseContext.ts";
import { ErrorException } from "./ErrorException.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

// ---- Java の java.io.File の代わり（basicsim の中で使う所だけ） ----
//
// ブラウザではファイルを直接読み書きできないので、ファイルは「道（パスの文字列）」で表し、
// 実際の読み書きは差し替えのできる FileSystem.backend に任せる（既定はメモリの中に持つだけ）。
// Node で動かすときや、ブラウザでダウンロードさせるときは、FileSystem.setBackend で差し替える。
// TODO(移植): InputAgent（まとまり C）がファイルをどう表すかと合わせる必要がある。

/** ファイルの読み書きの実体 */
export interface FileSystemBackend {
	exists(path: string): boolean;
	/** 消せたら true */
	delete(path: string): boolean;
	/** 作れたら（既にあっても）true */
	mkdirs(path: string): boolean;
	/** 無ければ空のファイルを作る。作ったら true */
	createNewFile(path: string): boolean;
	/** 書く（append が false なら上書き） */
	write(path: string, text: string, append: boolean): void;
	/** 全部を読む。無ければ null */
	readText(path: string): string | null;
}

/** 既定: メモリの中に持つだけ */
class MemoryFileSystem implements FileSystemBackend {
	private readonly files = new Map<string, string>();
	private readonly dirs = new Set<string>();

	exists(path: string): boolean {
		return this.files.has(path) || this.dirs.has(path);
	}
	delete(path: string): boolean {
		return this.files.delete(path) || this.dirs.delete(path);
	}
	mkdirs(path: string): boolean {
		this.dirs.add(path);
		return true;
	}
	createNewFile(path: string): boolean {
		if (this.files.has(path))
			return false;
		this.files.set(path, "");
		return true;
	}
	write(path: string, text: string, append: boolean): void {
		this.files.set(path, (append ? this.files.get(path) ?? "" : "") + text);
	}
	readText(path: string): string | null {
		return this.files.get(path) ?? null;
	}
}

export const FileSystem = {
	backend: new MemoryFileSystem() as FileSystemBackend,
	setBackend(b: FileSystemBackend): void {
		FileSystem.backend = b;
	},
	/** Java の File.separator */
	separator: "/",
};

/** File の関数の代わり（道の文字列に対して） */
export const JFile = {
	/** File.getName() */
	getName(path: string): string {
		const p = path.replace(/\\/g, "/");
		const i = p.lastIndexOf("/");
		return i < 0 ? p : p.substring(i + 1);
	},
	/** File.getParent()（無ければ "."） */
	getParent(path: string): string {
		const p = path.replace(/\\/g, "/");
		const i = p.lastIndexOf("/");
		if (i < 0)
			return ".";
		if (i === 0)
			return "/";
		return p.substring(0, i);
	},
	/** File.toURI()（フォルダなら最後に / を付ける） */
	toURI(path: string, isDir: boolean): URI {
		let p = path.replace(/\\/g, "/");
		if (!p.startsWith("/"))
			p = "/" + p;
		if (isDir && !p.endsWith("/"))
			p += "/";
		return new URI("file", p, null);
	},
	exists(path: string): boolean {
		return FileSystem.backend.exists(path);
	},
	delete(path: string): boolean {
		return FileSystem.backend.delete(path);
	},
	mkdirs(path: string): boolean {
		return FileSystem.backend.mkdirs(path);
	},
};

/**
 * Class encapsulating file input/output methods and file access.
 * Java の File は、道の文字列で受ける。
 * Java の BufferedWriter の代わりに、書いた文字をためておき、flush・close で FileSystem.backend に書く。
 */
export class FileEntity {
	private readonly sm: JaamSimModel;
	private backingFileObject: string;
	private outputStream: string[] | null = null;
	private append: boolean;

	constructor(model: JaamSimModel, file: string, append = false) {
		this.sm = model;
		this.backingFileObject = file;
		this.append = append;

		try {
			FileSystem.backend.createNewFile(this.backingFileObject);
			this.outputStream = [];
			if (!append)
				FileSystem.backend.write(this.backingFileObject, "", false);  // FileWriter(file, false) は中身を消す
		}
		catch (e) {
			throw new InputErrorException(tr("IOException thrown trying to open file: '%s'%n%s"),
					file, ErrorException.messageOf(e));
		}
	}

	close(): void {
		try {
			if( this.outputStream != null ) {
				this.flush();
				this.outputStream = null;
			}
		}
		catch (e) {
			this.outputStream = null;
			this.sm.logMessage("Unable to close FileEntity: " + JFile.getName(this.backingFileObject));
		}
	}

	flush(): void {
		try {
			if( this.outputStream != null ) {
				if (this.outputStream.length > 0) {
					FileSystem.backend.write(this.backingFileObject, this.outputStream.join(""), true);
					this.outputStream.length = 0;
				}
			}
		}
		catch (e) {
			throw new ErrorException( tr("Unable to flush FileEntity: ") + String(e) );
		}
	}

	format(format: string, ...args: unknown[]): void {
		this.write(jformat(format, ...args));
	}

	newLine(): void {
		if (this.outputStream == null)
			return;
		this.outputStream.push("\n");  // TODO(移植): Java の newLine は OS の改行（Windows では \r\n）
	}

	write( text: string ): void {
		if (this.outputStream == null)
			return;
		this.outputStream.push(text);
	}

	/**
	 * Delete the file
	 */
	delete(): void {
		if( FileSystem.backend.exists(this.backingFileObject) ) {
			if( !FileSystem.backend.delete(this.backingFileObject) ) {
				throw new ErrorException( tr("Failed to delete ") + JFile.getName(this.backingFileObject) );
			}
		}
	}

	/** Java に無い: ファイルの道 */
	getPath(): string {
		return this.backingFileObject;
	}

	toString(): string {
		return this.backingFileObject;
	}

}
