import { type LocInteractionEvent, type ScriptModule } from "../types";
// @ts-ignore: logger module exists, ignore TS import error
import { logger } from "../../../utils/logger";

// Scurrius lair entrance (broken bars) object ID — OSRS wiki / MOID
const BROKEN_BARS_LOC_ID = 14203;

// OSRS: public side of the bars (Varrock Sewers, inside the entrance)
const PUBLIC_ROOM_DEST = { x: 3291, y: 9868, level: 0 };
// Instanced fight staging tile (when instance system exists)
const INSTANCE_ROOM_DEST = { x: 3298, y: 9851, level: 0 };

function handleBrokenBarsPublic(event: LocInteractionEvent): void {
    const { player, services } = event;
    logger.info(
        `[scurrius-bars] public teleport player=${player.id} (${player.tileX},${player.tileY},${player.level})`,
    );
    const result = services.requestTeleportAction?.(player, {
        ...PUBLIC_ROOM_DEST,
        delayTicks: 0,
        preserveAnimation: false,
        requireCanTeleport: false,
        replacePending: true,
    });
    if (!result?.ok) {
        services.teleportPlayer?.(player, PUBLIC_ROOM_DEST.x, PUBLIC_ROOM_DEST.y, PUBLIC_ROOM_DEST.level);
    }
}

function handleBrokenBarsInstance(event: LocInteractionEvent): void {
    const { player, services } = event;
    logger.info(
        `[scurrius-bars] private/instance player=${player.id} (${player.tileX},${player.tileY},${player.level})`,
    );
    const createInstance = (services as any).createInstanceForBoss;
    if (typeof createInstance === "function") {
        createInstance(player, {
            bossId: "scurrius",
            entryTile: INSTANCE_ROOM_DEST,
        });
    } else {
        services.sendGameMessage?.(player, "Instanced Scurrius lair is not yet implemented.");
    }
}

/** OSRS option: Peek (normal) — placeholder until peek UI exists */
function handlePeekNormal(event: LocInteractionEvent): void {
    const { player, services } = event;
    services.sendGameMessage?.(player, "You peer through the bars.");
}

export const scurriusBarsModule: ScriptModule = {
    id: "content.scurrius-bars",
    register(registry) {
        // OSRS Broken bars options: Climb-through (normal), Climb-through (private), Peek (normal)
        registry.registerLocScript({
            locId: BROKEN_BARS_LOC_ID,
            action: "climb-through (normal)",
            handler: handleBrokenBarsPublic,
        });
        registry.registerLocScript({
            locId: BROKEN_BARS_LOC_ID,
            action: "climb-through (private)",
            handler: handleBrokenBarsInstance,
        });
        registry.registerLocScript({
            locId: BROKEN_BARS_LOC_ID,
            action: "peek (normal)",
            handler: handlePeekNormal,
        });
        // Default for this loc when action text does not match (empty resolution, cache drift)
        registry.registerLocScript({
            locId: BROKEN_BARS_LOC_ID,
            handler: handleBrokenBarsPublic,
        });
        logger.info(
            "[scurrius-bars] Registered 14203: climb-through (normal/private), peek (normal), default",
        );
    },
};
