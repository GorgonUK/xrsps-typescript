/**
 * Static spell_cast matrix checks for Phase 4A3 alchemy (no server boot).
 */
import path from "path";

import type { SpellCastTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { getPhase4a1SpellTrigger } from "./lib/phase4a1SpellTriggers";
import { getPhase4a2SpellTrigger } from "./lib/phase4a2SpellTriggers";
import { getPhase4a3AlchemyTrigger } from "./lib/phase4a3AlchemyTriggers";
import { parseCsvFile } from "./lib/csv";

type SpellCastOpts = {
    spellId?: number;
    spellCategory?: "combat" | "teleport" | "utility" | "binding";
    teleportName?: string;
};

const ALCHEMY_IDS = new Set([457, 458, 459, 460]);

function getPhaseSpellTrigger(sourceId: number) {
    return (
        getPhase4a1SpellTrigger(sourceId) ??
        getPhase4a2SpellTrigger(sourceId) ??
        getPhase4a3AlchemyTrigger(sourceId)
    );
}

function matchesSpellCastTrigger(trigger: SpellCastTrigger, opts: SpellCastOpts): boolean {
    if (trigger.anySpell) {
        return true;
    }
    if (trigger.teleportName) {
        return (
            !!opts.teleportName &&
            trigger.teleportName.toLowerCase() === opts.teleportName.toLowerCase()
        );
    }
    if (trigger.spellCategory) {
        if (opts.teleportName) {
            return trigger.spellCategory === "teleport";
        }
        if (opts.spellCategory) {
            return trigger.spellCategory === opts.spellCategory;
        }
        return false;
    }
    const spellId = opts.spellId | 0;
    if (spellId <= 0) {
        return false;
    }
    if (trigger.spellId !== undefined && trigger.spellId > 0) {
        return spellId === trigger.spellId;
    }
    if (trigger.spellIdsAny && trigger.spellIdsAny.length > 0) {
        return trigger.spellIdsAny.includes(spellId);
    }
    return false;
}

function collectMatches(opts: SpellCastOpts): Array<{ sourceTaskId: number; name: string }> {
    const csvPath = path.resolve(__dirname, "../../../tasks.csv");
    const csvById = new Map(parseCsvFile(csvPath).map((r) => [r.id, r.name] as const));
    const out: Array<{ sourceTaskId: number; name: string }> = [];

    for (let sourceId = 0; sourceId < 2000; sourceId++) {
        const trigger = getPhaseSpellTrigger(sourceId);
        if (!trigger || trigger.type !== "spell_cast") continue;
        if (!matchesSpellCastTrigger(trigger, opts)) continue;
        out.push({
            sourceTaskId: sourceId,
            name: csvById.get(sourceId) ?? `task-${sourceId}`,
        });
    }
    return out;
}

function formatList(matches: Array<{ sourceTaskId: number; name: string }>): string {
    if (matches.length === 0) return "(none)";
    return matches.map((m) => `${m.sourceTaskId}:${m.name}`).join("\n  ");
}

function main(): void {
    const highAlch: SpellCastOpts = { spellId: 9111, spellCategory: "utility" };
    const lowAlch: SpellCastOpts = { spellId: 9110, spellCategory: "utility" };
    const varrockTeleport: SpellCastOpts = { teleportName: "Varrock Teleport" };
    const windStrike: SpellCastOpts = { spellId: 3273, spellCategory: "combat" };

    const highMatches = collectMatches(highAlch);
    const lowMatches = collectMatches(lowAlch);
    const teleportMatches = collectMatches(varrockTeleport);
    const combatMatches = collectMatches(windStrike);

    const highAlchemyExpected = new Set([458, 459, 460, 476, 477]);
    const lowAlchemyExpected = new Set([457, 459, 460, 476, 477]);

    const highMissing = [...highAlchemyExpected].filter(
        (id) => !highMatches.some((m) => m.sourceTaskId === id),
    );
    const highUnexpectedAlchemy = highMatches.filter(
        (m) => ALCHEMY_IDS.has(m.sourceTaskId) && !new Set([458, 459, 460]).has(m.sourceTaskId),
    );
    const highWrongAlch = highMatches.filter((m) => m.sourceTaskId === 457);

    const lowMissing = [...lowAlchemyExpected].filter(
        (id) => !lowMatches.some((m) => m.sourceTaskId === id),
    );
    const lowWrongAlch = lowMatches.filter((m) => m.sourceTaskId === 458);

    const teleportAlchemy = teleportMatches.filter((m) => ALCHEMY_IDS.has(m.sourceTaskId));
    const combatAlchemy = combatMatches.filter((m) => ALCHEMY_IDS.has(m.sourceTaskId));

    console.log("=== High Level Alchemy (spellId 9111) ===");
    console.log("Matched:");
    console.log("  " + formatList(highMatches));
    console.log("Missing expected:", highMissing.length ? highMissing.join(", ") : "(none)");
    console.log("Unexpected low-only (457):", highWrongAlch.length ? "YES" : "no");

    console.log("\n=== Low Level Alchemy (spellId 9110) ===");
    console.log("Matched:");
    console.log("  " + formatList(lowMatches));
    console.log("Missing expected:", lowMissing.length ? lowMissing.join(", ") : "(none)");
    console.log("Unexpected high-only (458):", lowWrongAlch.length ? "YES" : "no");

    console.log("\n=== Varrock Teleport (alchemy cross-check) ===");
    console.log(
        "Alchemy tasks matched:",
        teleportAlchemy.length ? formatList(teleportAlchemy) : "(none — pass)",
    );

    console.log("\n=== Wind Strike combat (alchemy cross-check) ===");
    console.log(
        "Alchemy tasks matched:",
        combatAlchemy.length ? formatList(combatAlchemy) : "(none — pass)",
    );

    const failed =
        highMissing.length > 0 ||
        lowMissing.length > 0 ||
        highWrongAlch.length > 0 ||
        lowWrongAlch.length > 0 ||
        highUnexpectedAlchemy.length > 0 ||
        teleportAlchemy.length > 0 ||
        combatAlchemy.length > 0;

    process.exit(failed ? 1 : 0);
}

main();
