/**
 * Verifies collection log unlock behavior for Phase 6B parity.
 *
 * Run: npx tsx server/scripts/collectionlog/verify-unlock-parity.ts
 */
import {
    isCollectionLogItem,
    loadCollectionLogItems,
    trackCollectionLogItem,
    type CollectionLogPlayer,
    type CollectionLogServices,
} from "../../src/game/collectionlog";

type MockUnlock = { itemId: number; runeDay: number; sequence: number };

function createMockPlayer(): CollectionLogPlayer & {
    collection: Map<number, number>;
    unlocks: MockUnlock[];
    unlockSequence: number;
    varps: Map<number, number>;
} {
    const collection = new Map<number, number>();
    const unlocks: MockUnlock[] = [];
    let unlockSequence = 0;
    const varps = new Map<number, number>();

    return {
        id: 1,
        displayMode: 0,
        collection,
        unlocks,
        unlockSequence,
        varps,
        getCollectionObtainedItems() {
            return [...collection.entries()]
                .filter(([, qty]) => qty > 0)
                .map(([itemId, quantity]) => ({ itemId, quantity }));
        },
        getCollectionItemUnlocks() {
            return unlocks.map((entry) => ({ ...entry }));
        },
        getCollectionTotalObtained() {
            let count = 0;
            for (const qty of collection.values()) {
                if (qty > 0) count++;
            }
            return count;
        },
        hasCollectionItem(itemId: number) {
            return (collection.get(itemId) ?? 0) > 0;
        },
        addCollectionItem(itemId: number, quantity: number) {
            collection.set(itemId, (collection.get(itemId) ?? 0) + quantity);
        },
        recordCollectionItemUnlock(itemId: number, runeDay: number) {
            unlockSequence++;
            unlocks.push({ itemId, runeDay, sequence: unlockSequence });
        },
        setVarpValue(varpId: number, value: number) {
            varps.set(varpId, value);
        },
        setVarbitValue(_varbitId: number, _value: number) {},
    };
}

function createMockServices(): CollectionLogServices & {
    notifications: unknown[];
    chatMessages: string[];
} {
    const notifications: unknown[] = [];
    const chatMessages: string[] = [];
    return {
        notifications,
        chatMessages,
        queueVarp(playerId, varpId, value) {
            if (playerId !== 1) throw new Error(`unexpected playerId ${playerId}`);
            void varpId;
            void value;
        },
        queueVarbit() {},
        queueWidgetEvent() {},
        queueNotification(_playerId, payload) {
            notifications.push(payload);
        },
        queueChatMessage(request) {
            chatMessages.push(request.text);
        },
        sendCollectionLogSnapshot() {},
        getMainmodalUid: () => 0,
    };
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function main(): void {
    loadCollectionLogItems();

    // Pick a known collection log item (Abyssal whip from Abyssal Sire page)
    const whipId = 4151;
    assert(isCollectionLogItem(whipId), "expected whip to be a collection log item");

    const nonLogId = 995; // coins
    assert(!isCollectionLogItem(nonLogId), "expected coins not to be a collection log item");

    // First unlock fires notification
    {
        const player = createMockPlayer();
        const services = createMockServices();
        trackCollectionLogItem(player, whipId, services);
        assert(player.hasCollectionItem(whipId), "whip should be in collection after first track");
        assert(services.notifications.length === 1, "first unlock should queue one notification");
        assert(services.chatMessages.length === 1, "first unlock should queue one chat message");
    }

    // Second unlock is idempotent (no duplicate notifications)
    {
        const player = createMockPlayer();
        const services = createMockServices();
        trackCollectionLogItem(player, whipId, services);
        trackCollectionLogItem(player, whipId, services);
        assert(services.notifications.length === 1, "duplicate track should not re-notify");
        assert(services.chatMessages.length === 1, "duplicate track should not re-chat");
        assert(
            player.getCollectionTotalObtained() === 1,
            "duplicate track should still count as one unique slot",
        );
    }

    // Non-log items are ignored
    {
        const player = createMockPlayer();
        const services = createMockServices();
        trackCollectionLogItem(player, nonLogId, services);
        assert(services.notifications.length === 0, "non-log item should not notify");
        assert(player.getCollectionTotalObtained() === 0, "non-log item should not be stored");
    }

    console.log("[collection-log] verify-unlock-parity: all checks passed");
}

main();
