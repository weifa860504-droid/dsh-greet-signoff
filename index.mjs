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
]
const SHAPES = ['none', 'pill', 'round', 'soft', 'rect', 'card', 'tag', 'underline', 'highlight', 'blockquote']
const FILLS = ['none', 'faint', 'theme', 'solid']
const SHADOWS = ['none', 'soft', 'medium', 'strong', 'glow']
const CAPS = ['none', 'upper', 'lower']
const WEIGHTS = [400, 500, 600, 700, 800]
/** 匹配模式（与浏览器半保持同一套取值）。 */
const MATCH_MODES = ['exact', 'loose', 'fuzzy']
/** 颜色字段只允许 #rgb / #rrggbb / #rrggbbaa，避免任意字符串进样式。 */
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

const DSH_HOME = process.env.DSH_HOME && process.env.DSH_HOME.length > 0
  ? process.env.DSH_HOME
  : join(process.env.USERPROFILE ?? process.cwd(), '.dsh')

const FILE_PATH = join(DSH_HOME, 'greet-signoff.json')
const ASSET_DIR = join(DSH_HOME, 'greet-signoff-assets')
const CLIENT_PATH = fileURLToPath(new URL('./client.js', import.meta.url))

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

function sanitizeLine(raw, fallback) {
  const base = raw !== null && typeof raw === 'object' ? raw : {}
  const animation = typeof base.animation === 'string' && ANIMATIONS.indexOf(base.animation) >= 0
    ? base.animation
    : fallback.animation
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

/** 把任意输入归一化成合法配置；缺失字段回落到默认值；兼容旧的字符串写法。 */
function normalize(raw) {
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
 * 模型可见的规则文本；两行的文本都为空时返回空串（该段不渲染）。
 * 图片与字号/颜色/动效只影响页面呈现，因此不进入提示词。
 * 动态变量在这里就解析成具体文字，模型与页面看到的是同一句（页面在渲染时也按同一规则解析）。
 */
function ruleText() {
  const config = readConfig()
  const now = new Date()
  const greeting = resolveTemplate(config.greeting.text, now).trim()
  const signOff = resolveTemplate(config.signOff.text, now).trim()
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
  if (method === 'GET') {
    sendJson(res, 200, { ok: true, path: FILE_PATH, config: readConfig() })
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

  console.log(`[greet-signoff] mounted; config file: ${FILE_PATH}; client bundle: ${CLIENT_PATH}`)
}
