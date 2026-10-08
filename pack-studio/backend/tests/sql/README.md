# SQL tests

Runs the migration on a throwaway local Postgres (16+) with a tiny stand-in for Supabase's
`auth` schema and roles, then checks row-level security, the free project limit and payments.

```sh
createdb -h 127.0.0.1 -p 5432 -U postgres ps_test
psql -h 127.0.0.1 -U postgres -d ps_test -f 00_supabase_shim.sql \
     -f ../../supabase/migrations/0001_accounts_projects_payments.sql -f 10_migration_test.sql
```
