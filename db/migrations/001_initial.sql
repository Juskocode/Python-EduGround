CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_normalized CHECK (email = LOWER(email)),
  CONSTRAINT users_display_name_length CHECK (CHAR_LENGTH(display_name) BETWEEN 2 AND 80)
);

CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE user_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_state_object CHECK (JSONB_TYPEOF(state) = 'object')
);

CREATE TABLE user_files (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id VARCHAR(128) NOT NULL,
  filename VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id),
  CONSTRAINT user_files_exercise_id_format
    CHECK (exercise_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  CONSTRAINT user_files_filename_length CHECK (CHAR_LENGTH(filename) BETWEEN 1 AND 120),
  CONSTRAINT user_files_content_size CHECK (OCTET_LENGTH(content) <= 262144)
);

CREATE INDEX user_files_updated_at_idx ON user_files(user_id, updated_at DESC);

CREATE TABLE test_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id VARCHAR(128) NOT NULL,
  scope VARCHAR(32) NOT NULL,
  passed_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  all_passed BOOLEAN NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT test_runs_exercise_id_format
    CHECK (exercise_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  CONSTRAINT test_runs_scope_format CHECK (scope ~ '^[a-z][a-z0-9_-]{0,31}$'),
  CONSTRAINT test_runs_counts_valid
    CHECK (passed_count BETWEEN 0 AND total_count AND total_count BETWEEN 0 AND 10000),
  CONSTRAINT test_runs_all_passed_consistent
    CHECK (all_passed = (total_count > 0 AND passed_count = total_count)),
  CONSTRAINT test_runs_results_array CHECK (JSONB_TYPEOF(results) = 'array')
);

CREATE INDEX test_runs_user_exercise_created_idx
  ON test_runs(user_id, exercise_id, created_at DESC);
