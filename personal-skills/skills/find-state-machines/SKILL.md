---
name: find-state-machines
description: >-
  Find implicit state machines in the current repo: stored modes, phase
  flags, and protocol steps that change which operations are legal, without
  a declared state enum or transition table. Use when the user says
  find-state-machines, /find-state-machines, or "Find all the implicit
  state machines in this repo".
disable-model-invocation: true
---

Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.

# Find state machines

Find all the implicit state machines in this repo.

Read only. Do not edit code, open a pull request, or refactor a machine into an enum unless the user asks for that after the report.

## What counts

An implicit state machine is stored control state that selects the next legal behavior, where the states and transitions are not declared together as one machine.

Count it when all of these hold:

- Something is remembered across calls: a field, a static, a closure, module state, a row, or a phase string.
- At least two remembered modes change which branch runs, which call is legal, or which step comes next.
- The modes and their edges are scattered: flags, status codes, early returns, "already" and "not yet" guards, or a step index. They are not one enum plus one transition function, one table, or a statechart library.

One machine can be several booleans. Name the combination, not each flag.

Leave these out of the implicit list:

- A declared machine: a state enum matched in one place, a transition table, or a statechart (XState, statig, boost::sml, SMC). Name those in the declared list.
- A config or feature flag that is set once and does not change later legal operations.
- A counter, buffer index, or retry count with no mode behind it.
- An error enum that is only returned, and does not gate a later call.
- Generated code, vendored trees, and build output.

A protocol split across functions is one machine. A queue index pair is a machine only when the indexes decide a mode (empty, full, needs signal), not merely how many bytes move.

## Scope

The repo is the git toplevel of the workspace. If that toplevel is `$HOME`, stop and ask which directory.

Skip `deps/`, `vendor/`, `third_party/`, `node_modules/`, `target/`, `build/`, `dist/`, and generated sources. Read the project's own code and the tests that show a transition.

## Search

1. Find declared machines first, so they are not reported as implicit. Search for state enums, `transition`, `statechart`, and the libraries above.
2. Search the remaining code for stored modes: `state`, `phase`, `stage`, `mode`, `status`, `ready`, `connected`, `in_flight`, `already`, `step`. Then read those sites. A hit is a candidate, not a finding.
3. For each candidate, read every write and every branch that reads it. Follow the helpers that set it.
4. Merge candidates that share one stored mode. Drop a candidate that fails "What counts".
5. On a repo with several top-level trees, split the read by tree. Use readonly explorers. You write the merged report. A small repo is one pass, with no explorers.

Do not stop at the search hits. The transitions are in the functions that assign the mode and in the branches that refuse work.

## Report

Lead with the count. Order machines by how many call sites share the mode, then by name.

For each machine:

### <short name>

- **Where:** path and the type or functions that store it
- **Remembered as:** the fields or variables, and the type (bool, integer, string, ad hoc enum)
- **States:** each inferred state, and the assignment that establishes it
- **Transitions:** event, from, to, and the function that performs it. Include the edge that is refused or ignored.
- **Why implicit:** one sentence on how the states are scattered

Add a `stateDiagram-v2` only when the machine has three or more states. Use the inferred state names. No styling.

If a transition is not in the code, omit it. If two readings fit, say so on that edge.

Close with **Declared machines**: one line each, path and type name. Write "None" when there are none.

Do not recommend a rewrite in the report. The finding is the machine.
