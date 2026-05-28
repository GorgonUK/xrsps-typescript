/**
 * Loads `server/.env` into `process.env` before other modules read env (e.g. wsServer ADMIN_USERNAMES).
 * Node does not load .env files by default; this project does not use the dotenv package.
 * Existing process.env entries win (shell / deployment overrides).
 */
import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");

function applyLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    if (!key) return;
    let value = trimmed.slice(eq + 1).trim();
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

try {
    const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
        applyLine(line);
    }
} catch {
    // Missing or unreadable .env is fine (defaults + OS env only).
}
