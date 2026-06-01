export type AreaBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    plane?: number;
};

export type AreaDefinition = {
    key: string;
    bounds: AreaBounds;
};

const AREA_DEFINITIONS: AreaDefinition[] = [
    {
        key: "mole_lair",
        bounds: { minX: 1728, minY: 5120, maxX: 1791, maxY: 5247, plane: 0 },
    },
    {
        key: "nightmare_area",
        bounds: { minX: 3840, minY: 9920, maxX: 3903, maxY: 9983, plane: 0 },
    },
    {
        key: "revenant_caves",
        bounds: { minX: 3136, minY: 10048, maxX: 3263, maxY: 10175, plane: 0 },
    },
    {
        key: "catacombs_of_kourend",
        bounds: { minX: 1600, minY: 9984, maxX: 1727, maxY: 10111, plane: 0 },
    },
    {
        key: "wilderness",
        bounds: { minX: 2944, minY: 3520, maxX: 3391, maxY: 3966, plane: 0 },
    },
    {
        key: "rogues_castle",
        bounds: { minX: 3072, minY: 3904, maxX: 3135, maxY: 3967, plane: 0 },
    },
    {
        key: "corporeal_beast_lair",
        bounds: { minX: 2944, minY: 4352, maxX: 3007, maxY: 4415, plane: 2 },
    },
    {
        key: "crafting_guild",
        bounds: { minX: 2925, minY: 3274, maxX: 2944, maxY: 3292, plane: 0 },
    },
    {
        key: "warriors_guild",
        bounds: { minX: 2833, minY: 3531, maxX: 2878, maxY: 3558, plane: 0 },
    },
    {
        key: "woodcutting_guild",
        bounds: { minX: 1608, minY: 3479, maxX: 1657, maxY: 3516, plane: 0 },
    },
    {
        key: "taverley_dungeon",
        bounds: { minX: 2802, minY: 9715, maxX: 2959, maxY: 9858, plane: 0 },
    },
];

const AREA_BY_KEY = new Map(AREA_DEFINITIONS.map((d) => [d.key, d] as const));

export function getLeagueAreaDefinition(areaKey: string): AreaDefinition | undefined {
    return AREA_BY_KEY.get(areaKey);
}

export function getLeagueAreaKeys(): string[] {
    return AREA_DEFINITIONS.map((d) => d.key);
}

export function isInsideLeagueArea(areaKey: string, x: number, y: number, plane: number): boolean {
    const def = AREA_BY_KEY.get(areaKey);
    if (!def) return false;
    const b = def.bounds;
    if (b.plane !== undefined && (plane | 0) !== (b.plane | 0)) return false;
    return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Current league area keys containing (x, y, plane) — for login seeding without enter events. */
export function getLeagueAreasInsideNow(x: number, y: number, plane: number): Set<string> {
    const insideNow = new Set<string>();
    for (const def of AREA_DEFINITIONS) {
        if (isInsideLeagueArea(def.key, x, y, plane)) {
            insideNow.add(def.key);
        }
    }
    return insideNow;
}

export function resolveEnteredLeagueAreas(
    previousInside: ReadonlySet<string>,
    x: number,
    y: number,
    plane: number,
): { entered: string[]; insideNow: Set<string> } {
    const insideNow = new Set<string>();
    const entered: string[] = [];
    for (const def of AREA_DEFINITIONS) {
        if (!isInsideLeagueArea(def.key, x, y, plane)) continue;
        insideNow.add(def.key);
        if (!previousInside.has(def.key)) {
            entered.push(def.key);
        }
    }
    return { entered, insideNow };
}
