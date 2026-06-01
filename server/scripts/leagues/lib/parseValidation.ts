import fs from "fs";

import { parseCsvText } from "./csv";
import type { TaskStatus, ValidationRow } from "./types";

export function parseValidationReport(filePath: string): ValidationRow[] {
    const text = fs.readFileSync(filePath, "utf8");
    const rows = parseCsvText(text);
    if (rows.length < 2) return [];

    const header = rows[0];
    const idx = {
        task_id: header.indexOf("task_id"),
        task_name: header.indexOf("task_name"),
        status: header.indexOf("status"),
        matched_content: header.indexOf("matched_content"),
        matched_hook: header.indexOf("matched_hook"),
        missing_requirement: header.indexOf("missing_requirement"),
        suggested_fix: header.indexOf("suggested_fix"),
    };

    const out: ValidationRow[] = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const task_id = parseInt(r[idx.task_id] ?? "-1", 10);
        if (!Number.isFinite(task_id)) continue;
        const status = (r[idx.status] ?? "") as TaskStatus;
        out.push({
            task_id,
            task_name: r[idx.task_name] ?? "",
            batch: "misc",
            status,
            matched_content: r[idx.matched_content] ?? "",
            matched_hook: r[idx.matched_hook] ?? "",
            missing_requirement: r[idx.missing_requirement] ?? "",
            suggested_fix: r[idx.suggested_fix] ?? "",
        });
    }
    return out;
}
