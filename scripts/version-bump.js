#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_PKG = path.join(__dirname, "..", "package.json");
const CLIENT_PKG = path.join(__dirname, "..", "client", "package.json");
const SERVER_PKG = path.join(__dirname, "..", "server", "package.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function bumpPatch(version) {
  const parts = version.split(".");
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}`);
  }
  const [major, minor, patch] = parts;
  return `${major}.${minor}.${parseInt(patch, 10) + 1}`;
}

function main() {
  const rootPkg = readJson(ROOT_PKG);
  const oldVersion = rootPkg.version;
  const newVersion = bumpPatch(oldVersion);

  console.log(`Bumping version: ${oldVersion} -> ${newVersion}`);

  rootPkg.version = newVersion;
  writeJson(ROOT_PKG, rootPkg);

  if (fs.existsSync(CLIENT_PKG)) {
    const clientPkg = readJson(CLIENT_PKG);
    clientPkg.version = newVersion;
    writeJson(CLIENT_PKG, clientPkg);
    console.log(`Updated client/package.json`);
  }

  if (fs.existsSync(SERVER_PKG)) {
    const serverPkg = readJson(SERVER_PKG);
    serverPkg.version = newVersion;
    writeJson(SERVER_PKG, serverPkg);
    console.log(`Updated server/package.json`);
  }

  console.log(`Version bump complete: ${newVersion}`);
}

main();
