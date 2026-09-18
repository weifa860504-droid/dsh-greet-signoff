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
