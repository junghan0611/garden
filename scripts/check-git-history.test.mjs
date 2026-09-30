// node --test scripts/check-git-history.test.mjs — fixtures are throwaway repos under the OS temp dir.
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-git-history.sh")
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "git-history-"))
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "protocol.file.allow=always", ...args], {
    cwd,
    encoding: "utf8",
  }).trim()

function fullRepo(commits = 3) {
  const dir = tmp()
  git(dir, "init", "-q")
  for (let i = 0; i < commits; i++) {
    fs.writeFileSync(path.join(dir, "f.md"), `${i}\n`)
    git(dir, "add", "f.md")
    git(dir, "commit", "-q", "-m", `c${i}`)
  }
  return dir
}
function shallowClone(src) {
  const dir = path.join(tmp(), "clone")
  git(os.tmpdir(), "clone", "-q", "--depth", "1", `file://${src}`, dir)
  return dir
}
function run(dir, env = {}) {
  const r = spawnSync("bash", [SCRIPT, dir], {
    encoding: "utf8",
    env: { ...process.env, WORKERS_CI_COMMIT_SHA: "", WORKERS_CI_BRANCH: "", GIT_ALLOW_PROTOCOL: "file", ...env },
  })
  return { code: r.status, out: r.stdout + r.stderr }
}

test("full history passes and logs head, shallow=false and the commit count", () => {
  const dir = fullRepo(3)
  const { code, out } = run(dir)
  assert.equal(code, 0, out)
  assert.match(out, /shallow=false commits=3/)
  assert.match(out, new RegExp(`head=${git(dir, "rev-parse", "HEAD")}`))
})

test("a shallow clone is unshallowed once, then passes with full history", () => {
  const dir = shallowClone(fullRepo(4))
  assert.equal(git(dir, "rev-parse", "--is-shallow-repository"), "true")
  const { code, out } = run(dir)
  assert.equal(code, 0, out)
  assert.match(out, /shallow=true commits=1/)
  assert.match(out, /unshallowed in \d+s shallow=false commits=4/)
})

test("a shallow clone whose unshallow fails stops the build without printing the remote", () => {
  const dir = shallowClone(fullRepo(2))
  git(dir, "remote", "set-url", "origin", "file:///nonexistent/SECRET-TOKEN/repo.git")
  const { code, out } = run(dir)
  assert.notEqual(code, 0)
  assert.match(out, /FAIL shallow clone and 'git fetch --unshallow' failed/)
  assert.doesNotMatch(out, /SECRET-TOKEN/)
})

test("a directory without git history fails closed", () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, "f.md"), "x\n")
  const { code, out } = run(dir, { GIT_CEILING_DIRECTORIES: path.dirname(dir) })
  assert.notEqual(code, 0)
  assert.match(out, /FAIL not a git checkout/)
})

test("HEAD differing from WORKERS_CI_COMMIT_SHA fails", () => {
  const dir = fullRepo(1)
  const { code, out } = run(dir, { WORKERS_CI_COMMIT_SHA: "0".repeat(40) })
  assert.notEqual(code, 0)
  assert.match(out, /is not the commit Workers Builds announced/)
})

test("HEAD equal to WORKERS_CI_COMMIT_SHA passes", () => {
  const dir = fullRepo(1)
  const { code, out } = run(dir, { WORKERS_CI_COMMIT_SHA: git(dir, "rev-parse", "HEAD"), WORKERS_CI_BRANCH: "main" })
  assert.equal(code, 0, out)
  assert.match(out, /ci_branch=main/)
})
