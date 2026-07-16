#!/bin/sh
set -eu

backup_file=${1:-}
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "Usage: RESTORE_CONFIRM=replace-eduground-data $0 <backup.dump>" >&2
  exit 1
fi
if [ "${RESTORE_CONFIRM:-}" != "replace-eduground-data" ]; then
  echo "Restore is destructive. Set RESTORE_CONFIRM=replace-eduground-data to continue." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose() {
    docker compose "$@"
  }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() {
    docker-compose "$@"
  }
else
  echo "Docker Compose is required." >&2
  exit 1
fi

checksum_file="${backup_file}.sha256"
if [ ! -f "$checksum_file" ]; then
  echo "Restore refused: required checksum file not found at $checksum_file" >&2
  exit 1
fi

backup_directory=$(dirname "$backup_file")
backup_name=$(basename "$backup_file")
if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$backup_directory"
    sha256sum --check "$(basename "$checksum_file")"
  )
else
  (
    cd "$backup_directory"
    shasum -a 256 --check "$(basename "$checksum_file")"
  )
fi

restore_list=$(mktemp "${TMPDIR:-/tmp}/eduground-restore-list.XXXXXX")
filtered_restore_list=$(mktemp "${TMPDIR:-/tmp}/eduground-restore-filtered.XXXXXX")
container_restore_list="/tmp/eduground-restore-list-$$"
app_was_stopped=false
restore_committed=false
cleanup_restore_artifacts() {
  rm -f "$restore_list" "$filtered_restore_list"
  compose exec -T postgres rm -f "$container_restore_list" >/dev/null 2>&1 || true
}
recover_restore() {
  status=$?
  trap - EXIT HUP INT TERM
  cleanup_restore_artifacts
  if [ "$app_was_stopped" = true ]; then
    if [ "$restore_committed" = false ]; then
      echo "Restore failed before commit. PostgreSQL rolled back the transaction; attempting to restart the previous app." >&2
      compose start app >/dev/null 2>&1 || true
    else
      echo "Restore data committed, but post-restore validation failed. The app remains stopped; recover forward or restore the previous backup before serving traffic." >&2
      compose stop app >/dev/null 2>&1 || true
    fi
  fi
  exit "$status"
}
trap recover_restore EXIT HUP INT TERM

# Validate the archive and create an explicit restore list before stopping
# learner traffic. Session table data is the one intentionally omitted item;
# restoring it could resurrect a session revoked after the backup.
compose exec -T postgres pg_restore --list < "$backup_file" > "$restore_list"
session_data_entries=$(
  awk '$4 == "TABLE" && $5 == "DATA" && $6 == "public" && $7 == "sessions" { count += 1 } END { print count + 0 }' \
    "$restore_list"
)
if [ "$session_data_entries" -ne 1 ]; then
  echo "Restore refused: expected exactly one public.sessions TABLE DATA entry." >&2
  exit 1
fi
awk '!( $4 == "TABLE" && $5 == "DATA" && $6 == "public" && $7 == "sessions" )' \
  "$restore_list" > "$filtered_restore_list"
chmod 600 "$filtered_restore_list"
postgres_container=$(compose ps --quiet postgres)
if [ -z "$postgres_container" ]; then
  echo "Restore refused: the PostgreSQL container is not running." >&2
  exit 1
fi
compose exec -T --user postgres postgres sh -ec \
  'umask 077; cat > "$1"' sh "$container_restore_list" < "$filtered_restore_list"

compose stop app
app_was_stopped=true

compose exec -T postgres sh -ec '
  exec pg_restore \
    --clean \
    --if-exists \
    --exit-on-error \
    --single-transaction \
    --use-list="$1" \
    --no-owner \
    --no-privileges \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB"
' sh "$container_restore_list" < "$backup_file"
restore_committed=true

compose run --rm migrate
compose run --rm database-bootstrap
compose up --detach --wait app

app_was_stopped=false
cleanup_restore_artifacts
trap - EXIT HUP INT TERM
echo "Restore completed and readiness passed."
