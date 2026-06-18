#!/bin/zsh
# Atheneum off-box backup. Produces ONE portable, checksummed archive and copies it to
# every available target (iCloud guaranteed, T7 best-effort). Content goes in as a git
# BUNDLE (a file, not a push) so sir's "never push content" rule is structurally
# guaranteed. The SQLite user-state goes in via the Online Backup API (consistent even
# while the server holds the WAL db open). Restore with restore.sh.
set -u
setopt pipefail   # a failed `tar` in `tar | zstd` must fail the run, not be hidden by zstd's exit
export HOME=/Users/r-amogh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ROOT=/Users/r-amogh/the-codex
CONTENT="$ROOT/content"
DB="$ROOT/.data/atheneum.db"
KEEP="${ATHENEUM_BACKUP_KEEP:-14}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="atheneum-backup-$STAMP"
ZSTD=/opt/homebrew/bin/zstd
SQLITE=/usr/bin/sqlite3

mkdir -p "$ROOT/.aco/state"
LOG_PREFIX="[backup $STAMP]"
log() { echo "$LOG_PREFIX $*"; }

# ── single-instance lock ───────────────────────────────────────────
LOCK="$ROOT/.aco/state/backup.lock"
if [ -f "$LOCK" ]; then
  oldpid=$(cat "$LOCK" 2>/dev/null)
  # Only honour the lock if that pid is REALLY a running backup.sh. A hard-killed run
  # (EXIT trap never fired) + pid reuse would otherwise suppress backups indefinitely.
  if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null && ps -p "$oldpid" -o command= 2>/dev/null | grep -q "backup.sh"; then
    log "another backup is running (pid $oldpid) — exiting"; exit 0
  fi
  log "reclaiming stale lock (pid ${oldpid:-unknown})"
fi
echo $$ > "$LOCK"

STAGE=$(mktemp -d)
PAYLOAD="$STAGE/payload"
mkdir -p "$PAYLOAD/app-meta"
cleanup() { rm -rf "$STAGE"; rm -f "$LOCK"; }
trap cleanup EXIT INT TERM

# ── 1) content: full-history bundle (file, never a push) ───────────
if ! git -C "$CONTENT" bundle create "$PAYLOAD/content.bundle" --all >/dev/null 2>&1; then
  log "FATAL: could not bundle content"; exit 1
fi
CONTENT_HEAD=$(git -C "$CONTENT" rev-parse HEAD 2>/dev/null)

# ── 2) dirty worktree overlay (faithful to the machine "as it is now") ──
( cd "$CONTENT" && git ls-files -m -o --exclude-standard -z 2>/dev/null \
    | tar --null -cf "$PAYLOAD/content-worktree.tar" -T - 2>/dev/null ) || true
git -C "$CONTENT" ls-files -d > "$PAYLOAD/.deleted-list" 2>/dev/null || true

# ── 3) SQLite user-state: consistent snapshot (never cp a live WAL db) ──
DB_STATUS=absent
if [ -f "$DB" ]; then
  if "$SQLITE" "file:$DB?mode=ro" ".timeout 5000" ".backup '$PAYLOAD/atheneum.db'" 2>/dev/null \
     && [ "$("$SQLITE" "$PAYLOAD/atheneum.db" 'PRAGMA integrity_check;' 2>/dev/null)" = "ok" ]; then
    DB_STATUS=ok
  else
    rm -f "$PAYLOAD/atheneum.db"; DB_STATUS=integrity_failed
    log "WARNING: db snapshot failed integrity_check — backing up without it"
  fi
fi

# ── 4) app metadata ────────────────────────────────────────────────
cp "$ROOT/package.json" "$PAYLOAD/app-meta/" 2>/dev/null || true
cp "$ROOT/package-lock.json" "$PAYLOAD/app-meta/" 2>/dev/null || true
cp "$CONTENT/_index.json" "$PAYLOAD/app-meta/" 2>/dev/null || true
for p in content-ops wishlist server backup; do
  cp "$HOME/Library/LaunchAgents/com.atheneum.$p.plist" "$PAYLOAD/app-meta/" 2>/dev/null || true
done

# ── 5) manifest (per-member sha256 + provenance + the de-listed-book beacon) ──
APP_HEAD=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null)
N_BOOKS=$(/opt/homebrew/bin/python3 -c "import json,sys; d=json.load(open('$CONTENT/_index.json')); print(len(d.get('books', d if isinstance(d,list) else [])))" 2>/dev/null || echo "?")
# books present in git history but not in the live index (ML/system-design safety beacon)
BEACON=$(git -C "$CONTENT" log --all --diff-filter=D --name-only --pretty=format: 2>/dev/null \
  | /usr/bin/grep -oE '^[a-z0-9-]+/book.json' | /usr/bin/sed 's#/book.json##' | /usr/bin/sort -u \
  | /opt/homebrew/bin/python3 -c "import sys,json; idx=set(json.load(open('$CONTENT/_index.json')).get('books',[]) if isinstance(json.load(open('$CONTENT/_index.json')),dict) else []); print(json.dumps([b.strip() for b in sys.stdin if b.strip()]))" 2>/dev/null || echo "[]")
{
  echo "{"
  echo "  \"stamp\": \"$STAMP\","
  echo "  \"app_head\": \"$APP_HEAD\","
  echo "  \"content_head\": \"$CONTENT_HEAD\","
  echo "  \"db_status\": \"$DB_STATUS\","
  echo "  \"books_in_index\": \"$N_BOOKS\","
  echo "  \"books_in_history_not_in_index\": $BEACON,"
  echo "  \"members\": {"
  first=1
  for f in content.bundle content-worktree.tar atheneum.db; do
    [ -f "$PAYLOAD/$f" ] || continue
    h=$(shasum -a 256 "$PAYLOAD/$f" | awk '{print $1}')
    [ $first -eq 0 ] && echo ","
    printf '    "%s": "%s"' "$f" "$h"; first=0
  done
  echo ""
  echo "  }"
  echo "}"
} > "$PAYLOAD/manifest.json"

# ── 6) one archive: tar payload → zstd ─────────────────────────────
ARCHIVE="$STAGE/$NAME.tar.zst"
if ! ( cd "$PAYLOAD" && tar -cf - . ) | "$ZSTD" -19 --long=27 -q -o "$ARCHIVE"; then
  log "FATAL: archive creation failed"; exit 1
fi
( cd "$STAGE" && shasum -a 256 "$NAME.tar.zst" ) > "$ARCHIVE.sha256"
SIZE=$(du -h "$ARCHIVE" | awk '{print $1}')
log "archive built ($SIZE, db=$DB_STATUS, content@${CONTENT_HEAD:0:8})"

# Self-verify BEFORE trusting it: re-extract and re-check every member sha against the
# manifest. This is the single safety net for sir's only copy of the content — a
# truncated/corrupt archive must never be copied out or used to prune older good ones.
VERIFY=$(mktemp -d)
if ! "$ZSTD" -dq --long=27 -c "$ARCHIVE" | tar -xf - -C "$VERIFY" 2>/dev/null; then
  rm -rf "$VERIFY"; log "FATAL: archive failed to re-extract (corrupt)"; exit 1
fi
if ! /opt/homebrew/bin/python3 - "$VERIFY" <<'PY'
import json, sys, hashlib, os
work = sys.argv[1]
m = json.load(open(os.path.join(work, 'manifest.json')))
for name, want in m.get('members', {}).items():
    p = os.path.join(work, name)
    if not os.path.exists(p) or hashlib.sha256(open(p, 'rb').read()).hexdigest() != want:
        print(f"  member {name} bad"); sys.exit(1)
sys.exit(0)
PY
then rm -rf "$VERIFY"; log "FATAL: archive self-verify failed (truncated/corrupt) — not distributing"; exit 1; fi
rm -rf "$VERIFY"
log "archive self-verified ok"

# ── 7) copy to every available target (independent; one failing never aborts) ──
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs/AtheneumBackups"
T7="/Volumes/T7 Shield/AtheneumBackups"
OK=0

# Run a command but hard-kill it if it exceeds N seconds (macOS ships no `timeout`).
# A flaky external drive (T7) makes cp block forever on EINTR; this bounds every I/O.
bounded() {
  local secs="$1"; shift
  "$@" & local pid=$!
  ( sleep "$secs"; kill -9 "$pid" 2>/dev/null ) & local wd=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill -9 "$wd" 2>/dev/null; pkill -9 -P "$wd" 2>/dev/null; wait "$wd" 2>/dev/null  # reap the watchdog's sleep too
  return $rc
}

copy_to() {
  local dest="$1" parent probe
  parent=$(dirname "$dest")
  [ -d "$parent" ] || { log "skip $dest (volume not mounted)"; return 1; }
  # Writability probe FIRST (bounded): T7 throws EINTR when flaky — catch it here so we
  # never reach a cp that would hang. iCloud passes instantly.
  probe="$parent/.atheneum_write_probe.$$"
  if ! bounded 5 touch "$probe" 2>/dev/null; then log "skip $dest (not writable / flaky volume)"; return 1; fi
  rm -f "$probe" 2>/dev/null
  bounded 10 mkdir -p "$dest" || { log "skip $dest (mkdir failed/timed out)"; return 1; }
  if bounded 90 cp "$ARCHIVE" "$dest/" && bounded 20 cp "$ARCHIVE.sha256" "$dest/" \
     && ( cd "$dest" && bounded 30 shasum -c "$NAME.tar.zst.sha256" >/dev/null 2>&1 ); then
    log "backed up → $dest"
    # retention: keep newest $KEEP. zsh glob (NOn) = nullglob + name-descending; the stamp
    # is chronological, and a glob is quote-safe where an `ls` pipe mangles paths with spaces.
    local -a _all _old
    _all=("$dest"/atheneum-backup-*.tar.zst(NOn))
    if (( ${#_all} > KEEP )); then
      _old=(${_all[$((KEEP + 1)),-1]})
      for f in "${_old[@]}"; do rm -f "$f" "$f.sha256"; log "pruned ${f:t}"; done
    fi
    return 0
  fi
  log "copy/verify FAILED → $dest"; return 1
}
copy_to "$ICLOUD" && OK=$((OK+1))
copy_to "$T7"     && OK=$((OK+1))

if [ "$OK" -eq 0 ]; then log "FATAL: no backup target succeeded"; exit 1; fi
log "done — $OK target(s)."
exit 0
