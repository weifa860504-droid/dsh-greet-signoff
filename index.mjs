/**
 * 开场语与收尾语 — 常驻插件（宿主半）
 *
 * 职责：
 *  1. 读取配置文件（默认 <插件目录>/config/greet-signoff.json），向系统提示注册一段「开场与收尾」规则，
 *     让模型每次回复的正文都以配置的开场行开头、收尾行结尾；
 *  2. 提供同源 HTTP 接口，供页面上的设置编辑器读写配置：GET/POST /api/greet-signoff。
 *
 * 配置结构（每一行都可以带样式；样式只在页面上呈现，不写进提示词）：
 *   {
 *     greeting: { text, image, imageHeight, fontSize, fontWeight, color, animation, … },
 *     signOff:  { …同一结构… },
 *     matchMode, onlyAssistant, pool, scenes, perWorkspace, switches
 *   }
 * 为了兼容早期版本，greeting / signOff 是字符串时按「只有文本、其余取默认」处理。
 *
 * 配置在每次组装提示时实时读取，因此保存后对下一次回复立即生效，不需要重启。
 * 本插件不发布任何服务，因此不需要 isolate realm。
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync,
  copyFileSync, renameSync, statSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-greet-signoff'
// 两个服务都必须等就绪再 apply：宿主组合里的行会在 Web Server 之前挂载，
// 早期版本只声明 systemPrompt，导致 ctx.get('webServer') 拿到 undefined、
// 配置接口整段没注册（页面读写配置直接 401）。
export const inject = ['systemPrompt', 'webServer']

const API_PATH = '/api/greet-signoff'
/** 宿主半版本号：与 package.json、浏览器半的 CLIENT_VERSION 保持一致。
 *  它挂在启动日志里，用来核对"服务到底加载的是哪份代码"（热重载后也能看出来）。 */
const HOST_VERSION = '1.23.0'
const SECTION_NAME = 'greet-signoff:rule'
const SECTION_ORDER = 100
const TEXT_LIMIT = 200
/** 单条自定义图片（data URL）的字符上限，留出客户端 300KB 原图的余量。 */
const IMAGE_LIMIT = 420 * 1024
/** POST 请求体上限：两条图片 + 文本，1.5MB 足够。 */
const BODY_LIMIT = 1536 * 1024
const IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/gif;base64,',
  'data:image/webp;base64,',
]
const IMAGE_EXT = {
  'data:image/png;base64,': 'png',
  'data:image/jpeg;base64,': 'jpg',
  'data:image/gif;base64,': 'gif',
  'data:image/webp;base64,': 'webp',
}
/** 图片不写进配置文件，落盘成独立文件，配置里只存这个前缀的短地址。 */
const ASSET_PREFIX = `${API_PATH}/asset/`
const ASSET_NAME = /^[a-f0-9]{24}\.(png|jpg|gif|webp)$/
const ASSET_MAX_BYTES = 420 * 1024
const ANIMATIONS = [
  'none', 'fade', 'slide', 'slideUp', 'slideRight', 'drop', 'blur', 'zoom', 'flip', 'unfold',
  'sweep', 'shine', 'pulse', 'heartbeat', 'glow', 'neon', 'blink', 'bounce', 'shake', 'wobble',
  'swing', 'tilt', 'float', 'spin', 'wave', 'rainbow',
  // 逐字动效（浏览器半会给每个字单独包一层 span，按顺序错开播放）
  'charbounce', 'charwave', 'chartype', 'charrainbow',
]
const SHAPES = ['none', 'pill', 'round', 'soft', 'rect', 'card', 'tag', 'underline', 'highlight', 'blockquote']
const FILLS = ['none', 'faint', 'theme', 'solid']
const SHADOWS = ['none', 'soft', 'medium', 'strong', 'glow']
const CAPS = ['none', 'upper', 'lower']
const WEIGHTS = [400, 500, 600, 700, 800]
/** 匹配模式（与浏览器半保持同一套取值）。 */
const MATCH_MODES = ['exact', 'loose', 'fuzzy']

/** 文案池：最多几句、每句多长、两种挑法。 */
const POOL_MAX = 20
const POOL_LINE_MAX = 200
const POOL_MODES = ['random', 'sequence']
/** 颜色字段只允许 #rgb / #rrggbb / #rrggbbaa，避免任意字符串进样式。 */
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

const DSH_HOME = process.env.DSH_HOME && process.env.DSH_HOME.length > 0
  ? process.env.DSH_HOME
  : join(process.env.USERPROFILE ?? process.cwd(), '.dsh')

/** 插件包根目录（junction 装载时 Node 会解析到真实路径）。 */
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
/**
 * 插件自有数据目录（配置文件 + 图片附件）。
 * 解析顺序：
 *   1. 环境变量 DSH_GREET_SIGNOFF_HOME（想把数据放别处时用，相对路径按插件目录解析）；
 *   2. 插件自带的 config/ 子目录 —— 默认值：插件搬到哪，配置跟到哪；
 *   3. 旧的 $DSH_HOME —— 自带 config/ 还不存在时（首次运行 / 老用户还留在原地的配置 /
 *      被装进 node_modules 当依赖的场景）继续用原来的位置，行为与 1.21.0 一致。
 */
function resolveDataHome() {
  const fromEnv = (process.env.DSH_GREET_SIGNOFF_HOME ?? '').trim()
  if (fromEnv.length > 0) return resolve(PLUGIN_DIR, fromEnv)
  const inPlugin = join(PLUGIN_DIR, 'config')
  if (existsSync(join(inPlugin, 'greet-signoff.json'))) return inPlugin
  if (existsSync(join(DSH_HOME, 'greet-signoff.json'))) return DSH_HOME
  if (PLUGIN_DIR.split(sep).includes('node_modules')) return DSH_HOME
  return inPlugin
}

const DATA_HOME = resolveDataHome()
const FILE_PATH = join(DATA_HOME, 'greet-signoff.json')
const ASSET_DIR = join(DATA_HOME, 'greet-signoff-assets')
const CLIENT_PATH = fileURLToPath(new URL('./client.js', import.meta.url))
/** 表情中文名/关键词索引（1.2.0 起从 client.js 里搬出来，首次打开表情框才加载）。 */
const EMOJI_INDEX_PATH = fileURLToPath(new URL('./emoji-zh.json', import.meta.url))

/* ─── 诊断类接口（花费 / 交接落盘）的常量 ──────────────────────────────── */
/** 会话投影缓存：`<DSH_HOME>/storages/session_projcache/sessions/{,session-}<sessionId>.json`。 */
const PROJCACHE_DIR = join(DSH_HOME, 'storages', 'session_projcache', 'sessions')
/** 用量台账：按「日期 → provider → model」累计（**没有**会话维度）。 */
const USAGE_LEDGER_PATH = join(DSH_HOME, 'dsh-usage', 'usage-ledger.json')
/**
 * deepseek-flash 单价（元/百万 token），写死为常量并随接口返回，
 * 方便页面直接展示"这一条是按什么价算的"。
 * 实测与台账自带的 cost 字段一致（2026-09-15/17/19/20 四天误差 < 1e-5 元）。
 */
const COST_UNIT = { uncachedPerM: 1, cacheReadPerM: 0.02, outputPerM: 4 }
/**
 * 单价可配置（元/百万 token）的夹取范围与查询参数名。
 * 允许外部把 DSH 调价后的单价从 URL 传进来（`?priceIn=&priceCache=&priceOut=`），
 * 一个都不传时行为与以前完全一致（一直用 COST_UNIT）。
 */
const COST_PRICE_MIN = 0
const COST_PRICE_MAX = 1000
const PRICE_PARAM_KEYS = ['priceIn', 'priceCache', 'priceOut']
/** 最贵会话 top 几条。 */
const TOP_MAX = 5
/** 扫描全部会话投影算 top 的缓存时长（毫秒）——避免每次请求都把 50 个文件读一遍。 */
const TOP_CACHE_MS = 60000
/** 会话 id 允许的形状（同时也是路径穿越防线：只允许字母数字与 . _ -）。 */
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** 交接摘要正文的字节上限。 */
const HANDOFF_TEXT_LIMIT = 200000
/** 交接文件名缺省值。 */
const HANDOFF_DEFAULT_NAME = 'HANDOFF.md'
/** 交接请求体上限（正文 200000 字节 + JSON 转义余量）。 */
const HANDOFF_BODY_LIMIT = 260 * 1024
/** 文件名长度上限与非法字符（与 Windows 保留字符一起挡掉）。 */
const HANDOFF_NAME_MAX = 128
const HANDOFF_BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/

const DEFAULT_LINE = {
  text: '',
  image: '',
  imageHeight: 22,
  fontSize: 14,
  fontWeight: 600,
  color: '',
  colorDark: '',
  animation: 'none',
  animSpeed: 1,
  shape: 'none',
  radius: 12,
  padY: 5,
  fill: 'none',
  bgColor: '',
  bgColorDark: '',
  borderWidth: 0,
  borderColor: '',
  borderColorDark: '',
  shadow: 'none',
  letterSpacing: 0,
  caps: 'none',
  italic: false,
}

const DEFAULT_CONFIG = {
  greeting: Object.assign({}, DEFAULT_LINE, { text: '👋 你好，我是 DeepSeek Harness 助手。' }),
  signOff: Object.assign({}, DEFAULT_LINE, { text: '✅ 以上，随时叫我。' }),
  /** 匹配模式：exact 逐字 / loose 宽松（忽略大小写、空白、全半角与首尾标点）/ fuzzy 近似容错。 */
  matchMode: 'loose',
  /** 只给助手的回复贴样式（用户消息、工具结果、思考面板都不贴）。 */
  onlyAssistant: true,
  /** 旧文案兼容表：只影响页面渲染，不写进提示词。 */
  legacyLines: [],
  /**
   * 文案池：开启后每次回复从池子里挑一句（随机或按顺序轮换），不再固定用 greeting.text / signOff.text。
   * 某一行的池子为空时，那一行仍然用固定文案 —— 这样"只想让开场语轮换"也能用。
   */
  pool: { enabled: false, mode: 'random', greeting: [], signOff: [] },
  /** 场景：整份配置的快照，用于"工作 / 生活 / 深夜"一键整体切换。 */
  scenes: { active: '', items: [] },
  /** 按工作区自动换文案：命中当前会话的工作目录时，用这一条的文案（优先级最高）。 */
  perWorkspace: { enabled: false, items: [] },
  /**
   * 两个独立总开关（v1.23.0）：
   *   greeting 开场语 —— 关掉后提示段里不再要求模型写这一行；
   *   signOff  收尾语 —— 同上。
   * 缺字段 = 开（老配置行为不变）；只有明确写成 false 才算关。
   */
  switches: { greeting: true, signOff: true },
}

/** 一句池子文案的清洗：去首尾空白、丢掉空行、截到上限。 */
function sanitizePoolList(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (text.length === 0) continue
    out.push(text.length > POOL_LINE_MAX ? text.slice(0, POOL_LINE_MAX) : text)
    if (out.length >= POOL_MAX) break
  }
  return out
}

/** 文案池字段清洗（未知模式一律回到随机）。 */
function sanitizePool(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    enabled: src.enabled === true,
    mode: pickEnum(src.mode, POOL_MODES, 'random'),
    greeting: sanitizePoolList(src.greeting),
    signOff: sanitizePoolList(src.signOff),
  }
}

/**
 * 两个总开关的清洗（v1.23.0）。
 * 只认"明确写成 false"为关，其余一律为开 —— 老配置没有这个字段、坏值、字符串都能安全回落，
 * 保证"升级后功能突然消失"这种事不会发生（老配置里残留的 contextBar 字段直接忽略）。
 * @param {unknown} raw 原始字段。
 * @returns {{greeting: boolean, signOff: boolean}} 清洗后的开关。
 */
function sanitizeSwitches(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    greeting: src.greeting !== false,
    signOff: src.signOff !== false,
  }
}

function clampInt(value, min, max, fallback) {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

/** 字重吸附到浏览器真正支持的几档。 */
function snapWeight(value, fallback) {
  const weight = clampInt(value, 300, 900, fallback)
  let best = WEIGHTS[0]
  for (let i = 0; i < WEIGHTS.length; i += 1) {
    if (Math.abs(WEIGHTS[i] - weight) < Math.abs(best - weight)) best = WEIGHTS[i]
  }
  return best
}

function sanitizeImage(value, fallback) {
  if (typeof value !== 'string') return fallback
  if (value.length === 0) return ''
  // 已经是落盘资产的短地址：原样保留（配置里存的就是它）
  if (value.indexOf(ASSET_PREFIX) === 0) {
    return ASSET_NAME.test(value.slice(ASSET_PREFIX.length)) ? value : fallback
  }
  if (value.length > IMAGE_LIMIT) {
    console.error(`[greet-signoff] image rejected: too large (${value.length} chars)`)
    return fallback
  }
  for (let i = 0; i < IMAGE_PREFIXES.length; i += 1) {
    if (value.indexOf(IMAGE_PREFIXES[i]) === 0) return value
  }
  console.error('[greet-signoff] image rejected: unsupported data URL prefix')
  return fallback
}

/**
 * 把 data URL 落盘成独立文件，返回短地址；已是短地址或空值原样返回。
 * 图片不再进配置文件，配置保持小巧、每次保存只传短地址。
 * @param value - data URL、资产短地址或空串。
 * @returns 资产短地址（失败时返回空串，即视为没有图片）。
 */
function materializeImage(value) {
  if (typeof value !== 'string' || value.length === 0) return ''
  if (value.indexOf(ASSET_PREFIX) === 0) {
    return ASSET_NAME.test(value.slice(ASSET_PREFIX.length)) ? value : ''
  }
  let ext = null
  for (const prefix of Object.keys(IMAGE_EXT)) {
    if (value.indexOf(prefix) === 0) ext = IMAGE_EXT[prefix]
  }
  if (ext === null) return ''
  let bytes
  try {
    bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  } catch {
    return ''
  }
  if (bytes.length === 0 || bytes.length > ASSET_MAX_BYTES) {
    console.error(`[greet-signoff] image rejected at materialize: ${bytes.length} bytes`)
    return ''
  }
  const name = `${createHash('sha1').update(bytes).digest('hex').slice(0, 24)}.${ext}`
  try {
    mkdirSync(ASSET_DIR, { recursive: true })
    const file = join(ASSET_DIR, name)
    if (!existsSync(file)) writeFileSync(file, bytes)
  } catch (error) {
    console.error('[greet-signoff] asset write failed:', error.message)
    return ''
  }
  return ASSET_PREFIX + name
}

/** 删掉不再被配置引用的资产文件（只在本插件自己的目录、只删自己命名的文件）。 */
function gcAssets(keep) {
  const keepNames = new Set()
  for (const value of keep) {
    if (typeof value === 'string' && value.indexOf(ASSET_PREFIX) === 0) keepNames.add(value.slice(ASSET_PREFIX.length))
  }
  let files
  try {
    files = readdirSync(ASSET_DIR)
  } catch {
    return
  }
  for (const name of files) {
    if (keepNames.has(name) || !ASSET_NAME.test(name)) continue
    try { unlinkSync(join(ASSET_DIR, name)) } catch { /* 删不掉就留着，不影响功能 */ }
  }
}

/** 在一组合法值里取值，否则回落到默认。 */
function pickEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.indexOf(value) >= 0 ? value : fallback
}

/** 颜色：空串（跟随主题）或合法十六进制；其余一律回落。 */
function sanitizeColor(value, fallback) {
  if (typeof value !== 'string') return fallback
  if (value.length === 0) return ''
  return COLOR_RE.test(value) ? value.slice(0, 12) : fallback
}

/**
 * 动效名：已知的名字直接用；未知但**形状合法**的名字也保留。
 * 为什么要保留未知值：浏览器半可能比宿主半新（比如刚加了新动效、插件还没重启），
 * 若在这里一律回落到默认，用户刚选的新动效一保存就被悄悄改回"无"。只挡明显不合法的输入。
 */
const ANIMATION_RE = /^[a-z][a-zA-Z]{2,24}$/

function pickAnimation(value, fallback) {
  if (typeof value !== 'string') return fallback
  if (ANIMATIONS.indexOf(value) >= 0) return value
  return ANIMATION_RE.test(value) ? value : fallback
}

function sanitizeLine(raw, fallback) {
  const base = raw !== null && typeof raw === 'object' ? raw : {}
  const animation = pickAnimation(base.animation, fallback.animation)
  return {
    text: typeof base.text === 'string' ? base.text.slice(0, TEXT_LIMIT) : fallback.text,
    image: sanitizeImage(base.image, fallback.image),
    imageHeight: clampInt(base.imageHeight, 12, 64, fallback.imageHeight),
    fontSize: clampInt(base.fontSize, 10, 40, fallback.fontSize),
    fontWeight: snapWeight(base.fontWeight, fallback.fontWeight),
    color: sanitizeColor(base.color, fallback.color),
    colorDark: sanitizeColor(base.colorDark, fallback.colorDark),
    animation,
    // 动效倍速 / 形状 / 填充 / 边框 / 阴影 / 字距 / 大小写 / 斜体（只影响页面显示）
    animSpeed: clampInt(base.animSpeed, 1, 4, fallback.animSpeed),
    shape: pickEnum(base.shape, SHAPES, fallback.shape),
    radius: clampInt(base.radius, 0, 999, fallback.radius),
    padY: clampInt(base.padY, 0, 24, fallback.padY),
    fill: pickEnum(base.fill, FILLS, fallback.fill),
    bgColor: sanitizeColor(base.bgColor, fallback.bgColor),
    bgColorDark: sanitizeColor(base.bgColorDark, fallback.bgColorDark),
    borderWidth: clampInt(base.borderWidth, 0, 6, fallback.borderWidth),
    borderColor: sanitizeColor(base.borderColor, fallback.borderColor),
    borderColorDark: sanitizeColor(base.borderColorDark, fallback.borderColorDark),
    shadow: pickEnum(base.shadow, SHADOWS, fallback.shadow),
    letterSpacing: clampInt(base.letterSpacing, -2, 12, fallback.letterSpacing),
    caps: pickEnum(base.caps, CAPS, fallback.caps),
    italic: base.italic === true,
  }
}

/** 旧文案兼容表：只影响页面渲染（不写进提示词），最多 30 条。 */
function sanitizeLegacyLines(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (let i = 0; i < raw.length && out.length < 30; i += 1) {
    const item = raw[i]
    if (item === null || typeof item !== 'object') continue
    const text = typeof item.text === 'string' ? item.text.slice(0, TEXT_LIMIT) : ''
    if (text.trim().length === 0) continue
    out.push({ text, style: item.style === 'signOff' ? 'signOff' : 'greeting' })
  }
  return out
}

/** 场景：最多几个、名字多长、id 形状（场景=一整份配置的快照，用于一键整包切换）。 */
const SCENES_MAX = 8
const SCENE_NAME_MAX = 24
const SCENE_ID_RE = /^[a-z0-9][a-z0-9-]{0,15}$/

/** 按工作区绑定：最多几条、路径多长。 */
const WORKSPACE_MAX = 8
const WORKSPACE_PATH_MAX = 260

/** 路径归一：Windows 下不区分大小写、斜杠统一、去掉末尾分隔符。 */
function pathKey(value) {
  return String(value ?? '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

/**
 * 清洗"按工作区绑定文案"表：路径为空、开场与收尾都空的条目直接丢掉。
 * @param {unknown} raw 原始字段。
 * @returns {{enabled: boolean, items: Array<{path: string, greeting: string, signOff: string}>}} 清洗后的绑定表。
 */
function sanitizeWorkspaceBindings(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const list = Array.isArray(src.items) ? src.items : []
  const items = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const path = typeof item.path === 'string' ? item.path.trim().slice(0, WORKSPACE_PATH_MAX) : ''
    if (path.length === 0) continue
    const greeting = typeof item.greeting === 'string' ? item.greeting.trim().slice(0, TEXT_LIMIT) : ''
    const signOff = typeof item.signOff === 'string' ? item.signOff.trim().slice(0, TEXT_LIMIT) : ''
    if (greeting.length === 0 && signOff.length === 0) continue
    items.push({ path, greeting, signOff })
    if (items.length >= WORKSPACE_MAX) break
  }
  return { enabled: src.enabled === true, items }
}

/**
 * 找出与当前工作目录匹配的绑定：路径相等或以它开头（按目录边界），多条命中取**最长**的那条。
 * @param {object} bindings 绑定表。
 * @param {string|undefined} cwd 当前会话的工作目录。
 * @returns {{path: string, greeting: string, signOff: string}|undefined} 命中的绑定。
 */
function matchWorkspaceBinding(bindings, cwd) {
  if (bindings === undefined || bindings === null || bindings.enabled !== true) return undefined
  if (typeof cwd !== 'string' || cwd.length === 0) return undefined
  const target = pathKey(cwd)
  let best
  for (const item of bindings.items ?? []) {
    const key = pathKey(item.path)
    if (key.length === 0) continue
    const hit = target === key || target.indexOf(`${key}\\`) === 0
    if (!hit) continue
    if (best === undefined || key.length > pathKey(best.path).length) best = item
  }
  return best
}

/**
 * 清洗场景表。每个场景存的是"保存那一刻的整份配置"（不含 scenes 自身，避免自我嵌套）。
 * 坏数据一律丢掉，绝不因为一个场景写坏而让整份配置读不出来。
 * @param {unknown} raw 原始字段。
 * @returns {{active: string, items: Array<{id: string, name: string, config: object}>}} 清洗后的场景表。
 */
function sanitizeScenes(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const list = Array.isArray(src.items) ? src.items : []
  const items = []
  const seen = new Set()
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const id = typeof item.id === 'string' && SCENE_ID_RE.test(item.id) ? item.id : undefined
    if (id === undefined || seen.has(id)) continue
    const trimmed = typeof item.name === 'string' ? item.name.trim() : ''
    items.push({
      id,
      name: trimmed.length > 0 ? trimmed.slice(0, SCENE_NAME_MAX) : id,
      config: normalizeCore(item.config),
    })
    seen.add(id)
    if (items.length >= SCENES_MAX) break
  }
  const active = typeof src.active === 'string' && seen.has(src.active) ? src.active : ''
  return { active, items }
}

/** 取配置里的场景表（缺字段时给空表）。 */
function scenesOf(config) {
  return config !== null && config !== undefined && config.scenes !== undefined ? config.scenes : { active: '', items: [] }
}

/**
 * 把任意输入归一化成合法配置；缺失字段回落到默认值；兼容旧的字符串写法。
 * @param {unknown} raw 原始输入。
 * @returns {object} 合法配置。
 */
function normalize(raw) {
  const base = raw !== null && typeof raw === 'object' ? raw : {}
  return Object.assign({}, normalizeCore(base), { scenes: sanitizeScenes(base.scenes) })
}

/**
 * 配置主体（不含场景表）。场景里存的每份快照也走这里，所以它必须与 scenes 无关，避免自我嵌套。
 * @param {unknown} raw 原始输入。
 * @returns {object} 不含 scenes 的合法配置。
 */
function normalizeCore(raw) {
  const base = raw !== null && typeof raw === 'object' ? raw : {}
  const legacy = typeof base.greeting === 'string' || typeof base.signOff === 'string'
  const source = legacy ? { greeting: { text: base.greeting }, signOff: { text: base.signOff } } : base
  // matchMode 是 1.2.0 的新字段；旧的布尔 looseMatch 仍能读（false = 逐字相同）
  const matchMode = base.matchMode === undefined
    ? (base.looseMatch === false ? 'exact' : 'loose')
    : pickEnum(base.matchMode, MATCH_MODES, 'loose')
  return {
    greeting: sanitizeLine(source.greeting, DEFAULT_CONFIG.greeting),
    signOff: sanitizeLine(source.signOff, DEFAULT_CONFIG.signOff),
    matchMode,
    onlyAssistant: base.onlyAssistant !== false,
    legacyLines: sanitizeLegacyLines(base.legacyLines),
    pool: sanitizePool(base.pool),
    perWorkspace: sanitizeWorkspaceBindings(base.perWorkspace),
    switches: sanitizeSwitches(base.switches),
  }
}

/**
 * 配置缓存：按「mtime + 文件大小」判断是否需要重新读盘。
 * 提示段在每次组装提示时都会被调用，缓存后每轮只多一次 statSync，不再同步读整个文件。
 */
let configCache = { mtimeMs: -1, size: -1, config: null }

/** 读配置；文件不存在或损坏时回落到默认值，让下一次保存把它落盘。 */
function readConfig() {
  try {
    const stat = statSync(FILE_PATH)
    if (configCache.config !== null && stat.mtimeMs === configCache.mtimeMs && stat.size === configCache.size) {
      return configCache.config
    }
    const config = normalize(JSON.parse(readFileSync(FILE_PATH, 'utf8')))
    configCache = { mtimeMs: stat.mtimeMs, size: stat.size, config }
    return config
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code !== 'ENOENT') {
      console.error('[greet-signoff] config unreadable, using defaults:', error.message)
    }
    return normalize({})
  }
}

function writeConfig(raw) {
  const next = normalize(raw)
  // 图片落盘成独立文件，配置里只留短地址；再清掉不再引用的旧文件。
  next.greeting.image = materializeImage(next.greeting.image)
  next.signOff.image = materializeImage(next.signOff.image)
  mkdirSync(dirname(FILE_PATH), { recursive: true })
  const text = `${JSON.stringify(next, null, 2)}\n`
  // 原子写：先写 .tmp 再改名。直接覆盖时若正好崩溃/掉电，会留下半个 JSON，
  // 而读的时候只会静默回落到默认值 —— 用户看到的就是"我配的东西莫名没了"。
  // 同时把上一份留下的 .bak，供手工恢复。
  const tmpPath = `${FILE_PATH}.tmp`
  writeFileSync(tmpPath, text, 'utf8')
  try {
    if (existsSync(FILE_PATH)) copyFileSync(FILE_PATH, `${FILE_PATH}.bak`)
    renameSync(tmpPath, FILE_PATH)
  } catch (error) {
    console.error('[greet-signoff] atomic replace failed, falling back to direct write:', error.message)
    writeFileSync(FILE_PATH, text, 'utf8')
    try { unlinkSync(tmpPath) } catch { /* 临时文件删不掉不影响功能 */ }
  }
  configCache = { mtimeMs: -1, size: -1, config: null }
  gcAssets([next.greeting.image, next.signOff.image])
  return next
}

/** 提供已落盘的图片资产（长缓存，内容按哈希命名，天然可复用）。 */
function serveAsset(req, res, name) {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: `method ${method} not allowed` })
    return
  }
  if (!ASSET_NAME.test(name)) {
    sendJson(res, 404, { ok: false, error: 'bad asset name' })
    return
  }
  try {
    const body = readFileSync(join(ASSET_DIR, name))
    res.writeHead(200, {
      'content-type': `image/${name.endsWith('.jpg') ? 'jpeg' : name.split('.').pop()}`,
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': body.length,
    })
    res.end(method === 'HEAD' ? undefined : body)
  } catch {
    sendJson(res, 404, { ok: false, error: 'asset not found' })
  }
}

/**
 * 表情索引：从 emoji-zh.json 读一次并缓存成响应体（浏览器半首次展开表情框时才来取）。
 */
let emojiIndexBody = null

function serveEmojiIndex(req, res) {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: `method ${method} not allowed` })
    return
  }
  if (emojiIndexBody === null) {
    try {
      const parsed = JSON.parse(readFileSync(EMOJI_INDEX_PATH, 'utf8'))
      emojiIndexBody = JSON.stringify({ ok: true, source: parsed.source ?? '', index: parsed.index ?? {} })
    } catch (error) {
      console.error('[greet-signoff] emoji index unreadable:', error.message)
      sendJson(res, 500, { ok: false, error: 'emoji index unreadable' })
      return
    }
  }
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=86400',
    'content-length': Buffer.byteLength(emojiIndexBody),
  })
  res.end(method === 'HEAD' ? undefined : emojiIndexBody)
}

/* ─── 动态变量（与浏览器半保持同一套规则） ───────────────────────────── */
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const DAYPART_NAMES = ['凌晨好', '早上好', '上午好', '中午好', '下午好', '晚上好', '夜深了']

function daypartIndex(hour) {
  if (hour < 5) return 6
  if (hour < 8) return 0
  if (hour < 11) return 1
  if (hour < 13) return 3
  if (hour < 18) return 4
  if (hour < 23) return 5
  return 6
}

function pad2(value) {
  return (value < 10 ? '0' : '') + value
}

/**
 * 解析文案里的动态变量：`{date}` `{year}` `{month}` `{day}` `{weekday}` `{daypart}` `{time}`。
 * 不认识的 `{xxx}` 原样保留。
 * @param text - 含变量的文案。
 * @param now - 当前时间。
 * @returns 解析后的文案。
 */
function resolveTemplate(text, now) {
  if (typeof text !== 'string' || text.indexOf('{') < 0) return text
  const d = now instanceof Date ? now : new Date()
  return text.replace(/\{([a-zA-Z]+)\}/g, (all, rawName) => {
    const key = String(rawName).toLowerCase()
    if (key === 'date') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    if (key === 'year') return String(d.getFullYear())
    if (key === 'month') return pad2(d.getMonth() + 1)
    if (key === 'day') return pad2(d.getDate())
    if (key === 'weekday') return WEEKDAY_NAMES[d.getDay()]
    if (key === 'daypart') return DAYPART_NAMES[daypartIndex(d.getHours())]
    if (key === 'time') return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    return all
  })
}

/**
 * 文案池的轮换游标。只在进程内累计就够用 —— 轮换的目的是"别老重复"，不需要跨重启精确。
 */
const poolTicks = { greeting: 0, signOff: 0 }

/**
 * 本轮某一行的文案：文案池启用且这一行有内容时，从池子里挑一句；否则用固定文案。
 * 池子里的句子和固定文案走同一套动态变量解析，所以模型与页面看到的是同一句。
 * @param {object} config 已归一化的配置。
 * @param {'greeting'|'signOff'} kind 哪一行。
 * @param {Date} now 当前时间（动态变量用）。
 * @returns {string} 本轮要用的那一句（可能为空串）。
 */
function pickLine(config, kind, now, stats, binding) {
  const at = now instanceof Date ? now : new Date()
  // 工作区绑定最具体：命中且这一行有内容时直接用它（优先级高于文案池与固定文案）。
  const bound = binding !== undefined && binding !== null && typeof binding[kind] === 'string' ? binding[kind].trim() : ''
  if (bound.length > 0) return resolveRuntimeVars(resolveTemplate(bound, at), stats).trim()
  const fixed = resolveRuntimeVars(resolveTemplate(String((config[kind] ?? {}).text ?? ''), at), stats).trim()
  const pool = config.pool ?? {}
  if (pool.enabled !== true) return fixed
  const raw = Array.isArray(pool[kind]) ? pool[kind] : []
  const list = raw
    .map((item) => resolveRuntimeVars(resolveTemplate(item, at), stats).trim())
    .filter((item) => item.length > 0)
  if (list.length === 0) return fixed
  if (pool.mode === 'sequence') {
    const index = poolTicks[kind] % list.length
    poolTicks[kind] = index + 1
    return list[index]
  }
  return list[Math.floor(Math.random() * list.length)]
}

/* ─── 本轮信息变量：{model} / {count} / {elapsed} / {tokens} ─────────────── */

/**
 * 按会话记「最近一次模型调用」的模型名、耗时、用量，以及本会话已经跑过几次调用。
 * 数据源是 `llm/stream` 瀑布：只读 options、只透传 chunk，绝不改写请求。
 * 只放内存 —— 用途是"下一轮的固定行里报个数"，不需要落盘。
 */
const sessionStats = new Map()

/** 最近一次跑过模型调用的会话（拿不到精确会话时的兜底）。 */
let lastStatsSessionId = undefined

/** 按会话取统计；没有就返回 undefined。 */
function statsFor(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
  return sessionStats.get(sessionId)
}

/** apply() 里存下来的插件上下文：提示段回调里要用它取 agents 服务。 */
let pluginCtx = null

/** 数字的紧凑写法：3100 → 3.1k；没有数据时给一个占位符。 */
function formatTokenCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
  return String(Math.round(value))
}

/** 毫秒 → "12.4s" / "820ms"。 */
function formatElapsed(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return Math.round(ms) + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

/**
 * 运行时变量名白名单。页面侧**不解析**这些变量，而是用通配符匹配，
 * 所以两边的名单必须一致（客户端 client.js 里的 RUNTIME_VARS 也是这一份）。
 */
const RUNTIME_VARS = ['model', 'count', 'elapsed', 'lastelapsed', 'tokens', 'lasttokens']

/**
 * 解析"本轮信息变量"：
 * `{model}` 最近一次调用用的模型 · `{count}` 本会话第几次模型调用（本次）·
 * `{elapsed}` 上一次调用耗时 · `{tokens}` 上一次调用总 token。
 * 这些值只有服务端知道，所以页面侧靠通配符匹配（换任何数值都贴得上样式）。
 * @param {string} text 文案。
 * @param {object|undefined} stats 当前会话的统计。
 * @returns {string} 解析后的文案。
 */
function resolveRuntimeVars(text, stats) {
  if (typeof text !== 'string' || text.indexOf('{') < 0) return text
  return text.replace(/\{([a-zA-Z]+)\}/g, (all, rawName) => {
    const name = String(rawName).toLowerCase()
    if (name === 'model') return stats !== undefined && stats.lastModel.length > 0 ? stats.lastModel : '—'
    if (name === 'count') return String((stats === undefined ? 0 : stats.rounds) + 1)
    if (name === 'elapsed' || name === 'lastelapsed') return stats === undefined ? '—' : formatElapsed(stats.lastMs)
    if (name === 'tokens' || name === 'lasttokens') return stats === undefined ? '—' : formatTokenCount(stats.lastTokens)
    return all
  })
}

/**
 * 会话的创建时间（durable session.header.createdAt，Unix 毫秒）。
 * 浏览器半看不到 header，所以进度条的"已聊多久"要问宿主半要这个数。
 * @param {object|undefined} session 会话对象。
 * @returns {number|undefined} 毫秒时间戳；拿不到返回 undefined。
 */
function sessionStartedAtOf(session) {
  const header = session === undefined || session === null ? undefined : session.header
  const value = header === undefined || header === null ? undefined : header.createdAt
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * 当前正在组装提示的会话。
 * 优先用 `agents.currentInitiator()`（精确命中），取不到时退回"最近跑过一轮的会话"。
 * @returns {{id: string|undefined, exact: boolean, cwd: string|undefined, startedAt: number|undefined}} 会话信息。
 */
function currentSessionIdInfo() {
  try {
    const agents = pluginCtx === null ? undefined : pluginCtx.get('agents')
    const agent = agents === undefined || agents === null ? undefined : agents.currentInitiator()
    if (agent !== undefined && agent !== null) {
      const session = agent.session
      const cwd = session !== undefined && session !== null && session.header !== undefined
        ? (typeof session.header.cwd === 'string' ? session.header.cwd : undefined)
        : undefined
      const startedAt = sessionStartedAtOf(session)
      if (typeof agent.id === 'string' && agent.id.length > 0) return { id: agent.id, exact: true, cwd, startedAt }
      if (session !== undefined && session !== null && typeof session.id === 'string' && session.id.length > 0) {
        return { id: session.id, exact: true, cwd, startedAt }
      }
    }
  } catch (error) { /* 服务形态变了就退回兜底 */ }
  return { id: lastStatsSessionId, exact: false, cwd: undefined, startedAt: undefined }
}

/**
 * 按 id 取会话信息（进度条显示哪个会话就问哪个会话，而不是"当前正在跑的那个"）。
 * 找不到就返回拿着 id 的"未命中"结果：上一轮统计仍按 id 查得到，创建时间留给浏览器半本地估算。
 * @param {string|undefined} wanted 会话 id；缺省时退回"当前会话"。
 * @returns {{id: string|undefined, exact: boolean, cwd: string|undefined, startedAt: number|undefined}} 会话信息。
 */
function resolveSessionInfo(wanted) {
  if (typeof wanted !== 'string' || wanted.length === 0) return currentSessionIdInfo()
  try {
    const agents = pluginCtx === null ? undefined : pluginCtx.get('agents')
    const agent = agents === undefined || agents === null ? undefined : agents.get(wanted)
    const session = agent === undefined || agent === null ? undefined : agent.session
    if (session !== undefined && session !== null) {
      const cwd = session.header !== undefined && typeof session.header.cwd === 'string' ? session.header.cwd : undefined
      return { id: wanted, exact: true, cwd, startedAt: sessionStartedAtOf(session) }
    }
  } catch (error) { /* 落到未命中分支 */ }
  return { id: wanted, exact: false, cwd: undefined, startedAt: undefined }
}

/**
 * 包一层流：统计"这一次调用跑了多久 / 用了多少 token / 哪个模型"，chunk 原样透传。
 * @param {AsyncIterable} source 下游的 chunk 流。
 * @param {string} sessionId 会话 id。
 * @param {object} options 本次请求（只读，深冻结）。
 * @returns {AsyncIterable} 原样透传的流。
 */
async function* trackStream(source, sessionId, options) {
  const startedAt = Date.now()
  let tokens = 0
  try {
    for await (const chunk of source) {
      if (chunk !== null && chunk !== undefined && chunk.type === 'usage' && chunk.usage !== undefined) {
        const usage = chunk.usage
        const total = typeof usage.totalTokens === 'number'
          ? usage.totalTokens
          : Number(usage.inputTokens ?? 0) + Number(usage.outputTokens ?? 0)
        if (Number.isFinite(total) && total > 0) tokens = total
      }
      yield chunk
    }
  } finally {
    const entry = sessionStats.get(sessionId) ?? { rounds: 0, lastMs: 0, lastTokens: 0, lastModel: '', lastAt: 0 }
    entry.rounds += 1
    entry.lastMs = Date.now() - startedAt
    entry.lastTokens = tokens
    if (typeof options.model === 'string' && options.model.length > 0) entry.lastModel = options.model
    entry.lastAt = Date.now()
    sessionStats.set(sessionId, entry)
    lastStatsSessionId = sessionId
  }
}

/**
 * 模型可见的规则文本；两行的文本都为空时返回空串（该段不渲染）。
 * 图片与字号/颜色/动效只影响页面呈现，因此不进入提示词。
 * 动态变量在这里就解析成具体文字，模型与页面看到的是同一句（页面在渲染时也按同一规则解析）。
 * 文案池开启时，每次组装提示都会重新挑一句 —— 于是"每轮换一句"。
 */
function ruleText() {
  const config = readConfig()
  const info = currentSessionIdInfo()
  const stats = statsFor(info.id)
  return ruleTextWith(config, stats, info.cwd)
}

/* ─── 诊断类接口的纯逻辑（不碰磁盘，全部可单测） ─────────────────────────
 *
 * 两块：
 *  ① 花费：台账按天聚合 + 会话投影算单会话成本（aggregateLedger / parseSessionCost /
 *     rankSessionCosts / costCNYOf）；
 *  ② 交接落盘：文件名与最终路径的校验（parseHandoffFilename / resolveHandoffPath /
 *     validateHandoffText）。
 * 全部 fail-safe：任何字段对不上都回落到"空数据 + note"，绝不抛异常。
 */

/** 数字兜底：不是有限数字就按 0 算（投影文件里字段可能缺失或为 null）。 */
function numOr0(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 保留 4 位小数（金额展示用）。 */
function round4(value) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.round(num * 10000) / 10000
}

/**
 * 投影文件的行表：`{version, record:{rows:{<key>:{ver,seq,val}}}}`。
 * @param {unknown} doc 解析后的投影 JSON。
 * @returns {object} 行表；结构不认识时给空对象。
 */
function projcacheRows(doc) {
  if (doc === null || typeof doc !== 'object') return {}
  const record = doc.record
  if (record === null || typeof record !== 'object') return {}
  const rows = record.rows
  return rows !== null && typeof rows === 'object' ? rows : {}
}

/**
 * 取某一行的 val（`{ver, seq, val}` 里的 val）；缺失或不是对象时给空对象。
 * @param {unknown} row 行对象。
 * @returns {object} 该行的值。
 */
function rowVal(row) {
  if (row === null || typeof row !== 'object') return {}
  const value = row.val
  return value !== null && typeof value === 'object' ? value : {}
}

/**
 * 解析三个可能的自定义单价（元/百万 token）。
 * 每个字段独立判定：能解析成有限数字且落在 0~1000 就采纳，否则回落到内置默认价。
 * 一个都没采纳时 source 为 "default"（缺省请求走的就是这条路，行为与以前完全一致）。
 * @param {unknown} raw 形如 `{priceIn, priceCache, priceOut}` 的原始值（字符串/数字混合）。
 * @returns {{in:number, cacheRead:number, out:number, source:'custom'|'default'}} 本次生效的单价。
 */
function resolvePricing(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const inPrice = parsePriceParam(src.priceIn, COST_UNIT.uncachedPerM)
  const cachePrice = parsePriceParam(src.priceCache, COST_UNIT.cacheReadPerM)
  const outPrice = parsePriceParam(src.priceOut, COST_UNIT.outputPerM)
  return {
    in: inPrice,
    cacheRead: cachePrice,
    out: outPrice,
    source: inPrice !== COST_UNIT.uncachedPerM
      || cachePrice !== COST_UNIT.cacheReadPerM
      || outPrice !== COST_UNIT.outputPerM ? 'custom' : 'default',
  }
}

/** 单个单价参数：不是有效数字（或越界）就给内置默认值。 */
function parsePriceParam(value, fallback) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  const text = typeof value === 'string' ? value.trim() : value
  if (text === '') return fallback
  // 注意别用裸 Number()：Number([]) = 0、Number(true) = 1，会把脏数据当成合法价
  const num = typeof text === 'number' ? text : Number(text)
  if (!Number.isFinite(num) || num < COST_PRICE_MIN || num > COST_PRICE_MAX) return fallback
  return num
}

/**
 * 按给定单价算一笔钱（元）；不传单价就是内置价（老调用点的行为不变）。
 * @param {number} uncached 未命中输入 token。
 * @param {number} cacheRead 缓存命中输入 token。
 * @param {number} output 输出 token。
 * @param {{in:number, cacheRead:number, out:number}} [pricing] 本次生效的单价。
 * @returns {number} 保留 4 位小数的金额（元）。
 */
function costCNYWith(uncached, cacheRead, output, pricing) {
  const unit = pricing !== null && typeof pricing === 'object' ? pricing : null
  const inPerM = unit === null ? COST_UNIT.uncachedPerM : numOr0(unit.in)
  const cachePerM = unit === null ? COST_UNIT.cacheReadPerM : numOr0(unit.cacheRead)
  const outPerM = unit === null ? COST_UNIT.outputPerM : numOr0(unit.out)
  const raw = (numOr0(uncached) * inPerM
    + numOr0(cacheRead) * cachePerM
    + numOr0(output) * outPerM) / 1000000
  return round4(raw)
}

/**
 * 对账：用「本次生效单价」算出来的钱 vs 台账自带的 ledgerCostCNY。
 * gapRatio = |computed - ledger| / max(ledger, 极小值)；台账为 0（或非正）时给 0，绝不除零。
 * @param {number} computedCNY 本次生效单价算出来的金额（元）。
 * @param {number} ledgerCNY 台账自带的 cost（元）。
 * @returns {{computedCNY:number, ledgerCostCNY:number, gapRatio:number}} 对账信息。
 */
function reconcileGap(computedCNY, ledgerCNY) {
  const computed = round4(numOr0(computedCNY))
  const ledger = round4(numOr0(ledgerCNY))
  const base = Math.max(ledger, 0.000001)
  const gapRatio = ledger > 0 ? round4(Math.abs(computed - ledger) / base) : 0
  return { computedCNY: computed, ledgerCostCNY: ledger, gapRatio }
}

/**
 * 单会话成本（元）：未命中输入 1 / 缓存命中输入 0.02 / 输出 4（元每百万 token）。
 * @param {number} uncached 未命中输入 token。
 * @param {number} cacheRead 缓存命中输入 token。
 * @param {number} output 输出 token。
 * @returns {number} 保留 4 位小数的金额（元）。
 */
function costCNYOf(uncached, cacheRead, output) {
  return costCNYWith(uncached, cacheRead, output, null)
}

/**
 * 从会话投影里取"这一条会话花了多少 token"。
 * 优先用 `contextTimeline.val.cost`（按模型分桶、分 peak/off 时段，实测与 tokenUsage.totals 完全一致，
 * 键形如 `{flash:{off:{uncached,cacheRead,cacheWrite,output}, peak:{…}}}`），
 * 取不到时回落到 `tokenUsage.val.totals`（{uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}）。
 *
 * @param {unknown} doc 解析后的投影 JSON。
 * @param {{in:number, cacheRead:number, out:number}} [pricing] 本次生效的单价（缺省=内置价）。
 * @returns {{uncached:number, cacheRead:number, output:number, cacheWrite:number, costCNY:number,
 *   rounds:number, turns:number, title:string, models:string[]}} 单会话用量。
 */
function parseSessionCost(doc, pricing) {
  const empty = {
    uncached: 0, cacheRead: 0, output: 0, cacheWrite: 0, costCNY: 0,
    rounds: 0, turns: 0, title: '', models: [],
  }
  if (doc === null || doc === undefined || typeof doc !== 'object') return empty
  const rows = projcacheRows(doc)
  const timeline = rowVal(rows.contextTimeline)
  const cost = timeline.cost
  const models = []
  let uncached = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  if (cost !== null && typeof cost === 'object') {
    for (const model of Object.keys(cost)) {
      const buckets = cost[model]
      if (buckets === null || typeof buckets !== 'object') continue
      models.push(model)
      for (const bucket of Object.keys(buckets)) {
        const item = buckets[bucket]
        if (item === null || typeof item !== 'object') continue
        uncached += numOr0(item.uncached)
        cacheRead += numOr0(item.cacheRead)
        cacheWrite += numOr0(item.cacheWrite)
        output += numOr0(item.output)
      }
    }
  }
  if (uncached === 0 && cacheRead === 0 && output === 0) {
    const totals = rowVal(rows.tokenUsage).totals
    if (totals !== null && typeof totals === 'object') {
      uncached = numOr0(totals.uncachedInputTokens)
      cacheRead = numOr0(totals.cacheReadTokens)
      cacheWrite = numOr0(totals.cacheWriteTokens)
      output = numOr0(totals.outputTokens)
    }
  }
  const stats = rowVal(rows.sessionStats)
  const requests = Array.isArray(timeline.requests) ? timeline.requests : []
  const rounds = numOr0(stats.steps) > 0 ? numOr0(stats.steps) : requests.length
  const titleValue = rows.title === undefined || rows.title === null ? undefined : rows.title.val
  return {
    uncached,
    cacheRead,
    output,
    cacheWrite,
    costCNY: costCNYWith(uncached, cacheRead, output, pricing),
    rounds,
    turns: numOr0(stats.turns),
    title: typeof titleValue === 'string' ? titleValue.trim() : '',
    models,
  }
}

/**
 * 最贵会话排行：按 costCNY 降序取前 max 条；没有标题时给 sessionId 前 8 位。
 * @param {Array<{sessionId:string, title?:string, uncached?:number, cacheRead?:number, output?:number}>} list 全部会话用量。
 * @param {number} [max] 取几条。
 * @param {{in:number, cacheRead:number, out:number}} [pricing] 本次生效的单价（缺省=内置价）。
 * @returns {Array<{sessionId:string, title:string, costCNY:number}>} 排行。
 */
function rankSessionCosts(list, max, pricing) {
  const limit = clampInt(max, 1, 50, TOP_MAX)
  const items = Array.isArray(list) ? list : []
  return items
    .filter((item) => item !== null && typeof item === 'object' && typeof item.sessionId === 'string' && item.sessionId.length > 0)
    .map((item) => {
      const cost = costCNYWith(item.uncached, item.cacheRead, item.output, pricing)
      const title = typeof item.title === 'string' && item.title.trim().length > 0
        ? item.title.trim()
        : item.sessionId.slice(0, 8)
      return { sessionId: item.sessionId, title, costCNY: cost }
    })
    .filter((item) => item.costCNY > 0)
    .sort((a, b) => (b.costCNY !== a.costCNY ? b.costCNY - a.costCNY : (a.sessionId < b.sessionId ? -1 : 1)))
    .slice(0, limit)
}

/** 一天的原始累计（还没算钱）。 */
function emptyDayTotals() {
  return { uncached: 0, cacheRead: 0, output: 0, cacheWrite: 0, reasoning: 0, rounds: 0, ledgerCostCNY: 0 }
}

/**
 * 把台账里"某一天"的 `{provider:{model:{…}}}` 加成一份原始累计。
 * 台账字段实测：inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens /
 * reasoningTokens / calls / cost。
 * @param {unknown} day 台账 days[日期]。
 * @returns {object} 原始累计。
 */
function sumLedgerDay(day) {
  const out = emptyDayTotals()
  if (day === null || typeof day !== 'object') return out
  for (const provider of Object.keys(day)) {
    const models = day[provider]
    if (models === null || typeof models !== 'object') continue
    for (const model of Object.keys(models)) {
      const item = models[model]
      if (item === null || typeof item !== 'object') continue
      out.uncached += numOr0(item.inputTokens)
      out.cacheRead += numOr0(item.cacheReadTokens)
      out.cacheWrite += numOr0(item.cacheWriteTokens)
      out.output += numOr0(item.outputTokens)
      out.reasoning += numOr0(item.reasoningTokens)
      out.rounds += numOr0(item.calls)
      out.ledgerCostCNY += numOr0(item.cost)
    }
  }
  return out
}

/**
 * 对账用的台账金额：台账覆盖的天数 ≥ 扫描会话的覆盖范围时用整段（week），
 * 否则退回到"今天"这一天，避免拿"台账近 3 天"去比"全部会话"这种口径错位。
 * @param {unknown} ledger 台账。
 * @param {{today:object, week:object}} aggregate 已经算好的聚合。
 * @param {number} span 台账统计的天数。
 * @returns {number} 台账自带的 cost（元）。
 */
function reconcileLedgerCNY(ledger, aggregate, span) {
  const days = ledger !== null && typeof ledger === 'object' && ledger.days !== null && typeof ledger.days === 'object'
    ? Object.keys(ledger.days).length
    : 0
  return days >= span ? aggregate.week.ledgerCostCNY : aggregate.today.ledgerCostCNY
}

/** 把扫描到的全部会话按本次生效单价加总（对账的"算出金额"一侧）。 */
function sumSessionCosts(list, pricing) {
  const items = Array.isArray(list) ? list : []
  let total = 0
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue
    total += costCNYWith(item.uncached, item.cacheRead, item.output, pricing)
  }
  return round4(total)
}

/** 原始累计 → 对外的展示结构（含按本次生效单价算出的 costCNY）。 */
function finishDayTotals(raw, pricing) {
  return {
    costCNY: costCNYWith(raw.uncached, raw.cacheRead, raw.output, pricing),
    uncached: raw.uncached,
    cacheRead: raw.cacheRead,
    output: raw.output,
    cacheWrite: raw.cacheWrite,
    reasoning: raw.reasoning,
    rounds: raw.rounds,
    ledgerCostCNY: round4(raw.ledgerCostCNY),
  }
}

/** 本地日期键 YYYY-MM-DD（台账用的就是本地日期）。 */
function dayKeyOf(date) {
  const at = date instanceof Date ? date : new Date()
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`
}

/**
 * 台账按天聚合：今天 + 最近 days 天。
 * 结构不认识（没 days）时返回全 0，调用方据此把 source 记为 none。
 * @param {unknown} ledger 台账 JSON。
 * @param {number} days 统计最近几天（1~90）。
 * @param {Date|number} now 当前时间。
 * @param {{in:number, cacheRead:number, out:number}} [pricing] 本次生效的单价（缺省=内置价）。
 * @returns {{today:object, week:object}} 聚合结果。
 */
function aggregateLedger(ledger, days, now, pricing) {
  const at = now instanceof Date ? now : new Date(numOr0(now) > 0 ? now : Date.now())
  const span = clampInt(days, 1, 90, 7)
  const todayKey = dayKeyOf(at)
  const weekRaw = emptyDayTotals()
  let todayRaw = null
  const source = ledger !== null && typeof ledger === 'object' ? ledger.days : undefined
  if (source !== null && source !== undefined && typeof source === 'object') {
    for (let index = 0; index < span; index += 1) {
      const key = dayKeyOf(new Date(at.getFullYear(), at.getMonth(), at.getDate() - index))
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue
      const raw = sumLedgerDay(source[key])
      if (key === todayKey) todayRaw = raw
      weekRaw.uncached += raw.uncached
      weekRaw.cacheRead += raw.cacheRead
      weekRaw.output += raw.output
      weekRaw.cacheWrite += raw.cacheWrite
      weekRaw.reasoning += raw.reasoning
      weekRaw.rounds += raw.rounds
      weekRaw.ledgerCostCNY += raw.ledgerCostCNY
    }
  }
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate() - (span - 1))
  return {
    today: Object.assign({ date: todayKey }, finishDayTotals(todayRaw ?? emptyDayTotals(), pricing)),
    week: Object.assign(
      { days: span, from: dayKeyOf(start), to: todayKey },
      finishDayTotals(weekRaw, pricing),
    ),
  }
}

/**
 * 交接文件名校验：必须是纯文件名。
 * 拒绝空串、路径分隔符、`..`、冒号，另外顺带挡掉 Windows 保留字符与控制字符、
 * 长度超限、以点或空格结尾（Windows 会悄悄改掉这种名字）。
 * @param {unknown} raw 请求里的 filename（缺省用 HANDOFF.md）。
 * @returns {{ok:true, name:string}|{ok:false, error:string}} 校验结果。
 */
function parseHandoffFilename(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, name: HANDOFF_DEFAULT_NAME }
  if (typeof raw !== 'string') return { ok: false, error: 'filename 必须是字符串' }
  const name = raw.trim()
  if (name.length === 0) return { ok: false, error: 'filename 不能为空' }
  if (name.length > HANDOFF_NAME_MAX) return { ok: false, error: `filename 太长（上限 ${HANDOFF_NAME_MAX} 字符）` }
  if (name === '.' || name === '..' || name.indexOf('..') >= 0) return { ok: false, error: 'filename 不能包含 ..' }
  if (HANDOFF_BAD_CHARS.test(name)) return { ok: false, error: 'filename 不能包含路径分隔符或 : * ? " < > | 等字符' }
  if (name.endsWith('.') || name.endsWith(' ')) return { ok: false, error: 'filename 不能以点或空格结尾' }
  return { ok: true, name }
}

/**
 * 交接正文校验：必须是非空字符串、UTF-8 字节数不超过上限。
 * @param {unknown} text 请求里的 text。
 * @param {number} [limit] 字节上限。
 * @returns {{ok:true, bytes:number}|{ok:false, error:string}} 校验结果。
 */
function validateHandoffText(text, limit) {
  const max = clampInt(limit, 1, 100000000, HANDOFF_TEXT_LIMIT)
  if (typeof text !== 'string') return { ok: false, error: 'text 必须是字符串' }
  if (text.trim().length === 0) return { ok: false, error: 'text 不能为空' }
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes > max) return { ok: false, error: `text 太大（${bytes} 字节，上限 ${max} 字节）` }
  return { ok: true, bytes }
}

/**
 * 交接文件的最终路径：cwd 必须是绝对路径，文件名必须是纯文件名，结果必须严格落在 cwd 内。
 * 纯路径计算，不碰磁盘（目录是否存在由调用方另外检查）。
 * @param {unknown} cwd 请求里的 cwd。
 * @param {unknown} rawName 请求里的 filename。
 * @returns {{ok:true, root:string, path:string, name:string}|{ok:false, error:string}} 结果。
 */
function resolveHandoffPath(cwd, rawName) {
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return { ok: false, error: 'cwd 必须是绝对路径' }
  if (!isAbsolute(cwd.trim())) return { ok: false, error: 'cwd 必须是绝对路径' }
  const nameCheck = parseHandoffFilename(rawName)
  if (!nameCheck.ok) return nameCheck
  const root = resolve(cwd.trim())
  const target = resolve(root, nameCheck.name)
  // 双重保险：再按"必须以 root + 分隔符开头"校验一次，防止将来改动把穿越放进来。
  const prefix = root.endsWith(sep) ? root : root + sep
  const left = process.platform === 'win32' ? target.toLowerCase() : target
  const right = process.platform === 'win32' ? prefix.toLowerCase() : prefix
  if (!left.startsWith(right)) return { ok: false, error: '解析出的路径不在 cwd 内' }
  return { ok: true, root, path: target, name: nameCheck.name }
}

/** 目录是否存在且真的是目录。 */
function directoryExists(dir) {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

/** 读投影文件成 JSON；读不到或坏了都返回 null（不抛异常）。 */
function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 找一个会话的投影文件：实测两种命名都存在（互斥，不会同时有），
 * 22 个带 `session-` 前缀、28 个不带，所以两个都试。
 * @param {string|undefined} sessionId 会话 id。
 * @returns {string|null} 文件绝对路径；找不到或 id 形状不合法返回 null。
 */
function projcachePathFor(sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId) || sessionId.indexOf('..') >= 0) return null
  const prefixed = join(PROJCACHE_DIR, `session-${sessionId}.json`)
  if (existsSync(prefixed)) return prefixed
  const plain = join(PROJCACHE_DIR, `${sessionId}.json`)
  if (existsSync(plain)) return plain
  return null
}

/** 全部会话用量的扫描缓存（top 排行用；60 秒内复用，避免每次请求读 50 个文件）。 */
let costTopCache = { at: 0, list: [] }

/**
 * 扫一遍全部会话投影，收集每个会话的 token 用量（给"最贵会话"排行用）。
 * 单个文件坏掉就跳过，绝不影响整体。
 * @returns {Array<object>} [{sessionId, title, uncached, cacheRead, output}]。
 */
function scanSessionCosts() {
  const now = Date.now()
  if (now - costTopCache.at < TOP_CACHE_MS) return costTopCache.list
  const list = []
  let files = []
  try {
    files = readdirSync(PROJCACHE_DIR)
  } catch {
    files = []
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const sessionId = file.replace(/^session-/, '').replace(/\.json$/, '')
    if (!SESSION_ID_RE.test(sessionId)) continue
    const doc = readJsonFile(join(PROJCACHE_DIR, file))
    const parsed = parseSessionCost(doc)
    if (parsed.uncached === 0 && parsed.cacheRead === 0 && parsed.output === 0) continue
    list.push({
      sessionId,
      title: parsed.title,
      uncached: parsed.uncached,
      cacheRead: parsed.cacheRead,
      output: parsed.output,
    })
  }
  costTopCache = { at: now, list }
  return list
}

/**
 * 组装花费接口的响应体。
 * 台账只按「日期 → provider → model」累计，**没有会话维度**，所以：
 *   today / week ← 台账；session / top ← 会话投影（每会话的 cost + 标题）。
 * 单价可以按请求覆盖（`?priceIn=&priceCache=&priceOut=`，元/百万 token）：
 * session / today / week / top 四处金额一律用**本次生效的同一份单价**算，不混用；
 * 同时用 pricing 说明这次用的是自定义价还是内置价，用 reconcile 与台账自带的 cost 对账
 * （computedCNY = 扫描到的全部会话按本次生效单价算出来的总金额）。
 * @param {string|undefined} wanted 会话 id（缺省时用当前会话）。
 * @param {number} days 最近几天。
 * @param {number} now 当前时间戳。
 * @param {unknown} [rawPricing] 原始单价参数（`{priceIn, priceCache, priceOut}`，可选）。
 * @returns {object} 响应体（不含 ok）。
 */
function costBody(wanted, days, now, rawPricing) {
  const span = clampInt(days, 1, 90, 7)
  const at = new Date(numOr0(now) > 0 ? now : Date.now())
  const notes = []
  const pricing = resolvePricing(rawPricing)

  const ledger = readJsonFile(USAGE_LEDGER_PATH)
  const ledgerOk = ledger !== null && typeof ledger === 'object'
    && ledger.days !== null && typeof ledger.days === 'object'
  if (!ledgerOk) notes.push(`用量台账读不出来或结构不认识（${USAGE_LEDGER_PATH}），today/week 按 0 计`)
  const aggregate = aggregateLedger(ledgerOk ? ledger : null, span, at, pricing)
  if (span !== 7) notes.push(`week 统计的是最近 ${span} 天`)

  const info = resolveSessionInfo(wanted)
  const id = typeof info.id === 'string' && info.id.length > 0 ? info.id : null
  let session = {
    uncached: 0, cacheRead: 0, output: 0, cacheWrite: 0, costCNY: 0,
    rounds: 0, turns: 0, title: '', models: [],
  }
  let sessionSource = 'none'
  if (id !== null) {
    const file = projcachePathFor(id)
    const doc = file === null ? null : readJsonFile(file)
    if (doc === null) {
      notes.push('本条会话的 token 明细拿不到（投影文件缺失或损坏），session 按 0 计')
    } else {
      session = parseSessionCost(doc, pricing)
      sessionSource = 'projcache'
    }
  } else {
    notes.push('没有会话 id：session 一项按 0 计（地址可加 ?sessionId=<id>）')
  }

  const scanned = scanSessionCosts()
  const top = rankSessionCosts(scanned, TOP_MAX, pricing)
  if (top.length === 0) notes.push('没有扫描到任何会话用量，top 为空')

  const pricingOut = {
    in: numOr0(pricing.in),
    cacheRead: numOr0(pricing.cacheRead),
    out: numOr0(pricing.out),
    source: pricing.source,
  }
  // 对账：把"扫描到的全部会话 token"按本次生效单价算出来的钱，跟台账自带的 cost 比一比。
  // 两边口径都覆盖全部会话（台账没有会话维度），差额比例才有意义。
  const reconcile = reconcileGap(sumSessionCosts(scanned, pricing), reconcileLedgerCNY(ledger, aggregate, span))

  return {
    sessionId: id,
    source: ledgerOk ? 'ledger' : 'none',
    sessionSource,
    unit: Object.assign({}, COST_UNIT),
    pricing: pricingOut,
    session: {
      uncached: session.uncached,
      cacheRead: session.cacheRead,
      output: session.output,
      cacheWrite: session.cacheWrite,
      costCNY: session.costCNY,
      rounds: session.rounds,
      turns: session.turns,
      title: session.title,
      models: session.models,
    },
    today: aggregate.today,
    week: aggregate.week,
    top,
    reconcile,
    note: notes.join('；'),
  }
}

/**
 * 把交接摘要写进文件（唯一一处写操作）。
 * 文件已存在时先原样复制一份 `<同名>.bak` 再覆盖，避免把上一次的交接冲掉。
 * @param {string} target 目标文件绝对路径。
 * @param {string} text 正文。
 * @returns {{bytes:number, replaced:boolean}} 写入结果。
 */
function writeHandoffFile(target, text) {
  const bytes = Buffer.byteLength(text, 'utf8')
  let replaced = false
  if (existsSync(target)) {
    copyFileSync(target, `${target}.bak`)
    replaced = true
  }
  writeFileSync(target, text, 'utf8')
  return { bytes, replaced }
}

/**
 * 处理交接落盘请求（POST /api/greet-signoff/handoff）。
 * @param {object} req 请求。
 * @param {object} res 响应。
 */
function handleHandoff(req, res) {
  const method = req.method ?? 'GET'
  if (method !== 'POST') {
    sendJson(res, 405, { ok: false, error: `method ${method} not allowed` })
    return
  }
  readBody(req, HANDOFF_BODY_LIMIT).then((raw) => {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      sendJson(res, 400, { ok: false, error: 'body is not JSON' })
      return
    }
    const body = parsed !== null && typeof parsed === 'object' ? parsed : {}
    const pathCheck = resolveHandoffPath(body.cwd, body.filename)
    if (!pathCheck.ok) {
      sendJson(res, 400, { ok: false, error: pathCheck.error })
      return
    }
    if (!directoryExists(pathCheck.root)) {
      sendJson(res, 400, { ok: false, error: `cwd 目录不存在：${pathCheck.root}` })
      return
    }
    const textCheck = validateHandoffText(body.text)
    if (!textCheck.ok) {
      sendJson(res, 400, { ok: false, error: textCheck.error })
      return
    }
    try {
      const written = writeHandoffFile(pathCheck.path, body.text)
      console.log('[greet-signoff] handoff written:', pathCheck.path, `${written.bytes} bytes, replaced=${written.replaced}`)
      sendJson(res, 200, { ok: true, path: pathCheck.path, bytes: written.bytes, replaced: written.replaced })
    } catch (error) {
      sendJson(res, 400, { ok: false, error: `写文件失败：${String(error?.message ?? error)}` })
    }
  }).catch((error) => {
    sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
  })
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req, limitBytes = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function handleApi(req, res) {
  const method = req.method ?? 'GET'
  const pathname = String(req.url ?? '').split('?')[0]
  // /api/greet-signoff/asset/<name> → 直接回图片文件
  if (pathname.indexOf(ASSET_PREFIX) === 0) {
    serveAsset(req, res, pathname.slice(ASSET_PREFIX.length))
    return
  }
  // /api/greet-signoff/emoji-index → 表情中文名/关键词索引（浏览器半懒加载用）
  if (pathname === `${API_PATH}/emoji-index`) {
    serveEmojiIndex(req, res)
    return
  }
  // /api/greet-signoff/rule-text → 自检用：现在这一刻模型会看到的规则文本（含运行时变量解析结果）
  // 带 ?cwd=<路径> 时用这个路径代替会话工作目录，用来验证"按工作区换文案"到底命中了没有。
  if (pathname === `${API_PATH}/rule-text`) {
    const rawUrl = String(req.url ?? '')
    const cwdMatch = /[?&]cwd=([^&]*)/.exec(rawUrl)
    const info = currentSessionIdInfo()
    const cwd = cwdMatch === null ? info.cwd : decodeURIComponent(cwdMatch[1])
    const stats = statsFor(info.id)
    const config = readConfig()
    const binding = matchWorkspaceBinding(config.perWorkspace, cwd)
    sendJson(res, 200, {
      ok: true,
      hostVersion: HOST_VERSION,
      sessionId: info.id ?? null,
      exactSession: info.exact,
      cwd: cwd ?? null,
      bindingPath: binding === undefined ? null : binding.path,
      stats: stats === undefined ? null : { rounds: stats.rounds, lastMs: stats.lastMs, lastTokens: stats.lastTokens, lastModel: stats.lastModel },
      text: ruleTextWith(config, stats, cwd),
    })
    return
  }
  // /api/greet-signoff/cost → 本条会话花了多少 / 今天与最近几天花了多少 / 最贵的会话是哪些
  // 可带 ?sessionId=<id>&days=7（days 夹在 1~90）。任何数据缺失都只影响对应字段，接口本身始终 200。
  // v1.19.0 起还可带 ?priceIn=&priceCache=&priceOut=（元/百万 token，夹在 0~1000，非法/缺失回落内置默认价）：
  // 三处金额一律用本次生效的同一份单价算，响应里给 pricing 与 reconcile 便于核对。
  if (pathname === `${API_PATH}/cost`) {
    const rawUrl = String(req.url ?? '')
    const idMatch = /[?&]sessionId=([^&]*)/.exec(rawUrl)
    const wanted = idMatch === null ? undefined : decodeURIComponent(idMatch[1])
    const daysMatch = /[?&]days=(\d{1,3})/.exec(rawUrl)
    const rawPricing = {}
    const priceRe = new RegExp(`[?&](${PRICE_PARAM_KEYS.join('|')})=([^&]*)`, 'g')
    let priceMatch = priceRe.exec(rawUrl)
    while (priceMatch !== null) {
      rawPricing[priceMatch[1]] = decodeURIComponent(priceMatch[2])
      priceMatch = priceRe.exec(rawUrl)
    }
    sendJson(res, 200, Object.assign({ ok: true, hostVersion: HOST_VERSION }, costBody(
      wanted,
      daysMatch === null ? 7 : Number(daysMatch[1]),
      Date.now(),
      rawPricing,
    )))
    return
  }
  // /api/greet-signoff/handoff → 把"换会话交接摘要"落盘成一个文件（本插件唯一的写操作）
  if (pathname === `${API_PATH}/handoff`) {
    handleHandoff(req, res)
    return
  }
  if (method === 'GET') {
    sendJson(res, 200, { ok: true, path: FILE_PATH, hostVersion: HOST_VERSION, config: readConfig() })
    return
  }
  if (method === 'POST') {
    readBody(req).then((text) => {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        sendJson(res, 400, { ok: false, error: 'body is not JSON' })
        return
      }
      const next = writeConfig(parsed)
      console.log('[greet-signoff] config saved:', FILE_PATH)
      sendJson(res, 200, { ok: true, path: FILE_PATH, config: next })
    }).catch((error) => {
      sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
    })
    return
  }
  sendJson(res, 405, { ok: false, error: `method ${method} not allowed` })
}

/**
 * 安装插件：注册提示段与配置接口。
 * @param ctx - 本行的插件上下文。
 */
export function apply(ctx) {
  pluginCtx = ctx

  // 本轮信息变量：包一层 llm/stream 只做统计（不改请求、不改 chunk）。
  const offStream = ctx.on('llm/stream', (options, next) => {
    const stream = next()
    const sessionId = options !== null && options !== undefined && typeof options.sessionId === 'string' ? options.sessionId : undefined
    // 压缩、起标题这类内部调用不算"一轮回复"，不参与统计
    if (sessionId === undefined || options.purpose !== undefined) return stream
    return trackStream(stream, sessionId, options)
  }, { global: true })
  ctx.effect(() => offStream, 'greet-signoff:stream-stats')

  const prompt = ctx.get('systemPrompt')
  if (prompt === undefined) {
    console.error('[greet-signoff] systemPrompt service unavailable')
  } else {
    ctx.effect(
      () => prompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: () => ruleText() }),
      'greet-signoff:prompt-section',
    )
  }

  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    console.error('[greet-signoff] webServer service unavailable; config API not mounted')
  } else {
    ctx.effect(
      () => webServer.register({ kind: 'prefix', path: API_PATH, handler: handleApi }),
      'greet-signoff:api-route',
    )
  }

  console.log(`[greet-signoff] mounted v${HOST_VERSION}; config file: ${FILE_PATH}; client bundle: ${CLIENT_PATH}`)
}

/**
 * 仅供单测使用：DSH 的模块加载器只认 name/inject/apply，不会读这个导出。
 */
export const __test = {
  pickLine,
  resolveRuntimeVars,
  resolveTemplate,
  formatElapsed,
  formatTokenCount,
  sessionStartedAtOf,
  sanitizePool,
  sanitizePoolList,
  sanitizeSwitches,
  sanitizeScenes,
  scenesOf,
  sanitizeWorkspaceBindings,
  matchWorkspaceBinding,
  pathKey,
  normalize,
  normalizeCore,
  ruleTextWith,
  // 诊断类接口（花费 / 交接）的纯逻辑
  parseSessionCost,
  rankSessionCosts,
  aggregateLedger,
  sumLedgerDay,
  costCNYOf,
  costCNYWith,
  resolvePricing,
  reconcileGap,
  sumSessionCosts,
  scanSessionCosts,
  round4,
  dayKeyOf,
  parseHandoffFilename,
  resolveHandoffPath,
  validateHandoffText,
  projcacheRows,
  rowVal,
  // 接口组装入口：单测里用假的 req/res 直接打这两个路由（不启 DSH，也不碰真实数据以外的文件）
  costBody,
  writeHandoffFile,
  handleApi,
}

/** 自检/单测用：给定配置、统计与工作目录，算出模型会看到的规则文本。 */
function ruleTextWith(config, stats, cwd) {
  const now = new Date()
  const binding = matchWorkspaceBinding(config.perWorkspace, cwd)
  // 总开关（v1.22.0）：关掉的那一行直接不参与挑选，也不写进提示段 ——
  // 不调用 pickLine 是为了不白白推进文案池的轮换游标（关着的行不该吃配额）。
  const switches = sanitizeSwitches(config !== null && typeof config === 'object' ? config.switches : undefined)
  const greeting = switches.greeting ? pickLine(config, 'greeting', now, stats, binding).trim() : ''
  const signOff = switches.signOff ? pickLine(config, 'signOff', now, stats, binding).trim() : ''
  if (greeting.length === 0 && signOff.length === 0) return ''
  const lines = ['开场与收尾（本会话强制要求 / mandatory for every reply）：']
  if (greeting.length > 0) lines.push(`- 每一次回复的正文都必须以这一行原样开头：${greeting}`)
  if (signOff.length > 0) lines.push(`- 每一次回复的正文都必须以这一行原样结尾：${signOff}`)
  lines.push('- 固定行要独立成行，保持原样、不翻译、不改写、不加序号或引号；不要省略。')
  lines.push('- 只有这些固定行有格式要求；正文照常回答，保持正常详略。')
  lines.push('- 包括工具调用后的最终回复在内，每一轮回复都适用；纯工具调用步骤不需要输出固定行。')
  lines.push('- 图片与字体样式属于页面显示，不要试图在正文里放置图片或 Markdown 图片语法。')
  // 交接包（v1.14.0）：换会话时把摘要落成了工作区根目录的 HANDOFF.md —— 新会话开场先把它读过来，
  // 免得上一条会话的结论随上下文一起沉底。只在文件确实存在时才提这一句，不打扰没有交接的会话。
  if (typeof cwd === 'string' && cwd.length > 0) {
    try {
      if (existsSync(join(cwd, 'HANDOFF.md'))) {
        lines.push('- 这个工作区有 HANDOFF.md（上一条会话留下的交接摘要）：开工前先用 read 工具读它，再动手。')
      }
    } catch {
      /* 路径不可读就当没有 */
    }
  }
  return lines.join('\n')
}
