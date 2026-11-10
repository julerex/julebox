---
name: model-state-machines
description: >-
  Models each subsystem state machine as its own project-local formal-verification
  skill with /create-formal-verification-skill, then draws the most important
  user flows with /statechart. Use when the user asks to model these state
  machines, one skill per subsystem, formally verify subsystem state machines,
  or visualize the most important user flows.
disable-model-invocation: true
---

Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.

# Model state machines

use /create-formal-verification-skill to model these state machines, one skill per subsystem. and use /statechart to visualize my most important user flows

## Read both skills first

Read `/create-formal-verification-skill` and `/statechart` in full and follow them. Do not copy `/statechart` commands, options, or file paths into anything you write.

## One skill per subsystem

"These state machines" are the ones the user named. If they named none, find the state machines in the code.

Partition them into subsystems before you write anything. A subsystem is one boundary a person can name: one protocol, one service, one protection domain, or one user-facing machine. Do not split one machine across skills. Do not merge two machines that can fail apart from each other.

`/create-formal-verification-skill` picks a single strongest target for a repo. Here that rule applies inside one subsystem only. Run that skill once per subsystem, through its hand-off, including the scratch break and restoring the tree. Finish one subsystem and drop its scratch change before the next. Each generated skill is project-local, in that repo's `.cursor/skills/`. Leave product code unchanged unless the user asks.

## Charts of the important flows

After those skills exist, use `/statechart` on the most important user flows only. A user flow is a path a person walks: a screen, a result, a stored value, or a message they can see. An internal machine that nobody walks stays on its verify skill and off the charts, unless the user named that flow.

When a subsystem's check is already a TLA+ model of that flow, chart that model. When the check used another tool, or the flow crosses subsystems, write the flow's own model for the chart and say how it relates to the verify skills. Show each chart. Say what each model leaves out, and which steps a chart hides.

## Hand off

For each subsystem, say what you verified, which tool and why, the bounds, what the check found in plain words, how to run it, and what it does not cover. Then give the charts. Point at `/maintain-formal-verification-skill` for later drift.
