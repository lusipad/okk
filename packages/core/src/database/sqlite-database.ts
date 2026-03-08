import { runMigrations } from "./migrations.js";
import {
  IdentityDao,
  InstalledSkillsDao,
  KnowledgeDao,
  MessagesDao,
  MemoryDao,
  RepositoriesDao,
  RunsDao,
  SessionsDao,
  UsersDao
} from "./dao/index.js";
import {
  openSqliteConnection,
  type SqliteConnection,
  type SqliteConnectionOptions
} from "./sqlite-adapter.js";

export interface SqliteDatabaseOptions extends SqliteConnectionOptions {}

export class SqliteDatabase {
  readonly connection: SqliteConnection;
  readonly users: UsersDao;
  readonly repositories: RepositoriesDao;
  readonly sessions: SessionsDao;
  readonly messages: MessagesDao;
  readonly identity: IdentityDao;
  readonly memory: MemoryDao;
  readonly knowledge: KnowledgeDao;
  readonly runs: RunsDao;
  readonly installedSkills: InstalledSkillsDao;

  constructor(options: SqliteDatabaseOptions) {
    this.connection = openSqliteConnection(options);

    runMigrations(this.connection);

    this.users = new UsersDao(this.connection);
    this.repositories = new RepositoriesDao(this.connection);
    this.sessions = new SessionsDao(this.connection);
    this.messages = new MessagesDao(this.connection);
    this.identity = new IdentityDao(this.connection);
    this.memory = new MemoryDao(this.connection);
    this.knowledge = new KnowledgeDao(this.connection);
    this.runs = new RunsDao(this.connection);
    this.installedSkills = new InstalledSkillsDao(this.connection);
  }

  close(): void {
    this.connection.close();
  }
}

