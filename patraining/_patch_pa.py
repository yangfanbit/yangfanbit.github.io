import io
p = r'C:\Users\86115\OneDrive\@YFBLOG\static\patraining\script.js'
with io.open(p, encoding='utf-8') as f:
    lines = f.read().split('\n')
N = len(lines)

drops = set()
for a, b in [
    (68, 74), (84, 85), (87, 87), (346, 347), (348, 364), (395, 416),
    (418, 431), (433, 441), (443, 466), (468, 541), (548, 548),
    (1105, 1114), (1470, 1471), (1530, 1531), (1620, 1620), (2416, 2419),
]:
    for i in range(a, b + 1):
        drops.add(i)

replaces = {
    367: (393, [
        "    // 引导：加载本地数据并渲染（纯本地模式，无云端）",
        "    async bootstrap() {",
        "        this.loadLocalData();",
        "        this.renderTransactions();",
        "        this.updateStats();",
        "        this.renderCharts();",
        "    }",
    ]),
    2406: (2413, [
        "                // 确认是否合并导入（按 id 去重，相同 id 取较新的一条）",
        "                if (this.transactions.length > 0 &&",
        "                    !confirm('导入将与现有记录按 id 合并（相同 id 取较新的一条），确定继续吗？')) {",
        "                    return;",
        "                }",
        "",
        "                // 增量合并：以 id 为主键；相同 id 用较新的 updatedAt/createdAt 覆盖，否则新增",
        "                const existingMap = new Map(this.transactions.map(t => [t.id, t]));",
        "                let added = 0, updated = 0;",
        "                for (const t of importedData.transactions) {",
        "                    if (t.id == null) t.id = Date.now() + Math.floor(Math.random() * 1000);",
        "                    const ex = existingMap.get(t.id);",
        "                    if (ex) {",
        "                        const exTime = new Date(ex.updatedAt || ex.createdAt || 0).getTime();",
        "                        const inTime = new Date(t.updatedAt || t.createdAt || 0).getTime();",
        "                        if (inTime > exTime) {",
        "                            const idx = this.transactions.findIndex(x => x.id === t.id);",
        "                            this.transactions[idx] = t;",
        "                            updated++;",
        "                        }",
        "                    } else {",
        "                        this.transactions.push(t);",
        "                        existingMap.set(t.id, t);",
        "                        added++;",
        "                    }",
        "                }",
    ]),
    2251: (2254, [
        "        if (days === Infinity) {",
        "            text = '尚未下载过本地备份，建议下载一份 JSON 备份以防数据丢失。';",
        "        } else if (days >= this.BACKUP_REMIND_DAYS) {",
        "            text = `距上次本地备份已 ${days} 天，建议再下载一份本地副本。`;",
        "        }",
    ]),
}

out = []
i = 1
while i <= N:
    if i in drops:
        i += 1
        continue
    if i in replaces:
        end, newlines = replaces[i]
        out.extend(newlines)
        i = end + 1
        continue
    out.append(lines[i - 1])
    i += 1

with io.open(p, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('done: lines', N, '->', len(out))
print('remaining cloud refs:',
      sum(1 for ln in out if 'cloudDb' in ln or 'cloudAuth' in ln or 'cloudEnvId' in ln
      or 'syncToCloud' in ln or 'showLoginOverlay' in ln or 'enterLocalMode' in ln
      or 'initCloud' in ln or 'cloudbase' in ln or 'doLogin' in ln or 'doLogout' in ln))
