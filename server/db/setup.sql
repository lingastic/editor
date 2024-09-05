-- Everything in here is done in the cdbfly schema
drop schema if exists cdbfly cascade;
create schema cdbfly;
set search_path to cdbfly;
set client_min_messages to warning;

--- Start setup JWT functions
-- From https://github.com/PostgREST/postgrest/blob/6fc9d5191a19c590d9b4b205138a6823c3852c9e/test/fixtures/jwt.sql
-- And in turn From michelp/pgjwt commit c02bbd3: https://github.com/michelp/pgjwt/blob/master/pgjwt--0.1.0.sql

CREATE OR REPLACE FUNCTION jwt_url_encode(data bytea) RETURNS text LANGUAGE sql AS $$
    SELECT translate(encode(data, 'base64'), E'+/=\n', '-_');
$$;


CREATE OR REPLACE FUNCTION jwt_url_decode(data text) RETURNS bytea LANGUAGE sql AS $$
WITH t AS (SELECT translate(data, '-_', '+/')),
     rem AS (SELECT length((SELECT * FROM t)) % 4) -- compute padding size
    SELECT decode(
        (SELECT * FROM t) ||
        CASE WHEN (SELECT * FROM rem) > 0
           THEN repeat('=', (4 - (SELECT * FROM rem)))
           ELSE '' END,
    'base64');
$$;


CREATE OR REPLACE FUNCTION jwt_algorithm_sign(signables text, secret text, algorithm text)
RETURNS text LANGUAGE sql AS $$
WITH
  alg AS (
    SELECT CASE
      WHEN algorithm = 'HS256' THEN 'sha256'
      WHEN algorithm = 'HS384' THEN 'sha384'
      WHEN algorithm = 'HS512' THEN 'sha512'
      ELSE '' END)  -- hmac throws error
SELECT cdbfly.jwt_url_encode(public.hmac(signables, secret, (select * FROM alg)));
$$;


CREATE OR REPLACE FUNCTION jwt_sign(payload json, secret text, algorithm text DEFAULT 'HS256')
RETURNS text LANGUAGE sql AS $$
WITH
  header AS (
    SELECT cdbfly.jwt_url_encode(convert_to('{"alg":"' || algorithm || '","typ":"JWT"}', 'utf8'))
    ),
  payload AS (
    SELECT cdbfly.jwt_url_encode(convert_to(payload::text, 'utf8'))
    ),
  signables AS (
    SELECT (SELECT * FROM header) || '.' || (SELECT * FROM payload)
    )
SELECT
    (SELECT * FROM signables)
    || '.' ||
    cdbfly.jwt_algorithm_sign((SELECT * FROM signables), secret, algorithm);
$$;


CREATE OR REPLACE FUNCTION jwt_verify(token text, secret text, algorithm text DEFAULT 'HS256')
RETURNS table(header json, payload json, valid boolean) LANGUAGE sql AS $$
  SELECT
    convert_from(cdbfly.jwt_url_decode(r[1]), 'utf8')::json AS header,
    convert_from(cdbfly.jwt_url_decode(r[2]), 'utf8')::json AS payload,
    r[3] = cdbfly.jwt_algorithm_sign(r[1] || '.' || r[2], secret, algorithm) AS valid
  FROM regexp_split_to_array(token, '\.') r;
$$;
--- End of setup JWT functions

--- Start cdbfly setup 

-- Create the roles  table
drop table if exists roles cascade;
create table roles (
  name text primary key
);

-- stored procedure to enfoce that we only allow roles that are derived from "authenticator"
create or replace function
check_role_allowed() returns trigger as $$
begin
  if not exists (
    select rolname FROM pg_roles WHERE (rolname = new.name) and  pg_has_role('authenticator', oid, 'member') and rolname  != 'authenticator' 
  ) then
    raise foreign_key_violation using message =
      'unknown database role: ' || new.role;
    return null;
  end if;
  return new;
end
$$ language plpgsql;

-- trigger to ensure that the "role" field in the users table only has roles that exist
drop trigger if exists ensure_role_exists on roles;
create constraint trigger ensure_role_exists
  after insert or update on roles
  for each row
  execute procedure check_role_allowed();


-- Create the users table
drop table if exists users;
create table users (
  email    text primary key check ( email ~* '^.+@.+\..+$' ),
  pass     text not null check (length(pass) < 512),
  role     name not null references roles(name)
);

-- Create the settings table
drop table if exists settings;
create table settings (
  name     text not null PRIMARY KEY,
  value    text not null
);

-- Create the pages table
drop table if exists page cascade;
create table page (
  name text primary key,
  role name not null references roles(name), -- which roles can access this
  text text,
  language text
);

-- Create the file table. Stores blobs/files
drop table if exists file cascade;
create table file (
  name text primary key,
  mimetype text not null,
  fsid text not null -- random name in file system
);

alter table cdbfly.page enable row level security;
create  policy page_view on cdbfly.page using( role in (SELECT rolname FROM pg_roles WHERE pg_has_role( current_role, oid, 'member')));

drop table if exists template cascade;
create table template (
  name text primary key,
  description text,
  template_page text references page(name), -- the page with the content of the template 
  regex text not null -- the regex for the pages this template applies to
);

drop table if exists app cascade;
create table app (
  name text primary key,
  description text,
  homepage text references page(name),
  schema text not null
);

-- Generate and save a random signature
delete from settings where name = 'sign';
insert into settings values ('sign', replace(public.gen_random_bytes(64)::text, '\x', ''));
insert into settings values ('jwt_expire ', 60*60*24); -- default to 24 hours expiration

-- Function to encrypt passwords
drop function if exists encrypt_pass;
create function
encrypt_pass() returns trigger as $$
begin
  if tg_op = 'INSERT' or new.pass <> old.pass then
    new.pass = crypt(new.pass, gen_salt('bf'));
  end if;
  return new;
end
$$ language plpgsql;

-- trigger to encrypt the password on insert or update
drop trigger if exists encrypt_pass on users;
create trigger encrypt_pass
  before insert or update on users
  for each row
  execute procedure encrypt_pass();

-- stored procedure to get the role of a user and cdbfly.curr_user based on their jwt token and their role in the user table
create or replace function
cdbfly.get_role(token text) returns text as $$
declare role_name text;
declare email text;
begin
	-- valid is only true when the token is validated
  select payload->>'role' as role, payload->>'email' as email from cdbfly.settings, cdbfly.jwt_verify(token, value) where name = 'sign' and valid = true into role_name, email;
  -- set role;
  IF (role_name <> '') THEN
    return (role_name);
  ELSE
    return 'anon';
  END IF;
end
$$ language plpgsql;

-- stored procedure to set the role of a user and cdbfly.curr_user based on their jwt token and their role in the user table
create or replace function
cdbfly.set_role(token text) returns text as $$
declare role_name text;
declare email text;
begin
	-- valid is only true when the token is validated
  select payload->>'role' as role, payload->>'email' as email from cdbfly.settings, cdbfly.jwt_verify(token, value) where name = 'sign' and valid = true into role_name, email;
  -- set role;
  IF (role_name <> '') THEN
    select set_config('role', role_name::text, false) into role_name;
    select set_config('cdbfly.curr_user', email, false) into email;
    return (role_name);
  ELSE
    select set_config('role', 'anon', false) into role_name;
    select set_config('cdbfly.curr_user', 'anon', false) into email;
    return 'anon';
  END IF;
end
$$ language plpgsql;

-- function to check the passed email and password. Returns the user's role
create or replace function
user_role(email text, pass text) returns name
  language plpgsql
  as $$
begin
  return (
  select role from cdbfly.users
   where users.email = user_role.email
     and users.pass = crypt(user_role.pass, users.pass)
  );
end;
$$;

-- create the jwt_token type
drop type if exists jwt_token cascade;
CREATE TYPE jwt_token AS (
  token text
);

-- login should be on the exposed schema
create or replace function
login(email text, pass text) returns cdbfly.jwt_token as $$
declare
  _role name;
  _sign text;
  result cdbfly.jwt_token;
begin
  -- check email and password
  select cdbfly.user_role(email, pass) into _role;
  select value from cdbfly.settings where name = 'sign' into _sign;
  if _role is null then
    raise invalid_password using message = 'invalid user or password';
  end if;

  select cdbfly.jwt_sign(
      row_to_json(r), _sign
    ) as token
    from (
      select _role as role, login.email as email,
-- TODO don't hard code expiration. Have it be a config in the db
      extract(epoch from now())::integer + (select value from cdbfly.settings where name = 'jwt_expire')::integer as exp
    ) r
    into result;
  return result;
end;
$$ language plpgsql security definer;

-- Create the basic roles. This can be done by user postgres. 
-- or the owner of the db which should have "createrole" properties
-- Use "alter role xxxxxx createrole" to change an existing role

---  authenticator
-- drop role if exists authenticator;
-- create role authenticator noinherit; -- The main role for postgrest
alter role authenticator with login;
grant usage on schema cdbfly to authenticator;
grant select on cdbfly.settings to authenticator;
grant select on cdbfly.roles to authenticator;
grant connect on database dev to authenticator;

---  anon
-- drop role if exists anon;
-- create role anon noinherit; -- Unauthenticated user. This is the public.
grant anon to authenticator; -- So that authenticator can become anon

-- Grant some basic permissions to anon, which trickles down to everyone
grant select on cdbfly.page to anon;
grant select on cdbfly.roles to anon;
grant select on cdbfly.file to anon;
grant select on cdbfly.template to anon;
grant select on cdbfly.app to anon;
grant usage on schema cdbfly to anon;

-- anon needs to be able to login
grant execute on function login(text,text) to anon;

---  admin
-- drop role if exists admin;
-- create role admin inherit; -- Admin user. Has the most privileges;
grant anon to admin; -- So that authenticator can become anon
grant admin to authenticator; -- So that authenticator can become admin
grant all on table cdbfly.page to admin;
grant all on table cdbfly.file to admin;
grant all on table cdbfly.app to admin;
grant all on table cdbfly.template to admin;
grant all on cdbfly.users to admin;

---  Insert default roles
insert into cdbfly.roles values ('anon') on conflict do nothing;
insert into cdbfly.roles values ('admin') on conflict do nothing;

set search_path to public;


-- create a trigger to notify when cdbfly.page gets change
-- adapted from https://gist.github.com/fritzy/5db6221bebe53eda4c2d
-- used mostly by the syncpages utility
CREATE OR REPLACE FUNCTION pages_change_notify() RETURNS trigger AS $$
DECLARE
  name text;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    name = NEW.name;
  ELSE
    name = OLD.name;
  END IF;
  PERFORM pg_notify('pages_change', json_build_object('table', TG_TABLE_NAME, 'name', name, 'type', TG_OP)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER if exists pages_notify_update ON cdbfly.page;
CREATE TRIGGER pages_notify_update AFTER UPDATE or INSERT or DELETE ON cdbfly.page FOR EACH ROW EXECUTE PROCEDURE pages_change_notify();
