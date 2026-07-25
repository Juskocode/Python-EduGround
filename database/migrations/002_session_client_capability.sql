ALTER TABLE sessions
  ADD COLUMN client_capability_hash CHAR(64);

-- Existing cookie-only sessions cannot prove that the request came from the
-- trusted application window rather than learner code in the same-origin
-- Python worker. Invalidate them during this security migration.
DELETE FROM sessions;

ALTER TABLE sessions
  ALTER COLUMN client_capability_hash SET NOT NULL,
  ADD CONSTRAINT sessions_client_capability_hash_format
    CHECK (client_capability_hash ~ '^[a-f0-9]{64}$');
