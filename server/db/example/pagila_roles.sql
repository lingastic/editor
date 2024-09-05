-- Roles for sample Pagila database

--- anon and admin roles exist by default on cdbfly

------------------ Anon -----------------
-- Anon should have access to films,  actors and related tables. 
-- Basically, this is info that we're OK with the public seeing
grant select on actor to anon;
grant select on category to anon;
grant select on film to anon;
grant select on film_actor to anon;
grant select on film_category to anon;
grant select on language to anon;
grant select on actor_info to anon;
grant select on film_list to anon;
grant select on nicer_but_slower_film_list to anon;


------------------ Staff -----------------
-- Staff has permission on full CRUD on most of the data tables since as part of their job is
-- to Add, update and delete customers, films, etc
drop role if exists staff; -- Staff: employees of our stores
create role staff inherit;
grant anon to staff; -- staff inherits all of anon's permissions
grant staff to authenticator; -- So that authenticator can become staff
-- Staff should have full permissions on these
grant all on actor, film, address, category, city, country, customer, film_actor, film_category, 
    inventory, language, payment, rental
  to staff;

-- Can view, but not change these
grant select on staff, store, customer_list, sales_by_film_category, sales_by_store, staff_list 
  to staff; 

------------------ Admin -----------------
--- admin already exists by default on cdbfly
--- admin has full permissions on all our tables and views
grant staff to admin; -- inherits all of staff's permissions
-- Only admin can change these
grant all on staff, store to admin;
-- Admin can edit 
grant all on staff, store, customer_list, sales_by_film_category, sales_by_store, staff_list 
  to admin;

-- The cdbfly.roles table has the list of roles in the system which is redundant, but provide an easy way to have 
-- foreign key constraints

insert into cdbfly.roles values ('staff') on conflict do nothing;

-- create sample users
delete from cdbfly.users where email = 'staff@pag.com';
delete from cdbfly.users where email = 'admin@pag.com';
insert into cdbfly.users values('staff@pag.com', 'xxxxxx', 'staff'); -- TODO, make sure to change the password in here
insert into cdbfly.users values('admin@pag.com', 'xxxxxx', 'admin'); -- TODO, make sure to change the password in here
