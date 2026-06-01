/**
 * Static spell_cast matrix checks for Phase 4A2 (no server boot).
 */
import type { SpellCastTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { getPhase4a1SpellTrigger } from "./lib/phase4a1SpellTriggers";
import { getPhase4a2SpellTrigger } from "./lib/phase4a2SpellTriggers";
import { parseCsvFile } from "./lib/csv";
import path from "path";

type SpellCastOpts = {
    spellId?: number;
    spellCategory?: "combat" | "teleport" | "utility" | "binding";
    teleportName?: string;
};

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
        const trigger = getPhase4a1SpellTrigger(sourceId) ?? getPhase4a2SpellTrigger(sourceId);
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
    const varrockTeleport: SpellCastOpts = { teleportName: "Varrock Teleport" };
    const highAlch: SpellCastOpts = { spellId: 9111, spellCategory: "utility" };
    const windStrike: SpellCastOpts = { spellId: 3273, spellCategory: "combat" };

    const varrockMatches = collectMatches(varrockTeleport);
    const alchMatches = collectMatches(highAlch);
    const combatMatches = collectMatches(windStrike);

    const varrockExpected = new Set([453, 454, 455, 456, 676, 476, 477]);
    const varrockUnexpected = varrockMatches.filter((m) => !varrockExpected.has(m.sourceTaskId));
    const varrockMissing = [...varrockExpected].filter(
        (id) => !varrockMatches.some((m) => m.sourceTaskId === id),
    );

    const teleportFromCombat = combatMatches.filter((m) =>
        getPhase4a2SpellTrigger(m.sourceTaskId)?.spellCategory === "teleport" ||
        getPhase4a2SpellTrigger(m.sourceTaskId)?.teleportName,
    );

    const teleportOnly4a2 = varrockMatches.filter((m) => getPhase4a2SpellTrigger(m.sourceTaskId));
    const combatFromTeleport = varrockMatches.filter((m) => getPhase4a1SpellTrigger(m.sourceTaskId));

    console.log("=== Varrock Teleport matrix ===");
    console.log("Matched:");
    console.log("  " + formatList(varrockMatches));
    console.log("Missing expected:", varrockMissing.length ? varrockMissing.join(", ") : "(none)");
    console.log("Unexpected:", varrockUnexpected.length ? formatList(varrockUnexpected) : "(none)");

    console.log("\n=== High Level Alchemy matrix (spellId 9111, not live in 4A2) ===");
    console.log("Matched:");
    console.log("  " + formatList(alchMatches));
    console.log(
        "Note: 457-460 deferred from 4A2; expect no live alch tasks until alchemy batch imports.",
    );

    console.log("\n=== Wind Strike combat cast (spellId 3273) ===");
    console.log("Matched:");
    console.log("  " + formatList(combatMatches));

    console.log("\n=== Cross-checks ===");
    console.log(
        `4A2 tasks matched by Varrock teleport: ${teleportOnly4a2.length} (expect 7: 453-456,676,476,477)`,
    );
    console.log(
        `4A1 combat spell-id tasks matched by Varrock teleport: ${combatFromTeleport.length} (expect 0)`,
    );
    console.log(
        `4A2 teleport tasks matched by Wind Strike: ${teleportFromCombat.length} (expect 0)`,
    );
    console.log(
        `anySpell tasks in Wind Strike match: ${combatMatches.filter((m) => [476, 477].includes(m.sourceTaskId)).map((m) => m.sourceTaskId).join(", ") || "(none)"} (expect 476,477)`,
    );

    const failed =
        varrockMissing.length > 0 ||
        varrockUnexpected.length > 0 ||
        combatFromTeleport.length > 0 ||
        teleportFromCombat.length > 0 ||
        !combatMatches.some((m) => m.sourceTaskId === 435) ||
        !combatMatches.some((m) => m.sourceTaskId === 476);

    process.exit(failed ? 1 : 0);
}

main();
