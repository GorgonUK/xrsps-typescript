/**
 * Scan tasks.csv for Phase 2B skilling_action candidates (stdout report).
 */
import fs from "fs";
import path from "path";

import { parseCsvFile } from "./lib/csv";
import { buildRegistries } from "./lib/registries";
import { validateTask } from "./lib/validate";
import type { CsvTaskRow } from "./lib/types";

const WIRED_ACTIONS = new Set(["mine", "catch", "chop", "burn", "cook", "fletch", "smith", "spin"]);
const REGION_PATTERN =
    /\b(in|at|on|near|from)\s+(the\s+)?[A-Z]/i;
const COUNT_PATTERN = /^(\d+|1,000|10,000)\s+/i;
const ALREADY_PHASE2 = new Set([
    73, 74, 75, 76, 147, 122, 201, 169, 363, 679,
]);

type Candidate = {
    csvId: number;
    name: string;
    skill: string;
    action: string;
    targetId: number;
    count?: number;
    reason: string;
};

/** Canonical unnoted product ids used by server skill handlers. */
const MINING_ORE: Record<string, number> = {
    "clay": 434,
    "copper ore": 436,
    "tin ore": 438,
    "iron ore": 440,
    "silver ore": 442,
    "coal": 453,
    "gold ore": 444,
    "mithril ore": 447,
    "adamantite ore": 449,
    "runite ore": 451,
};

const LOG_BURN: Record<string, number> = {
    "logs": 1511,
    "oak logs": 1521,
    "willow logs": 1519,
    "maple logs": 1517,
    "yew logs": 1515,
    "magic logs": 1513,
};

const LOG_CHOP: Record<string, number> = {
    "logs": 1511,
    "oak": 1521,
    "oak tree": 1521,
    "willow": 1519,
    "maple": 1517,
    "yew": 1515,
    "magic": 1513,
    "teak": 6333,
};

const FISH_CATCH: Record<string, number> = {
    "shrimp": 317,
    "anchovies": 321,
    "sardine": 327,
    "herring": 345,
    "trout": 335,
    "pike": 349,
    "salmon": 331,
    "tuna": 359,
    "lobster": 377,
    "swordfish": 371,
    "monkfish": 7944,
    "shark": 383,
};

const FISH_COOK: Record<string, number> = {
    "shrimp": 315,
    "anchovies": 323,
    "sardine": 325,
    "herring": 347,
    "trout": 333,
    "pike": 351,
    "salmon": 329,
    "tuna": 362,
    "lobster": 379,
    "swordfish": 373,
    "monkfish": 7946,
    "shark": 385,
};

const FLETCH_PRODUCT: Record<string, number> = {
    "shortbows": 37,
    "longbows": 48,
    "oak shortbows": 54,
    "oak longbows": 56,
    "willow shortbows": 60,
    "willow longbows": 58,
    "maple shortbows": 64,
    "maple longbows": 62,
    "yew shortbows": 68,
    "yew longbows": 66,
    "magic shortbows": 72,
    "magic longbows": 70,
};

const SMITH_PRODUCT: Record<string, number> = {
    "bronze dagger": 1205,
    "bronze sword": 1277,
    "bronze scimitar": 1321,
    "iron dagger": 1203,
    "iron sword": 1279,
    "steel dagger": 1207,
};

function normalizeName(s: string): string {
    return s
        .trim()
        .replace(/\.$/, "")
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function parseCountPrefix(name: string): { rest: string; count?: number } {
    const m = name.match(/^([\d,]+)\s+(.+)$/);
    if (!m) return { rest: name };
    const count = parseInt(m[1].replace(/,/g, ""), 10);
    return { rest: m[2], count: Number.isFinite(count) ? count : undefined };
}

function tryMapCandidate(row: CsvTaskRow): Candidate | undefined {
    if (ALREADY_PHASE2.has(row.id)) return undefined;
    let name = row.name.trim();
    if (REGION_PATTERN.test(name)) return undefined;

    const { rest, count } = parseCountPrefix(name);
    name = rest.replace(/\.$/, "").trim();
    const n = normalizeName(name);

    // Mine X
    let m = n.match(/^mine\s+(.+)$/);
    if (m) {
        const ore = MINING_ORE[m[1]];
        if (ore) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "mining",
                action: "mine",
                targetId: ore,
                count,
                reason: "General mine task; unnoted ore id matches mining rocks",
            };
        }
    }

    // Chop a/an X Tree / Chop X
    m = n.match(/^chop\s+(?:an?\s+)?(.+?)(?:\s+tree)?$/);
    if (m) {
        const key = m[1].replace(/\s+tree$/, "");
        const logId = LOG_CHOP[key] ?? LOG_CHOP[`${key} tree`];
        if (logId) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "woodcutting",
                action: "chop",
                targetId: logId,
                count,
                reason: "Chop task; log product id from woodcutting defs",
            };
        }
    }

    // Catch X.
    m = n.match(/^catch\s+(?:a\s+)?(.+?)\.?$/);
    if (m) {
        const fish = FISH_CATCH[m[1].replace(/\.$/, "")];
        if (fish) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "fishing",
                action: "catch",
                targetId: fish,
                count,
                reason: "Catch task; raw fish id from fishing defs",
            };
        }
    }

    // Cook X.
    m = n.match(/^cook\s+(.+?)\.?$/);
    if (m) {
        const cooked = FISH_COOK[m[1].replace(/\.$/, "")];
        if (cooked) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "cooking",
                action: "cook",
                targetId: cooked,
                count,
                reason: "Cook task; cooked product id from cooking recipes",
            };
        }
    }

    // Burn X Logs.
    m = n.match(/^burn\s+(.+?)\s+logs\.?$/);
    if (m) {
        const logId = LOG_BURN[`${m[1]} logs`] ?? LOG_BURN[m[1]];
        if (logId) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "firemaking",
                action: "burn",
                targetId: logId,
                count,
                reason: "Burn logs task; log id from firemaking defs",
            };
        }
    }

    // Fletch X.
    m = n.match(/^fletch\s+(.+?)\.?$/);
    if (m) {
        const product = FLETCH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "fletching",
                action: "fletch",
                targetId: product,
                count,
                reason: "Fletch task; unstrung bow (u) id from fletching recipes",
            };
        }
    }

    // Smith a X / Smith X
    m = n.match(/^smith\s+(?:a\s+)?(.+)$/);
    if (m) {
        const product = SMITH_PRODUCT[m[1].replace(/\.$/, "")];
        if (product) {
            return {
                csvId: row.id,
                name: row.name,
                skill: "smithing",
                action: "smith",
                targetId: product,
                count,
                reason: "Smith task; product id from smithing recipes",
            };
        }
    }

    // Spin flax into bow strings
    if (n.includes("spin") && n.includes("bow string")) {
        return {
            csvId: row.id,
            name: row.name,
            skill: "crafting",
            action: "spin",
            targetId: 1777,
            count,
            reason: "Spin bow string; product 1777 from spinning recipe",
        };
    }

    return undefined;
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const tasks = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const reg = buildRegistries(repoRoot);

    const candidates: Candidate[] = [];
    for (const row of tasks) {
        const mapped = tryMapCandidate(row);
        if (!mapped) continue;
        if (!WIRED_ACTIONS.has(mapped.action)) continue;

        const validation = validateTask(reg, row);
        if (validation.status === "missing_content") continue;
        if (validation.status === "duplicate") continue;
        if (validation.status === "ready" && validation.matched_hook.includes("onSkillingAction")) {
            continue;
        }

        candidates.push(mapped);
    }

    candidates.sort((a, b) => a.csvId - b.csvId);

    const limit = 50;
    const picked = candidates.slice(0, limit);

    console.log(`# Phase 2B candidates (showing ${picked.length} of ${candidates.length} mappable)\n`);
    console.log("| CSV id | Task name | Skill | Action | TargetId | Reason |");
    console.log("|--------|-----------|-------|--------|----------|--------|");
    for (const c of picked) {
        const countNote = c.count ? ` (count=${c.count})` : "";
        console.log(
            `| ${c.csvId} | ${c.name} | ${c.skill} | ${c.action} | ${c.targetId}${countNote} | ${c.reason} |`,
        );
    }
}

main();
