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
  for (const name of ['normalizeFixedLine', 'foldFixedLine', 'matchLineText', 'compileWantedLine', 'resolveTemplate', 'normalize', 'validate', 'formatTokens', 'lineSimilarity', 'isPerCharAnimation', 'splitGraphemes', 'renderLineText', 'darkFromSignals', 'parseCssRgb', 'colorLuminance', 'chatCss', 'formatWan', 'pickOptions', 'formatCny', 'extractHandoffText', 'normalizePricing', 'pricingIsDefault', 'moreOptionLabel', 'moreOption', 'isMoreOptionValue', 'sanitizeSwitches', 'switchOn']) {
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
  assert.equal(clamped.warnPercent, undefined, '老配置里的阈值字段应被忽略（1.23.0 删掉上下文卡）')
  assert.equal(clamped.criticalPercent, undefined, '老配置里的阈值字段应被忽略（1.23.0 删掉上下文卡）')
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

test('token 的中文直观写法', () => {
  assert.equal(t.formatWan(248930), '24.9 万')
  assert.equal(t.formatWan(110000), '11 万')
  assert.equal(t.formatWan(75000), '7.5 万')
  assert.equal(t.formatWan(3200), '3.2k')
  assert.equal(t.formatWan(Number.NaN), '?')
})

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
  for (const list of [t.primeAnimations]) {
    assert.ok(list.length <= 8, '精选不该超过 8 项')
    assert.equal(new Set(list).size, list.length, '精选表里有重复项')
  }
})

/* ── v1.19.0：长尾选项「精选 ↔ 全部」统一 + 占用格采样口径 ─────────── */

test('长尾选项开关：收起/展开两条文案由同一个纯函数产出，配色/动效/车型只是量词不同', () => {
  assert.equal(t.moreOptionLabel(false, 37, 6, '套'), '▾ 显示全部（37 套）')
  assert.equal(t.moreOptionLabel(true, 37, 6, '套'), '▴ 只看常用（6 套）')
  assert.equal(t.moreOptionLabel(false, 40, 8, '项'), '▾ 显示全部（40 项）')
  assert.equal(t.moreOptionLabel(true, 40, 8, '项'), '▴ 只看常用（8 项）')
  assert.equal(t.moreOptionLabel(false, 31, 7, '种'), '▾ 显示全部（31 种）')
  // 量词缺省是"项"；坏值不炸（NaN 当 0）
  assert.equal(t.moreOptionLabel(false, 3, 1, undefined), '▾ 显示全部（3 项）')
  assert.equal(t.moreOptionLabel(false, Number.NaN, Number.NaN, ''), '▾ 显示全部（0 项）')
})

test('长尾选项开关：那条特殊项的 value 决定往哪切，认得出 __more__ / __less__', () => {
  assert.deepEqual(t.moreOption(false, 37, 6, '套'), { value: '__more__', label: '▾ 显示全部（37 套）' })
  assert.deepEqual(t.moreOption(true, 37, 6, '套'), { value: '__less__', label: '▴ 只看常用（6 套）' })
  assert.equal(t.isMoreOptionValue('__more__'), true)
  assert.equal(t.isMoreOptionValue('__less__'), true)
  // 正常选项（配色 id / 动效名）不能被当成开关，否则选不中
  assert.equal(t.isMoreOptionValue('classic'), false)
  assert.equal(t.isMoreOptionValue('shine'), false)
  assert.equal(t.isMoreOptionValue(undefined), false)
  // 精选表里不许混进这两个保留值
  assert.equal(t.primeAnimations.includes('__less__'), false)
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

test('v1.23.0 源码契约：花费台账 / 诊断默认隐藏 / 选项范围都还在', () => {
  assert.ok(SOURCE.includes('/cost'), '缺"花费"接口路径')
  assert.ok(SOURCE.includes('showDiag'), '缺"诊断分区默认隐藏"的开关')
  assert.ok(SOURCE.includes('advOptions'), '缺"精选 / 全部"的选项范围开关')
})

test('v1.19.0 交接摘要提取：两个标记之间才算，缺标 / 颠倒 / 太短都不算', () => {
  const start = t.handoffMarkStart
  const end = t.handoffMarkEnd
  const body = '目标：给进度条加「上一轮涨幅」。\n已确认：宿主 POST /handoff 可落盘。'
  // 正常：前后有废话、中间带换行，只取中间那段（首尾空白被清掉）
  assert.equal(t.extractHandoffText('好的，摘要如下：\n' + start + '\n' + body + '\n' + end + '\n以上。'), body)
  assert.equal(t.extractHandoffText(start + '  ' + body + '  ' + end), body)
  // 缺一个标记 → 不给内容
  assert.equal(t.extractHandoffText(start + '\n' + body), null)
  assert.equal(t.extractHandoffText(body + '\n' + end), null)
  // 顺序颠倒（结束标记在前）→ 不给内容
  assert.equal(t.extractHandoffText(end + '\n' + body + '\n' + start), null)
  // 中间是空的 / 只有空白 → 不给内容
  assert.equal(t.extractHandoffText(start + end), null)
  assert.equal(t.extractHandoffText(start + '   \n\t  ' + end), null)
  // 内容不足 handoffMinChars（输入框里那句"要求"就是这种短片段）→ 不给内容
  assert.equal(t.extractHandoffText(start + '短摘要' + end), null)
  assert.equal(t.handoffMinChars, 32)
  // 非字符串不炸
  assert.equal(t.extractHandoffText(null), null)
  assert.equal(t.extractHandoffText(123), null)
  assert.equal(t.extractHandoffText(''), null)
})

test('v1.19.0 计价口径：非法值回落内置价，边界值照收，能识别"是否默认"', () => {
  assert.deepEqual(t.priceDefault, { in: 1, cacheRead: 0.02, out: 4 })
  assert.deepEqual(t.normalizePricing(null), { in: 1, cacheRead: 0.02, out: 4 })
  assert.deepEqual(t.normalizePricing({ in: 2, cacheRead: 0.5, out: 8 }), { in: 2, cacheRead: 0.5, out: 8 })
  // 负数 / 超过 1000 元每百万 / 非数字 → 回落内置
  assert.equal(t.normalizePricing({ in: -1 }).in, 1)
  assert.equal(t.normalizePricing({ in: 1001 }).in, 1)
  assert.equal(t.normalizePricing({ in: 'x' }).in, 1)
  assert.equal(t.normalizePricing({ out: Number.NaN }).out, 4)
  // 边界值 0 与 1000 算合法（不做"最小值"限制，0 表示想按免费算）
  assert.equal(t.normalizePriceValue(0, 9), 0)
  assert.equal(t.normalizePriceValue(1000, 9), 1000)
  assert.equal(t.normalizePriceValue(1000.5, 9), 9)
  // 是否默认
  assert.equal(t.pricingIsDefault(null), true)
  assert.equal(t.pricingIsDefault({ in: 1, cacheRead: 0.02, out: 4 }), true)
  assert.equal(t.pricingIsDefault({ in: 2, cacheRead: 0.02, out: 4 }), false)
})

test('v1.23.0 源码契约：交接落盘 / 计价口径都还在', () => {
  for (const needle of ['HANDOFF_MARK_START', 'priceIn=']) {
    assert.ok(SOURCE.includes(needle), `缺 ${needle}`)
  }
  assert.ok(SOURCE.includes('normalizePricing(uiState.pricing)'), 'fetchCostInfo 必须用设置里的单价')
  assert.ok(SOURCE.includes('priceDefault: PRICE_DEFAULT'), '__test 必须暴露内置单价')
})

// ── v1.20.0：宿主节奏 × 本页采样的合成（速率 / 每轮涨量 / 上一轮涨幅）──────────

/* ── v1.23.0：两个总开关（开场语 / 收尾语） ───────────────────────────── */

test('v1.23.0 总开关清洗：只认明确 false，缺字段 / 坏值一律当开', () => {
  assert.deepEqual(t.sanitizeSwitches(undefined), { greeting: true, signOff: true })
  assert.deepEqual(t.sanitizeSwitches(null), { greeting: true, signOff: true })
  assert.deepEqual(t.sanitizeSwitches({ greeting: false }), { greeting: false, signOff: true })
  assert.deepEqual(t.sanitizeSwitches('nope'), { greeting: true, signOff: true })
  // 字符串 / 0 / null 都不算"关" —— 手改坏配置时宁可照旧工作，也不要整块功能消失
  assert.equal(t.sanitizeSwitches({ signOff: 'no' }).signOff, true)
  assert.equal(t.sanitizeSwitches({ greeting: 0 }).greeting, true)
  // normalize 一路带着它：旧宿主半回传的配置里没有这个字段时补成"全开"
  assert.deepEqual(t.normalize({}).switches, { greeting: true, signOff: true })
  // 老配置里残留的 contextBar 字段被忽略（不会再冒出一个开关）
  assert.deepEqual(t.sanitizeSwitches({ contextBar: false }), { greeting: true, signOff: true })
})

test('v1.23.0 switchOn：读一个开关，拿不准就当开，两个各管各的', () => {
  assert.equal(t.switchOn(undefined, 'greeting'), true)
  assert.equal(t.switchOn(null, 'signOff'), true)
  assert.equal(t.switchOn({}, 'greeting'), true)
  assert.equal(t.switchOn({ switches: null }, 'signOff'), true)
  assert.equal(t.switchOn({ switches: { greeting: false } }, 'greeting'), false)
  assert.equal(t.switchOn({ switches: { greeting: false } }, 'signOff'), true, '两个开关互不影响')
})

test('v1.23.0 源码契约：两个总开关 + 苹果滑动开关 + 上下文卡整块删干净', () => {
  // 两个开关都在，且都挂在「总开关」分区里
  assert.ok(SOURCE.includes('gs-master'), '缺总开关分区的容器/样式')
  assert.ok(SOURCE.includes('masterSwitch("greeting"'), '缺「开场语」开关')
  assert.ok(SOURCE.includes('masterSwitch("signOff"'), '缺「收尾语」开关')
  // 苹果开关的真身是 checkbox + role=switch（键盘 Tab / 空格能用，屏幕阅读器认得出）
  assert.ok(SOURCE.includes('role: "switch"'), '缺 role="switch"')
  assert.ok(SOURCE.includes('"aria-checked"'), '缺 aria-checked')
  assert.ok(SOURCE.includes('.gs-switch-track{'), '缺轨道样式')
  assert.ok(SOURCE.includes('.gs-switch-thumb{'), '缺滑块样式')
  assert.ok(SOURCE.includes('translateX(20px)'), '缺滑块位移（iOS 51×31 / 滑块 27 / 位移 20）')
  assert.ok(SOURCE.includes('cubic-bezier(.4,0,.2,1)'), '缺滑动过渡动画')
  // 上下文卡那一整套必须彻底删干净（只重复官方圆环的数字）
  assert.ok(!SOURCE.includes('masterSwitch("contextBar"'), '不该再有上下文卡开关')
  assert.ok(!SOURCE.includes('src.contextBar'), '不该再读 contextBar 开关')
  assert.ok(!SOURCE.includes('GreetDockGate'), '不该再有上下文卡门组件')
  assert.ok(!SOURCE.includes('conversation.input.dock'), '不该再注册输入框上方的卡片')
  // 删卡后留下的"死零件"也一并清掉：跳转条里的空胶囊、老阈值字段、进度条时代的 CSS
  assert.ok(!SOURCE.includes('label: "进度条"'), '跳转条里不该再有「进度条」死胶囊')
  assert.ok(!SOURCE.includes('warnPercent'), '配置里不该再有 warnPercent（1.23.0 删掉）')
  assert.ok(!SOURCE.includes('criticalPercent'), '配置里不该再有 criticalPercent（1.23.0 删掉）')
  assert.ok(!SOURCE.includes('gs-mode-'), '不该再有预算档菜单的 CSS')
  assert.ok(!SOURCE.includes('gs-dock'), '不该再有进度条时代的类名')
  assert.ok(/SECTION_NAV = \[\s*\{ key: "master"/.test(SOURCE), '跳转条里「总开关」应在第一个')
})
