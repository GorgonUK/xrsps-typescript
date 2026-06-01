import json
import pathlib
import re

root = pathlib.Path(r'c:/xRSPS/xrsps-typescript')

p = root / 'src/shared/leagues/leagueTasks.data.ts'
text = p.read_text(encoding='utf-8')
rows = []
for ln in text.splitlines():
    s = ln.strip()
    if s.startswith('{"taskId"'):
        if s.endswith(','):
            s = s[:-1]
        rows.append(json.loads(s))

rows = [r for r in rows if r['taskId'] != 120]
for i, r in enumerate(rows):
    r['taskId'] = i
    r['structId'] = 90000 + i

lines = [
    'import type { LeagueTaskRow } from "./leagueTypes";',
    '',
    f'// Live league tasks ({len(rows)}: MVP + Phase 2/2B skilling_action). Source: tasks.csv + validation.',
    '// Full OSRS cache export backed up under server/data/leagues/archive/',
    'export const LEAGUE_TASKS: LeagueTaskRow[] = [',
]
for i, r in enumerate(rows):
    suffix = ',' if i < len(rows)-1 else ''
    lines.append('  ' + json.dumps(r, separators=(',', ':')) + suffix)
lines.append('];')
p.write_text('\n'.join(lines) + '\n', encoding='utf-8')

pt = root / 'src/shared/leagues/leagueTaskTriggers.data.ts'
txt = pt.read_text(encoding='utf-8')
m = re.search(r'Record<number, TaskTrigger> = (\{[\s\S]*\});\s*$', txt)
obj = json.loads(m.group(1))
new_obj = {}
for k, v in sorted(((int(k), v) for k, v in obj.items()), key=lambda x: x[0]):
    if k == 120:
        continue
    nk = k - 1 if k > 120 else k
    new_obj[str(nk)] = v
new_txt = (
    'import type { TaskTrigger } from "../../../server/src/game/leagues/triggers/TriggerTypes";\n\n'
    '/** Live task triggers keyed by taskId (0..n-1). Generated - do not edit. */\n'
    f'export const LEAGUE_TASK_TRIGGER_BY_ID: Record<number, TaskTrigger> = {json.dumps(new_obj, indent=2)};\n'
)
pt.write_text(new_txt, encoding='utf-8')

pe = root / 'src/shared/leagues/leagueTasksEnumOverride.ts'
et = pe.read_text(encoding='utf-8')
new_ids = '[' + ','.join(str(90000 + i) for i in range(len(rows))) + ']'
et = re.sub(r'const MVP_TASK_ENUM_STRUCT_IDS: number\[] = \[[^\]]*\];', f'const MVP_TASK_ENUM_STRUCT_IDS: number[] = {new_ids};', et)
pe.write_text(et, encoding='utf-8')

pp = root / 'server/data/leagues/phase2-skilling-tasks.json'
ph = json.loads(pp.read_text(encoding='utf-8'))
new_tasks = []
for t in ph['tasks']:
    if t['sourceTaskId'] == 224:
        continue
    if t.get('mvpTaskId', -1) > 120:
        t['mvpTaskId'] = t['mvpTaskId'] - 1
    new_tasks.append(t)
ph['tasks'] = new_tasks
pp.write_text(json.dumps(ph, indent=2) + '\n', encoding='utf-8')

pi = root / 'server/scripts/leagues/import-phase2b-tasks.ts'
it = pi.read_text(encoding='utf-8')
it = it.replace('    { sourceTaskId: 224, skill: "cooking", action: "cook", targetId: 2140 },\n', '')
pi.write_text(it, encoding='utf-8')

print('dedupe applied')
