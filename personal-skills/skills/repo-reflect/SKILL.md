---
name: repo-reflect
description: >-
  Mine the current chat for durable learnings and write them only to
  AGENTS.md and skills inside the git repo this chat is working in. Apply the
  accepted rows on a new branch from main and open a pull request. Use when
  the user says repo-reflect or /repo-reflect.
disable-model-invocation: true
---

Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.

# Repo reflect

Mine the current conversation for durable learnings, then write them into the repo this chat is working in.

Invoke when the user says "repo-reflect" or "/repo-reflect". Skip when the conversation is trivial, off-topic, or already covered by instructions the parent followed correctly. One-offs are not learnings.

Use only the reference files beside this skill. Poteto `/reflect` edits skills outside the repo. This skill does not.

## Write set

The only files you may create or modify are inside the session repo:

- `AGENTS.md` at the repo root, or an existing nested `AGENTS.md` when the learning is specific to that subtree
- a skill that belongs to the repo: its `SKILL.md`, plus files inside that skill directory

Create a missing root `AGENTS.md` when an Accepted learning is repo-wide agent guidance. Create a new skill only under the repo's skill root. Edit a skill in place wherever the repo already keeps it.

Do not create a nested `AGENTS.md` that does not already exist. Do not copy a skill into the repo or out of it.

These are outside the write set. Do not create or modify them, and do not file tickets for them:

- `~/.cursor/skills/`, `~/.cursor/skills-cursor/`, `~/.cursor/plugins/`, and any other checkout
- `plugins/cache/`, `.cursor/plugins/`, `node_modules/`, `vendor/`, `third_party/`
- a skill that is a git submodule, or a symlink whose target is outside the session repo
- rules, code, CI, and docs other than `AGENTS.md`

A lesson whose natural home is a global or plugin skill stays unapplied when it is general agent behavior. When that lesson is a fact about this repo, route the fact to this repo's `AGENTS.md` or an in-repo skill.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript in the `agent-transcripts/` directory the system prompt names. Do not glob across `~/.cursor/projects/*/`. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
ls -t <agent-transcripts>/*.jsonl <agent-transcripts>/*/*.jsonl <agent-transcripts>/*/subagents/*.jsonl 2>/dev/null | head -10
```

That covers the legacy flat (`<id>.jsonl`), current nested (`<id>/<id>.jsonl`), and subagent (`<parent>/subagents/<child>.jsonl`) layouts. For each candidate, read the first JSONL line. Take the file whose `message.content[0].text` contains the conversation's opening user prompt. If none matches, pass a tight digest of the session instead.

## 2. Resolve the session repo

The session repo is the git checkout this chat is working in.

1. Take the workspace path from the system prompt. If `git -C <workspace> rev-parse --show-toplevel` succeeds, that toplevel is the session repo.
2. If the workspace is not a git repo, collect the paths this conversation read and edited and run `git -C <parent> rev-parse --show-toplevel` on them. The session repo is the toplevel that contains that work.
3. If more than one toplevel contains the session's work, repeat steps 4–8 once per repo. Pass only that repo as `<SESSION_REPO>`. Drop a learning that has no single repo.
4. If no git repo can be identified, stop and ask. Do not fall back to the workspace parent or to `~/.cursor/skills`.
5. If the toplevel is `$HOME`, stop and ask which project directory is in scope.

## 3. Resolve the skill root

Find this repo's own skills:

```bash
find <session-repo> -name SKILL.md \
  -not -path '*/node_modules/*' \
  -not -path '*/plugins/cache/*' \
  -not -path '*/.cursor/plugins/*' \
  -not -path '*/vendor/*' \
  -not -path '*/third_party/*'
```

A skill root is the parent of `<skill-name>/SKILL.md`. For `.cursor/skills/port-and-smoke/SKILL.md`, the root is `.cursor/skills`.

- No skills yet: new skills go in `<session-repo>/.cursor/skills/<kebab-name>/`.
- Every existing skill shares one root: new skills go there.
- Several roots: edit existing skills in place, and put new skills in `<session-repo>/.cursor/skills/`.

Repo facts, commands, architecture gotchas, and conventions belong in `AGENTS.md`. A new skill is for a repeated multi-step workflow that has no real home in `AGENTS.md` or an existing in-repo skill.

## 4. Spawn three reviewers in parallel

One message, three `Task` calls, `subagent_type: generalPurpose`, agent mode (`readonly: false`). Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and readonly strips MCPs. Reviewers do not edit files. You are the only writer. Apply every Accepted row yourself.

Set `model` to `grok-4.7-xhigh-fast` for every reviewer. Do not take the model from a pstack role line. If the Task tool rejects that slug, use the closest valid `grok-4.7` slug from its error message or from the model list in the system prompt, and say which slug you used.

| Lens | `model` | Prompt template |
|---|---|---|
| Judgment | `grok-4.7-xhigh-fast` | `references/judgment-reviewer.md` |
| Tooling | `grok-4.7-xhigh-fast` | `references/tooling-reviewer.md` |
| Divergent | `grok-4.7-xhigh-fast` | `references/divergent-reviewer.md` |

Pass each template verbatim. Substitute the transcript path or digest, and the absolute session repo path, where marked. Reviewers return findings in the `Task` response body.

## 5. Synthesize

One `Task` call, `subagent_type: generalPurpose`, `model` `grok-4.7-xhigh-fast` (same fallback as the reviewers), agent mode (`readonly: false`). It spot-verifies citations through MCP, and readonly strips MCPs. Pass `references/synthesizer.md` verbatim, with the session repo path and each reviewer's full output inlined where marked. It returns Accepted / Rejected / Not applied.

## 6. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Not applied. Do not implement that mechanism, and do not leave a weaker `AGENTS.md` line in its place. If the fix is structural, this skill cannot apply it.

## 7. Apply

Present the full Accepted / Rejected / Not applied output. Show each Accepted row's absolute destination. Treat every Accepted row as approved and apply that set. Do not wait, and do not ask the user to pick a subset. Do not apply Rejected or Not applied rows, and do not file them anywhere.

If Accepted is empty, stop after the summary in section 8. Do not create a branch, commit, or pull request.

Otherwise, apply the edits on a new branch cut from `main`. Do not apply them on the feature branch the chat was using, and do not move that checkout's HEAD. Fetch `origin` and add a git worktree as a sibling of the session repo, named `<repo>-repo-reflect`, from `origin/main`, on a branch named `repo-reflect/<kebab-summary>`. If `origin/main` does not exist, stop and say so. Leave the session checkout's branch and uncommitted files as they are.

Check every target before writing:

1. `git -C <target-parent> rev-parse --git-common-dir` matches the session repo's common dir, and the session toplevel is not `$HOME`.
2. `realpath` of the target stays inside the worktree.
3. The target is `AGENTS.md`, or a file inside a skill directory that contains `SKILL.md`. For `new skill via create-skill`, the new directory is under the skill root and the first file is `SKILL.md`.
4. The path does not contain `node_modules`, `plugins/cache`, or `.cursor/plugins`.
5. The path is not a symlink pointing outside the worktree, and `git ls-files -s -- <path>` is not mode `160000`.

If a check fails, skip that row and say why.

Follow each Accepted row's Routing exactly:

- `AGENTS.md` edit: the parent writes it. Fold it into the section a future agent will look in. Match the file's existing voice. The Proposal is the wording. Do not add a session changelog.
- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly, in the worktree.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to Cursor's built-in `create-skill` skill and run its draft / test / iterate loop. Tell it the destination directory inside the worktree. The location is inside this repo, never `~/.cursor/skills/`.
- `tune description: <skill path>`: hand that in-repo skill to `create-skill` and run its description-optimization loop. The skill path is the copy in the worktree.
- `new skill via create-skill: <kebab-name>`: hand creation to `create-skill`. Destination is `<worktree>/<skill-root>/<kebab-name>/`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

Commit the applied edits in the worktree. Push `repo-reflect/<kebab-summary>` and open a pull request into `main` with `gh pr create`. The title says why these learnings were recorded. The body lists each applied edit in one line. Do not push to `main`. If the push or the pull request fails, report the branch state and leave the commit in place. After the pull request exists, remove the worktree.

## 8. Summarize for the user

Short list, no preamble:

- Session repo: `<path>`.
- Branch: `repo-reflect/<kebab-summary>` from `main`.
- Pull request: `<url>`.
- Edits applied: `<path>`. What changed, one line each.
- New skills created: `<path>`. One line each.
- Not applied: one line each, with the reason.
- Dropped: one line per rejected finding, with the synthesizer's reason.
