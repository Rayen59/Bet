import { type SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, type PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema.ts';

const dialect = new PgDialect();

interface ColumnMeta {
  jsKey: string;
  dbName: string;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue: unknown;
  isSerial: boolean;
}

interface TableMeta {
  name: string;
  table: PgTable;
  columns: ColumnMeta[];
  byDbName: Map<string, ColumnMeta>;
  byJsKey: Map<string, ColumnMeta>;
}

const TABLES: PgTable[] = [
  schema.users,
  schema.sports,
  schema.competitions,
  schema.teams,
  schema.matches,
  schema.markets,
  schema.virtualBets,
  schema.virtualBetSelections,
  schema.transactions,
  schema.auditLogs,
  schema.promotionsClaimed,
];

function buildTableMeta(table: PgTable): TableMeta {
  const cfg = getTableConfig(table);
  const columns: ColumnMeta[] = cfg.columns.map((col) => {
    const entry = Object.entries(table).find(([, v]) => v === col);
    const jsKey = entry ? entry[0] : col.name;
    const isSerial = col.name === 'id' && col.hasDefault;
    let defaultValue: unknown = undefined;
    if (col.hasDefault && col.default !== undefined && typeof col.default !== 'object') {
      defaultValue = col.default;
    }
    return {
      jsKey,
      dbName: col.name,
      isUnique: col.isUnique,
      hasDefault: col.hasDefault,
      defaultValue,
      isSerial,
    };
  });

  return {
    name: cfg.name,
    table,
    columns,
    byDbName: new Map(columns.map((c) => [c.dbName, c])),
    byJsKey: new Map(columns.map((c) => [c.jsKey, c])),
  };
}

const TABLE_METAS = new Map<PgTable, TableMeta>();
const TABLE_METAS_BY_NAME = new Map<string, TableMeta>();
for (const tbl of TABLES) {
  const meta = buildTableMeta(tbl);
  TABLE_METAS.set(tbl, meta);
  TABLE_METAS_BY_NAME.set(meta.name, meta);
}

type Row = Record<string, any>;

function resolveColumnRef(ref: unknown): { tableName: string; dbName: string; jsKey: string } | null {
  if (!ref || typeof ref !== 'object') return null;
  const col = ref as { name?: string; table?: PgTable };
  if (col.table && col.name) {
    const meta = TABLE_METAS.get(col.table);
    if (meta) {
      const colMeta = meta.byDbName.get(col.name);
      if (colMeta) return { tableName: meta.name, dbName: colMeta.dbName, jsKey: colMeta.jsKey };
    }
  }
  return null;
}

function getRowValue(row: Row, tableName: string, dbName: string): unknown {
  const meta = TABLE_METAS_BY_NAME.get(tableName);
  const colMeta = meta?.byDbName.get(dbName);
  if (!colMeta) return row[dbName];
  const namespacedKey = `${tableName}.${colMeta.jsKey}`;
  if (namespacedKey in row) return row[namespacedKey];
  return row[colMeta.jsKey];
}

function normalizeComparable(val: unknown): number | string | boolean | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const ms = Date.parse(val);
    if (!Number.isNaN(ms)) return ms;
  }
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') return val;
  return String(val);
}

function likeMatch(haystack: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(haystack);
}

type Token =
  | { type: 'ident'; value: string }
  | { type: 'param'; index: number }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

function tokenizeSql(sqlStr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sqlStr.length) {
    const ch = sqlStr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (ch === '$' && /\d/.test(sqlStr[i + 1] || '')) {
      let j = i + 1;
      while (j < sqlStr.length && /\d/.test(sqlStr[j])) j++;
      tokens.push({ type: 'param', index: Number(sqlStr.slice(i + 1, j)) - 1 });
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < sqlStr.length && sqlStr[j] !== '"') j++;
      let ident = sqlStr.slice(i + 1, j);
      j++;
      if (sqlStr[j] === '.' && sqlStr[j + 1] === '"') {
        let k = j + 2;
        while (k < sqlStr.length && sqlStr[k] !== '"') k++;
        ident = `${ident}.${sqlStr.slice(j + 2, k)}`;
        j = k + 1;
      }
      tokens.push({ type: 'ident', value: ident });
      i = j;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < sqlStr.length && sqlStr[j] !== "'") j++;
      tokens.push({ type: 'string', value: sqlStr.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const twoChar = sqlStr.slice(i, i + 2);
    if (twoChar === '<>' || twoChar === '!=' || twoChar === '>=' || twoChar === '<=') {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if (ch === '=' || ch === '<' || ch === '>' || ch === '+' || ch === '-') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < sqlStr.length && /[\d.]/.test(sqlStr[j])) j++;
      tokens.push({ type: 'number', value: Number(sqlStr.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < sqlStr.length && /[a-zA-Z0-9_.]/.test(sqlStr[j])) j++;
      tokens.push({ type: 'ident', value: sqlStr.slice(i, j) });
      i = j;
      continue;
    }
    i++;
  }
  return tokens;
}

type ValueEval = (row: Row) => unknown;
type PredEval = (row: Row) => boolean;

interface CompiledPredicate {
  eval: PredEval;
  exactId?: number;
  inIds?: number[];
}

function compilePredicate(sqlExpr: SQL, defaultTableName: string): CompiledPredicate {
  const { sql: sqlStr, params } = dialect.sqlToQuery(sqlExpr);
  const tokens = tokenizeSql(sqlStr);

  // Fast-path: "table"."id" = $1
  if (
    tokens.length === 3 &&
    tokens[0].type === 'ident' &&
    tokens[0].value.endsWith('.id') &&
    tokens[1].type === 'op' &&
    tokens[1].value === '=' &&
    tokens[2].type === 'param'
  ) {
    const targetId = Number(params[tokens[2].index]);
    return {
      exactId: targetId,
      eval: (row) => row.id === targetId,
    };
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function compileValue(): ValueEval {
    const t = peek();
    if (!t) return () => null;
    if (t.type === 'param') {
      next();
      const val = params[t.index];
      return () => val;
    }
    if (t.type === 'string' || t.type === 'number') {
      next();
      const val = t.value;
      return () => val;
    }
    if (t.type === 'op' && t.value === '-') {
      next();
      const inner = compileValue();
      return (row) => -Number(inner(row) ?? 0);
    }
    if (t.type === 'ident') {
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE') {
        next();
        return () => true;
      }
      if (upper === 'FALSE') {
        next();
        return () => false;
      }
      if (upper === 'NULL') {
        next();
        return () => null;
      }
      if (upper === 'LOWER') {
        next();
        if (peek()?.type === 'lparen') next();
        const inner = compileValue();
        if (peek()?.type === 'rparen') next();
        return (row) => String(inner(row) ?? '').toLowerCase();
      }
      next();
      if (t.value.includes('.')) {
        const [tbl, col] = t.value.split('.');
        return (row) => getRowValue(row, tbl, col);
      }
      const colName = t.value;
      return (row) => getRowValue(row, defaultTableName, colName);
    }
    next();
    return () => null;
  }

  function compileComparison(): PredEval {
    if (peek()?.type === 'lparen') {
      next();
      const inner = compileOr();
      if (peek()?.type === 'rparen') next();
      return inner;
    }

    const leftFn = compileValue();
    const t = peek();
    if (!t) return (row) => Boolean(leftFn(row));

    if (t.type === 'ident') {
      const upper = t.value.toUpperCase();
      if (upper === 'IN') {
        next();
        if (peek()?.type === 'lparen') next();
        const itemFns: ValueEval[] = [];
        let guard = 0;
        while (peek() && peek()?.type !== 'rparen' && guard++ < 5000) {
          itemFns.push(compileValue());
          if (peek()?.type === 'comma') next();
        }
        if (peek()?.type === 'rparen') next();

        // Pre-compute Set of normalized constants (all typical IN lists are literal params)
        const staticSet = new Set(itemFns.map((fn) => normalizeComparable(fn({}))));
        return (row) => staticSet.has(normalizeComparable(leftFn(row)));
      }
      if (upper === 'LIKE' || upper === 'ILIKE') {
        next();
        const rightFn = compileValue();
        return (row) => {
          const left = leftFn(row);
          if (left === null || left === undefined) return false;
          return likeMatch(String(left), String(rightFn(row) ?? ''));
        };
      }
      if (upper === 'IS') {
        next();
        let negate = false;
        const notTok = peek();
        if (notTok?.type === 'ident' && notTok.value.toUpperCase() === 'NOT') {
          next();
          negate = true;
        }
        const nullTok = peek();
        if (nullTok?.type === 'ident' && nullTok.value.toUpperCase() === 'NULL') {
          next();
        }
        return (row) => {
          const v = leftFn(row);
          const isNull = v === null || v === undefined;
          return negate ? !isNull : isNull;
        };
      }
      return (row) => Boolean(leftFn(row));
    }

    if (t.type === 'op') {
      next();
      const op = t.value;
      const rightFn = compileValue();
      return (row) => {
        const l = normalizeComparable(leftFn(row));
        const r = normalizeComparable(rightFn(row));
        switch (op) {
          case '=':
            return l === r;
          case '<>':
          case '!=':
            return l !== r;
          case '>':
            return l !== null && r !== null && l > r;
          case '<':
            return l !== null && r !== null && l < r;
          case '>=':
            return l !== null && r !== null && l >= r;
          case '<=':
            return l !== null && r !== null && l <= r;
          default:
            return false;
        }
      };
    }

    return (row) => Boolean(leftFn(row));
  }

  function compileAnd(): PredEval {
    const parts: PredEval[] = [compileComparison()];
    while (true) {
      const t = peek();
      if (t?.type === 'ident' && t.value.toUpperCase() === 'AND') {
        next();
        parts.push(compileComparison());
      } else {
        break;
      }
    }
    if (parts.length === 1) return parts[0];
    return (row) => parts.every((fn) => fn(row));
  }

  function compileOr(): PredEval {
    const parts: PredEval[] = [compileAnd()];
    while (true) {
      const t = peek();
      if (t?.type === 'ident' && t.value.toUpperCase() === 'OR') {
        next();
        parts.push(compileAnd());
      } else {
        break;
      }
    }
    if (parts.length === 1) return parts[0];
    return (row) => parts.some((fn) => fn(row));
  }

  return { eval: compileOr() };
}

function compileUpdatePatch(patch: Row, tableName: string) {
  const compiledFields: Array<{ key: string; apply: (row: Row) => unknown }> = [];
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (val && typeof val === 'object' && 'queryChunks' in val) {
      const { sql: sqlStr, params } = dialect.sqlToQuery(val as SQL);
      const tokens = tokenizeSql(sqlStr);
      if (
        tokens.length === 3 &&
        tokens[0].type === 'ident' &&
        tokens[1].type === 'op' &&
        tokens[2].type === 'param'
      ) {
        const colRef = tokens[0].value.includes('.') ? tokens[0].value.split('.')[1] : tokens[0].value;
        const delta = Number(params[tokens[2].index] ?? 0);
        const op = tokens[1].value;
        compiledFields.push({
          key,
          apply: (row) => {
            const cur = Number(getRowValue(row, tableName, colRef) ?? 0);
            return op === '+' ? cur + delta : cur - delta;
          },
        });
      }
    } else {
      compiledFields.push({ key, apply: () => val });
    }
  }
  return compiledFields;
}

interface StoreState {
  tables: Map<string, Row[]>;
  idIndex: Map<string, Map<number, Row>>;
  sequences: Map<string, number>;
}

function createInitialStore(): StoreState {
  const tables = new Map<string, Row[]>();
  const idIndex = new Map<string, Map<number, Row>>();
  const sequences = new Map<string, number>();
  for (const tbl of TABLES) {
    const meta = TABLE_METAS.get(tbl)!;
    tables.set(meta.name, []);
    idIndex.set(meta.name, new Map());
    sequences.set(meta.name, 1);
  }
  return { tables, idIndex, sequences };
}

export function createMockDb() {
  const state = createInitialStore();

  function applyRowDefaults(meta: TableMeta, input: Row): Row {
    const row: Row = {};
    for (const col of meta.columns) {
      if (col.isSerial) {
        if (input[col.jsKey] !== undefined) {
          row[col.jsKey] = input[col.jsKey];
          const curSeq = state.sequences.get(meta.name) || 1;
          if (Number(input[col.jsKey]) >= curSeq) {
            state.sequences.set(meta.name, Number(input[col.jsKey]) + 1);
          }
        } else {
          const nextId = state.sequences.get(meta.name) || 1;
          state.sequences.set(meta.name, nextId + 1);
          row[col.jsKey] = nextId;
        }
      } else if (input[col.jsKey] !== undefined) {
        row[col.jsKey] = input[col.jsKey];
      } else if (col.hasDefault) {
        if (col.jsKey === 'createdAt' || col.jsKey === 'claimedAt') {
          row[col.jsKey] = new Date();
        } else {
          row[col.jsKey] = col.defaultValue;
        }
      } else {
        row[col.jsKey] = null;
      }
    }
    return row;
  }

  function buildExecutor(activeState: StoreState) {
    const api = {
      execute: async (query: SQL) => {
        const { sql: sqlStr } = dialect.sqlToQuery(query);
        if (/to_regclass/i.test(sqlStr)) {
          return { rows: [{ tbl: 'users' }] };
        }
        return { rows: [{ '?column?': 1 }] };
      },

      select: (projection?: Record<string, unknown>) => {
        let baseTableMeta: TableMeta | null = null;
        let joinedMeta: TableMeta | null = null;
        let joinCond: SQL | null = null;
        let whereCond: SQL | null = null;
        let groupCols: unknown[] = [];
        let orderExprs: unknown[] = [];
        let limitNum: number | null = null;

        const runSelect = async (): Promise<Row[]> => {
          if (!baseTableMeta) return [];
          const baseRows = activeState.tables.get(baseTableMeta.name) || [];

          let combined: Row[];

          if (!joinedMeta && whereCond) {
            const pred = compilePredicate(whereCond, baseTableMeta.name);
            if (pred.exactId !== undefined) {
              const hit = activeState.idIndex.get(baseTableMeta.name)?.get(pred.exactId);
              combined = hit ? [{ ...hit }] : [];
            } else {
              combined = [];
              for (const r of baseRows) {
                if (pred.eval(r)) combined.push({ ...r });
              }
            }
          } else {
            combined = baseRows.map((r) => ({ ...r }));

            if (joinedMeta && joinCond) {
              const rightRows = activeState.tables.get(joinedMeta.name) || [];
              const pred = compilePredicate(joinCond, baseTableMeta.name);
              const joined: Row[] = [];
              for (const lr of combined) {
                for (const rr of rightRows) {
                  const merged: Row = { ...lr };
                  for (const col of joinedMeta.columns) {
                    merged[`${joinedMeta.name}.${col.jsKey}`] = rr[col.jsKey];
                  }
                  if (pred.eval(merged)) {
                    joined.push(merged);
                  }
                }
              }
              combined = joined;
            }

            if (whereCond) {
              const pred = compilePredicate(whereCond, baseTableMeta.name);
              combined = combined.filter(pred.eval);
            }
          }

          if (groupCols.length > 0) {
            const groupKeys = groupCols.map((c) => resolveColumnRef(c)).filter(Boolean) as Array<{
              tableName: string;
              dbName: string;
              jsKey: string;
            }>;
            const buckets = new Map<string, Row[]>();
            for (const row of combined) {
              const key = groupKeys.map((g) => String(row[g.jsKey])).join('::');
              const arr = buckets.get(key) || [];
              arr.push(row);
              buckets.set(key, arr);
            }
            const out: Row[] = [];
            for (const groupRows of buckets.values()) {
              const sample = groupRows[0];
              if (projection) {
                const projected: Row = {};
                for (const [alias, expr] of Object.entries(projection)) {
                  const ref = resolveColumnRef(expr);
                  projected[alias] = ref ? sample[ref.jsKey] : groupRows.length;
                }
                out.push(projected);
              } else {
                out.push(sample);
              }
            }
            return out;
          }

          if (orderExprs.length > 0) {
            const compiledOrders = orderExprs
              .map((expr) => {
                const ref = resolveColumnRef(expr);
                if (ref) return { jsKey: ref.jsKey, tableName: ref.tableName, dir: 'asc' as const };
                const q = dialect.sqlToQuery(expr as SQL);
                const isDesc = /\bdesc\b/i.test(q.sql);
                const m = q.sql.match(/"([^"]+)"\."([^"]+)"/);
                if (m) {
                  const tbl = TABLE_METAS_BY_NAME.get(m[1]);
                  const col = tbl?.byDbName.get(m[2]);
                  return {
                    jsKey: col?.jsKey || m[2],
                    tableName: m[1],
                    dir: isDesc ? ('desc' as const) : ('asc' as const),
                  };
                }
                return null;
              })
              .filter(Boolean) as Array<{ jsKey: string; tableName: string; dir: 'asc' | 'desc' }>;

            combined.sort((a, b) => {
              for (const ord of compiledOrders) {
                const av = normalizeComparable(a[ord.jsKey]);
                const bv = normalizeComparable(b[ord.jsKey]);
                if (av === bv) continue;
                if (av === null) return 1;
                if (bv === null) return -1;
                const cmp = av < bv ? -1 : 1;
                return ord.dir === 'desc' ? -cmp : cmp;
              }
              return 0;
            });
          }

          if (limitNum !== null) {
            combined = combined.slice(0, limitNum);
          }

          if (projection) {
            return combined.map((row) => {
              const out: Row = {};
              for (const [alias, expr] of Object.entries(projection)) {
                const ref = resolveColumnRef(expr);
                if (ref) {
                  if (ref.tableName !== baseTableMeta!.name && `${ref.tableName}.${ref.jsKey}` in row) {
                    out[alias] = row[`${ref.tableName}.${ref.jsKey}`];
                  } else {
                    out[alias] = row[ref.jsKey];
                  }
                }
              }
              return out;
            });
          }

          return combined;
        };

        const chain: any = {
          from(tbl: PgTable) {
            baseTableMeta = TABLE_METAS.get(tbl) || null;
            return chain;
          },
          innerJoin(tbl: PgTable, on: SQL) {
            joinedMeta = TABLE_METAS.get(tbl) || null;
            joinCond = on;
            return chain;
          },
          where(cond: SQL) {
            whereCond = cond;
            return chain;
          },
          groupBy(...cols: unknown[]) {
            groupCols = cols;
            return chain;
          },
          orderBy(...exprs: unknown[]) {
            orderExprs = exprs;
            return chain;
          },
          limit(n: number) {
            limitNum = n;
            return chain;
          },
          then(onFulfilled: any, onRejected: any) {
            return runSelect().then(onFulfilled, onRejected);
          },
        };

        return chain;
      },

      insert: (tbl: PgTable) => {
        const meta = TABLE_METAS.get(tbl)!;
        let payload: Row[] = [];
        let ignoreConflicts = false;

        const runInsert = async (): Promise<Row[]> => {
          const tableRows = activeState.tables.get(meta.name)!;
          const idxMap = activeState.idIndex.get(meta.name)!;
          const inserted: Row[] = [];
          const uniqueCols = meta.columns.filter((c) => c.isUnique);

          for (const raw of payload) {
            const candidate = applyRowDefaults(meta, raw);
            const hasConflict =
              uniqueCols.length > 0 &&
              uniqueCols.some((col) => {
                const val = candidate[col.jsKey];
                if (val === null || val === undefined) return false;
                return tableRows.some((existing) => existing[col.jsKey] === val);
              });

            if (hasConflict) {
              if (ignoreConflicts) continue;
              throw new Error(`duplicate key value violates unique constraint on table "${meta.name}"`);
            }

            tableRows.push(candidate);
            if (typeof candidate.id === 'number') {
              idxMap.set(candidate.id, candidate);
            }
            inserted.push({ ...candidate });
          }
          return inserted;
        };

        const chain: any = {
          values(vals: Row | Row[]) {
            payload = Array.isArray(vals) ? vals : [vals];
            return chain;
          },
          onConflictDoNothing() {
            ignoreConflicts = true;
            return chain;
          },
          returning() {
            return chain;
          },
          then(onFulfilled: any, onRejected: any) {
            return runInsert().then(onFulfilled, onRejected);
          },
        };

        return chain;
      },

      update: (tbl: PgTable) => {
        const meta = TABLE_METAS.get(tbl)!;
        let patch: Row = {};
        let whereCond: SQL | null = null;

        const runUpdate = async (): Promise<Row[]> => {
          const tableRows = activeState.tables.get(meta.name)!;
          const compiledFields = compileUpdatePatch(patch, meta.name);
          const updated: Row[] = [];

          const applyToRow = (row: Row) => {
            for (const f of compiledFields) {
              row[f.key] = f.apply(row);
            }
            updated.push({ ...row });
          };

          if (whereCond) {
            const pred = compilePredicate(whereCond, meta.name);
            if (pred.exactId !== undefined) {
              const hit = activeState.idIndex.get(meta.name)?.get(pred.exactId);
              if (hit) applyToRow(hit);
              return updated;
            }
            for (const row of tableRows) {
              if (pred.eval(row)) applyToRow(row);
            }
          } else {
            for (const row of tableRows) applyToRow(row);
          }

          return updated;
        };

        const chain: any = {
          set(values: Row) {
            patch = values;
            return chain;
          },
          where(cond: SQL) {
            whereCond = cond;
            return chain;
          },
          returning() {
            return chain;
          },
          then(onFulfilled: any, onRejected: any) {
            return runUpdate().then(onFulfilled, onRejected);
          },
        };

        return chain;
      },

      delete: (tbl: PgTable) => {
        const meta = TABLE_METAS.get(tbl)!;
        let whereCond: SQL | null = null;

        const runDelete = async (): Promise<Row[]> => {
          const tableRows = activeState.tables.get(meta.name)!;
          const idxMap = activeState.idIndex.get(meta.name)!;
          const pred = whereCond ? compilePredicate(whereCond, meta.name) : null;
          const kept: Row[] = [];
          const removed: Row[] = [];
          for (const row of tableRows) {
            if (!pred || pred.eval(row)) {
              removed.push({ ...row });
              if (typeof row.id === 'number') idxMap.delete(row.id);
            } else {
              kept.push(row);
            }
          }
          activeState.tables.set(meta.name, kept);
          return removed;
        };

        const chain: any = {
          where(cond: SQL) {
            whereCond = cond;
            return chain;
          },
          returning() {
            return chain;
          },
          then(onFulfilled: any, onRejected: any) {
            return runDelete().then(onFulfilled, onRejected);
          },
        };

        return chain;
      },

      transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
        const snapshotTables = new Map<string, Row[]>();
        const snapshotIndex = new Map<string, Map<number, Row>>();
        for (const [k, rows] of activeState.tables.entries()) {
          const clonedRows = rows.map((r) => ({ ...r }));
          snapshotTables.set(k, clonedRows);
          const idx = new Map<number, Row>();
          for (const r of clonedRows) {
            if (typeof r.id === 'number') idx.set(r.id, r);
          }
          snapshotIndex.set(k, idx);
        }
        const snapshotSeqs = new Map(activeState.sequences);
        try {
          return await fn(api);
        } catch (err) {
          activeState.tables = snapshotTables;
          activeState.idIndex = snapshotIndex;
          activeState.sequences = snapshotSeqs;
          throw err;
        }
      },
    };

    return api;
  }

  return buildExecutor(state);
}
