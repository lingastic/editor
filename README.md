# Lingastic curriculum editor

A tool to allow you to edit the Lingastic curriculum.

# Installation

## Setup your postgres database

## Server

### Set up your database and permissions

In the following examples we assume that you have the following info for the database
username: lingastic_owner
database: lingatic
host: localhost
port: 5432
password: yourpassword

- as a db superuser typically 'postgres' do the following

```

```

create user 'lingastic_owner' with password 'yourpassword';
create database lingatic;
grant all on database lingatic to lingastic_owner;
\c lingatic;
CREATE EXTENSION pgcrypto; -- Needed for authentication. This needs to be done by the superuser (ususally postgres)

```

```

For convenience you could also add to ~/.pgpass

```
localhost:5432:lingatic:lingastic_owner:yourpassword
```

This way you're not prompted for the password each time, but consider your security model.

- load the schema and the data TODO

```
```

Check your db and you should see something like the following.

```
                List of relations
 Schema |     Name      | Type  |      Owner
--------+---------------+-------+-----------------
 public | activities    | table | lingastic_owner
 public | activity_type | table | lingastic_owner
 public | chats         | table | lingastic_owner
 public | lesson_type   | table | lingastic_owner
 public | lesson_types  | table | lingastic_owner
 public | lessons       | table | lingastic_owner
 public | levels        | table | lingastic_owner
 public | modules       | table | lingastic_owner
 public | part_type     | table | lingastic_owner
 public | parts         | table | lingastic_owner
 public | parts_gen     | table | lingastic_owner
 public | users         | table | lingastic_owner
(
```

- Load lingastic.sql into that database

### set up the backend

- cd server/src
- npm install

## Connection config

- Look at server/run.sh

```
  source ~/.cdbfly
  export PGUSER=authenticator
  export PGHOST=localhost
  export PGPASSWORD=\${CDBFLY_PASS}
  export PGDATABASE=lingatic
```

Notice that it relies on a file ~/.cdbfly to hold the password; You can put it in a different location, but will need to adjust run.sh.
The file simply has the

```
CDBFLY_PASS=yourpassword
```

_Keep the password file outside the git tree so it never gets checked into git by accident_

npm run dev

## client setup

- in the root cdbly dir run
  - npm run build

# Limits

- updates only on tables with a primary key. The primary key needs to consist of a single column
- No hanling yet of many-to-mny relationship

# Features

## Automatic capabilities

- See the list of relations, tables and views, in your database
- For each table perform CRUD operations

  - Create a row
  - Read a row
  - Update a row
  - Delete a row

## Relation (tables and views) view

- Page through your table fetching the rows from the server
- Server side sorting of your data by clicking the top of your columns
- Server side smart searching, no need to specify fields

## Validation

- Validates for required fields
- Validates by data types:
  - Number
  - date
  - etc
- Provides links to follow foreign keys
- Insert/update provides a drop down to chose appropriate foreign keys.

## Authentication and Authorization

### Authentication

- No need for third party -- users stored in the db
- database enforces password encryption and authentication
-

### Authorization

- The database enforces password authorization
- Full use of rich capabilities of users and roles including
  - users belong to one or more roles
  - Roles can inhereit from each other
  - fine graned control of CRUD operations. In other words, users can be allowed for each table to have any combination of
    - Create
    - Read
    - Update
    - Delete

### Built in roles

The following are built in roles. Note however, that these roles have no permission to start with. It is up to you to assign them permissions. You can add as many other roles as you like and assign them permissions.

- authenticator -- the role that postgres runs as. You should not change its permissions.
- anon -- User that is not logged in. Do not assign any permissions or delete the role if you do not allow the public to see your data.

### Custom roles

Define your application specific roles and assign them permissions.

## UI follows permissions

- Users can only view tables and views when they have select/read permisssion
  - '+' icon on top only shows when they have insert/create permission
  - update and delete icons next to each row only show up when they have the appropriate permissions

## cdbfy.json

Create a file cdbfy.json in your home directory with the following structure.
Re;lase the "xxxxxxxxxxxxxx" values with the password for each role

{
"host": "localhost",
"database": "lingatic",
"roles": {
"authenticator": "xxxxxxxxxxxxxxxxxxxxxxxxx
"admin": "xxxxxxxxxxxxxxxxxxxxxxxxx",
"staff": "xxxxxxxxxxxxxxxxxxxxxxxxx",
"anon": "xxxxxxxxxxxxxxxxxxxxxxxxx"
}
}
