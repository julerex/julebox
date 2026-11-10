---
name: how-spawn
description: Pre-spawn check for a how explorer. Rejects a general-purpose Task whose prompt does not require read-only.
disable-model-invocation: true
---

Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.

# How spawn

Every how explorer is a general-purpose Task with `readonly: true`. The prompt contains the literal token `readonly: true` (see the how skill's `explorer-prompt.md`). The Task tool's readonly field never reaches `support/check-spawn.py`.

Before the Task spawn, run:

```bash
python3 support/check-spawn.py --role how-explorer --subagent generalPurpose --readonly --prompt "<prompt that contains readonly: true>"
```

A non-zero exit is a refusal. Do not spawn. A general-purpose explorer whose prompt lacks that literal token is refused. A different subagent type is refused, because how explorers stay on generalPurpose. Discard that explorer's harvest directory before any explainer or arena reads it.
