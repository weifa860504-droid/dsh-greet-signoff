/**
 * 开场语与收尾语 — 常驻插件（宿主半）
 *
 * 职责：
 *  1. 读取配置文件（默认 <DSH_HOME>/greet-signoff.json），向系统提示注册一段「开场与收尾」规则，
 *     让模型每次回复的正文都以配置的开场行开头、收尾行结尾；
 *  2. 提供同源 HTTP 接口，供页面上的设置编辑器读写配置：GET/POST /api/greet-signoff。
 *
 * 配置结构（每一行都可以带样式；样式只在页面上呈现，不写进提示词）：
 *   {
 *     greeting: { text, image, imageHeight, fontSize, fontWeight, color, animation, … },
 *     signOff:  { …同一结构… },
 *     warnPercent, criticalPercent, looseMatch
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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-greet-signoff'
// 两个服务都必须等就绪再 apply：宿主组合里的行会在 Web Server 之前挂载，
// 早期版本只声明 systemPrompt，导致 ctx.get('webServer') 拿到 undefined、
// 配置接口整段没注册（页面读写配置直接 401）。
export const inject = ['systemPrompt', 'webServer']

const API_PATH = '/api/greet-signoff'
/** 宿主半版本号：与 package.json、浏览器半的 CLIENT_VERSION 保持一致。
 *  它挂在启动日志里，用来核对"服务到底加载的是哪份代码"（热重载后也能看出来）。 */
const HOST_VERSION = '1.12.0'
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

const FILE_PATH = join(DSH_HOME, 'greet-signoff.json')
const ASSET_DIR = join(DSH_HOME, 'greet-signoff-assets')
const CLIENT_PATH = fileURLToPath(new URL('./client.js', import.meta.url))
/** 表情中文名/关键词索引（1.2.0 起从 client.js 里搬出来，首次打开表情框才加载）。 */
const EMOJI_INDEX_PATH = fileURLToPath(new URL('./emoji-zh.json', import.meta.url))

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
  warnPercent: 70,
  criticalPercent: 85,
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
  const warnPercent = clampInt(base.warnPercent, 1, 99, DEFAULT_CONFIG.warnPercent)
  const criticalPercent = clampInt(base.criticalPercent, 2, 100, DEFAULT_CONFIG.criticalPercent)
  // matchMode 是 1.2.0 的新字段；旧的布尔 looseMatch 仍能读（false = 逐字相同）
  const matchMode = base.matchMode === undefined
    ? (base.looseMatch === false ? 'exact' : 'loose')
    : pickEnum(base.matchMode, MATCH_MODES, 'loose')
  return {
    greeting: sanitizeLine(source.greeting, DEFAULT_CONFIG.greeting),
    signOff: sanitizeLine(source.signOff, DEFAULT_CONFIG.signOff),
    warnPercent,
    criticalPercent: Math.max(warnPercent + 1, criticalPercent),
    matchMode,
    onlyAssistant: base.onlyAssistant !== false,
    legacyLines: sanitizeLegacyLines(base.legacyLines),
    pool: sanitizePool(base.pool),
    perWorkspace: sanitizeWorkspaceBindings(base.perWorkspace),
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
  // /api/greet-signoff/session → 进度条的"时间功能"要的两样东西：
  //   ① 本会话的创建时间（浏览器半看不到 session.header.createdAt）；
  //   ② 本会话上一轮统计。带 ?sessionId= 时按 id 精确查——进度条显示哪个会话就问哪个会话。
  if (pathname === `${API_PATH}/session`) {
    const rawUrl = String(req.url ?? '')
    const idMatch = /[?&]sessionId=([^&]*)/.exec(rawUrl)
    const wanted = idMatch === null ? undefined : decodeURIComponent(idMatch[1])
    const info = resolveSessionInfo(wanted)
    const stats = statsFor(info.id)
    sendJson(res, 200, {
      ok: true,
      hostVersion: HOST_VERSION,
      sessionId: info.id ?? null,
      exactSession: info.exact,
      startedAt: typeof info.startedAt === 'number' ? info.startedAt : null,
      now: Date.now(),
      stats: stats === undefined ? null : {
        rounds: stats.rounds,
        lastMs: stats.lastMs,
        lastTokens: stats.lastTokens,
        lastModel: stats.lastModel,
        lastAt: typeof stats.lastAt === 'number' ? stats.lastAt : null,
      },
    })
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
  sanitizeScenes,
  scenesOf,
  sanitizeWorkspaceBindings,
  matchWorkspaceBinding,
  pathKey,
  normalize,
  normalizeCore,
  ruleTextWith,
}

/** 自检/单测用：给定配置、统计与工作目录，算出模型会看到的规则文本。 */
function ruleTextWith(config, stats, cwd) {
  const now = new Date()
  const binding = matchWorkspaceBinding(config.perWorkspace, cwd)
  const greeting = pickLine(config, 'greeting', now, stats, binding).trim()
  const signOff = pickLine(config, 'signOff', now, stats, binding).trim()
  if (greeting.length === 0 && signOff.length === 0) return ''
  const lines = ['开场与收尾（本会话强制要求 / mandatory for every reply）：']
  if (greeting.length > 0) lines.push(`- 每一次回复的正文都必须以这一行原样开头：${greeting}`)
  if (signOff.length > 0) lines.push(`- 每一次回复的正文都必须以这一行原样结尾：${signOff}`)
  lines.push('- 固定行要独立成行，保持原样、不翻译、不改写、不加序号或引号；不要省略。')
  lines.push('- 只有这些固定行有格式要求；正文照常回答，保持正常详略。')
  lines.push('- 包括工具调用后的最终回复在内，每一轮回复都适用；纯工具调用步骤不需要输出固定行。')
  lines.push('- 图片与字体样式属于页面显示，不要试图在正文里放置图片或 Markdown 图片语法。')
  return lines.join('\n')
}
