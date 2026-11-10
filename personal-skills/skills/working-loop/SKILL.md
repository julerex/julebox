---
name: working-loop
description: >
  How to answer, land skill edits, and update pull requests for this user.
  Use when they report a boot, flash, or manual check, ask what they will see
  or what to do next, ask to update a PR or MR description, say a prescribed
  code change was not written, say reflect or repo-reflect, when a decision
  record disagrees with a boot they just reported, paste a failing job, ask
  to clean branches or land a pull request, point at review comments, ask for
  a global skill, say a boot line is missing a field or the screen looks
  stalled, or ask for steps they will run on the machine.
---

Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.

# Working loop

## Answer the step they are on

When they ask what they will do, what they will see, or what to bring back, answer that first: the action, the line or screen to expect, and the one observation to paste. The mechanism comes after that, in a few sentences.

A how-to or a "should I" stays an answer until they say to apply it.

## A named next change gets written

If they already asked to fix the failure, and the next step is a code or image change, write that change in the same turn. Do not stop after describing it.

When one panel or serial word stands for several failures, the change names the failed step. Leave the rest of that sequence alone until the new line says which step failed.

When a boot line leaves part of a register off the screen, the next image paints that part. Leave the sequence alone until the missing field is visible. A long silent stretch paints that work is still going. A panel that can lose lines past the bottom ends with a marker they can see.

They have not written drivers. When a hardware term is required for the next step, one sentence says what it is and which component owns it: CPU, firmware, card, or translator. A request for a document is the long form. The default answer stays the next action.

## Steps they will run

When they ask for steps they will run on the machine, write those steps into the repo in the same turn and give the same steps in the chat. Name the key, what it does, and whether Enter continues.

A write to a whole disk is an interactive prompt. It shows the device and waits for that exact path.

When a measurement overturns the theory the previous boots were chasing, write the explanation next to the code change. Name what the earlier attempts assumed and what the new boot showed.

## Pull request notes

When they report that a boot, flash, or manual check of the open pull request worked, add that result to the pull request description in the same turn, including the line they saw. When they ask to update the description, cover every change on the branch, not only the latest commit.

Commit and push only when they ask, including a diff-tab commit action.

When they paste a failing job and say to fix it, make that job green. A failure already on the default branch is in scope once they say to fix it.

When they point at review comments on a pull request, fix those comments.

When they ask to clean branches, delete local and remote branches whose pull requests are merged or closed and whose tips still match those pull requests. Open a pull request for an unmerged branch that has none.

When they say to land a pull request, update it with the default branch, mark it ready, wait until it is mergeable, then squash-merge.

When they say the default branch's logic wins a conflict, keep that control flow. The branch adds fields.

## Where skill edits go

Do not edit skills under `plugins/cache/`, and do not edit poteto's skills inside the project checkout. A change to those skills is a pull request on that skills repository. Apply the same edit under `~/.cursor/skills/` when that skill already lives there.

`/repo-reflect` writes only `AGENTS.md` and skills inside the session repo. It applies the Accepted rows without asking, on a new branch from `main`, then opens a pull request.

A skill they call global, or local global, is created under `~/.cursor/skills/<name>/`. Keep their sentence as the standing order. It loads only when they name it.

When a decision record and a boot disagree, re-read the record before treating the boot as forbidden. Update the record they name, and check the other records in that repo for the same stale claim. Those edits go on a branch from the default branch, not on the feature branch.
