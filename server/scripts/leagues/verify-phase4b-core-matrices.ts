/**
 * Static spell_cast matrix checks for Phase 4B-Core (no server boot).
 */
import path from "path";

import { isInsideLeagueArea } from "../../src/game/leagues/AreaRegistry";
import type { SpellCastTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { getPhase4a1SpellTrigger } from "./lib/phase4a1SpellTriggers";
import { getPhase4a2SpellTrigger } from "./lib/phase4a2SpellTriggers";
import { getPhase4a3AlchemyTrigger } from "./lib/phase4a3AlchemyTriggers";
import { getPhase4bCoreSpellTrigger } from "./lib/phase4bCoreSpellTriggers";
import { parseCsvFile } from "./lib/csv";

type SpellCastOpts = {
    spellId?: number;
    spellCategory?: "combat" | "teleport" | "utility" | "binding";
    spellbook?: "standard" | "ancient" | "lunar" | "arceuus";
    teleportName?: string;
};

type PlayerTile = { x: number; y: number; plane: number };

const PHASE4B_CORE_IDS = new Set([472, 1258, 1259]);
const WILDERNESS_TILE: PlayerTile = { x: 3100, y: 3600, plane: 0 };
const MISTHALIN_TILE: PlayerTile = { x: 3213, y: 3424, plane: 0 };

function getPhaseSpellTrigger(sourceId: number) {
    return (
        getPhase4bCoreSpellTrigger(sourceId) ??
        getPhase4a1SpellTrigger(sourceId) ??
        getPhase4a2SpellTrigger(sourceId) ??
        getPhase4a3AlchemyTrigger(sourceId)
    );
}

function matchesSpellCastTrigger(
    trigger: SpellCastTrigger,
    opts: SpellCastOpts,
    tile: PlayerTile,
): boolean {
    const areaKeys = trigger.areaKeys ?? [];
    if (areaKeys.length > 0) {
        const inside = areaKeys.some((key) =>
            isInsideLeagueArea(key, tile.x, tile.y, tile.plane),
        );
        if (!inside) {
            return false;
        }
    }

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
    if (trigger.spellbook) {
        if (opts.spellbook !== trigger.spellbook) {
            return false;
        }
        const spellId = opts.spellId | 0;
        if (trigger.spellId !== undefined && trigger.spellId > 0) {
            return spellId === trigger.spellId;
        }
        if (trigger.spellIdsAny && trigger.spellIdsAny.length > 0) {
            return spellId > 0 && trigger.spellIdsAny.includes(spellId);
        }
        return true;
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

function collectMatches(
    opts: SpellCastOpts,
    tile: PlayerTile,
): Array<{ sourceTaskId: number; name: string }> {
    const csvPath = path.resolve(__dirname, "../../../tasks.csv");
    const csvById = new Map(parseCsvFile(csvPath).map((r) => [r.id, r.name] as const));
    const out: Array<{ sourceTaskId: number; name: string }> = [];

    for (let sourceId = 0; sourceId < 2000; sourceId++) {
        const trigger = getPhaseSpellTrigger(sourceId);
        if (!trigger || trigger.type !== "spell_cast") continue;
        if (!matchesSpellCastTrigger(trigger, opts, tile)) continue;
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

function phase4bOnly(matches: Array<{ sourceTaskId: number }>): number[] {
    return matches.filter((m) => PHASE4B_CORE_IDS.has(m.sourceTaskId)).map((m) => m.sourceTaskId);
}

function main(): void {
    const cases: Array<{
        label: string;
        opts: SpellCastOpts;
        tile: PlayerTile;
        expect4b: number[];
        forbid4b?: number[];
    }> = [
        {
            label: "Ice Burst in Wilderness",
            opts: { spellId: 4639, spellbook: "ancient", spellCategory: "combat" },
            tile: WILDERNESS_TILE,
            expect4b: [472, 1258],
            forbid4b: [1259],
        },
        {
            label: "Ice Burst outside Wilderness",
            opts: { spellId: 4639, spellbook: "ancient", spellCategory: "combat" },
            tile: MISTHALIN_TILE,
            expect4b: [472],
            forbid4b: [1258, 1259],
        },
        {
            label: "Ice Barrage in Wilderness",
            opts: { spellId: 4651, spellbook: "ancient", spellCategory: "combat" },
            tile: WILDERNESS_TILE,
            expect4b: [472, 1259],
            forbid4b: [1258],
        },
        {
            label: "Ancient spell cast outside Wilderness",
            opts: { spellId: 4639, spellbook: "ancient", spellCategory: "combat" },
            tile: MISTHALIN_TILE,
            expect4b: [472],
            forbid4b: [1258, 1259],
        },
        {
            label: "Ancient spell cast in Wilderness",
            opts: { spellId: 4639, spellbook: "ancient", spellCategory: "combat" },
            tile: WILDERNESS_TILE,
            expect4b: [472, 1258],
            forbid4b: [1259],
        },
    ];

    let failed = false;

    for (const test of cases) {
        const matches = collectMatches(test.opts, test.tile);
        const matched4b = phase4bOnly(matches);
        const missing = test.expect4b.filter((id) => !matched4b.includes(id));
        const unexpected = (test.forbid4b ?? []).filter((id) => matched4b.includes(id));

        console.log(`=== ${test.label} ===`);
        console.log(`4B-Core matched: ${matched4b.join(", ") || "(none)"}`);
        console.log(`All matches:\n  ${formatList(matches)}`);
        console.log(`Missing 4B: ${missing.length ? missing.join(", ") : "(none)"}`);
        console.log(`Unexpected 4B: ${unexpected.length ? unexpected.join(", ") : "(none)"}`);
        console.log("");

        if (missing.length > 0 || unexpected.length > 0) {
            failed = true;
        }
    }

    process.exit(failed ? 1 : 0);
}

main();
