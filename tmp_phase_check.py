import csv
import json
import pathlib

root = pathlib.Path(r'c:/xRSPS/xrsps-typescript')

tasks = list(csv.DictReader(open(root / 'tasks.csv', encoding='utf-8')))
by_name = {r['Task'].strip(): r for r in tasks}

vals = list(csv.DictReader(open(root / 'server/data/leagues/reports/validate-tasks-latest.csv', encoding='utf-8')))
status = {int(r['task_id']): r['status'] for r in vals}

objs = []
for ln in (root / 'src/shared/leagues/leagueTasks.data.ts').read_text(encoding='utf-8').splitlines():
    s = ln.strip()
    if s.startswith('{"taskId"'):
        if s.endswith(','):
            s = s[:-1]
        objs.append(json.loads(s))

bad = []
for o in objs:
    row = by_name.get(o['name'])
    if not row:
        bad.append((o['taskId'], o['name'], None, 'no_csv'))
        continue
    tid = int(row['Task ID'])
    st = status.get(tid)
    if st != 'ready':
        bad.append((o['taskId'], o['name'], tid, st))

print('live_count', len(objs))
print('not_ready_count', len(bad))
for entry in bad:
    print(entry)
