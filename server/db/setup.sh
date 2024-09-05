#!/bin/bash

set -e

source ~/.pgenv
echo $DB_PARAMS

# Ensure that at least one DB_PASS_ environment variable is set
if [ $(env | grep -c "^DB_PASS_") -eq 0 ]; then
  echo "No environment variables starting with DB_PASS_ found."
  exit 1
fi

# Create roles and databases using psql
psql "$DB_PARAMS" <<EOF
  drop role anon, authenticator, admin;
  create role anon with login password '$DB_PASS_ANON';
  create role authenticator with login password '$DB_PASS_AUTHENTICATOR' noinherit;
  create role admin with login password '$DB_PASS_ADMIN' inherit;
EOF

psql "$DB_PARAMS" < setup.sql
psql "$DB_PARAMS" < metadata.sql
psql "$DB_PARAMS" < lingastic.sql
