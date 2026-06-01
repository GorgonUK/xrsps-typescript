import {
    countPlayerCollectionLogSlots,
    isCollectionLogCategoryComplete,
    type CollectionLogCategoryRef,
    type CollectionLogPlayer,
} from "../collectionlog";
import type { CollectionLogTrigger } from "./triggers/TriggerTypes";

export function playerMatchesCollectionLogTrigger(
    player: Pick<CollectionLogPlayer, "hasCollectionItem">,
    trigger: CollectionLogTrigger,
    completedCategories: readonly CollectionLogCategoryRef[],
): boolean {
    if (trigger.milestone === "slot") {
        const minSlots = Math.max(1, trigger.minSlots ?? 1);
        return countPlayerCollectionLogSlots(player) >= minSlots;
    }

    if (trigger.milestone !== "page") {
        return false;
    }

    for (const category of completedCategories) {
        if (!isCollectionLogCategoryComplete(player, category)) {
            continue;
        }
        if (
            trigger.categoryStructId !== undefined &&
            trigger.categoryStructId > 0 &&
            category.structId === trigger.categoryStructId
        ) {
            return true;
        }
        if (
            trigger.tabIndex !== undefined &&
            trigger.tabIndex === category.tabIndex &&
            trigger.categoryStructId === undefined
        ) {
            return true;
        }
    }

    return false;
}

/** Categories containing `itemId` that are fully complete for this player. */
export function getNewlyCompleteCategoriesForItem(
    player: Pick<CollectionLogPlayer, "hasCollectionItem">,
    itemId: number,
    categoriesForItem: readonly CollectionLogCategoryRef[],
): CollectionLogCategoryRef[] {
    return categoriesForItem.filter((category) => isCollectionLogCategoryComplete(player, category));
}
