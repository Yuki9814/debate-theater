import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "lib"];
const ignored = new Set(["lib/generated"]);
const findings = [];

function walk(dir) {
  if (ignored.has(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(path) ? [path] : [];
  });
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function addFinding(file, message, index = 0) {
  findings.push(`${file}:${lineNumber(readFileSync(file, "utf8"), index)} ${message}`);
}

for (const file of roots.flatMap(walk)) {
  const content = readFileSync(file, "utf8");
  const isClientFile = content.startsWith('"use client"') || content.startsWith("'use client'");

  const publicSecret = content.match(/NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)/);
  if (publicSecret?.index !== undefined) {
    addFinding(file, "client-public environment variable name looks secret-like", publicSecret.index);
  }

  const localStorageKey = content.match(/localStorage[\s\S]{0,120}(apiKey|secret|token|providerKey)/i);
  if (localStorageKey?.index !== undefined) {
    addFinding(file, "sensitive key material appears near localStorage", localStorageKey.index);
  }

  if (isClientFile) {
    const serverEnv = content.match(/process\.env\.(OPENAI|CUSTOM_OPENAI|STRIPE|API_KEY|GROK|GEMINI)/);
    if (serverEnv?.index !== undefined) {
      addFinding(file, "client component references server-only environment variables", serverEnv.index);
    }

    const directProviderFetch = content.match(/fetch\(["'`]https:\/\/api\.(openai|anthropic|x)\.com/i);
    if (directProviderFetch?.index !== undefined) {
      addFinding(file, "client component appears to call an external AI provider directly", directProviderFetch.index);
    }
  }
}

if (findings.length > 0) {
  console.error("Security scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security scan passed.");
