#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.HOME ?? "";

const requiredPlugins = ["house-rules", "mattpocock-skills", "personal-skills"];
const ruleFiles = [
  "grok-4-7.mdc",
  "committing-changes-with-git.mdc",
  "creating-pull-requests.mdc",
  "verify-web-apps.mdc",
  "affirmative-language.mdc",
];
const rulePhrases = {
  "grok-4-7.mdc": "grok-4.7-xhigh-fast",
  "committing-changes-with-git.mdc": "NEVER update the git config",
  "creating-pull-requests.mdc": "gh pr create",
  "verify-web-apps.mdc": "verify your work in the browser",
  "affirmative-language.mdc": "Avoid unnecessary contrastive negation",
};
const modelOverride =
  "The Task slug is `grok-4.7-xhigh-fast`. Where this skill names another model, use that slug instead.";
const privateKey =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{40,}-----END [A-Z ]*PRIVATE KEY-----/;

let errors = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  errors += 1;
}

function loadJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readLines(path) {
  if (!existsSync(path)) {
    fail(`missing ${path.slice(root.length + 1)}`);
    return [];
  }
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function frontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  return text.slice(text.indexOf("\n") + 1, end);
}

function field(block, key) {
  const match = block.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, "m"));
  if (!match) return null;
  return match[1].replace(/^["']|["']$/g, "").trim();
}

function skillNames(pluginDir) {
  const skillsDir = join(pluginDir, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter((name) => existsSync(join(skillsDir, name, "SKILL.md")))
    .sort();
}

function directSkillNames(dir) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((name) => {
      const skill = join(dir, name, "SKILL.md");
      try {
        return statSync(skill).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function mattSkillNames(clone) {
  const skills = join(clone, "skills");
  if (!existsSync(skills)) return null;
  const names = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (existsSync(join(path, "SKILL.md"))) names.push(entry.name);
        else walk(path);
      }
    }
  };
  walk(skills);
  return names.sort();
}

function sameSet(label, actual, expected) {
  const a = actual.join("\n");
  const b = expected.join("\n");
  if (a !== b) {
    const missing = expected.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !expected.includes(name));
    fail(
      `${label} mismatch. missing ${missing.length} [${missing.slice(0, 8).join(", ")}] extra ${extra.length} [${extra.slice(0, 8).join(", ")}]`,
    );
  }
}

function walkFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, out);
    else if (entry.isFile()) out.push(path);
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateMarketplace = ajv.compile(
  loadJSON(join(root, "schemas/marketplace.schema.json")),
);
const validatePlugin = ajv.compile(
  loadJSON(join(root, "schemas/plugin.schema.json")),
);

const marketplacePath = join(root, ".cursor-plugin/marketplace.json");
if (!existsSync(marketplacePath)) {
  fail(".cursor-plugin/marketplace.json not found");
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}

const marketplace = loadJSON(marketplacePath);
if (!validateMarketplace(marketplace)) {
  fail("marketplace.json schema validation failed");
  for (const err of validateMarketplace.errors ?? []) {
    console.error(`  ${err.instancePath || "/"}: ${err.message}`);
  }
}

if (existsSync(join(root, ".claude-plugin"))) {
  fail(".claude-plugin exists. This marketplace is Cursor only.");
}

const byName = new Map();
for (const entry of marketplace.plugins ?? []) {
  byName.set(entry.name, entry);
  const clients = entry.minClientVersions ?? {};
  if (clients.grokbot !== "never" || clients.sand !== "never") {
    fail(
      `marketplace entry ${entry.name} must hide grokbot and sand with "never"`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(clients, "cursor") && clients.cursor === "never") {
    fail(`marketplace entry ${entry.name} hides itself from Cursor`);
  }
}

for (const name of requiredPlugins) {
  if (!byName.has(name)) fail(`marketplace is missing plugin ${name}`);
}

for (const entry of marketplace.plugins ?? []) {
  const pluginDir = resolve(root, entry.source);
  const pluginJsonPath = join(pluginDir, ".cursor-plugin/plugin.json");
  if (!existsSync(pluginDir)) {
    fail(`plugin ${entry.name} source ${entry.source} is missing`);
    continue;
  }
  if (!existsSync(pluginJsonPath)) {
    fail(`plugin ${entry.name} is missing .cursor-plugin/plugin.json`);
    continue;
  }
  if (existsSync(join(pluginDir, ".claude-plugin"))) {
    fail(`plugin ${entry.name} contains .claude-plugin`);
  }
  const pluginJson = loadJSON(pluginJsonPath);
  if (!validatePlugin(pluginJson)) {
    fail(`plugin ${entry.name} plugin.json failed schema validation`);
    for (const err of validatePlugin.errors ?? []) {
      const detail =
        err.keyword === "additionalProperties"
          ? `${err.message}: ${err.params.additionalProperty}`
          : err.message;
      console.error(`  ${err.instancePath || "/"}: ${detail}`);
    }
  }
  if (pluginJson.name !== entry.name) {
    fail(`plugin ${entry.name} manifest name is ${pluginJson.name}`);
  }
  const clients = pluginJson.minClientVersions ?? {};
  if (clients.grokbot !== "never" || clients.sand !== "never") {
    fail(`plugin ${entry.name} must set grokbot and sand to "never"`);
  }
  if (clients.cursor === "never") {
    fail(`plugin ${entry.name} sets cursor to never`);
  }
}

const houseRules = join(root, "house-rules/rules");
for (const file of ruleFiles) {
  const published = join(houseRules, file);
  const source = join(root, "scripts/rule-sources", file);
  if (!existsSync(published) || !existsSync(source)) {
    fail(`rule ${file} is missing from house-rules or scripts/rule-sources`);
    continue;
  }
  const publishedText = readFileSync(published, "utf8");
  const sourceText = readFileSync(source, "utf8");
  if (publishedText !== sourceText) {
    fail(`rule ${file} drifted from scripts/rule-sources`);
  }
  const block = frontmatter(publishedText);
  if (!block || field(block, "alwaysApply") !== "true") {
    fail(`rule ${file} must set alwaysApply: true`);
  }
  if (!publishedText.includes(rulePhrases[file])) {
    fail(`rule ${file} is missing its required phrase`);
  }
}

const mattDir = join(root, "mattpocock-skills");
const personalDir = join(root, "personal-skills");
const mattActual = skillNames(mattDir);
const personalActual = skillNames(personalDir);
const mattExpected = readLines(join(root, "manifests/matt-skills.txt")).sort();
const personalExpected = readLines(join(root, "manifests/personal-skills.txt")).sort();
const fromCursor = readLines(join(root, "manifests/personal-from-cursor.txt")).sort();
const fromAgents = readLines(join(root, "manifests/personal-from-agents.txt")).sort();
const skipped = readLines(join(root, "manifests/skipped-duplicates.txt")).sort();
const collisions = readLines(join(root, "manifests/name-collisions.txt")).sort();

if (mattExpected.length > 0) sameSet("matt skills", mattActual, mattExpected);
if (personalExpected.length > 0) sameSet("personal skills", personalActual, personalExpected);

const personalUnion = [...new Set([...fromCursor, ...fromAgents])].sort();
if (fromCursor.length > 0 || fromAgents.length > 0) {
  sameSet("personal manifest union", personalExpected, personalUnion);
}
for (const name of fromCursor) {
  if (fromAgents.includes(name)) fail(`${name} is listed in both personal sources`);
}
for (const name of skipped) {
  if (!mattActual.includes(name)) fail(`skipped duplicate ${name} is not in mattpocock-skills`);
  if (personalActual.includes(name)) fail(`skipped duplicate ${name} was also copied into personal-skills`);
}
for (const name of collisions) {
  if (!mattActual.includes(name) || !personalActual.includes(name)) {
    fail(`name collision ${name} must exist in both plugins`);
  }
}
for (const name of personalActual) {
  if (mattActual.includes(name) && !collisions.includes(name)) {
    fail(`${name} is in both plugins without a name-collision entry`);
  }
}

const seen = new Map();
for (const [label, dir] of [
  ["mattpocock-skills", mattDir],
  ["personal-skills", personalDir],
]) {
  for (const name of skillNames(dir)) {
    const path = join(dir, "skills", name, "SKILL.md");
    const text = readFileSync(path, "utf8");
    const block = frontmatter(text);
    const skillName = block ? field(block, "name") : null;
    if (!skillName) fail(`${label}/${name} SKILL.md has no frontmatter name`);
    if (skillName) {
      const key = `${label}:${skillName}`;
      if (seen.has(key)) fail(`${label} frontmatter name ${skillName} is duplicated`);
      seen.set(key, name);
    }
    if (label === "mattpocock-skills" && text.includes("Model override for this marketplace.")) {
      fail(`upstream skill ${name} was rewritten`);
    }
  }
}

for (const name of fromCursor) {
  const path = join(personalDir, "skills", name, "SKILL.md");
  if (!existsSync(path)) continue;
  if (!readFileSync(path, "utf8").includes(modelOverride)) {
    fail(`cursor skill ${name} is missing the Grok 4.7 override`);
  }
}

const files = [];
for (const plugin of requiredPlugins) walkFiles(join(root, plugin), files);
for (const path of files) {
  if (statSync(path).size > 8_000_000) continue;
  const text = readFileSync(path);
  if (privateKey.test(text.toString("latin1"))) {
    fail(`private key header in ${path.slice(root.length + 1)}`);
  }
}

const mattClone = process.env.JULEBOX_MATT_CLONE || join(root, ".scratch/matt");
const agentsDir = process.env.JULEBOX_AGENTS_SKILLS || join(home, ".agents/skills");
const cursorDir = process.env.JULEBOX_CURSOR_SKILLS || join(home, ".cursor/skills");

const mattSource = mattSkillNames(mattClone);
if (mattSource) sameSet("matt clone vs manifest", mattSource, mattExpected);

const agentsSource = directSkillNames(agentsDir);
const cursorSource = directSkillNames(cursorDir);
if (agentsSource && mattSource) {
  const overlap = agentsSource.filter((name) => mattSource.includes(name)).sort();
  const explained = [...skipped, ...collisions].sort();
  sameSet("matt name overlap", explained, overlap);
  const expectedAgents = [
    ...agentsSource.filter((name) => !skipped.includes(name)),
  ].sort();
  sameSet("agents skills vs manifest", expectedAgents, fromAgents);
}
if (cursorSource) sameSet("cursor skills vs manifest", cursorSource, fromCursor);

function treeHash(dirs) {
  const files = [];
  for (const dir of dirs) walkFiles(dir, files);
  files.sort();
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(path.slice(root.length + 1));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}

const contentHash = treeHash(requiredPlugins.map((name) => join(root, name)));
console.log(
  `All plugins validated successfully. matt=${mattActual.length} personal=${personalActual.length} rules=${ruleFiles.length} hash=${contentHash}`,
);
