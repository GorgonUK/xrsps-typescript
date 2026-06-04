/** Approved Phase 7B-2 Slice 1 regional NPC disambiguation (frozen from decision report). */
export type Phase7b2Slice1Entry = {
    sourceTaskId: number;
    chosenNpcId: number;
    candidateNpcIds: number[];
    regionProof: string;
    confidence: "high" | "medium-high" | "medium";
};

export const PHASE7B2_SLICE1_SOURCE_IDS = [
    661, 662, 751, 901, 977, 978, 983, 1046, 1050, 1052, 1053, 1055, 1120, 1156, 1228, 1271, 1273,
    1281, 1367,
] as const;

/** Region bounds used to prove exactly-one spawned candidate (npc-spawns.json). */
export const PHASE7B2_SLICE1_REGION_BOUNDS: Record<
    number,
    { minX: number; minY: number; maxX: number; maxY: number }
> = {
    661: { minX: 3072, minY: 9856, maxX: 3135, maxY: 9919 },
    662: { minX: 3150, minY: 9850, maxX: 3300, maxY: 9920 },
    751: { minX: 2688, minY: 2688, maxX: 2943, maxY: 3200 },
    901: { minX: 2688, minY: 9984, maxX: 2815, maxY: 10111 },
    977: { minX: 2528, minY: 3168, maxX: 2559, maxY: 3199 },
    978: { minX: 2432, minY: 3136, maxX: 2815, maxY: 3519 },
    983: { minX: 2432, minY: 3136, maxX: 2815, maxY: 3519 },
    1046: { minX: 3382, minY: 3010, maxX: 3388, maxY: 3020 },
    1050: { minX: 3200, minY: 9344, maxX: 3327, maxY: 9471 },
    1052: { minX: 3456, minY: 9472, maxX: 3519, maxY: 9535 },
    1053: { minX: 3456, minY: 9472, maxX: 3519, maxY: 9535 },
    1055: { minX: 3264, minY: 2880, maxX: 3280, maxY: 2900 },
    1120: { minX: 3392, minY: 3520, maxX: 3455, maxY: 9949 },
    1156: { minX: 3392, minY: 3520, maxX: 3455, maxY: 9949 },
    1228: { minX: 2112, minY: 3008, maxX: 2431, maxY: 3391 },
    1271: { minX: 2944, minY: 3520, maxX: 3391, maxY: 3966 },
    1273: { minX: 2944, minY: 3520, maxX: 3391, maxY: 3966 },
    1281: { minX: 3192, minY: 3800, maxX: 3223, maxY: 3839 },
    1367: { minX: 1600, minY: 9984, maxX: 1727, maxY: 10111 },
};

export const PHASE7B2_SLICE1_APPROVED: Phase7b2Slice1Entry[] = [
    {
        sourceTaskId: 661,
        chosenNpcId: 2856,
        candidateNpcIds: [2510, 2511, 2512, 2856, 2857],
        regionProof: "Edgeville Dungeon 3072-3135 x 9856-9919",
        confidence: "high",
    },
    {
        sourceTaskId: 662,
        chosenNpcId: 74,
        candidateNpcIds: [70, 71, 72, 73, 74],
        regionProof: "Varrock Sewers 3150-3300 x 9850-9920",
        confidence: "high",
    },
    {
        sourceTaskId: 751,
        chosenNpcId: 2848,
        candidateNpcIds: [23, 1038, 1469, 1817, 2848],
        regionProof: "Karamja league area 2688-2943 x 2688-3200",
        confidence: "high",
    },
    {
        sourceTaskId: 901,
        chosenNpcId: 417,
        candidateNpcIds: [417, 418, 9283, 9284, 9285],
        regionProof: "Fremennik Slayer Dungeon 2688-2815 x 9984-10111",
        confidence: "high",
    },
    {
        sourceTaskId: 977,
        chosenNpcId: 2095,
        candidateNpcIds: [136, 1153, 2095, 2096, 2233],
        regionProof: "Tree Gnome Village ogre pen 2528-2559 x 3168-3199",
        confidence: "high",
    },
    {
        sourceTaskId: 978,
        chosenNpcId: 2064,
        candidateNpcIds: [2064, 2065, 2066],
        regionProof: "Kandarin league area 2432-2815 x 3136-3519",
        confidence: "medium-high",
    },
    {
        sourceTaskId: 983,
        chosenNpcId: 106,
        candidateNpcIds: [106, 110, 116, 117, 231],
        regionProof: "Kandarin league area 2432-2815 x 3136-3519",
        confidence: "medium-high",
    },
    {
        sourceTaskId: 1046,
        chosenNpcId: 459,
        candidateNpcIds: [459, 460, 461, 12003],
        regionProof: "Desert lizard cluster 3382-3388 x 3010-3020",
        confidence: "high",
    },
    {
        sourceTaskId: 1050,
        chosenNpcId: 423,
        candidateNpcIds: [423, 7249, 11238],
        regionProof: "Smoke Dungeon 3200-3327 x 9344-9471",
        confidence: "high",
    },
    {
        sourceTaskId: 1052,
        chosenNpcId: 955,
        candidateNpcIds: [955, 956, 961],
        regionProof: "Kalphite Lair 3456-3519 x 9472-9535",
        confidence: "high",
    },
    {
        sourceTaskId: 1053,
        chosenNpcId: 957,
        candidateNpcIds: [138, 957, 958],
        regionProof: "Kalphite Lair 3456-3519 x 9472-9535",
        confidence: "high",
    },
    {
        sourceTaskId: 1055,
        chosenNpcId: 4184,
        candidateNpcIds: [4184, 11513, 11581, 11582, 11705],
        regionProof: "Nardah crocodile bank 3264-3280 x 2880-2900",
        confidence: "high",
    },
    {
        sourceTaskId: 1120,
        chosenNpcId: 415,
        candidateNpcIds: [415, 416, 7241, 11239, 14174],
        regionProof: "Slayer Tower all floors 3392-3455 x 3520-9949",
        confidence: "high",
    },
    {
        sourceTaskId: 1156,
        chosenNpcId: 2834,
        candidateNpcIds: [2834, 4504, 4562, 5791, 6824],
        regionProof: "Slayer Tower all floors 3392-3455 x 3520-9949",
        confidence: "high",
    },
    {
        sourceTaskId: 1228,
        chosenNpcId: 106,
        candidateNpcIds: [106, 110, 116, 117, 231],
        regionProof: "Tirannwn league area 2112-2431 x 3008-3391",
        confidence: "medium-high",
    },
    {
        sourceTaskId: 1271,
        chosenNpcId: 104,
        candidateNpcIds: [104, 105, 135, 3133, 7256],
        regionProof: "Wilderness 2944-3391 x 3520-3966",
        confidence: "medium-high",
    },
    {
        sourceTaskId: 1273,
        chosenNpcId: 2841,
        candidateNpcIds: [2841, 2842, 2851, 13802],
        regionProof: "Wilderness 2944-3391 x 3520-3966",
        confidence: "medium-high",
    },
    {
        sourceTaskId: 1281,
        chosenNpcId: 6593,
        candidateNpcIds: [6593, 12607, 12608],
        regionProof: "Lava Maze 3192-3223 x 3800-3839",
        confidence: "high",
    },
    {
        sourceTaskId: 1367,
        chosenNpcId: 7249,
        candidateNpcIds: [423, 7249, 11238],
        regionProof: "Catacombs of Kourend 1600-1727 x 9984-10111",
        confidence: "high",
    },
];
