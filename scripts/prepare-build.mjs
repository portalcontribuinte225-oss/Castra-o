import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function dependenciesMatchLock(directory, includeDevelopment) {
  const installedLockPath = join(directory, "node_modules", ".package-lock.json");
  if (!existsSync(installedLockPath)) return false;

  const expected = readJson(join(directory, "package-lock.json")).packages;
  const installed = readJson(installedLockPath).packages;
  const { dependencies = {}, devDependencies = {} } = expected[""];
  const required = includeDevelopment ? { ...dependencies, ...devDependencies } : dependencies;

  return Object.keys(required).every((name) => {
    const location = `node_modules/${name}`;
    return installed[location] && existsSync(join(directory, location, "package.json"));
  }) && Object.entries(installed).every(([location, { version, integrity }]) => {
    const locked = expected[location];
    return locked && locked.version === version && locked.integrity === integrity;
  });
}

for (const [directory, includeDevelopment] of [[projectRoot, true], [join(projectRoot, "backend"), false]]) {
  if (dependenciesMatchLock(directory, includeDevelopment)) continue;

  const dependencyScope = includeDevelopment ? "--include=dev" : "--omit=dev";
  execFileSync(process.execPath, [process.env.npm_execpath, "ci", dependencyScope], {
    cwd: directory,
    stdio: "inherit",
  });
}
