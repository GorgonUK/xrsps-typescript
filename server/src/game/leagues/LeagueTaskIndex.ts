/**
 * LeagueTaskIndex - Builds and maintains indexed lookups for efficient task matching.
 *
 * Instead of iterating all 1800+ tasks on every event, we build reverse indexes:
 * - npcIdToTasks: Which tasks care about killing NPC X?
 * - itemIdToTasks: Which tasks care about obtaining/equipping item X?
 *
 * This gives O(1) lookup + O(m) checks where m is typically 1-5 tasks.
 */
import {
    type RegisteredCustomChallenge,
    type RegisteredCustomTask,
    getAllCustomChallenges,
    getAllCustomTasks,
} from "../../../../src/shared/leagues/custom";
import { LEAGUE_TASKS } from "../../../../src/shared/leagues/leagueTasks.data";
import type { LeagueTaskRow } from "../../../../src/shared/leagues/leagueTypes";
import { getLeagueTaskTrigger } from "../../../../src/shared/leagues/leagueTaskTriggers";
import {
    type TriggerParserLoaders,
    buildNameLookups,
    parseTaskTrigger,
} from "./triggers/TriggerParser";
import { skillingActionIndexKey } from "./skillingAction";
import type { CollectionLogTrigger, SpellCastTrigger, TaskTrigger } from "./triggers/TriggerTypes";

export interface ParsedTask {
    taskId: number;
    trigger: TaskTrigger;
    row: LeagueTaskRow;
    /** If this is a custom task, contains the custom task data */
    customTask?: RegisteredCustomTask;
}

export interface ParsedChallenge {
    trigger: TaskTrigger;
    challenge: RegisteredCustomChallenge;
}

export class LeagueTaskIndex {
    // Tier 1 indexes - O(1) lookup by ID
    private npcIdToTasks = new Map<number, ParsedTask[]>();
    private itemEquipToTasks = new Map<number, ParsedTask[]>();
    private itemObtainToTasks = new Map<number, ParsedTask[]>();
    private itemCraftToTasks = new Map<number, ParsedTask[]>();
    private skillingActionToTasks = new Map<string, ParsedTask[]>();
    private areaEnterToTasks = new Map<string, ParsedTask[]>();
    private wildernessLevelToTasks = new Map<number, ParsedTask[]>();
    private spellIdToTasks = new Map<number, ParsedTask[]>();
    private spellCategoryToTasks = new Map<string, ParsedTask[]>();
    private spellbookToTasks = new Map<string, ParsedTask[]>();
    private teleportNameToTasks = new Map<string, ParsedTask[]>();
    private anySpellCastTasks: ParsedTask[] = [];
    private collectionLogSlotTasks: ParsedTask[] = [];
    private collectionLogPageTabToTasks = new Map<number, ParsedTask[]>();
    private collectionLogPageStructToTasks = new Map<number, ParsedTask[]>();

    // Challenge indexes - O(1) lookup by trigger ID
    private npcIdToChallenges = new Map<number, ParsedChallenge[]>();
    private itemEquipToChallenges = new Map<number, ParsedChallenge[]>();
    private itemObtainToChallenges = new Map<number, ParsedChallenge[]>();
    private itemCraftToChallenges = new Map<number, ParsedChallenge[]>();

    // Combat-level challenges - checked on every NPC kill (small list)
    private npcKillCombatLevelChallenges: ParsedChallenge[] = [];

    /** Tasks checked when skills / total level / XP change or on login */
    private skillProgressTasks: ParsedTask[] = [];

    // Stats for debugging
    private parsedCount = 0;
    private unparsedCount = 0;
    private parseFailures: string[] = [];
    private challengeCount = 0;

    /**
     * Build indexes from task definitions.
     * Call this once at server startup.
     */
    static build(
        npcTypeLoader: { load: (id: number) => { name?: string } | undefined } | undefined,
        objTypeLoader: { load: (id: number) => { name?: string } | undefined } | undefined,
    ): LeagueTaskIndex {
        const index = new LeagueTaskIndex();
        const loaders = buildNameLookups(npcTypeLoader, objTypeLoader);

        // Index cache-defined tasks
        for (const task of LEAGUE_TASKS) {
            index.indexTask(task, loaders);
        }

        // Index custom tasks from the registry
        for (const customTask of getAllCustomTasks()) {
            index.indexCustomTask(customTask);
        }

        // Index custom challenges from the registry
        for (const challenge of getAllCustomChallenges()) {
            index.indexCustomChallenge(challenge);
        }

        return index;
    }

    private indexTask(task: LeagueTaskRow, loaders: TriggerParserLoaders): void {
        // Generated MVP triggers, then optional row override, then name parser
        const manualTrigger =
            getLeagueTaskTrigger(task.taskId) ??
            ((task as { trigger?: TaskTrigger }).trigger as TaskTrigger | undefined);

        const trigger =
            manualTrigger ?? parseTaskTrigger(task.name, task.description ?? "", loaders);

        if (!trigger) {
            this.unparsedCount++;
            // Only log first 20 failures to avoid spam
            if (this.parseFailures.length < 20) {
                this.parseFailures.push(`[${task.taskId}] ${task.name}`);
            }
            return;
        }

        this.parsedCount++;

        const parsed: ParsedTask = {
            taskId: task.taskId,
            trigger,
            row: task,
        };

        // Index by trigger type
        switch (trigger.type) {
            case "npc_kill":
                for (const npcId of trigger.npcIds) {
                    this.addToIndex(this.npcIdToTasks, npcId, parsed);
                }
                break;

            case "item_equip":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemEquipToTasks, itemId, parsed);
                }
                break;

            case "item_obtain":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemObtainToTasks, itemId, parsed);
                }
                break;

            case "item_craft":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemCraftToTasks, itemId, parsed);
                }
                break;

            case "skilling_action":
                for (const targetId of trigger.targetIds) {
                    const key = skillingActionIndexKey(trigger.skill, trigger.action, targetId);
                    this.addToStringIndex(this.skillingActionToTasks, key, parsed);
                }
                break;

            case "area_enter":
                for (const areaKey of trigger.areaKeys ?? []) {
                    this.addToStringIndex(this.areaEnterToTasks, areaKey, parsed);
                }
                for (const regionId of trigger.regionIds ?? []) {
                    this.addToStringIndex(this.areaEnterToTasks, `region:${regionId | 0}`, parsed);
                }
                break;

            case "wilderness_level":
                this.addToIndex(this.wildernessLevelToTasks, trigger.minLevel | 0, parsed);
                break;

            case "spell_cast":
                this.indexSpellCastTrigger(parsed, trigger);
                break;

            case "collection_log":
                this.indexCollectionLogTrigger(parsed, trigger);
                break;

            case "level_reach":
            case "total_level_reach":
            case "combat_level_reach":
            case "xp_reach":
                this.skillProgressTasks.push(parsed);
                break;

            default:
                break;
        }
    }

    private indexSpellCastTrigger(parsed: ParsedTask, trigger: SpellCastTrigger): void {
        if (trigger.anySpell) {
            this.anySpellCastTasks.push(parsed);
        }
        if (trigger.teleportName) {
            this.addToStringIndex(
                this.teleportNameToTasks,
                trigger.teleportName.toLowerCase(),
                parsed,
            );
        }
        if (trigger.spellCategory) {
            this.addToStringIndex(this.spellCategoryToTasks, trigger.spellCategory, parsed);
        }
        if (trigger.spellbook) {
            this.addToStringIndex(this.spellbookToTasks, trigger.spellbook, parsed);
        }
        if (trigger.spellId !== undefined && trigger.spellId > 0) {
            this.addToIndex(this.spellIdToTasks, trigger.spellId | 0, parsed);
        }
        if (trigger.spellIdsAny) {
            for (const spellId of trigger.spellIdsAny) {
                if (spellId > 0) {
                    this.addToIndex(this.spellIdToTasks, spellId | 0, parsed);
                }
            }
        }
    }

    private indexCollectionLogTrigger(parsed: ParsedTask, trigger: CollectionLogTrigger): void {
        if (trigger.milestone === "slot") {
            this.collectionLogSlotTasks.push(parsed);
            return;
        }
        if (trigger.milestone === "page") {
            if (trigger.tabIndex !== undefined) {
                this.addToIndex(this.collectionLogPageTabToTasks, trigger.tabIndex | 0, parsed);
            }
            if (trigger.categoryStructId !== undefined && trigger.categoryStructId > 0) {
                this.addToIndex(
                    this.collectionLogPageStructToTasks,
                    trigger.categoryStructId | 0,
                    parsed,
                );
            }
        }
    }

    /**
     * Index a custom task from the registry.
     * Custom tasks have their trigger defined in the definition, no parsing needed.
     */
    private indexCustomTask(customTask: RegisteredCustomTask): void {
        const trigger = customTask.trigger;
        if (!trigger) {
            // Custom task without trigger - won't be auto-completed
            return;
        }

        this.parsedCount++;

        // Build a LeagueTaskRow-like object for the custom task
        const row: LeagueTaskRow = {
            taskId: customTask.taskId,
            name: customTask.name,
            description: customTask.description,
            tier: customTask.tier,
            points: customTask.points,
            category: customTask.category,
            area: customTask.area,
            skill: customTask.skill,
            structId: customTask.structId,
        };

        const parsed: ParsedTask = {
            taskId: customTask.taskId,
            trigger,
            row,
            customTask,
        };

        // Index by trigger type
        switch (trigger.type) {
            case "npc_kill":
                for (const npcId of trigger.npcIds) {
                    this.addToIndex(this.npcIdToTasks, npcId, parsed);
                }
                break;

            case "item_equip":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemEquipToTasks, itemId, parsed);
                }
                break;

            case "item_obtain":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemObtainToTasks, itemId, parsed);
                }
                break;

            case "item_craft":
                for (const itemId of trigger.itemIds) {
                    this.addToIndex(this.itemCraftToTasks, itemId, parsed);
                }
                break;

            case "skilling_action":
                for (const targetId of trigger.targetIds) {
                    const key = skillingActionIndexKey(trigger.skill, trigger.action, targetId);
                    this.addToStringIndex(this.skillingActionToTasks, key, parsed);
                }
                break;

            case "area_enter":
                for (const areaKey of trigger.areaKeys ?? []) {
                    this.addToStringIndex(this.areaEnterToTasks, areaKey, parsed);
                }
                for (const regionId of trigger.regionIds ?? []) {
                    this.addToStringIndex(this.areaEnterToTasks, `region:${regionId | 0}`, parsed);
                }
                break;

            case "wilderness_level":
                this.addToIndex(this.wildernessLevelToTasks, trigger.minLevel | 0, parsed);
                break;

            case "spell_cast":
                this.indexSpellCastTrigger(parsed, trigger);
                break;

            case "collection_log":
                this.indexCollectionLogTrigger(parsed, trigger);
                break;

            case "level_reach":
            case "total_level_reach":
            case "combat_level_reach":
            case "xp_reach":
                this.skillProgressTasks.push(parsed);
                break;

            default:
                break;
        }
    }

    private addToIndex(map: Map<number, ParsedTask[]>, key: number, task: ParsedTask): void {
        let tasks = map.get(key);
        if (!tasks) {
            tasks = [];
            map.set(key, tasks);
        }
        tasks.push(task);
    }

    private addToStringIndex(map: Map<string, ParsedTask[]>, key: string, task: ParsedTask): void {
        let tasks = map.get(key);
        if (!tasks) {
            tasks = [];
            map.set(key, tasks);
        }
        tasks.push(task);
    }

    /**
     * Index a custom challenge from the registry.
     * Custom challenges have their trigger defined in the definition.
     */
    private indexCustomChallenge(challenge: RegisteredCustomChallenge): void {
        const trigger = challenge.trigger;
        if (!trigger) {
            // Challenge without trigger - won't be auto-completed
            return;
        }

        this.challengeCount++;

        const parsed: ParsedChallenge = {
            trigger,
            challenge,
        };

        // Index by trigger type
        switch (trigger.type) {
            case "npc_kill":
                for (const npcId of trigger.npcIds) {
                    this.addToChallengeIndex(this.npcIdToChallenges, npcId, parsed);
                }
                break;

            case "item_equip":
                for (const itemId of trigger.itemIds) {
                    this.addToChallengeIndex(this.itemEquipToChallenges, itemId, parsed);
                }
                break;

            case "item_obtain":
                for (const itemId of trigger.itemIds) {
                    this.addToChallengeIndex(this.itemObtainToChallenges, itemId, parsed);
                }
                break;

            case "item_craft":
                for (const itemId of trigger.itemIds) {
                    this.addToChallengeIndex(this.itemCraftToChallenges, itemId, parsed);
                }
                break;

            case "npc_kill_combat_level":
                this.npcKillCombatLevelChallenges.push(parsed);
                break;

            default:
                break;
        }
    }

    private addToChallengeIndex(
        map: Map<number, ParsedChallenge[]>,
        key: number,
        challenge: ParsedChallenge,
    ): void {
        let challenges = map.get(key);
        if (!challenges) {
            challenges = [];
            map.set(key, challenges);
        }
        challenges.push(challenge);
    }

    // === Lookup methods ===

    /**
     * Get tasks triggered by killing an NPC.
     */
    getTasksForNpcKill(npcId: number): ParsedTask[] {
        return this.npcIdToTasks.get(npcId) ?? [];
    }

    /**
     * Get tasks triggered by equipping an item.
     */
    getTasksForItemEquip(itemId: number): ParsedTask[] {
        return this.itemEquipToTasks.get(itemId) ?? [];
    }

    /**
     * Get tasks triggered by obtaining an item.
     */
    getTasksForItemObtain(itemId: number): ParsedTask[] {
        return this.itemObtainToTasks.get(itemId) ?? [];
    }

    /**
     * Get tasks triggered by crafting an item.
     */
    getTasksForItemCraft(itemId: number): ParsedTask[] {
        return this.itemCraftToTasks.get(itemId) ?? [];
    }

    /**
     * Get tasks triggered by a successful skilling action.
     */
    getTasksForSkillingAction(skill: string, action: string, targetId: number): ParsedTask[] {
        const key = skillingActionIndexKey(skill, action, targetId);
        return this.skillingActionToTasks.get(key) ?? [];
    }

    getTasksForAreaEnter(areaKey: string): ParsedTask[] {
        return this.areaEnterToTasks.get(areaKey) ?? [];
    }

    getTasksForAreaEnterRegion(regionId: number): ParsedTask[] {
        return this.areaEnterToTasks.get(`region:${regionId | 0}`) ?? [];
    }

    getTasksForWildernessLevel(minLevel: number): ParsedTask[] {
        return this.wildernessLevelToTasks.get(minLevel | 0) ?? [];
    }

    getTasksForWildernessLevelCross(previousLevel: number, currentLevel: number): ParsedTask[] {
        if (currentLevel <= previousLevel || currentLevel <= 0) {
            return [];
        }
        const matched: ParsedTask[] = [];
        for (const [minLevel, tasks] of this.wildernessLevelToTasks) {
            if (previousLevel < minLevel && currentLevel >= minLevel) {
                matched.push(...tasks);
            }
        }
        return matched;
    }

    /**
     * Tasks that depend on skill levels, total level, or XP (checked on login / XP gain).
     */
    getSkillProgressTasks(): ParsedTask[] {
        return this.skillProgressTasks;
    }

    getCollectionLogSlotTasks(): ParsedTask[] {
        return this.collectionLogSlotTasks;
    }

    getCollectionLogPageTabTasks(tabIndex: number): ParsedTask[] {
        return this.collectionLogPageTabToTasks.get(tabIndex | 0) ?? [];
    }

    getCollectionLogPageStructTasks(structId: number): ParsedTask[] {
        return this.collectionLogPageStructToTasks.get(structId | 0) ?? [];
    }

    /**
     * Collect tasks matching a successful spell cast (deduped by taskId).
     */
    getTasksForSpellCast(opts: {
        spellId?: number;
        spellCategory?: string;
        spellbook?: string;
        teleportName?: string;
    }): ParsedTask[] {
        const seen = new Set<number>();
        const out: ParsedTask[] = [];
        const add = (tasks: ParsedTask[]) => {
            for (const task of tasks) {
                if (seen.has(task.taskId)) continue;
                seen.add(task.taskId);
                out.push(task);
            }
        };

        add(this.anySpellCastTasks);

        const spellId = opts.spellId | 0;
        if (spellId > 0) {
            add(this.spellIdToTasks.get(spellId) ?? []);
        }

        if (opts.spellCategory) {
            add(this.spellCategoryToTasks.get(opts.spellCategory) ?? []);
        }

        if (opts.spellbook) {
            add(this.spellbookToTasks.get(opts.spellbook) ?? []);
        }

        if (opts.teleportName) {
            add(this.teleportNameToTasks.get(opts.teleportName.toLowerCase()) ?? []);
            add(this.spellCategoryToTasks.get("teleport") ?? []);
        }

        return out;
    }

    // === Challenge Lookup methods ===

    /**
     * Get challenges triggered by killing an NPC.
     */
    getChallengesForNpcKill(npcId: number): ParsedChallenge[] {
        return this.npcIdToChallenges.get(npcId) ?? [];
    }

    /**
     * Get challenges triggered by equipping an item.
     */
    getChallengesForItemEquip(itemId: number): ParsedChallenge[] {
        return this.itemEquipToChallenges.get(itemId) ?? [];
    }

    /**
     * Get challenges triggered by obtaining an item.
     */
    getChallengesForItemObtain(itemId: number): ParsedChallenge[] {
        return this.itemObtainToChallenges.get(itemId) ?? [];
    }

    /**
     * Get challenges triggered by crafting an item.
     */
    getChallengesForItemCraft(itemId: number): ParsedChallenge[] {
        return this.itemCraftToChallenges.get(itemId) ?? [];
    }

    /**
     * Get combat-level-based challenges that match the given NPC combat level.
     */
    getChallengesForNpcKillCombatLevel(combatLevel: number): ParsedChallenge[] {
        return this.npcKillCombatLevelChallenges.filter((parsed) => {
            const trigger = parsed.trigger;
            if (trigger.type !== "npc_kill_combat_level") return false;
            return combatLevel >= trigger.minCombatLevel;
        });
    }

    // === Stats ===

    getStats(): {
        parsed: number;
        unparsed: number;
        total: number;
        coverage: string;
        challenges: number;
        indexSizes: {
            npcKill: number;
            itemEquip: number;
            itemObtain: number;
            itemCraft: number;
            skillingAction: number;
            areaEnter: number;
            wildernessLevel: number;
            skillProgress: number;
            spellCastSpellId: number;
            spellCastCategory: number;
            spellCastSpellbook: number;
            spellCastTeleport: number;
            spellCastAny: number;
        };
        challengeIndexSizes: {
            npcKill: number;
            itemEquip: number;
            itemObtain: number;
            itemCraft: number;
        };
        sampleFailures: string[];
    } {
        const total = this.parsedCount + this.unparsedCount;
        return {
            parsed: this.parsedCount,
            unparsed: this.unparsedCount,
            total,
            coverage: `${((this.parsedCount / total) * 100).toFixed(1)}%`,
            challenges: this.challengeCount,
            indexSizes: {
                npcKill: this.npcIdToTasks.size,
                itemEquip: this.itemEquipToTasks.size,
                itemObtain: this.itemObtainToTasks.size,
                itemCraft: this.itemCraftToTasks.size,
                skillingAction: this.skillingActionToTasks.size,
                areaEnter: this.areaEnterToTasks.size,
                wildernessLevel: this.wildernessLevelToTasks.size,
                skillProgress: this.skillProgressTasks.length,
                spellCastSpellId: this.spellIdToTasks.size,
                spellCastCategory: this.spellCategoryToTasks.size,
                spellCastSpellbook: this.spellbookToTasks.size,
                spellCastTeleport: this.teleportNameToTasks.size,
                spellCastAny: this.anySpellCastTasks.length,
            },
            challengeIndexSizes: {
                npcKill: this.npcIdToChallenges.size,
                itemEquip: this.itemEquipToChallenges.size,
                itemObtain: this.itemObtainToChallenges.size,
                itemCraft: this.itemCraftToChallenges.size,
            },
            sampleFailures: this.parseFailures,
        };
    }
}
