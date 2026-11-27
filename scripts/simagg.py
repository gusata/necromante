import json, sys
rs = [json.loads(l) for l in sys.stdin if l.startswith('{')]
n = len(rs) or 1
pct = lambda k: f"{round(100 * sum(1 for r in rs if r['bosses'] >= k) / n)}%"
waves = sorted(r['wave'] for r in rs)
curve = []
for i, name in enumerate(['vila', 'mosteiro', 'fortaleza', 'catedral']):
    v = [d for r in rs for d in r['hurt'][i]]
    hit = sum(1 for d in v if d > 0)
    curve.append(f"{name} {sum(v) / max(1, len(v)):.0f}% ({round(100 * hit / max(1, len(v)))}%)")
print(f"{sys.argv[1]}: runs {len(rs)} onda {sum(waves) / n:.1f} | chefes {pct(1)} {pct(2)} {pct(3)} {pct(4)} | dano/onda: {'  '.join(curve)}")
