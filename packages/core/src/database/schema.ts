export const CURRENT_SCHEMA_VERSION = 14;

export const createBaseSchemaSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  default_backend TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  context_snapshot_json TEXT NOT NULL DEFAULT '{}',
  last_activity_at TEXT
);

CREATE TABLE IF NOT EXISTS repo_activity_log (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

CREATE INDEX IF NOT EXISTS idx_repo_activity_log_repo_created
ON repo_activity_log(repo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  backend TEXT NOT NULL,
  backend_session_id TEXT,
  mode TEXT NOT NULL DEFAULT 'ask',
  status TEXT NOT NULL DEFAULT 'active',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS session_fts
USING fts5(session_id UNINDEXED, title, summary);

CREATE TRIGGER IF NOT EXISTS sessions_ai
AFTER INSERT ON sessions BEGIN
  INSERT INTO session_fts(session_id, title, summary)
  VALUES (new.id, new.title, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS sessions_au
AFTER UPDATE ON sessions BEGIN
  DELETE FROM session_fts WHERE session_id = old.id;
  INSERT INTO session_fts(session_id, title, summary)
  VALUES (new.id, new.title, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS sessions_ad
AFTER DELETE ON sessions BEGIN
  DELETE FROM session_fts WHERE session_id = old.id;
END;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  client_message_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created
ON messages(session_id, created_at, id);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
USING fts5(message_id UNINDEXED, session_id UNINDEXED, content);

CREATE TRIGGER IF NOT EXISTS messages_ai_fts
AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(message_id, session_id, content)
  VALUES (new.id, new.session_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au_fts
AFTER UPDATE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
  INSERT INTO messages_fts(message_id, session_id, content)
  VALUES (new.id, new.session_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad_fts
AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  source_session_id TEXT,
  quality_score REAL NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  FOREIGN KEY (source_session_id) REFERENCES sessions(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_repo_status
ON knowledge_entries(repo_id, status);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  metadata TEXT NOT NULL DEFAULT '{}',
  change_summary TEXT,
  edited_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id),
  FOREIGN KEY (edited_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  entry_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY(entry_id, tag),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
USING fts5(entry_id UNINDEXED, title, content, summary);

CREATE TRIGGER IF NOT EXISTS knowledge_entries_ai
AFTER INSERT ON knowledge_entries BEGIN
  INSERT INTO knowledge_fts(entry_id, title, content, summary)
  VALUES (new.id, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_entries_au
AFTER UPDATE ON knowledge_entries BEGIN
  DELETE FROM knowledge_fts WHERE entry_id = old.id;
  INSERT INTO knowledge_fts(entry_id, title, content, summary)
  VALUES (new.id, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_entries_ad
AFTER DELETE ON knowledge_entries BEGIN
  DELETE FROM knowledge_fts WHERE entry_id = old.id;
END;

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  status TEXT NOT NULL,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  iterations INTEGER NOT NULL DEFAULT 0,
  usage_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS team_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  status TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS installed_skills (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'local',
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'installed',
  dependency_errors_json TEXT NOT NULL DEFAULT '[]',
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repo_id TEXT,
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active',
  source_kind TEXT NOT NULL DEFAULT 'conversation',
  source_ref TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_scope
ON memory_entries(user_id, repo_id, memory_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_access_log (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  session_id TEXT,
  access_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_access_log_memory
ON memory_access_log(memory_id, created_at DESC);
`;




