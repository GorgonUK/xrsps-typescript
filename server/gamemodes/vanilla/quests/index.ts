import type { IScriptRegistry, ScriptServices } from "../../../src/game/scripts/types";
import { registerQuestDefinition } from "./QuestRegistry";
import {
    VARP_QUEST_POINTS,
    completeAllQuests,
    registerQuestCompletedWidgetHandlers,
    setQuestStage,
} from "./QuestService";
import { deathPlateauQuest } from "./definitions/deathPlateau";
import { desertTreasureIQuest } from "./definitions/desertTreasureI";
import { digSiteQuest } from "./definitions/digSite";
import { doricsQuest } from "./definitions/dorics";
import { priestInPerilQuest } from "./definitions/priestInPeril";
import { sheepShearerQuest } from "./definitions/sheepShearer";
import { templeOfIkovQuest } from "./definitions/templeOfIkov";
import { touristTrapQuest } from "./definitions/touristTrap";
import { trollStrongholdQuest } from "./definitions/trollStronghold";
import { waterfallQuest } from "./definitions/waterfallQuest";
import type { QuestDefinition } from "./types";

const QUEST_DEFINITIONS: QuestDefinition[] = [
    doricsQuest,
    sheepShearerQuest,
    deathPlateauQuest,
    digSiteQuest,
    templeOfIkovQuest,
    touristTrapQuest,
    trollStrongholdQuest,
    priestInPerilQuest,
    waterfallQuest,
    desertTreasureIQuest,
];

/**
 * Register all implemented quests: their interaction handlers, the shared
 * quest-completed scroll widget, and the registry consulted by the quest
 * journal for stage-specific text.
 *
 * Must run after skill handlers so quest gates can wrap skill loc handlers
 * (e.g. Doric's anvils wrapping the generic smith action).
 */
export function registerQuestHandlers(registry: IScriptRegistry, services: ScriptServices): void {
    registerQuestCompletedWidgetHandlers(registry, services);
    for (const quest of QUEST_DEFINITIONS) {
        registerQuestDefinition(quest);
        quest.register(registry, services);
    }

    // Dev command: reset all registered quests (and quest points) for testing
    registry.registerCommand("resetquests", ({ player }) => {
        for (const quest of QUEST_DEFINITIONS) {
            setQuestStage(player, quest, services, 0);
        }
        player.varps.setVarpValue(VARP_QUEST_POINTS, 0);
        services.variables.sendVarp(player, VARP_QUEST_POINTS, 0);
        // Desert Treasure's secondary varp stores the lit-torch and placed-diamond masks.
        player.varps.setVarpValue(441, 0);
        services.variables.sendVarp(player, 441, 0);
        services.system.logger.info?.(
            `[quests] ::resetquests - Reset ${QUEST_DEFINITIONS.length} quest(s) for player ${player.id}`,
        );
        return `Reset ${QUEST_DEFINITIONS.length} quest(s) and quest points.`;
    });

    // Dev command: complete every implemented quest in one idempotent operation.
    registry.registerCommand("completequests", ({ player }) => {
        const questPoints = completeAllQuests(player, services, QUEST_DEFINITIONS);
        services.system.logger.info?.(
            `[quests] ::completequests - Completed ${QUEST_DEFINITIONS.length} quest(s) for player ${player.id}`,
        );
        return `Completed ${QUEST_DEFINITIONS.length} quest(s). Quest points: ${questPoints}.`;
    });

    services.system.logger.info?.(`[quests] Registered ${QUEST_DEFINITIONS.length} quest(s)`);
}

export {
    getQuestDefinition,
    getQuestDefinitionByKey,
    getQuestDefinitionByName,
    getRegisteredQuests,
    normalizeQuestKey,
} from "./QuestRegistry";
export type { QuestDefinition, QuestItemRequirement, QuestRewards } from "./types";
