#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(git -C "$script_dir/.." rev-parse --show-toplevel)
cd "$repo_root"
mode=${1:-}
failed=0
marker="${TMPDIR:-/tmp}/startwave-guard-failed.$$"
rm -f "$marker"
trap 'rm -f "$marker"' EXIT HUP INT TERM

block() {
  printf '%s\n' "- $1: $2" >&2
  failed=1
}

check_path() {
  file=$1
  lower=$(printf '%s' "$file" | tr '[:upper:]' '[:lower:]')
  base=${lower##*/}
  case "$lower" in
    agents/*|*/agents/*|brain/*|factory/*|internal/*|private/*|*/private/*|prompts/*|policies/*|rules/*|secrets/*|*/secrets/*|skills/*|logs/*|*/logs/*|validation/*|*/validation/*|.startwave-agent/*|tools/*|games/bdo/tools/*|games/mir_kameadril/*|assets/data/bdo-*) block "$file" 'private, Factory, or owner-review path'; return 1 ;;
    agents.md|project_spec.md|project_vision.md|roadmap.md|design_system.md|codex-cheatsheet.md|cheatsheet-git.md|docs/changelog.md|docs/startwave_editorial_prompt.md|scripts/atlas-agent.ps1|scripts/startwave-agent.ps1) block "$file" 'explicitly private or pending owner review'; return 1 ;;
  esac
  case "$base" in .env|.env.*|auth.json) block "$file" 'credential or environment file'; return 1 ;; esac
  case "$lower" in *.db|*.key|*.log|*.pem|*.sqlite|*.sqlite-shm|*.sqlite-wal) block "$file" 'forbidden local-state extension'; return 1 ;; esac
  case "$lower" in
    .gitignore|.startwave-public-guard.json|.githooks/pre-commit|.githooks/pre-push|readme.md|changelog.md|contributing.md|commit_guide.md|testing.md|version.md|index.html|index_old.html|ai.html|bdo.html|entertainment.html|games.html|profile.html|services.html|assets/data/daily-cards.js|assets/data/daily-wave-data.js|docs/atlas_pre_migration_sha256.txt|docs/components.md|docs/startwave_checklist.md|docs/startwave_games_architecture.md|docs/startwave_pre_migration_inventory.md|docs/startwave_philosophy.md|docs/startwave_release.md|docs/startwave_style_guide.md|docs/startwave_terms.md|docs/publication_policy.md|scripts/publication-guard.sh|scripts/install-publication-guard.sh|scripts/install-publication-guard.ps1|apps/web/*|games/site/*|games/bdo/site/*|games/bdo/atlas/data/*|games/bdo/atlas/docs/*|ai/*|services/*|shared/*|infra/*|docs/architecture/*|assets/css/*|assets/images/*|assets/js/*|pages/*) return 0 ;;
    *) block "$file" 'path is not present in the public allowlist'; return 1 ;;
  esac
}

check_content() {
  file=$1
  spec=$2
  case "$file" in *.css|*.html|*.js|*.json|*.md|*.mjs|*.ps1|*.sh|*.toml|*.txt|*.yaml|*.yml) ;; *) return 0 ;; esac
  content_file=$(mktemp "${TMPDIR:-/tmp}/startwave-guard-content.XXXXXX")
  if ! git show "$spec" > "$content_file" 2>/dev/null; then rm -f "$content_file"; return 0; fi
  if grep -E -q -- '-----BEGIN (OPENSSH |RSA |EC )?PRIVATE KEY-----' "$content_file"; then block "$file" 'contains a private key marker'; fi
  if grep -E -q -- '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' "$content_file"; then block "$file" 'contains a GitHub token pattern'; fi
  if grep -E -i -q -- '(api[_-]?key|access[_-]?token|client[_-]?secret|password)[[:space:]]*[:=]' "$content_file"; then block "$file" 'contains a credential assignment'; fi
  if grep -E -q -- '/Users/[A-Za-z0-9._-]+/|[A-Za-z]:\\Users\\[^\\]+' "$content_file"; then block "$file" 'contains an absolute local user path'; fi
  rm -f "$content_file"
}

check_spec() {
  file=$1
  spec=$2
  if check_path "$file"; then check_content "$file" "$spec"; fi
  [ "$failed" -eq 0 ] || : > "$marker"
}

printf '%s\n' 'StartWave public publication guard'
case "$mode" in
  --staged)
    git diff --cached --name-only --diff-filter=ACMR | while IFS= read -r file; do check_spec "$file" ":$file"; done
    ;;
  --outgoing)
    while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do
      [ -n "${local_sha:-}" ] || continue
      case "$local_sha" in 0000000000000000000000000000000000000000) continue ;; esac
      case "${remote_sha:-}" in
        ''|0000000000000000000000000000000000000000) commits=$(git rev-list "$local_sha" --not --remotes) ;;
        *) commits=$(git rev-list --reverse "$remote_sha..$local_sha") ;;
      esac
      for commit in $commits; do
        git diff-tree --root --no-commit-id --name-only --diff-filter=ACMR -r "$commit" | while IFS= read -r file; do check_spec "$file" "$commit:$file"; done
      done
    done
    ;;
  *) printf '%s\n' 'Usage: publication-guard.sh --staged | --outgoing' >&2; exit 2 ;;
esac
if [ -e "$marker" ]; then
  printf '%s\n' 'PUBLICATION BLOCKED. No files were deleted or modified.' >&2
  exit 1
fi
printf '%s\n' 'PUBLICATION GUARD OK'
