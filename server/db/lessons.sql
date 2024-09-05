-- Lesson hierarchy. Numbers here are small so no need for indexes.

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
  justification text not null,
  position integer not null
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
  chunks text, -- one sentence per line
  position integer not null
);

alter table lessons enable row level security;
create policy lessons_policy on lessons for all to anon using (true);

drop table if exists part_type cascade;
create table part_type (
  name text primary key not null
);
insert into part_type values ('review'), ('background'), ('dialog'), ('speak'), ('practice'), ('summary');

drop table if exists parts cascade;
create table parts (
  id serial primary key,
  lesson_id integer not null references lessons(id) on delete cascade,
  name text not null,
  type text not null references part_type(name),
  content text not null,            -- content provided by editors
  generated text,             -- jsonb generated from content
  status text default 'draft' check (status in ('draft', 'generated', 'ready')),
  position integer not null
);

alter table parts enable row level security;
create policy parts_policy on parts for select to anon using (true);

drop table if exists activity_type cascade;
create table activity_type (
  name text primary key not null
);
insert into activity_type values ('repeat'), ('translate'), ('guidedChat'), ('wordwall');

drop table if exists activities cascade;
create table activities (
	id serial primary key,
	part_id  integer references PARTS(ID) on delete cascade,
	name text not null,  -- The name of the activity
	type text not null references activity_type(name),  -- Type of activity (e.g., 'repeat', 'translate', 'guidedChat', etc)
	content text not null,       -- field to store activity-specific details
	generated text,       -- field to store activity-specific details
  status text default 'draft' check (status in ('draft', 'generated', 'ready')),
  position integer not null
);

alter table activities enable row level security;
create policy activities_policy on activities for select to anon using (true);

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
DROP VIEW IF EXISTS min_lesson_hierarchy;
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
                          'type', p.type,
                          'content', p.content,
                          'generated', p.generated,
                          'activities', (
                            SELECT jsonb_agg(
                              jsonb_build_object(
                                'id', a.id,
                                'name', a.name,
                                'type', a.type,
                                'generated', a.generated
                              )
                            ) FROM activities a WHERE a.part_id = p.id
                          ),
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

-- Create the trigger that fires the function on insert or update for AI generated content
CREATE OR REPLACE FUNCTION notify_parts_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Handle insert case. New generated.
    PERFORM pg_notify('parts_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'true')::text);
    NEW.status := 'draft';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for content change
    IF NEW.content <> OLD.content THEN -- New generated.
      PERFORM pg_notify('parts_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'true')::text);
      NEW.status := 'draft';
    ELSE
      -- Check for generated change only if content did not change
      IF NEW.generated <> OLD.generated THEN
        PERFORM pg_notify('parts_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'false')::text);
        NEW.status := 'generated';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the notify function to the parts table
DROP TRIGGER IF EXISTS notify_parts_gen_trigger ON parts;
CREATE TRIGGER notify_parts_gen_trigger
AFTER INSERT OR UPDATE ON parts
FOR EACH ROW
EXECUTE FUNCTION notify_parts_event();

-- Create the trigger that fires the function on insert or update for AI generated content for activities
CREATE OR REPLACE FUNCTION notify_activities_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_notify('activities_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'true')::text);
    NEW.status := 'draft';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.content <> OLD.content THEN
      PERFORM pg_notify('activities_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'true')::text);
      NEW.status := 'draft';
    ELSE
      IF NEW.generated <> OLD.generated THEN
        PERFORM pg_notify('activities_gen_event', json_build_object('id', CAST(NEW.id AS TEXT), 'flag', 'false')::text);
        NEW.status := 'generated';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the notify function to the activities table
DROP TRIGGER IF EXISTS notify_activities_gen_trigger ON activities;
CREATE TRIGGER notify_activities_gen_trigger
AFTER INSERT OR UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION notify_activities_event();

grant all on levels, modules, lessons, parts, lesson_hierarchy, min_lesson_hierarchy, lesson_type, part_type, activity_type, activities to admin;
grant select on levels, modules, lessons, parts, lesson_hierarchy, min_lesson_hierarchy, lesson_type, part_type, activity_type, activities to anon;
grant usage, select on sequence levels_id_seq, modules_id_seq, lessons_id_seq, parts_id_seq, activities_id_seq to admin;
