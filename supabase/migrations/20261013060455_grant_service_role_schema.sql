-- Edge functions use the service role to drain storage_cleanup_queue; table grants alone
-- aren't enough without access to the schema itself
grant usage on schema public to service_role;