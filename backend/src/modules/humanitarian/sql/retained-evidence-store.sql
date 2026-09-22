-- Optional OFFLINE retained-evidence extension to GX-14; not an automatic migration.
-- Prerequisite: gx14-authority-store.sql. Apply only in a reviewed provisioned store.
-- No public reader or producer gains access to raw captures or observation evidence.
CREATE ROLE hum_retention_writer NOLOGIN;
GRANT USAGE ON SCHEMA hum_authority TO hum_retention_writer;

CREATE TABLE hum_authority.retained_capture (
  capture_key text PRIMARY KEY CHECK (capture_key ~ '^[0-9a-f]{64}$'),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  source_url text NOT NULL,
  captured_at timestamptz NOT NULL,
  approval_id text NOT NULL CHECK (length(approval_id) > 0),
  raw_bytes bytea NOT NULL CHECK (octet_length(raw_bytes) BETWEEN 1 AND 2097152),
  observation_key text NOT NULL,
  source_revision_id text NOT NULL,
  CHECK (encode(sha256(raw_bytes), 'hex') = artifact_sha256),
  UNIQUE (capture_key, observation_key, source_revision_id)
);
ALTER TABLE hum_authority.retained_capture OWNER TO hum_authority_writer;

CREATE TABLE hum_authority.retained_observation_revision (
  observation_key text NOT NULL,
  revision_ordinal integer NOT NULL CHECK (revision_ordinal >= 0),
  source_revision_id text NOT NULL,
  geometry_revision_id text NOT NULL,
  geometry_sha256 text NOT NULL CHECK (geometry_sha256 ~ '^[0-9a-f]{64}$'),
  capture_key text NOT NULL,
  evidence jsonb NOT NULL,
  predecessor_ordinal integer GENERATED ALWAYS AS
    (CASE WHEN revision_ordinal = 0 THEN NULL ELSE revision_ordinal - 1 END) STORED,
  PRIMARY KEY (observation_key, revision_ordinal),
  UNIQUE (observation_key, source_revision_id),
  FOREIGN KEY (capture_key, observation_key, source_revision_id)
    REFERENCES hum_authority.retained_capture (capture_key, observation_key, source_revision_id),
  FOREIGN KEY (observation_key, predecessor_ordinal)
    REFERENCES hum_authority.retained_observation_revision (observation_key, revision_ordinal),
  CHECK (coalesce(evidence->'observation'->>'observationKey' = observation_key, false)),
  CHECK (coalesce((evidence->'observation'->'revision'->>'revisionOrdinal')::integer = revision_ordinal, false))
);
ALTER TABLE hum_authority.retained_observation_revision OWNER TO hum_authority_writer;

CREATE FUNCTION hum_authority.refuse_retained_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Retained evidence is append-only';
END;
$$;
ALTER FUNCTION hum_authority.refuse_retained_mutation() OWNER TO hum_authority_writer;
REVOKE ALL ON FUNCTION hum_authority.refuse_retained_mutation() FROM PUBLIC;

CREATE TRIGGER retained_capture_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON hum_authority.retained_capture
FOR EACH STATEMENT EXECUTE FUNCTION hum_authority.refuse_retained_mutation();
CREATE TRIGGER retained_observation_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON hum_authority.retained_observation_revision
FOR EACH STATEMENT EXECUTE FUNCTION hum_authority.refuse_retained_mutation();

REVOKE ALL ON hum_authority.retained_capture, hum_authority.retained_observation_revision
FROM PUBLIC, hum_reader_role, hum_producer_role, hum_projection_writer;
GRANT SELECT, INSERT ON hum_authority.retained_capture, hum_authority.retained_observation_revision
TO hum_retention_writer;