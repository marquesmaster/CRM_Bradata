#!/usr/bin/env bash
# Backup diário do Postgres do CRM Bradata.
# Adicionar ao crontab:
#   0 2 * * * /opt/crm-bradata/deploy/backup-db.sh >> /var/log/crm-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/crm-bradata}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/crm-bradata}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-crm}"
DB_NAME="${DB_NAME:-crm_bradata}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M)"
OUT="$BACKUP_DIR/crm_${STAMP}.sql.gz"

cd "$COMPOSE_DIR"
docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT"

find "$BACKUP_DIR" -type f -name 'crm_*.sql.gz' -mtime +"$RETAIN_DAYS" -delete
echo "Backup concluído: $OUT"
