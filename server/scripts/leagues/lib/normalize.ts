/**
 * Normalize task titles so TriggerParser patterns match OSRS / server conventions.
 */
export function normalizeTaskNameForParser(name: string): string {
    let n = name.trim().replace(/\.+$/, "").trim();
    if (/^achieve your first level up$/i.test(n)) {
        return "Achieve Your First Level Up";
    }
    const firstLevel = n.match(/^achieve your first level (\d+)$/i);
    if (firstLevel) {
        return `Achieve Your First Level ${firstLevel[1]}`;
    }
    const baseLevel = n.match(/^base level (\d+)$/i);
    if (baseLevel) {
        return `Reach Base Level ${baseLevel[1]}`;
    }
    return n;
}

export function extractNpcTargetFromKillTask(name: string): string {
    let npcName = name.trim();
    const killMatch = npcName.match(/^(defeat|kill|slay)\s+(a\s+|an\s+|the\s+)?(\d+\s+)?(.+)$/i);
    if (killMatch) {
        npcName = killMatch[4].trim();
    }
    npcName = npcName.replace(/\s+(in|at|on|near)\s+.+$/i, "").trim();
    npcName = npcName.replace(/\.$/, "").trim();
    return npcName;
}

function cleanItemPhrase(raw: string): string {
    let item = raw.trim().replace(/\.+$/, "").trim();
    item = item.replace(/\s*\(u\)\s*$/i, "");
    // "any Piece of 3rd Age Armour" → "3rd age armour" (best-effort)
    item = item.replace(/^any\s+piece of\s+/i, "");
    item = item.replace(/^any\s+/i, "");
    item = item.replace(/\s+item$/i, "");
    item = item.replace(/\s+ornament kit item$/i, " ornament kit");
    return item.trim();
}

export function extractItemTargetFromTask(name: string): string | undefined {
    const patterns = [
        /^(equip|wear|obtain|receive|get|loot)\s+(a\s+|an\s+|the\s+|any\s+)?(\d+\s+)?(.+)$/i,
        /^(craft|smith|cook|fletch|create|make|brew)\s+(a\s+|an\s+|the\s+)?(\d+\s+)?(.+)$/i,
        /^(chop|mine|catch|fish|pick|harvest)\s+(a\s+|an\s+|the\s+)?(\d+\s+)?(.+)$/i,
    ];
    for (const pattern of patterns) {
        const m = name.match(pattern);
        if (m) {
            return cleanItemPhrase(m[4]);
        }
    }
    return undefined;
}

export function extractPickpocketTarget(name: string): string | undefined {
    const m = name.match(/^pickpocket\s+(?:a|an)\s+(.+?)\.?$/i);
    return m?.[1]?.trim();
}
