/**
 * Static verification: SkillActionHandler emits league skilling_action for all
 * Phase 2C wired skills on successful completion paths.
 *
 * Usage: npx tsx server/scripts/leagues/verify-phase2c-skilling-emits.ts
 */
import fs from "fs";
import path from "path";

type EmitExpectation = {
    skill: string;
    action: string;
    executeMethod: string;
};

const EXPECTED_EMITS: EmitExpectation[] = [
    { skill: "mining", action: "mine", executeMethod: "executeSkillMiningAction" },
    { skill: "fishing", action: "catch", executeMethod: "executeSkillFishingAction" },
    { skill: "woodcutting", action: "chop", executeMethod: "executeSkillWoodcutAction" },
    { skill: "cooking", action: "cook", executeMethod: "executeSkillCookAction" },
    { skill: "fletching", action: "fletch", executeMethod: "executeSkillFletchAction" },
    { skill: "smithing", action: "smith", executeMethod: "executeSkillSmithAction" },
    { skill: "crafting", action: "spin", executeMethod: "executeSkillSpinAction" },
    { skill: "firemaking", action: "burn", executeMethod: "executeSkillFiremakingAction" },
    { skill: "thieving", action: "pickpocket", executeMethod: "executeSkillPickpocketAction" },
];

function extractMethodBody(source: string, methodName: string): string {
    const start = source.indexOf(`${methodName}(`);
    if (start < 0) {
        return "";
    }
    const braceStart = source.indexOf("{", start);
    if (braceStart < 0) {
        return "";
    }
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(braceStart, i + 1);
            }
        }
    }
    return "";
}

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const handlerPath = path.join(
        repoRoot,
        "server/src/game/actions/handlers/SkillActionHandler.ts",
    );
    const source = fs.readFileSync(handlerPath, "utf8");

    let failed = 0;
    console.log("[verify-phase2c-skilling-emits] Checking SkillActionHandler emit paths\n");

    for (const exp of EXPECTED_EMITS) {
        const body = extractMethodBody(source, exp.executeMethod);
        if (!body) {
            console.log(`FAIL  ${exp.skill}/${exp.action} — method ${exp.executeMethod} not found`);
            failed++;
            continue;
        }
        const hasEmit = body.includes("emitLeagueSkillingAction");
        const hasSkill =
            body.includes(`SKILLING_ACTION_SKILLS.${exp.skill}`) ||
            body.includes(`"${exp.skill}"`);
        const hasAction =
            body.includes(`SKILLING_ACTION_VERBS.${exp.action}`) ||
            body.includes(`"${exp.action}"`);

        if (hasEmit && hasSkill && hasAction) {
            console.log(`OK    ${exp.skill}/${exp.action} via ${exp.executeMethod}`);
        } else {
            console.log(
                `FAIL  ${exp.skill}/${exp.action} — emit=${hasEmit} skill=${hasSkill} action=${hasAction} (${exp.executeMethod})`,
            );
            failed++;
        }
    }

    console.log("");
    if (failed > 0) {
        console.error(`[verify-phase2c-skilling-emits] ${failed} emit path(s) missing`);
        process.exit(1);
    }
    console.log("[verify-phase2c-skilling-emits] All wired skilling emit paths present");
}

main();
