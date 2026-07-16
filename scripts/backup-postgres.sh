#!/bin/sh
set -eu

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

backup_directory=${BACKUP_DIR:-./backups}
timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
target="${backup_directory}/python-eduground-${timestamp}.dump"
temporary="${target}.partial"

umask 077
mkdir -p "$backup_directory"
trap 'rm -f "$temporary"' EXIT HUP INT TERM

compose exec -T postgres sh -ec '
  exec pg_dump \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB"
' > "$temporary"

test -s "$temporary"
compose exec -T postgres pg_restore --list < "$temporary" >/dev/null
chmod 600 "$temporary"
mv "$temporary" "$target"
trap - EXIT HUP INT TERM

target_directory=$(dirname "$target")
target_name=$(basename "$target")
if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$target_directory"
    sha256sum "$target_name" > "${target_name}.sha256"
  )
else
  (
    cd "$target_directory"
    shasum -a 256 "$target_name" > "${target_name}.sha256"
  )
fi

echo "Backup created: $target"
echo "Checksum: ${target}.sha256"
