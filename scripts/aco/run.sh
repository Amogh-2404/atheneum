#!/bin/zsh
# Atheneum Content Operations — nightly runner.
# Launches a headless Claude Code session that reads PROMPT.md and does ONE small,
# AAA, grounded content improvement, then commits locally + reports. Mirrors the
# proven JARVIS autonomous-session pattern (jarvis_autonomous_run.sh).
export HOME=/Users/r-amogh
# /usr/local/bin (Node 22) BEFORE /opt/homebrew/bin (Node 25): the server's native
# better-sqlite3 is built for Node 22's ABI, so any npm/node/tsx the daemon runs against
# the-codex must resolve to Node 22 too — otherwise a code-wish `npm install` would
# rebuild the addon for the wrong ABI and crash-loop the server.
export PATH="/Users/r-amogh/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
ROOT=/Users/r-amogh/the-codex
cd "$ROOT" || exit 1
mkdir -p "$ROOT/.aco/state"
PROMPT_FILE="${1:-$ROOT/scripts/aco/PROMPT.md}"
LABEL="${ACO_LABEL:-content}"
LOG="$ROOT/.aco/state/run-${LABEL}-$(date +%Y%m%d-%H%M%S).log"
BUDGET="${ACO_BUDGET:-10.00}"
MODEL="${ACO_MODEL:-opus}"

# Single-instance lock per label. The daemon re-fires every 30 min across its working-
# hours window; if a session is still going, the next firing must SKIP rather than run a
# second claude racing the same content. When this one finishes, the next firing picks up
# where it left off (resume-in-progress + the audit are stateful). PID-reuse-safe.
LOCKFILE="$ROOT/.aco/state/run-${LABEL}.lock"
if [ -f "$LOCKFILE" ]; then
  _oldpid=$(cat "$LOCKFILE" 2>/dev/null)
  if [ -n "$_oldpid" ] && kill -0 "$_oldpid" 2>/dev/null && ps -p "$_oldpid" -o command= 2>/dev/null | grep -q "run.sh"; then
    echo "aco[$LABEL]: a session is already running (pid $_oldpid) — skipping this firing"; exit 0
  fi
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT INT TERM

# Refresh + read the OAuth token so headless claude is authenticated. The keychain
# (via jarvis_auto_auth) is the source of truth; .claude_current_token is its cache.
# We only READ it — never touch the sacred JARVIS auth/token machinery.
/opt/homebrew/bin/python3 "$HOME/.jarvis/scripts/jarvis_auto_auth.py" --sync >/dev/null 2>&1 || true
TOK=$(cat "$HOME/.jarvis/config/.claude_current_token" 2>/dev/null)
[ -z "$TOK" ] && TOK=$(cat "$HOME/.jarvis/config/.claude_setup_token" 2>/dev/null)
if [ -z "$TOK" ]; then echo "aco: no OAuth token available — aborting" >&2; exit 1; fi
export CLAUDE_CODE_OAUTH_TOKEN="$TOK"

TEMP=$(mktemp)
/Users/r-amogh/.local/bin/claude \
  -p \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --model "$MODEL" \
  --effort "${ACO_EFFORT:-xhigh}" \
  --max-budget-usd "$BUDGET" \
  --verbose \
  < "$PROMPT_FILE" \
  > "$TEMP" 2>&1
EXIT=$?

# Distill the stream-json transcript into a readable run log.
/opt/homebrew/bin/python3 - "$TEMP" "$LOG" <<'PY'
import json, sys
tmp, out = sys.argv[1], sys.argv[2]
lines = []
for l in open(tmp, errors='ignore'):
    try:
        o = json.loads(l)
        if o.get('type') == 'assistant':
            for b in o.get('message', {}).get('content', []):
                if b.get('type') == 'text' and b.get('text', '').strip(): lines.append(b['text'])
                elif b.get('type') == 'tool_use': lines.append(f"  [{b.get('name')}] {str(b.get('input', {}))[:160]}")
        elif o.get('type') == 'result':
            lines.append(f"[result {o.get('subtype')}] cost=${o.get('total_cost_usd','?')} turns={o.get('num_turns','?')}")
    except Exception:
        pass
open(out, 'w').write('\n'.join(lines) or '(no transcript)')
PY
rm -f "$TEMP"
echo "aco run exit=$EXIT log=$LOG"
exit $EXIT
