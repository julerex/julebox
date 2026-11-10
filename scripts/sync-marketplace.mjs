#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.HOME || homedir();
const mattClone = process.env.JULEBOX_MATT_CLONE || join(root, ".scratch/matt");
const agentsDir = process.env.JULEBOX_AGENTS_SKILLS || join(home, ".agents/skills");
const cursorDir = process.env.JULEBOX_CURSOR_SKILLS || join(home, ".cursor/skills");
const mattUrl = "https://github.com/mattpocock/skills.git";

const cursorOnly = {
  claude: "never",
  grokbot: "never",
  sand: "never",
};

const modelOverride = [
  "",
  "Model override for this marketplace. Use Grok 4.7 only. The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.",
  "",
].join("\n");

const privateKey =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{40,}-----END [A-Z ]*PRIVATE KEY-----/;

function writeJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeLines(path, lines) {
  mkdirSync(dirname(path), { recursive: true });
  const body = [...lines].sort().join("\n");
  writeFileSync(path, body.length > 0 ? `${body}\n` : "");
}

function frontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return "";
  const end = text.indexOf("\n---", 3);
  if (end < 0) return "";
  return text.slice(text.indexOf("\n") + 1, end);
}

function field(block, key) {
  const match = block.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, "m"));
  if (!match) return null;
  return match[1].replace(/^["']|["']$/g, "").trim();
}

function ensureMattClone() {
  if (process.argv.includes("--refresh")) {
    rmSync(mattClone, { recursive: true, force: true });
  }
  if (!existsSync(join(mattClone, "skills"))) {
    mkdirSync(dirname(mattClone), { recursive: true });
    execFileSync("git", ["clone", "--depth", "1", mattUrl, mattClone], {
      stdio: "inherit",
    });
  }
}

function findMattSkills(skillsRoot) {
  const found = [];
  const walk = (dir, category) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(dir, entry.name);
      if (existsSync(join(path, "SKILL.md"))) {
        found.push({ name: entry.name, path, category });
      } else {
        walk(path, entry.name);
      }
    }
  };
  walk(skillsRoot, "");
  const names = found.map((skill) => skill.name);
  const dupes = names.filter((name, index) => names.indexOf(name) !== index);
  if (dupes.length > 0) {
    throw new Error(`duplicate Matt skill names: ${dupes.join(", ")}`);
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function directSkills(dir) {
  if (!existsSync(dir)) {
    throw new Error(`skill source missing: ${dir}`);
  }
  return readdirSync(dir)
    .filter((name) => {
      try {
        return statSync(join(dir, name, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function copySkill(src, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter(source) {
      const base = basename(source);
      return base !== ".git" && base !== "node_modules" && base !== ".DS_Store";
    },
  });
}

function injectModelOverride(skillFile) {
  const text = readFileSync(skillFile, "utf8");
  if (text.includes("Model override for this marketplace.")) return;
  if (!text.startsWith("---")) {
    throw new Error(`no frontmatter: ${skillFile}`);
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) throw new Error(`unclosed frontmatter: ${skillFile}`);
  let insertAt = end + "\n---".length;
  if (text[insertAt] === "\n") insertAt += 1;
  writeFileSync(skillFile, text.slice(0, insertAt) + modelOverride + text.slice(insertAt));
}

function relativeFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(path.slice(dir.length + 1));
    }
  };
  walk(dir);
  return out;
}

function coveredByUpstream(localDir, upstreamDir) {
  const localFiles = relativeFiles(localDir);
  if (localFiles.length === 0) return false;
  for (const rel of localFiles) {
    const upstreamFile = join(upstreamDir, rel);
    if (!existsSync(upstreamFile)) return false;
    const localBytes = readFileSync(join(localDir, rel));
    const upstreamBytes = readFileSync(upstreamFile);
    if (!localBytes.equals(upstreamBytes)) return false;
  }
  return true;
}

function licenseOf(dir) {
  const block = frontmatter(readFileSync(join(dir, "SKILL.md"), "utf8"));
  const declared = field(block, "license");
  if (declared) return declared;
  const file = readdirSync(dir).find((name) => /^license/i.test(name));
  return file ? `file:${file}` : "none";
}

function scanSecrets(dir) {
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile() || statSync(path).size > 8_000_000) continue;
      const text = readFileSync(path).toString("latin1");
      if (privateKey.test(text)) {
        throw new Error(`private key header in ${path}`);
      }
    }
  };
  walk(dir);
}

function pluginManifest(spec) {
  return {
    name: spec.name,
    displayName: spec.displayName,
    version: spec.version,
    description: spec.description,
    author: { name: spec.author },
    homepage: spec.homepage,
    repository: spec.repository,
    license: spec.license,
    keywords: spec.keywords,
    category: "developer-tools",
    minClientVersions: cursorOnly,
    ...(spec.skills ? { skills: spec.skills } : {}),
    ...(spec.rules ? { rules: spec.rules } : {}),
  };
}

ensureMattClone();

const mattSkills = findMattSkills(join(mattClone, "skills"));
const mattNames = new Set(mattSkills.map((skill) => skill.name));
const agentNames = directSkills(agentsDir);
const cursorNames = directSkills(cursorDir);

for (const name of cursorNames) {
  if (mattNames.has(name) || agentNames.includes(name)) {
    throw new Error(`cursor skill ${name} collides with another source`);
  }
}

const mattByName = new Map(mattSkills.map((skill) => [skill.name, skill.path]));
const skipped = [];
const collisions = [];
const fromAgents = [];
for (const name of agentNames) {
  const upstream = mattByName.get(name);
  if (!upstream) {
    fromAgents.push(name);
    continue;
  }
  if (coveredByUpstream(join(agentsDir, name), upstream)) skipped.push(name);
  else collisions.push(name);
}

rmSync(join(root, "mattpocock-skills"), { recursive: true, force: true });
rmSync(join(root, "personal-skills"), { recursive: true, force: true });
rmSync(join(root, "house-rules"), { recursive: true, force: true });
rmSync(join(root, "manifests"), { recursive: true, force: true });
rmSync(join(root, ".cursor-plugin"), { recursive: true, force: true });

for (const skill of mattSkills) {
  copySkill(skill.path, join(root, "mattpocock-skills/skills", skill.name));
}
copyFileSync(join(mattClone, "LICENSE"), join(root, "mattpocock-skills/LICENSE"));

for (const name of [...fromAgents, ...collisions]) {
  copySkill(join(agentsDir, name), join(root, "personal-skills/skills", name));
}
for (const name of cursorNames) {
  const dest = join(root, "personal-skills/skills", name);
  copySkill(join(cursorDir, name), dest);
  injectModelOverride(join(dest, "SKILL.md"));
}

const ruleSource = join(root, "scripts/rule-sources");
for (const file of readdirSync(ruleSource)) {
  const dest = join(root, "house-rules/rules", file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(ruleSource, file), dest);
}

const mattMeta = JSON.parse(
  readFileSync(join(mattClone, ".claude-plugin/plugin.json"), "utf8"),
);
const mattSha = execFileSync("git", ["-C", mattClone, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const repository = "https://github.com/julerex/julebox";

writeJSON(
  join(root, "mattpocock-skills/.cursor-plugin/plugin.json"),
  pluginManifest({
    name: "mattpocock-skills",
    displayName: "Matt Pocock skills",
    version: mattMeta.version,
    description:
      "Matt Pocock's agent skills for real engineering, vendored from github.com/mattpocock/skills and loaded as a Cursor plugin.",
    author: "Matt Pocock",
    homepage: mattMeta.homepage,
    repository: mattMeta.repository,
    license: "MIT",
    keywords: ["matt-pocock", "engineering", "skills", "tdd", "cursor"],
    skills: "./skills/",
  }),
);

writeJSON(
  join(root, "personal-skills/.cursor-plugin/plugin.json"),
  pluginManifest({
    name: "personal-skills",
    displayName: "Personal skills",
    version: "0.1.0",
    description:
      "Skills copied from this machine's ~/.cursor/skills and ~/.agents/skills. Copies that already match Matt Pocock's skills stay in mattpocock-skills.",
    author: "Julian le Roux",
    homepage: repository,
    repository,
    license: "SEE-PROVENANCE",
    keywords: ["personal", "skills", "cursor"],
    skills: "./skills/",
  }),
);

writeJSON(
  join(root, "house-rules/.cursor-plugin/plugin.json"),
  pluginManifest({
    name: "house-rules",
    displayName: "House rules",
    version: "0.1.0",
    description:
      "Always-on rules. Grok 4.7 is the only model. Git, pull requests, browser checks, and direct wording come from Julian's global Cursor rules.",
    author: "Julian le Roux",
    homepage: repository,
    repository,
    license: "MIT",
    keywords: ["rules", "grok", "cursor"],
    rules: "./rules/",
  }),
);

writeJSON(join(root, ".cursor-plugin/marketplace.json"), {
  name: "julebox",
  owner: { name: "Julian le Roux" },
  metadata: {
    description:
      "Julian's Cursor marketplace. Matt Pocock's skills, skills from this machine, and house rules. Grok 4.7 only.",
  },
  plugins: [
    {
      name: "house-rules",
      source: "house-rules",
      description:
        "Always-on rules. Grok 4.7 is the only model, and the other rules are Julian's global Cursor rules.",
      minClientVersions: cursorOnly,
    },
    {
      name: "mattpocock-skills",
      source: "mattpocock-skills",
      description:
        "Matt Pocock's engineering and productivity skills, packaged for Cursor.",
      minClientVersions: cursorOnly,
    },
    {
      name: "personal-skills",
      source: "personal-skills",
      description:
        "Skills from ~/.cursor/skills and ~/.agents/skills, without the Matt Pocock duplicates.",
      minClientVersions: cursorOnly,
    },
  ],
});

writeLines(
  join(root, "manifests/matt-skills.txt"),
  mattSkills.map((skill) => skill.name),
);
writeLines(join(root, "manifests/personal-skills.txt"), [
  ...fromAgents,
  ...collisions,
  ...cursorNames,
]);
writeLines(join(root, "manifests/personal-from-agents.txt"), [...fromAgents, ...collisions]);
writeLines(join(root, "manifests/personal-from-cursor.txt"), cursorNames);
writeLines(join(root, "manifests/skipped-duplicates.txt"), skipped);
writeLines(join(root, "manifests/name-collisions.txt"), collisions);
writeFileSync(
  join(root, "manifests/matt-categories.tsv"),
  `name\tcategory\n${mattSkills.map((skill) => `${skill.name}\t${skill.category}`).join("\n")}\n`,
);
writeFileSync(
  join(root, "manifests/upstream.txt"),
  [
    "url=https://github.com/mattpocock/skills",
    `commit=${mattSha}`,
    `version=${mattMeta.version}`,
    "layout=skills flattened from category directories to skills/<name>",
    "",
  ].join("\n"),
);

const provenance = ["name\tsource\tlicense"];
for (const name of [...fromAgents, ...collisions]) {
  const src = join(agentsDir, name);
  provenance.push(`${name}\t${src}\t${licenseOf(src)}`);
}
for (const name of cursorNames) {
  const src = join(cursorDir, name);
  provenance.push(`${name}\t${src}\t${licenseOf(src)}`);
}
writeFileSync(join(root, "personal-skills/PROVENANCE.tsv"), `${provenance.join("\n")}\n`);

scanSecrets(join(root, "mattpocock-skills"));
scanSecrets(join(root, "personal-skills"));
scanSecrets(join(root, "house-rules"));

console.log(
  `synced matt=${mattSkills.length} personal=${fromAgents.length + collisions.length + cursorNames.length} skipped=${skipped.length} collisions=${collisions.join(",") || "none"} commit=${mattSha}`,
);
