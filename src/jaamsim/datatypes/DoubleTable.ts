/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { ErrorException } from "../internal.ts";
import { tr } from "../internal.ts";
import { DoubleVector } from "../internal.ts";

/**
 * This class implements a 2-dimensional table of doubles with a DoubleVector.
 */
export class DoubleTable {

	private table: DoubleVector[];
	private columns: number; // number of columns
	private rows: number; // number of rows

	/**
	 * DoubleTable(): Construct an empty table, with default size 1 row and 1 column.
	 * DoubleTable(int r, int c): Construct a table of zeroes with the given number of rows and columns.
	 */
	constructor( r: number = 1, c: number = 1 ) {
		// Set the number of rows and columns
		this.rows = r;
		this.columns = c;

		// Create the table
		this.table = [];

		for( let i = 0; i < r; i++ ) {
			const newRow = new DoubleVector( c, 1 );
			newRow.fillWithEntriesOf( c, 0.0 );
			this.table.push( newRow );
		}
	}

	/**
	 * Set the number of rows in the table.
	 */
	setRows( r: number ): void {

		// Delete rows
		for( let i = this.table.length; i > r; i-- ) {
			this.table.splice(i - 1, 1);
		}

		// Add rows
		for( let i = this.table.length; i < r; i++ ) {
			const newRow = new DoubleVector( this.columns, 1 );
			newRow.fillWithEntriesOf( this.columns, 0.0 );
			this.table.push(newRow);
		}

		// Set the number of rows
		this.rows = r;
	}

	/**
	 * Return the number of rows in the table.
	 */
	getRows(): number {
		return this.rows;
	}

	/**
	 * Set the number of columns in the table.
	 */
	setColumns( c: number ): void {

		// Delete columns
		for( let i = 0; i < this.table.length; i++ ) {
			for( let j = 0; j < (this.columns - c); j++ ) {
				this.table[ i ].remove(this.columns - 1 - j);
			}
		}

		// Add columns
		for( let i = 0; i < this.table.length; i++ ) {
			for( let j = 0; j < (c - this.columns); j++ ) {
				this.table[i].add(0.0);
			}
		}

		// Set the number of columns
		this.columns = c;
	}

	/**
	 * Return the number of columns in the table.
	 */
	getColumns(): number {
		return this.columns;
	}

	/**
	 * Set the component at the given row and column of this table to be the given double.
	 */
	setElementAtAt( value: number, r: number, c: number ): void {
		if( (r < 0 || r >= this.rows) || (c < 0 || c >= this.columns) ) {
			throw new ErrorException(tr("index out of range for table"));
		}
		this.table[r].set(c, value);
	}

	/**
	 * Add the specified value to the value at the specified row and column.
	 */
	addAtAt( value: number, r: number, c: number ): void {
		if( (r < 0 || r >= this.rows) || (c < 0 || c >= this.columns) ) {
			throw new ErrorException(tr("index out of range for table"));
		}
		this.table[r].addAt(value, c);
	}

	/**
	 * get(int r, int c): Return the double at the given row and column in this table.
	 * get(int r): Return the given row values in this table.
	 */
	get( r: number, c: number ): number;
	get( r: number ): DoubleVector;
	get( r: number, c?: number ): number | DoubleVector {
		if (c === undefined) {
			if( r < 0 || r >= this.rows ) {
				throw new ErrorException(tr("index out of range for table"));
			}

			const values = new DoubleVector(this.table[r]);
			return values;
		}
		if( (r < 0 || r >= this.rows) || (c < 0 || c >= this.columns) ) {
			throw new ErrorException(tr("index out of range for table"));
		}
		return this.table[r].get(c);
	}

	/**
	 * Delete the given row in this table.
	 */
	deleteRow( r: number ): void {
		if( r < 0 || r >= this.rows ) {
			throw new ErrorException(tr("index out of range for table"));
		}
		this.table.splice(r, 1);

		// Decrement row count
		this.rows--;
	}

	/**
	 * Delete the given column in this table.
	 */
	deleteColumn( c: number ): void {
		if( c < 0 || c >= this.columns ) {
			throw new ErrorException(tr("index out of range for table"));
		}

		// Delete column
		for( let i = 0; i < this.table.length; i++ ) {
			this.table[i].remove(c);
		}

		// Decrement column count
		this.columns--;
	}

	/**
	 * Return the given row values in this table.
	 */
	getRowValues( r: number ): DoubleVector {
		if( r < 0 || r >= this.rows ) {
			throw new ErrorException(tr("index out of range for table"));
		}

		const values = new DoubleVector(this.table[r]);
		return values;
	}

	/**
	 * Return the given column values in this table.
	 */
	getColumnValues( c: number ): DoubleVector {
		if( c < 0 || c >= this.columns ) {
			throw new ErrorException(tr("index out of range for table"));
		}

		const values = new DoubleVector( this.rows, 1 );

		for( let i = 0; i < this.table.length; i++ ) {
			values.add(this.table[i].get(c));
		}

		return values;
	}

	/**
	 * Return a string representation of this table,
	 * containing the String representation of each element.
	 */
	toString(): string {
		// ArrayList.toString(): "[" + 要素の toString を ", " でつなぐ + "]"
		return "[" + this.table.map(v => v.toString()).join(", ") + "]";
	}
}
