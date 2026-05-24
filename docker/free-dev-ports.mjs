#!/usr/bin/env node
/**
 * Stop native dev servers on 3001 / 3002 / 5173 so Docker compose can bind them.
 * Skips Docker Desktop proxy processes.
 */
import { execSync } from "node:child_process";
import { platform } from "node:os";

const PORTS = [3001, 3002, 5173];
const SKIP_EXE = new Set([
  "com.docker.backend.exe",
  "wslrelay.exe",
  "docker.exe",
  "dockerd",
  "Docker Desktop.exe",
]);

function taskImageName(pid) {
  try {
    const line = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const first = line.split(",")[0] ?? "";
    return first.replace(/^"|"$/g, "");
  } catch {
    return "";
  }
}

function freeWindows() {
  for (const port of PORTS) {
    let out = "";
    try {
      out = execSync(`netstat -ano -p tcp | findstr ":${port} "`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      const exe = taskImageName(pid);
      if (SKIP_EXE.has(exe)) {
        console.log(`  port ${port}: skip ${exe} (pid ${pid})`);
        continue;
      }
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`  port ${port}: stopped ${exe || "process"} (pid ${pid})`);
      } catch {
        console.warn(`  port ${port}: could not stop pid ${pid}`);
      }
    }
  }
}

function freeUnix() {
  for (const port of PORTS) {
    let pids = [];
    try {
      pids = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      continue;
    }
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        console.log(`  port ${port}: stopped pid ${pid}`);
      } catch {
        console.warn(`  port ${port}: could not stop pid ${pid}`);
      }
    }
  }
}

console.log("Freeing dev ports for Docker (3001, 3002, 5173)…");
if (platform() === "win32") freeWindows();
else freeUnix();
console.log("Done.");
