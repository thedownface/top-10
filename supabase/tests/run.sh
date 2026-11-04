#!/usr/bin/env bash
# Runs schema.sql and the rule tests on a throwaway local Postgres (Homebrew `postgresql`).
# Usage: supabase/tests/run.sh      Lines starting with FAIL are failures; "FAIL no error" on
# `select * from invites` and `delete from posts` is expected (RLS hides rows instead of erroring).
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR=$(mktemp -d); PORT=54329
export LANG=C LC_ALL=C
initdb -D "$DIR" -U postgres -A trust --no-locale >/dev/null
pg_ctl -D "$DIR" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DIR/log" start >/dev/null
trap 'pg_ctl -D "$DIR" stop -m fast >/dev/null; rm -rf "$DIR"' EXIT
sleep 1
p() { psql -h 127.0.0.1 -p $PORT -U postgres -q "$@"; }
p -c "create database t10"
p -d t10 -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql 2>&1 | grep -E "ERROR" || true
p -d t10 -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -E "ERROR" || true
p -d t10 -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -E "ERROR" && echo "schema is not re-runnable" || true
for f in supabase/tests/0[1-9]_*.sql; do echo "── $f"; p -d t10 -f "$f" 2>&1 | grep -v '^$'; done
