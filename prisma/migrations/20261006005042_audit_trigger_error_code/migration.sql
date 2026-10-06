-- Use PostgreSQL's default raise_exception SQLSTATE (P0001) for the append-only triggers.
-- The initial migration used 23001 (restrict_violation), which Prisma reports as
-- P2003 "Foreign key constraint violated", hiding the real reason. Triggers are
-- unchanged; only the function body is replaced.
CREATE OR REPLACE FUNCTION "prevent_audit_record_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only (% is not allowed)', TG_TABLE_NAME, TG_OP;
END;
$$;
