-- Function to fetch info about the schema

-- we create the view_column_usage view because the information_schema version of this won't provide any info unless it's run by the owner of the view (bug?)
drop view if exists cdbfly.view_column_usage;
create view cdbfly.view_column_usage as
SELECT DISTINCT (current_database())::information_schema.sql_identifier AS view_catalog,
 (nv.nspname)::information_schema.sql_identifier AS view_schema,
 (v.relname)::information_schema.sql_identifier AS view_name,
 (current_database())::information_schema.sql_identifier AS table_catalog,
 (nt.nspname)::information_schema.sql_identifier AS table_schema,
 (t.relname)::information_schema.sql_identifier AS table_name,
 (a.attname)::information_schema.sql_identifier AS column_name
FROM pg_namespace nv,
 pg_class v,
 pg_depend dv,
 pg_depend dt,
 pg_class t,
 pg_namespace nt,
 pg_attribute a
WHERE ((nv.oid = v.relnamespace) AND (v.relkind = 'v'::"char") AND (v.oid = dv.refobjid) AND (dv.refclassid = ('pg_class'::regclass)::oid) AND (dv.classid = ('pg_rewrite'::regclass)::oid) AND (dv.deptype = 'i'::"char") AND (dv.objid = dt.objid) AND (dv.refobjid <> dt.refobjid) AND (dt.classid = ('pg_rewrite'::regclass)::oid) AND (dt.refclassid = ('pg_class'::regclass)::oid) AND (dt.refobjid = t.oid) AND (t.relnamespace = nt.oid) AND (t.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'f'::"char", 'p'::"char"])) AND (t.oid = a.attrelid) AND (dt.refobjsubid = a.attnum));

grant select on cdbfly.view_column_usage to anon; -- Others will inherit

--- relations(tables and view), columns and keys
DROP FUNCTION if EXISTS cdbfly_get_schema;
CREATE FUNCTION cdbfly_get_schema() RETURNS table (schema json)
    LANGUAGE sql
    AS $_$
  select json_build_object('relations', jsonb_agg(tabs)) from (
		-- table info
    select table_catalog, table_schema, tables.table_name, table_type, is_insertable_into, is_typed,
      can_select, can_insert, can_update, can_delete,
      cols
    FROM information_schema.tables cross join lateral (
      -- Convert the Column info to JSON
      select jsonb_agg(cols) as cols from (
        -- Get the column info for a specific table
        select column_name, ordinal_position, column_default,
          is_nullable, data_type, character_maximum_length,
          datetime_precision, interval_type, interval_precision, 
          is_generated, is_updatable
          from information_schema.columns
            where
            (
            (table_schema = 'public') or
            (table_schema = 'cdbfly' and table_name in ('page', 'user_view', 'users', 'roles', 'file', 'template', 'app'))
            or table_schema in (select schema from cdbfly.app)
            )
          and table_name = tables.table_name
        ) cols 
    ) json_cols,
    (
      select a.table_name, b.rolname,
      HAS_TABLE_PRIVILEGE(rolname,table_schema||'.'||table_name, 'select') as can_select,
      HAS_TABLE_PRIVILEGE(rolname,table_schema||'.'||table_name, 'insert') as can_insert,
      HAS_TABLE_PRIVILEGE(rolname,table_schema||'.'||table_name, 'update') as can_update,
      HAS_TABLE_PRIVILEGE(rolname,table_schema||'.'||table_name, 'delete') as can_delete,
      HAS_TABLE_PRIVILEGE(rolname,table_schema||'.'||table_name, 'references') as refs
      from information_schema.tables a, pg_roles b
      where b.rolname=current_role
  ) perms
    where perms.table_name = tables.table_name
            and (
            (table_schema = 'public') or
            (table_schema = 'cdbfly' and perms.table_name in ('page', 'user_view', 'users', 'roles', 'file', 'template', 'app'))
            or table_schema in (select schema from cdbfly.app)
            )
    order by 1,2,3
  ) tabs 
union all
  -- Foreign and primary keys
	select json_build_object('keys', jsonb_agg(keys)) from (
    -- Primary keys
		SELECT
			tc.constraint_name,
			tc.constraint_type, tc.table_schema as source_schema,
			tc.table_name as source_table,
			kcu.column_name as source_column,
			ccu.table_schema AS target_table_schema,
			ccu.table_name AS target_table_name,
			ccu.column_name AS target_column_name
		FROM
			information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
			FULL OUTER JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name
			AND ccu.table_schema = tc.table_schema
			where tc.constraint_type = 'PRIMARY KEY'
    -- Foreign keys
		UNION SELECT
			o.conname AS constraint_name,
			'FOREIGN KEY' as constraint_type,
			(SELECT nspname FROM pg_namespace WHERE oid=m.relnamespace) AS source_schema,
			m.relname AS source_table,
			(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = m.oid AND a.attnum = o.conkey[1] AND a.attisdropped = false) AS source_column,
			(SELECT nspname FROM pg_namespace WHERE oid=f.relnamespace) AS target_schema,
			f.relname AS target_table,
			(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = f.oid AND a.attnum = o.confkey[1] AND a.attisdropped = false) AS target_column
		FROM
			pg_constraint o LEFT JOIN pg_class f ON f.oid = o.confrelid LEFT JOIN pg_class m ON m.oid = o.conrelid
		WHERE
			o.contype = 'f' AND o.conrelid IN (SELECT oid FROM pg_class c WHERE c.relkind = 'r')
		order by constraint_type, source_table, source_column
	) keys
union all
  select json_build_object('stats', jsonb_agg(stats)) from (
SELECT
  nspname AS schemaname,relname,reltuples as number_rows
FROM pg_class C
LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
WHERE
  nspname NOT IN ('pg_catalog', 'information_schema') AND
  relkind='r'
ORDER BY reltuples DESC
) stats
union all
  select json_build_object('roles', jsonb_agg(roles)) from (
    SELECT array (select name from cdbfly.roles) as roles
) roles
union all
select json_build_object('view_depend', jsonb_agg(view_depend)) from (
	select distinct deps.* from
	(
		SELECT dependent_ns.nspname as dependent_schema
		, dependent_view.relname as dependent_view
		, source_ns.nspname as source_schema
		, source_table.relname as source_table
		FROM pg_depend
		JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
		JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
		JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
		JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid
		AND pg_depend.refobjsubid = pg_attribute.attnum
		JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
		JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
	) deps,
	information_schema.tables AS tables
	where table_type = 'VIEW' and table_schema = 'public' and is_insertable_into = 'YES'
	and deps.dependent_schema = tables.table_schema and deps.dependent_view = tables.table_name
) view_depend
union all
select json_build_object('curr_role', jsonb_agg(curr_role)) from (
      select current_role as role
    ) curr_role
union all
select json_build_object('apps', jsonb_agg(apps)) from (
      select * from cdbfly.app as apps
    ) apps;
$_$;
