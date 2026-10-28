-- Additive, isolated credential tables for installed Corsair 0.1.138.
-- Never copy legacy credentials or put public in this client's search_path.
CREATE SCHEMA IF NOT EXISTS creation_connectors;
CREATE TABLE IF NOT EXISTS creation_connectors.corsair_integrations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}', dek TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS creation_connectors.corsair_accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES creation_connectors.corsair_integrations(id),
  config JSONB NOT NULL DEFAULT '{}', dek TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, integration_id)
);
CREATE TABLE IF NOT EXISTS creation_connectors.corsair_entities (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES creation_connectors.corsair_accounts(id),
  entity_id TEXT NOT NULL, entity_type TEXT NOT NULL, version TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (account_id, entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS creation_connectors.corsair_events (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES creation_connectors.corsair_accounts(id),
  event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS creation_connectors.corsair_permissions (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, plugin TEXT NOT NULL,
  endpoint TEXT NOT NULL, args TEXT NOT NULL, tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', expires_at TEXT NOT NULL, error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
