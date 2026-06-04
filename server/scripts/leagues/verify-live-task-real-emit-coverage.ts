/**
 * Verify every live trigger type has a reachable real gameplay emit source.
 *
 * Usage: npx tsx server/scripts/leagues/verify-live-task-real-emit-coverage.ts
 */
import fs from "fs";
import path from "path";

import { LEAGUE_TASK_TRIGGER_BY_ID } from "../../../src/shared/leagues/leagueTaskTriggers.data";
import { buildLiveTaskGameplayAudit } from "./lib/liveTaskGameplayAudit";

const SKILL_HANDLER = "server/src/game/actions/handlers/SkillActionHandler.ts";
const HUNTER_MODULE = "server/src/game/scripts/modules/skills/hunter.ts";
const WS_SERVER = "server/src/network/wsServer.ts";
const SPELL_WIDGETS = "server/src/game/scripts/modules/spellbookWidgets.ts";
const COMBAT_HANDLER = "server/src/game/actions/handlers/CombatActionHandler.ts";

type EmitCheck = {
    triggerType: string;
    liveCount: number;
    sourceFile: string;
    pattern: string;
    description: string;
};

const STATIC_CHECKS: Omit<EmitCheck, "liveCount">[] = [
    {
        triggerType: "skilling_action",
        sourceFile: SKILL_HANDLER,
        pattern: "emitLeagueSkillingAction",
        description: "SkillActionHandler emits on successful skill actions",
    },
    {
        triggerType: "item_equip",
        sourceFile: WS_SERVER,
        pattern: "leagueTaskManager?.onItemEquip",
        description: "wsServer equipItem notifies league manager",
    },
    {
        triggerType: "item_obtain",
        sourceFile: WS_SERVER,
        pattern: "leagueTaskManager?.onItemObtain",
        description: "wsServer addItemToInventory notifies league manager",
    },
    {
        triggerType: "item_craft",
        sourceFile: WS_SERVER,
        pattern: "leagueTaskManager?.onItemCraft",
        description: "wsServer wires SkillActionHandler onItemCraft to league manager",
    },
    {
        triggerType: "npc_kill",
        sourceFile: WS_SERVER,
        pattern: "leagueTaskManager?.onNpcKill",
        description: "wsServer NPC death notifies league manager",
    },
    {
        triggerType: "spell_cast",
        sourceFile: SPELL_WIDGETS,
        pattern: "onLeagueSpellCast",
        description: "Spellbook teleports emit league spell cast",
    },
    {
        triggerType: "area_enter",
        sourceFile: WS_SERVER,
        pattern: "leagueTaskManager?.onAreaEnter",
        description: "Movement tick detects league area entry",
    },
    {
        triggerType: "wilderness_level",
        sourceFile: WS_SERVER,
        pattern: "onWildernessLevelCross",
        description: "Wilderness level changes emit league hook",
    },
    {
        triggerType: "level_reach",
        sourceFile: WS_SERVER,
        pattern: "syncSkillProgressTasks",
        description: "Skill progress synced on login/XP",
    },
    {
        triggerType: "collection_log",
        sourceFile: WS_SERVER,
        pattern: "onCollectionLogEvent",
        description: "Collection log unlock emits league hook",
    },
];

function extractMethodBody(source: string, methodName: string): string {
    const start = source.indexOf(`${methodName}(`);
    if (start < 0) return "";
    const braceStart = source.indexOf("{", start);
    if (braceStart < 0) return "";
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
            depth--;
            if (depth === 0) return source.slice(braceStart, i + 1);
        }
    }
    return "";
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const audit = buildLiveTaskGameplayAudit(repoRoot);

    const liveByType = new Map<string, number>();
    for (const trigger of Object.values(LEAGUE_TASK_TRIGGER_BY_ID)) {
        liveByType.set(trigger.type, (liveByType.get(trigger.type) ?? 0) + 1);
    }

    let failed = 0;
    console.log("[verify-live-task-real-emit-coverage] Static emit wiring checks\n");

    for (const check of STATIC_CHECKS) {
        const count = liveByType.get(check.triggerType) ?? 0;
        if (count === 0) continue;
        const filePath = path.join(repoRoot, check.sourceFile);
        if (!fs.existsSync(filePath)) {
            console.log(`FAIL  ${check.triggerType} (${count} live) — missing ${check.sourceFile}`);
            failed++;
            continue;
        }
        const src = fs.readFileSync(filePath, "utf8");
        if (!src.includes(check.pattern)) {
            console.log(
                `FAIL  ${check.triggerType} (${count} live) — pattern "${check.pattern}" not in ${check.sourceFile}`,
            );
            failed++;
            continue;
        }
        console.log(`OK    ${check.triggerType} (${count} live) — ${check.description}`);
    }

    // Skilling sub-path spot checks
    const handlerPath = path.join(repoRoot, SKILL_HANDLER);
    const handlerSrc = fs.readFileSync(handlerPath, "utf8");
    const skillMethods = [
        ["mining", "executeSkillMiningAction"],
        ["fishing", "executeSkillFishingAction"],
        ["woodcutting", "executeSkillWoodcutAction"],
        ["cooking", "executeSkillCookAction"],
        ["firemaking", "executeSkillFiremakingAction"],
        ["fletching", "executeSkillFletchAction"],
        ["smithing", "executeSkillSmithAction"],
        ["crafting/spin", "executeSkillSpinAction"],
        ["thieving", "executeSkillPickpocketAction"],
    ] as const;

    console.log("\n[verify-live-task-real-emit-coverage] Skilling handler emit paths");
    for (const [label, method] of skillMethods) {
        const body = extractMethodBody(handlerSrc, method);
        if (body.includes("emitLeagueSkillingAction")) {
            console.log(`OK    ${label} via ${method}`);
        } else {
            console.log(`FAIL  ${label} — ${method} missing emitLeagueSkillingAction`);
            failed++;
        }
    }

    const hunterPath = path.join(repoRoot, HUNTER_MODULE);
    const hunterSrc = fs.readFileSync(hunterPath, "utf8");
    if (hunterSrc.includes("onLeagueSkillingAction")) {
        console.log("OK    hunter trap catch via checkTrap → onLeagueSkillingAction");
    } else {
        console.log("FAIL  hunter module missing onLeagueSkillingAction emit in checkTrap");
        failed++;
    }
    const wsPath = path.join(repoRoot, WS_SERVER);
    const wsSrc = fs.readFileSync(wsPath, "utf8");
    if (wsSrc.includes("onLeagueSkillingAction")) {
        console.log("OK    scriptRuntime wires onLeagueSkillingAction to league manager");
    } else {
        console.log("FAIL  wsServer scriptRuntime missing onLeagueSkillingAction wiring");
        failed++;
    }

    // Combat handler also emits npc kill
    const combatPath = path.join(repoRoot, COMBAT_HANDLER);
    const combatSrc = fs.readFileSync(combatPath, "utf8");
    if (combatSrc.includes("onNpcKill")) {
        console.log("OK    CombatActionHandler.onNpcKill callback");
    } else {
        console.log("FAIL  CombatActionHandler missing onNpcKill");
        failed++;
    }

    // Audit-flagged tasks without emit reachability
    const badTasks = audit.entries.filter(
        (e) =>
            e.classification === "missing_emit" ||
            e.classification === "likely_unreachable" ||
            e.classification === "missing_content",
    );
    console.log(
        `\n[verify-live-task-real-emit-coverage] Audit flagged ${badTasks.length} live task(s) with reachability issues`,
    );
    for (const e of badTasks) {
        console.log(`  taskId ${e.taskId} | ${e.classification} | ${e.name}`);
        if (e.issue) console.log(`    ${e.issue}`);
    }

    if (failed > 0) {
        console.error(`\n[verify-live-task-real-emit-coverage] ${failed} static check(s) failed`);
        process.exit(1);
    }
    console.log("\n[verify-live-task-real-emit-coverage] All emit coverage checks passed");
}

main();
