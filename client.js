window.__ModuleLoader__.load({ id: "dsh-greet-signoff", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
// 开场语与收尾语 — 常驻插件（浏览器半，手写产物，无构建步骤）
//
// 三处 UI：
//   1) 设置 → 通用 里的「开场语与收尾语」行（内含完整编辑器）；
//   2) 设置导航里的独立页「开场收尾」（同一个编辑器）；
//   3) 输入框上方的卡片：只显示上下文占用进度条与超限提醒（开场/收尾两行不再在此重复展示）。
//
// 配置的唯一真源是宿主侧的 JSON 文件，这里只通过同源接口读写：
//   GET  /api/greet-signoff  → 读；POST /api/greet-signoff → 写（保存后立即生效）。
// 样式只影响页面呈现（提示词里只进文本），因此改样式不会污染我的回复正文。

var React = require("react");

var API = "/api/greet-signoff";
var ANIMATIONS = [
  { value: "none", label: "无", loop: false, duration: 0.5 },
  { value: "fade", label: "淡入", loop: false, duration: 0.6 },
  { value: "slide", label: "从左滑入", loop: false, duration: 0.6 },
  { value: "slideUp", label: "从下滑入", loop: false, duration: 0.6 },
  { value: "slideRight", label: "从右滑入", loop: false, duration: 0.6 },
  { value: "drop", label: "落下", loop: false, duration: 0.7 },
  { value: "blur", label: "模糊聚焦", loop: false, duration: 0.8 },
  { value: "zoom", label: "缩放出现", loop: false, duration: 0.7 },
  { value: "flip", label: "翻转", loop: false, duration: 0.9 },
  { value: "unfold", label: "展开", loop: false, duration: 0.7 },
  { value: "sweep", label: "光泽扫过", loop: true, duration: 3 },
  { value: "shine", label: "高光划过", loop: true, duration: 2.6 },
  { value: "pulse", label: "呼吸", loop: true, duration: 1.8 },
  { value: "heartbeat", label: "心跳", loop: true, duration: 1.4 },
  { value: "glow", label: "发光", loop: true, duration: 2.2 },
  { value: "neon", label: "霓虹闪", loop: true, duration: 1.8 },
  { value: "blink", label: "闪烁", loop: true, duration: 1.6 },
  { value: "bounce", label: "弹跳", loop: true, duration: 1.2 },
  { value: "shake", label: "抖动", loop: true, duration: 0.9 },
  { value: "wobble", label: "摇晃", loop: true, duration: 1.6 },
  { value: "swing", label: "摆动", loop: true, duration: 1.6 },
  { value: "tilt", label: "倾斜", loop: true, duration: 2.4 },
  { value: "float", label: "漂浮", loop: true, duration: 2.6 },
  { value: "spin", label: "旋转", loop: true, duration: 3.2 },
  { value: "wave", label: "波浪", loop: true, duration: 2.4 },
  { value: "rainbow", label: "彩虹流动", loop: true, duration: 4 }
];
/** 形状预设：胶囊就是左右半圆（padding 撑起来后即"药丸/胶囊"） */
var SHAPES = [
  { value: "none", label: "无（纯文字）", radius: 0, padding: 0 },
  { value: "pill", label: "胶囊 / 药丸型", radius: 999, padding: 7 },
  { value: "round", label: "圆角矩形", radius: 12, padding: 5 },
  { value: "soft", label: "小圆角", radius: 6, padding: 3 },
  { value: "rect", label: "直角矩形", radius: 0, padding: 5 },
  { value: "card", label: "卡片", radius: 14, padding: 9 },
  { value: "tag", label: "标签", radius: 4, padding: 3 },
  { value: "underline", label: "下划线", radius: 0, padding: 3 },
  { value: "highlight", label: "荧光笔", radius: 3, padding: 2 },
  { value: "blockquote", label: "引用条", radius: 4, padding: 5 }
];
var FILLS = [
  { value: "none", label: "无填充" },
  { value: "faint", label: "淡色底" },
  { value: "theme", label: "跟随主题" },
  { value: "solid", label: "自定义底色" }
];
var SHADOWS = [
  { value: "none", label: "无阴影" },
  { value: "soft", label: "柔和" },
  { value: "medium", label: "中等" },
  { value: "strong", label: "明显" },
  { value: "glow", label: "发光" }
];
var DECOR_SHAPES = ["pill", "round", "soft", "rect", "card", "tag", "highlight", "blockquote"];
var DECOR_FILLS = ["faint", "theme", "solid"];
var DECOR_SHADOWS = ["soft", "medium", "strong", "glow"];

/** 动效名 → 配置（时长/是否循环），以及给 CSS 用的简写。 */
var ANIM_MAP = (function () {
  var map = Object.create(null);
  ANIMATIONS.forEach(function (item) { map[item.value] = item; });
  return map;
})();

/**
 * 一条线的 class：基础类 + 动效类 + 形状/填充装饰类。
 * @param {Object} line 配置里的行对象。
 * @param {string} base 基础类名，如 "gs-line" / "gs-chat-signoff"。
 * @returns {string} 拼好的 class 字符串。
 */
function lineClassOf(line, base) {
  var list = [base];
  if (ANIM_MAP[line.animation] !== undefined && line.animation !== "none") list.push("gs-anim-" + line.animation);
  if (typeof line.shape === "string" && DECOR_SHAPES.indexOf(line.shape) !== -1) list.push("gs-shape-" + line.shape);
  if (typeof line.fill === "string" && DECOR_FILLS.indexOf(line.fill) !== -1) list.push("gs-fill-" + line.fill);
  if (typeof line.shadow === "string" && DECOR_SHADOWS.indexOf(line.shadow) !== -1) list.push("gs-shadow-" + line.shadow);
  return list.join(" ");
}

var WEIGHTS = [400, 500, 600, 700, 800];
var COLORS = ["", "#d93026", "#e0721a", "#1a9e6b", "#2f6fed", "#8b5cf6", "#6b7280"];
var EMOJIS = ["👋", "✅", "⚠️", "🚨", "🎉", "💡", "📌", "🤝", "🔔", "🌟", "🙌", "😊", "🚀", "📎", "✨", "🧭", "☕", "🎯", "💬", "📝"];

// 表情中文名与关键词索引：由 Unicode CLDR（common/annotations/zh.xml）生成，只保留本机有字形的码位。
// 结构：{ "码位16进制": ["表情", "中文名", "关键词|关键词|…"] }。用于表情框的搜索（如「皇冠」→👑、「鞭炮」→🧨、「钱包」→👛）。
var EMOJI_INDEX = null; // 懒加载：首次打开表情框时向宿主请求 emoji-zh.json

/** 表情框的统计（扫到多少、留了多少、剔掉多少没有字形的），用于界面提示与自检。 */
var EMOJI_SCAN = { total: 0, kept: 0, blank: 0 };

/**
 * 本机字体覆盖表：这些码位在 Windows 自带字体里没有任何字形，画出来就是"空白格子"。
 * （2026-09 在本机用 Segoe UI Emoji + 全部已装字体逐字测字得出，共 431 个，合并成 35 段。）
 * 判断按"基码位"（不含 U+FE0F 变体选择符）进行：变体选择符本身没有字形，不代表表情不存在。
 */
var BLANK_BASE_RANGES = [
  [127020, 127023], [127124, 127135], [127151, 127152], [127168, 127168], [127184, 127184],
  [127222, 127231], [127406, 127461], [127491, 127503], [127548, 127551], [127561, 127567],
  [127570, 127583], [127590, 127743], [128729, 128731], [128749, 128751], [128765, 128767],
  [128986, 128991], [129004, 129007], [129009, 129023], [129036, 129039], [129096, 129103],
  [129114, 129119], [129160, 129167], [129198, 129199], [129212, 129215], [129218, 129231],
  [129241, 129279], [129624, 129631], [129646, 129647], [129661, 129663], [129675, 129677],
  [129735, 129735], [129737, 129740], [129757, 129758], [129771, 129774], [129785, 129791]
];

/**
 * 该码位是否有可见字形。
 * @param {number} cp Unicode 码位（基码位，不含 U+FE0F）。
 * @returns {boolean} 有字形为 true；没有字形的表情必须从表情框里剔除，否则会出现一整片空格子。
 */
function hasGlyph(cp) {
  for (var i = 0; i < BLANK_BASE_RANGES.length; i += 1) {
    if (cp >= BLANK_BASE_RANGES[i][0] && cp <= BLANK_BASE_RANGES[i][1]) return false;
  }
  return true;
}

/**
 * 浏览器实测兜底：字体被换过 / 系统装过别的表情字体时，静态表可能不准。
 * 用离屏 canvas 量字符宽度：没有字形的码位宽度等于"必然缺失"的 U+10FFFF 的宽度。
 * @returns {Function|null} 传入单个字符，返回 true 表示宽度正常（有字形）；测不了时返回 null。
 */
function makeWidthTester() {
  try {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    var family = "system-ui, 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif";
    ctx.font = "40px " + family;
    var blankWidth = ctx.measureText(String.fromCodePoint(0x10ffff)).width;
    if (!(blankWidth > 0)) return null;
    return function (ch) {
      return ctx.measureText(ch).width > blankWidth + 0.5;
    };
  } catch (error) {
    return null;
  }
}

/**
 * 扫一遍 Unicode 表情码位，剔除本机没有字形的，返回可显示的表情列表。
 * 只在"表情数据懒加载完成"时调用一次（此前用 EMOJIS 里的常用表情顶着）。
 * @returns {string[]} 可显示的表情字符（带变体选择符）。
 */
function scanAllEmojis() {
  try {
    var isPictographic = new RegExp("\\p{Extended_Pictographic}", "u");
    // 默认是"文字样式"的表情（如 ❤ / 🏎 / ✈）要补一个变体选择符 U+FE0F，才会显示成彩色表情
    var isEmojiPresentation = new RegExp("\\p{Emoji_Presentation}", "u");
    var ranges = [
      [0x1f300, 0x1faff], [0x1f000, 0x1f2ff], [0x2600, 0x27bf], [0x2b00, 0x2bff],
      [0x1f1e6, 0x1f1ff], [0x2190, 0x21ff], [0x2900, 0x297f], [0x2b05, 0x2b07],
      [0x203c, 0x203c], [0x2049, 0x2049], [0x2122, 0x2122], [0x2139, 0x2139],
      [0x3030, 0x3030], [0x303d, 0x303d], [0x3297, 0x3297], [0x3299, 0x3299]
    ];
    var tester = makeWidthTester();
    var list = [];
    var seen = {};
    var scanned = 0;
    for (var r = 0; r < ranges.length; r += 1) {
      for (var cp = ranges[r][0]; cp <= ranges[r][1]; cp += 1) {
        var base = String.fromCodePoint(cp);
        if (!isPictographic.test(base)) continue;
        scanned += 1;
        // 剔除没有字形的码位（否则表情框里会出现一整片点不动的空格子）
        if (!hasGlyph(cp)) continue;
        if (tester !== null && !tester(base)) continue;
        var ch = isEmojiPresentation.test(base) ? base : base + "\uFE0F";
        if (seen[ch] === true) continue;
        seen[ch] = true;
        list.push(ch);
      }
    }
    EMOJI_SCAN = { total: scanned, kept: list.length, blank: scanned - list.length };
    return list.length > 200 ? list : EMOJIS.slice();
  } catch (error) {
    EMOJI_SCAN = { total: 0, kept: EMOJIS.length, blank: 0 };
    return EMOJIS.slice();
  }
}

/** 表情数据状态：idle / loading / ready / failed。 */
var emojiDataState = "idle";
var emojiDataPromise = null;
/** 表情列表：加载完成前先用常用表情顶着（避免一进页面就扫 3800 个码位）。 */
var ALL_EMOJIS = EMOJIS.slice();

/**
 * 懒加载表情数据：向宿主取 emoji-zh.json（中文名/关键词索引），再扫一遍可用表情。
 * 只在用户第一次展开表情框时调用，成功/失败都只算一次。
 * @returns {Promise<boolean>} 拿到数据为 true。
 */
function loadEmojiData() {
  if (emojiDataState === "ready") return Promise.resolve(true);
  if (emojiDataState === "loading") return emojiDataPromise;
  emojiDataState = "loading";
  emojiDataPromise = fetch(API + "/emoji-index", { headers: { accept: "application/json" } })
    .then(function (res) { return res.json(); })
    .then(function (payload) {
      if (payload === null || typeof payload !== "object" || payload.ok !== true
        || payload.index === null || typeof payload.index !== "object") {
        throw new Error("emoji index payload invalid");
      }
      EMOJI_INDEX = payload.index;
      ALL_EMOJIS = scanAllEmojis();
      emojiSearchIndex = null;
      emojiDataState = "ready";
      return true;
    })
    .catch(function (error) {
      console.error("[greet-signoff] emoji index load failed", error);
      emojiDataState = "failed";
      return false;
    });
  return emojiDataPromise;
}
var IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
var MAX_IMAGE_BYTES = 300 * 1024;

/** 表情数据状态的中文说明（按钮与提示里用）。 */
function emojiTotalLabel() {
  if (emojiDataState === "ready") return ALL_EMOJIS.length + " 个可显示表情";
  if (emojiDataState === "loading") return "正在加载…";
  if (emojiDataState === "failed") return "索引加载失败（先用常用表情）";
  return "点开时加载";
}

/** 最近用过的表情：只存浏览器本地，不进配置文件。 */
var RECENT_KEY = "gs.signoff.recent";
var RECENT_MAX = 18;

/** 惰性构建的"中文关键词 → 码位"倒排索引与"码位 → 有没有字形"缓存（只建一次）。 */
var emojiSearchIndex = null;
var emojiGlyphCache = null;

/**
 * 构建搜索索引：把 EMOJI_INDEX 里每个表情的中文名与关键词都指向它的码位。
 * @returns {Object} 形如 { "皇冠": [127569], "钱包": [128091] } 的倒排表。
 */
function buildEmojiSearchIndex() {
  var index = {};
  if (EMOJI_INDEX === null) return index;
  Object.keys(EMOJI_INDEX).forEach(function (key) {
    var cp = parseInt(key, 16);
    var entry = EMOJI_INDEX[key];
    var words = [entry[1]].concat((entry[2] || "").split("|"));
    words.forEach(function (word) {
      if (word.length === 0) return;
      if (index[word] === undefined) index[word] = [];
      if (index[word].indexOf(cp) === -1) index[word].push(cp);
    });
  });
  return index;
}

/**
 * 该码位在当前环境是否真有字形（宽度实测优先，测不了则退回静态表）。
 * @param {number} cp Unicode 码位（基码位，不含 U+FE0F）。
 * @returns {boolean} true 表示能显示。
 */
function emojiHasGlyph(cp) {
  if (emojiGlyphCache === null) {
    var cache = Object.create(null);
    var tester = null;
    try {
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = "40px system-ui, 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif";
        var blankWidth = ctx.measureText(String.fromCodePoint(0x10ffff)).width;
        if (blankWidth > 0) {
          tester = function (ch) { return ctx.measureText(ch).width > blankWidth + 0.5; };
        }
      }
    } catch (error) { tester = null; }
    emojiGlyphCache = { tester: tester, map: cache };
  }
  var known = emojiGlyphCache.map[cp];
  if (known !== undefined) return known;
  var ok = true;
  if (emojiGlyphCache.tester !== null) ok = emojiGlyphCache.tester(String.fromCodePoint(cp));
  else ok = hasGlyph(cp);
  emojiGlyphCache.map[cp] = ok;
  return ok;
}

/**
 * 按中文名/关键词（以及表情本身）搜索表情。
 * 支持空格或逗号分隔的多个关键词（全部命中才算），例如「钱 袋」。
 * @param {string} query 用户输入。
 * @returns {string[]} 命中的表情字符（保持原顺序）。
 */
function searchEmojis(query) {
  var terms = query.trim().split(/[\s,，、]+/).filter(function (t) { return t.length > 0; });
  if (terms.length === 0) return [];
  if (emojiSearchIndex === null) emojiSearchIndex = buildEmojiSearchIndex();
  var index = emojiSearchIndex;
  var results = null;
  for (var i = 0; i < terms.length; i += 1) {
    var term = terms[i];
    var lower = term.toLowerCase();
    var set = Object.create(null);
    var added = 0;
    // 1) 直接是某个表情或它的码位（如粘贴 👑、输入 1f451）
    for (var c = 0; c < term.length;) {
      var cp = term.codePointAt(c);
      if (cp !== undefined && emojiHasGlyph(cp) && ALL_EMOJIS.indexOf(String.fromCodePoint(cp)) !== -1) {
        set[cp] = true;
        added += 1;
      }
      c += cp > 0xffff ? 2 : 1;
    }
    // 2) 命中关键词的中文名/关键词前缀（数组顺序即码位顺序）
    Object.keys(index).forEach(function (word) {
      if (word.indexOf(term) === -1 && word.toLowerCase().indexOf(lower) === -1) return;
      index[word].forEach(function (target) {
        if (set[target] !== true) { set[target] = true; added += 1; }
      });
    });
    // 3) 兜底：全表扫一遍（中文名/关键词的子串匹配，慢但只在用户输入时发生）
    if (added === 0) {
      ALL_EMOJIS.forEach(function (ch) {
        var target = ch.codePointAt(0);
        if (set[target] === true) return;
        var entry = EMOJI_INDEX === null ? undefined : EMOJI_INDEX[target.toString(16)];
        if (entry === undefined) return;
        var hay = entry[1] + "|" + (entry[2] || "");
        if (hay.indexOf(term) !== -1 || hay.toLowerCase().indexOf(lower) !== -1) {
          set[target] = true;
          added += 1;
        }
      });
    }
    var cpSet = Object.keys(set).map(function (key) { return Number(key); });
    if (results === null) results = cpSet;
    else {
      var keep = Object.create(null);
      cpSet.forEach(function (cp) { keep[cp] = true; });
      results = results.filter(function (cp) { return keep[cp] === true; });
    }
    if (results.length === 0) break;
  }
  var allowed = Object.create(null);
  (results || []).forEach(function (cp) { allowed[cp] = true; });
  return ALL_EMOJIS.filter(function (ch) { return allowed[ch.codePointAt(0)] === true; });
}

/** 读取最近用过的表情（浏览器本地存储，异常时返回空数组）。 */
function readRecentEmojis() {
  try {
    var raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (item) { return typeof item === "string" && item.length > 0; }).slice(0, RECENT_MAX);
  } catch (error) {
    return [];
  }
}

/** 写入最近用过的表情。 */
function writeRecentEmojis(list) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch (error) { /* 隐私模式等忽略 */ }
}

var TEXT_LIMIT = 200;
/** 匹配模式：exact 逐字相同 / loose 宽松（忽略大小写、空白、全半角与首尾标点）/ fuzzy 近似容错。 */
var MATCH_MODES = ["exact", "loose", "fuzzy"];
/** 客户端半的版本号（诊断区显示；与 package.json 的 version 保持一致）。 */
var CLIENT_VERSION = "1.4.0";

/** 匹配模式的中文名（折叠标题与诊断区显示用）。 */
function matchModeLabel(mode) {
  if (mode === "exact") return "逐字相同";
  if (mode === "fuzzy") return "近似容错";
  return "宽松匹配";
}

/**
 * 样式预设：只包含"外观"字段，永远不动文案与图片。
 * 点一下就把这套外观套到当前标签页（或两行都套），比手调 19 项快得多。
 */
var STYLE_PRESETS = [
  {
    id: "caishen", name: "财神金", dot: "#e0721a",
    style: { color: "#e0721a", colorDark: "#ffb545", fontWeight: 700, animation: "shine", animSpeed: 1, shape: "pill", radius: 999, padY: 5, fill: "faint", shadow: "soft", letterSpacing: 0, caps: "none", italic: false }
  },
  {
    id: "minimal", name: "极简灰", dot: "#6b7280",
    style: { color: "#4b5563", colorDark: "#9ca3af", fontWeight: 500, animation: "fade", animSpeed: 1, shape: "none", radius: 0, padY: 0, fill: "none", bgColor: "", bgColorDark: "", borderWidth: 0, shadow: "none", letterSpacing: 0, caps: "none", italic: false }
  },
  {
    id: "loud", name: "大字醒目", dot: "#d93026",
    style: { color: "#c0261c", colorDark: "#ff7b70", fontSize: 20, fontWeight: 800, animation: "zoom", shape: "card", radius: 14, padY: 8, fill: "solid", bgColor: "#fff3f3", bgColorDark: "#3a1c1c", borderWidth: 1, borderColor: "#f3c6c6", borderColorDark: "#7a3b3b", shadow: "soft", letterSpacing: 0, caps: "none", italic: false }
  },
  {
    id: "neon", name: "霓虹赛博", dot: "#00e5a0",
    style: { color: "#00a37a", colorDark: "#5cffc8", fontWeight: 700, animation: "neon", shape: "tag", radius: 6, padY: 5, fill: "faint", borderWidth: 1, borderColor: "#00e5a0", borderColorDark: "#5cffc8", shadow: "glow", letterSpacing: 1, caps: "none", italic: false }
  },
  {
    id: "sakura", name: "樱花", dot: "#e0729a",
    style: { color: "#d1507f", colorDark: "#ff9ec4", fontWeight: 600, animation: "pulse", shape: "soft", radius: 12, padY: 6, fill: "solid", bgColor: "#fff0f5", bgColorDark: "#3a1f2b", borderWidth: 0, shadow: "soft", letterSpacing: 0, caps: "none", italic: false }
  },
  {
    id: "typewriter", name: "复古打字", dot: "#8b6f47",
    style: { color: "#7a5c3a", colorDark: "#d8b98c", fontWeight: 500, animation: "none", shape: "underline", radius: 0, padY: 2, fill: "none", bgColor: "", bgColorDark: "", borderWidth: 0, shadow: "none", letterSpacing: 1, caps: "none", italic: false }
  }
];

var DEFAULT_LINE = {
  text: "",
  image: "",
  imageHeight: 22,
  fontSize: 14,
  fontWeight: 600,
  color: "",
  /* 深色主题下的专用颜色：留空表示沿用上面的浅色值 */
  colorDark: "",
  animation: "none",
  animSpeed: 1,
  shape: "none",
  radius: 12,
  padY: 5,
  fill: "none",
  bgColor: "",
  bgColorDark: "",
  borderWidth: 0,
  borderColor: "",
  borderColorDark: "",
  shadow: "none",
  letterSpacing: 0,
  caps: "none",
  italic: false
};

var DEFAULTS = {
  greeting: Object.assign({}, DEFAULT_LINE, { text: "👋 你好，我是 DeepSeek Harness 助手。" }),
  signOff: Object.assign({}, DEFAULT_LINE, { text: "✅ 以上，随时叫我。" }),
  warnPercent: 70,
  criticalPercent: 85,
  matchMode: "loose",
  onlyAssistant: true,
  legacyLines: []
};

/* ─── 样式 ────────────────────────────────────────────────────────────── */

function css() {
  return [
    ".gs-panel{box-sizing:border-box;width:100%;padding:0 0 58px;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
    /* ── 新版布局：吸顶头部（标签页 + 实时预览）+ 可折叠分区卡片 ── */
    // 预览跟着滚动吸在顶上，改下面的参数时不用滚回去看效果。
    ".gs-stickyhead{position:sticky;top:-2px;z-index:6;padding:10px 0 8px;background:var(--dsw-alias-bg-base);box-shadow:0 6px 10px -8px rgba(0,0,0,.28)}",
    ".gs-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);margin-top:10px;overflow:hidden}",
    ".gs-card>.gs-fold{padding:10px 12px}",
    ".gs-card>.gs-fold-open{border-bottom:1px solid var(--dsw-alias-border-l2)}",
    ".gs-fold-body{padding:4px 12px 12px}",
    // 顶部预览卡片：虚线框、更紧凑；非当前编辑的那行淡一些
    ".gs-preview{margin-top:8px;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);flex-direction:column;gap:4px;display:flex}",
    ".gs-preview-line{opacity:.55;transition:opacity .15s ease}",
    ".gs-preview-line.gs-preview-on{opacity:1}",
    ".gs-field{flex-direction:column;gap:4px;margin-top:10px;display:flex}",
    ".gs-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
    ".gs-hint{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}",
    ".gs-hint-error{color:var(--dsw-alias-state-error-primary)}",
    ".gs-input,.gs-textarea,.gs-select{box-sizing:border-box;width:100%;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px}",
    ".gs-textarea{min-height:56px;resize:vertical}",
    ".gs-emojis{gap:4px;flex-wrap:wrap;display:flex;align-items:center}",
    ".gs-emojis-page{margin-top:6px;padding:6px;max-height:150px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:2px;background:var(--dsw-alias-bg-layer-1)}",
    ".gs-emoji-tools{margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}",
    ".gs-emoji-search{box-sizing:border-box;width:180px;height:28px;padding:0 24px 0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:26px}",
    ".gs-emoji-searchwrap{position:relative;display:inline-flex;align-items:center}",
    ".gs-emoji-clear{position:absolute;right:4px;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;cursor:pointer}",
    ".gs-emoji-count{color:var(--dsw-alias-label-tertiary);font-size:12px}",
    ".gs-emoji-recent{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:6px}",
    ".gs-emoji-cell{height:28px;padding:0;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font-size:17px;line-height:1;cursor:pointer}",
    ".gs-emoji-cell:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-emoji{width:28px;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:0 0;font-size:15px;line-height:1;cursor:pointer}",
    ".gs-emoji:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-inline{align-items:center;gap:8px;flex-wrap:wrap;display:flex}",
    ".gs-range{width:180px}",
    ".gs-swatch{width:26px;height:26px;border:2px solid var(--dsw-alias-border-l2);border-radius:8px;cursor:pointer;padding:0}",
    ".gs-swatch-on{border-color:var(--dsw-alias-label-primary)}",
    ".gs-color{width:36px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:0 0}",
    ".gs-thumb{max-width:120px;max-height:40px;object-fit:contain}",
    ".gs-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}",
    ".gs-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    ".gs-btn:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
    ".gs-btn-on{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1)}",
    /* 主按钮悬停时必须保住文字颜色：否则会变成"背景浅、文字也浅"→字像是消失了 */
    ".gs-btn-on:hover:not(:disabled){border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);opacity:.86}",
    ".gs-saved{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px}",
    ".gs-tabs{gap:6px;display:flex}",
    ".gs-tab{height:26px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:13px;background:0 0;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}",
    ".gs-tab-on{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1)}",
    ".gs-mark{height:30px;min-width:36px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:13px;background:0 0;color:var(--dsw-alias-label-primary);font-size:17px;line-height:1;cursor:pointer}",
    ".gs-mark:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-mark.gs-tab-on{border-color:transparent;background:var(--dsw-alias-label-primary)}",
    ".gs-scheme{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}",
    ".gs-scheme:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-scheme-on{border-color:var(--dsw-alias-label-primary)}",
    ".gs-scheme-bar{width:34px;height:8px;border-radius:999px;display:inline-block}",
    ".gs-sec-title{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-bottom:6px}",
    ".gs-row2{align-items:center;gap:8px;display:flex;margin-top:8px;min-width:0;flex-wrap:wrap}",
    ".gs-row2>.gs-label{flex:none;width:52px}",
    /* 两列自适应网格：窄栏自动落成单列，宽栏并排，纵向省一半高度 */
    ".gs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:8px 12px;margin-top:4px;align-items:center}",
    ".gs-cell{display:flex;align-items:center;gap:6px;min-width:0}",
    ".gs-cell-wide{grid-column:1/-1}",
    ".gs-cell>.gs-label{flex:none;width:52px;color:var(--dsw-alias-label-secondary);font-size:12px}",
    ".gs-cellgroup{align-items:center;gap:6px;display:flex;min-width:0;flex:1;flex-wrap:wrap}",
    ".gs-cellgroup>.gs-range{flex:1;min-width:56px}",
    ".gs-cellgroup>.gs-select,.gs-cellgroup>.gs-input{flex:1;min-width:0}",
    ".gs-unit{flex:none;width:auto;color:var(--dsw-alias-label-tertiary)}",
    ".gs-num{width:58px}",
    ".gs-range{flex:1;min-width:110px;accent-color:var(--dsw-alias-label-primary)}",
    ".gs-num{width:66px;flex:none;text-align:center;padding:4px 6px}",
    ".gs-select{height:30px;padding:4px 8px;font-size:13px}",
    ".gs-file{display:none}",
    ".gs-actions{position:sticky;bottom:0;z-index:7;margin-top:10px;padding:10px 0 6px;gap:8px;align-items:center;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:flex;flex-wrap:wrap}",
    ".gs-thumbwrap{align-items:center;gap:6px;display:inline-flex}",
    ".gs-dock{box-sizing:border-box;width:100%;margin:0 0 6px;padding:5px 0 0;position:relative;background:none;border:0;box-shadow:none}",
    // 反制宿主主题：皮肤主题会给输入区附属卡片（[data-slot="conversation.input.dock"] > *）强制上白底/圆角/阴影，
    // 那条规则带 !important，普通内联样式压不住；这里用同样带 !important、且特异性更高的选择器把它抵消掉，
    // 否则外层会显示一块比进度条宽得多的白底（用户看到的"多余白框"）。
    'html[data-dsh-skin] [data-slot="conversation.input.dock"] > .gs-dock:not([data-gs-dock]),html[data-dsh-skin] [data-slot="conversation.composer.dock"] > .gs-dock:not([data-gs-dock]),html[data-dsh-custom-theme] [data-slot="conversation.input.dock"] > .gs-dock:not([data-gs-dock]),html[data-dsh-custom-theme] [data-slot="conversation.composer.dock"] > .gs-dock:not([data-gs-dock]){background:none !important;border:0 !important;box-shadow:none !important}',
    ".gs-dock-row{box-sizing:border-box;width:100%}",
    ".gs-dock-bar{position:relative;width:100%;height:var(--gs-bar-h,9px);border-radius:999px;background-color:var(--dsw-alias-interactive-bg-hover);background-image:var(--gs-scale-faint,none);background-size:100% 100%;background-repeat:no-repeat}",
    ".gs-dock-fill{height:100%;border-radius:999px;transition:width .35s ease,background-color .35s ease;background-image:var(--gs-scale,none);background-size:calc(10000% / var(--gs-percent,100)) 100%;background-repeat:no-repeat}",
    ".gs-dock-critical .gs-dock-fill{animation:gs-alarm 1.1s ease-in-out infinite}",
    ".gs-marker{position:absolute;top:50%;transform:translate(-50%,-50%);transition:left .35s ease;pointer-events:none;z-index:2;display:flex;align-items:center;justify-content:center}",
    ".gs-marker-emoji{font-size:calc(var(--gs-bar-h,9px) + var(--gs-marker-extra,12px));line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.28));animation:gs-drive 1.4s ease-in-out infinite}",
    ".gs-marker-img{height:calc(var(--gs-bar-h,9px) + var(--gs-marker-extra,12px) + 3px);width:auto;max-width:110px;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.28));animation:gs-drive 1.4s ease-in-out infinite}",
    ".gs-marker-pct{position:absolute;bottom:calc(100% + 1px);left:50%;transform:translateX(-50%);padding:1px 5px;border-radius:999px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:14px;font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".gs-marker-critical .gs-marker-pct{background:var(--gs-danger,#d93026);color:#fff}",
    "@keyframes gs-drive{0%,100%{transform:translateY(0) rotate(0deg) scaleX(var(--gs-flip,1))}50%{transform:translateY(-2px) rotate(-2deg) scaleX(var(--gs-flip,1))}}",
    "@keyframes gs-alarm{0%,100%{opacity:1}50%{opacity:.55}}",
    ".gs-tip{position:absolute;left:0;bottom:calc(100% + 6px);z-index:6;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s ease}",
    ".gs-dock:hover .gs-tip{opacity:1}",
    ".gs-dock-alert{margin-top:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
    ".gs-dock-new{margin-left:8px;padding:1px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}",
    ".gs-dock-new:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    /* 动态变量小标签 */
    ".gs-tagbtn{padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:18px;cursor:pointer}",
    ".gs-tagbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    /* 样式预设卡片 */
    ".gs-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
    ".gs-preset{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}",
    ".gs-preset:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-preset-dot{display:inline-block;width:10px;height:10px;border-radius:999px}",
    ".gs-legacy-row{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap}",
    ".gs-legacy-row>.gs-input{flex:1;min-width:140px}",
    ".gs-diag{display:flex;flex-direction:column;gap:2px;margin-top:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
    ".gs-diag code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
    /* 紧凑形态：不显示百分比气泡；纯文字形态：只留一行提示 */
    ".gs-dock-compact .gs-marker-pct{display:none}",
    ".gs-dock-textrow{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
    ".gs-dock-textdot{display:inline-block;width:8px;height:8px;border-radius:999px;flex:none}",
    ".gs-fold{align-items:center;gap:6px;display:flex;cursor:pointer;user-select:none}",
    ".gs-fold-caret{color:var(--dsw-alias-label-tertiary);font-size:10px;width:10px}",
    ".gs-fold-sum{color:var(--dsw-alias-label-caption);margin-left:auto;font-size:12px}",
    /* 对话正文里的开场/收尾行：只加类与样式，不插入/移动任何节点（避免动到 React 的 DOM） */
    ".gs-chat-line{white-space:pre-wrap}",
    ".gs-chat-line.gs-chat-img::before{content:'';display:inline-block;background-position:left center;background-repeat:no-repeat;background-size:contain;vertical-align:-0.16em;margin-right:6px}",
    "@keyframes gs-fade{from{opacity:0}to{opacity:1}}",
    "@keyframes gs-slide{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}",
    "@keyframes gs-slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes gs-slideRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}",
    "@keyframes gs-drop{0%{opacity:0;transform:translateY(-14px) scale(.98)}60%{opacity:1;transform:translateY(3px)}100%{transform:translateY(0)}}",
    "@keyframes gs-blur{from{opacity:0;filter:blur(6px)}to{opacity:1;filter:blur(0)}}",
    "@keyframes gs-zoom{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}",
    "@keyframes gs-flip{from{opacity:0;transform:perspective(400px) rotateY(80deg)}to{opacity:1;transform:perspective(400px) rotateY(0)}}",
    "@keyframes gs-unfold{from{opacity:0;transform:scaleX(.7);transform-origin:left center}to{opacity:1;transform:scaleX(1)}}",
    "@keyframes gs-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}",
    "@keyframes gs-heartbeat{0%,100%{transform:scale(1)}14%{transform:scale(1.11)}28%{transform:scale(1)}42%{transform:scale(1.09)}56%{transform:scale(1)}}",
    "@keyframes gs-glow{0%,100%{filter:brightness(1) drop-shadow(0 0 0 transparent)}50%{filter:brightness(1.2) drop-shadow(0 0 7px currentColor)}}",
    "@keyframes gs-neon{0%,100%{opacity:1;text-shadow:0 0 7px currentColor,0 0 15px currentColor}45%{opacity:.72;text-shadow:0 0 3px currentColor}60%{opacity:1;text-shadow:0 0 11px currentColor,0 0 22px currentColor}}",
    "@keyframes gs-blink{0%,100%{opacity:1}50%{opacity:.32}}",
    "@keyframes gs-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}55%{transform:translateY(0)}72%{transform:translateY(-2px)}}",
    "@keyframes gs-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}",
    "@keyframes gs-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-2.2deg)}75%{transform:rotate(2.2deg)}}",
    "@keyframes gs-swing{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}",
    "@keyframes gs-tilt{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}",
    "@keyframes gs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
    "@keyframes gs-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}",
    "@keyframes gs-wave{0%,100%{transform:skewX(0)}25%{transform:skewX(4deg)}75%{transform:skewX(-4deg)}}",
    "@keyframes gs-rainbow{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}",
    "@keyframes gs-shine{0%{background-position:-140% 0}100%{background-position:240% 0}}",
    "@keyframes gs-sweep{0%{background-position:0% 50%}100%{background-position:200% 50%}}",
    ".gs-anim{--gs-anim-speed:1}",
    ".gs-anim-fade{animation:gs-fade calc(.6s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-slide{animation:gs-slide calc(.6s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-slideUp{animation:gs-slideUp calc(.6s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-slideRight{animation:gs-slideRight calc(.6s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-drop{animation:gs-drop calc(.7s * var(--gs-anim-speed,1)) cubic-bezier(.3,1.4,.5,1) both}",
    ".gs-anim-blur{animation:gs-blur calc(.8s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-zoom{animation:gs-zoom calc(.7s * var(--gs-anim-speed,1)) cubic-bezier(.3,1.4,.5,1) both}",
    ".gs-anim-flip{animation:gs-flip calc(.9s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-unfold{animation:gs-unfold calc(.7s * var(--gs-anim-speed,1)) ease both}",
    ".gs-anim-pulse{animation:gs-pulse calc(1.8s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-heartbeat{animation:gs-heartbeat calc(1.4s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-glow{animation:gs-glow calc(2.2s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-neon{animation:gs-neon calc(1.8s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-blink{animation:gs-blink calc(1.6s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-bounce{animation:gs-bounce calc(1.2s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-shake{animation:gs-shake calc(.9s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-wobble{animation:gs-wobble calc(1.6s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-swing{animation:gs-swing calc(1.6s * var(--gs-anim-speed,1)) ease-in-out infinite;transform-origin:top center}",
    ".gs-anim-tilt{animation:gs-tilt calc(2.4s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-float{animation:gs-float calc(2.6s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-spin{animation:gs-spin calc(3.2s * var(--gs-anim-speed,1)) linear infinite}",
    ".gs-anim-wave{animation:gs-wave calc(2.4s * var(--gs-anim-speed,1)) ease-in-out infinite}",
    ".gs-anim-rainbow{animation:gs-rainbow calc(4s * var(--gs-anim-speed,1)) linear infinite}",
    ".gs-anim-sweep{background-image:linear-gradient(90deg,currentColor,transparent 45%,currentColor 90%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}",
    ".gs-anim-shine{background-image:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.85) 50%,transparent 65%);background-size:220% 100%;background-repeat:no-repeat;animation:gs-shine calc(2.6s * var(--gs-anim-speed,1)) linear infinite}",
    /* 形状与填充：胶囊用超大圆角；decor 类只在有样式（编辑器预览 / 对话正文）时出现 */
    ".gs-decor{--gs-radius:12px;--gs-line-pad:5px;box-sizing:border-box;border-radius:var(--gs-radius);padding:var(--gs-line-pad) calc(var(--gs-line-pad) * 2.2);display:inline-block}",
    ".gs-shape-none{border-radius:0;padding:0}",
    ".gs-shape-pill{border-radius:999px}",
    ".gs-shape-round{border-radius:12px}",
    ".gs-shape-soft{border-radius:6px}",
    ".gs-shape-rect{border-radius:0}",
    ".gs-shape-card{border-radius:14px}",
    ".gs-shape-tag{border-radius:4px}",
    ".gs-shape-underline{border-radius:0;border-bottom:2px solid currentColor;padding-bottom:1px}",
    ".gs-shape-highlight{border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone}",
    ".gs-shape-blockquote{border-radius:4px;border-left:3px solid currentColor}",
    ".gs-fill-faint{background:color-mix(in srgb, currentColor 12%, transparent)}",
    ".gs-fill-theme{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-shadow-soft{box-shadow:0 1px 3px rgba(0,0,0,.16)}",
    ".gs-shadow-medium{box-shadow:0 3px 10px rgba(0,0,0,.2)}",
    ".gs-shadow-strong{box-shadow:0 6px 18px rgba(0,0,0,.28)}",
    ".gs-shadow-glow{box-shadow:0 0 10px currentColor}",
    "@media (prefers-reduced-motion: reduce){.gs-line,.gs-line span{animation:none !important}}",
    /* 系统开了"减少动态效果"时：进度条的呼吸告警、小车上下浮动、光标动画一并停掉 */
    "@media (prefers-reduced-motion: reduce){.gs-dock-fill,.gs-marker,.gs-marker-emoji,.gs-marker-img{animation:none !important;transition:none !important}}"
  ].join("\n");
}

/* ─── 配置 store ─────────────────────────────────────────────────────── */

var state = { config: DEFAULTS, path: "", loaded: false, error: "" };
var listeners = new Set();

function notify() {
  listeners.forEach(function (fn) {
    try { fn(); } catch (error) { console.error("[greet-signoff] listener failed", error); }
  });
}

function subscribe(fn) {
  listeners.add(fn);
  return function () { listeners.delete(fn); };
}

function clampInt(value, min, max, fallback) {
  var num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function snapWeight(value, fallback) {
  var weight = clampInt(value, 300, 900, fallback);
  var best = WEIGHTS[0];
  for (var i = 0; i < WEIGHTS.length; i += 1) {
    if (Math.abs(WEIGHTS[i] - weight) < Math.abs(best - weight)) best = WEIGHTS[i];
  }
  return best;
}

/** 在一组 { value } 选项里取合法值，否则回落到默认。 */
function pickEnum(value, options, fallback) {
  if (typeof value !== "string") return fallback;
  for (var i = 0; i < options.length; i += 1) {
    if (options[i] === value) return value;
  }
  return fallback;
}

function normalizeLine(raw, fallback) {
  var base = raw !== null && typeof raw === "object" ? raw : {};
  var animation = typeof base.animation === "string" && ANIMATIONS.some(function (item) { return item.value === base.animation; })
    ? base.animation
    : fallback.animation;
  return {
    text: typeof base.text === "string" ? base.text.slice(0, TEXT_LIMIT) : fallback.text,
    image: typeof base.image === "string" ? base.image : fallback.image,
    imageHeight: clampInt(base.imageHeight, 12, 64, fallback.imageHeight),
    fontSize: clampInt(base.fontSize, 10, 40, fallback.fontSize),
    fontWeight: snapWeight(base.fontWeight, fallback.fontWeight),
    color: typeof base.color === "string" ? base.color : fallback.color,
    colorDark: typeof base.colorDark === "string" ? base.colorDark : fallback.colorDark,
    animation: animation,
    animSpeed: clampInt(base.animSpeed, 1, 4, fallback.animSpeed),
    shape: pickEnum(base.shape, SHAPES.map(function (item) { return item.value; }), fallback.shape),
    radius: clampInt(base.radius, 0, 999, fallback.radius),
    padY: clampInt(base.padY, 0, 24, fallback.padY),
    fill: pickEnum(base.fill, FILLS.map(function (item) { return item.value; }), fallback.fill),
    bgColor: typeof base.bgColor === "string" ? base.bgColor : fallback.bgColor,
    bgColorDark: typeof base.bgColorDark === "string" ? base.bgColorDark : fallback.bgColorDark,
    borderWidth: clampInt(base.borderWidth, 0, 6, fallback.borderWidth),
    borderColor: typeof base.borderColor === "string" ? base.borderColor : fallback.borderColor,
    borderColorDark: typeof base.borderColorDark === "string" ? base.borderColorDark : fallback.borderColorDark,
    shadow: pickEnum(base.shadow, SHADOWS.map(function (item) { return item.value; }), fallback.shadow),
    letterSpacing: clampInt(base.letterSpacing, -2, 12, fallback.letterSpacing),
    caps: pickEnum(base.caps, ["none", "upper", "lower"], fallback.caps),
    italic: base.italic === true
  };
}

/**
 * 旧文案兼容表：只有历史会话里出现过、现在不再作为固定行的文本。
 * 它们不写进提示词，只影响页面渲染，让翻旧会话时也能贴上样式。
 * @param raw - 任意输入。
 * @returns {Array} [{ text, style }]，style 为 "greeting" 或 "signOff"。
 */
function sanitizeLegacyLines(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  for (var i = 0; i < raw.length && out.length < 30; i += 1) {
    var item = raw[i];
    if (item === null || typeof item !== "object") continue;
    var text = typeof item.text === "string" ? item.text.slice(0, TEXT_LIMIT) : "";
    if (text.trim().length === 0) continue;
    out.push({ text: text, style: item.style === "signOff" ? "signOff" : "greeting" });
  }
  return out;
}

function normalize(raw) {
  var base = raw !== null && typeof raw === "object" ? raw : {};
  var legacy = typeof base.greeting === "string" || typeof base.signOff === "string";
  var source = legacy ? { greeting: { text: base.greeting }, signOff: { text: base.signOff } } : base;
  var warn = clampInt(base.warnPercent, 1, 99, DEFAULTS.warnPercent);
  var critical = clampInt(base.criticalPercent, 2, 100, DEFAULTS.criticalPercent);
  // matchMode 是 1.2.0 的新字段；旧的布尔 looseMatch 仍能读（false = 逐字相同）
  var matchMode = base.matchMode === undefined
    ? (base.looseMatch === false ? "exact" : "loose")
    : pickEnum(base.matchMode, MATCH_MODES, "loose");
  return {
    greeting: normalizeLine(source.greeting, DEFAULTS.greeting),
    signOff: normalizeLine(source.signOff, DEFAULTS.signOff),
    warnPercent: warn,
    criticalPercent: Math.max(warn + 1, critical),
    matchMode: matchMode,
    onlyAssistant: base.onlyAssistant !== false,
    legacyLines: sanitizeLegacyLines(base.legacyLines)
  };
}

function adopt(payload) {
  if (payload && payload.config) state.config = normalize(payload.config);
  if (payload && typeof payload.path === "string") state.path = payload.path;
  state.loaded = true;
  state.error = "";
  notify();
}

function loadConfig() {
  return fetch(API, { headers: { accept: "application/json" } })
    .then(function (res) { return res.json(); })
    .then(function (payload) { adopt(payload); })
    .catch(function (error) {
      console.error("[greet-signoff] load failed", error);
      state.loaded = true;
      state.error = "读取配置失败：请确认插件宿主半已加载";
      notify();
    });
}

/** 单次保存请求的超时（毫秒）：DSH 重启时连接会被掐断，不能让界面一直卡在"正在保存"。 */
var SAVE_TIMEOUT_MS = 12000;

function postConfig(payload) {
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer = null;
  var options = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  };
  if (controller !== null) {
    options.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, SAVE_TIMEOUT_MS);
  }
  function done() { if (timer !== null) clearTimeout(timer); }
  return fetch(API, options)
    .then(function (res) { return res.json(); })
    .then(function (body) {
      if (!body || body.ok !== true) throw new Error((body && body.error) || "unknown error");
      return body;
    })
    .then(function (body) { done(); return body; }, function (error) { done(); throw error; });
}

/**
 * 写配置：失败（超时 / 连接被掐断）时 2.5 秒后自动重试一次。
 * DSH 正在重启时界面也不会卡死，重启完成后的那次重试就能落盘。
 */
function saveConfig(draft) {
  return postConfig(draft).then(
    function (payload) { adopt(payload); return state.config; },
    function (firstError) {
      return new Promise(function (resolve) { setTimeout(resolve, 2500); })
        .then(function () { return postConfig(draft); })
        .then(function (payload) { adopt(payload); return state.config; },
          function () { throw firstError; });
    }
  );
}

/** 订阅配置变化；返回值始终是最新快照。 */
function useConfig() {
  var pair = React.useState(0);
  var bump = pair[1];
  React.useEffect(function () {
    return subscribe(function () { bump(function (n) { return n + 1; }); });
  }, []);
  return state;
}

/**
 * 进度条配色：每套给三个锚点色 [安全色, 黄色阈值色, 红色阈值色]，
 * 色带与插值都用它们，因此换配色不影响"按阈值变色"的逻辑；group 用于设置页下拉分组。
 * 注意：必须定义在“进度条外观偏好”读取之前（下面读 scheme 时要用到）。
 */
var BAR_SCHEMES = [
  // 经典与自然
  { id: "classic", group: "经典与自然", label: "经典", colors: ["#2fbf8f", "#e0a52a", "#d93026"] },
  { id: "bud", group: "经典与自然", label: "新芽", colors: ["#4ade80", "#facc15", "#ef4444"] },
  { id: "forest", group: "经典与自然", label: "森林", colors: ["#16a34a", "#ca8a04", "#b91c1c"] },
  { id: "matcha", group: "经典与自然", label: "抹茶", colors: ["#84cc16", "#eab308", "#e11d48"] },
  { id: "desert", group: "经典与自然", label: "沙丘", colors: ["#ca8a04", "#ea580c", "#9f1239"] },
  { id: "lagoon", group: "经典与自然", label: "湖水", colors: ["#14b8a6", "#f59e0b", "#dc2626"] },
  // 柔和粉彩
  { id: "macaron", group: "柔和粉彩", label: "马卡龙", colors: ["#a7f3d0", "#fde68a", "#fda4af"] },
  { id: "sakura", group: "柔和粉彩", label: "樱花", colors: ["#f9a8d4", "#c4b5fd", "#fb7185"] },
  { id: "mint", group: "柔和粉彩", label: "薄荷", colors: ["#6ee7b7", "#fcd34d", "#f87171"] },
  { id: "cream", group: "柔和粉彩", label: "奶油", colors: ["#fde9b8", "#f9c46b", "#db8a5a"] },
  { id: "gum", group: "柔和粉彩", label: "泡泡糖", colors: ["#86efac", "#f9a8d4", "#c084fc"] },
  { id: "beach", group: "柔和粉彩", label: "海滩", colors: ["#22d3ee", "#fbbf24", "#fb7185"] },
  // 缤纷高饱和
  { id: "candy", group: "缤纷高饱和", label: "糖果", colors: ["#f472b6", "#8b5cf6", "#22d3ee"] },
  { id: "neon", group: "缤纷高饱和", label: "霓虹", colors: ["#00e5a0", "#ffe14d", "#ff3860"] },
  { id: "berry", group: "缤纷高饱和", label: "浆果", colors: ["#a855f7", "#f472b6", "#fb7185"] },
  { id: "tropical", group: "缤纷高饱和", label: "热带", colors: ["#2dd4bf", "#fb7185", "#a855f7"] },
  { id: "citrus", group: "缤纷高饱和", label: "柑橘", colors: ["#a3e635", "#fbbf24", "#f43f5e"] },
  { id: "sunset", group: "缤纷高饱和", label: "日落", colors: ["#fbbf24", "#f97316", "#e11d48"] },
  { id: "aurora", group: "缤纷高饱和", label: "极光", colors: ["#34d399", "#a855f7", "#ec4899"] },
  { id: "cyber", group: "缤纷高饱和", label: "赛博", colors: ["#22d3ee", "#a3e635", "#ff2d95"] },
  // 冷色科技
  { id: "ocean", group: "冷色科技", label: "海洋", colors: ["#22d3ee", "#3b82f6", "#7c3aed"] },
  { id: "ice", group: "冷色科技", label: "冰川", colors: ["#7dd3fc", "#818cf8", "#e879f9"] },
  { id: "night", group: "冷色科技", label: "夜空", colors: ["#38bdf8", "#6366f1", "#db2777"] },
  { id: "galaxy", group: "冷色科技", label: "星河", colors: ["#2dd4bf", "#a78bfa", "#f472b6"] },
  { id: "matrix", group: "冷色科技", label: "矩阵", colors: ["#22c55e", "#a3e635", "#f43f5e"] },
  { id: "deepsea", group: "冷色科技", label: "深海", colors: ["#0ea5e9", "#8b5cf6", "#d946ef"] },
  { id: "blueprint", group: "冷色科技", label: "蓝图", colors: ["#60a5fa", "#fbbf24", "#ef4444"] },
  // 浓郁对比
  { id: "grape", group: "浓郁对比", label: "葡萄", colors: ["#34d399", "#a855f7", "#e11d48"] },
  { id: "coffee", group: "浓郁对比", label: "咖啡", colors: ["#d6a77a", "#a16207", "#78350f"] },
  { id: "spice", group: "浓郁对比", label: "辛香", colors: ["#fcd34d", "#f97316", "#991b1b"] },
  { id: "crimson", group: "浓郁对比", label: "暗红", colors: ["#f59e0b", "#f43f5e", "#be123c"] },
  // 灰阶
  { id: "ink", group: "灰阶", label: "墨色", colors: ["#94a3b8", "#64748b", "#0f172a"] },
  { id: "fog", group: "灰阶", label: "雾灰", colors: ["#cbd5e1", "#94a3b8", "#475569"] }
];

function schemeOf(id) {
  for (var i = 0; i < BAR_SCHEMES.length; i += 1) {
    if (BAR_SCHEMES[i].id === id) return BAR_SCHEMES[i];
  }
  return BAR_SCHEMES[0];
}

/**
 * 把配色列表按 group 归组，产出带 <optgroup> 的下拉内容（配色较多时便于快速定位）。
 * 没有 group 的项归入"其它"；已有项的顺序即分组出现的顺序，不额外排序。
 * @returns {Array} React 子节点数组。
 */
function schemeOptions() {
  var groups = [];
  var index = {};
  for (var i = 0; i < BAR_SCHEMES.length; i += 1) {
    var item = BAR_SCHEMES[i];
    var name = typeof item.group === "string" && item.group.length > 0 ? item.group : "其它";
    if (index[name] === undefined) {
      index[name] = groups.length;
      groups.push({ name: name, items: [] });
    }
    groups[index[name]].items.push(item);
  }
  return groups.map(function (group) {
    return React.createElement("optgroup", { key: group.name, label: group.name },
      group.items.map(function (item) {
        return React.createElement("option", { key: item.id, value: item.id }, item.label);
      }));
  });
}

function hexToRgb(hex) {
  var text = String(hex).replace("#", "");
  if (text.length === 3) text = text[0] + text[0] + text[1] + text[1] + text[2] + text[2];
  var value = parseInt(text, 16);
  if (!isFinite(value)) return [127, 127, 127];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixRgb(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t)
  ];
}

/** 两段式插值：0% 安全色 → 黄色阈值正好是中间色 → 红色阈值正好是危险色。 */
function rampColor(percent, warnPercent, criticalPercent, colors) {
  var palette = colors !== undefined && colors !== null ? colors : BAR_SCHEMES[0].colors;
  var warn = Math.min(99, Math.max(1, warnPercent));
  var critical = Math.min(100, Math.max(warn + 1, criticalPercent));
  var from = hexToRgb(palette[0]);
  var to = hexToRgb(palette[1]);
  var t = Math.max(0, Math.min(1, percent / warn));
  if (percent > warn) {
    from = hexToRgb(palette[1]);
    to = hexToRgb(palette[2]);
    t = Math.max(0, Math.min(1, (percent - warn) / (critical - warn)));
  }
  var rgb = mixRgb(from, to, t);
  return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
}

/** 整条进度条上的完整色带（已走到的地方实色，未走到的地方淡色显示，便于看出"越往后越危险"）。 */
function barScale(warnPercent, criticalPercent, colors, alpha) {
  var palette = colors !== undefined && colors !== null ? colors : BAR_SCHEMES[0].colors;
  var warn = Math.min(99, Math.max(1, warnPercent));
  var critical = Math.min(100, Math.max(warn + 1, criticalPercent));
  var stop = function (hex) {
    var rgb = hexToRgb(hex);
    return alpha === undefined
      ? "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")"
      : "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  };
  return "linear-gradient(90deg, " + stop(palette[0]) + " 0%, " + stop(palette[1]) + " " + warn +
    "%, " + stop(palette[2]) + " " + critical + "%, " + stop(palette[2]) + " 100%)";
}

/* ─── 进度条外观偏好（纯前端，存浏览器本地；改完立即生效、不用重启） ──── */

var UI_KEY = "gs.signoff.ui";
var UI_DEFAULTS = { barHeight: 9, marker: "🚗", markerImage: "", markerScale: 12, facing: "right", imageFlipped: false, scheme: "classic", display: "full" };
var BAR_HEIGHTS = [6, 9, 12, 16];
var MARKER_SCALES = [
  { value: 6, label: "小" },
  { value: 12, label: "中" },
  { value: 20, label: "大" },
  { value: 30, label: "特大" }
];
var BAR_MARKERS = [
  { value: "🚗", label: "🚗", name: "轿车" },
  { value: "🚙", label: "🚙", name: "SUV" },
  { value: "🚕", label: "🚕", name: "出租车" },
  { value: "🏎️", label: "🏎️", name: "跑车" },
  { value: "🚓", label: "🚓", name: "警车" },
  { value: "🚑", label: "🚑", name: "救护车" },
  { value: "🚒", label: "🚒", name: "消防车" },
  { value: "🚐", label: "🚐", name: "面包车" },
  { value: "🛻", label: "🛻", name: "皮卡" },
  { value: "🚚", label: "🚚", name: "货车" },
  { value: "🚛", label: "🚛", name: "卡车" },
  { value: "🚜", label: "🚜", name: "拖拉机" },
  { value: "🚌", label: "🚌", name: "巴士" },
  { value: "🚎", label: "🚎", name: "电车" },
  { value: "🛺", label: "🛺", name: "三轮车" },
  { value: "🏍️", label: "🏍️", name: "摩托" },
  { value: "🛵", label: "🛵", name: "踏板车" },
  { value: "🚲", label: "🚲", name: "自行车" },
  { value: "🛴", label: "🛴", name: "滑板车" },
  { value: "🚂", label: "🚂", name: "蒸汽火车" },
  { value: "🚄", label: "🚄", name: "高铁" },
  { value: "🚀", label: "🚀", name: "火箭" },
  { value: "🚁", label: "🚁", name: "直升机" },
  { value: "✈️", label: "✈️", name: "飞机" },
  { value: "🛸", label: "🛸", name: "飞碟" },
  { value: "⛵", label: "⛵", name: "帆船" },
  { value: "🚤", label: "🚤", name: "快艇" },
  { value: "🏃", label: "🏃", name: "跑步" },
  { value: "🐢", label: "🐢", name: "乌龟" },
  { value: "⭐", label: "⭐", name: "星星" },
  { value: "", label: "无" }
];
/** 自定义小车图片的大小上限（localStorage 存 base64，留足余量）。 */
var MARKER_IMAGE_BYTES = 250 * 1024;
/**
 * 这些车型在 Segoe UI Emoji / Noto 里默认朝左，需要水平镜像才会"车头向右"。
 * （🚲🛴✈️🚀🛸⛵🏃🐢⭐ 本身不朝左，不镜像。）
 */
var MARKER_FLIP = {
  "🚗": 1, "🚙": 1, "🚕": 1, "🏎️": 1, "🚓": 1, "🚑": 1, "🚒": 1, "🚐": 1, "🛻": 1,
  "🚚": 1, "🚛": 1, "🚜": 1, "🚌": 1, "🚎": 1, "🛺": 1, "🏍️": 1, "🛵": 1, "🚂": 1,
  "🚄": 1, "🚁": 1, "🚤": 1
};
var uiState = Object.assign({}, UI_DEFAULTS);
try {
  var savedUi = JSON.parse(window.localStorage.getItem(UI_KEY) || "null");
  if (savedUi !== null && typeof savedUi === "object") {
    if (typeof savedUi.barHeight === "number") uiState.barHeight = Math.min(20, Math.max(4, Math.round(savedUi.barHeight)));
    if (typeof savedUi.marker === "string") uiState.marker = savedUi.marker.slice(0, 4);
    if (typeof savedUi.markerScale === "number") uiState.markerScale = Math.min(40, Math.max(2, Math.round(savedUi.markerScale)));
    if (savedUi.facing === "native" || savedUi.facing === "right") uiState.facing = savedUi.facing;
    if (typeof savedUi.imageFlipped === "boolean") uiState.imageFlipped = savedUi.imageFlipped;
    if (typeof savedUi.scheme === "string" && BAR_SCHEMES.some(function (s) { return s.id === savedUi.scheme; })) uiState.scheme = savedUi.scheme;
    if (typeof savedUi.markerImage === "string" && savedUi.markerImage.length < 400 * 1024) uiState.markerImage = savedUi.markerImage;
  }
} catch (error) { /* 隐私模式等读不到就用默认值 */ }

var uiListeners = new Set();

function useUiPrefs() {
  var pair = React.useState(0);
  var bump = pair[1];
  React.useEffect(function () {
    var listener = function () { bump(function (n) { return n + 1; }); };
    uiListeners.add(listener);
    return function () { uiListeners.delete(listener); };
  }, []);
  return uiState;
}

function setUiPrefs(patch) {
  uiState = Object.assign({}, uiState, patch);
  try { window.localStorage.setItem(UI_KEY, JSON.stringify(uiState)); } catch (error) { /* 忽略写入失败 */ }
  uiListeners.forEach(function (fn) {
    try { fn(); } catch (error) { console.error("[greet-signoff] ui listener failed", error); }
  });
}

function validate(draft) {
  if (draft.greeting.text.trim().length === 0 && draft.signOff.text.trim().length === 0) return "开场语和结束语不能都为空";
  if (draft.greeting.text.length > 200) return "开场语最多 200 字";
  if (draft.signOff.text.length > 200) return "结束语最多 200 字";
  if (!(draft.criticalPercent > draft.warnPercent)) return "红色阈值必须大于黄色阈值";
  // 旧文案表里的空行：拦住保存（否则一保存就被归一化丢掉，用户会以为"刚加的行没了"）
  var legacy = Array.isArray(draft.legacyLines) ? draft.legacyLines : [];
  for (var i = 0; i < legacy.length; i += 1) {
    if (legacy[i] === null || typeof legacy[i] !== "object" || String(legacy[i].text).trim().length === 0) {
      return "旧文案兼容表里有空行：填上内容或删掉它";
    }
  }
  return null;
}

/** 分区的默认展开状态：高频的三个打开，低频的收起（面板不至于太长）。 */
var FOLD_DEFAULTS = { text: true, font: true, deco: true, alert: false, legacy: false, bar: false, diag: false };
var FOLD_KEY = "gs.signoff.folds";

/** 读取分区展开状态（浏览器本地；读不到就用默认）。 */
function readFoldState() {
  var out = Object.assign({}, FOLD_DEFAULTS);
  try {
    var raw = window.localStorage.getItem(FOLD_KEY);
    if (typeof raw === "string" && raw.length > 0) {
      var saved = JSON.parse(raw);
      if (saved !== null && typeof saved === "object") {
        Object.keys(FOLD_DEFAULTS).forEach(function (key) {
          if (typeof saved[key] === "boolean") out[key] = saved[key];
        });
      }
    }
  } catch (error) { /* 隐私模式等：用默认值 */ }
  return out;
}

/** 写入分区展开状态。 */
function writeFoldState(state) {
  try { window.localStorage.setItem(FOLD_KEY, JSON.stringify(state)); } catch (error) { /* 忽略写入失败 */ }
}

/* ─── 行渲染（编辑器预览与输入框上方卡片共用） ────────────────────────── */

/** 当前是不是深色主题（宿主用 body[data-ds-dark-theme] 标记）。 */
function isDarkTheme() {
  try {
    return document.body !== null && document.body !== undefined && typeof document.body.hasAttribute === "function"
      && document.body.hasAttribute("data-ds-dark-theme");
  } catch (error) {
    return false;
  }
}

/**
 * 取某字段在当前主题下的实际值：深色主题下优先用 `<字段>Dark`，为空则回落到浅色值。
 * @param {Object} line 配置里的行对象。
 * @param {string} field 字段名（color / bgColor / borderColor）。
 * @returns {string} 实际使用的颜色。
 */
function effectiveColor(line, field) {
  var value = typeof line[field] === "string" ? line[field] : "";
  if (isDarkTheme()) {
    var dark = line[field + "Dark"];
    if (typeof dark === "string" && dark.length > 0) return dark;
  }
  return value;
}

/**
 * 文字部分的样式：字号/字重/颜色，加上字距、大小写、斜体。
 * @param {Object} line 配置里的行对象。
 * @returns {Object} React 内联样式。
 */
function lineStyle(line) {
  var style = { fontSize: line.fontSize + "px", fontWeight: line.fontWeight };
  var color = effectiveColor(line, "color");
  if (color !== "") style.color = color;
  if (line.letterSpacing !== 0) style.letterSpacing = line.letterSpacing + "px";
  if (line.caps === "upper") style.textTransform = "uppercase";
  else if (line.caps === "lower") style.textTransform = "lowercase";
  if (line.italic === true) style.fontStyle = "italic";
  return style;
}

/**
 * 装饰部分（形状/填充/边框/动效倍速）的 CSS 变量与内联样式。
 * 形状类的圆角与内边距来自此处，因此"胶囊/圆角/直角"可以自由组合填充与边框。
 * @param {Object} line 配置里的行对象。
 * @returns {Object|undefined} 内联样式对象（全默认时返回 undefined）。
 */
function lineVars(line) {
  var preset = null;
  for (var i = 0; i < SHAPES.length; i += 1) {
    if (SHAPES[i].value === line.shape) preset = SHAPES[i];
  }
  var vars = {};
  var has = false;
  if (preset !== null) {
    // 有形状时完全按预设走（圆角也可能是 0，如直角/下划线）：圆角 + 内边距都从这里出
    vars["--gs-radius"] = (preset.radius === 999 ? 999 : preset.radius) + "px";
    vars["--gs-line-pad"] = line.padY + "px";
    has = true;
    if (preset.radius === 999) vars["--gs-radius"] = "999px";
  } else if (line.radius > 0) {
    vars["--gs-radius"] = line.radius + "px";
    has = true;
  }
  var bg = effectiveColor(line, "bgColor");
  if (line.fill === "solid" && bg !== "") { vars.background = bg; has = true; }
  if (line.borderWidth > 0) {
    var borderColor = effectiveColor(line, "borderColor");
    vars.border = line.borderWidth + "px solid " + (borderColor === "" ? "currentColor" : borderColor);
    has = true;
  }
  if (line.animSpeed !== 1) { vars["--gs-anim-speed"] = String(line.animSpeed); has = true; }
  return has ? vars : undefined;
}

function lineRender(line, label, key) {
  var children = [];
  if (typeof line.image === "string" && line.image.length > 0) {
    children.push(React.createElement("img", {
      key: "image",
      className: "gs-line-img",
      src: line.image,
      style: { height: line.imageHeight + "px" },
      alt: ""
    }));
  }
  children.push(React.createElement("span", { key: "text", style: lineStyle(line) }, line.text));
  return React.createElement("div", {
    key: key,
    className: lineClassOf(line, "gs-line gs-decor"),
    style: lineVars(line)
  }, React.createElement("b", null, label), children);
}

/* ─── 编辑器 ─────────────────────────────────────────────────────────── */

function Editor() {
  var store = useConfig();
  var draftPair = React.useState(store.config);
  var draft = draftPair[0];
  var setDraft = draftPair[1];
  var tabPair = React.useState("greeting");
  var tab = tabPair[0];
  var setTab = tabPair[1];
  var savedPair = React.useState(false);
  var saved = savedPair[0];
  var setSaved = savedPair[1];
  var noticePair = React.useState("");
  var notice = noticePair[0];
  var setNotice = noticePair[1];
  var errorPair = React.useState("");
  var error = errorPair[0];
  var setError = errorPair[1];
  var busyPair = React.useState(false);
  var busy = busyPair[0];
  var setBusy = busyPair[1];
  var touchedPair = React.useState(false);
  var touched = touchedPair[0];
  var setTouched = touchedPair[1];
  var failPair = React.useState(0);
  var fail = failPair[0];
  var setFail = failPair[1];
  var dirtyRef = React.useRef(false);
  // 每个编辑器实例一个唯一的 file input id（label 点击要指向它）
  var fileIdRef = React.useRef("gs-file-" + Math.random().toString(36).slice(2, 8));
  // 各分区的展开状态：存在浏览器本地（不占配置、不用重启）。
  // 默认只展开三个高频分区，其余收起，面板不再是一条需要来回滚的长龙。
  var foldsPair = React.useState(readFoldState);
  var folds = foldsPair[0];
  var setFolds = foldsPair[1];
  var emojiPair = React.useState(false);
  var emojiOpen = emojiPair[0];
  var setEmojiOpen = emojiPair[1];
  var queryPair = React.useState("");
  var emojiQuery = queryPair[0];
  var setEmojiQuery = queryPair[1];
  var recentPair = React.useState(readRecentEmojis);
  var recentEmojis = recentPair[0];
  var setRecentEmojis = recentPair[1];
  // 样式预设：默认一次套用到开场与结束语两行（只改外观，不动文案与图片）
  var presetBothPair = React.useState(true);
  var presetBoth = presetBothPair[0];
  var setPresetBoth = presetBothPair[1];

  /**
   * 套用一套外观预设：只覆盖预设里列出的"外观"字段，文案与图片原样保留。
   * @param {Object} preset STYLE_PRESETS 里的一项。
   */
  function applyPreset(preset) {
    var targets = presetBoth ? ["greeting", "signOff"] : [tab];
    var patch = {};
    for (var i = 0; i < targets.length; i += 1) {
      var key = targets[i];
      patch[key] = Object.assign({}, draft[key], preset.style);
    }
    dirtyRef.current = true;
    setTouched(true);
    setSaved(false);
    setDraft(Object.assign({}, draft, patch));
    setNotice("已套用「" + preset.name + "」外观（文案与图片未改动），正在保存…");
  }

  /** 导出当前配置为 JSON 文件（含图片短地址；分享给别人时对方能直接用）。 */
  function exportConfig() {
    try {
      var blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "greet-signoff.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      setNotice("已导出 greet-signoff.json");
    } catch (error) {
      setNotice("导出失败：" + (error && error.message ? error.message : error));
    }
  }

  /**
   * 从 JSON 文件导入配置：先按客户端规则归一化，再写回宿主。
   * @param {File} file 用户选的文件。
   */
  function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = null;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (error) {
        setNotice("导入失败：不是合法的 JSON 文件");
        return;
      }
      var raw = parsed !== null && typeof parsed === "object" && parsed.config !== undefined ? parsed.config : parsed;
      var next = normalize(raw);
      dirtyRef.current = true;
      setTouched(true);
      setSaved(false);
      setDraft(next);
      setNotice("已载入配置，正在保存…");
      commit(next, true);
    };
    reader.onerror = function () { setNotice("导入失败：读文件出错"); };
    reader.readAsText(file);
  }

  /**
   * 展开/收起一个分区（状态记在浏览器本地）。
   * @param {string} key 分区标识。
   */
  function toggleFold(key) {
    var next = Object.assign({}, folds);
    next[key] = !(folds[key] === true);
    setFolds(next);
    writeFoldState(next);
  }

  /**
   * 插入一个表情：追加到输入框尾部（不改写已有内容），并记入"最近用过"。
   * @param {string} emoji 要插入的表情字符。
   */
  function insertEmoji(emoji) {
    setLine({ text: line.text + " " + emoji });
    var next = [emoji].concat(recentEmojis.filter(function (item) { return item !== emoji; })).slice(0, RECENT_MAX);
    setRecentEmojis(next);
    writeRecentEmojis(next);
  }

  // 搜索词非空时，表情框改成显示命中结果
  var emojiSearching = emojiQuery.trim().length > 0;
  var emojiShown = emojiSearching ? searchEmojis(emojiQuery) : ALL_EMOJIS;

  React.useEffect(function () { if (!state.loaded) loadConfig(); }, []);

  // 表情数据懒加载：第一次展开表情框时才向宿主取索引、并扫描本机可用表情。
  // 这样进页面时不再同步扫 3800 个码位，包体也小了 51KB。
  var emojiTickPair = React.useState(0);
  var emojiTick = emojiTickPair[0];
  var bumpEmojiTick = emojiTickPair[1];
  React.useEffect(function () {
    if (!emojiOpen || emojiDataState === "ready") return undefined;
    var alive = true;
    loadEmojiData().then(function () { if (alive) bumpEmojiTick(function (n) { return n + 1; }); });
    return function () { alive = false; };
  }, [emojiOpen, emojiTick]);
  React.useEffect(function () {
    return subscribe(function () { if (!dirtyRef.current) setDraft(state.config); });
  }, []);

  var line = draft[tab];
  var invalid = validate(draft);

  // 自动保存：改动停下就写回配置，不必依赖"点保存"。
  // 失败（DSH 正在重启等）按 1.2s → 4s → 10s 退避重试三次，再失败就停手并提示手动保存。
  React.useEffect(function () {
    if (!touched || busy || invalid !== null) return undefined;
    if (fail >= 3) return undefined;
    var delay = fail === 0 ? 1200 : fail === 1 ? 4000 : 10000;
    var timer = setTimeout(function () { commit(draft, true); }, delay);
    return function () { clearTimeout(timer); };
  }, [draft, touched, busy, invalid, fail]);

  function setLine(part) {
    dirtyRef.current = true;
    setTouched(true);
    setSaved(false);
    setDraft(Object.assign({}, draft, (function () {
      var patch = {};
      patch[tab] = Object.assign({}, draft[tab], part);
      return patch;
    })()));
  }

  function patchTop(part) {
    dirtyRef.current = true;
    setTouched(true);
    setSaved(false);
    setDraft(Object.assign({}, draft, part));
  }

  function commit(payload, auto) {
    var problem = validate(payload);
    setSaved(false);
    setNotice("");
    if (problem !== null) {
      setError(problem);
      return;
    }
    setError("");
    setBusy(true);
    // __client 只是给宿主日志留个可辨识的标记（宿主 normalize 会丢弃未知字段）。
    var body = Object.assign({}, payload, { __client: (auto === true ? "auto@" : "settings@") + Date.now() });
    saveConfig(body)
      .then(function (next) {
        dirtyRef.current = false;
        setTouched(false);
        setFail(0);
        setDraft(next);
        setSaved(true);
        if (auto === true) setNotice("已自动保存 · 下一次回复即生效");
      })
      .catch(function (err) {
        console.error("[greet-signoff] save failed", err);
        setFail(fail + 1);
        setError(
          fail + 1 >= 3
            ? "保存失败：" + String(err && err.message ? err.message : err) + "（已停止自动重试，请点「保存并生效」再试）"
            : "保存失败：" + String(err && err.message ? err.message : err) + "（服务可能正在重启，正在自动重试…）"
        );
      })
      .then(function () { setBusy(false); });
  }

  function loadImage(file) {
    if (IMAGE_TYPES.indexOf(file.type) < 0) { setNotice("只支持 PNG / JPEG / GIF / WebP"); return; }
    if (file.size > MAX_IMAGE_BYTES) {
      setNotice("图片太大（" + Math.round(file.size / 1024) + "KB），请压到 " + Math.round(MAX_IMAGE_BYTES / 1024) + "KB 以内");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      if (typeof reader.result === "string") { setLine({ image: reader.result }); setNotice(""); }
    };
    reader.onerror = function () { setNotice("图片读取失败"); };
    reader.readAsDataURL(file);
  }

  /** 自定义"小车"图片：只存在浏览器本地（不占配置、不用重启）。 */
  function loadMarkerImage(file) {
    if (IMAGE_TYPES.indexOf(file.type) < 0) { setNotice("小车图片只支持 PNG / JPEG / GIF / WebP"); return; }
    if (file.size > MARKER_IMAGE_BYTES) {
      setNotice("小车图片太大（" + Math.round(file.size / 1024) + "KB），请压到 " + Math.round(MARKER_IMAGE_BYTES / 1024) + "KB 以内");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      if (typeof reader.result !== "string") { setNotice("小车图片读取失败"); return; }
      try {
        window.localStorage.setItem(UI_KEY, JSON.stringify(Object.assign({}, uiState, { markerImage: reader.result })));
      } catch (error) {
        setNotice("浏览器本地存储写不下这张图，换小一点的图片");
        return;
      }
      setNotice("");
      setUiPrefs({ markerImage: reader.result });
    };
    reader.onerror = function () { setNotice("小车图片读取失败"); };
    reader.readAsDataURL(file);
  }

  function field(label, control, key) {
    return React.createElement("div", { className: "gs-field", key: key },
      React.createElement("div", { className: "gs-label" }, label),
      control
    );
  }

  function numInput(value, min, max, step, onChange) {
    return React.createElement("input", {
      className: "gs-input gs-num", type: "number", min: min, max: max, step: step, value: value,
      onChange: function (event) {
        var parsed = Number(event.target.value);
        if (isFinite(parsed)) onChange(parsed);
      }
    });
  }

  function sliderRow(label, value, min, max, step, suffix, onChange) {
    return React.createElement("div", { className: "gs-row2", key: label },
      React.createElement("span", { className: "gs-label" }, label),
      React.createElement("input", {
        className: "gs-range", type: "range", min: min, max: max, step: step, value: value,
        onChange: function (event) { onChange(Number(event.target.value)); }
      }),
      numInput(value, min, max, step, onChange),
      suffix === null ? null : React.createElement("span", { className: "gs-label" }, suffix)
    );
  }

  /**
   * 一个可折叠的分区卡片：标题行常驻，内容按需展开。
   * 高频分区默认展开（文本/字体/外观），低频分区默认收起（上下文提醒/旧文案/进度条/诊断），
   * 这样面板不再是一条需要来回滚的长龙。展开状态记在浏览器本地。
   * @param {string} title 标题。
   * @param {string} key 分区标识（同时是折叠状态与 React key）。
   * @param {*} children 内容。
   * @param {Object} [options] { summary 右侧摘要, defaultOpen 是否默认展开 }
   * @returns {Object} React 元素。
   */
  function section(title, key, children, options) {
    var opts = options === undefined ? {} : options;
    var open = folds[key] !== undefined ? folds[key] === true : opts.defaultOpen !== false;
    return React.createElement("div", { className: "gs-card", key: key },
      React.createElement("div", {
        className: open ? "gs-fold gs-fold-open" : "gs-fold", role: "button", tabIndex: 0,
        onClick: function () { toggleFold(key); },
        onKeyDown: function (event) { if (event.key === "Enter" || event.key === " ") toggleFold(key); }
      },
        React.createElement("span", { className: "gs-fold-caret" }, open ? "▼" : "▶"),
        React.createElement("span", { className: "gs-sec-title", style: { marginBottom: 0 } }, title),
        opts.summary === undefined ? null : React.createElement("span", { className: "gs-fold-sum" }, opts.summary)
      ),
      open ? React.createElement("div", { className: "gs-fold-body" }, children) : null
    );
  }

  /** 一格：标签 + 控件（两列网格里用，省纵向空间）。 */
  function cell(label, control, key, wide) {
    return React.createElement("div", { className: wide === true ? "gs-cell gs-cell-wide" : "gs-cell", key: key },
      React.createElement("span", { className: "gs-label" }, label),
      control
    );
  }

  /** 下拉框：选项多的时候比一排按钮省地方。 */
  function selectCell(label, options, value, onChange, key, wide) {
    return cell(label, React.createElement("select", {
      className: "gs-input gs-select", value: String(value),
      onChange: function (event) { onChange(event.target.value); }
    }, options.map(function (item) {
      return React.createElement("option", { key: String(item.value), value: String(item.value) }, item.label);
    })), key, wide);
  }

  /** 滑杆 + 数字输入（数字可直接填）。 */
  function sliderCell(label, value, min, max, step, suffix, onChange, key) {
    return cell(label, React.createElement("span", { className: "gs-cellgroup" },
      React.createElement("input", {
        className: "gs-range", type: "range", min: min, max: max, step: step, value: value,
        onChange: function (event) { onChange(Number(event.target.value)); }
      }),
      numInput(value, min, max, step, onChange),
      suffix === null ? null : React.createElement("span", { className: "gs-label gs-unit" }, suffix)
    ), key);
  }

  function grid(key, children) {
    return React.createElement("div", { className: "gs-grid", key: key }, children);
  }

  var fileId = fileIdRef.current;

  var body = [
    // 顶部：标签页 + 状态 + 实时预览，一起吸顶。这样往下调参数时预览始终可见，
    // 不用"滚下去改完再滚回来看"。
    React.createElement("div", { className: "gs-stickyhead", key: "head" },
      React.createElement("div", { className: "gs-tabs", key: "tabs" },
        React.createElement("button", {
          type: "button", className: tab === "greeting" ? "gs-tab gs-tab-on" : "gs-tab",
          onClick: function () { setTab("greeting"); }
        }, "开场语"),
        React.createElement("button", {
          type: "button", className: tab === "signOff" ? "gs-tab gs-tab-on" : "gs-tab",
          onClick: function () { setTab("signOff"); }
        }, "结束语"),
        React.createElement("span", { className: "gs-saved" },
          busy ? "正在保存…" : saved ? "已保存 · 下一次回复即生效" : touched ? "有未保存的改动" : "")
      ),
      React.createElement("div", { className: "gs-preview", key: "preview" },
        React.createElement("div", { className: "gs-label" }, "实时预览（两行都显示，正在编辑的那行高亮）"),
        React.createElement("div", { className: tab === "greeting" ? "gs-preview-line gs-preview-on" : "gs-preview-line" },
          lineRender(draft.greeting, "开场", "preview-greeting")),
        React.createElement("div", { className: tab === "signOff" ? "gs-preview-line gs-preview-on" : "gs-preview-line" },
          lineRender(draft.signOff, "收尾", "preview-signoff"))
      )
    ),
    section("文本（会写进我回复的正文，可含表情）", "text",
      React.createElement("div", null,
        React.createElement("textarea", {
          className: "gs-textarea", value: line.text,
          onChange: function (event) { setLine({ text: event.target.value }); }
        }),
        React.createElement("div", { className: "gs-emojis" },
          EMOJIS.map(function (emoji) {
            return React.createElement("button", {
              key: emoji, type: "button", className: "gs-emoji",
              title: "插入 " + emoji,
              onClick: function () { insertEmoji(emoji); }
            }, emoji);
          }),
          React.createElement("button", {
            type: "button",
            className: emojiOpen ? "gs-tab gs-tab-on" : "gs-tab",
            title: "展开全部表情（" + emojiTotalLabel() + "，可用中文名搜索）",
            onClick: function () { setEmojiOpen(!emojiOpen); }
          }, emojiOpen ? "收起表情 ▴" : "全部表情 ▾")
        ),
        emojiOpen
          ? React.createElement("div", { className: "gs-emoji-tools", key: "emoji-tools" },
              React.createElement("span", { className: "gs-emoji-searchwrap" },
                React.createElement("input", {
                  className: "gs-emoji-search", type: "search", value: emojiQuery,
                  placeholder: "搜表情中文名：皇冠 / 鞭炮 / 钱包",
                  title: "支持中文名与关键词搜索，多个词用空格分隔（如「钱 袋」）",
                  onChange: function (event) { setEmojiQuery(event.target.value); }
                }),
                emojiSearching
                  ? React.createElement("button", {
                      type: "button", className: "gs-emoji-clear", title: "清空搜索",
                      onClick: function () { setEmojiQuery(""); }
                    }, "✕")
                  : null
              ),
              React.createElement("span", { className: "gs-emoji-count" },
                emojiSearching
                  ? "命中 " + emojiShown.length + " 个" + (emojiShown.length === 0 ? "（换个词试试，如「皇冠/钱包/奖杯」）" : "")
                  : "共 " + emojiTotalLabel())
            )
          : null,
        emojiOpen && !emojiSearching && recentEmojis.length > 0
          ? React.createElement("div", { className: "gs-emoji-recent", key: "emoji-recent" },
              React.createElement("span", { className: "gs-label" }, "最近用过"),
              recentEmojis.map(function (emoji) {
                return React.createElement("button", {
                  key: "recent-" + emoji, type: "button", className: "gs-emoji",
                  title: "插入 " + emoji,
                  onClick: function () { insertEmoji(emoji); }
                }, emoji);
              })
            )
          : null,
        emojiOpen
          ? React.createElement("div", { className: "gs-emojis-page" },
              emojiShown.map(function (emoji) {
                var entry = EMOJI_INDEX === null ? undefined : EMOJI_INDEX[emoji.codePointAt(0).toString(16)];
                var label = entry === undefined ? emoji : entry[1] + " " + emoji;
                if (entry !== undefined && entry[2]) label = label + "（" + entry[2].split("|").join("、") + "）";
                return React.createElement("button", {
                  key: emoji, type: "button", className: "gs-emoji-cell",
                  title: label,
                  onClick: function () { insertEmoji(emoji); }
                }, emoji);
              })
            )
          : null,
        React.createElement("div", { className: "gs-emojis", key: "vars" },
          React.createElement("span", { className: "gs-label" }, "动态变量（点一下插到末尾）"),
          [["{date}", "日期，如 2026-09-18"], ["{weekday}", "星期几"], ["{daypart}", "早上好 / 下午好 / 晚上好…"],
            ["{year}", "年"], ["{month}", "月"], ["{day}", "日"], ["{time}", "时:分"]
          ].map(function (pair) {
            return React.createElement("button", {
              key: pair[0], type: "button", className: "gs-tagbtn", title: pair[1],
              onClick: function () {
                var needsSpace = line.text.length > 0 && !/\s$/.test(line.text);
                setLine({ text: line.text + (needsSpace ? " " : "") + pair[0] });
              }
            }, pair[0]);
          })
        ),
        React.createElement("div", { className: "gs-hint", key: "resolved" },
          "现在会解析成：" + (resolveTemplate(line.text, new Date()).replace(/\n/g, " ⏎ ") || "（空）")),
        React.createElement("div", {
          className: "gs-hint",
          title: "点「全部表情」展开全部可显示表情（" + emojiTotalLabel() + "），可用中文名搜索（如「皇冠」「鞭炮」「钱包」）。也可以直接用系统表情面板：Win + ." + (EMOJI_SCAN.blank > 0 ? " 已自动隐藏 " + EMOJI_SCAN.blank + " 个本机字体没有字形的表情。" : "")
        }, "常用表情在上面，点「全部表情」可搜索全部 " + emojiTotalLabel() + "（Win + . 也能调系统面板）")
      )
    ),
    section("字体与颜色", "font",
      grid("font-grid", [
        sliderCell("字号", line.fontSize, 10, 40, 1, "px", function (value) { setLine({ fontSize: value }); }, "size"),
        selectCell("字重", WEIGHTS.map(function (w) { return { value: w, label: String(w) }; }), line.fontWeight,
          function (value) { setLine({ fontWeight: Number(value) }); }, "weight"),
        cell("颜色", React.createElement("span", { className: "gs-cellgroup" },
          COLORS.map(function (color) {
            return React.createElement("button", {
              key: color === "" ? "theme" : color,
              type: "button",
              className: color === line.color ? "gs-swatch gs-swatch-on" : "gs-swatch",
              style: { background: color === "" ? "var(--dsw-alias-label-primary)" : color },
              title: color === "" ? "跟随主题" : color,
              onClick: function () { setLine({ color: color }); }
            });
          }),
          React.createElement("input", {
            className: "gs-color", type: "color",
            value: line.color === "" ? "#1f2329" : line.color,
            onChange: function (event) { setLine({ color: event.target.value }); }
          })
        ), "color", true),
        selectCell("动效", ANIMATIONS, line.animation,
          function (value) { setLine({ animation: value }); }, "animation"),
        sliderCell("速度", line.animSpeed, 1, 4, 1, "×", function (value) { setLine({ animSpeed: value }); }, "animSpeed"),
        React.createElement("div", { className: "gs-cell gs-cell-wide", key: "image" },
          React.createElement("span", { className: "gs-label" }, "图片"),
          React.createElement("div", { className: "gs-cellgroup" },
            React.createElement("input", {
              className: "gs-file", id: fileId + "-pick", type: "file",
              accept: "image/png,image/jpeg,image/gif,image/webp",
              onChange: function (event) {
                var file = event.target.files && event.target.files[0];
                if (file) loadImage(file);
                event.target.value = "";
              }
            }),
            React.createElement("label", { className: "gs-btn", htmlFor: fileId + "-pick" },
              line.image.length > 0 ? "更换图片 / GIF" : "选择图片 / GIF"),
            line.image.length > 0
              ? React.createElement("span", { className: "gs-thumbwrap" },
                  React.createElement("img", { className: "gs-thumb", src: line.image, alt: "" }),
                  React.createElement("button", {
                    type: "button", className: "gs-btn", onClick: function () { setLine({ image: "" }); }
                  }, "移除")
                )
              : React.createElement("span", { className: "gs-hint" }, "PNG / JPEG / GIF / WebP ≤300KB（只在页面显示）")
          )
        ),
        sliderCell("图高", line.imageHeight, 12, 64, 1, "px", function (value) { setLine({ imageHeight: value }); }, "imageHeight"),
        React.createElement("div", { className: "gs-cell gs-cell-wide", key: "dark" },
          React.createElement("span", { className: "gs-label" }, "深色主题"),
          React.createElement("div", { className: "gs-cellgroup" },
            [["colorDark", "字色", "#ffb545"], ["bgColorDark", "底色", "#3a2a12"], ["borderColorDark", "边框色", "#8a6a30"]].map(function (entry) {
              var fieldName = entry[0];
              var current = typeof line[fieldName] === "string" ? line[fieldName] : "";
              var patch = {};
              return React.createElement("span", { className: "gs-thumbwrap", key: fieldName },
                React.createElement("span", { className: "gs-label" }, entry[1]),
                React.createElement("input", {
                  className: "gs-color", type: "color", title: entry[1] + "（深色主题下生效）",
                  value: current === "" ? entry[2] : current,
                  onChange: function (event) {
                    var next = {};
                    next[fieldName] = event.target.value;
                    setLine(next);
                  }
                }),
                React.createElement("button", {
                  type: "button", className: current === "" ? "gs-btn gs-btn-on" : "gs-btn",
                  title: "留空时沿用浅色主题的取值",
                  onClick: function () { var next = {}; next[fieldName] = ""; setLine(next); }
                }, current === "" ? "跟随浅色" : "清除")
              );
            }),
            React.createElement("span", { className: "gs-hint" }, "只在深色主题下覆盖上面的颜色；不填就跟随浅色")
          )
        )
      ])
    ),
    section("外观样式（形状 / 填充 / 边框 / 阴影，只影响页面显示）", "deco",
      React.createElement("div", { className: "gs-presets", key: "presets" },
        React.createElement("span", { className: "gs-label" }, "一键外观"),
        STYLE_PRESETS.map(function (preset) {
          return React.createElement("button", {
            key: preset.id, type: "button", className: "gs-preset",
            title: "套用「" + preset.name + "」的外观（文案与图片不动）",
            onClick: function () { applyPreset(preset); }
          },
            React.createElement("span", { className: "gs-preset-dot", style: { background: preset.dot } }),
            preset.name
          );
        }),
        React.createElement("button", {
          type: "button", className: presetBoth ? "gs-tab gs-tab-on" : "gs-tab",
          title: "开：一次改两行；关：只改当前标签页",
          onClick: function () { setPresetBoth(!presetBoth); }
        }, presetBoth ? "两行都套" : "只套本页")
      ),
      grid("deco-grid", [
        selectCell("形状", SHAPES, line.shape, function (value) {
          var patch = { shape: value };
          // 选形状时把该预设的圆角一并带过去，省得再拖一次滑杆
          for (var si = 0; si < SHAPES.length; si += 1) {
            if (SHAPES[si].value === value && value !== "none") patch.radius = SHAPES[si].radius;
          }
          setLine(patch);
        }, "shape"),
        selectCell("填充", FILLS, line.fill, function (value) { setLine({ fill: value }); }, "fill"),
        sliderCell("圆角", line.radius, 0, 40, 1, "px", function (value) { setLine({ radius: value }); }, "radius"),
        sliderCell("内边距", line.padY, 0, 24, 1, "px", function (value) { setLine({ padY: value }); }, "padY"),
        cell("底色", React.createElement("span", { className: "gs-cellgroup" },
          React.createElement("input", {
            className: "gs-color", type: "color",
            value: line.bgColor === "" ? "#eef2f6" : line.bgColor,
            title: "填充选「自定义底色」时生效",
            onChange: function (event) { setLine({ bgColor: event.target.value, fill: "solid" }); }
          }),
          React.createElement("span", { className: "gs-hint" }, line.fill === "solid" ? "已启用" : "选「自定义底色」启用")
        ), "bgColor", true),
        sliderCell("边框", line.borderWidth, 0, 6, 1, "px", function (value) { setLine({ borderWidth: value }); }, "borderWidth"),
        cell("边色", React.createElement("span", { className: "gs-cellgroup" },
          React.createElement("input", {
            className: "gs-color", type: "color",
            value: line.borderColor === "" ? "#2f6fed" : line.borderColor,
            title: "边框为 0 时看不出效果",
            onChange: function (event) { setLine({ borderColor: event.target.value, borderWidth: line.borderWidth > 0 ? line.borderWidth : 1 }); }
          }),
          React.createElement("span", { className: "gs-hint" }, line.borderWidth > 0 ? "生效中" : "边框为 0")
        ), "borderColor", true),
        selectCell("阴影", SHADOWS, line.shadow, function (value) { setLine({ shadow: value }); }, "shadow"),
        sliderCell("字距", line.letterSpacing, -2, 12, 1, "px", function (value) { setLine({ letterSpacing: value }); }, "letterSpacing"),
        selectCell("大小写", [
          { value: "none", label: "保持原样" },
          { value: "upper", label: "全大写" },
          { value: "lower", label: "全小写" }
        ], line.caps, function (value) { setLine({ caps: value }); }, "caps"),
        selectCell("斜体", [
          { value: false, label: "正常" },
          { value: true, label: "斜体" }
        ], line.italic, function (value) { setLine({ italic: value === "true" || value === true }); }, "italic")
      ])
    ),
    section("上下文提醒与匹配（阈值 = 进度条颜色分界）", "alert",
      grid("alert-grid", [
        sliderCell("黄色", draft.warnPercent, 1, 99, 1, "%", function (value) { patchTop({ warnPercent: value }); }, "warn"),
        sliderCell("红色", draft.criticalPercent, 2, 100, 1, "%", function (value) { patchTop({ criticalPercent: value }); }, "crit"),
        selectCell("匹配", [
          { value: "exact", label: "逐字相同" },
          { value: "loose", label: "宽松（推荐）" },
          { value: "fuzzy", label: "近似容错（差一两个字也算）" }
        ], draft.matchMode, function (value) { patchTop({ matchMode: value }); }, "matchMode", true),
        selectCell("贴样式范围", [
          { value: true, label: "只贴我的回复（推荐）" },
          { value: false, label: "整段对话都贴" }
        ], draft.onlyAssistant, function (value) { patchTop({ onlyAssistant: value === "true" || value === true }); }, "onlyAssistant", true)
      ]),
      {
        defaultOpen: false,
        summary: "黄 " + draft.warnPercent + "% · 红 " + draft.criticalPercent + "% · " + matchModeLabel(draft.matchMode)
      }
    ),
    section("旧文案兼容（可选 · 只影响显示，不写进提示词）", "legacy",
      React.createElement("div", { className: "gs-hint", key: "legacy-hint" },
        "换过文案之后，历史会话里的旧开场/收尾也可以贴上样式：把旧原文填进来，并选它当初属于哪一行。"),
      (draft.legacyLines || []).map(function (item, index) {
        return React.createElement("div", { className: "gs-legacy-row", key: "legacy-" + index },
          React.createElement("input", {
            className: "gs-input", value: item.text, placeholder: "旧文案原文",
            onChange: function (event) {
              var next = (draft.legacyLines || []).slice();
              next[index] = Object.assign({}, item, { text: event.target.value });
              patchTop({ legacyLines: next });
            }
          }),
          React.createElement("select", {
            className: "gs-input gs-select", value: item.style, style: { width: 116, flex: "none" },
            onChange: function (event) {
              var next = (draft.legacyLines || []).slice();
              next[index] = Object.assign({}, item, { style: event.target.value });
              patchTop({ legacyLines: next });
            }
          },
            React.createElement("option", { value: "greeting" }, "用开场样式"),
            React.createElement("option", { value: "signOff" }, "用收尾样式")
          ),
          React.createElement("button", {
            type: "button", className: "gs-btn",
            onClick: function () {
              var next = (draft.legacyLines || []).slice();
              next.splice(index, 1);
              patchTop({ legacyLines: next });
            }
          }, "删除")
        );
      }),
      React.createElement("div", { className: "gs-presets", key: "legacy-add" },
        React.createElement("button", {
          type: "button", className: "gs-btn",
          onClick: function () { patchTop({ legacyLines: (draft.legacyLines || []).concat([{ text: "", style: "greeting" }]) }); }
        }, "+ 添加一条旧文案"),
        React.createElement("span", { className: "gs-hint" }, "最多 30 条；空行会拦住保存，填上或删掉即可")
      ),
      {
        defaultOpen: false,
        summary: (draft.legacyLines || []).length === 0 ? "未设置" : (draft.legacyLines || []).length + " 条"
      }
    )
  ];

  // 进度条外观：纯前端偏好（存浏览器本地），选一下立即生效，不用保存、不用重启。
  var ui = useUiPrefs();
  body.push(section("进度条外观（立即生效，存浏览器本地）", "bar", grid("bar-grid", [
      selectCell("形态", [
        { value: "full", label: "完整（进度条 + 小车 + 百分比）" },
        { value: "compact", label: "紧凑细条（不显示百分比气泡）" },
        { value: "text", label: "只显示一行文字" }
      ], ui.display, function (value) { setUiPrefs({ display: value }); }, "display", true),
      selectCell("粗细", BAR_HEIGHTS.map(function (h) { return { value: h, label: h + "px" }; }), ui.barHeight,
        function (value) { setUiPrefs({ barHeight: Number(value) }); }, "barHeight"),
      selectCell("大小", MARKER_SCALES, ui.markerScale,
        function (value) { setUiPrefs({ markerScale: Number(value) }); }, "markerScale"),
      cell("配色", React.createElement("span", { className: "gs-cellgroup" },
        React.createElement("span", {
          className: "gs-scheme-bar",
          style: { background: "linear-gradient(90deg," + schemeOf(ui.scheme).colors[0] + "," + schemeOf(ui.scheme).colors[1] + "," + schemeOf(ui.scheme).colors[2] + ")" }
        }),
        React.createElement("select", {
          className: "gs-input gs-select", value: ui.scheme, title: "共 " + BAR_SCHEMES.length + " 套配色",
          onChange: function (event) { setUiPrefs({ scheme: event.target.value }); }
        }, schemeOptions())
      ), "scheme"),
      selectCell("朝向", [
        { value: "right", label: "车头向右 →" },
        { value: "native", label: "原样" }
      ], ui.facing, function (value) { setUiPrefs({ facing: value }); }, "facing"),
      selectCell("小车", (function () {
        var options = BAR_MARKERS.map(function (item) {
          return { value: item.value === "" ? "__none__" : item.value, label: item.label === "" ? "无" : (item.label + " " + item.name) };
        });
        if (ui.markerImage !== "") options = options.concat([{ value: "__custom__", label: "自定义图片" }]);
        return options;
      })(), ui.markerImage !== "" ? "__custom__" : (ui.marker === "" ? "__none__" : ui.marker),
        function (value) {
          if (value === "__custom__") return;                       // 只是显示当前状态，不改变
          if (value === "__none__") { setUiPrefs({ marker: "", markerImage: "" }); return; }
          setUiPrefs({ marker: value, markerImage: "" });
        }, "marker", true),
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "markerImage" },
        React.createElement("span", { className: "gs-label" }, "自定义"),
        React.createElement("div", { className: "gs-cellgroup" },
          React.createElement("input", {
            className: "gs-file", id: fileId + "-car", type: "file",
            accept: "image/png,image/jpeg,image/gif,image/webp",
            onChange: function (event) {
              var file = event.target.files && event.target.files[0];
              if (file) loadMarkerImage(file);
              event.target.value = "";
            }
          }),
          React.createElement("label", {
            className: ui.markerImage !== "" ? "gs-btn gs-btn-on" : "gs-btn",
            htmlFor: fileId + "-car"
          }, ui.markerImage !== "" ? "更换小车图片" : "上传小车图片"),
          ui.markerImage !== ""
            ? React.createElement("span", { className: "gs-thumbwrap" },
                React.createElement("img", { className: "gs-thumb", src: ui.markerImage, alt: "" }),
                React.createElement("button", {
                  type: "button", className: "gs-btn",
                  onClick: function () { setUiPrefs({ imageFlipped: ui.imageFlipped !== true }); }
                }, ui.imageFlipped === true ? "翻转：开" : "翻转：关"),
                React.createElement("button", {
                  type: "button", className: "gs-btn",
                  onClick: function () { setUiPrefs({ markerImage: "" }); }
                }, "移除")
              )
            : React.createElement("span", { className: "gs-hint" }, "PNG / JPEG / GIF / WebP ≤250KB")
        )
      )
    ]), { defaultOpen: false, summary: "配色 " + schemeOf(ui.scheme).label + " · " + (ui.marker === "" && ui.markerImage === "" ? "无小车" : "有车标") }));
  if (error !== "") body.push(React.createElement("div", { className: "gs-hint gs-hint-error", key: "error", role: "alert" }, error));
  else if (invalid !== null) body.push(React.createElement("div", { className: "gs-hint gs-hint-error", key: "invalid", role: "alert" }, "还差一步：" + invalid));
  if (notice !== "") body.push(React.createElement("div", { className: "gs-hint", key: "notice" }, notice));
  // 诊断：自查用。样式没贴上的时候，先看这里的"命中行数"和"跳过非助手"。
  body.push(section("诊断（样式没生效时先看这里）", "diag",
    React.createElement("div", { className: "gs-diag" },
      React.createElement("div", null, "插件版本：v" + CLIENT_VERSION + "（浏览器半）"),
      React.createElement("div", null, "配置文件：" + (store.path || "（未知，宿主半可能没加载）")),
      React.createElement("div", null, "配置来源：" + (state.error ? "读取失败 · " + state.error : store.loaded ? "已读取" : "尚未读取")),
      React.createElement("div", null, "贴样式器：运行 " + stylerStats.runs + " 次 · 上次耗时 " + stylerStats.lastMs + "ms"),
      React.createElement("div", null, "上次扫描：命中 " + stylerStats.matched + " 行 / 重扫 " + stylerStats.scanned + " 块 / 共 " + stylerStats.blocks + " 块 · 跳过非助手 " + stylerStats.skippedNonAssistant + " 块"),
      React.createElement("div", null, "匹配模式：" + matchModeLabel(state.config.matchMode) + " · 贴样式范围：" + (state.config.onlyAssistant === false ? "整段对话" : "只贴我的回复") + " · 旧文案 " + (state.config.legacyLines || []).length + " 条"),
      React.createElement("div", null, "当前标签页命中：" + (typeof document !== "undefined" ? document.querySelectorAll(".gs-chat-line").length : 0) + " 行（整页）"),
      React.createElement("div", null, "宿主导航条读数：" + (typeof document !== "undefined" && document.querySelector(".gs-dock-bar") ? (document.querySelector(".gs-dock-bar").getAttribute("aria-valuenow") || "未知") : "未挂载"))
    ),
    { defaultOpen: false, summary: "v" + CLIENT_VERSION }
  ));
  body.push(React.createElement("div", { className: "gs-actions", key: "actions" },
    React.createElement("button", {
      type: "button", className: "gs-btn gs-btn-on",
      onClick: function () { commit(draft); }
    }, busy ? "正在保存…" : "保存并生效"),
    React.createElement("button", {
      type: "button", className: "gs-btn",
      onClick: function () { commit(DEFAULTS); }
    }, "恢复默认"),
    React.createElement("button", {
      type: "button", className: "gs-btn", title: "把当前配置导出成 JSON（含图片地址，可备份或分享）",
      onClick: exportConfig
    }, "导出配置"),
    React.createElement("input", {
      className: "gs-file", id: fileId + "-import", type: "file", accept: "application/json,.json",
      onChange: function (event) {
        var file = event.target.files && event.target.files[0];
        if (file) importConfig(file);
        event.target.value = "";
      }
    }),
    React.createElement("label", { className: "gs-btn", htmlFor: fileId + "-import", title: "从 JSON 文件导入配置" }, "导入配置"),
    React.createElement("span", { className: "gs-hint" }, "改动也会自动保存")
  ));

  return React.createElement("div", { className: "gs-panel" }, body);
}

/* ─── 输入框上方的卡片：样式预览 + 占用提醒 ───────────────────────────── */

function occupancyOf(pressure) {
  if (pressure === null || pressure === undefined) return null;
  var used = typeof pressure.projectedTokens === "number" ? pressure.projectedTokens : pressure.pressureTokens;
  var capacity = pressure.contextWindow;
  if (typeof used !== "number" || typeof capacity !== "number" || capacity <= 0) return null;
  return { percent: Math.min(100, Math.round(used / capacity * 100)), used: used, capacity: capacity };
}

function formatTokens(value) {
  if (typeof value !== "number" || !isFinite(value)) return "?";
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return String(Math.round(value));
}

/**
 * 量出进度条左右需要留多少，才能与输入框卡片左右对齐。
 * 输入框卡片是 composer 里带 `_card` 类的那层（其外层 composerStack 与我们在同一宽度），
 * hero 态与对话态的缩进不一样，所以每次实时量，而不是写死像素。
 * @param dockEl - 进度条所在容器。
 * @returns 左右内边距（px），量不到时返回 null。
 */
function composerInsets(dockEl) {
  try {
    if (dockEl === null || typeof dockEl.getBoundingClientRect !== "function") return null;
    var stack = typeof dockEl.closest === "function" ? dockEl.closest('[class*="composerStack"]') : null;
    if (stack === null) stack = dockEl.parentElement;
    if (stack === null) return null;
    var card = null;
    var input = stack.querySelector('textarea, [contenteditable="true"]');
    if (input !== null) {
      var cur = input;
      while (cur !== null && cur !== stack) {
        if (typeof cur.className === "string" && cur.className.indexOf("_card") >= 0) { card = cur; break; }
        cur = cur.parentElement;
      }
    }
    if (card === null) {
      // 退化：同容器里宽度小于容器、且位于进度条下方的元素中取最宽的那个（通常就是输入框卡片）。
      var dockTop = dockEl.getBoundingClientRect().top;
      var best = 0;
      var nodes = stack.querySelectorAll("div");
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        var box = node.getBoundingClientRect();
        if (box.top < dockTop) continue;
        if (box.width < 120) continue;
        var text = node.querySelector('textarea, [contenteditable="true"]');
        if (text === null) continue;
        if (box.width > best) { best = box.width; card = node; }
      }
    }
    if (card === null) return null;
    var dockRect = dockEl.getBoundingClientRect();
    var cardRect = card.getBoundingClientRect();
    return {
      left: Math.max(0, Math.round(cardRect.left - dockRect.left)),
      right: Math.max(0, Math.round(dockRect.right - cardRect.right))
    };
  } catch (error) {
    console.error("[greet-signoff] inset measure failed", error);
    return null;
  }
}

function GreetDock(props) {
  var store = useConfig();
  var config = store.config;
  var pressure = props !== null && props !== undefined && typeof props.useProjection === "function"
    ? props.useProjection("contextPressure")
    : undefined;
  var occupancy = occupancyOf(pressure);
  var percent = occupancy === null ? 0 : occupancy.percent;
  var tone = percent >= config.criticalPercent ? "critical" : percent >= config.warnPercent ? "warn" : "ok";

  var dockRef = React.useRef(null);
  var insetPair = React.useState(null);
  var insets = insetPair[0];
  var setInsets = insetPair[1];

  // 与输入框对齐：实时量输入框卡片相对本容器的左右缩进（hero/对话态、窗口缩放都会变）。
  React.useEffect(function () {
    function measure() {
      var el = dockRef.current;
      if (el === null) return;
      var next = composerInsets(el);
      setInsets(function (prev) {
        if (prev === null && next === null) return prev;
        if (prev !== null && next !== null && prev.left === next.left && prev.right === next.right) return prev;
        return next;
      });
    }
    measure();
    // 不再用 1.5s 定时轮询：那会在整个会话期间反复做强制同步布局（querySelectorAll + getBoundingClientRect）。
    // 现在只靠 ResizeObserver（输入框卡片所在层）+ window resize，外加挂载后的两次补测覆盖 hero→对话态切换。
    window.addEventListener("resize", measure);
    var late = [setTimeout(measure, 300), setTimeout(measure, 1200)];
    var observer = null;
    var el = dockRef.current;
    if (el !== null && el.parentElement !== null && typeof ResizeObserver === "function") {
      observer = new ResizeObserver(measure);
      observer.observe(el.parentElement);
    }
    return function () {
      for (var i = 0; i < late.length; i += 1) clearTimeout(late[i]);
      window.removeEventListener("resize", measure);
      if (observer !== null) observer.disconnect();
    };
  }, []);

  // 百分比直接取投影的实时值（不再节流）：车头上的数字随占用实时变化。
  var hasReading = occupancy !== null;
  // 采样"每一轮大概吃掉多少 token"：占用只在下一轮请求过后才跳一截，
  // 因此把 >200 的正向增量当作一次"又走了一轮"，取最近几次的均值来估算还能聊几轮。
  var samplerRef = React.useRef({ last: null, jumps: [] });
  var usedTokens = hasReading ? occupancy.used : -1;
  React.useEffect(function () {
    if (usedTokens < 0) return;
    var sampler = samplerRef.current;
    if (sampler.last === null) { sampler.last = usedTokens; return; }
    var delta = usedTokens - sampler.last;
    if (delta > 200) {
      sampler.jumps.push(delta);
      if (sampler.jumps.length > 6) sampler.jumps.shift();
      sampler.last = usedTokens;
    } else if (delta < -200) {
      // 压缩/清空导致占用回落：重置基线，别把负数算进每轮成本
      sampler.last = usedTokens;
    }
  }, [usedTokens]);
  var jumps = samplerRef.current.jumps;
  var avgPerTurn = null;
  if (jumps.length > 0) {
    var jumpSum = 0;
    for (var ji = 0; ji < jumps.length; ji += 1) jumpSum += jumps[ji];
    avgPerTurn = Math.round(jumpSum / jumps.length);
  }
  var remaining = hasReading ? Math.max(0, occupancy.capacity - occupancy.used) : null;
  var turnsLeft = avgPerTurn !== null && avgPerTurn > 0 && remaining !== null
    ? Math.max(0, Math.floor(remaining / avgPerTurn))
    : null;
  var detail = hasReading
    ? "上下文占用 " + percent + "% · ~" + formatTokens(occupancy.used) + " / " + formatTokens(occupancy.capacity)
      + " · 剩余 ~" + formatTokens(remaining)
      + (turnsLeft !== null ? " · 约还能聊 " + turnsLeft + " 轮（最近 " + jumps.length + " 轮均值 ~" + formatTokens(avgPerTurn) + "/轮）" : "")
    : "上下文占用未知（发一条消息后显示）";
  var tip = detail;
  // 还没有任何请求记录时不显示 "0%"（那看起来像坏了），显示一个短横。
  var pctText = hasReading ? percent + "%" : "—";
  var shortText = hasReading
    ? percent + "% · 剩余 ~" + formatTokens(remaining) + (turnsLeft !== null ? " · 约还能聊 " + turnsLeft + " 轮" : "")
    : "上下文占用未知";
  var alertLine = tone === "critical"
    ? "🚨 上下文即将占满：请开新会话继续"
    : tone === "warn"
      ? "⚠️ 上下文接近上限：建议另开新会话继续"
      : null;
  // 超过阈值时给一个"开新会话"按钮：客户端 uiWorkspace 服务提供 startSession()。
  // 该服务是可选的，拿不到就只显示文字提醒，不显示按钮。
  var startSession = pluginCtx !== null && typeof pluginCtx.get === "function" ? pluginCtx.get("uiWorkspace") : undefined;
  var canStartSession = startSession !== undefined && startSession !== null && typeof startSession.startSession === "function";
  function openNewSession() {
    try {
      startSession.startSession();
    } catch (error) {
      console.error("[greet-signoff] startSession failed", error);
    }
  }

  // 导航条式进度条：一辆小车随占用前进，车头实时显示百分比；
  // 颜色按两段式色带随占用变化（0% 安全色 → 黄色阈值 → 红色阈值），到达红色阈值整条纯色并呼吸。
  // 左右内边距由 composerInsets() 实时量出，因此长度始终与输入框对齐、随其缩放。
  var ui = useUiPrefs();
  var scheme = schemeOf(ui.scheme);
  var palette = scheme.colors;
  var color = rampColor(percent, config.warnPercent, config.criticalPercent, palette);
  var scale = barScale(config.warnPercent, config.criticalPercent, palette);
  var scaleFaint = barScale(config.warnPercent, config.criticalPercent, palette, 0.22);
  var dangerColor = palette[2];
  var barHeight = typeof ui.barHeight === "number" ? ui.barHeight : 9;
  var marker = typeof ui.marker === "string" ? ui.marker : "";
  var markerImage = typeof ui.markerImage === "string" ? ui.markerImage : "";
  var markerExtra = typeof ui.markerScale === "number" ? ui.markerScale : 12;
  // 车头朝向：默认把所有"天生朝左"的车型水平镜像成朝右；自定义图片用单独的翻转开关。
  var facingRight = ui.facing !== "native";
  var flip = markerImage !== ""
    ? ui.imageFlipped === true
    : (facingRight && MARKER_FLIP[marker] === 1);
  var critical = tone === "critical";
  var clampLeft = "clamp(" + Math.round(barHeight + 10) + "px, " + percent + "%, calc(100% - " + Math.round(barHeight + 10) + "px))";
  var markerNode = markerImage !== ""
    ? React.createElement("img", { className: "gs-marker-img", src: markerImage, alt: "" })
    : React.createElement("span", { className: "gs-marker-emoji" }, marker);

  // 外层 .gs-dock 不带背景、不留横向内边距：
  // 宿主主题会给输入区附属卡片（[data-slot="conversation.input.dock"] > *）强制上白底/圆角/阴影，
  // 若把"与输入框对齐"的缩进做成外层 padding，白底就会跟着撑到两侧，出现多余的白框。
  // 因此缩进只作用在内层 .gs-dock-row 上（该元素不在宿主选择器的直接子级匹配范围内）。
  var rowStyle = insets === null ? {} : { paddingLeft: insets.left + "px", paddingRight: insets.right + "px" };
  // 形态：full 完整 / compact 紧凑细条（不显示百分比气泡）/ text 只显示一行文字。
  var display = ui.display === "compact" || ui.display === "text" ? ui.display : "full";
  var dockClass = "gs-dock";
  if (critical) dockClass += " gs-dock-critical";
  if (display === "compact") dockClass += " gs-dock-compact";
  var barNode = React.createElement("div", {
    className: "gs-dock-bar",
    role: "progressbar",
    "aria-label": "上下文占用",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": hasReading ? percent : undefined,
    "aria-valuetext": detail,
    title: detail
  },
    React.createElement("div", {
      className: "gs-dock-fill",
      style: critical ? { width: percent + "%", background: dangerColor } : { width: (percent > 0 ? percent : 0) + "%" }
    }),
    (marker === "" && markerImage === "")
      ? null
      : React.createElement("div", {
          className: critical ? "gs-marker gs-marker-critical" : "gs-marker",
          style: flip ? { left: clampLeft, "--gs-flip": "-1" } : { left: clampLeft }
        },
          markerNode,
          React.createElement("span", { className: "gs-marker-pct", style: critical ? undefined : { background: color } }, pctText)
        )
  );
  var textNode = React.createElement("div", { className: "gs-dock-textrow", title: detail },
    React.createElement("span", { className: "gs-dock-textdot", style: { background: critical ? dangerColor : color } }),
    React.createElement("span", null, shortText),
    canStartSession && alertLine !== null
      ? React.createElement("button", { type: "button", className: "gs-dock-new", onClick: openNewSession }, "开新会话")
      : null
  );
  return React.createElement("div", {
    className: dockClass,
    ref: dockRef,
    style: {
      "--gs-bar-h": (display === "compact" ? 4 : barHeight) + "px",
      "--gs-marker-extra": markerExtra + "px",
      "--gs-scale": scale,
      "--gs-scale-faint": scaleFaint,
      "--gs-percent": Math.max(1, percent),
      "--gs-danger": dangerColor
    }
  },
    React.createElement("div", { className: "gs-tip" }, tip),
    React.createElement("div", { className: "gs-dock-row", style: rowStyle },
      display === "text" ? textNode : barNode
    ),
    display === "text" || alertLine === null ? null : React.createElement("div", { className: "gs-dock-alert" },
      alertLine,
      canStartSession
        ? React.createElement("button", { type: "button", className: "gs-dock-new", onClick: openNewSession }, "开新会话")
        : null
    )
  );
}

/* ─── 对话正文里的开场/收尾行样式 ─────────────────────────────────────── */

var CHAT_CLASSES = ["gs-chat-line", "gs-chat-greeting", "gs-chat-signoff", "gs-chat-img", "gs-decor", "gs-anim"]
  .concat(ANIMATIONS.map(function (item) { return "gs-anim-" + item.value; }))
  .concat(SHAPES.map(function (item) { return "gs-shape-" + item.value; }))
  .concat(FILLS.map(function (item) { return "gs-fill-" + item.value; }))
  .concat(SHADOWS.map(function (item) { return "gs-shadow-" + item.value; }));

/**
 * 一行配置对应的 CSS 声明（字号/字重/字距/大小写/形状/填充/边框/动效）。
 * 供对话正文的注入样式表使用；值在客户端已被归一化，因此这里可以安全地直接拼接。
 * @param {Object} line 配置里的行对象。
 * @param {boolean} dark 是否生成"深色主题"用的那一份（用 `<字段>Dark`，留空则回落浅色）。
 * @returns {string} CSS 声明串。
 */
function lineCssDecls(line, dark) {
  var preset = null;
  for (var i = 0; i < SHAPES.length; i += 1) {
    if (SHAPES[i].value === line.shape) preset = SHAPES[i];
  }
  var color = dark === true ? (line.colorDark || line.color) : line.color;
  var bgColor = dark === true ? (line.bgColorDark || line.bgColor) : line.bgColor;
  var borderColor = dark === true ? (line.borderColorDark || line.borderColor) : line.borderColor;
  var decl = "font-size:" + line.fontSize + "px;font-weight:" + line.fontWeight + ";";
  if (color !== "") decl += "color:" + color + ";";
  if (line.letterSpacing !== 0) decl += "letter-spacing:" + line.letterSpacing + "px;";
  if (line.caps === "upper") decl += "text-transform:uppercase;";
  else if (line.caps === "lower") decl += "text-transform:lowercase;";
  if (line.italic === true) decl += "font-style:italic;";
  if (preset !== null) {
    decl += "display:inline-block;box-sizing:border-box;padding:" + line.padY + "px " + Math.round(line.padY * 2.2) + "px;";
    if (preset.radius !== 999) decl += "border-radius:" + preset.radius + "px;";
  } else if (line.radius > 0) {
    decl += "border-radius:" + line.radius + "px;";
  }
  if (line.shape === "underline") decl += "border-bottom:2px solid currentColor;";
  if (line.shape === "blockquote") decl += "border-left:3px solid currentColor;";
  if (line.fill === "solid" && bgColor !== "") decl += "background:" + bgColor + ";";
  if (line.borderWidth > 0) decl += "border:" + line.borderWidth + "px solid " + (borderColor === "" ? "currentColor" : borderColor) + ";";
  if (line.animSpeed !== 1) decl += "--gs-anim-speed:" + line.animSpeed + ";";
  return decl;
}

/** 生成对话正文用的样式规则（类名固定，内容随配置变化）。 */
function chatCss(config) {
  var rules = [];
  var darkRules = [];
  [["greeting", config.greeting], ["signOff", config.signOff]].forEach(function (pair) {
    var line = pair[1];
    if (typeof line.text !== "string" || line.text.trim().length === 0) return;
    var cls = ".gs-chat-" + pair[0].toLowerCase();
    rules.push(cls + "{" + lineCssDecls(line, false) + "}");
    // 深色主题专用：宿主用 body[data-ds-dark-theme] 标记深色，这条选择器权重更高，会覆盖上面的规则
    if (line.colorDark !== "" || line.bgColorDark !== "" || line.borderColorDark !== "") {
      darkRules.push("body[data-ds-dark-theme] " + cls + "{" + lineCssDecls(line, true) + "}");
    }
    if (typeof line.image === "string" && line.image.length > 0) {
      rules.push(cls + ".gs-chat-img::before{height:" + line.imageHeight + "px;width:" +
        Math.round(line.imageHeight * 1.6) + "px;background-image:url(\"" + line.image + "\")}");
    }
  });
  rules = rules.concat(darkRules);
  // 系统开了"减少动态效果"时，对话里的固定行也不动（编辑器预览那条媒体查询在 css() 里）
  rules.push("@media (prefers-reduced-motion: reduce){.gs-chat-line,.gs-chat-line span{animation:none !important}}");
  return rules.join("\n");
}

/** 匹配固定行时先剔除的不可见字符（零宽空格/连接符、BOM、软连字符）。 */
var FIXED_LINE_DROP = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** 宽松匹配时允许出现在行首/行尾的装饰性字符：引号、括号、书名号、星号、井号、句读。 */
var LOOSE_EDGE_CHARS = "\\s\\u200B-\\u200D\\u2060\\uFEFF\\u00AD\"'“”‘’「」『』《》()（）\\[\\]【】*_~`#>";

/** 标点折叠表：把中文/全角标点统一成 ASCII，这样"，"与","、"。"与"."都算同一行。 */
var PUNCT_FOLD = {
  "，": ",", "、": ",", "。": ".", "．": ".", "：": ":", "；": ";", "！": "!", "？": "?",
  "（": "(", "）": ")", "［": "[", "］": "]", "｛": "{", "｝": "}", "【": "[", "】": "]",
  "《": "<", "》": ">", "「": "\"", "」": "\"", "『": "'", "』": "'", "“": "\"", "”": "\"",
  "‘": "'", "’": "'", "～": "~", "－": "-", "—": "-", "–": "-", "·": ".", "・": ".", "　": " "
};
var PUNCT_FOLD_RE = new RegExp("[" + Object.keys(PUNCT_FOLD).join("") + "]", "g");

/** 近似匹配（fuzzy）的最低相似度，以及参与近似匹配的最短长度。 */
var FUZZY_MIN_SIMILARITY = 0.86;
var FUZZY_MIN_LENGTH = 6;

/** 宽松归一用的正则（只建一次）。 */
var FOLD_HEAD_RE = new RegExp("^[" + LOOSE_EDGE_CHARS + "]+");
var FOLD_TAIL_RE = new RegExp("[" + LOOSE_EDGE_CHARS + "]+$");
var FOLD_ASCII_TAIL_RE = /[,.:;!?]+$/;

/**
 * 把一行文本归一化成"逐字比对"的形式：去掉零宽不可见字符、把连续空白压成一个空格。
 * @param {string} text 原始文本。
 * @returns {string} 归一化后的文本。
 */
function normalizeFixedLine(text) {
  return String(text).replace(FIXED_LINE_DROP, "").replace(/\s+/g, " ").trim();
}

/**
 * 宽松归一（"宽松/近似"两档都用它）：在逐字归一的基础上再做四件事——
 *   1) Unicode NFKC（全角字母数字、兼容字符归一）；
 *   2) 中文/全角标点折叠成 ASCII（"，"→","、"。"→"."）；
 *   3) 去掉所有空白（含全角空格）；
 *   4) 削掉首尾的引号/括号/星号/井号/句读，并统一成小写。
 * 这样"配的是「你好，」正文写「你好.」""中间多一个空格""繁体标点"都不再导致样式失效。
 * @param {string} text 原始文本。
 * @returns {string} 用于宽松比对的文本。
 */
function foldFixedLine(text) {
  var value = String(text).replace(FIXED_LINE_DROP, "");
  if (typeof value.normalize === "function") {
    try { value = value.normalize("NFKC"); } catch (error) { /* 老浏览器忽略 */ }
  }
  value = value.replace(PUNCT_FOLD_RE, function (ch) { return PUNCT_FOLD[ch] !== undefined ? PUNCT_FOLD[ch] : ch; });
  value = value.replace(/\s+/g, "");
  value = value.replace(FOLD_HEAD_RE, "").replace(FOLD_ASCII_TAIL_RE, "").replace(FOLD_TAIL_RE, "").replace(FOLD_ASCII_TAIL_RE, "");
  return value.toLowerCase();
}

/**
 * 编辑距离（Levenshtein），用于近似匹配。两串都很短（固定行 ≤ 200 字），直接滚动数组算。
 * @param {string} a 串 A。
 * @param {string} b 串 B。
 * @returns {number} 需要的最少增删改次数。
 */
function editDistance(a, b) {
  if (a === b) return 0;
  var la = a.length;
  var lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  var prev = new Array(lb + 1);
  var cur = new Array(lb + 1);
  for (var j = 0; j <= lb; j += 1) prev[j] = j;
  for (var i = 1; i <= la; i += 1) {
    cur[0] = i;
    for (var k = 1; k <= lb; k += 1) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1;
      var del = prev[k] + 1;
      var ins = cur[k - 1] + 1;
      var sub = prev[k - 1] + cost;
      cur[k] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
    }
    var swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[lb];
}

/**
 * 两串的相似度 0–1。
 * @param {string} a 已宽松归一的串。
 * @param {string} b 已宽松归一的串。
 * @returns {number} 1 表示完全相同。
 */
function lineSimilarity(a, b) {
  var max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/**
 * 判断一段渲染出来的文本是否就是某个固定行的变体。
 * @param {string} rawText 元素文本。
 * @param {Object} wanted compileWantedLine 结果里的一项。
 * @param {string} mode "exact" / "loose" / "fuzzy"。
 * @returns {boolean} 命中为 true。
 */
function matchLineText(rawText, wanted, mode) {
  var norm = normalizeFixedLine(rawText);
  if (norm.length === 0) return false;
  if (norm === wanted.norm) return true;
  // 逐字相同档只认"归一化后完全相同"（含标点），不做任何折叠
  if (mode === "exact") return false;
  var fold = foldFixedLine(rawText);
  if (fold.length > 0 && fold === wanted.fold) return true;
  if (mode !== "fuzzy") return false;
  if (fold.length < FUZZY_MIN_LENGTH || wanted.fold.length < FUZZY_MIN_LENGTH) return false;
  // 长度差太多就别算了：既省时间，也避免把"短句"近似到"另一句"
  var limit = Math.max(2, Math.round(wanted.fold.length * 0.25));
  if (Math.abs(fold.length - wanted.fold.length) > limit) return false;
  return lineSimilarity(fold, wanted.fold) >= FUZZY_MIN_SIMILARITY;
}

/* ─── 动态变量 ───────────────────────────────────────────────────────── */

var WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
var DAYPART_NAMES = ["凌晨好", "早上好", "上午好", "中午好", "下午好", "晚上好", "夜深了"];

/** 时段索引：0 凌晨 / 1 早上 / 2 上午 / 3 中午 / 4 下午 / 5 晚上 / 6 深夜。 */
function daypartIndex(hour) {
  if (hour < 5) return 6;
  if (hour < 8) return 0;
  if (hour < 11) return 1;
  if (hour < 13) return 3;
  if (hour < 18) return 4;
  if (hour < 23) return 5;
  return 6;
}

function pad2(value) {
  return (value < 10 ? "0" : "") + value;
}

/**
 * 解析文案里的动态变量：
 * `{date}` 2026-09-18 · `{year}` · `{month}` · `{day}` · `{weekday}` 星期五 ·
 * `{daypart}` 早上好 · `{time}` HH:MM。
 * 不认识的 `{xxx}` 原样保留。
 * @param {string} text 含变量的文案。
 * @param {Date} now 当前时间。
 * @returns {string} 解析后的文案。
 */
function resolveTemplate(text, now) {
  if (typeof text !== "string" || text.indexOf("{") < 0) return text;
  var d = now instanceof Date ? now : new Date();
  return text.replace(/\{([a-zA-Z]+)\}/g, function (all, rawName) {
    var name = String(rawName).toLowerCase();
    if (name === "date") return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    if (name === "year") return String(d.getFullYear());
    if (name === "month") return pad2(d.getMonth() + 1);
    if (name === "day") return pad2(d.getDate());
    if (name === "weekday") return WEEKDAY_NAMES[d.getDay()];
    if (name === "daypart") return DAYPART_NAMES[daypartIndex(d.getHours())];
    if (name === "time") return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    return all;
  });
}

/**
 * 一处文案的所有候选解析结果。带 `{daypart}` 时把所有时段都作为候选，
 * 这样刚好跨过时段边界（比如 18:00 前后）时，样式仍然贴得上。
 * @param {string} text 原始模板。
 * @param {Date} now 当前时间。
 * @returns {string[]} 候选文案（第一项是当前时间的解析结果）。
 */
function templateVariants(text, now) {
  var d = now instanceof Date ? now : new Date();
  var base = resolveTemplate(text, d);
  if (typeof text !== "string" || text.indexOf("{daypart}") < 0) return [base];
  var out = [base];
  for (var i = 0; i < DAYPART_NAMES.length; i += 1) {
    var variant = resolveTemplate(text.split("{daypart}").join(DAYPART_NAMES[i]), d);
    if (out.indexOf(variant) < 0) out.push(variant);
  }
  return out;
}

/**
 * 把一处文案编译成若干"待匹配行"（每个时间候选一项，含多行分段）。
 * @param {string} key "greeting" 或 "signOff"。
 * @param {string} rawText 配置里的原始文案。
 * @param {Date} now 当前时间。
 * @returns {Array} [{ key, text, norm, fold, segments, multi }]
 */
function compileWantedLine(key, rawText, now) {
  var variants = templateVariants(rawText, now);
  var out = [];
  for (var i = 0; i < variants.length; i += 1) {
    var text = String(variants[i]).trim();
    if (text.length === 0) continue;
    var segments = [];
    var parts = text.split(/\r?\n/);
    for (var s = 0; s < parts.length; s += 1) {
      var seg = parts[s].trim();
      if (seg.length > 0) segments.push({ text: seg, norm: normalizeFixedLine(seg), fold: foldFixedLine(seg) });
    }
    out.push({
      key: key,
      text: text,
      norm: normalizeFixedLine(text),
      fold: foldFixedLine(text),
      segments: segments,
      multi: segments.length > 1
    });
  }
  return out;
}


/**
 * 让我回复正文里的开场/收尾行也带上样式（字号/字重/颜色/动效/图片）。
 * 只给既有元素加类，不插入或移动任何节点，避免动到 React 管理的 DOM。
 * @param ctx - 客户端插件上下文。
 */
function installChatStyler(ctx) {
  var styleTag = null;
  var observer = null;
  var timer = null;
  var marks = new Map();
  var onResize = null;

  function refreshStyle() {
    if (styleTag === null) {
      styleTag = document.createElement("style");
      styleTag.dataset.plugin = "greet-signoff-chat";
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = chatCss(state.config);
  }

  function clearMarks() {
    marks.forEach(function (part, el) {
      for (var k = 0; k < CHAT_CLASSES.length; k += 1) el.classList.remove(CHAT_CLASSES[k]);
    });
    marks.clear();
  }

  /** 取某一行的配置对象（按 key 现取，保证拿到的是"那一行"，而不是列表中第一条规则的行）。 */
  function configLine(key) {
    return key === "signOff" ? state.config.signOff : state.config.greeting;
  }

  function wantedLines() {
    var list = [];
    var now = new Date();
    [["greeting", state.config.greeting], ["signOff", state.config.signOff]].forEach(function (pair) {
      var text = typeof pair[1].text === "string" ? pair[1].text.trim() : "";
      if (text.length === 0) return;
      var compiled = compileWantedLine(pair[0], text, now);
      for (var i = 0; i < compiled.length; i += 1) list.push(compiled[i]);
    });
    // 旧文案兼容表：只参与页面匹配渲染，不写进提示词（模型看不到）
    var legacy = state.config.legacyLines;
    if (Array.isArray(legacy)) {
      for (var l = 0; l < legacy.length; l += 1) {
        var entry = legacy[l];
        if (entry === null || typeof entry !== "object" || typeof entry.text !== "string") continue;
        var items = compileWantedLine(entry.style === "signOff" ? "signOff" : "greeting", entry.text, now);
        for (var m = 0; m < items.length; m += 1) list.push(items[m]);
      }
    }
    return list;
  }

  /** 两行文案是否其实是同一句（此时只能按"位置"区分开场/收尾）。 */
  function sameLineTexts() {
    var g = typeof state.config.greeting.text === "string" ? state.config.greeting.text.trim() : "";
    var s = typeof state.config.signOff.text === "string" ? state.config.signOff.text.trim() : "";
    if (g.length === 0 || s.length === 0) return false;
    return foldFixedLine(g) === foldFixedLine(s);
  }

  /** 候选块/固定行节点的选择器（宿主消息块与 Markdown 渲染层）。 */
  var BLOCK_SELECTOR = '[data-chat-flow-kind], [class*="markdown"], [class*="flowItem"], [class*="message"], [class*="Message"]';
  /** 固定行候选标签：标题也收进来（模型偶尔把固定行写成 # 标题），行内代码同理。 */
  var LINE_TAGS = "p, li, div, span, h1, h2, h3, h4, h5, h6, code";

  /**
   * 宿主 flow 项里"不是助手正文"的类型（宿主会给每个 flow 项打 data-chat-flow-kind）。
   * 只列确定的：认不出的类型一律按"允许"处理，这样换 DSH 版本也不会整片失效。
   */
  var NON_ASSISTANT_KINDS = {
    user: 1, steering: 1, "tool-result": 1, "tool-call": 1, "system-message": 1,
    context: 1, "input-message": 1, "turn-process": 1, "turn-tail": 1, "turn-error": 1,
    "turn-max-tokens": 1, "request-prompt": 1, reasoning: 1, compaction: 1, command: 1,
    boundary: 1, skill: 1, snapshot: 1, "model-retry": 1
  };

  /**
   * 这个块是不是"助手的正文"。
   * 打开 onlyAssistant（默认）后，用户消息、工具结果、思考面板一律不贴样式——
   * 否则你把自己消息里引用的那句开场语、或工具输出里的同一句话，也会被贴上样式。
   * @param {Element} block 候选块。
   * @returns {boolean} true = 可以贴样式。
   */
  function isAssistantBlock(block) {
    if (state.config.onlyAssistant === false) return true;
    var node = block;
    var kind = null;
    while (node !== null && node !== undefined && kind === null) {
      if (typeof node.getAttribute === "function") {
        var value = node.getAttribute("data-chat-flow-kind");
        if (typeof value === "string" && value.length > 0) kind = value;
      }
      node = node.parentElement;
    }
    if (kind === null) return true;
    return NON_ASSISTANT_KINDS[kind] !== 1;
  }

  /**
   * 每个消息块的处理缓存：记下上次的"便宜签名"与匹配结果。
   * 流式输出时每分钟会触发很多次重新标记，只重扫真正变了的那一块，
   * 否则一次要扫几百个块、每块上千个节点。
   */
  var blockState = new WeakMap();
  /** 自上次扫描以来发生变化的块（由 MutationObserver 标脏）。 */
  var dirtyBlocks = new Set();
  /** 单次扫描最多重扫多少个块（从最新往旧数），其余块只复用上一次的结论。 */
  var SCAN_BUDGET = 300;
  /** 诊断数据：设置页的"诊断"区与悬停提示会读它（模块级，见 stylerStats）。 */
  var stats = stylerStats;

  /** 便宜的内容签名：子元素数 + 文本长度。 */
  function signatureOf(block) {
    return block.childElementCount + ":" + (block.textContent || "").length;
  }

  /** 把一个元素挂到的消息块（用于把 DOM 变化映射到块）。 */
  function owningBlock(node) {
    var el = node;
    if (el === null || el === undefined) return null;
    if (el.nodeType !== 1) el = el.parentElement;
    if (el === null || el === undefined || typeof el.closest !== "function") return null;
    return el.closest(BLOCK_SELECTOR);
  }

  /** 复用上次的匹配结果：重新贴一遍类（幂等），并登记到本轮 used 里。 */
  function reuseParts(parts, used) {
    for (var i = 0; i < parts.length; i += 1) {
      arrangeLinePart(parts[i].el, parts[i].key);
      used.push(parts[i].el);
    }
    return parts.length;
  }

  function decorate() {
    var startedAt = Date.now();
    var list = wantedLines();
    if (list.length === 0) {
      stats.runs += 1;
      stats.lastMs = 0;
      stats.lastAt = startedAt;
      return 0;
    }
    var scope = document.querySelector('[class*="scrollBody"]') || document.querySelector('[class*="conversation"]') || document.body;
    // 按「消息块」作用域判定，而不是整段对话一起判定。
    // 原因：一条回复在 DOM 里可能拆成多个块（思考面板 + 正文），且思考面板里也可能引用同样的文字；
    // 整段一起判定时，先出现的块会把开场/收尾两类名额各占一个，后面的块就拿不到正确的样式，
    // 表现就是「结束语用的是开场语的样式」。因此：逐块处理，块内按文案身份分配样式。
    // 另外：打开 onlyAssistant 时，只处理宿主的助手 flow 项（用户消息、工具结果、思考面板都跳过）。
    var blocks = scope.querySelectorAll(BLOCK_SELECTOR);
    var used = [];
    var total = 0;
    var budget = SCAN_BUDGET;
    var scanned = 0;
    var skipped = 0;
    // 从最新往旧走：长会话里新的消息才是屏幕上看得见的，预算要先给它们。
    for (var b = blocks.length - 1; b >= 0; b -= 1) {
      var block = blocks[b];
      if (isFixedLineExcluded(block)) continue;
      if (typeof block.querySelector === "function" && block.querySelector(BLOCK_SELECTOR) !== null) continue;
      if (!isAssistantBlock(block)) { skipped += 1; continue; }
      var sig = signatureOf(block);
      var cached = blockState.get(block);
      var dirty = cached === undefined || dirtyBlocks.has(block) || cached.sig !== sig;
      if (!dirty && cached !== undefined) {
        // 之前贴过的节点若已被 React 换掉（脱离文档），这一块必须重扫。
        for (var ci = 0; ci < cached.parts.length; ci += 1) {
          if (cached.parts[ci].el.isConnected !== true) { dirty = true; break; }
        }
      }
      if (!dirty) {
        total += reuseParts(cached.parts, used);
        continue;
      }
      if (budget <= 0) {
        if (cached !== undefined) total += reuseParts(cached.parts, used);
        continue;
      }
      budget -= 1;
      scanned += 1;
      var text = block.textContent || "";
      var related = false;
      for (var q = 0; q < list.length; q += 1) {
        if (text.indexOf(list[q].norm) >= 0 || text.indexOf(list[q].text) >= 0) { related = true; break; }
      }
      if (!related) {
        // 宽松/近似档下，标点或空白被改写过的行不一定能在原文里直接搜到，再按折叠文本找一遍。
        // 近似档（fuzzy）可能整句只差一两个字，用整句去找必然找不到，所以只拿前几个字当探针。
        var folded = foldFixedLine(text);
        for (var f = 0; f < list.length; f += 1) {
          var target = list[f];
          if (target.fold.length === 0) continue;
          var probe = state.config.matchMode === "fuzzy"
            ? target.fold.slice(0, Math.min(6, target.fold.length))
            : target.fold;
          if (folded.indexOf(probe) >= 0) { related = true; break; }
        }
      }
      if (!related) {
        blockState.set(block, { sig: sig, parts: [] });
        continue;
      }
      var parts = applyFixedLineParts(collectFixedLines(block, list), used);
      blockState.set(block, { sig: sig, parts: parts });
      total += parts.length;
    }
    dirtyBlocks.clear();
    for (var mi = 0; mi < used.length; mi += 1) marks.set(used[mi], true);
    // 清理：已经不在匹配结果里的旧标记要摘掉，否则重新加载后会留下上一次的样式。
    var stale = [];
    marks.forEach(function (part, el) {
      for (var j = 0; j < used.length; j += 1) { if (used[j] === el) return; }
      stale.push(el);
    });
    for (var s = 0; s < stale.length; s += 1) {
      for (var k = 0; k < CHAT_CLASSES.length; k += 1) stale[s].classList.remove(CHAT_CLASSES[k]);
      marks.delete(stale[s]);
    }
    stats.runs += 1;
    stats.lastMs = Date.now() - startedAt;
    stats.lastAt = Date.now();
    stats.blocks = blocks.length;
    stats.scanned = scanned;
    stats.matched = total;
    stats.skippedNonAssistant = skipped;
    return total;
  }

  /** 该节点是否位于"不该被当成正文固定行"的区域（思考面板、本插件自己的面板/预览/提示）。 */
  function isFixedLineExcluded(node) {
    if (node.closest === undefined) return false;
    return node.closest('[class*="reasoning"], [class*="Reasoning"], [class*="thinking"], [class*="Thinking"], .gs-dock, .gs-panel, .gs-preview, .gs-tip') !== null;
  }

  /**
   * 在一个消息块内收集固定行。
   * 1) 单个叶子节点的文本命中某条待匹配行；
   * 2) 配置里写了多行时，相邻的若干叶子节点拼起来命中同一条（宿主可能把换行渲染成两个 <p>）。
   * 命中后按"只保留最外层"去重——`<p><strong>行</strong></p>`、标题里的 `<code>` 都只留外层那一个。
   * @param {Element} block 消息块。
   * @param {Array} list wantedLines() 的结果。
   * @returns {Array} 按文档顺序的 [{el, key}]。
   */
  function collectFixedLines(block, list) {
    var mode = state.config.matchMode;
    var nodes = block.querySelectorAll(LINE_TAGS);
    var found = [];
    var matched = new Set();
    var leaves = [];
    for (var i = 0; i < nodes.length && i < 1500; i += 1) {
      var el = nodes[i];
      if (el.childElementCount > 1) continue;
      if (isFixedLineExcluded(el)) continue;
      var raw = el.textContent || "";
      if (normalizeFixedLine(raw).length === 0) continue;
      leaves.push({ el: el, raw: raw });
    }
    // 1) 单节点命中
    for (var n = 0; n < leaves.length; n += 1) {
      var item = leaves[n];
      var hit = null;
      for (var k = 0; k < list.length; k += 1) {
        if (matchLineText(item.raw, list[k], mode)) { hit = list[k]; break; }
      }
      if (hit === null) continue;
      if (hasMatchedAncestor(item.el, block, matched)) continue;
      matched.add(item.el);
      found.push({ el: item.el, key: hit.key });
    }
    // 2) 多行命中：连续的叶子节点依次等于该行的各段
    for (var w = 0; w < list.length; w += 1) {
      var wanted = list[w];
      if (wanted.multi !== true) continue;
      var need = wanted.segments.length;
      for (var start = 0; start + need <= leaves.length; start += 1) {
        var ok = true;
        for (var seg = 0; seg < need; seg += 1) {
          var leaf = leaves[start + seg];
          if (matched.has(leaf.el) || hasMatchedAncestor(leaf.el, block, matched)) { ok = false; break; }
          var want = wanted.segments[seg];
          if (normalizeFixedLine(leaf.raw) !== want.norm && foldFixedLine(leaf.raw) !== want.fold) { ok = false; break; }
        }
        if (!ok) continue;
        for (var take = 0; take < need; take += 1) {
          matched.add(leaves[start + take].el);
          found.push({ el: leaves[start + take].el, key: wanted.key });
        }
        break;
      }
    }
    found.sort(function (a, b) {
      if (a.el === b.el) return 0;
      var position = typeof a.el.compareDocumentPosition === "function" ? a.el.compareDocumentPosition(b.el) : 0;
      return (position & 4) === 4 ? -1 : 1;
    });
    return found;
  }

  /**
   * 该元素是否有祖先已经被标成固定行（用于"只保留最外层"）。
   * @param {Element} el 元素。
   * @param {Element} block 所在块。
   * @param {Set} matched 已命中元素集合。
   * @returns {boolean} true = 有祖先已命中，本元素跳过。
   */
  function hasMatchedAncestor(el, block, matched) {
    var ancestor = el.parentElement;
    while (ancestor !== null && ancestor !== block) {
      if (matched.has(ancestor)) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  /**
   * 按"文案身份"分配样式：命中开场文案的用开场样式、命中收尾文案的用收尾样式。
   * 这样一条回复被工具调用拆成多个块时（开场在一个块、收尾在另一个块）也不会串样式。
   * 只有两行文案其实是同一句时才退回"按位置"：本块第一条=开场、最后一条=收尾。
   * @param {Array} found 按文档顺序排列的匹配结果 [{el, key}]。
   * @param {Array} used 已处理元素收集数组，供清理旧标记使用。
   * @returns {Array} 本块最终生效的 [{el, key}]，供块级缓存复用。
   */
  function applyFixedLineParts(found, used) {
    if (found.length === 0) return [];
    var identical = sameLineTexts();
    var out = [];
    var seen = new Set();
    for (var i = 0; i < found.length; i += 1) {
      var el = found[i].el;
      var key = found[i].key;
      if (identical) {
        if (found.length === 1) key = "greeting";
        else if (i === 0) key = "greeting";
        else if (i === found.length - 1) key = "signOff";
        else key = "greeting";
      }
      if (seen.has(el)) continue;
      seen.add(el);
      out.push({ el: el, key: key });
    }
    for (var q = 0; q < out.length; q += 1) {
      arrangeLinePart(out[q].el, out[q].key);
      used.push(out[q].el);
    }
    return out;
  }

  /**
   * 把一个元素调整成某一类固定行（会摘掉另一类的类名）。
   * 之所以要"调整"而不是"只加"：早先的版本会把同一个元素先判成开场、后判成收尾，
   * 结果两类类名同时留在元素上，颜色/动效取决于 CSS 顺序 —— 用户会看到"结束语用了开场语的样式"。
   * @param {Element} el 目标元素。
   * @param {string} key "greeting" 或 "signOff"。
   */
  function arrangeLinePart(el, key) {
    var other = key === "greeting" ? "signOff" : "greeting";
    el.classList.remove("gs-chat-" + other.toLowerCase());
    setLinePart(el, key);
  }

  /**
   * 给一个元素贴某一行的样式类。
   * @param {Element} el 目标元素。
   * @param {string} key "greeting" 或 "signOff"。
   */
  function setLinePart(el, key) {
    var line = configLine(key);
    el.classList.add("gs-chat-line", "gs-chat-" + key.toLowerCase());
    // 形状/填充/边框/动效：与编辑器预览用同一套函数，避免两处样式不一致
    lineClassOf(line, "").split(" ").forEach(function (name) {
      if (name.length > 0) el.classList.add(name);
    });
    if (typeof line.image === "string" && line.image.length > 0) el.classList.add("gs-chat-img");
    marks.set(el, true);
  }

  function schedule() {
    if (timer !== null) return;
    timer = setTimeout(function () {
      timer = null;
      try { decorate(); } catch (error) { console.error("[greet-signoff] chat decorate failed", error); }
    }, 180);
  }

  // 只对"外部"变化重新标记：本插件自己加 class / 改样式也会触发 MutationObserver，
  // 不过滤的话会自己触发自己，形成反复重排（会让页面看起来在闪）。
  function scheduleIfExternal(mutations) {
    var external = false;
    for (var i = 0; i < mutations.length; i += 1) {
      var target = mutations[i].target;
      var el = target !== null && target.nodeType === 1 ? target : (target.parentElement || null);
      if (el !== null && el.closest !== undefined &&
        el.closest("[data-plugin='dsh-greet-signoff'], [data-plugin='greet-signoff-chat']") !== null) continue;
      external = true;
      // 顺便记下"哪些块变了"：下一次扫描只重扫这些块（外加签名变了的块）。
      var block = owningBlock(target);
      if (block !== null) dirtyBlocks.add(block);
    }
    if (external) schedule();
  }

  ctx.effect(function () {
    refreshStyle();
    decorate();
    observer = new MutationObserver(scheduleIfExternal);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    // 配置（样式/动效）一变：除了刷新样式表，还要把**已经渲染出来的旧行**重新标记一遍，
    // 否则用户刚改的形状/动效只在设置页预览里生效，看起来像"没生效"。块缓存同时作废。
    var unsubscribe = subscribe(function () {
      refreshStyle();
      clearMarks();
      blockState = new WeakMap();
      dirtyBlocks.clear();
      decorate();
      schedule();
    });
    onResize = schedule;
    window.addEventListener("resize", onResize);
    // 多标签同步：配置只在打开页面时读过一次，另一个标签页改了文案/阈值这边看不到。
    // 回到本标签页（或重新聚焦）时补读一次，比常驻轮询省电。
    var lastLoad = 0;
    function refreshOnFocus() {
      if (document.visibilityState === "hidden") return;
      var now = Date.now();
      if (now - lastLoad < 1500) return;
      lastLoad = now;
      loadConfig();
    }
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);
    return function () {
      unsubscribe();
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
      if (observer !== null) { observer.disconnect(); observer = null; }
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (onResize !== null) window.removeEventListener("resize", onResize);
      clearMarks();
      if (styleTag !== null) { styleTag.remove(); styleTag = null; }
    };
  }, "greet-signoff:chat-style");
}

/* ─── 安装 ───────────────────────────────────────────────────────────── */

/**
 * 插件上下文：给组件里的按钮留一个"按需取服务"的入口（组件里拿不到 ctx）。
 * 客户端服务可能晚于本插件出现，因此不在 apply 时缓存服务对象，只缓存 ctx。
 */
var pluginCtx = null;

/** 对话贴样式器的诊断数据（设置页"诊断"区读取；installChatStyler 会直接写这个对象）。 */
var stylerStats = {
  runs: 0, lastMs: 0, lastAt: 0, blocks: 0, scanned: 0, matched: 0,
  skippedNonAssistant: 0, legacyCount: 0, lastError: ""
};

/**
 * 注册设置行、设置页与输入框上方的卡片。
 * 必须导出 inject：客户端插件的行可能在 slots 服务出现之前激活，
 * 老写法只做 ctx.get("slots") 判断并 return，会导致页面上什么都没注册。
 * @param ctx - 本行的插件上下文。
 */
function apply(ctx) {
  pluginCtx = ctx;
  ctx.effect(function () {
    var tag = document.createElement("style");
    tag.dataset.plugin = "dsh-greet-signoff";
    tag.textContent = css();
    document.head.appendChild(tag);
    return function () { tag.remove(); };
  }, "greet-signoff:css");

  var slots = ctx.get("slots");
  if (slots === undefined) {
    console.error("[greet-signoff] slots service unavailable");
    return;
  }

  // 设置入口只在左侧菜单栏的「开场收尾」一处（不再往「通用」里再塞一行，避免同一个编辑器出现两个入口）。
  ctx.effect(function () {
    return slots.inject("settings.section", function () {
      return slots.register(
        { name: "settings.section", id: "greet-signoff", order: 16, label: "开场收尾" },
        function () { return React.createElement(Editor, null); }
      );
    });
  }, "greet-signoff:settings-page");

  ctx.effect(function () {
    return slots.inject("conversation.input.dock", function () {
      return slots.register(
        { name: "conversation.input.dock", id: "greet-signoff-usage", order: 5 },
        function (props) { return React.createElement(GreetDock, props === undefined ? null : props); }
      );
    });
  }, "greet-signoff:usage-dock");

  // 正文里的开场/收尾行样式（只加类，不动 DOM 结构）
  installChatStyler(ctx);

  loadConfig();
}

module.exports = {
  name: "dsh-greet-signoff",
  inject: ["slots"],
  apply: apply,
  // 仅供测试使用（test/client-pure.test.mjs 用最小 DOM 桩把本文件加载进 Node）：
  // 浏览器侧不会读 __test，D SH 的模块加载器也只认 name/inject/apply。
  __test: {
    normalizeFixedLine: normalizeFixedLine,
    foldFixedLine: foldFixedLine,
    matchLineText: matchLineText,
    compileWantedLine: compileWantedLine,
    templateVariants: templateVariants,
    resolveTemplate: resolveTemplate,
    editDistance: editDistance,
    lineSimilarity: lineSimilarity,
    sanitizeLegacyLines: sanitizeLegacyLines,
    normalizeLine: normalizeLine,
    normalize: normalize,
    validate: validate,
    occupancyOf: occupancyOf,
    formatTokens: formatTokens,
    hexToRgb: hexToRgb,
    mixRgb: mixRgb,
    rampColor: rampColor,
    barScale: barScale,
    lineCssDecls: lineCssDecls,
    matchModeLabel: matchModeLabel
  }
};
return module.exports; } });
