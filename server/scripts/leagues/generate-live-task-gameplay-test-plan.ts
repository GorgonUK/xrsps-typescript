/**
 * Generate in-game gameplay test checklist from live task audit.
 *
 * Usage: npx tsx server/scripts/leagues/generate-live-task-gameplay-test-plan.ts
 */
import fs from "fs";
import path from "path";

import { buildRegistries } from "./lib/registries";
import {
    buildGameplayTestGroups,
    buildLiveTaskGameplayAudit,
} from "./lib/liveTaskGameplayAudit";

function main(): void {
    const repoRoot = path.resolve(__dirname, "../../..");
    const reg = buildRegistries(repoRoot);
    const audit = buildLiveTaskGameplayAudit(repoRoot);
    const groups = buildGameplayTestGroups(audit);

    const lines: string[] = [
        "# Live League Task — Real Gameplay Test Plan",
        "",
        `Generated: ${audit.generatedAt}`,
        "",
        `Live tasks: **${audit.liveTaskCount}**`,
        "",
        "## Summary",
        "",
        "| Classification | Count |",
        "|---|---:|",
    ];

    for (const [k, v] of Object.entries(audit.summary)) {
        if (v > 0) lines.push(`| ${k} | ${v} |`);
    }

    lines.push("", "## How to use", "");
    lines.push(
        "Perform each gameplay action once in-game. All listed task IDs should complete (varp notification).",
    );
    lines.push(
        "If a task does not complete, note taskId and file an issue — do not use admin sim unless verifying wiring.",
    );
    lines.push("", "---", "");

    const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [, g] of sorted) {
        const label = g.actionLabel;
        const itemOrNpc =
            g.managerCall.includes("onNpcKill")
                ? reg.getNpcName(g.taskIds.length ? audit.entries.find((e) => e.taskId === g.taskIds[0])?.targetIds[0] ?? 0 : 0)
                : g.managerCall.includes("item_equip") || g.managerCall.includes("item_obtain")
                  ? reg.getItemName(
                        audit.entries.find((e) => e.taskId === g.taskIds[0])?.targetIds[0] ?? 0,
                    )
                  : "";

        lines.push(`## ${label}${itemOrNpc && !itemOrNpc.startsWith("item:") ? ` — ${itemOrNpc}` : ""}`);
        lines.push("");
        lines.push(`**Action:** \`${g.managerCall}\``);
        lines.push("");
        lines.push(`**Should complete ${g.taskIds.length} task(s):**`);
        lines.push("");
        for (let i = 0; i < g.taskIds.length; i++) {
            const tid = g.taskIds[i];
            const csv = g.sourceCsvIds[i];
            const name = g.names[i];
            lines.push(`- [ ] taskId **${tid}** (CSV ${csv ?? "?"}) — ${name}`);
        }
        lines.push("");
    }

    lines.push("## Skill progress / milestones (login or XP sync)", "");
    lines.push("These complete via `syncSkillProgressTasks` on login or after gaining XP:");
    lines.push("");
    for (const e of audit.entries.filter((x) =>
        ["level_reach", "total_level_reach", "combat_level_reach", "xp_reach"].includes(x.triggerType),
    )) {
        lines.push(`- [ ] taskId **${e.taskId}** — ${e.name} (${e.triggerDetail})`);
    }

    lines.push("", "## Area enter (walk into bounds)", "");
    for (const e of audit.entries.filter((x) => x.triggerType === "area_enter")) {
        lines.push(`- [ ] taskId **${e.taskId}** — ${e.name} (${e.triggerDetail})`);
    }

    lines.push("", "## Wilderness level cross", "");
    for (const e of audit.entries.filter((x) => x.triggerType === "wilderness_level")) {
        lines.push(`- [ ] taskId **${e.taskId}** — ${e.name} (${e.triggerDetail})`);
    }

    lines.push("", "## Known unreachable / needs fix (skip in-game until fixed)", "");
    for (const e of audit.entries.filter((x) =>
        ["likely_unreachable", "missing_emit", "missing_content"].includes(x.classification),
    )) {
        lines.push(`- taskId **${e.taskId}** — ${e.name}: ${e.issue ?? e.classification}`);
    }

    const outPath = path.join(
        repoRoot,
        "server/data/leagues/reports/live-task-real-gameplay-test-plan.md",
    );
    fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
    console.log(`[generate-live-task-gameplay-test-plan] Wrote ${outPath}`);
    console.log(`[generate-live-task-gameplay-test-plan] Test groups: ${groups.size}`);
}

main();
