/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * In-memory Supabase client for savings / routing integration tests.
 */

import { randomUUID } from "node:crypto";

export type StoredRow = Record<string, unknown> & { id?: string };

function getColumn(row: StoredRow, column: string): unknown {
  if (column.startsWith("metadata->>")) {
    const key = column.slice("metadata->>".length);
    const metadata = row.metadata as Record<string, unknown> | undefined;
    return metadata?.[key];
  }
  return row[column];
}

class FakePostgrestQuery {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private rangeStart = 0;
  private rangeEnd = Number.POSITIVE_INFINITY;
  private inserted: StoredRow[] | null = null;
  private deleteMode = false;
  private deleteIds: string[] | null = null;

  constructor(
    private readonly table: string,
    private readonly store: Map<string, StoredRow[]>
  ) {}

  select(): this {
    return this;
  }

  insert(payload: StoredRow | StoredRow[]): this {
    const rows = Array.isArray(payload) ? payload : [payload];
    const tableRows = this.store.get(this.table) ?? [];
    this.inserted = rows.map((row) => ({
      id: row.id ?? randomUUID(),
      created_at: row.created_at ?? new Date().toISOString(),
      ...row,
    }));
    tableRows.push(...this.inserted);
    this.store.set(this.table, tableRows);
    return this;
  }

  delete(): this {
    this.deleteMode = true;
    return this;
  }

  in(column: string, values: string[]): this {
    if (this.deleteMode && column === "id") {
      this.deleteIds = values;
    } else {
      this.filters.push((row) => values.includes(String(row[column])));
    }
    return this;
  }

  eq(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") === value);
    return this;
  }

  lt(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") < value);
    return this;
  }

  gte(column: string, value: string): this {
    this.filters.push((row) => String(getColumn(row, column) ?? "") >= value);
    return this;
  }

  ilike(column: string, pattern: string): this {
    const needle = pattern.replaceAll("%", "").toLowerCase();
    this.filters.push((row) =>
      String(getColumn(row, column) ?? "")
        .toLowerCase()
        .includes(needle)
    );
    return this;
  }

  order(): this {
    return this;
  }

  limit(n: number): this {
    this.rangeStart = 0;
    this.rangeEnd = Math.max(0, n - 1);
    return this;
  }

  range(start: number, end: number): this {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  maybeSingle(): Promise<{ data: StoredRow | null; error: null }> {
    return Promise.resolve({ data: this.inserted?.[0] ?? this.rows()[0] ?? null, error: null });
  }

  single(): Promise<{ data: StoredRow | null; error: null }> {
    return this.maybeSingle();
  }

  then<TResult1 = { data: StoredRow[]; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: StoredRow[]; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      if (this.deleteMode) {
        const ids = new Set(this.deleteIds ?? []);
        const before = this.store.get(this.table) ?? [];
        const after = before.filter((row) => !ids.has(String(row.id)));
        this.store.set(this.table, after);
        return Promise.resolve({ data: [], error: null, count: before.length - after.length }).then(
          onfulfilled,
          onrejected
        );
      }
      return Promise.resolve({ data: this.rows(), error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }

  private rows(): StoredRow[] {
    return (this.store.get(this.table) ?? [])
      .filter((row) => this.filters.every((fn) => fn(row)))
      .slice(this.rangeStart, this.rangeEnd + 1);
  }
}

export class FakeSupabase {
  readonly store = new Map<string, StoredRow[]>();

  constructor(seed: Record<string, StoredRow[]> = {}) {
    for (const [table, rows] of Object.entries(seed)) {
      this.store.set(
        table,
        rows.map((row) => ({ ...row }))
      );
    }
  }

  from(table: string): FakePostgrestQuery {
    return new FakePostgrestQuery(table, this.store);
  }

  rpc(_name: string): Promise<{ data: null; error: { message: string } }> {
    return Promise.resolve({
      data: null,
      error: { message: "RPC intentionally unavailable in fake client." },
    });
  }
}

/** Vault row in `msgf_sandbox` for DEV_TEST tenant silo. */
export function devTestVaultRow(
  content: string,
  extra: Record<string, unknown> = {}
): StoredRow {
  return {
    id: randomUUID(),
    content,
    created_at: new Date().toISOString(),
    metadata: {
      tenant_id: "DEV_TEST",
      ledger: "vault",
      pillar: "P6",
      ...extra,
    },
  };
}
