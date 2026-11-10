# julebox

Cursor plugin marketplace for this account. It holds Matt Pocock's skills, the skills from this machine, and the global rules Cursor already applies here. The house rules require Grok 4.7. Each plugin sets `grokbot`, `sand`, and `claude` to `never`, so those clients do not list it.

The counts below are from the sync on 10 Nov 2026.

| Plugin | Contents |
| --- | --- |
| `house-rules` | 5 always-on rules |
| `mattpocock-skills` | 39 skills from [mattpocock/skills](https://github.com/mattpocock/skills) at `4ae2317`, MIT |
| `personal-skills` | 471 skills. 9 from `~/.cursor/skills`, 462 from `~/.agents/skills` |

The root `LICENSE` covers the scripts, the house rules, and the marketplace manifests. `mattpocock-skills/LICENSE` covers Matt Pocock's skills. `personal-skills/PROVENANCE.tsv` records the source path and any license found for each personal skill. 407 of those skills have no license in the frontmatter and no `LICENSE` file in the skill directory. This GitHub repository is public. Check a skill's terms before you treat the public copy as redistributable.

## Install the plugins on this machine

Cursor loads a local plugin from `~/.cursor/plugins/local/<plugin-name>`. Copy the directories. A symlink that points outside that folder is ignored.

```bash
mkdir -p ~/.cursor/plugins/local
cp -a house-rules mattpocock-skills personal-skills ~/.cursor/plugins/local/
```

Reload the window. Open Customize and confirm House rules, Matt Pocock skills, and Personal skills.

## Import the repository as a marketplace

On a Teams or Enterprise plan, open Dashboard, then Plugins & MCPs, then Add Marketplace, then Import from Repo. Paste this URL.

```text
https://github.com/julerex/julebox
```

Install the three plugins from Customize.

## Refresh from this machine

`npm run sync` rebuilds the three plugins.

It uses the clone at `.scratch/matt` when that directory exists. Otherwise it clones `https://github.com/mattpocock/skills`. `npm run sync -- --refresh` deletes that clone and clones again. The script flattens Matt's category folders to `skills/<name>`. It leaves out a skill from `~/.agents/skills` when every file in that skill is already in Matt's tree with the same bytes. `code-review` stays in both plugins. The local file is the Awesome Copilot review, and Matt's file is the two-axis review. The script inserts a Grok 4.7 paragraph into each skill copied from `~/.cursor/skills`.

`npm run check` validates `.cursor-plugin/marketplace.json` and each `plugin.json` against the Cursor schemas in `schemas/`. It checks the skill lists in `manifests/` against the tree. When the clone and the two local skill directories are present, it also checks those directories against the lists. A green run prints `All plugins validated successfully.` followed by the skill counts and a content hash.

## What stayed on the machine

`~/.cursor/skills-cursor` is Cursor's managed skill directory. This repository leaves it there.

The four global rules in `house-rules/rules/` are the account rules from this Cursor session. This machine has no `~/.cursor/rules` directory.
