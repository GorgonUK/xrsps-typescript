export type TaskBatch =
    | "skills"
    | "combat"
    | "bosses"
    | "minigames"
    | "collection"
    | "quests"
    | "misc";

export type TaskStatus =
    | "ready"
    | "missing_content"
    | "need_hook"
    | "ambiguous"
    | "duplicate";

export type CsvTaskRow = {
    id: number;
    area: string;
    name: string;
    requirements: string;
    difficulty: string;
    points: number;
    combatMastery: string;
};

export type ValidationRow = {
    task_id: number;
    task_name: string;
    batch: TaskBatch;
    status: TaskStatus;
    matched_content: string;
    matched_hook: string;
    missing_requirement: string;
    suggested_fix: string;
};

export type BatchSummary = {
    batch: TaskBatch;
    total: number;
    ready: number;
    missing_content: number;
    need_hook: number;
    ambiguous: number;
    duplicate: number;
};
