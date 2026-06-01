/**
 * Static collection_log matrix checks for Phase 6B (no server boot).
 */
import path from "path";

import {
    countPlayerCollectionLogSlots,
    getCollectionLogCategoriesForItem,
    getCollectionLogCategoryByStructId,
    isCollectionLogItem,
    loadCollectionLogItems,
    trackCollectionLogItem,
    type CollectionLogPlayer,
    type CollectionLogServices,
} from "../../src/game/collectionlog";
import {
    getNewlyCompleteCategoriesForItem,
    playerMatchesCollectionLogTrigger,
} from "../../src/game/leagues/collectionLogLeague";
import type { CollectionLogTrigger } from "../../src/game/leagues/triggers/TriggerTypes";
import { getPhase6bCollectionTrigger } from "./lib/phase6bCollectionTriggers";
import { parseCsvFile } from "./lib/csv";

const PHASE6B_IDS = new Set([525, 526, 527, 528, 529, 542, 543, 544, 545, 546]);
const WHIP_ID = 4151;
const SLAYER_STRUCT_ID = 527;

type MockPlayer = CollectionLogPlayer & {
    owned: Set<number>;
    notifications: number;
};

function createMockServices(): CollectionLogServices {
    return {
        queueVarp: () => {},
        queueVarbit: () => {},
        queueWidgetEvent: () => {},
        queueNotification: () => {},
        queueChatMessage: () => {},
        sendCollectionLogSnapshot: () => {},
        getMainmodalUid: () => 0,
    };
}

function createMockPlayer(initialItemIds: number[] = []): MockPlayer {
    const owned = new Set(initialItemIds);
    return {
        id: 1,
        displayMode: 0,
        owned,
        notifications: 0,
        getCollectionObtainedItems() {
            return [...owned].map((itemId) => ({ itemId, quantity: 1 }));
        },
        getCollectionItemUnlocks() {
            return [...owned].map((itemId, index) => ({
                itemId,
                runeDay: 1,
                sequence: index + 1,
            }));
        },
        getCollectionTotalObtained() {
            return owned.size;
        },
        hasCollectionItem(itemId: number) {
            return owned.has(itemId);
        },
        addCollectionItem(itemId: number) {
            owned.add(itemId);
        },
        recordCollectionItemUnlock() {},
        setVarpValue() {},
        setVarbitValue() {},
    };
}

function grantCollectionItems(player: MockPlayer, itemIds: readonly number[]): void {
    const services = createMockServices();
    for (const itemId of itemIds) {
        trackCollectionLogItem(player, itemId, services);
    }
}

function collectPhase6bMatches(
    player: MockPlayer,
    itemId: number,
): Array<{ sourceTaskId: number; name: string }> {
    const csvPath = path.resolve(__dirname, "../../../tasks.csv");
    const csvById = new Map(parseCsvFile(csvPath).map((r) => [r.id, r.name] as const));
    const categoriesForItem = getCollectionLogCategoriesForItem(itemId);
    const completedCategories = getNewlyCompleteCategoriesForItem(
        player,
        itemId,
        categoriesForItem,
    );
    const out: Array<{ sourceTaskId: number; name: string }> = [];

    for (const sourceId of PHASE6B_IDS) {
        const trigger = getPhase6bCollectionTrigger(sourceId);
        if (!trigger || trigger.type !== "collection_log") continue;
        if (
            playerMatchesCollectionLogTrigger(
                player,
                trigger as CollectionLogTrigger,
                completedCategories,
            )
        ) {
            out.push({ sourceTaskId: sourceId, name: csvById.get(sourceId) ?? `task-${sourceId}` });
        }
    }
    return out;
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function main(): void {
    loadCollectionLogItems();
    assert(isCollectionLogItem(WHIP_ID), "whip must be a collection log item");

    // First collection slot
    {
        const player = createMockPlayer();
        const services = createMockServices();
        const wasNew = trackCollectionLogItem(player, WHIP_ID, services);
        assert(wasNew, "first whip unlock should be new");
        assert(countPlayerCollectionLogSlots(player) === 1, "expected 1 slot after first unlock");
        const matches = collectPhase6bMatches(player, WHIP_ID);
        const ids = matches.map((m) => m.sourceTaskId);
        assert(ids.includes(525), "525 should match after first slot");
        assert(!ids.includes(526), "526 should not match after 1 slot");
    }

    // Duplicate same item does not progress slot count
    {
        const player = createMockPlayer([WHIP_ID]);
        const services = createMockServices();
        const wasNew = trackCollectionLogItem(player, WHIP_ID, services);
        assert(!wasNew, "duplicate whip should not be new");
        assert(countPlayerCollectionLogSlots(player) === 1, "duplicate should not increase slots");
        const matches = collectPhase6bMatches(player, WHIP_ID);
        assert(
            !matches.some((m) => m.sourceTaskId === 526),
            "526 should not match on duplicate unlock",
        );
    }

    // 10 slots milestone — use first 10 distinct collection log item ids
    {
        const player = createMockPlayer();
        const itemIds = [4151, 13262, 13273, 7979, 13274, 13275, 13276, 13277, 13265, 22746];
        for (const id of itemIds) {
            assert(isCollectionLogItem(id), `expected collection item ${id}`);
        }
        grantCollectionItems(player, itemIds);
        assert(countPlayerCollectionLogSlots(player) === 10, "expected 10 slots");
        const lastItemId = itemIds[itemIds.length - 1];
        const matches = collectPhase6bMatches(player, lastItemId);
        const ids = matches.map((m) => m.sourceTaskId);
        assert(ids.includes(525), "525 should match at 10 slots");
        assert(ids.includes(526), "526 should match at 10 slots");
        assert(!ids.includes(527), "527 should not match at 10 slots");
    }

    // Boss page complete — Bryophyta (small boss tab category)
    {
        const bossCategory = getCollectionLogCategoriesForItem(22372).find((c) => c.tabIndex === 0);
        assert(bossCategory !== undefined, "expected boss category for Bryophyta item");
        const player = createMockPlayer();
        grantCollectionItems(player, bossCategory.itemIds);
        assert(countPlayerCollectionLogSlots(player) === bossCategory.itemIds.length, "boss page items");
        const lastItemId = bossCategory.itemIds[bossCategory.itemIds.length - 1];
        const matches = collectPhase6bMatches(player, lastItemId);
        assert(
            matches.some((m) => m.sourceTaskId === 542),
            "542 boss page should match when a boss category is complete",
        );
    }

    // Slayer page complete
    {
        const slayerCategory = getCollectionLogCategoryByStructId(SLAYER_STRUCT_ID);
        assert(slayerCategory !== undefined, "slayer category struct 527 must exist");
        const player = createMockPlayer();
        grantCollectionItems(player, slayerCategory.itemIds);
        const lastItemId = slayerCategory.itemIds[slayerCategory.itemIds.length - 1];
        const matches = collectPhase6bMatches(player, lastItemId);
        assert(
            matches.some((m) => m.sourceTaskId === 546),
            "546 slayer page should match when slayer category is complete",
        );
        assert(
            !matches.some((m) => m.sourceTaskId === 547),
            "547 is deferred and must not be in phase 6B",
        );
    }

    console.log("[phase6b] verify-collection-matrices: all checks passed");
}

main();
