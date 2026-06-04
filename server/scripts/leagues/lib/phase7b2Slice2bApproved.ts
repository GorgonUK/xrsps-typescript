/** Approved Phase 7B-2 Slice 2B sub-chamber NPC disambiguation (monster-route hints + spawn-cluster proof). */
import type { Phase7b2Slice2aBounds } from "./phase7b2Slice2aApproved";
import type { Phase7b2Slice1Entry } from "./phase7b2Slice1Approved";

export type Phase7b2Slice2bEntry = Phase7b2Slice1Entry & {
    boundsProof: string;
    spawnProof: string;
};

export const PHASE7B2_SLICE2B_SOURCE_IDS = [659, 752, 1054, 1121] as const;

export const PHASE7B2_SLICE2B_REGION_BOUNDS: Record<number, Phase7b2Slice2aBounds> = {
    659: { minX: 2949, minY: 3481, maxX: 2953, maxY: 3485, plane: 0 },
    752: { minX: 2834, minY: 9556, maxX: 2838, maxY: 9560, plane: 0 },
    1054: { minX: 3493, minY: 9487, maxX: 3497, maxY: 9491, plane: 0 },
    1121: { minX: 3777, minY: 9436, maxX: 3781, maxY: 9440, plane: 0 },
};

export const PHASE7B2_SLICE2B_APPROVED: Phase7b2Slice2bEntry[] = [
    {
        sourceTaskId: 659,
        chosenNpcId: 659,
        candidateNpcIds: [655, 656, 657, 658, 659],
        boundsProof: "2949-2953 x 3481-3485 plane=0",
        spawnProof: "2951,3483,0",
        regionProof: "Edgeville goblin cluster 2944-2975 x 3480-3515",
        confidence: "high",
    },
    {
        sourceTaskId: 752,
        chosenNpcId: 2008,
        candidateNpcIds: [2005, 2006, 2007, 2008, 2018],
        boundsProof: "2834-2838 x 9556-9560 plane=0",
        spawnProof: "2836,9558,0",
        regionProof: "Karamja Volcano dungeon 2832-2879 x 9552-9599",
        confidence: "high",
    },
    {
        sourceTaskId: 1054,
        chosenNpcId: 962,
        candidateNpcIds: [959, 960, 962],
        boundsProof: "3493-3497 x 9487-9491 plane=0",
        spawnProof: "3495,9489,0",
        regionProof: "Kalphite Lair 3456-3519 x 9472-9535",
        confidence: "high",
    },
    {
        sourceTaskId: 1121,
        chosenNpcId: 1050,
        candidateNpcIds: [1047, 1048, 1049, 1050, 1051],
        boundsProof: "3777-3781 x 9436-9440 plane=0",
        spawnProof: "3779,9438,0",
        regionProof: "Mos LeHarmless cave horrors 3776-3839 x 9376-9471",
        confidence: "high",
    },
];
