import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "./migrations.js";
import {
  InstalledSkillsDao,
  KnowledgeDao,
  MessagesDao,
  RepositoriesDao,
  RunsDao,
  SessionsDao,
  UsersDao
} from "./dao/index.js";

export type SqliteConnection = InstanceType<typeof BetterSqlite3>;

export interface SqliteDatabaseOptions {
  dbPath: string;
  readonly?: boolean;
  fileMustExist?: boolean;
}

export class SqliteDatabase {
  readonly connection: SqliteConnection;
  readonly users: UsersDao;
  readonly repositories: RepositoriesDao;
  readonly sessions: SessionsDao;
  readonly messages: MessagesDao;
  readonly knowledge: KnowledgeDao;
  readonly runs: RunsDao;
  readonly installedSkills: InstalledSkillsDao;

  constructor(options: SqliteDatabaseOptions) {
    const resolvedPath = path.resolve(options.dbPath);
    const parentDir = path.dirname(resolvedPath);
    fs.mkdirSync(parentDir, { recursive: true });

    this.connection = new BetterSqlite3(resolvedPath, {
      readonly: options.readonly ?? false,
      fileMustExist: options.fileMustExist ?? false
    });

    runMigrations(this.connection);

    this.users = new UsersDao(this.connection);
    this.repositories = new RepositoriesDao(this.connection);
    this.sessions = new SessionsDao(this.connection);
    this.messages = new MessagesDao(this.connection);
    this.knowledge = new KnowledgeDao(this.connection);
    this.runs = new RunsDao(this.connection);
    this.installedSkills = new InstalledSkillsDao(this.connection);
  }

  close(): void {
    this.connection.close();
  }
}

