\getenv app_password APP_DATABASE_PASSWORD
\getenv owner_user PGUSER
\getenv database_name PGDATABASE

BEGIN;

SELECT 'CREATE ROLE eduground_app LOGIN'
 WHERE NOT EXISTS (
   SELECT 1
     FROM pg_catalog.pg_roles
    WHERE rolname = 'eduground_app'
 )
\gexec

ALTER ROLE eduground_app
  WITH LOGIN
       PASSWORD :'app_password'
       NOSUPERUSER
       NOCREATEDB
       NOCREATEROLE
       NOREPLICATION;

GRANT CONNECT ON DATABASE :"database_name" TO eduground_app;
GRANT USAGE ON SCHEMA public TO eduground_app;

-- Remove grants left by older broad-grant releases before applying the reviewed
-- per-table matrix. Future tables remain inaccessible until this file is updated.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM eduground_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM eduground_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM eduground_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM eduground_app;

GRANT SELECT, INSERT ON TABLE public.users TO eduground_app;
GRANT SELECT, INSERT, DELETE ON TABLE public.sessions TO eduground_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_state TO eduground_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_files TO eduground_app;
GRANT SELECT, INSERT, DELETE ON TABLE public.test_runs TO eduground_app;
GRANT SELECT ON TABLE public.schema_migrations TO eduground_app;
GRANT USAGE ON SEQUENCE public.test_runs_id_seq TO eduground_app;

COMMIT;
