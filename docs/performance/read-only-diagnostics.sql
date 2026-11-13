-- Executed manually in Supabase SQL Editor on 2026-11-06.
-- No ANALYZE, writes, migrations, grants or statistics resets.
begin read only;
set local statement_timeout = '3s';
select tablename, policyname, roles::text, qual
from pg_policies where schemaname='public' and cmd='SELECT'
and tablename in ('records','hikers','hiker_season_stats','site_stats','partner_bookings','shop_invoices')
order by tablename,policyname;
rollback;

begin read only;
set local statement_timeout = '3s';
select c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions::text,
       has_table_privilege('anon',c.oid,'SELECT') as anon_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('records','hikers','hiker_season_stats','shop_invoices');
rollback;

begin read only;
set local statement_timeout='3s';
set local role anon;
explain (format text)
select id,hiker_id,event_id,distance_km,division,activity_date,record_status,is_corrected
from public.records order by activity_date desc limit 8;
rollback;

begin read only;
set local statement_timeout='3s';
set local role anon;
explain (format text)
select id,display_name,total_km,division,country from public.hikers
where profile_status='active' and division='gold' order by total_km desc;
rollback;

begin read only;
set local statement_timeout='3s';
select queryid::text,calls,round(total_exec_time::numeric,2) as total_ms,
       round(mean_exec_time::numeric,2) as mean_ms,rows
from pg_stat_statements where query ilike '%records%'
and query not ilike '%pg_stat_statements%' order by calls desc limit 5;
rollback;
