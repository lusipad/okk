import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface SqliteRunResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

export interface SqliteStatement<Row = unknown> {
  get(...params: unknown[]): Row | undefined;
  all(...params: unknown[]): Row[];
  run(...params: unknown[]): SqliteRunResult;
}

export interface SqliteConnection {
  exec(sql: string): void;
  prepare<Row = unknown>(sql: string): SqliteStatement<Row>;
  pragma<Row = unknown>(sql: string): Row[];
  transaction<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result;
  close(): void;
}

export interface SqliteConnectionOptions {
  dbPath: string;
  readonly?: boolean;
  fileMustExist?: boolean;
}

export class SqliteDriverInitializationError extends Error {
  readonly code = "SQLITE_DRIVER_INIT_FAILED";
  readonly driver = "node:sqlite";
  readonly databasePath: string;
  readonly nodeVersion: string;

  constructor(databasePath: string, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to initialize SQLite driver node:sqlite for ${databasePath}: ${causeMessage}`);
    this.name = "SqliteDriverInitializationError";
    this.databasePath = databasePath;
    this.nodeVersion = process.version;
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

class NodeSqliteStatement<Row = unknown>
  implements SqliteStatement<Row>
{
  constructor(private readonly statement: StatementSync) {}

  get(...params: unknown[]): Row | undefined {
    return this.statement.get(...(params as never[])) as Row | undefined;
  }

  all(...params: unknown[]): Row[] {
    return this.statement.all(...(params as never[])) as Row[];
  }

  run(...params: unknown[]): SqliteRunResult {
    const result = this.statement.run(...(params as never[])) as {
      changes?: number;
      lastInsertRowid?: number | bigint;
    };

    return {
      changes: Number(result.changes ?? 0),
      lastInsertRowid: result.lastInsertRowid
    };
  }
}

class NodeSqliteConnection implements SqliteConnection {
  private transactionDepth = 0;
  private transactionCounter = 0;

  constructor(private readonly database: DatabaseSync) {}

  exec(sql: string): void {
    this.database.exec(sql);
  }

  prepare<Row = unknown>(sql: string): SqliteStatement<Row> {
    return new NodeSqliteStatement<Row>(this.database.prepare(sql));
  }

  pragma<Row = unknown>(sql: string): Row[] {
    return this.prepare<Row>(`PRAGMA ${sql}`).all();
  }

  transaction<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
    return (...args: Args): Result => {
      const savepoint = `okk_tx_${this.transactionCounter += 1}`;
      const useSavepoint = this.transactionDepth > 0;

      this.exec(useSavepoint ? `SAVEPOINT ${savepoint}` : "BEGIN");
      this.transactionDepth += 1;

      try {
        const result = fn(...args);
        this.transactionDepth -= 1;
        this.exec(useSavepoint ? `RELEASE SAVEPOINT ${savepoint}` : "COMMIT");
        return result;
      } catch (error) {
        this.transactionDepth -= 1;
        if (useSavepoint) {
          try {
            this.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          } finally {
            this.exec(`RELEASE SAVEPOINT ${savepoint}`);
          }
        } else {
          this.exec("ROLLBACK");
        }
        throw error;
      }
    };
  }

  close(): void {
    this.database.close();
  }
}

const IN_MEMORY_PATH = ":memory:";

export function resolveSqliteDatabasePath(input: string): string {
  const trimmed = input.trim();
  return trimmed === IN_MEMORY_PATH ? trimmed : path.resolve(trimmed);
}

export function openSqliteConnection(options: SqliteConnectionOptions): SqliteConnection {
  const resolvedPath = resolveSqliteDatabasePath(options.dbPath);

  try {
    if (resolvedPath !== IN_MEMORY_PATH) {
      const parentDir = path.dirname(resolvedPath);
      if (!(options.readonly ?? false)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      if (options.fileMustExist && !fs.existsSync(resolvedPath)) {
        throw new Error(`Database file does not exist: ${resolvedPath}`);
      }
    }

    const database = new DatabaseSync(resolvedPath, {
      open: true,
      readOnly: options.readonly ?? false
    });

    return new NodeSqliteConnection(database);
  } catch (error) {
    throw new SqliteDriverInitializationError(resolvedPath, error);
  }
}

