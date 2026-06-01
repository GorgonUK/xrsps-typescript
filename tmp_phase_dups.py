import csv, json, pathlib, collections
root = pathlib.Path(r'c:/xRSPS/xrsps-typescript')
tasks = list(csv.DictReader(open(root / 'tasks.csv', encoding='utf-8')))
by_name = {r['Task'].strip(): int(r['Task ID']) for r in tasks}
objs=[]
for ln in (root / 'src/shared/leagues/leagueTasks.data.ts').read_text(encoding='utf-8').splitlines():
    s=ln.strip()
    if s.startswith('{"taskId"'):
        if s.endswith(','): s=s[:-1]
        objs.append(json.loads(s))
ids=[]
for o in objs:
    tid=by_name.get(o['name'])
    ids.append((o['taskId'],o['name'],tid))
ctr=collections.Counter(t for _,_,t in ids)
print('mapped unique csv ids',len([k for k in ctr if k is not None]))
for csv_id,count in sorted(ctr.items(), key=lambda x:(-x[1],x[0] if x[0] is not None else -1)):
    if count>1:
        print('dup_csv',csv_id,'count',count)
        for taskId,name,tid in ids:
            if tid==csv_id:
                print('  live',taskId,name)
