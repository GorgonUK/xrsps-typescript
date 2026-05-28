import fs from "fs";

import type { CsvTaskRow } from "./types";

export function parseCsvFile(filePath: string): CsvTaskRow[] {
    const text = fs.readFileSync(filePath, "utf8");
    const rows = parseCsvText(text);
    if (rows.length < 2) return [];
    const out: CsvTaskRow[] = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 6) continue;
        const id = parseInt(r[0], 10);
        if (!Number.isFinite(id)) continue;
        out.push({
            id,
            area: r[1] ?? "",
            name: r[2] ?? "",
            requirements: r[3] ?? "",
            difficulty: r[4] ?? "",
            points: parseInt(r[5], 10) || 0,
            combatMastery: r[6] ?? "",
        });
    }
    return out;
}

export function parseCsvText(text: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    let field = "";
    let row: string[] = [];
    let inQ = false;
    while (i < text.length) {
        const c = text[i];
        if (inQ) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i += 2;
                continue;
            }
            if (c === '"') {
                inQ = false;
                i++;
                continue;
            }
            field += c;
            i++;
            continue;
        }
        if (c === '"') {
            inQ = true;
            i++;
            continue;
        }
        if (c === ",") {
            row.push(field);
            field = "";
            i++;
            continue;
        }
        if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            if (row.some((x, j) => j > 0 || x !== "")) rows.push(row);
            field = "";
            row = [];
            i++;
            continue;
        }
        field += c;
        i++;
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        if (row.some((x, j) => j > 0 || x !== "")) rows.push(row);
    }
    return rows;
}

export function serializeReportCsv(rows: Array<Record<string, string | number>>): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number): string => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
    }
    return lines.join("\n") + "\n";
}

export function writeReport(
    outDir: string,
    fileName: string,
    rows: Array<Record<string, string | number>>,
): void {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/${fileName}`, serializeReportCsv(rows), "utf8");
}
