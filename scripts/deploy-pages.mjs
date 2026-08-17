/**
 * Builds and publishes to the gh-pages branch.
 *
 * Exists because publishing through GitHub Actions needs a token with the
 * `workflow` scope, which can only be granted interactively in a browser. This
 * gets the site updated without it. Once the Actions workflow is enabled (see
 * README), pushing to main deploys automatically and this becomes redundant.
 *
 *   node scripts/deploy-pages.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRANCH = "gh-pages";

// The local binaries are invoked through node directly rather than through
// `npm run build`: on Windows npm is a .cmd shim that execFileSync refuses to
// spawn without a shell, and going through a shell would then mangle the
// leading-slash base path under Git Bash.
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");

function run(cmd, args, cwd = ROOT) {
  return execFileSync(cmd, args, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
}

function loud(cmd, args, cwd = ROOT, env) {
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

const remote = run("git", ["remote", "get-url", "origin"]);
// GitHub Pages project sites live under /<repo>/, and the bundle has to be
// built with that prefix or every asset request 404s.
const repo = remote.replace(/\.git$/, "").split("/").pop();
const base = `/${repo}/`;

console.log("Kiểm tra kiểu …");
loud(process.execPath, [TSC, "--noEmit"]);

console.log(`Build cho ${base} …`);
// Passed through the environment rather than the shell, so the value survives
// Git Bash on Windows rewriting leading-slash arguments into Windows paths.
loud(process.execPath, [VITE, "build"], ROOT, { VITE_BASE: base });

const dist = path.join(ROOT, "dist");
// GitHub Pages serves 404.html for unknown paths; handing it the app shell is
// what makes a hard refresh on /du-an work.
copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
// Without this, Pages runs Jekyll and drops files starting with an underscore.
writeFileSync(path.join(dist, ".nojekyll"), "");

const work = path.join(mkdtempSync(path.join(tmpdir(), "ghpages-")), "out");
cpSync(dist, work, { recursive: true });

run("git", ["init", "-q", "-b", BRANCH], work);
run("git", ["add", "-A"], work);
run("git", ["commit", "-q", "-m", `Deploy ${new Date().toISOString().slice(0, 16)}`], work);
run("git", ["remote", "add", "origin", remote], work);

console.log(`Pushing to ${BRANCH} …`);
// Force: the branch holds build output only, so its history has no value.
loud("git", ["push", "--force", "origin", BRANCH], work);

console.log(`\nĐã deploy. Trang sẽ cập nhật sau khoảng 1 phút.`);
