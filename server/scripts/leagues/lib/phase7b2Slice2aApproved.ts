/** Approved Phase 7B-2 Slice 2A sub-chamber NPC disambiguation (spawn-cluster proof). */
import type { Phase7b2Slice1Entry } from "./phase7b2Slice1Approved";

export type Phase7b2Slice2aBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    plane?: number;
};

export type Phase7b2Slice2aEntry = Phase7b2Slice1Entry & {
    boundsProof: string;
    spawnProof: string;
};

export const PHASE7B2_SLICE2A_SOURCE_IDS = [
    663, 753, 755, 756, 809, 811, 814, 902, 903, 1047, 1116, 1117, 1118, 1226, 1266, 1268, 1269, 1272,
    1282, 1361, 1370,
] as const;

export const PHASE7B2_SLICE2A_REGION_BOUNDS: Record<number, Phase7b2Slice2aBounds> = {
    663: { minX: 3153, minY: 9901, maxX: 3157, maxY: 9905, plane: 0 },
    753: { minX: 2626, minY: 9541, maxX: 2630, maxY: 9545, plane: 2 },
    755: { minX: 2698, minY: 9487, maxX: 2702, maxY: 9491, plane: 0 },
    756: { minX: 2702, minY: 9537, maxX: 2706, maxY: 9541, plane: 0 },
    809: { minX: 3014, minY: 3514, maxX: 3018, maxY: 3518, plane: 0 },
    811: { minX: 2901, minY: 9778, maxX: 2905, maxY: 9782, plane: 0 },
    814: { minX: 2924, minY: 9800, maxX: 2928, maxY: 9804, plane: 0 },
    902: { minX: 2719, minY: 10012, maxX: 2723, maxY: 10016, plane: 0 },
    903: { minX: 2692, minY: 9993, maxX: 2696, maxY: 9997, plane: 0 },
    1047: { minX: 3162, minY: 2982, maxX: 3166, maxY: 2986, plane: 0 },
    1116: { minX: 3401, minY: 9932, maxX: 3405, maxY: 9936, plane: 3 },
    1117: { minX: 3409, minY: 3532, maxX: 3413, maxY: 3536, plane: 1 },
    1118: { minX: 3425, minY: 9941, maxX: 3429, maxY: 9945, plane: 3 },
    1226: { minX: 2277, minY: 3217, maxX: 2281, maxY: 3221, plane: 0 },
    1266: { minX: 3006, minY: 3593, maxX: 3010, maxY: 3597, plane: 0 },
    1268: { minX: 3329, minY: 3670, maxX: 3333, maxY: 3674, plane: 0 },
    1269: { minX: 3280, minY: 3878, maxX: 3284, maxY: 3882, plane: 0 },
    1272: { minX: 2945, minY: 3893, maxX: 2949, maxY: 3897, plane: 0 },
    1282: { minX: 3021, minY: 3627, maxX: 3025, maxY: 3631, plane: 0 },
    1361: { minX: 1361, minY: 3712, maxX: 1365, maxY: 3716, plane: 0 },
    1370: { minX: 1437, minY: 3608, maxX: 1441, maxY: 3612, plane: 0 },
};

export const PHASE7B2_SLICE2A_APPROVED: Phase7b2Slice2aEntry[] = [
    { sourceTaskId: 663, chosenNpcId: 2092, candidateNpcIds: [2090, 2091, 2092, 2093, 3851], regionProof: "Varrock Sewers moss giant room 3153-3157 x 9901-9905", boundsProof: "3153-3157 x 9901-9905 plane=0", spawnProof: "3155,9903,0", confidence: "high" },
    { sourceTaskId: 753, chosenNpcId: 2079, candidateNpcIds: [2075, 2076, 2077, 2078, 2079], regionProof: "Brimhaven fire giant plane 2 vine 2626-2630 x 9541-9545", boundsProof: "2626-2630 x 9541-9545 plane=2", spawnProof: "2628,9543,2", confidence: "high" },
    { sourceTaskId: 755, chosenNpcId: 2050, candidateNpcIds: [240, 1432, 2048, 2049, 2050], regionProof: "Brimhaven black demon room 2698-2702 x 9487-9491", boundsProof: "2698-2702 x 9487-9491 plane=0", spawnProof: "2700,9489,0", confidence: "high" },
    { sourceTaskId: 756, chosenNpcId: 250, candidateNpcIds: [247, 248, 249, 250, 251], regionProof: "Brimhaven red dragon chamber 2702-2706 x 9537-9541", boundsProof: "2702-2706 x 9537-9541 plane=0", spawnProof: "2704,9539,0", confidence: "high" },
    { sourceTaskId: 809, chosenNpcId: 4331, candidateNpcIds: [516, 517, 1545, 4331, 4934], regionProof: "Black Knights Fortress elite 3014-3018 x 3514-3518", boundsProof: "3014-3018 x 3514-3518 plane=0", spawnProof: "3016,3516,0", confidence: "high" },
    { sourceTaskId: 811, chosenNpcId: 268, candidateNpcIds: [265, 266, 267, 268, 269], regionProof: "Taverley blue dragon room 2901-2905 x 9778-9782", boundsProof: "2901-2905 x 9778-9782 plane=0", spawnProof: "2903,9780,0", confidence: "high" },
    { sourceTaskId: 814, chosenNpcId: 2007, candidateNpcIds: [2005, 2006, 2007, 2008, 2018], regionProof: "Taverley lesser demon room 2924-2928 x 9800-9804", boundsProof: "2924-2928 x 9800-9804 plane=0", spawnProof: "2926,9802,0", confidence: "high" },
    { sourceTaskId: 902, chosenNpcId: 429, candidateNpcIds: [426, 427, 428, 429, 430], regionProof: "Fremennik turoth room 2719-2723 x 10012-10016", boundsProof: "2719-2723 x 10012-10016 plane=0", spawnProof: "2721,10014,0", confidence: "high" },
    { sourceTaskId: 903, chosenNpcId: 410, candidateNpcIds: [410, 411, 14172, 14173], regionProof: "Fremennik kurask room 2692-2696 x 9993-9997", boundsProof: "2692-2696 x 9993-9997 plane=0", spawnProof: "2694,9995,0", confidence: "high" },
    { sourceTaskId: 1047, chosenNpcId: 690, candidateNpcIds: [690, 691, 692, 693, 694], regionProof: "Desert Bandit Camp 3162-3166 x 2982-2986", boundsProof: "3162-3166 x 2982-2986 plane=0", spawnProof: "3163,2982,0", confidence: "high" },
    { sourceTaskId: 1116, chosenNpcId: 487, candidateNpcIds: [484, 485, 486, 487, 3138], regionProof: "Slayer Tower bloodveld floor 3 3401-3405 x 9932-9936", boundsProof: "3401-3405 x 9932-9936 plane=3", spawnProof: "3403,9934,3", confidence: "high" },
    { sourceTaskId: 1117, chosenNpcId: 4, candidateNpcIds: [2, 3, 4, 5, 6], regionProof: "Slayer Tower spectre floor 1 3409-3413 x 3532-3536", boundsProof: "3409-3413 x 3532-3536 plane=1", spawnProof: "3411,3534,1", confidence: "high" },
    { sourceTaskId: 1118, chosenNpcId: 1543, candidateNpcIds: [412, 413, 1543], regionProof: "Slayer Tower gargoyle floor 3 3425-3429 x 9941-9945", boundsProof: "3425-3429 x 9941-9945 plane=3", spawnProof: "3427,9943,3", confidence: "high" },
    { sourceTaskId: 1226, chosenNpcId: 3420, candidateNpcIds: [1852, 1853, 3420, 3421, 3422], regionProof: "Tirannwn rabbit cluster 2277-2281 x 3217-3221", boundsProof: "2277-2281 x 3217-3221 plane=0", spawnProof: "2279,3219,0", confidence: "high" },
    { sourceTaskId: 1266, chosenNpcId: 71, candidateNpcIds: [70, 71, 72, 73, 74], regionProof: "Wilderness Forgotten Cemetery 3006-3010 x 3593-3597", boundsProof: "3006-3010 x 3593-3597 plane=0", spawnProof: "3008,3595,0", confidence: "high" },
    { sourceTaskId: 1268, chosenNpcId: 264, candidateNpcIds: [260, 261, 262, 263, 264], regionProof: "Wilderness green dragon west 3329-3333 x 3670-3674", boundsProof: "3329-3333 x 3670-3674 plane=0", spawnProof: "3331,3672,0", confidence: "high" },
    { sourceTaskId: 1269, chosenNpcId: 2028, candidateNpcIds: [2025, 2026, 2027, 2028, 2029], regionProof: "Wilderness greater demon ruins 3280-3284 x 3878-3882", boundsProof: "3280-3284 x 3878-3882 plane=0", spawnProof: "3282,3880,0", confidence: "high" },
    { sourceTaskId: 1272, chosenNpcId: 2087, candidateNpcIds: [2085, 2086, 2087, 2088, 2089], regionProof: "Wilderness ice giant plateau 2945-2949 x 3893-3897", boundsProof: "2945-2949 x 3893-3897 plane=0", spawnProof: "2947,3895,0", confidence: "high" },
    { sourceTaskId: 1282, chosenNpcId: 6606, candidateNpcIds: [531, 6606, 11109, 11110, 11111], regionProof: "Dark Warriors Fortress 3021-3025 x 3627-3631", boundsProof: "3021-3025 x 3627-3631 plane=0", spawnProof: "3023,3629,0", confidence: "high" },
    { sourceTaskId: 1361, chosenNpcId: 8563, candidateNpcIds: [6914, 6915, 6916, 6917, 8563], regionProof: "Kourend lizardman cluster 1361-1365 x 3712-3716", boundsProof: "1361-1365 x 3712-3716 plane=0", spawnProof: "1363,3714,0", confidence: "high" },
    { sourceTaskId: 1370, chosenNpcId: 2100, candidateNpcIds: [2098, 2099, 2100, 2101, 2102], regionProof: "Kourend hill giant cluster 1437-1441 x 3608-3612", boundsProof: "1437-1441 x 3608-3612 plane=0", spawnProof: "1439,3610,0", confidence: "high" },
];
