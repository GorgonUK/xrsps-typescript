import {
    EquipmentSlot,
    EquipToDisplaySlot,
} from "../../../src/rs/config/player/Equipment";
import type { EquipmentSnapshotEntry } from "./player";

/**
 * Maps authoritative equipment slots to OSRS worn inventory display indices (inv 94),
 * matching client {@link syncEquipmentInventory} / EquipToDisplaySlot.
 */
export function wornDisplaySlotsFromEquipmentSnapshot(
    entries: EquipmentSnapshotEntry[],
): Array<{ slot: number; itemId: number; quantity: number }> {
    const out: Array<{ slot: number; itemId: number; quantity: number }> = [];
    for (const e of entries) {
        const equipSlot = e.slot | 0;
        const disp = EquipToDisplaySlot[equipSlot];
        if (disp === undefined) continue;
        const quantity =
            equipSlot === EquipmentSlot.AMMO ? Math.max(1, e.quantity ?? 1) : 1;
        out.push({ slot: disp, itemId: e.itemId, quantity });
    }
    return out;
}
