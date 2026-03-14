import { runMigrations } from "./migrations.js";
import {
  AgentTraceDao,
  IdentityDao,
  InstalledSkillsDao,
  KnowledgeGovernanceDao,
  KnowledgeImportsDao,
  KnowledgeSharingDao,
  KnowledgeDao,
  MemorySharingDao,
  MissionsDao,
  MessagesDao,
  MemoryDao,
  RepositoriesDao,
  RunsDao,
  SessionsDao,
  SkillWorkflowsDao,
  UsersDao
  ,WorkspacesDao
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
  readonly agentTrace: AgentTraceDao;
  readonly workspaces: WorkspacesDao;
  readonly knowledgeGovernance: KnowledgeGovernanceDao;
  readonly knowledgeImports: KnowledgeImportsDao;
  readonly knowledgeSharing: KnowledgeSharingDao;
  readonly skillWorkflows: SkillWorkflowsDao;
  readonly memorySharing: MemorySharingDao;
  readonly memory: MemoryDao;
  readonly knowledge: KnowledgeDao;
  readonly missions: MissionsDao;
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
    this.agentTrace = new AgentTraceDao(this.connection);
    this.workspaces = new WorkspacesDao(this.connection);
    this.knowledgeGovernance = new KnowledgeGovernanceDao(this.connection);
    this.knowledgeImports = new KnowledgeImportsDao(this.connection);
    this.knowledgeSharing = new KnowledgeSharingDao(this.connection);
    this.skillWorkflows = new SkillWorkflowsDao(this.connection);
    this.memorySharing = new MemorySharingDao(this.connection);
    this.memory = new MemoryDao(this.connection);
    this.knowledge = new KnowledgeDao(this.connection);
    this.missions = new MissionsDao(this.connection);
    this.runs = new RunsDao(this.connection);
    this.installedSkills = new InstalledSkillsDao(this.connection);
  }

  close(): void {
    this.connection.close();
  }
}


