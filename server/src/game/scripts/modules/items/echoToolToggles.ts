/**
 * Echo tool right-click "Toggle" handlers for the tier-1 Leagues V relics.
 *
 * Each Echo tool (Echo pickaxe / Echo axe / Echo harpoon) has an iop3=Toggle inventory
 * option in the cache. Clicking it opens a chat-options dialog that lets the player choose
 * which optional effect should be active. Selections are persisted in the player's relic
 * toggle varbits (mining = 18103, woodcutting = 18101, fishing = 18102) and are packed into
 * VARP_LEAGUE_TRAILBLAZER_GENERAL (2804) for client synchronisation.
 *
 * Animal Wrangler's auto-cook effect is always-on while the relic is selected, so the Echo
 * harpoon's Toggle option only displays an informational dialog.
 */
import {
    ECHO_AXE_ITEM_ID,
    ECHO_HARPOON_ITEM_ID,
    ECHO_PICKAXE_ITEM_ID,
    LEAGUE_TOOL_TOGGLE_BIT,
    hasAnimalWranglerRelic,
    hasLumberjackRelic,
    hasPowerMinerRelic,
} from "../../../../../../src/shared/leagues/leagueRelicEffects";
import {
    VARBIT_LEAGUE_TOOL_TOGGLE_MINING,
    VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING,
} from "../../../../../../src/shared/vars";
import type { PlayerState } from "../../../player";
import { type ScriptModule } from "../../types";

const TOGGLE_OPTION = "toggle";

interface ToggleChoice {
    label: string;
    bits: number;
}

function pushToggleDialog(
    services: any,
    player: PlayerState,
    params: {
        dialogId: string;
        title: string;
        choices: ToggleChoice[];
        varbitId: number;
        currentValue: number;
    },
): boolean {
    const { dialogId, title, choices, varbitId, currentValue } = params;
    const labels = choices.map((choice) => {
        const active = choice.bits === currentValue;
        return active ? `${choice.label} (current)` : choice.label;
    });
    if (!services.openDialogOptions) {
        return false;
    }
    services.openDialogOptions(player, {
        id: dialogId,
        modal: true,
        title,
        options: labels,
        onSelect: (idx: number) => {
            const selected = choices[idx];
            if (!selected) return;
            const next = selected.bits;
            if (next === currentValue) {
                services.closeDialog?.(player, dialogId);
                return;
            }
            (player as any).setVarbitValue?.(varbitId, next);
            services.queueVarbit?.(player.id, varbitId, next);
            services.closeDialog?.(player, dialogId);
            services.sendGameMessage(player, `Echo tool: ${selected.label}.`);
        },
    });
    return true;
}

function getVarbit(player: PlayerState, varbitId: number): number {
    return (player as any).getVarbitValue?.(varbitId) ?? 0;
}

function handlePickaxeToggle(player: PlayerState, services: any): void {
    if (!hasPowerMinerRelic(player as any)) {
        services.sendGameMessage(
            player,
            "The Echo pickaxe only responds to the Power Miner relic.",
        );
        return;
    }
    const current = getVarbit(player, VARBIT_LEAGUE_TOOL_TOGGLE_MINING);
    const opened = pushToggleDialog(services, player, {
        dialogId: `echo_pickaxe_toggle_${player.id}`,
        title: "Power Miner: Echo pickaxe",
        choices: [
            { label: "Disable extra effects", bits: 0 },
            { label: "Auto-smelt ores", bits: LEAGUE_TOOL_TOGGLE_BIT.MINING_AUTO_SMELT },
            { label: "Auto-cut gems", bits: LEAGUE_TOOL_TOGGLE_BIT.MINING_AUTO_CUT_GEMS },
        ],
        varbitId: VARBIT_LEAGUE_TOOL_TOGGLE_MINING,
        currentValue: current,
    });
    if (!opened) {
        services.sendGameMessage(player, "The Echo pickaxe hums quietly.");
    }
}

function handleAxeToggle(player: PlayerState, services: any): void {
    if (!hasLumberjackRelic(player as any)) {
        services.sendGameMessage(
            player,
            "The Echo axe only responds to the Lumberjack relic.",
        );
        return;
    }
    const current = getVarbit(player, VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING);
    const opened = pushToggleDialog(services, player, {
        dialogId: `echo_axe_toggle_${player.id}`,
        title: "Lumberjack: Echo axe",
        choices: [
            { label: "Disable extra effects", bits: 0 },
            { label: "Auto-burn logs", bits: LEAGUE_TOOL_TOGGLE_BIT.WOODCUTTING_AUTO_BURN },
            {
                label: "Auto-fletch arrow shafts",
                bits: LEAGUE_TOOL_TOGGLE_BIT.WOODCUTTING_AUTO_FLETCH,
            },
        ],
        varbitId: VARBIT_LEAGUE_TOOL_TOGGLE_WOODCUTTING,
        currentValue: current,
    });
    if (!opened) {
        services.sendGameMessage(player, "The Echo axe hums quietly.");
    }
}

function handleHarpoonToggle(player: PlayerState, services: any): void {
    if (!hasAnimalWranglerRelic(player as any)) {
        services.sendGameMessage(
            player,
            "The Echo harpoon only responds to the Animal Wrangler relic.",
        );
        return;
    }
    services.sendGameMessage(
        player,
        "Echo harpoon: 50% auto-cook is always active while Animal Wrangler is selected.",
    );
}

export const echoToolTogglesModule: ScriptModule = {
    id: "items.echo-tool-toggles",
    register(registry, services) {
        registry.registerItemAction(
            ECHO_PICKAXE_ITEM_ID,
            ({ player }) => handlePickaxeToggle(player, services),
            TOGGLE_OPTION,
        );
        registry.registerItemAction(
            ECHO_AXE_ITEM_ID,
            ({ player }) => handleAxeToggle(player, services),
            TOGGLE_OPTION,
        );
        registry.registerItemAction(
            ECHO_HARPOON_ITEM_ID,
            ({ player }) => handleHarpoonToggle(player, services),
            TOGGLE_OPTION,
        );
    },
};
