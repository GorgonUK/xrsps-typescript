import type { PlayerPermission } from "../PlayerPermission";

/**
 * Built-in chat-command access policy. Script-registered commands are not in
 * this table and remain responsible for their own access policy.
 */
const BUILTIN_COMMAND_PERMISSIONS: Readonly<Record<string, PlayerPermission>> = {
    pos: "player",
    allrunes: "developer",
    ancient: "developer",
    arceuus: "developer",
    bond: "developer",
    clear: "developer",
    completequests: "developer",
    devbank: "developer",
    item: "developer",
    kill: "developer",
    levelup: "developer",
    lunar: "developer",
    maxall: "developer",
    onehealth: "developer",
    quest: "developer",
    randomitem: "developer",
    resetquests: "developer",
    rubytest: "developer",
    scroll: "developer",
    smithing: "developer",
    spawn: "developer",
    standard: "developer",
    tele: "developer",
    teleto: "developer",
    teletome: "developer",
    tickstats: "developer",
    whip: "developer",
};

export function getBuiltinChatCommandPermission(command: string): PlayerPermission | undefined {
    return BUILTIN_COMMAND_PERMISSIONS[command];
}
