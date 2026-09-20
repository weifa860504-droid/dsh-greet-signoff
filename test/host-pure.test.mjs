/**
 * 宿主半（index.mjs）的纯函数单测。
 *
 * 这里只测"不碰磁盘、不碰 Cordis 服务"的部分：文案池挑句、运行时变量解析、格式化、规则文本拼装。
 * index.mjs 只用 node 内置模块，所以可以直接 import；apply() 不会被调用，不会注册任何东西。
 *
 * 用法：node --test test/host-pure.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test as h } from '../index.mjs'

const NOW = new Date('2026-09-18T12:00:00')
const STATS = { rounds: 4, lastMs: 12400, lastTokens: 3120, lastModel: 'DeepSeek-V4-Flash', lastAt: 0 }

test('宿主半：运行时变量解析', () => {
  assert.equal(h.resolveRuntimeVars('第 {count} 次 · {model}', STATS), '第 5 次 · DeepSeek-V4-Flash')
  assert.equal(h.resolveRuntimeVars('上一轮 {elapsed} / {tokens}', STATS), '上一轮 12.4s / 3.1k')
  // 别名与大小写
  assert.equal(h.resolveRuntimeVars('{lastElapsed} {LASTTOKENS}', STATS), '12.4s 3.1k')
  // 未知变量原样保留
  assert.equal(h.resolveRuntimeVars('保留 {nope} 与 {date}', STATS), '保留 {nope} 与 {date}')
  // 没有统计时给占位符，而不是崩掉
  assert.equal(h.resolveRuntimeVars('{elapsed} / {tokens} / {model}', undefined), '— / — / —')
  assert.equal(h.resolveRuntimeVars('第 {count} 次', undefined), '第 1 次')
  // 不含花括号时原样返回（快路径）
  assert.equal(h.resolveRuntimeVars('没有任何变量', STATS), '没有任何变量')
})

test('宿主半：耗时与用量的紧凑写法', () => {
  assert.equal(h.formatElapsed(820), '820ms')
  assert.equal(h.formatElapsed(12400), '12.4s')
  assert.equal(h.formatElapsed(0), '—')
  assert.equal(h.formatElapsed(Number.NaN), '—')
  assert.equal(h.formatTokenCount(3120), '3.1k')
  assert.equal(h.formatTokenCount(999), '999')
  assert.equal(h.formatTokenCount(2400000), '2.4M')
  assert.equal(h.formatTokenCount(0), '—')
})

test('宿主半：pickLine —— 固定文案 / 文案池 / 运行时变量', () => {
  const base = {
    greeting: { text: '你好' },
    signOff: { text: '以上，本轮 {elapsed}' },
    pool: { enabled: false, mode: 'random', greeting: [], signOff: [] },
  }
  assert.equal(h.pickLine(base, 'greeting', NOW, STATS), '你好')
  assert.equal(h.pickLine(base, 'signOff', NOW, STATS), '以上，本轮 12.4s')

  // 池子启用：只有开场语配了池子 → 收尾仍用固定文案；sequence 按顺序轮换并回到第一句
  const seq = { ...base, pool: { enabled: true, mode: 'sequence', greeting: ['甲', '乙'], signOff: [] } }
  assert.equal(h.pickLine(seq, 'greeting', NOW, STATS), '甲')
  assert.equal(h.pickLine(seq, 'greeting', NOW, STATS), '乙')
  assert.equal(h.pickLine(seq, 'greeting', NOW, STATS), '甲')
  assert.equal(h.pickLine(seq, 'signOff', NOW, STATS), '以上，本轮 12.4s')

  // 池子启用但池子是空的 → 两行都回落固定文案
  const empty = { ...base, pool: { enabled: true, mode: 'random', greeting: [], signOff: [] } }
  assert.equal(h.pickLine(empty, 'greeting', NOW, STATS), '你好')

  // 池子 + 模板变量 + 运行时变量混用
  const mixed = { ...base, pool: { enabled: true, mode: 'random', greeting: [], signOff: ['{weekday} 收尾 {tokens}'] } }
  assert.match(h.pickLine(mixed, 'signOff', NOW, STATS), /^星期五 收尾 3\.1k$/)

  // 关掉池子后，池子内容不参与
  const off = { ...mixed, pool: { enabled: false, mode: 'random', greeting: [], signOff: ['不该被用到'] } }
  assert.equal(h.pickLine(off, 'signOff', NOW, STATS), '以上，本轮 12.4s')
})

test('宿主半：ruleTextWith 把解析后的文案写进提示段', () => {
  const config = h.normalize({ greeting: { text: '你好 {count}' }, signOff: { text: '以上' } })
  const text = h.ruleTextWith(config, { rounds: 0, lastMs: 0, lastTokens: 0, lastModel: '', lastAt: 0 })
  assert.match(text, /每一次回复的正文都必须以这一行原样开头：你好 1/)
  assert.match(text, /每一次回复的正文都必须以这一行原样结尾：以上/)
  // 两行都空 → 整段不渲染
  const emptyConfig = h.normalize({ greeting: { text: '' }, signOff: { text: '' } })
  assert.equal(h.ruleTextWith(emptyConfig, undefined), '')
})

test('宿主半：normalize 保留并清洗 pool 字段', () => {
  const config = h.normalize({ pool: { enabled: true, mode: 'sequence', greeting: [' 甲 ', ''], signOff: ['乙'] } })
  assert.equal(config.pool.enabled, true)
  assert.equal(config.pool.mode, 'sequence')
  assert.deepEqual(config.pool.greeting, ['甲'])
  assert.deepEqual(config.pool.signOff, ['乙'])
  // 缺字段时补默认
  const bare = h.normalize({})
  assert.deepEqual(bare.pool, { enabled: false, mode: 'random', greeting: [], signOff: [] })
})

test('宿主半：按工作区绑定文案（匹配、最长前缀、优先级）', () => {
  const bindings = h.sanitizeWorkspaceBindings({
    enabled: true,
    items: [
      { path: 'E:\\harness', greeting: '干活开场', signOff: '干活收尾' },
      { path: 'E:\\harness\\dsh-plugins', greeting: '插件开场', signOff: '' },
      { path: '', greeting: '空路径', signOff: '' },              // 丢
      { path: 'D:\\nothing', greeting: '', signOff: '' },          // 两行都空 → 丢
    ],
  })
  assert.equal(bindings.items.length, 2)
  // 路径大小写/斜杠/末尾分隔符都不影响匹配
  assert.equal(h.matchWorkspaceBinding(bindings, 'e:/HARNESS/').path, 'E:\\harness')
  // 更长的前缀优先
  assert.equal(h.matchWorkspaceBinding(bindings, 'E:\\harness\\dsh-plugins\\x').path, 'E:\\harness\\dsh-plugins')
  // 目录边界：不相干路径不命中
  assert.equal(h.matchWorkspaceBinding(bindings, 'E:\\harness2'), undefined)
  assert.equal(h.matchWorkspaceBinding(bindings, undefined), undefined)
  // 关掉开关就不命中
  assert.equal(h.matchWorkspaceBinding({ enabled: false, items: bindings.items }, 'E:\\harness'), undefined)

  // 优先级：工作区绑定 > 文案池 > 固定文案
  const base = h.normalize({
    greeting: { text: '固定开场' },
    signOff: { text: '固定收尾' },
    pool: { enabled: true, mode: 'sequence', greeting: ['池子开场'], signOff: ['池子收尾'] },
    perWorkspace: { enabled: true, items: [{ path: 'E:\\harness', greeting: '干活开场', signOff: '' }] },
  })
  const stats = { rounds: 0, lastMs: 0, lastTokens: 0, lastModel: '', lastAt: 0 }
  // 命中工作区：开场用绑定；收尾绑定是空的 → 回落文案池
  const atHarness = h.ruleTextWith(base, stats, 'E:\\harness')
  assert.match(atHarness, /原样开头：干活开场/)
  assert.match(atHarness, /原样结尾：池子收尾/)
  // 不命中工作区：两行都用文案池
  const elsewhere = h.ruleTextWith(base, stats, 'D:\\other')
  assert.match(elsewhere, /原样开头：池子开场/)
  assert.match(elsewhere, /原样结尾：池子收尾/)
})

/* ─── 上下文占用接口 ─────────────────────────────────────────────────── */

/** 造一份贴近真实的投影文件：contextPressure + contextTimeline（cat 只有 user/inject/assistant/tool）。 */
function projcacheDoc() {
  return {
    version: 1,
    record: {
      rows: {
        contextPressure: {
          ver: 4,
          seq: 9,
          val: { surfaceTokens: 1000, contextWindow: 1000000, pressureTokens: 900, sampledSurfaceTokens: 950 },
        },
        contextTimeline: {
          ver: 15,
          seq: 9,
          val: {
            systemTokens: 100,
            toolsTokens: 200,
            model: 'deepseek-flash',
            provider: 'deepseek-official',
            requests: [{ total: 800 }, { total: 950 }],
            surface: [
              { seq: 1, cat: 'user', tokens: 50, text: '你好' },
              { seq: 2, cat: 'tool', tokens: 300, tool: 'read' },
              { seq: 3, cat: 'assistant', tokens: 150 },
              { seq: 4, cat: 'inject', tokens: 200, form: 'snapshot', text: 'x'.repeat(200) },
            ],
          },
        },
      },
    },
  }
}

test('宿主半：parseContextTimeline —— 正常数据（分类、占比、排序、hot）', () => {
  const out = h.parseContextTimeline(projcacheDoc(), 'abc-123')
  assert.equal(out.sessionId, 'abc-123')
  assert.equal(out.source, 'projcache')
  assert.equal(out.note, '')
  assert.equal(out.window, 1000000)
  assert.equal(out.surfaceTokens, 1000)
  assert.equal(out.pressureTokens, 900)
  assert.equal(out.sampledSurfaceTokens, 950)
  // 分子 = pressureTokens + (surfaceTokens − sampledSurfaceTokens)，与界面百分比同一口径
  assert.equal(out.projectedTokens, 950)
  assert.equal(out.model, 'deepseek-flash')
  assert.equal(out.provider, 'deepseek-official')
  assert.equal(out.requestCount, 2)
  assert.equal(out.lastRequestTotal, 950)

  // 300+200+200+150+100+50 = 1000，全部条目都在
  assert.equal(out.parts.length, 6)
  assert.deepEqual(out.parts[0], { key: 'tool', label: '工具结果', tokens: 300, share: 0.3 })
  // 同额（200）按 key 升序：inject 排在 tools 前面
  assert.deepEqual(out.parts.map((p) => p.key), ['tool', 'inject', 'tools', 'assistant', 'system', 'user'])
  const labels = Object.fromEntries(out.parts.map((p) => [p.key, p.label]))
  assert.equal(labels.system, '系统提示词')
  assert.equal(labels.tools, '工具定义')
  assert.equal(labels.inject, '记忆与注入')
  assert.equal(labels.assistant, '助手历史')
  assert.equal(labels.user, '用户历史')
  const sum = out.parts.reduce((acc, p) => acc + p.tokens, 0)
  assert.equal(sum, 1000)
  for (const part of out.parts) assert.equal(part.share, h.round4(part.tokens / 1000))

  // hot：单个最占地方的片段，原文截到 60 字
  assert.equal(out.hot.length, 4)
  assert.deepEqual(out.hot[0], { seq: 2, cat: 'tool', label: '工具结果', tokens: 300, name: 'read', text: '' })
  assert.equal(out.hot[1].name, 'snapshot')
  assert.equal(out.hot[1].text.length, 60)
})

test('宿主半：parseContextTimeline —— 空数据 / 字段缺失 / 脏数据', () => {
  // 文件读不到：source=none，原因进 note，其余字段全空但不缺
  const missing = h.parseContextTimeline(null, 'abc', '文件缺失')
  assert.equal(missing.source, 'none')
  assert.equal(missing.sessionId, 'abc')
  assert.equal(missing.note, '文件缺失')
  assert.deepEqual(missing.parts, [])
  assert.deepEqual(missing.hot, [])
  assert.equal(missing.window, 0)
  assert.equal(missing.surfaceTokens, 0)
  assert.equal(missing.projectedTokens, 0)
  assert.equal(missing.lastRequestTotal, 0)
  // 没给原因时也有兜底说明
  assert.ok(h.parseContextTimeline(null, undefined).note.length > 0)
  assert.equal(h.parseContextTimeline(null, undefined).sessionId, null)
  // 结构不认识（不是对象 / 没有 record.rows）
  assert.equal(h.parseContextTimeline('nope', 'a').source, 'none')
  assert.equal(h.parseContextTimeline({}, 'a').source, 'none')
  const emptyRows = h.parseContextTimeline({ record: { rows: {} } }, 'a')
  assert.equal(emptyRows.source, 'none')
  assert.match(emptyRows.note, /没有上下文明细/)

  // 有 surface 但没有 contextPressure：surfaceTokens 回落到分项之和
  const noPressure = h.parseContextTimeline({
    record: { rows: { contextTimeline: { val: { surface: [{ cat: 'user', tokens: 30 }, { cat: 'tool', tokens: 70 }] } } } },
  }, 'a')
  assert.equal(noPressure.source, 'projcache')
  assert.equal(noPressure.surfaceTokens, 100)
  assert.equal(noPressure.window, 0)
  assert.equal(noPressure.pressureTokens, 0)
  // 没有 pressure 读数 → 预计用量退回 surfaceTokens（当前上下文总览），而不是 0
  assert.equal(noPressure.projectedTokens, 100)
  assert.equal(noPressure.parts[0].share, 0.7)

  // 脏条目：不是对象 / 没有 cat / tokens 不是数字 → 跳过或用 other 兜底，不进 user
  const dirty = h.parseContextTimeline({
    record: {
      rows: {
        contextTimeline: { val: { surface: [null, 5, { tokens: 40 }, { cat: 'user', tokens: 'abc' }, { cat: 'user', tokens: 12 }] } },
      },
    },
  }, 'a')
  // {tokens:40} 有 token 但没 cat → 归 other；tokens:'abc' 不是数字 → 按 0 丢掉
  assert.deepEqual(dirty.parts, [
    { key: 'other', label: '其它', tokens: 40, share: h.round4(40 / 52) },
    { key: 'user', label: '用户历史', tokens: 12, share: h.round4(12 / 52) },
  ])
  const unknownCat = h.parseContextTimeline({
    record: { rows: { contextTimeline: { val: { surface: [{ cat: 'mystery', tokens: 5 }] } } } },
  }, 'a')
  // 未知分类：label 直接用原始 key，不硬编造语义
  assert.deepEqual(unknownCat.parts[0], { key: 'mystery', label: 'mystery', tokens: 5, share: 1 })
  // val 不是对象（旧版本 / 坏数据）也不炸
  assert.equal(h.parseContextTimeline({ record: { rows: { contextTimeline: { val: 7 } } } }, 'a').source, 'none')
})

test('宿主半：parseContextTimeline —— 占比分母用 partsTokens（DSH 的 surfaceTokens 不含工具定义）', () => {
  // 实测：contextPressure.surfaceTokens 比 system+tools+各分类之和正好少一个 toolsTokens
  const doc = projcacheDoc()
  doc.record.rows.contextPressure.val.surfaceTokens = 800   // 900 − tools 200 …模拟真实那种"少一块"
  const out = h.parseContextTimeline(doc, 'a')
  assert.equal(out.surfaceTokens, 800)     // DSH 原值，保持不动（还要算 projectedTokens）
  assert.equal(out.partsTokens, 1000)      // 各部分之和，含 system/tools
  const shareSum = out.parts.reduce((acc, p) => acc + p.share, 0)
  assert.ok(Math.abs(shareSum - 1) < 0.001, `share 合计应约为 1，实际 ${shareSum}`)
  assert.equal(out.parts.find((p) => p.key === 'system').share, 0.1)
  // projectedTokens 仍按 DSH 自己的 surfaceTokens 算：(900 → 这里 800) − 950 → 不出现负数
  assert.equal(out.projectedTokens, 900)
})

test('宿主半：parseContextTimeline —— parts 最多 12 条，其余合并进 other', () => {
  const surface = []
  for (let i = 0; i < 15; i += 1) surface.push({ cat: `c${String(i).padStart(2, '0')}`, tokens: 1000 - i * 10 })
  const out = h.parseContextTimeline({ record: { rows: { contextTimeline: { val: { surface } } } } }, 'a')
  assert.equal(out.parts.length, 12)
  // 尾部 4 条（890 + 880 + 870 + 860 = 3500）合并成 other，合并后按降序排在最前
  const other = out.parts.find((p) => p.key === 'other')
  assert.deepEqual(other, { key: 'other', label: '其它', tokens: 3500, share: h.round4(3500 / out.surfaceTokens) })
  assert.equal(out.parts[0].key, 'other')
  const tokens = out.parts.map((p) => p.tokens)
  assert.deepEqual(tokens, [...tokens].sort((a, b) => b - a))
  assert.equal(tokens.reduce((acc, n) => acc + n, 0), surface.reduce((acc, item) => acc + item.tokens, 0))
})

test('宿主半：parseContextTimeline —— hot 的 name 兜底（tool / form / calls）', () => {
  const out = h.parseContextTimeline({
    record: {
      rows: {
        contextTimeline: {
          val: {
            surface: [
              { seq: 1, cat: 'tool', tokens: 10, tool: 'read' },
              { seq: 2, cat: 'inject', tokens: 8, form: 'relay' },
              { seq: 3, cat: 'assistant', tokens: 6, calls: ['a', 'b', 'c', 'd'] },
              { seq: 4, cat: 'user', tokens: 4, text: '用户说的话' },
            ],
          },
        },
      },
    },
  }, 'a')
  assert.deepEqual(out.hot.map((item) => item.name), ['read', 'relay', 'a,b,c', ''])
  assert.deepEqual(out.hot.map((item) => item.seq), [1, 2, 3, 4])
  assert.equal(out.hot[3].text, '用户说的话')
  assert.equal(out.hot[0].label, '工具结果')
})

/* ─── 花费接口 ───────────────────────────────────────────────────────── */

test('宿主半：costCNYOf —— 单价常量与四舍五入', () => {
  assert.equal(h.costCNYOf(0, 0, 0), 0)
  assert.equal(h.costCNYOf(1000000, 0, 0), 1)          // 未命中输入 1 元/百万
  assert.equal(h.costCNYOf(0, 1000000, 0), 0.02)       // 缓存命中 0.02 元/百万
  assert.equal(h.costCNYOf(0, 0, 1000000), 4)          // 输出 4 元/百万
  assert.equal(h.costCNYOf(420000, 0, 0), 0.42)        // 发哥那边的例子
  assert.equal(h.costCNYOf(1234567, 0, 0), 1.2346)     // 保留 4 位、第 5 位进位
  assert.equal(h.costCNYOf(12344, 0, 0), 0.0123)       // 第 5 位舍去
  assert.equal(h.costCNYOf(1500, 150000, 3000), 0.0165)
  // 脏输入按 0 算，不出 NaN
  assert.equal(h.costCNYOf(undefined, null, 'x'), 0)
  assert.equal(h.round4(Number.NaN), 0)
  assert.equal(h.round4(1.00005), 1.0001)
})

test('宿主半：parseSessionCost —— cost 分桶 / 回落 totals / 缺失', () => {
  const doc = {
    record: {
      rows: {
        title: { ver: 1, seq: 9, val: '  功能增删建议  ' },
        sessionStats: { ver: 1, seq: 9, val: { turns: 2, steps: 14 } },
        contextTimeline: {
          ver: 15,
          val: {
            requests: [{ total: 1 }, { total: 2 }],
            cost: {
              flash: {
                off: { uncached: 1000, cacheRead: 100000, cacheWrite: 0, output: 2000 },
                peak: { uncached: 500, cacheRead: 50000, cacheWrite: 10, output: 1000 },
              },
            },
          },
        },
      },
    },
  }
  const parsed = h.parseSessionCost(doc)
  assert.equal(parsed.uncached, 1500)      // off + peak 都算上
  assert.equal(parsed.cacheRead, 150000)
  assert.equal(parsed.output, 3000)
  assert.equal(parsed.cacheWrite, 10)
  assert.equal(parsed.costCNY, h.costCNYOf(1500, 150000, 3000))
  assert.equal(parsed.rounds, 14)          // sessionStats.steps 就是模型调用次数
  assert.equal(parsed.turns, 2)
  assert.equal(parsed.title, '功能增删建议') // 首尾空白清掉
  assert.deepEqual(parsed.models, ['flash'])

  // 没有 cost 时回落 tokenUsage.totals；rounds 用 requests 条数兜底；title 是 null → 空串
  const fallback = h.parseSessionCost({
    record: {
      rows: {
        title: { ver: 1, val: null },
        tokenUsage: { ver: 2, val: { totals: { uncachedInputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 } } },
        contextTimeline: { val: { requests: [{ total: 1 }, { total: 2 }, { total: 3 }] } },
      },
    },
  })
  assert.equal(fallback.uncached, 10)
  assert.equal(fallback.cacheRead, 30)
  assert.equal(fallback.output, 20)
  assert.equal(fallback.cacheWrite, 40)
  assert.equal(fallback.rounds, 3)
  assert.equal(fallback.turns, 0)
  assert.equal(fallback.title, '')
  assert.deepEqual(fallback.models, [])

  // 空 / 坏数据：全 0，不抛
  for (const bad of [null, undefined, 'x', {}, { record: { rows: {} } }, { record: 'no' }]) {
    const out = h.parseSessionCost(bad)
    assert.equal(out.costCNY, 0)
    assert.equal(out.rounds, 0)
    assert.equal(out.title, '')
  }
})

test('宿主半：rankSessionCosts —— 降序、只留 top 5、标题兜底', () => {
  const list = [
    { sessionId: 'aaaaaaaa-1', title: '最贵', uncached: 0, cacheRead: 0, output: 1000000 },  // 4 元
    { sessionId: 'bbbbbbbb-2', title: '', uncached: 1000000, cacheRead: 0, output: 0 },      // 1 元
    { sessionId: 'cccccccc-3', title: '第三', uncached: 500000, cacheRead: 0, output: 0 },   // 0.5 元
    { sessionId: 'dddddddd-4', title: '第四', uncached: 0, cacheRead: 10000000, output: 0 }, // 0.2 元
    { sessionId: 'eeeeeeee-5', title: '第五', uncached: 100000, cacheRead: 0, output: 0 },   // 0.1 元
    { sessionId: 'ffffffff-6', title: '第六', uncached: 1000, cacheRead: 0, output: 0 },     // 0.001 → 第 6 名被截掉
    { sessionId: 'gggggggg-7', title: '零成本', uncached: 0, cacheRead: 0, output: 0 },      // 丢掉
    { sessionId: '', title: '没有 id', uncached: 0, cacheRead: 0, output: 1000000 },          // 丢掉
    null,
  ]
  const top = h.rankSessionCosts(list, 5)
  assert.equal(top.length, 5)
  assert.deepEqual(top.map((item) => item.sessionId), [
    'aaaaaaaa-1', 'bbbbbbbb-2', 'cccccccc-3', 'dddddddd-4', 'eeeeeeee-5',
  ])
  assert.deepEqual(top[0], { sessionId: 'aaaaaaaa-1', title: '最贵', costCNY: 4 })
  assert.equal(top[1].title, 'bbbbbbbb')  // 没标题 → 取 id 前 8 位
  // 空数据不炸
  assert.deepEqual(h.rankSessionCosts(undefined), [])
  assert.deepEqual(h.rankSessionCosts([], 5), [])
})

test('宿主半：aggregateLedger —— today / week、窗口外忽略、坏台账', () => {
  const ledger = {
    version: 1,
    days: {
      // 实测台账结构：日期 → provider → model → {inputTokens, outputTokens, cacheReadTokens,
      //   cacheWriteTokens, reasoningTokens, calls, cost}
      '2026-09-20': {
        'deepseek-official': {
          'deepseek-flash': {
            inputTokens: 659118, outputTokens: 339690, cacheReadTokens: 56980992,
            cacheWriteTokens: 0, reasoningTokens: 193020, calls: 337, cost: 3.157490,
          },
        },
      },
      '2026-09-19': {
        'deepseek-official': {
          'deepseek-flash': {
            inputTokens: 118023, outputTokens: 64881, cacheReadTokens: 4729600,
            cacheWriteTokens: 0, reasoningTokens: 37332, calls: 41, cost: 0.4721409999999999,
          },
        },
      },
      '2026-09-18': { p: { m: { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 2, cost: 0.001 } } },
      '2026-09-01': { p: { m: { inputTokens: 999999, outputTokens: 999999, cacheReadTokens: 0, calls: 99, cost: 9 } } },
      'not-a-date': { p: { m: { inputTokens: 5, calls: 1 } } },
    },
  }
  const at = new Date(2026, 8, 20, 12, 0, 0)   // 本地 2026-09-20
  const out = h.aggregateLedger(ledger, 7, at)
  assert.equal(out.today.date, '2026-09-20')
  assert.equal(out.today.rounds, 337)
  assert.equal(out.today.uncached, 659118)
  assert.equal(out.today.cacheRead, 56980992)
  assert.equal(out.today.output, 339690)
  assert.equal(out.today.costCNY, 3.1575)
  // 台账自带的 cost 与按常量算出来的钱一致（这就是单价常量的来源验证）
  assert.equal(out.today.ledgerCostCNY, 3.1575)

  assert.equal(out.week.days, 7)
  assert.equal(out.week.from, '2026-09-14')
  assert.equal(out.week.to, '2026-09-20')
  assert.equal(out.week.rounds, 380)                  // 337 + 41 + 2；窗口外的 09-01 与 not-a-date 不算
  assert.equal(out.week.uncached, 778141)
  assert.equal(out.week.output, 404571)
  assert.equal(out.week.cacheRead, 61710592)
  assert.equal(out.week.costCNY, h.costCNYOf(778141, 61710592, 404571))
  assert.equal(out.week.reasoning, 193020 + 37332)
  assert.equal(out.week.ledgerCostCNY, h.round4(3.157490 + 0.4721409999999999 + 0.001))

  // days=1 → 只看今天
  const one = h.aggregateLedger(ledger, 1, at)
  assert.equal(one.week.days, 1)
  assert.equal(one.week.from, '2026-09-20')
  assert.equal(one.week.rounds, 337)
  assert.equal(one.week.costCNY, one.today.costCNY)

  // 台账缺失 / 结构不认识 → 全 0，但字段齐全
  for (const bad of [null, undefined, 'x', {}, { days: 'nope' }]) {
    const empty = h.aggregateLedger(bad, 7, at)
    assert.equal(empty.today.costCNY, 0)
    assert.equal(empty.today.rounds, 0)
    assert.equal(empty.week.rounds, 0)
    assert.equal(empty.week.from, '2026-09-14')
    assert.deepEqual(empty.today.date, '2026-09-20')
  }
  // 今天没有记录 → 今天全 0（不是 NaN）
  const absent = h.aggregateLedger({ days: { '2026-09-19': { p: { m: { inputTokens: 1, calls: 1 } } } } }, 7, at)
  assert.equal(absent.today.costCNY, 0)
  assert.equal(absent.today.rounds, 0)
  assert.equal(absent.week.rounds, 1)
  // 日期键用本地时区
  assert.equal(h.dayKeyOf(new Date(2026, 0, 2, 3, 4, 5)), '2026-01-02')
  assert.equal(h.sumLedgerDay(null).rounds, 0)
})

test('宿主半：resolvePricing —— 自定义单价、范围夹取、非法回落默认', () => {
  // 缺省（一个都不传）→ 内置默认价，source=default（这就是老行为）
  assert.deepEqual(h.resolvePricing(), { in: 1, cacheRead: 0.02, out: 4, source: 'default' })
  assert.deepEqual(h.resolvePricing(null), { in: 1, cacheRead: 0.02, out: 4, source: 'default' })
  assert.deepEqual(h.resolvePricing({}), { in: 1, cacheRead: 0.02, out: 4, source: 'default' })
  // 查询参数天然是字符串，必须认
  assert.deepEqual(h.resolvePricing({ priceIn: '2', priceCache: '0.5', priceOut: '8' }), {
    in: 2, cacheRead: 0.5, out: 8, source: 'custom',
  })
  // 数字也认
  assert.deepEqual(h.resolvePricing({ priceIn: 2, priceCache: 0.5, priceOut: 8 }), {
    in: 2, cacheRead: 0.5, out: 8, source: 'custom',
  })
  // 只传一个：其余回落默认，整体仍算 custom
  assert.deepEqual(h.resolvePricing({ priceIn: '3' }), { in: 3, cacheRead: 0.02, out: 4, source: 'custom' })
  // 空串 / 空白 / 非数字 / NaN / 无穷 / 越界 → 回落默认；全都非法时 source=default
  const invalid = [
    { priceIn: '' }, { priceIn: '   ' }, { priceIn: 'abc' }, { priceIn: '1abc' },
    { priceIn: Number.NaN }, { priceIn: Number.POSITIVE_INFINITY }, { priceIn: Number.NEGATIVE_INFINITY },
    { priceIn: -1 }, { priceIn: -0.0001 }, { priceIn: 1000.01 }, { priceIn: '1e9' },
    { priceIn: null }, { priceIn: undefined }, { priceIn: {} }, { priceIn: [] }, { priceIn: true },
    { priceCache: 'x' }, { priceOut: 'x' },
  ]
  for (const raw of invalid) {
    assert.deepEqual(h.resolvePricing(raw), { in: 1, cacheRead: 0.02, out: 4, source: 'default' }, `应回落默认：${JSON.stringify(raw)}`)
  }
  // 边界值：0 是合法价（等于白送），只有负数和 >1000 才算越界
  assert.deepEqual(h.resolvePricing({ priceIn: '0' }), { in: 0, cacheRead: 0.02, out: 4, source: 'custom' })
  assert.equal(h.resolvePricing({ priceIn: '1000' }).in, 1000)
  assert.equal(h.resolvePricing({ priceIn: '1000' }).source, 'custom')
  // 小数照收，不做四舍五入
  assert.deepEqual(h.resolvePricing({ priceIn: '1.234567' }).in, 1.234567)
})

test('宿主半：reconcileGap —— 与台账对账的差额比例 + 除零保护', () => {
  assert.deepEqual(h.reconcileGap(3.1575, 3.1575), { computedCNY: 3.1575, ledgerCostCNY: 3.1575, gapRatio: 0 })
  assert.deepEqual(h.reconcileGap(2, 1), { computedCNY: 2, ledgerCostCNY: 1, gapRatio: 1 })
  // 差额取绝对值：算少了也是 gap
  assert.deepEqual(h.reconcileGap(0.5, 1), { computedCNY: 0.5, ledgerCostCNY: 1, gapRatio: 0.5 })
  assert.equal(h.reconcileGap(1, 1).gapRatio, 0)
  assert.equal(h.reconcileGap(0.3333, 0.3333).gapRatio, 0)
  assert.deepEqual(h.reconcileGap(4, 3), { computedCNY: 4, ledgerCostCNY: 3, gapRatio: h.round4(1 / 3) })
  // 台账为 0（或负 / 非数字）→ gapRatio 一律 0，绝不除零出 Infinity/NaN
  assert.deepEqual(h.reconcileGap(1, 0), { computedCNY: 1, ledgerCostCNY: 0, gapRatio: 0 })
  assert.deepEqual(h.reconcileGap(0, 0), { computedCNY: 0, ledgerCostCNY: 0, gapRatio: 0 })
  assert.deepEqual(h.reconcileGap(1, -5), { computedCNY: 1, ledgerCostCNY: -5, gapRatio: 0 })
  assert.deepEqual(h.reconcileGap('x', Number.NaN), { computedCNY: 0, ledgerCostCNY: 0, gapRatio: 0 })
  assert.deepEqual(h.reconcileGap(undefined, null), { computedCNY: 0, ledgerCostCNY: 0, gapRatio: 0 })
  // 两个数都保留 4 位小数，比例也是 4 位
  assert.deepEqual(h.reconcileGap(1.00005, 0.99995), { computedCNY: 1.0001, ledgerCostCNY: 1, gapRatio: h.round4(0.0001) })
})

test('宿主半：costBody —— 自定义单价算钱 + pricing/reconcile 字段', () => {
  const at = Date.now()
  const noParams = h.costBody('cost-session-1', 7, at)
  // 不带参数：新增字段存在，原来的字段名与口径一个都不变
  assert.deepEqual(noParams.pricing, { in: 1, cacheRead: 0.02, out: 4, source: 'default' })
  assert.deepEqual(noParams.unit, { uncachedPerM: 1, cacheReadPerM: 0.02, outputPerM: 4 })
  for (const key of ['sessionId', 'source', 'sessionSource', 'unit', 'session', 'today', 'week', 'top', 'note']) {
    assert.ok(Object.prototype.hasOwnProperty.call(noParams, key), `老字段不能少：${key}`)
  }
  // 不带参数时，session 的钱必须还是"按内置价算"的那一份口径
  assert.equal(noParams.session.costCNY, h.costCNYOf(noParams.session.uncached, noParams.session.cacheRead, noParams.session.output))
  // reconcile 与 today/week 一样都是真实台账数据，只做口径检查（不写死数值）
  assert.deepEqual(Object.keys(noParams.reconcile).sort(), ['computedCNY', 'gapRatio', 'ledgerCostCNY'])
  // computedCNY = 扫描到的全部会话按本次生效单价加总（与 top 排行同一批数据、同一份单价）
  assert.equal(noParams.reconcile.computedCNY, h.sumSessionCosts(h.scanSessionCosts(), noParams.pricing))
  assert.ok(Number.isFinite(noParams.reconcile.computedCNY))
  // ledgerCostCNY 就是台账自带的 cost（week 或 today 那一份，取决于台账覆盖的天数）
  assert.ok(
    noParams.reconcile.ledgerCostCNY === noParams.week.ledgerCostCNY
    || noParams.reconcile.ledgerCostCNY === noParams.today.ledgerCostCNY,
  )
  assert.ok(Number.isFinite(noParams.reconcile.gapRatio) && noParams.reconcile.gapRatio >= 0)
  assert.ok(Number.isFinite(noParams.today.costCNY))

  // 带参数：四处金额（session / today / week）都用同一份自定义价
  const custom = h.costBody('cost-session-1', 7, at, { priceIn: '2', priceCache: '3', priceOut: '5' })
  assert.deepEqual(custom.pricing, { in: 2, cacheRead: 3, out: 5, source: 'custom' })
  assert.equal(custom.today.costCNY, h.costCNYWith(noParams.today.uncached, noParams.today.cacheRead, noParams.today.output, custom.pricing))
  assert.equal(custom.week.costCNY, h.costCNYWith(noParams.week.uncached, noParams.week.cacheRead, noParams.week.output, custom.pricing))
  assert.equal(custom.session.costCNY, h.costCNYWith(noParams.session.uncached, noParams.session.cacheRead, noParams.session.output, custom.pricing))
  // 对账的"算出金额"也是按这次的自定义价（同一批会话、同一份单价），所以换价后必须跟着变
  assert.equal(custom.reconcile.computedCNY, h.sumSessionCosts(h.scanSessionCosts(), custom.pricing))
  assert.equal(custom.reconcile.ledgerCostCNY, noParams.reconcile.ledgerCostCNY)   // 台账一侧与单价无关
  // token 用量不受单价影响
  assert.equal(custom.session.uncached, noParams.session.uncached)
  assert.equal(custom.today.uncached, noParams.today.uncached)
  // rankSessionCosts 的第三参就是这份单价：同一个会话换个价，钱跟着变
  const one = [{ sessionId: 'aaaaaaaa-1', title: '一条会话', uncached: 1000000, cacheRead: 1000000, output: 1000000 }]
  assert.deepEqual(h.rankSessionCosts(one, 5, custom.pricing), [
    { sessionId: 'aaaaaaaa-1', title: '一条会话', costCNY: 10 },   // 2 + 3 + 5
  ])

  // 非法单价 → 与不带参数完全一致
  const bad = h.costBody('cost-session-1', 7, at, { priceIn: 'nope' })
  assert.equal(bad.pricing.source, 'default')
  assert.equal(bad.today.costCNY, noParams.today.costCNY)
  assert.equal(bad.week.costCNY, noParams.week.costCNY)
  assert.equal(bad.session.costCNY, noParams.session.costCNY)
  assert.deepEqual(bad.top, noParams.top)
})

/* ─── 交接落盘接口 ───────────────────────────────────────────────────── */

test('宿主半：parseHandoffFilename —— 只接受纯文件名', () => {
  assert.deepEqual(h.parseHandoffFilename(undefined), { ok: true, name: 'HANDOFF.md' })
  assert.deepEqual(h.parseHandoffFilename(null), { ok: true, name: 'HANDOFF.md' })
  assert.deepEqual(h.parseHandoffFilename(''), { ok: true, name: 'HANDOFF.md' })
  assert.deepEqual(h.parseHandoffFilename('HANDOFF.md'), { ok: true, name: 'HANDOFF.md' })
  assert.deepEqual(h.parseHandoffFilename('  交接-2026-09-20.md  '), { ok: true, name: '交接-2026-09-20.md' })
  assert.deepEqual(h.parseHandoffFilename('note.txt'), { ok: true, name: 'note.txt' })

  const bad = [
    '   ',                     // 只有空白
    'a/b.md', 'a\\b.md',       // 路径分隔符
    '/', '\\',                 // 纯分隔符
    '..', 'x..y.md',           // 上级目录
    '..\\x.md', '../x.md',
    'C:\\evil.md', 'C:evil.md', 'a:b.md',   // 盘符 / 冒号
    'x*y.md', 'x?y.md', 'x"y.md', 'x<y.md', 'x>y.md', 'x|y.md',
    'x\u0000y.md', 'x\u001fy.md',           // 控制字符
    'x.',                                   // Windows 会悄悄改掉（首尾空白已 trim，故只试尾点）
    'a'.repeat(129),                        // 超长
    123, {}, [],                            // 不是字符串
  ]
  for (const name of bad) {
    const out = h.parseHandoffFilename(name)
    assert.equal(out.ok, false, `应被拒绝：${JSON.stringify(name)}`)
    assert.equal(typeof out.error, 'string')
    assert.ok(out.error.length > 0)
  }
  assert.equal(h.parseHandoffFilename('a'.repeat(128)).ok, true)
})

test('宿主半：resolveHandoffPath —— 绝对路径 + 严格落在 cwd 内', () => {
  const cwd = process.platform === 'win32' ? 'E:\\harness' : '/tmp/harness'
  const ok = h.resolveHandoffPath(cwd, 'HANDOFF.md')
  assert.equal(ok.ok, true)
  assert.equal(ok.root, cwd)
  assert.equal(ok.name, 'HANDOFF.md')
  assert.equal(ok.path, `${cwd}${process.platform === 'win32' ? '\\' : '/'}HANDOFF.md`)
  assert.equal(h.resolveHandoffPath(cwd).name, 'HANDOFF.md')   // 缺省文件名
  assert.ok(ok.path.startsWith(ok.root))
  assert.ok(ok.path.endsWith('HANDOFF.md'))
  // 结尾多余分隔符也归一
  const trailing = h.resolveHandoffPath(`${cwd}${process.platform === 'win32' ? '\\' : '/'}`, 'x.md')
  assert.equal(trailing.ok, true)
  assert.equal(trailing.root, cwd)

  // cwd 不是绝对路径 / 不是字符串 / 空
  for (const bad of ['harness', '.', '..', '', '   ', null, undefined, 123, {}]) {
    const out = h.resolveHandoffPath(bad, 'HANDOFF.md')
    assert.equal(out.ok, false, `应被拒绝的 cwd：${JSON.stringify(bad)}`)
    assert.match(out.error, /绝对路径/)
  }
  // 文件名不合法时整个解析失败
  for (const name of ['..\\x.md', '/x.md', 'C:\\x.md', '..', '   ']) {
    assert.equal(h.resolveHandoffPath(cwd, name).ok, false, `应被拒绝的 filename：${name}`)
  }
})

test('宿主半：validateHandoffText —— 非空 + 200000 字节上限', () => {
  assert.deepEqual(h.validateHandoffText('hello'), { ok: true, bytes: 5 })
  assert.deepEqual(h.validateHandoffText('你好'), { ok: true, bytes: 6 })   // UTF-8 中文 3 字节
  assert.deepEqual(h.validateHandoffText('a'.repeat(200000)), { ok: true, bytes: 200000 })
  assert.equal(h.validateHandoffText('a'.repeat(200001)).ok, false)
  assert.equal(h.validateHandoffText('你'.repeat(66666)).ok, true)          // 199998 字节
  assert.equal(h.validateHandoffText('你'.repeat(66667)).ok, false)         // 200001 字节
  for (const bad of ['', '   ', '\n\t', null, undefined, 123, {}]) {
    const out = h.validateHandoffText(bad)
    assert.equal(out.ok, false, `应被拒绝的 text：${JSON.stringify(bad)}`)
  }
  // 自定义上限
  assert.equal(h.validateHandoffText('abc', 2).ok, false)
  assert.equal(h.validateHandoffText('abc', 3).ok, true)
  assert.match(h.validateHandoffText('a'.repeat(10), 5).error, /太大/)
})

// ── v1.20.0：宿主半算"节奏"（实测速率 + 按轮涨量）────────────────────────────
// 背景：这两格以前只能靠浏览器半"本页亲眼看过的读数变化"，切会话/刷新后账本从空开始，
// 且相邻跃升常常只差几十毫秒（跨度恒不达标）→ 刚打开会话时必然是空的。
// 现在改成读会话投影的 requests[]（每条带 turn/time/prompt），所以这些测试锁的就是
// "窗口口径的速率"与"轮末之差算每轮涨量"这两条规则。

test('宿主半：parsePace —— 速率按窗口首末点、每轮涨量按轮末之差', () => {
  const t0 = 1700000000000
  const timeline = {
    requests: [
      { time: t0, turn: 1, step: 1, prompt: 100000 },
      { time: t0 + 30000, turn: 1, step: 2, prompt: 120000 },
      { time: t0 + 120000, turn: 2, step: 1, prompt: 150000 },
      { time: t0 + 180000, turn: 2, step: 2, prompt: 200000 },
      // 第 3 轮开头降了（上下文被裁），轮末才涨回去 —— 只取轮末才不会算出负增长
      { time: t0 + 240000, turn: 3, step: 1, prompt: 190000 },
      { time: t0 + 300000, turn: 3, step: 2, prompt: 230000 },
    ],
  }
  const now = t0 + 300000
  const pace = h.parsePace(timeline, now)
  assert.equal(pace.source, 'projcache')
  assert.equal(pace.requestCount, 6)
  assert.equal(pace.turnCount, 3)
  assert.equal(pace.lastRequestAt, now)
  assert.equal(pace.idleMs, 0)
  // 速率：(230000 − 100000) / 5 分钟 = 26000 tok/分
  assert.equal(pace.rateFrom, 'window')
  assert.equal(pace.rateSpanMs, 300000)
  assert.equal(pace.rateSamples, 6)
  assert.equal(Math.round(pace.ratePerMinute), 26000)
  // 每轮涨量：轮末 120000 → 200000 → 230000
  assert.deepEqual(pace.rises, [80000, 30000])
  assert.equal(pace.avgPerTurn, 55000)
  assert.equal(pace.lastRise, 30000)
  // 每轮耗时：150000 与 120000 的均值
  assert.equal(pace.msPerTurn, 135000)
  // 最后一轮的步数（这一轮走了 2 步）
  assert.equal(pace.lastTurnSteps, 2)
})

test('宿主半：parsePace —— 脏数据 / 跨度不足 / 读数下降都不编数字', () => {
  assert.equal(h.parsePace(null, 1).source, 'none')
  assert.equal(h.parsePace({}, 1).source, 'none')
  assert.equal(h.parsePace({ requests: 'x' }, 1).source, 'none')
  assert.equal(h.parsePace({ requests: [null, 7, { time: 0, prompt: 0 }] }, 1).source, 'none')
  assert.equal(h.emptyPace().ratePerMinute, null)
  assert.equal(h.emptyPace().source, 'none')

  const t0 = 1700000000000
  // 两条只差 3 秒（同一次请求簇）→ 跨度不足 20 秒，不给速率
  const tight = h.parsePace({
    requests: [{ time: t0, turn: 1, prompt: 1000 }, { time: t0 + 3000, turn: 1, prompt: 9000 }],
  }, t0 + 3000)
  assert.equal(tight.ratePerMinute, null)
  assert.equal(tight.rateSpanMs, 3000)

  // 读数下降（工具结果被裁 / 压缩）不算涨量，也不给速率
  const down = h.parsePace({
    requests: [{ time: t0, turn: 1, prompt: 90000 }, { time: t0 + 60000, turn: 2, prompt: 50000 }],
  }, t0 + 60000)
  assert.equal(down.ratePerMinute, null)
  assert.deepEqual(down.rises, [])
  assert.equal(down.avgPerTurn, null)
  assert.equal(down.lastRise, null)
  // 时间倒挂：按 time 升序重排，不能把"后写的"当最后一条
  const reversed = h.parsePace({
    requests: [{ time: t0 + 60000, turn: 2, prompt: 40000 }, { time: t0, turn: 1, prompt: 10000 }],
  }, t0 + 60000)
  assert.equal(reversed.lastRequestAt, t0 + 60000)
  assert.equal(Math.round(reversed.ratePerMinute), 30000)
})

test('宿主半：parsePace —— 45 分钟窗内不足两条时退回最后两条并标注来源', () => {
  const t0 = 1700000000000
  const stale = {
    requests: [
      { time: t0, turn: 1, prompt: 10000 },
      { time: t0 + 60000, turn: 2, prompt: 40000 },
    ],
  }
  const now = t0 + 3 * 3600 * 1000
  const pace = h.parsePace(stale, now)
  assert.equal(pace.rateFrom, 'tail')
  assert.equal(pace.rateSamples, 0)
  assert.equal(Math.round(pace.ratePerMinute), 30000)
  assert.equal(pace.idleMs, 3 * 3600 * 1000 - 60000)
  // 关掉窗口（窗口极小）时同样走 tail 分支，行为一致
  assert.equal(h.parsePace(stale, now, 1000).rateFrom, 'tail')
})

test('宿主半：parsePace —— 轮末被裁剪时用轮内峰值兜底算"上一轮涨量"', () => {
  const t0 = 1700000000000
  // 第 2 轮涨到 260000 又被裁回 150000（工具结果被丢），轮末之差是 −50000
  const pace = h.parsePace({
    requests: [
      { time: t0, turn: 1, step: 1, prompt: 200000 },
      { time: t0 + 60000, turn: 2, step: 1, prompt: 260000 },
      { time: t0 + 90000, turn: 2, step: 2, prompt: 150000 },
    ],
  }, t0 + 90000)
  assert.equal(pace.turnCount, 2)
  assert.equal(pace.lastTurnSteps, 2)
  // 轮末净增是负的 → 退回"轮内峰值 260000 − 上一轮末 200000 = 60000"
  assert.equal(pace.lastRise, 60000)
  // 但"每轮涨量均值"只认真实净增，这里一条正涨量都没有
  assert.deepEqual(pace.rises, [])
  assert.equal(pace.avgPerTurn, null)
})

test('宿主半：parseContextTimeline 带出 pace 字段（老投影没有请求记录时是空读数）', () => {
  const out = h.parseContextTimeline(projcacheDoc(), 'abc', '', 1700000000000)
  assert.equal(out.pace.source, 'none')
  assert.equal(out.pace.ratePerMinute, null)
  assert.equal(out.pace.avgPerTurn, null)
  const missing = h.parseContextTimeline(null, 'abc', '缺失')
  assert.equal(missing.pace.source, 'none')
  assert.equal(missing.pace.requestCount, 0)
  assert.equal(missing.pace.lastRequestAt, null)
})
