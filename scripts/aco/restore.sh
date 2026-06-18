#!/bin/zsh
# Rehydrate Atheneum from a backup.sh archive onto a fresh machine (or a temp dir for
# a round-trip test). Fail-closed: every step is verified before the next. The restored
# content repo has its origin stripped, so the "never push content" invariant survives
# a restore. Set RESTORE_SKIP_BUILD=1 to verify only the data path (no npm ci/build).
set -u
export HOME=/Users/r-amogh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ARCHIVE="${1:-}"
TARGET="${2:-/Users/r-amogh/the-codex}"
APP_REPO="https://github.com/Amogh-2404/atheneum.git"
ZSTD=/opt/homebrew/bin/zstd
SQLITE=/usr/bin/sqlite3
die() { echo "restore: FATAL — $*" >&2; exit 1; }

[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || die "usage: restore.sh <archive.tar.zst> [target-dir]"
[ -e "$TARGET" ] && die "target '$TARGET' already exists — refusing to overwrite"

# 1) outer checksum
[ -f "$ARCHIVE.sha256" ] || die "missing $ARCHIVE.sha256"
( cd "$(dirname "$ARCHIVE")" && shasum -c "$(basename "$ARCHIVE").sha256" >/dev/null 2>&1 ) || die "outer checksum FAILED"
echo "restore: outer checksum ok"

# 2) extract
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM
"$ZSTD" -dq --long=27 -c "$ARCHIVE" | tar -xf - -C "$WORK" || die "extract failed"
MANIFEST="$WORK/manifest.json"
[ -f "$MANIFEST" ] || die "no manifest in archive"

# 3) verify every member checksum + the git bundle
/opt/homebrew/bin/python3 - "$WORK" "$MANIFEST" <<'PY' || die "member checksum mismatch"
import json,sys,hashlib,os
work,man=sys.argv[1],sys.argv[2]
m=json.load(open(man))
for name,want in m.get('members',{}).items():
    p=os.path.join(work,name)
    if not os.path.exists(p): print(f"  MISSING {name}"); sys.exit(1)
    if hashlib.sha256(open(p,'rb').read()).hexdigest()!=want: print(f"  MISMATCH {name}"); sys.exit(1)
print("restore: all member checksums ok")
PY
git bundle verify "$WORK/content.bundle" >/dev/null 2>&1 || die "content bundle verify FAILED"
echo "restore: content bundle verified"

# 4) app repo at the recorded HEAD
APP_HEAD=$(/opt/homebrew/bin/python3 -c "import json;print(json.load(open('$MANIFEST'))['app_head'])")
git clone --quiet "$APP_REPO" "$TARGET" || die "app clone failed"
git -C "$TARGET" checkout --quiet "$APP_HEAD" 2>/dev/null || echo "restore: WARN — app HEAD ${APP_HEAD:0:8} not on remote, staying on default branch"

# 5) content from the bundle, with origin stripped (never inherit a content remote)
rm -rf "$TARGET/content"
git clone --quiet "$WORK/content.bundle" "$TARGET/content" || die "content clone failed"
git -C "$TARGET/content" remote remove origin 2>/dev/null || true

# 6) re-apply the dirty worktree overlay + deletions (byte-faithful snapshot)
if [ -f "$WORK/content-worktree.tar" ]; then
  tar -xf "$WORK/content-worktree.tar" -C "$TARGET/content" || die "worktree overlay present but failed to extract"
fi
if [ -s "$WORK/.deleted-list" ]; then
  while IFS= read -r f; do [ -n "$f" ] && rm -f "$TARGET/content/$f"; done < "$WORK/.deleted-list"
fi

# 7) SQLite user-state
mkdir -p "$TARGET/.data"
DB_STATUS=absent
if [ -f "$WORK/atheneum.db" ]; then
  cp "$WORK/atheneum.db" "$TARGET/.data/atheneum.db"
  [ "$("$SQLITE" "$TARGET/.data/atheneum.db" 'PRAGMA integrity_check;' 2>/dev/null)" = "ok" ] || die "restored db failed integrity_check"
  DB_STATUS=ok
fi

# 8) stage plists (do NOT auto-load launchd — the operator decides when to go live)
mkdir -p "$TARGET/restore-meta"
cp "$WORK"/app-meta/*.plist "$TARGET/restore-meta/" 2>/dev/null || true

# 9) deps + build (skippable for a fast data-integrity round-trip)
if [ "${RESTORE_SKIP_BUILD:-0}" != "1" ]; then
  # Build under Node 22 (/usr/local/bin) so the native better-sqlite3 matches the server ABI
  # and engine-strict is satisfied.
  ( cd "$TARGET" && export PATH="/usr/local/bin:$PATH" \
      && npm ci >/dev/null 2>&1 && npm run db:rebuild >/dev/null 2>&1 && npm run build >/dev/null 2>&1 ) \
      || die "npm ci / build failed"
  [ -f "$TARGET/dist/index.html" ] || die "build produced no dist/index.html"
  echo "restore: deps installed + built"
else
  echo "restore: skipped build (RESTORE_SKIP_BUILD=1)"
fi

NB=$(ls -d "$TARGET"/content/*/ 2>/dev/null | wc -l | tr -d ' ')
CH=$(git -C "$TARGET/content" rev-parse --short HEAD 2>/dev/null)
NREMOTE=$(git -C "$TARGET/content" remote -v 2>/dev/null | wc -l | tr -d ' ')
echo "restore: stand-up complete — content@$CH, $NB books, db=$DB_STATUS, content-remotes=$NREMOTE (must be 0)"
echo "restore: plists staged in $TARGET/restore-meta/ — load them manually to go live"
