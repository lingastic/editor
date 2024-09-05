drop table IF exists users;
create table if not exists users(
  id text primary key,
  name text,
  created_at timestamp with time zone not null default current_timestamp,
  updated_at timestamp with time zone not null default current_timestamp
);

drop table if exists chats;
create table if not exists chats(
  id serial primary key,
  user_id text references users(id) not null,
  messages jsonb not null,
  duration double precision not null,
  tokens int not null,
  cost decimal(10, 5) not null,
  created timestamp not null default current_timestamp
);
/*
alter table chats force row level security;
*/

-- CREATE POLICY user_chats_policy ON chats FOR SELECT USING (user_id = current_setting('jwt.claims.user_id')::uuid);

grant insert on chats, users  to admin;
grant all on chats, users to admin;

-- Lesson hierarchy. Numbers here are small so we don't bother with indexes.

drop table if exists levels cascade;
create table levels (
  id serial primary key,
  name text not null,       -- 'a1', 'a2', etc.
  description text not null
);

insert into levels (name, description) values ('A1', 'CEFR A1');

alter table levels enable row level security;
create policy levels_policy on levels for all to anon using (true);

drop table if exists modules cascade;
create table modules (
  id serial primary key,
  level_id integer references levels(id) on delete cascade,
  name text not null,
  description text not null,
  longDescription text not null,
  overview text not null,
  justification text not null
);

alter table modules enable row level security;
create policy modules_policy on modules for all to anon using (true);

COPY modules FROM stdin WITH CSV HEADER;
level_id,name,description,overview,justification
1,1,"Basic essentials","Small talk used in everyday conversation: how are you, the weather, etc.","Lays the groundwork for basic English communication, specifically tailored for Spanish speakers at the A1 level.","Hello and congratulations on starting your journey to learn English! This topic, ""Basic Essentials,"" is specially designed for you to make your first steps in learning English both enjoyable and effective.     
              In ""Basic Essentials,"" we will explore the very foundation of everyday English. You will learn how to:                                                                                                                   
                1.  Engage in Small Talk: Master the art of casual conversation, an essential skill for meeting new people and interacting in social situations.                                                                       
                2.  Use the Verb ""To Be"": Understand and correctly use one of the most important verbs in English, helping you describe yourself and the world around you.                                                             
                3.  Talk About Daily Activities and Places: Learn how to describe what you do every day and identify common places around you.                                                                                         
                Don't worry if English seems challenging at first. We will guide you through each step with clear explanations, practical examples, and interactive exercises. You'll find that with practice, you'll be able to use these basic essentials in your daily life, making your learning journey both rewarding and fun.   ","This topic lays the groundwork for basic English communication, specifically tailored for Spanish speakers at the A1 level. It focuses on introducing key vocabulary and grammatical structures essential for initiating conversations, making introductions, and discussing everyday topics. The lessons within this topic are designed to help learners quickly acquire the necessary skills to engage in simple dialogues and express basic ideas in English."
\.
-- set the sequence to the next value after the copy
SELECT setval('modules_id_seq', (SELECT MAX(id) FROM modules) + 1);

drop table if exists lesson_type cascade;
create table lesson_type (
  name text primary key not null
);
insert into lesson_type values ('Vocabulary'), ('Grammar'), ('Review');

drop table if exists lessons cascade;
create table lessons (
  id serial primary key,
  module_id integer not null references modules(id) on delete cascade,
  name text not null,
  type text not null references lesson_type(name),
  description text not null,
  vocabulary text, -- one word per line
  chunks text -- one sentence per line
);

alter table lessons enable row level security;
create policy lessons_policy on lessons for all to anon using (true);

drop table if exists parts cascade;
create table parts (
  id serial primary key,
  lesson_id integer not null references lessons(id) on delete cascade,
  name text not null,
  type text not null,
  activities text[],         -- an array of strings or json for structured activities
  content jsonb             -- jsonb to store structured content data
);

alter table parts enable row level security;
create policy parts_policy on parts for all to anon using (true);

DROP VIEW IF EXISTS lesson_hierarchy CASCADE;
CREATE VIEW lesson_hierarchy AS
SELECT jsonb_build_object(
  'levels', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'description', l.description,
        'modules', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'name', m.name,
              'description', m.description,
              'overview', m.overview,
              'justification', m.justification,
              'lessons', (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', les.id,
                    'name', les.name,
                    'type', les.type,
                    'description', les.description,
                    'vocabulary', les.vocabulary,
                    'chunks', les.chunks,
                    'parts', (
                      SELECT jsonb_agg(
                        jsonb_build_object(
                          'id', p.id,
                          'name', p.name,
                          'type', p.type,
                          'activities', p.activities,
                          'content', p.content
                        )
                      ) FROM parts p WHERE p.lesson_id = les.id
                    )
                  )
                ) FROM lessons les WHERE les.module_id = m.id
              )
            )
          ) FROM modules m WHERE m.level_id = l.id
        )
      )
    ) FROM levels l
  )
) AS full_hierarchy;

-- Minimized version of the lesson hierarchy with only the names and ids.
DROP VIEW IF EXISTS min_lesson_hierarchy CASCADE;
CREATE VIEW min_lesson_hierarchy AS
SELECT jsonb_build_object(
  'levels', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'modules', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'name', m.name,
              'lessons', (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', les.id,
                    'name', les.name,
                    'parts', (
                      SELECT jsonb_agg(
                        jsonb_build_object(
                          'id', p.id,
                          'name', p.name,
                          'content', p.content
                        )
                      ) FROM parts p WHERE p.lesson_id = les.id
                    )
                  )
                ) FROM lessons les WHERE les.module_id = m.id
              )
            )
          ) FROM modules m WHERE m.level_id = l.id
        )
      )
    ) FROM levels l
  )
) AS full_hierarchy;
grant all on levels, modules, lessons, parts, lesson_hierarchy, min_lesson_hierarchy, lesson_type   to admin;
grant usage, select on sequence levels_id_seq, modules_id_seq, lessons_id_seq to admin;
