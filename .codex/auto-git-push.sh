#!/bin/zsh
set -u

REPO_DIR="/Users/SPACE/Documents/Space Plataforma"
LOG_FILE="$REPO_DIR/.codex/logs/auto-git-push.log"
LOCK_DIR="$REPO_DIR/.git/auto-git-push.lock"
INTERVAL_SECONDS="${AUTO_GIT_INTERVAL_SECONDS:-60}"

log() {
  print -r -- "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

cd "$REPO_DIR" || exit 1
log "auto git push started"

while true; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    {
      branch="$(git branch --show-current 2>/dev/null || true)"
      if [[ -z "$branch" ]]; then
        log "skipped: no current branch"
      elif [[ -n "$(git status --porcelain)" ]]; then
        git add -A >> "$LOG_FILE" 2>&1
        if git diff --cached --quiet; then
          log "skipped: no staged changes"
        else
          msg="auto: sync $(date '+%Y-%m-%d %H:%M:%S')"
          if git commit -m "$msg" >> "$LOG_FILE" 2>&1; then
            if git push origin "$branch" >> "$LOG_FILE" 2>&1; then
              log "pushed: $msg"
            else
              log "push failed"
            fi
          else
            log "commit failed"
          fi
        fi
      fi
    } always {
      rmdir "$LOCK_DIR" 2>/dev/null || true
    }
  else
    log "skipped: lock active"
  fi

  sleep "$INTERVAL_SECONDS"
done
