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
  const requireStub = () => ({ createElement: () => ({}), memo: (c) => c, useState: () => [null, noop], useEffect: noop, useRef: () => ({ current: null }) })
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
  for (const name of ['normalizeFixedLine', 'foldFixedLine', 'matchLineText', 'compileWantedLine', 'resolveTemplate', 'normalize', 'validate', 'occupancyOf', 'formatTokens', 'rampColor', 'lineSimilarity']) {
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
