// Runs the app in mock mode: no Docker, no TideCloak realm, no real backend needed.
// Usage: npm run dev:mock   (extra args go to `next dev`, e.g. npm run dev:mock -- -p 3100)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// data/tidecloak.json is git-ignored (it is the real realm's adapter). A stub is enough for mock mode.
if (!existsSync("data/tidecloak.json")) {
  mkdirSync("data", { recursive: true });
  const stub = {
    realm: "care-passport",
    "auth-server-url": "http://localhost:8080",
    "ssl-required": "external",
    resource: "care-passport-client",
    "public-client": true,
    "confidential-port": 0,
    jwk: { keys: [] },
  };
  writeFileSync("data/tidecloak.json", JSON.stringify(stub, null, 2));
  console.log("Created data/tidecloak.json (stub for mock mode).");
}

console.log("Mock mode ON: fake Tide, fake data. Open http://localhost:3000/patient");
const child = spawn("npx", ["next", "dev", "--webpack", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_MOCK: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
