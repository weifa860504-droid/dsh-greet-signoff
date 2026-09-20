/**
 * 浏览器半的单元测试：把 client.js 当模块加载进 Node（用最小 DOM 桩），
 * 直接测它内部那些"纯函数"（通过模块底部导出的 __test 钩子拿到）。
 *
 * 用法：node --test test/
 *
 * 之所以要 DOM 桩：client.js 的模块级代码会用到 document.createElement（量表情字形宽度）
 * 与 window.localStorage（读进度条外观偏好），但这些都不是我们要测的东西。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(join(ROOT, 'client.js'), 'utf8')

/** 最小 DOM 桩：够模块级代码跑完，不假装自己能渲染。 */
function makeStubs() {
  const noop = () => {}
  const fakeElement = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false },
    childElementCount: 0, children: [], textContent: '', innerHTML: '',
    appendChild: (child) => child, removeChild: noop, remove: noop, setAttribute: noop,
    getAttribute: () => null, hasAttribute: () => false, addEventListener: noop,
    removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    getContext: () => null,
  })
  const document = {
    head: fakeElement(), body: fakeElement(),
    createElement: fakeElement,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop,
    visibilityState: 'visible',
  }
  const window = {
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop, removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    dispatchEvent: noop,
  }
  const requireStub = () => ({
    createElement: (type, props, ...children) => ({
      type,
      props: Object.assign({}, props, { children: children.length <= 1 ? children[0] : children }),
    }),
    memo: (c) => c,
    useState: () => [null, noop],
    useEffect: noop,
    useRef: () => ({ current: null }),
  })
  return { window, document, requireStub }
}

/** 把 client.js 的 __ModuleLoader__ 包装剥掉，当普通 CommonJS 工厂跑起来。 */
function loadClient() {
  const open = SOURCE.indexOf('factory: (require) => {')
  const close = SOURCE.lastIndexOf('return module.exports;')
  assert.ok(open > 0 && close > open, '找不到 client.js 的模块包装')
  const body = SOURCE.slice(open + 'factory: (require) => {'.length, close + 'return module.exports;'.length)
  const stubs = makeStubs()
  const factory = new Function('require', 'window', 'document', 'fetch', 'MutationObserver', body)
  return factory(stubs.requireStub, stubs.window, stubs.document, () => Promise.reject(new Error('no fetch in test')), function () {})
}

const client = loadClient()
const t = client.__test

test('client.js 暴露了测试钩子', () => {
  assert.ok(t && typeof t === 'object', '缺少 __test 导出')
  for (const name of ['normalizeFixedLine', 'foldFixedLine', 'matchLineText', 'compileWantedLine', 'resolveTemplate', 'normalize', 'validate', 'occupancyOf', 'formatTokens', 'rampColor', 'lineSimilarity', 'isPerCharAnimation', 'splitGraphemes', 'renderLineText', 'darkFromSignals', 'parseCssRgb', 'colorLuminance', 'chatCss', 'formatDuration', 'formatClock', 'tokensPerMinute', 'remainingTimeMs', 'averageTurnMs', 'budgetReading', 'formatWan', 'resolveBudgetMode', 'normalizeBudgetMode', 'budgetModeLabel', 'budgetModeHint', 'nextBudgetMode', 'pickOptions', 'formatCny']) {
    assert.equal(typeof t[name], 'function', `__test 缺少 ${name}`)
  }
})

test('normalizeFixedLine：去零宽字符、压缩空白', () => {
  assert.equal(t.normalizeFixedLine('  a\u200Bb\n\nc  '), 'ab c')
  assert.equal(t.normalizeFixedLine('\uFEFF👑 發哥 👑'), '👑 發哥 👑')
})

test('foldFixedLine：全半角、中文标点、空白、大小写、首尾装饰一律不算差异', () => {
  const a = t.foldFixedLine('👑發哥👑 發哥開口，財神跟着走💰')
  assert.equal(t.foldFixedLine('👑發哥👑 發哥開口, 財神跟着走💰'), a)
  assert.equal(t.foldFixedLine('“👑發哥👑 發哥開口，財神跟着走💰。”'), a)
  assert.equal(t.foldFixedLine('👑發哥👑　發哥開口，財神跟着走💰'), a)
  assert.equal(t.foldFixedLine('ＡＢＣ 測試'), t.foldFixedLine('abc 測試'))
})

test('matchLineText：三档行为各不相同', () => {
  const [wanted] = t.compileWantedLine('greeting', 'ABC 測試收尾', new Date())
  assert.equal(t.matchLineText('ABC 測試收尾', wanted, 'exact'), true)
  assert.equal(t.matchLineText('ABC 測試收尾。', wanted, 'exact'), false, '逐字档不该容忍尾标点')
  assert.equal(t.matchLineText('ABC 測試收尾。', wanted, 'loose'), true, '宽松档应容忍尾标点')
  assert.equal(t.matchLineText('abc 測試收尾', wanted, 'loose'), true, '宽松档应忽略大小写')
  assert.equal(t.matchLineText('ABC 測試收尾呀', wanted, 'loose'), false, '宽松档不该容忍多字')
  assert.equal(t.matchLineText('ABC 測試收尾呀', wanted, 'fuzzy'), true, '近似档应容忍一字之差')
  assert.equal(t.matchLineText('完全不相干的一句话', wanted, 'fuzzy'), false)
})

test('近似档：短句不参与近似，避免误伤', () => {
  const [short] = t.compileWantedLine('greeting', '好的', new Date())
  assert.equal(t.matchLineText('好呀', short, 'fuzzy'), false)
})

test('compileWantedLine：多行与动态变量', () => {
  const now = new Date('2026-09-18T09:30:00')
  const [single] = t.compileWantedLine('greeting', '今天 {date}', now)
  assert.equal(single.text, '今天 2026-09-18')
  assert.equal(single.multi, false)
  const multi = t.compileWantedLine('signOff', '第一行\n第二行', now)
  assert.equal(multi.length, 1)
  assert.equal(multi[0].multi, true)
  assert.equal(multi[0].segments.length, 2)
  assert.equal(multi[0].segments[0].norm, '第一行')
})

test('动态变量：daypart 会给出所有时段的候选', () => {
  const now = new Date('2026-09-18T09:30:00')
  const variants = t.templateVariants('{daypart}，发哥', now)
  assert.ok(variants.length >= 6, '应包含所有时段的候选')
  assert.ok(variants.indexOf('早上好，发哥') >= 0 || variants.indexOf('上午好，发哥') >= 0)
  assert.equal(t.resolveTemplate('{year}/{month}/{day} {weekday}', now), '2026/09/18 星期五')
  assert.equal(t.resolveTemplate('{unknown} 保持原样', now), '{unknown} 保持原样')
})

test('normalize：新字段回落、旧字段兼容、非法值被夹住', () => {
  const fresh = t.normalize({})
  assert.equal(fresh.matchMode, 'loose')
  assert.equal(fresh.onlyAssistant, true)
  assert.deepEqual(fresh.legacyLines, [])
  assert.equal(t.normalize({ looseMatch: false }).matchMode, 'exact', '旧的布尔字段要能映射')
  assert.equal(t.normalize({ matchMode: 'nonsense' }).matchMode, 'loose')
  assert.equal(t.normalize({ onlyAssistant: false }).onlyAssistant, false)
  const clamped = t.normalize({ warnPercent: 200, criticalPercent: 1, greeting: { fontSize: 999, fontWeight: 555 } })
  assert.equal(clamped.warnPercent, 99)
  assert.equal(clamped.criticalPercent, 100)
  assert.equal(clamped.greeting.fontSize, 40)
  assert.equal(clamped.greeting.fontWeight, 600, '字重应该吸附到允许档位')
  const legacy = t.normalize({ legacyLines: [{ text: '旧开场', style: 'signOff' }, { text: '   ' }, 'bad', { text: 'x'.repeat(500), style: 'nope' }] })
  assert.equal(legacy.legacyLines.length, 2, '空行与非对象应被丢掉')
  assert.equal(legacy.legacyLines[0].style, 'signOff')
  assert.equal(legacy.legacyLines[1].style, 'greeting', '未知 style 应回落到 greeting')
  assert.equal(legacy.legacyLines[1].text.length, 200, '文案应被截断到 200 字')
})

test('normalize：深色主题颜色字段会一起归一化', () => {
  const cfg = t.normalize({ greeting: { color: '#112233', colorDark: '#445566', bgColorDark: 'not-a-color' } })
  assert.equal(cfg.greeting.colorDark, '#445566')
  assert.equal(cfg.greeting.bgColorDark, 'not-a-color', '客户端只透传字符串，合法性由宿主半收紧')
})

test('validate：空行旧文案会拦住保存', () => {
  const cfg = t.normalize({ greeting: { text: 'A' }, legacyLines: [] })
  assert.equal(t.validate(cfg), null)
  cfg.legacyLines = [{ text: '  ', style: 'greeting' }]
  assert.match(String(t.validate(cfg)), /旧文案/)
})

test('occupancyOf / formatTokens', () => {
  assert.equal(t.occupancyOf(undefined), null)
  assert.equal(t.occupancyOf({ contextWindow: 0 }), null)
  assert.deepEqual(t.occupancyOf({ projectedTokens: 250000, contextWindow: 1000000 }), { percent: 25, used: 250000, capacity: 1000000 })
  assert.equal(t.occupancyOf({ pressureTokens: 500, contextWindow: 1000 }).percent, 50, 'projectedTokens 缺失时应回落到 pressureTokens')
  assert.equal(t.occupancyOf({ projectedTokens: 5000, contextWindow: 1000 }).percent, 100, '百分比上限 100')
  assert.equal(t.formatTokens(999), '999')
  assert.equal(t.formatTokens(1500), '1.5k')
  assert.equal(t.formatTokens(2453000), '2.5M')
  assert.equal(t.formatTokens(NaN), '?')
})

test('颜色：插值与色带', () => {
  assert.deepEqual(t.hexToRgb('#ff0000'), [255, 0, 0])
  const palette = ['#2fbf8f', '#e0a52a', '#d93026']
  assert.equal(t.rampColor(0, 70, 85, palette), 'rgb(47,191,143)')
  assert.equal(t.rampColor(70, 70, 85, palette), 'rgb(224,165,42)')
  assert.equal(t.rampColor(85, 70, 85, palette), 'rgb(217,48,38)')
  assert.equal(t.rampColor(200, 70, 85, palette), 'rgb(217,48,38)', '超出阈值应夹住')
  assert.equal(t.rampColor(-5, 70, 85, palette), 'rgb(47,191,143)', '低于 0 也应夹住')
  const scale = t.barScale(70, 85, palette)
  assert.match(scale, /linear-gradient/)
  assert.match(scale, /rgb\(/)
})

test('lineSimilarity / editDistance', () => {
  assert.equal(t.lineSimilarity('abc', 'abc'), 1)
  assert.ok(Math.abs(t.lineSimilarity('abc', 'abd') - 2 / 3) < 1e-12)
  assert.equal(t.lineSimilarity('', ''), 1)
  assert.equal(t.editDistance('abc', 'abc'), 0)
  assert.equal(t.editDistance('', 'abc'), 3)
  assert.equal(t.editDistance('abc', 'abd'), 1)
})

test('逐字动效：哪些动效需要逐字包 span', () => {
  assert.equal(t.isPerCharAnimation('charbounce'), true)
  assert.equal(t.isPerCharAnimation('charwave'), true)
  assert.equal(t.isPerCharAnimation('chartype'), true)
  assert.equal(t.isPerCharAnimation('charrainbow'), false, '彩虹是整行渐变，不需要包 span')
  assert.equal(t.isPerCharAnimation('bounce'), false)
  assert.equal(t.isPerCharAnimation(''), false)
})

test('splitGraphemes：emoji 与组合符号不会被拆散', () => {
  assert.deepEqual(t.splitGraphemes('abc'), ['a', 'b', 'c'])
  assert.deepEqual(t.splitGraphemes(''), [])
  // 单个 emoji（含变体选择符）算一个字
  assert.deepEqual(t.splitGraphemes('👑'), ['👑'])
  assert.deepEqual(t.splitGraphemes('👑💰'), ['👑', '💰'])
  // 带 VS16 的字符不会被拆开
  const withVs = t.splitGraphemes('❤\uFE0F好')
  assert.equal(withVs.length, 2)
  assert.equal(withVs[0], '❤\uFE0F')
  // ZWJ 家族 emoji 保持成一个字
  assert.deepEqual(t.splitGraphemes('👨\u200D👩\u200D👧'), ['👨\u200D👩\u200D👧'])
  // 组合重音并入前一个字
  assert.deepEqual(t.splitGraphemes('e\u0301x'), ['e\u0301', 'x'])
})

test('renderLineText：逐字动效返回多个 span，其余返回纯文本', () => {
  const plain = t.renderLineText({ animation: 'bounce', text: '发哥' })
  assert.equal(plain, '发哥')
  const chars = t.renderLineText({ animation: 'charbounce', text: '发哥' })
  assert.equal(Array.isArray(chars), true)
  assert.equal(chars.length, 2)
  assert.equal(chars[0].props.className, 'gs-char')
  assert.equal(chars[0].props.style['--gs-i'], '0')
  assert.equal(chars[1].props.style['--gs-i'], '1')
  assert.equal(chars[1].props.children, '哥')
})

test('isReconnectStuckText：只认连接异常提示，不误伤正文', () => {
  // DSH 自带的几种"连不上"文案（含 500ms 前进的省略号）
  assert.equal(t.isReconnectStuckText('自动重连中'), true)
  assert.equal(t.isReconnectStuckText('自动重连中...'), true)
  assert.equal(t.isReconnectStuckText('自动重连中…'), true)
  assert.equal(t.isReconnectStuckText('连接异常'), true)
  assert.equal(t.isReconnectStuckText('立即重连'), true)
  assert.equal(t.isReconnectStuckText('Reconnecting'), true)
  // 零宽字符与多余空白不影响判定
  assert.equal(t.isReconnectStuckText('  连接异常 \u200B'), true)
  // 恢复提示不算卡住
  assert.equal(t.isReconnectStuckText('连接成功'), false)
  // 正文里提到"重连"不算
  assert.equal(t.isReconnectStuckText('DSH 重启后页面会显示自动重连中，按 F5 即可'), false)
  assert.equal(t.isReconnectStuckText(''), false)
  assert.equal(t.isReconnectStuckText(undefined), false)
})

test('sanitizePool / sanitizePoolList：文案池清洗', () => {
  // 去空白、丢空行、按行保留
  assert.deepEqual(t.sanitizePoolList([' 甲 ', '', '   ', '乙']), ['甲', '乙'])
  assert.deepEqual(t.sanitizePoolList('不是数组'), [])
  assert.deepEqual(t.sanitizePoolList([1, null, '丙']), ['丙'])
  // 超长截断到 200
  const long = 'x'.repeat(260)
  assert.equal(t.sanitizePoolList([long])[0].length, 200)
  // 最多 20 句
  const many = Array.from({ length: 30 }, (_, i) => '第' + i + '句')
  assert.equal(t.sanitizePoolList(many).length, 20)
  // 整体字段：未知模式回落 random，enabled 只认 true
  const pool = t.sanitizePool({ enabled: 'yes', mode: 'weird', greeting: ['甲'], signOff: [] })
  assert.equal(pool.enabled, false)
  assert.equal(pool.mode, 'random')
  assert.deepEqual(pool.greeting, ['甲'])
  assert.deepEqual(t.sanitizePool(undefined), { enabled: false, mode: 'random', greeting: [], signOff: [] })
  assert.equal(t.sanitizePool({ enabled: true, mode: 'sequence' }).mode, 'sequence')
})

test('运行时变量：{model}/{count}/{elapsed}/{tokens} 用通配符匹配', () => {
  const re = t.runtimeVarRegex('以上，本轮 {elapsed}')
  assert.ok(re instanceof RegExp)
  assert.equal(re.test('以上，本轮 12.4s'), true)
  assert.equal(re.test('以上，本轮 820ms'), true)
  assert.equal(re.test('以上，本轮 完全换了内容也认'), true)
  assert.equal(re.test('以上，本轮'), false, '变量位置必须有内容')
  // 没有运行时变量 → 不生成正则；时间变量不算运行时变量
  assert.equal(t.runtimeVarRegex('以上，本轮 12s'), null)
  assert.equal(t.runtimeVarRegex('今天是 {date}'), null)
  // 正文里的正则元字符被安全转义
  const re2 = t.runtimeVarRegex('结果（{tokens}）')
  assert.equal(re2.test('结果（3.1k）'), true)
  assert.equal(re2.test('结果 3.1k'), false)
})

test('matchLineText：含运行时变量的固定行，三种模式都能命中', () => {
  const now = new Date('2026-09-18T12:00:00')
  const wanted = t.compileWantedLine('signOff', '以上，本轮 {elapsed} · {tokens}', now)
  assert.equal(wanted.length, 1)
  for (const mode of ['exact', 'loose', 'fuzzy']) {
    assert.equal(t.matchLineText('以上，本轮 12.4s · 3.1k', wanted[0], mode), true, mode)
    assert.equal(t.matchLineText('完全不相干的一句话', wanted[0], mode), false, mode)
  }
  // 不含运行时变量的固定行，行为不变（逐字相同档仍然严格）
  const plain = t.compileWantedLine('greeting', '你好，我是助手', now)
  assert.equal(t.matchLineText('你好，我是助手', plain[0], 'exact'), true)
  assert.equal(t.matchLineText('你好，我是助手！！', plain[0], 'exact'), false)
  assert.equal(t.matchLineText('你好，我是助手！！', plain[0], 'loose'), true)
})

test('contextAlert：阈值提醒只在该提的时候提', () => {
  // 没有读数（NaN）→ 不提醒
  assert.deepEqual(t.contextAlert(Number.NaN, 70, 85), { tone: 'ok', line: null })
  assert.deepEqual(t.contextAlert(0, 70, 85), { tone: 'ok', line: null })
  assert.deepEqual(t.contextAlert(69, 70, 85), { tone: 'ok', line: null })
  // 到黄线
  const warn = t.contextAlert(70, 70, 85)
  assert.equal(warn.tone, 'warn')
  assert.match(warn.line, /接近上限/)
  assert.match(warn.line, /总结要点/)
  // 到红线（优先级高于黄线）
  const crit = t.contextAlert(85, 70, 85)
  assert.equal(crit.tone, 'critical')
  assert.match(crit.line, /即将占满/)
  assert.equal(t.contextAlert(100, 70, 85).tone, 'critical')
  // 阈值被改成 1/2 时也应即时生效
  assert.equal(t.contextAlert(1, 1, 2).tone, 'warn')
  assert.equal(t.contextAlert(2, 1, 2).tone, 'critical')
})

test('sanitizeScenes：场景表清洗与自我嵌套防护', () => {
  const cfgA = { greeting: { text: '甲' }, signOff: { text: '乙' } }
  const clean = t.sanitizeScenes({
    active: 's1',
    items: [
      { id: 's1', name: ' 工作 ', config: cfgA },
      { id: 'BAD ID', name: '非法', config: cfgA },   // id 不合法 → 丢掉
      { id: 's1', name: '重复', config: cfgA },        // 重复 id → 丢掉
      { id: 's2', name: '', config: cfgA }             // 空名字 → 回落 id
    ]
  })
  assert.equal(clean.items.length, 2)
  assert.equal(clean.items[0].name, '工作')
  assert.equal(clean.items[1].name, 's2')
  assert.equal(clean.active, 's1')
  // active 指向不存在的场景 → 清空
  assert.equal(t.sanitizeScenes({ active: 's9', items: [] }).active, '')
  // 场景里的 config 会被归一化，且不会因为嵌套 scenes 而递归
  const nested = t.sanitizeScenes({ active: '', items: [{ id: 's1', name: 'x', config: { greeting: { text: '丙' }, scenes: { items: [{ id: 's2', name: 'y' }] } } }] })
  assert.equal(nested.items[0].config.greeting.text, '丙')
  assert.equal(nested.items[0].config.scenes, undefined)
  // 超过上限会被截断
  const many = { active: '', items: Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, name: 'n' + i, config: cfgA })) }
  assert.equal(t.sanitizeScenes(many).items.length, 8)
})

test('sanitizeWorkspaceBindings：工作区绑定的清洗与路径归一', () => {
  const clean = t.sanitizeWorkspaceBindings({
    enabled: true,
    items: [
      { path: ' E:\\harness ', greeting: '干活开场', signOff: '干活收尾' },
      { path: '', greeting: '空路径', signOff: '' },                  // 路径空 → 丢
      { path: 'D:\\x', greeting: '', signOff: '' },                    // 两行都空 → 丢
      { path: 'D:\\y', greeting: '只有开场', signOff: '' }              // 只有开场 → 保留
    ]
  })
  assert.equal(clean.enabled, true)
  assert.equal(clean.items.length, 2)
  assert.equal(clean.items[0].path, 'E:\\harness')
  assert.equal(clean.items[0].greeting, '干活开场')
  assert.equal(clean.items[1].signOff, '')
  // 路径归一：大小写、斜杠、末尾分隔符
  assert.equal(t.pathKey('E:/HARNESS/'), 'e:\\harness')
  assert.equal(t.pathKey('E:\\harness\\\\'), 'e:\\harness')
  assert.equal(t.pathKey(undefined), '')
  // 缺字段 → 默认关闭 + 空表
  assert.deepEqual(t.sanitizeWorkspaceBindings(undefined), { enabled: false, items: [] })
  assert.equal(t.sanitizeWorkspaceBindings({ enabled: 'yes' }).enabled, false)
})

test('lineStyleSource：复制外观时不带走文案与图片', () => {
  const line = {
    text: '开场白', image: 'data:image/png;base64,AAA', imageHeight: 22,
    fontSize: 18, fontWeight: 700, color: '#ff0000', shape: 'pill', animation: 'bounce',
  }
  const style = t.lineStyleSource(line)
  assert.equal(style.text, undefined)
  assert.equal(style.image, undefined)
  assert.equal(style.fontSize, 18)
  assert.equal(style.color, '#ff0000')
  assert.equal(style.shape, 'pill')
  assert.equal(style.animation, 'bounce')
  // 只带走"传入行里真的有"的样式字段（真实配置里的行是归一化过的，字段齐全）
  assert.deepEqual(Object.keys(style).sort(), ['animation', 'color', 'fontSize', 'fontWeight', 'imageHeight', 'shape'])
  // 目标行套用后文案不变
  const target = { text: '收尾语', fontSize: 12 }
  const merged = Object.assign({}, target, style)
  assert.equal(merged.text, '收尾语')
  assert.equal(merged.fontSize, 18)
})


test('深浅判定（方案 C）：四条证据任一成立就算深色', () => {
  assert.equal(t.darkFromSignals({}), false)
  assert.equal(t.darkFromSignals(undefined), false)
  assert.equal(t.darkFromSignals({ bodyDarkAttr: true }), true)
  assert.equal(t.darkFromSignals({ colorScheme: 'dark' }), true)
  // dark-only 皮肤常见写法：只声明 color-scheme，不加 body 属性
  assert.equal(t.darkFromSignals({ colorScheme: 'light dark' }), true)
  assert.equal(t.darkFromSignals({ colorScheme: 'light' }), false)
  assert.equal(t.darkFromSignals({ colorScheme: '' }), false)
  assert.equal(t.darkFromSignals({ prefersDark: true }), true)
  assert.equal(t.darkFromSignals({ bgLuminance: 0.08 }), true)
  assert.equal(t.darkFromSignals({ bgLuminance: 0.92 }), false)
  assert.equal(t.darkFromSignals({ bgLuminance: null }), false)
  assert.equal(t.darkFromSignals({ colorScheme: 'light', prefersDark: false, bgLuminance: 0.9 }), false)
})

test('颜色解析与亮度：rgb/rgba/hex，全透明等于看不出底色', () => {
  assert.deepEqual(t.parseCssRgb('#fff'), [255, 255, 255])
  assert.deepEqual(t.parseCssRgb('#0f172a'), [15, 23, 42])
  assert.deepEqual(t.parseCssRgb('rgb(17 24 39)'), [17, 24, 39])
  assert.deepEqual(t.parseCssRgb('rgb(17, 24, 39)'), [17, 24, 39])
  assert.equal(t.parseCssRgb('rgba(0, 0, 0, 0)'), null)
  assert.equal(t.parseCssRgb('transparent'), null)
  assert.equal(t.parseCssRgb(''), null)
  assert.equal(t.colorLuminance('#000000'), 0)
  assert.ok(Math.abs(t.colorLuminance('#ffffff') - 1) < 1e-9, '白色亮度应为 1（浮点误差内）')
  assert.equal(t.colorLuminance('rgba(0,0,0,0)'), null)
  assert.ok(t.colorLuminance('#0f172a') < 0.5, '深色底应判为暗')
  assert.ok(t.colorLuminance('#f8fafc') > 0.5, '浅色底应判为亮')
})

test('chatCss：深色档同时挂 body 属性与 html[data-gs-dark]', () => {
  const config = t.normalize({
    greeting: { text: '开场', color: '#e0721a', colorDark: '#ffb545' },
    signOff: { text: '收尾' },
  })
  const css = t.chatCss(config)
  assert.ok(css.indexOf('body[data-ds-dark-theme] .gs-chat-greeting') >= 0, css)
  assert.ok(css.indexOf('html[data-gs-dark="1"] .gs-chat-greeting') >= 0, css)
  assert.ok(css.indexOf('#ffb545') >= 0, '深色档颜色应在规则里')
  // 没配深色值的那一行不生成深色规则（留空仍回落浅色档）
  assert.equal(css.indexOf('html[data-gs-dark="1"] .gs-chat-signoff'), -1)
})

test('时长与时刻格式化', () => {
  assert.equal(t.formatDuration(45 * 1000), '45 秒')
  assert.equal(t.formatDuration(12 * 60000), '12 分')
  assert.equal(t.formatDuration(63 * 60000), '1 小时 3 分')
  assert.equal(t.formatDuration(120 * 60000), '2 小时')
  assert.equal(t.formatDuration(-1), '—')
  assert.equal(t.formatDuration(Number.NaN), '—')
  assert.equal(t.formatClock(new Date('2026-09-20T09:05:00').getTime()), '09:05')
  assert.equal(t.formatClock(0), '')
})

test('消耗速率与剩余时间：数据不够时宁可不给估计', () => {
  assert.equal(t.tokensPerMinute([]), null)
  assert.equal(t.tokensPerMinute([{ t: 0, used: 1000 }]), null)
  assert.equal(t.tokensPerMinute([{ t: 0, used: 1000 }, { t: 30000, used: 5000 }]), null, '跨度不足 1 分钟不算')
  assert.equal(t.tokensPerMinute([{ t: 0, used: 5000 }, { t: 120000, used: 4000 }]), null, '读数没净增长不算')
  assert.equal(t.tokensPerMinute([{ t: 0, used: 1000 }, { t: 120000, used: 5000 }]), 2000)
  // 有实测速率 → 按速率
  assert.equal(t.remainingTimeMs(100000, 2000, null, null), 3000000)
  // 没速率 → 退回"轮数 × 每轮耗时"
  assert.equal(t.remainingTimeMs(100000, null, 5, 60000), 300000)
  // 都没有 → null（不编数字）
  assert.equal(t.remainingTimeMs(100000, null, null, null), null)
  assert.equal(t.remainingTimeMs(0, 2000, null, null), 0)
  assert.equal(t.averageTurnMs([0]), null)
  assert.equal(t.averageTurnMs([0, 60000, 180000]), 90000)
})


test('预算口径：100% = 你自己设的红线（这才是"该开新会话了"的判据）', () => {
  const r = t.budgetReading(248930, 75000, 110000)
  assert.equal(r.tone, 'critical')
  assert.equal(r.percent, 226)
  assert.equal(r.over, true)
  assert.ok(Math.abs(r.ratio - 2.2629) < 0.01, '超了 2.26 倍')
  assert.equal(r.warnPercent, 68, '黄线换算成百分比 = 75000/110000')
  // 黄线区间：到了提醒线但没到必须换的线
  const warn = t.budgetReading(80000, 75000, 110000)
  assert.equal(warn.tone, 'warn')
  assert.equal(warn.percent, 73)
  // 安全区
  assert.equal(t.budgetReading(30000, 75000, 110000).tone, 'ok')
  // 还没读数：不报警、不显示 0% 之外的东西
  assert.equal(t.budgetReading(null, 75000, 110000).tone, 'ok')
  assert.equal(t.budgetReading(null, 75000, 110000).percent, 0)
  // 红线填得不合理（不比黄线大）时自动兜底成黄线的 1.5 倍
  assert.equal(t.budgetReading(0, 100000, 50000).critical, 150000)
  // 正好压在红线上算超线
  assert.equal(t.budgetReading(110000, 75000, 110000).tone, 'critical')
})

test('预算模式：三个入口都还在（源码级防误删）', () => {
  // ① 进度条小胶囊 ② 横幅按钮 ③ 设置页档位按钮
  assert.ok(SOURCE.includes('gs-mode-pill'), '① 进度条小胶囊的样式/类名不见了')
  assert.ok(SOURCE.includes('gs-dock-mode'), '① 进度条小胶囊的容器不见了')
  assert.ok(SOURCE.includes('切大任务'), '② 横幅上的「切大任务」按钮不见了')
  assert.ok(SOURCE.includes('跟随默认预算'), '② 横幅上的「跟随默认预算」按钮不见了')
  assert.ok(SOURCE.includes('"预算模式"'), '③ 设置页的「预算模式」档位不见了')
  assert.ok(SOURCE.includes('gs.signoff.mode.'), '本会话临时档的存储键不见了')
})

test('token 的中文直观写法', () => {
  assert.equal(t.formatWan(248930), '24.9 万')
  assert.equal(t.formatWan(110000), '11 万')
  assert.equal(t.formatWan(75000), '7.5 万')
  assert.equal(t.formatWan(3200), '3.2k')
  assert.equal(t.formatWan(Number.NaN), '?')
})

test('预算模式（大任务模式）：三档预设 + 自定义，优先级 本会话 > 全局 > 默认', () => {
  // 什么都没设 → 内置默认「日常」7.5 万 / 11 万
  const d = t.resolveBudgetMode(undefined, '', 75000, 110000)
  assert.equal(d.mode, 'daily')
  assert.equal(d.scope, 'default')
  assert.equal(d.warn, 75000)
  assert.equal(d.critical, 110000)
  // 全局档「大任务」：15 万 / 20 万
  const big = t.resolveBudgetMode('big', '', 75000, 110000)
  assert.equal(big.mode, 'big')
  assert.equal(big.scope, 'global')
  assert.equal(big.warn, 150000)
  assert.equal(big.critical, 200000)
  // 全局档「省着聊」：5 万 / 7.5 万（手填的数字被忽略）
  assert.equal(t.resolveBudgetMode('save', '', 123, 456).critical, 75000)
  // 本会话临时档压过全局档
  const s = t.resolveBudgetMode('save', 'big', 75000, 110000)
  assert.equal(s.mode, 'big')
  assert.equal(s.scope, 'session')
  assert.equal(s.warn, 150000)
  // 自定义档用手填的两个数
  const c = t.resolveBudgetMode('custom', '', 60000, 90000)
  assert.equal(c.custom, true)
  assert.equal(c.warn, 60000)
  assert.equal(c.critical, 90000)
  // 手填写坏了（红线不比黄线大）→ 兜底成黄线的 1.5 倍
  assert.equal(t.resolveBudgetMode('custom', '', 100000, 50000).critical, 150000)
  // 认不出来的档位（手改坏了/旧版本存的）当没设置
  assert.equal(t.resolveBudgetMode('nonsense', 'also-bad', 75000, 110000).mode, 'daily')
  assert.equal(t.normalizeBudgetMode('big'), 'big')
  assert.equal(t.normalizeBudgetMode(''), '')
  assert.equal(t.normalizeBudgetMode(undefined), '')
})

test('预算模式：胶囊点一下轮转「日常 → 大任务 → 省着聊 → 跟随默认」', () => {
  assert.equal(t.nextBudgetMode('daily'), 'big')
  assert.equal(t.nextBudgetMode('big'), 'save')
  assert.equal(t.nextBudgetMode('save'), '')
  assert.equal(t.nextBudgetMode(''), 'daily')
  assert.equal(t.nextBudgetMode('custom'), 'daily')
  assert.equal(t.nextBudgetMode('nonsense'), 'daily')
  assert.equal(t.budgetModeLabel('big'), '大任务')
  assert.equal(t.budgetModeLabel('nope'), '日常')
  assert.ok(t.budgetModeHint('save').indexOf('5 万') >= 0, '省着聊的说明里有两条线')
  assert.equal(t.budgetModes.length, 4)
  assert.equal(t.budgetModeCycle.length, 4)
})

/* ── v1.14.0：设置页精简 + 花费 / 上下文 ───────────────────────────── */

test('长尾选项：默认只列精选，但当前正在用的那一项永远保留', () => {
  const all = [
    { value: 'a', label: 'A' }, { value: 'b', label: 'B' },
    { value: 'c', label: 'C' }, { value: 'd', label: 'D' },
  ]
  const prime = ['a', 'b']
  assert.deepEqual(t.pickOptions(all, prime, false, 'a').map((x) => x.value), ['a', 'b'])
  // 当前用的是冷门项：必须给它留着，否则下拉会显示成别的档，看起来像设置被改了
  assert.deepEqual(t.pickOptions(all, prime, false, 'd').map((x) => x.value), ['a', 'b', 'd'])
  // "全部"就是把原表还回来，而且是副本（不共享引用）
  const full = t.pickOptions(all, prime, true, 'a')
  assert.equal(full.length, 4)
  assert.notEqual(full, all)
})

test('长尾选项：精选表真的是"少"的，且各自没有重复项', () => {
  for (const list of [t.primeAnimations, t.primeSchemes, t.primeMarkers]) {
    assert.ok(list.length <= 8, '精选不该超过 8 项')
    assert.equal(new Set(list).size, list.length, '精选表里有重复项')
  }
})

test('金额写法：分、角、元都读得出来，坏值不炸', () => {
  assert.equal(t.formatCny(0.0023), '<¥0.01')
  assert.equal(t.formatCny(0.006), '¥0.006')
  assert.equal(t.formatCny(0.4), '¥0.40')
  assert.equal(t.formatCny(0.42), '¥0.42')
  assert.equal(t.formatCny(1.234), '¥1.23')
  assert.equal(t.formatCny(0), '¥0')
  assert.equal(t.formatCny(-3), '¥0')
  assert.equal(t.formatCny(Number.NaN), '¥0')
  assert.equal(t.formatCny(undefined), '¥0')
})

test('旧文案兼容：上限从 30 收到 8（一次性兜底用不了那么多）', () => {
  assert.equal(t.legacyLinesMax, 8)
  const many = Array.from({ length: 20 }, (_, i) => ({ text: '旧行 ' + i, style: 'greeting' }))
  assert.equal(t.sanitizeLegacyLines(many).length, 8)
  assert.equal(t.sanitizeLegacyLines(many)[7].text, '旧行 7')
})

test('v1.15.0 三格读数（配色 A 语义状态色 + C 数字胶囊底）：颜色随状态走，没数据就写 —', () => {
  const palette = ['#2da44e', '#d99b1a', '#d93026']
  const safe = t.dockKpiCells({
    hasReading: true, occupancyText: '4.6 万', limitText: '/ 11 万',
    costText: '0.061', elapsedText: '3 分', tone: 'ok', palette,
  })
  assert.equal(safe.length, 3, '永远是三格')
  assert.deepEqual(safe.map((c) => c.label), ['上下文占用', '本条会话花费', '已聊时长'])
  // 配色 A：占用那格的颜色就是状态本身
  assert.equal(safe[0].color, '#2da44e')
  assert.equal(safe[0].value, '4.6 万')
  assert.equal(safe[0].suffix, '/ 11 万')
  // 配色 C：数字后面垫一层同色淡底
  assert.equal(safe[0].background, 'rgba(45,164,78,0.14)')
  // 花费固定财神金、时长固定蓝
  assert.equal(safe[1].value, '≈0.061')
  assert.equal(safe[1].color, '#b8860b')
  assert.equal(safe[2].value, '3 分')
  assert.equal(safe[2].color, '#2563eb')

  const warn = t.dockKpiCells({ hasReading: true, occupancyText: '8.6 万', limitText: '/ 11 万', tone: 'warn', palette })
  assert.equal(warn[0].color, '#d99b1a')
  const crit = t.dockKpiCells({ hasReading: true, occupancyText: '10.4 万', limitText: '/ 11 万', tone: 'critical', palette })
  assert.equal(crit[0].color, '#d93026')
  assert.equal(crit[0].background, 'rgba(217,48,38,0.14)')
  // 深浅主题：胶囊底更透一点、金/蓝换亮一档（暗底上才看得清）
  const dark = t.dockKpiCells({
    hasReading: true, occupancyText: '4.6 万', limitText: '/ 11 万',
    costText: '0.061', elapsedText: '3 分', tone: 'ok', palette, dark: true,
  })
  assert.equal(dark[0].background, 'rgba(45,164,78,0.24)')
  assert.equal(dark[1].color, '#e6b84d')
  assert.equal(dark[2].color, '#7aa2ff')
  // 一个读数都没有：三格都写 "—"，且不给颜色/底色（写 0 会看起来像坏了）
  const blank = t.dockKpiCells({ hasReading: false })
  assert.deepEqual(blank.map((c) => c.value), ['—', '—', '—'])
  assert.deepEqual(blank.map((c) => c.color), ['', '', ''])
  assert.deepEqual(blank.map((c) => c.background), ['', '', ''])
  assert.equal(blank[0].state, 'ok')
})

test('v1.16.0 预算档 / 实测速率两格：与前三格同款（标签 + 同色胶囊底），不要就不出现', () => {
  const base = {
    hasReading: true, occupancyText: '9 万', limitText: '/ 11 万', costText: '0.112',
    elapsedText: '6 分', tone: 'ok', palette: ['#2da44e', '#d99b1a', '#d93026'],
  }
  const five = t.dockKpiCells(Object.assign({}, base, {
    showMode: true, modeText: '日常', showRate: true, rateText: '~1.2 万/分',
  }))
  assert.equal(five.length, 5, '开两格就是五格')
  assert.deepEqual(five.map((c) => c.label), ['上下文占用', '本条会话花费', '已聊时长', '预算档', '实测速率'])
  // 预算档：紫 + 同色淡底（和前三格完全同一套做法）
  assert.equal(five[3].value, '日常')
  assert.equal(five[3].color, '#7c3aed')
  assert.equal(five[3].background, 'rgba(124,58,237,0.14)')
  // 实测速率：青（避开状态色绿，免得和"占用"混淆）
  assert.equal(five[4].value, '~1.2 万/分')
  assert.equal(five[4].color, '#0f766e')
  // 本会话临时档要在胶囊里标出来
  const scoped = t.dockKpiCells(Object.assign({}, base, { showMode: true, modeText: '大任务', modeSuffix: '本会话' }))
  assert.equal(scoped[3].suffix, '本会话')
  assert.equal(scoped.length, 4)
  // 暗色主题换亮一档
  const dark = t.dockKpiCells(Object.assign({}, base, {
    showMode: true, modeText: '日常', showRate: true, rateText: '~1.2 万/分', dark: true,
  }))
  assert.equal(dark[3].color, '#c4b5fd')
  assert.equal(dark[4].color, '#5eead4')
  // 老调用方（不给 showMode/showRate）拿到的仍是最初三格 —— 向后兼容
  assert.equal(t.dockKpiCells(base).length, 3)
  // 速率还没读数：写 "—"，且不给颜色/底色
  const noRate = t.dockKpiCells(Object.assign({}, base, { showMode: true, modeText: '日常', showRate: true }))
  assert.equal(noRate[4].value, '—')
  assert.equal(noRate[4].color, '')
  assert.equal(noRate[4].background, '')
})

test('v1.17.0 第六格「到线约还有」：样式与前面几格同款，位置紧跟实测速率', () => {
  const base = {
    hasReading: true, occupancyText: '9 万', limitText: '/ 11 万', costText: '0.112',
    elapsedText: '6 分', tone: 'ok', palette: ['#2da44e', '#d99b1a', '#d93026'],
  }
  const six = t.dockKpiCells(Object.assign({}, base, {
    showMode: true, modeText: '日常', showRate: true, rateText: '~1.2 万/分',
    showTurns: true, turnsText: '12 轮',
  }))
  assert.equal(six.length, 6, '开满就是六格')
  assert.deepEqual(six.map((c) => c.label),
    ['上下文占用', '本条会话花费', '已聊时长', '预算档', '实测速率', '到线约还有'])
  // 第六格：玫红 + 同色淡底（和前面几格完全同一套做法）
  assert.equal(six[5].key, 'turns')
  assert.equal(six[5].value, '12 轮')
  assert.equal(six[5].color, '#be185d')
  assert.equal(six[5].background, 'rgba(190,24,93,0.14)')
  // 暗色主题换亮一档
  const darkTurns = t.dockKpiCells(Object.assign({}, base, { showTurns: true, turnsText: '12 轮', dark: true }))
  assert.equal(darkTurns[3].color, '#f9a8d4')
  // 轮数还没算出来：写 "—"，且不给颜色/底色（与其它格一致）
  const blank = t.dockKpiCells(Object.assign({}, base, { showTurns: true }))
  assert.equal(blank[3].value, '—')
  assert.equal(blank[3].color, '')
  assert.equal(blank[3].background, '')
  // 不显式要就不出现（老调用方拿到的仍是最初三格）
  assert.equal(t.dockKpiCells(base).length, 3)
})

test('数字胶囊底：任意十六进制色都能算出同色淡底，坏值不炸', () => {
  assert.equal(t.tintOf('#2563eb', 0.14), 'rgba(37,99,235,0.14)')
  assert.equal(t.tintOf('#fff'), 'rgba(255,255,255,0.14)')
  assert.equal(t.tintOf('rgb(1,2,3)').startsWith('rgba('), true)
})

test('v1.14.0 源码契约：花费 / 明细 / 档位菜单 / 诊断默认隐藏都还在', () => {
  assert.ok(SOURCE.includes('/context'), '缺"上下文构成明细"接口路径')
  assert.ok(SOURCE.includes('/cost'), '缺"花费"接口路径')
  assert.ok(SOURCE.includes('gs-parts-list'), '缺上下文构成明细的渲染')
  assert.ok(SOURCE.includes('gs-dock-parts-toggle'), '缺明细面板的开关')
  assert.ok(SOURCE.includes('gs-mode-menu'), '缺档位菜单（胶囊已从"轮转"改成"点开选"）')
  assert.ok(SOURCE.includes('gs-dock-suggest'), '缺按客观计数给的建议行')
  assert.ok(SOURCE.includes('showDiag'), '缺"诊断分区默认隐藏"的开关')
  assert.ok(SOURCE.includes('notifyOnLine'), '缺到线系统通知')
  assert.ok(SOURCE.includes('advOptions'), '缺"精选 / 全部"的选项范围开关')
})

test('v1.18.0 活跃时长：新会话按创建时间起算，旧会话不吞断档，按会话各自记账', () => {
  const now = 1700000000000
  // ① 首次见到、且会话是 5 分钟前刚建的：把"创建到现在"当作已聊
  const fresh = t.activeElapsed(null, now, now - 5 * 60000)
  assert.equal(fresh.totalMs, 5 * 60000)
  assert.equal(fresh.lastAt, now)
  // ② 恢复的旧会话（创建于 3 小时前）：不按创建时间起算 —— 这正是"别把上次的会话也算进来"
  const revived = t.activeElapsed(null, now, now - 3 * 3600000)
  assert.equal(revived.totalMs, 0)
  // ③ 连续心跳：5 秒一步照累
  const step = t.activeElapsed({ totalMs: 60000, lastAt: now - 5000 }, now, null)
  assert.equal(step.totalMs, 65000)
  // ④ 断档 20 分钟：这一段不累加，之前的账保留
  const gap = t.activeElapsed({ totalMs: 60000, lastAt: now - 20 * 60000 }, now, null)
  assert.equal(gap.totalMs, 60000)
  // ⑤ 宿主半答的时间不确定时（传 null）绝不瞎算；脏值也不炸
  assert.equal(t.activeElapsed(null, now, null).totalMs, 0)
  assert.equal(t.activeElapsed(null, now, 'x').totalMs, 0)
  assert.equal(t.activeElapsed({ totalMs: -5, lastAt: 0 }, now, null).totalMs, 0)
  // 阈值与账本结构
  assert.equal(t.activeIdleMaxMs, 5 * 60000)
  assert.equal(t.activeFreshMaxMs, 30 * 60000)
  assert.deepEqual(t.emptySampler().samples, [])
})

test('v1.18.0 实测速率：门槛放宽到 20 秒，采样不够时用轮次跃升斜率兜底', () => {
  assert.equal(t.rateMinSpanMs, 20000)
  const base = 1700000000000
  const points = [{ t: base, used: 1000 }, { t: base + 40000, used: 5000 }]
  // 40 秒涨 4000 → 6000 tok/分（旧的 60 秒门槛下这里会返回 null，格子就一直是 "—"）
  assert.equal(t.tokensPerMinute(points, t.rateMinSpanMs), 6000)
  // 不传门槛时行为不变（默认仍是 60 秒）
  assert.equal(t.tokensPerMinute(points), null)
  // 跃升兜底：两次跃升间隔 30 秒、最近一次增量 3000 → 6000 tok/分
  assert.equal(t.rateFromJumps([base, base + 30000], [2500, 3000]), 6000)
  // 间隔太短 / 数据不足 / 没增长：一律 null（宁可显示 "—"，不给假数字）
  assert.equal(t.rateFromJumps([base, base + 3000], [2500, 3000]), null)
  assert.equal(t.rateFromJumps([base], [3000]), null)
  assert.equal(t.rateFromJumps(null, null), null)
  assert.equal(t.rateFromJumps([base, base + 30000], [0, 0]), null)
})
