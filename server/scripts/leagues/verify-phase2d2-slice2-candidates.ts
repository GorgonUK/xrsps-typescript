/**
 * Pre-import gate for Phase 2D-2 Slice 2 (7 fletch arrow skilling_action tasks).
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2d2-slice2-candidates.ts
 */
import path from "path";

import {
    FLETCHING_COMBINE_RECIPES,
    FLETCHING_LOG_IDS,
    getFletchingProductsForLog,
} from "../../src/game/skills/fletching";
import { LEAGUE_TASKS } from "../../../src/shared/leagues/leagueTasks.data";
import { parseCsvFile } from "./lib/csv";
import { getPhase2dSkillingTrigger } from "./lib/phase2dSkillingTriggers";

const SLICE2_SOURCE_IDS = [108, 109, 110, 111, 112, 113, 114] as const;

const EXPECTED_TRIGGERS: Record<number, { skill: string; action: string; targetId: number; label: string }> = {
    108: { skill: "fletching", action: "fletch", targetId: 53, label: "Headless arrows" },
    109: { skill: "fletching", action: "fletch", targetId: 882, label: "Bronze arrows" },
    110: { skill: "fletching", action: "fletch", targetId: 884, label: "Iron arrows" },
    111: { skill: "fletching", action: "fletch", targetId: 886, label: "Steel arrows" },
    112: { skill: "fletching", action: "fletch", targetId: 888, label: "Mithril arrows" },
    113: { skill: "fletching", action: "fletch", targetId: 890, label: "Adamant arrows" },
    114: { skill: "fletching", action: "fletch", targetId: 892, label: "Rune arrows" },
};

function buildFletchingProductItemIds(): Set<number> {
    const ids = new Set<number>();
    for (const logId of FLETCHING_LOG_IDS) {
        for (const product of getFletchingProductsForLog(logId) ?? []) ids.add(product.productItemId);
    }
    for (const recipe of FLETCHING_COMBINE_RECIPES) ids.add(recipe.productItemId);
    return ids;
}

const FLETCHING_PRODUCT_ITEM_IDS = buildFletchingProductItemIds();

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const csvRows = parseCsvFile(path.join(repoRoot, "tasks.csv"));
    const csvById = new Map(csvRows.map((r) => [r.id, r]));
    const liveNames = new Set(LEAGUE_TASKS.map((t) => t.name.trim()));

    console.log(`[verify-phase2d2-slice2-candidates] Phase 2D-2 Slice 2 gate (${SLICE2_SOURCE_IDS.length} tasks)\n`);

    let failed = 0;
    const fail = (msg: string) => {
        console.log(`FAIL  ${msg}`);
        failed++;
    };
    const ok = (msg: string) => console.log(`OK    ${msg}`);

    for (const sourceId of SLICE2_SOURCE_IDS) {
        const csv = csvById.get(sourceId);
        if (!csv) {
            fail(`CSV ${sourceId}: missing row`);
            continue;
        }
        if (liveNames.has(csv.name.trim())) {
            fail(`CSV ${sourceId}: already live (${csv.name})`);
            continue;
        }

        const expected = EXPECTED_TRIGGERS[sourceId];
        const manifest = getPhase2dSkillingTrigger(sourceId);
        if (manifest?.type !== "skilling_action") {
            fail(`CSV ${sourceId}: missing phase2d manifest trigger`);
            continue;
        }
        if (
            manifest.skill !== expected.skill ||
            manifest.action !== expected.action ||
            !manifest.targetIds?.includes(expected.targetId)
        ) {
            fail(
                `CSV ${sourceId}: manifest mismatch (got ${manifest.skill}/${manifest.action}/${manifest.targetIds?.join(",")})`,
            );
            continue;
        }
        ok(`CSV ${sourceId} manifest fletching/fletch/${expected.targetId} (${expected.label})`);

        if (!FLETCHING_PRODUCT_ITEM_IDS.has(expected.targetId)) {
            fail(`CSV ${sourceId}: targetId ${expected.targetId} not in fletching product set`);
            continue;
        }
        ok(`CSV ${sourceId} fletching.ts productItemId ${expected.targetId}`);
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2d2-slice2-candidates] ${failed} check(s) failed`);
        process.exit(1);
    }
    console.log("[verify-phase2d2-slice2-candidates] PASS: all 7 arrow candidates ready for import");
}

main();
