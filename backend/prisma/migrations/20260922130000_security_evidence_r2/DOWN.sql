-- R2 is an audit ledger, not disposable cache. Refuse rollback if any attempt is retained.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "SecurityProjectionRun") THEN RAISE EXCEPTION 'Retained Security audit evidence: backup and separate approval required'; END IF;
END $$;
DROP TABLE "SecurityProjectionMember";
DROP TABLE "SecurityObservation";
DROP TABLE "SecurityProjectionCompletion";
DROP TABLE "SecurityProjectionRun";
DROP FUNCTION security_r2_validate_member();
DROP FUNCTION security_r2_validate_completion();
DROP FUNCTION security_r2_validate_append();
DROP FUNCTION security_r2_immutable();
