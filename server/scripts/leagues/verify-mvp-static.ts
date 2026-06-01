/**
 * Pre-flight static checks for MVP league tasks (no server boot).
 */
import { verifyMvpLeagueTasksStatic } from "../../src/game/leagues/leagueTaskDebug";

function main(): void {
    const lines = verifyMvpLeagueTasksStatic();
    for (const line of lines) {
        console.log(line.replace(/<col=[^>]+>/g, "").replace(/<\/col>/g, ""));
    }
    const failed = lines.some((l) => l.includes("FAIL"));
    process.exit(failed ? 1 : 0);
}

main();
