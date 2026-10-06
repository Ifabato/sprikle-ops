-- Executed by the postgres image only when the data volume is first initialized.
-- Integration and E2E tests use this database; the development database is sprikle_ops.
CREATE DATABASE sprikle_ops_test;
