import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";

/**
 * Simple struct-like class to handle the doubly linked loop of entities
 * @author Matt Chudleigh
 *
 * Java の 2 つのコンストラクタ（引数なし・Entity）は、引数の有無で見分ける。
 */
export class EntityListNode {

	public next: EntityListNode;
	public prev: EntityListNode;

	// This is a minor optimization, caching entClass prevents needing to dereference ent during
	// iteration of the entity list
	public entClass: JClass<Entity> | null = null;

	public ent: Entity | null = null;

	// Initialize to a closed loop
	constructor(e?: Entity) {
		this.next = this;
		this.prev = this;
		if (e !== undefined) {
			this.ent = e;
			e.listNode = this;
			this.entClass = e.constructor as JClass<Entity>;
		}
	}
}
