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
    // Misthalin towns (RuneRogue Boundary.java — VARROCK_BOUNDARY, DRAYNOR_BOUNDARY, LUMRIDGE_BOUNDARY)
    {
        key: "varrock",
        bounds: { minX: 3136, minY: 3349, maxX: 3326, maxY: 3519, plane: 0 },
    },
    {
        key: "draynor",
        bounds: { minX: 3065, minY: 3216, maxX: 3136, maxY: 3292, plane: 0 },
    },
    // West of Draynor (RuneRogue DRAYNOR_BOUNDARY minX 3065); covers docks, jail, southern willows, spirit tree.
    {
        key: "port_sarim",
        bounds: { minX: 3008, minY: 3188, maxX: 3064, maxY: 3290, plane: 0 },
    },
    {
        key: "draynor_manor",
        bounds: { minX: 3074, minY: 3311, maxX: 3131, maxY: 3388, plane: 0 },
    },
    {
        key: "lumbridge",
        bounds: { minX: 3142, minY: 3139, maxX: 3265, maxY: 3306, plane: 0 },
    },
    // Varrock south-east mine (iron rocks cluster ~3286–3293 x 3366–3370)
    {
        key: "varrock_mine",
        bounds: { minX: 3279, minY: 3361, maxX: 3303, maxY: 3378, plane: 0 },
    },
    // Lumbridge swamp copper/tin rocks (west of castle)
    {
        key: "lumbridge_swamp",
        bounds: { minX: 3136, minY: 3140, maxX: 3172, maxY: 3178, plane: 0 },
    },
    {
        key: "karamja",
        bounds: { minX: 2816, minY: 3139, maxX: 2965, maxY: 3205, plane: 0 },
    },
    // Kourend & Kebos (league region 20; leagueWidgets packCoord + phase7b2 regional scans)
    {
        key: "kourend",
        bounds: { minX: 1280, minY: 3456, maxX: 1791, maxY: 4031, plane: 0 },
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
