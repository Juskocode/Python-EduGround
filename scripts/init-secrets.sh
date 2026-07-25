#!/bin/sh
set -eu

secret_directory=${SECRET_DIR:-./secrets}
owner_secret="${secret_directory}/postgres_password"
app_secret="${secret_directory}/app_database_password"

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate cryptographically random secrets." >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  echo "Usage: SECRET_DIR=./secrets $0" >&2
  echo "Credential rotation must update PostgreSQL before replacing these files." >&2
  exit 1
fi

if [ -e "$owner_secret" ] || [ -e "$app_secret" ]; then
  echo "Secrets already exist; refusing to overwrite active database credentials." >&2
  echo "Follow the credential-rotation runbook instead of deleting or replacing them." >&2
  exit 1
fi

umask 077
mkdir -p "$secret_directory"
openssl rand -base64 48 > "$owner_secret"
openssl rand -base64 48 > "$app_secret"
chmod 600 "$owner_secret" "$app_secret"

echo "Generated separate owner and runtime database secrets in $secret_directory."
echo "The directory is ignored by Git. Back it up in an approved secret manager."
