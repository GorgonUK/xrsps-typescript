/**
 * Leagues V tier-2 relic content module.
 *
 * Owns the player-facing pieces of the tier-2 relics that don't belong on a
 * specific skill module:
 *   - `::pouch` / `::pouchempty` chat commands for inspecting and emptying
 *     the Friendly Forager Forager's Pouch.
 *   - `::relic2` chat command to print the active selection (debug aid).
 *
 * The actual gameplay effects are wired directly into the relevant skill
 * code (herblore.ts, hunter.ts, SkillActionHandler.pickpocket, wsServer's
 * run-energy drain) via shared hooks in `server/src/game/leagues/relicHooks.ts`.
 * This module only owns interactions that have no natural home elsewhere.
 *
 * Adding a new tier-2 relic that needs commands or item actions: add a new
 * helper function in this module and register it in `register()` below — keep
 * skill-specific gameplay hooks in their respective skill modules.
 */
import {
    getTier2RelicKey,
    hasFriendlyForagerRelic,
    LeagueRelicTier2Key,
} from "../../../../../../src/shared/leagues/leagueRelicEffects";
import { LEAGUE_TIER2_RELIC_CONFIGS } from "../../../../../../src/shared/leagues/leagueTier2Relics";
import { ForagerPouchStore, getOrCreateForagerPouch } from "../../../leagues/foragerPouch";
import { getForagerPouchSnapshot } from "../../../leagues/relicHooks";
import { type ScriptModule } from "../../types";

const TIER2_KEY_TO_DISPLAY_NAME: Record<number, string> = {
    [LeagueRelicTier2Key.CLUE_COMPASS]: "Clue Compass",
    [LeagueRelicTier2Key.BANK_HEIST]: "Bank Heist",
    [LeagueRelicTier2Key.CORNER_CUTTER]:
        LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.CORNER_CUTTER].displayName,
    [LeagueRelicTier2Key.FRIENDLY_FORAGER]:
        LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.FRIENDLY_FORAGER].displayName,
    [LeagueRelicTier2Key.DODGY_DEALS]:
        LEAGUE_TIER2_RELIC_CONFIGS[LeagueRelicTier2Key.DODGY_DEALS].displayName,
};

export const tier2RelicsModule: ScriptModule = {
    id: "leagues.tier2-relics",
    register(registry, services) {
        // ::pouch — Inspect Forager's Pouch contents.
        registry.registerChatCommand(
            "pouch",
            ({ player }) => {
                if (!hasFriendlyForagerRelic(player as any)) {
                    return "You haven't unlocked the Friendly Forager relic.";
                }
                const entries = getForagerPouchSnapshot(player as any);
                if (entries.length === 0) {
                    services.sendGameMessage(
                        player,
                        `Your Forager's Pouch is empty. (Capacity: ${ForagerPouchStore.MAX_STACK} per item)`,
                    );
                    return;
                }
                services.sendGameMessage(player, "Forager's Pouch contents:");
                for (const entry of entries) {
                    const def = services.getObjType?.(entry.itemId);
                    const name = (def?.name as string | undefined) ?? `item_${entry.itemId}`;
                    services.sendGameMessage(
                        player,
                        ` - ${name} x${entry.quantity}`,
                    );
                }
                return;
            },
            { description: "Inspect your Forager's Pouch contents (Friendly Forager relic)." },
        );

        // ::pouchempty — Drain pouch into inventory (overflow drops on the floor in OSRS,
        // but for now we just discard the overflow with a message).
        registry.registerChatCommand(
            "pouchempty",
            ({ player }) => {
                if (!hasFriendlyForagerRelic(player as any)) {
                    return "You haven't unlocked the Friendly Forager relic.";
                }
                const pouch = getOrCreateForagerPouch(player as any);
                const drained = pouch.drain();
                if (drained.length === 0) {
                    return "Your Forager's Pouch is already empty.";
                }
                let dropped = 0;
                for (const entry of drained) {
                    const result = services.addItemToInventory(
                        player,
                        entry.itemId,
                        entry.quantity,
                    );
                    const overflow = entry.quantity - Math.max(0, result.added);
                    if (overflow > 0) {
                        // Push overflow back into the pouch so nothing is lost.
                        pouch.tryStore(entry.itemId, overflow);
                        dropped += overflow;
                    }
                }
                services.snapshotInventory(player);
                if (dropped > 0) {
                    return `Pouch emptied; ${dropped} item(s) couldn't fit and were left in the pouch.`;
                }
                return "You empty your Forager's Pouch into your inventory.";
            },
            { description: "Empty your Forager's Pouch into your inventory." },
        );

        // ::relic2 — Debug helper that prints the player's currently selected
        // tier-2 relic. Useful when verifying selection persisted across logins.
        registry.registerChatCommand(
            "relic2",
            ({ player }) => {
                const key = getTier2RelicKey(player as any);
                if (key <= 0) return "No tier-2 relic selected.";
                const name = TIER2_KEY_TO_DISPLAY_NAME[key] ?? `(unknown key ${key})`;
                return `Active tier-2 relic: ${name}.`;
            },
            { description: "Show your currently selected tier-2 league relic." },
        );
    },
};
