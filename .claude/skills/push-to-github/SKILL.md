---
name: push-to-github
description: Run the full local gate, then add + commit + push in one shot. Handles both the main checkout and git worktrees.
allowed-tools: Bash(pnpm *) Bash(git *) Bash(node *) Bash(gh *) Bash(forge *)
argument-hint: [commit message]
---

You are executing the ship workflow for **subway** (`git@github.com:EthWiz/subway.git`).
Follow every step in order. Stop and ask the user before the final push.

The user may pass a commit message as `$ARGUMENTS`. If empty, draft one in Step 4.

**This repo has no remote CI.** `.github/workflows/` is empty. Nothing runs
after the push, so Step 1 is not a preview of a gate — it _is_ the gate.

---

## Step 0 — Detect worktree mode

Determine whether the cwd is the main checkout or a separate worktree. Both
`.claude/worktrees/<name>/` and `.codex/worktrees/<name>/` are in play, and
several agent sessions often have worktrees open at once.

- **Main checkout** — commit on `main`, push.
- **Worktree** — commit on the worktree branch, fast-forward-merge into `main`
  from the main checkout, push. No PR.

```bash
TOPLEVEL=$(git rev-parse --show-toplevel)

MAIN_WT=$(git worktree list --porcelain \
  | awk '
      /^worktree / { wt=substr($0,10); branch="" }
      /^branch / { branch=substr($0,8) }
      /^$/ { if (branch == "refs/heads/main") { print wt; found=1; exit } }
      END { if (!found && branch == "refs/heads/main") print wt }')

if [ -n "$MAIN_WT" ] && [ "$TOPLEVEL" != "$MAIN_WT" ]; then
  MODE=worktree
else
  case "$TOPLEVEL" in
    */.claude/worktrees/*|*/.codex/worktrees/*) MODE=worktree ;;
    *)                                          MODE=main ;;
  esac
fi

if [ "$MODE" = "worktree" ]; then
  [ -n "$MAIN_WT" ] || { echo "Could not locate main worktree" >&2; exit 1; }
  WT_BRANCH=$(git symbolic-ref --short HEAD)
  WT_PATH="$TOPLEVEL"
fi
echo "MODE=$MODE MAIN_WT=${MAIN_WT:-n/a} WT_BRANCH=${WT_BRANCH:-n/a}"
```

---

## Step 1 — Local gate (hard gate)

Re-run this against the current tree even if you "just ran the tests" earlier
in the session.

### 1a. Doc-only fast path

If the diff touches **only** documentation, skip the suite.

Iterate **line by line**, never `for f in $CHANGED`. This session's shell is
zsh, which does **not** word-split an unquoted expansion: `for f in $CHANGED`
runs once with every filename joined into one blob, and if that blob ends in
`.md` it matches the `*.md` arm and reports doc-only for a diff full of
TypeScript — silently skipping the whole gate. `while read` is split-safe in
both shells.

```bash
DIFF_RANGE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null)
CHANGED=$(git diff --name-only "$DIFF_RANGE" HEAD; git diff --name-only HEAD; git ls-files --others --exclude-standard)
DOC_ONLY=1
NON_DOC=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    *.md|docs/*|README.md|.claude/skills/*) ;;
    *) DOC_ONLY=0; NON_DOC="$f" ;;
  esac
done <<EOF
$CHANGED
EOF
echo "doc_only=$DOC_ONLY files=$(printf '%s\n' "$CHANGED" | grep -c .) first_non_doc=${NON_DOC:-none}"
```

**Sanity-check the verdict.** If `doc_only=1` but `files=` is large, or you know
you changed code, the detector is wrong — run 1b. A false `1` skips the gate; a
false `0` costs a few minutes. Resolve doubt toward running the suite.

### 1b. Full gate

```bash
pnpm run check
```

That chains `format:check → lint → typecheck → test → contracts:fmt:check →
contracts:build → contracts:test`. Because it is `&&`-chained, reaching the
contract tests means everything before it passed.

**`pnpm run check` does not cover `apps/web`.** Root `tsconfig.json` excludes
`apps/web`, and `eslint.config.mjs` ignores `apps/**`. Only Prettier reaches it
(`format:check` globs `**/*.{ts,tsx,md,json}`). So if the diff touches
`apps/web/**`, a green `check` is a **false all-clear** — also run:

```bash
pnpm --filter @subway/web exec tsc -p tsconfig.json --noEmit
pnpm --filter @subway/web exec next build
```

> **Gotcha — `next build` breaks a running dev server.** It overwrites
> `apps/web/.next`, which a live `next dev` is reading, and the running app
> starts throwing `Cannot find module './###.js'` and 404s on chunks. The source
> is fine. If a preview server is up, stop it, `rm -rf apps/web/.next`, and
> restart it after the build. Do not debug the phantom errors.

> **Gotcha — stale browser console.** Console messages persist in a browser tab
> across dev-server restarts, so errors from a mid-edit snapshot keep showing
> after the fix. Confirm in a fresh tab before believing them.

If anything fails, stop and fix it. While iterating, re-run only the failed
check. **Before pushing, the whole gate must pass together on the final tree**,
in one pass, with no edits after — a fix that satisfies one check can break
another. "Each passed at some point" is not the gate.

---

## Step 2 — Assess the change

```bash
git diff --stat
git status --short
```

Classify and announce: **patch** (1–2 files, <~50 lines), **minor** (3–8 files
or ~50–200 lines), **major** (new subsystem or architectural change).

**Watch for incidental churn.** `contracts/foundry.lock` picks up lines from any
`forge build`, `pnpm-lock.yaml` moves on any install, and `apps/web/.next` and
`node_modules` are ignored but adjacent. Submodule pointers
(`contracts/lib/{forge-std,openzeppelin-contracts,v4-core}`) must never move
unintentionally — a stray submodule bump is a silent dependency change. Build
an explicit in-scope file list here; Step 5 uses it.

---

## Step 3 — Documentation

Skip for **patch**. For **minor** and **major**, check whether the change makes
any of these wrong, and say what you concluded — "no doc update needed" is the
common case, not the exception:

- `README.md` — especially its "Not built yet" list, which is a promise about
  what does _not_ exist.
- `docs/plan.md` — the design of record.
- `docs/decisions.md` — append a decision record when the change settles a
  question that was open, or opens one.
- `apps/web/README.md` — if the change touches the web app.

This repo's documentation is deliberately honest about what is unbuilt,
ungraded and unaudited. If a change makes a claim more true or less true,
update the claim in the same commit.

---

## Step 4 — Summary and approval

| Item             | Status                          |
| ---------------- | ------------------------------- |
| `pnpm run check` | pass/fail                       |
| `apps/web` gate  | pass / not applicable           |
| Classification   | patch / minor / major           |
| Docs updated     | yes (which file) / no / skipped |

Then show the exact commands you will run, with the explicit file list from
Step 2. Draft the commit message if `$ARGUMENTS` was empty: conventional-commit
style, `type: concise description`, and end with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Ask: **"Ship it?"** Do not proceed without explicit approval.

---

## Step 5 — Ship

Run the variant matching Step 0. Use specific paths in `git add` — never
`git add .` or `git add -A`.

### 5a — Main checkout

```bash
git add <specific files> && git commit -m "<message>" && git push
```

### 5b — Worktree

```bash
# 1. Commit the in-scope files on the worktree branch
git add <specific files>
git commit -m "<message>"

# 2. Rebase onto current origin/main so the ff-merge below succeeds even if
# another worktree shipped while this one was open. The branch was never
# pushed, so this is a safe local rewrite.
git fetch origin
git rebase origin/main
```

If the rebase conflicts, two worktrees touched the same lines. Resolve in the
worktree, `git rebase --continue`, then **re-run this skill from Step 1, not
from here** — conflict-resolved files have not passed the gate. Do not
`git rebase --abort` and ship anyway; the ff-merge will just fail.

Then land it from the main checkout:

```bash
cd "$MAIN_WT"

# 3. Set aside any WIP on main.
#
# The stash stack is SHARED across every worktree and every concurrent agent
# session in this repo. A bare `git stash pop` can restore someone else's work.
# Always tag the entry, capture its SHA, apply by SHA, and drop by tag.
STASH_TAG="ship-$WT_BRANCH-$(date +%s)"
STASH_SHA=""
if [ -n "$(git status --porcelain)" ]; then
  git stash push -u -m "$STASH_TAG"
  STASH_SHA=$(git stash list --format='%H %gs' | grep -F "$STASH_TAG" | head -1 | cut -d' ' -f1)
  echo "stashed main WIP as $STASH_TAG ($STASH_SHA)"
fi

# 4. Bring main up to the remote tip; bails if local main diverged
git switch main
git fetch origin
git merge --ff-only origin/main

# 5. Fast-forward main to the worktree branch tip
git merge --ff-only "$WT_BRANCH"

# 6. Push
git push origin main

# 7. Remove the shipped worktree. The push already landed, so failures here
# are reported, not fatal.
git worktree remove --force "$WT_PATH" || echo "worktree cleanup failed: $WT_PATH"
git branch -d "$WT_BRANCH" || echo "branch prune failed: $WT_BRANCH"

# 8. Restore the WIP by SHA, then drop that entry by tag.
if [ -n "$STASH_SHA" ]; then
  git stash apply "$STASH_SHA" || echo "stash apply hit conflicts — resolve manually"
  STASH_REF=$(git stash list --format='%gd %gs' | grep -F "$STASH_TAG" | head -1 | cut -d' ' -f1)
  [ -n "$STASH_REF" ] && git stash drop "$STASH_REF"
fi
```

Failure handling:

- `git merge --ff-only origin/main` fails → local `main` has unpushed commits.
  Stop and tell the user; do not auto-rebase or force.
- `git merge --ff-only "$WT_BRANCH"` fails → unexpected after a clean rebase.
  Surface `git log --oneline "$WT_BRANCH"..main`; do not retry blindly.
- `git stash apply` conflicts → leave it; the push already landed. Tell the
  user the stash SHA and stop touching it.
- Worktree/branch cleanup fails → report the path or branch needing manual
  cleanup and treat the ship as pushed.

**Post-ship gotcha — dangling `node_modules`.** pnpm can route a checkout's
`node_modules` symlinks through the removed worktree's store, so the next
`pnpm typecheck` fails with `Cannot find module …/typescript/bin/tsc` even
though nothing changed. Fix with `pnpm install` in the affected checkout. Do
not pre-emptively reinstall across every open worktree.

---

## Step 6 — Report

There is no remote CI to wait for. Report:

- the pushed SHA and branch,
- whether worktree and branch cleanup succeeded,
- whether a stash is still outstanding,
- any other open worktrees that may now need `pnpm install`.

If `.github/workflows/` ever gains a workflow, add a non-blocking
`gh run list --limit=1` here — but never block the ship on it.
