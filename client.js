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
  { value: "rainbow", label: "彩虹流动", loop: true, duration: 4 },
  /* 逐字动效：给每个字单独包一层 span，按顺序错开播放（预览与对话里都会逐字动） */
  { value: "charbounce", label: "逐字跳动", loop: true, duration: 0.9 },
  { value: "charwave", label: "逐字波浪", loop: true, duration: 1.6 },
  { value: "chartype", label: "逐字打字机", loop: true, duration: 3.2 },
  { value: "charrainbow", label: "逐字彩虹", loop: true, duration: 3.4 }
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

/** 需要"逐字包一层 span"的动效（其余动效只作用于整行）。 */
var PER_CHAR_ANIMATIONS = ["charbounce", "charwave", "chartype"];

/**
 * 这个动效是不是"逐字"的（需要给每个字单独包 span 才能错开播放）。
 * @param {string} value 动效名。
 * @returns {boolean} true = 逐字动效。
 */
function isPerCharAnimation(value) {
  return PER_CHAR_ANIMATIONS.indexOf(value) !== -1;
}

/**
 * 把文本切成"字"：按码位切，但把变体选择符（U+FE0F）、零宽连接符（U+200D）、组合符号与肤色修饰符
 * 并入前一个字，这样 emoji（如 👑、💰、👨‍👩‍👧）不会被拆成两半而显示错乱。
 * @param {string} text 原始文本。
 * @returns {string[]} 每个元素是一个"字"（可能含多个码位）。
 */
function splitGraphemes(text) {
  var chars = Array.from(String(text));
  var out = [];
  for (var i = 0; i < chars.length; i += 1) {
    var ch = chars[i];
    var cp = ch.codePointAt(0);
    var isJoiner = cp === 0xfe0f || cp === 0x200d || (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x1f3fb && cp <= 0x1f3ff);
    var prev = out.length > 0 ? out[out.length - 1] : "";
    if (out.length > 0 && (isJoiner || prev.charCodeAt(prev.length - 1) === 0x200d)) {
      out[out.length - 1] = prev + ch;
      continue;
    }
    out.push(ch);
  }
  return out;
}

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
/** 旧文案兜底最多几条（v1.14.0：30 → 8；换过固定行才需要它，一次性兜底用不了 30 条）。 */
var LEGACY_LINES_MAX = 8;
/** 匹配模式：exact 逐字相同 / loose 宽松（忽略大小写、空白、全半角与首尾标点）/ fuzzy 近似容错。 */
var MATCH_MODES = ["exact", "loose", "fuzzy"];
/** 客户端半的版本号（诊断区显示；与 package.json 的 version 保持一致）。 */
var CLIENT_VERSION = "1.19.0";

/** 匹配模式的中文名（折叠标题与诊断区显示用）。 */
function matchModeLabel(mode) {
  if (mode === "exact") return "逐字相同";
  if (mode === "fuzzy") return "近似容错";
  return "宽松匹配";
}

/**
 * 预设的"底子"：每套预设都以它为基础再覆盖，因此套用结果**完全可预期**
 * （不会因为你之前手调过底色/边框而留下残留值）。只含外观字段，永远不动文案与图片。
 */
var PRESET_BASE = {
  imageHeight: 22,
  fontSize: 14,
  fontWeight: 600,
  color: "",
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
  },
  {
    id: "ocean", name: "海盐蓝", dot: "#2f6fed",
    style: { color: "#2f6fed", colorDark: "#7aa2ff", fontWeight: 600, animation: "slideUp", shape: "pill", radius: 999, padY: 5, fill: "faint", shadow: "none" }
  },
  {
    id: "forest", name: "森林绿", dot: "#1a9e6b",
    style: { color: "#1a9e6b", colorDark: "#4ade80", fontWeight: 600, animation: "fade", shape: "soft", radius: 10, padY: 6, fill: "faint", borderWidth: 1, borderColor: "#bfe6d5", borderColorDark: "#2d5c48", shadow: "soft" }
  },
  {
    id: "violet", name: "紫罗兰", dot: "#7c3aed",
    style: { color: "#6d28d9", colorDark: "#c4b5fd", fontWeight: 700, animation: "glow", shape: "tag", radius: 6, padY: 5, fill: "solid", bgColor: "#f3eeff", bgColorDark: "#2a1f45", shadow: "glow" }
  },
  {
    id: "outline", name: "描边风", dot: "#9aa4b2",
    style: { color: "", colorDark: "", fontWeight: 500, animation: "none", shape: "rect", radius: 8, padY: 5, fill: "none", borderWidth: 1, borderColor: "#9aa4b2", borderColorDark: "#55606f", shadow: "none" }
  },
  {
    id: "marker", name: "高亮笔", dot: "#f2c94c",
    style: { color: "#7a5c00", colorDark: "#ffe066", fontWeight: 600, animation: "none", shape: "highlight", radius: 3, padY: 3, fill: "solid", bgColor: "#fff3bf", bgColorDark: "#4a3b00", shadow: "none" }
  },
  {
    id: "quote", name: "引用块", dot: "#64748b",
    style: { color: "#4b5563", colorDark: "#cbd5e1", fontWeight: 400, animation: "none", shape: "blockquote", radius: 4, padY: 6, fill: "none", borderWidth: 0, shadow: "none" }
  },
  {
    id: "underline", name: "细下划线", dot: "#334155",
    style: { color: "", colorDark: "", fontWeight: 600, animation: "none", shape: "underline", radius: 0, padY: 2, fill: "none", borderWidth: 0, shadow: "none" }
  },
  {
    id: "matrix", name: "墨绿终端", dot: "#1f7a4d",
    style: { color: "#1f7a4d", colorDark: "#52ff9b", fontWeight: 500, animation: "blink", shape: "none", radius: 0, padY: 2, fill: "none", letterSpacing: 2, caps: "none" }
  },
  {
    id: "cyberpink", name: "霓虹粉", dot: "#d6336c",
    style: { color: "#d6336c", colorDark: "#ff6fae", fontWeight: 700, animation: "neon", shape: "tag", radius: 4, padY: 5, fill: "faint", borderWidth: 1, borderColor: "#ff9ec4", borderColorDark: "#ff6fae", shadow: "glow" }
  },
  {
    id: "paper", name: "纸质标签", dot: "#b08d57",
    style: { color: "#6b4f2a", colorDark: "#d9c39a", fontWeight: 600, animation: "none", shape: "card", radius: 10, padY: 6, fill: "solid", bgColor: "#f7f1e3", bgColorDark: "#3a3325", borderWidth: 1, borderColor: "#e0d3b8", borderColorDark: "#6b5c3f", shadow: "soft" }
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
  legacyLines: [],
  // 文案池：池子非空且开关打开时，每次回复从池子里挑一句（挑的动作在宿主半，页面只负责把池子里每一句都贴上样式）。
  pool: { enabled: false, mode: "random", greeting: [], signOff: [] },
  // 场景：整份配置的快照（文案 + 样式 + 阈值 + 文案池），用于"工作 / 生活 / 深夜"一键整体切换。
  scenes: { active: "", items: [] },
  // 按工作区自动换文案：命中当前会话的工作目录时用这一条的文案（优先级最高）。
  perWorkspace: { enabled: false, items: [] }
};

/** 按工作区绑定：最多几条（与宿主半保持一致）。 */
var WORKSPACE_MAX = 8;
var WORKSPACE_PATH_MAX = 260;

/** 路径归一：Windows 下不区分大小写、斜杠统一、去掉末尾分隔符。 */
function pathKey(value) {
  return String(value === undefined || value === null ? "" : value).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

/**
 * 清洗"按工作区绑定文案"表：路径为空、开场与收尾都空的条目直接丢掉。
 * @param raw - 任意输入。
 * @returns {Object} { enabled, items }。
 */
function sanitizeWorkspaceBindings(raw) {
  var src = raw !== null && typeof raw === "object" ? raw : {};
  var list = Array.isArray(src.items) ? src.items : [];
  var items = [];
  for (var i = 0; i < list.length && items.length < WORKSPACE_MAX; i += 1) {
    var item = list[i];
    if (item === null || typeof item !== "object") continue;
    var path = typeof item.path === "string" ? item.path.trim().slice(0, WORKSPACE_PATH_MAX) : "";
    if (path.length === 0) continue;
    var greeting = typeof item.greeting === "string" ? item.greeting.trim().slice(0, TEXT_LIMIT) : "";
    var signOff = typeof item.signOff === "string" ? item.signOff.trim().slice(0, TEXT_LIMIT) : "";
    if (greeting.length === 0 && signOff.length === 0) continue;
    items.push({ path: path, greeting: greeting, signOff: signOff });
  }
  return { enabled: src.enabled === true, items: items };
}

/** 场景：最多几个、名字多长（与宿主半保持一致）。 */
var SCENES_MAX = 8;
var SCENE_NAME_MAX = 24;
var SCENE_ID_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;

/**
 * 清洗场景表：坏数据一律丢掉，绝不因为一个场景写坏而让整份配置读不出来。
 * 每个场景存的是"保存那一刻的整份配置"（不含 scenes 自身，避免自我嵌套）。
 * @param raw - 任意输入。
 * @returns {Object} { active, items }。
 */
function sanitizeScenes(raw) {
  var src = raw !== null && typeof raw === "object" ? raw : {};
  var list = Array.isArray(src.items) ? src.items : [];
  var items = [];
  var seen = {};
  for (var i = 0; i < list.length && items.length < SCENES_MAX; i += 1) {
    var item = list[i];
    if (item === null || typeof item !== "object") continue;
    if (typeof item.id !== "string" || !SCENE_ID_RE.test(item.id) || seen[item.id] === true) continue;
    var name = typeof item.name === "string" ? item.name.trim() : "";
    items.push({
      id: item.id,
      name: name.length > 0 ? name.slice(0, SCENE_NAME_MAX) : item.id,
      config: normalizeCore(item.config)
    });
    seen[item.id] = true;
  }
  var active = typeof src.active === "string" && seen[src.active] === true ? src.active : "";
  return { active: active, items: items };
}

/** 文案池：最多几句、每句多长、两种挑法（与宿主半保持一致）。 */
var POOL_MAX = 20;
var POOL_LINE_MAX = 200;
var POOL_MODES = ["random", "sequence"];

/**
 * 清洗池子文案列表：去首尾空白、丢掉空行、截断超长、最多 POOL_MAX 句。
 * @param raw - 任意输入。
 * @returns {string[]} 清洗后的句子（一行一句）。
 */
function sanitizePoolList(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  for (var i = 0; i < raw.length; i += 1) {
    if (typeof raw[i] !== "string") continue;
    var text = raw[i].trim();
    if (text.length === 0) continue;
    out.push(text.length > POOL_LINE_MAX ? text.slice(0, POOL_LINE_MAX) : text);
    if (out.length >= POOL_MAX) break;
  }
  return out;
}

/**
 * 清洗文案池字段。
 * @param raw - 任意输入。
 * @returns {Object} { enabled, mode, greeting, signOff }。
 */
function sanitizePool(raw) {
  var src = raw !== null && typeof raw === "object" ? raw : {};
  return {
    enabled: src.enabled === true,
    mode: pickEnum(src.mode, POOL_MODES, "random"),
    greeting: sanitizePoolList(src.greeting),
    signOff: sanitizePoolList(src.signOff)
  };
}

/* ─── 样式 ────────────────────────────────────────────────────────────── */

function css() {
  return [
    ".gs-panel{box-sizing:border-box;width:100%;padding:0 0 74px;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
    /* ── 新版布局：吸顶头部（标签页 + 实时预览）+ 可折叠分区卡片 ── */
    // 预览跟着滚动吸在顶上，改下面的参数时不用滚回去看效果。
    ".gs-stickyhead{position:sticky;top:-2px;z-index:6;padding:10px 0 8px;background:var(--dsw-alias-bg-base);box-shadow:0 6px 10px -8px rgba(0,0,0,.28)}",
    ".gs-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);margin-top:10px;overflow:hidden;scroll-margin-top:196px}",
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
    // 这个类同时用在 <button> 和 <label>（"导入配置""选择图片"是靠 label+隐藏 input 触发选文件的）。
    // button 由 UA 样式自动把文字垂直居中、且 box-sizing:border-box；label 两者都没有，
    // 在 .gs-actions（flex）里被块化后就成了"文字贴顶、盒子还高 2px"。所以这里自己居中 + 显式 border-box。
    ".gs-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:0 0;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}",
    ".gs-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    ".gs-btn:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
    ".gs-btn-on{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1)}",
    /* 主按钮悬停时必须保住文字颜色：否则会变成"背景浅、文字也浅"→字像是消失了 */
    ".gs-btn-on:hover:not(:disabled){border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);opacity:.86}",
    ".gs-saved{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px}",
    ".gs-tabs{gap:6px;display:flex}",
    // 顶部快速跳转条：7 个分区一键展开并跳过去 + 全部展开/收起（不用在一堆折叠卡片里翻）。
    ".gs-quicknav{gap:6px;flex-wrap:wrap;display:flex;margin-top:6px;align-items:center}",
    ".gs-chip{height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:22px;cursor:pointer}",
    ".gs-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    ".gs-quicknav-gap{margin-left:auto}",
    // 文案池：与上面的固定文案用一条虚线分开，视觉上属于"这一行的进阶用法"。
    ".gs-pool{margin-top:10px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l2);flex-direction:column;gap:6px;display:flex}",
    ".gs-pool-head{justify-content:space-between;width:100%}",
    ".gs-pool-text{min-height:70px}",
    // 阈值提醒条：左提示右按钮，点过「总结要点」后下面多一行小字说明
    ".gs-dock-actions{margin-left:auto;gap:6px;display:inline-flex;align-items:center;flex:none}",
    ".gs-dock-alert-text{min-width:0;flex:1}",
    ".gs-dock-note{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}",
    // 场景：一排"场景名 + 覆盖 + 删除"，窄面板会自动换行
    ".gs-scene-list{flex-wrap:wrap;gap:6px;display:flex;margin:6px 0}",
    ".gs-scene-item{align-items:center;gap:2px;display:inline-flex}",
    ".gs-scene-mini{min-width:26px;padding:0 6px}",
    // 一键外观的小样卡：两列自适应网格，每张卡里直接渲染当前文案的样子
    ".gs-preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:6px}",
    ".gs-preset-card{flex-direction:column;gap:4px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;text-align:left;display:flex}",
    ".gs-preset-card:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-preset-card-on{border-color:var(--dsw-alias-label-primary)}",
    ".gs-preset-card-head{align-items:center;gap:5px;display:inline-flex;color:var(--dsw-alias-label-secondary);font-size:12px}",
    ".gs-preset-card-demo{display:block;pointer-events:none;overflow:hidden}",
    // 常用色板（底色/边色各一排小方块，点一下即设并自动启用）
    ".gs-swatches{gap:3px;display:inline-flex;flex-wrap:wrap}",
    ".gs-swatch-mini{width:16px;height:16px;border-radius:5px;border-width:1px}",
    // 图片拖拽区
    ".gs-dropzone{align-items:center;gap:6px;flex-wrap:wrap;display:inline-flex;padding:2px;border-radius:10px}",
    ".gs-dropzone.gs-dropzone-on{outline:2px dashed var(--dsw-alias-label-primary);outline-offset:2px}",
    // 工作区绑定：每条两行（路径 + 删除 / 开场 + 收尾），窄面板也能放下
    ".gs-ws-item{gap:4px;display:flex;flex-direction:column;margin-top:4px}",
    // 自检：结论按行排，全绿时加一条左侧绿边，一眼能看出"没事"
    ".gs-selfcheck{margin-top:8px;display:flex;flex-direction:column;gap:6px}",
    ".gs-selfcheck-lines{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}",
    ".gs-selfcheck-ok{border-color:var(--dsw-alias-state-success-primary,var(--dsw-alias-border-l2))}",
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
    /* v1.15.2 统一胶囊容器：三格读数 / 进度条 / 时间行 / 预算胶囊 / 到线横幅 全部装进**同一个**卡里，
       共用一条边框、一个底色、一条左右边界；不再各自另起一方（那是"三块各说各的"+白占纵向空间）。
       inside 的 padding 只作用在这一层：外层 .gs-dock 仍然零内边距、零背景，
       这样宿主主题对输入区附属卡片（[data-slot="…dock"] > *）的强制白底不会跟着撑出"多余白框"。 */
    ".gs-dock-stack{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:6px;padding:7px 10px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:rgba(127,127,127,.05);overflow:visible}",
    'html[data-gs-dark="1"] .gs-dock-stack{background:rgba(255,255,255,.045)}',
    /* 容器内的子卡片一律脱掉自己的边框/底色：它们现在是同一张卡里的分区，靠容器统一收边 */
    ".gs-dock-stack>.gs-dock-kpis,.gs-dock-stack>.gs-dock-banner,.gs-dock-stack>.gs-dock-parts,.gs-dock-stack>.gs-dock-suggest,.gs-dock-stack>.gs-dock-time,.gs-dock-stack>.gs-dock-mode,.gs-dock-stack>.gs-dock-textrow,.gs-dock-stack>.gs-dock-note{margin-top:0}",
    ".gs-dock-bar{position:relative;width:100%;height:var(--gs-bar-h,9px);border-radius:999px;background-color:var(--dsw-alias-interactive-bg-hover);background-image:var(--gs-scale-faint,none);background-size:100% 100%;background-repeat:no-repeat}",
    ".gs-dock-fill{height:100%;border-radius:999px;transition:width .35s ease,background-color .35s ease;background-image:var(--gs-scale,none);background-size:calc(10000% / var(--gs-percent,100)) 100%;background-repeat:no-repeat}",
    ".gs-dock-critical .gs-dock-fill{animation:gs-alarm 1.1s ease-in-out infinite}",
    /* 方案 7「KPI 三格 + 贯通线」（v1.15.0）：占用 / 花费 / 时长 三格等宽读数，底部一条贯通进度线。
       配色取 A（语义状态色：占用数字=状态本身）+ C（数字胶囊底：数字后面垫一层同色淡底，颜色由 JS 现算）。 */
    /* v1.15.2：三格读数并进统一容器后，自己不再是"一张卡"——只留一条细分隔线把它和进度条分区 */
    ".gs-dock-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0 0 6px;border:0;border-bottom:1px solid var(--dsw-alias-border-l2);border-radius:0;background:none}",
    ".gs-dock-kpi{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}",
    ".gs-dock-kpi-lab{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary)}",
    ".gs-dock-kpi-val{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 9px;border-radius:999px;font-size:15px;font-weight:700;line-height:22px;font-variant-numeric:tabular-nums}",
    ".gs-dock-kpi-val i{font-style:normal;font-size:11px;font-weight:500;opacity:.82}",
    /* v1.16.0：KPI 从三格扩到四/五格（多出「预算档」与「实测速率」两格，样式与前三格一致）。
       列数按实际格数给类名；窄窗口退回 3 列 / 2 列，避免"万/分"这类数字被挤成省略号。 */
    ".gs-dock-kpis-4{grid-template-columns:repeat(4,minmax(0,1fr))}",
    ".gs-dock-kpis-5{grid-template-columns:repeat(5,minmax(0,1fr))}",
    /* v1.17.0：第六格「到线约还有」进来后是 6 列；窗口一窄就退回 3 列 / 2 列（同上面 4/5 格的处理） */
    ".gs-dock-kpis-6{grid-template-columns:repeat(6,minmax(0,1fr))}",
    "@media (max-width:1080px){.gs-dock-kpis-6{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    "@media (max-width:900px){.gs-dock-kpis-5{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    "@media (max-width:620px){.gs-dock-kpis-4,.gs-dock-kpis-5,.gs-dock-kpis-6{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    /* 预算档那一格：菜单要挂在这一格下面（向上弹），所以格子里要能定位 */
    ".gs-dock-kpi-mode{position:relative}",
    ".gs-kpi-btn{font-family:inherit;cursor:pointer;border:1px solid transparent}",
    ".gs-kpi-btn:hover{border-color:var(--dsw-alias-border-l2)}",
    'html[data-gs-dark="1"] .gs-dock-kpis{background:rgba(255,255,255,.05)}',
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
    /* 到线/超线的大横幅：不靠百分比，一眼就知道该开新会话了。
       v1.15.1：把「该开新会话了 / 上下文构成 / 档位建议」合成**一张卡** ——
       三块信息共用同一个边框与底色，卡内用细线分隔，不再上下三条各说各的。 */
    ".gs-dock-banner{display:flex;flex-direction:column;gap:6px;margin-top:6px;padding:7px 10px;border-radius:10px;font-size:13px;line-height:18px}",
    ".gs-dock-banner-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}",
    ".gs-dock-banner-main{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}",
    ".gs-dock-banner-title{font-size:15px;font-weight:700;white-space:nowrap}",
    ".gs-dock-banner-sub{font-size:12px;opacity:.9}",
    ".gs-dock-banner-warn{background:rgba(224,165,42,.18);border:1px solid rgba(224,165,42,.6);color:var(--dsw-alias-label-primary)}",
    ".gs-dock-banner-critical{background:#d93026;border:1px solid #b91c1c;color:#fff;animation:gs-alarm 1.1s ease-in-out infinite}",
    /* 展开构成明细时停止闪动：一闪一闪没法逐行读数 */
    ".gs-dock-banner-critical.gs-dock-banner-open{animation:none}",
    /* 卡内的两块附加信息（上下文构成 / 档位建议）：细线分隔，颜色继承卡片（红底=白字） */
    ".gs-dock-banner .gs-dock-parts,.gs-dock-banner .gs-dock-suggest{margin-top:0;padding-top:6px;border-top:1px solid rgba(255,255,255,.3);color:inherit}",
    ".gs-dock-banner-warn .gs-dock-parts,.gs-dock-banner-warn .gs-dock-suggest{border-top-color:rgba(0,0,0,.16)}",
    ".gs-dock-banner .gs-dock-parts-toggle{opacity:.95}",
    ".gs-dock-banner .gs-dock-parts-toggle:hover{color:inherit;text-decoration:underline}",
    /* 红卡是红底白字：轨道压暗、填充纯白，对比才够 */
    ".gs-dock-banner .gs-parts-track{background:rgba(0,0,0,.22)}",
    ".gs-dock-banner-warn .gs-parts-track{background:rgba(127,127,127,.28)}",
    /* v1.15.3：红卡里的构成条不再用 currentColor（那是纯白，等于没颜色）——
       每行用自己的 palette 色（--gs-part-color，由渲染时按行号给），红底上才分得清是哪一块。 */
    ".gs-dock-banner .gs-parts-fill{background:var(--gs-part-color,currentColor)}",
    ".gs-dock-banner .gs-parts-num{color:inherit;opacity:.95}",
    ".gs-dock-banner .gs-hint{color:inherit;opacity:.85}",
    ".gs-dock-banner .gs-dock-suggest-text{opacity:.95}",
    ".gs-dock-banner .gs-dock-new{border-color:currentColor;color:inherit;opacity:.92}",
    ".gs-dock-banner .gs-dock-new:hover{background:rgba(255,255,255,.18);color:inherit;opacity:1}",
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
    /* 进度条下的时间行：已聊多久 / 还能聊多久（随秒走动，不是静态摆设） */
    ".gs-dock-time{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
    ".gs-dock-time b{font-weight:600;color:var(--dsw-alias-label-secondary)}",
    ".gs-dock-time .gs-clock{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
    /* v1.19.0：时间行的「上一轮 ↑X.X 万」涨幅段（≥5 万标警示色，深色档换亮琥珀）+ 版本错配小字 */
    ".gs-dock-rise{font-variant-numeric:tabular-nums}",
    ".gs-dock-rise-warn{color:#b45309;font-weight:600}",
    'html[data-gs-dark="1"] .gs-dock-rise-warn{color:#fbbf24}',
    ".gs-dock-note-warn{color:#b45309}",
    'html[data-gs-dark="1"] .gs-dock-note-warn{color:#fbbf24}',
    /* 预算模式行：🎯 小胶囊（点一下切档，只影响本会话）+ 一句提示 */
    ".gs-dock-mode{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
    ".gs-mode-pill{padding:1px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}",
    ".gs-mode-pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    ".gs-mode-pill-on{border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary);font-weight:600}",
    ".gs-mode-hint{font-size:11px;opacity:.85}",
    /* 预算档菜单（v1.14.0：胶囊从"点一下轮转"改成"点开选"，省得猜现在轮到哪一档了） */
    ".gs-dock-mode{position:relative}",
    /* v1.15.2：档位菜单挂到统一胶囊容器里，容器是圆角卡 —— 用 fixed 定位，菜单才不会被卡片边界裁掉 */
    ".gs-mode-menu{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;gap:2px;min-width:216px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-l1,#fff));box-shadow:0 10px 28px rgba(0,0,0,.18)}",
    ".gs-mode-item{display:flex;align-items:baseline;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:16px;text-align:left;cursor:pointer}",
    ".gs-mode-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".gs-mode-item b{font-size:13px}",
    ".gs-mode-item span{color:var(--dsw-alias-label-tertiary)}",
    ".gs-mode-item i{margin-left:auto;font-style:normal;font-size:11px;color:var(--dsw-alias-label-caption)}",
    ".gs-mode-item-on{background:var(--dsw-alias-interactive-bg-hover)}",
    /* 上下文构成明细（v1.14.0）：这些 token 是谁占的 —— 只说"用了多少"没法指导怎么省 */
    ".gs-dock-parts{display:flex;flex-direction:column;gap:4px;margin-top:4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
    ".gs-dock-parts-toggle{align-self:flex-start;padding:0;border:0;background:0 0;color:inherit;font-family:inherit;font-size:12px;cursor:pointer}",
    ".gs-dock-parts-toggle:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}",
    ".gs-parts-list{display:flex;flex-direction:column;gap:4px;margin-top:2px}",
    ".gs-parts-row{display:grid;grid-template-columns:minmax(80px,30%) 1fr auto;align-items:center;gap:8px}",
    ".gs-parts-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".gs-parts-track{display:block;height:6px;border-radius:999px;background:rgba(127,127,127,.22);overflow:hidden}",
    // v1.15.3：每行一条自己的颜色（--gs-part-color），缺省才回落到进度条色带 --gs-scale。
    ".gs-parts-fill{display:block;height:100%;border-radius:999px;background:var(--gs-part-color,var(--gs-scale))}",
    ".gs-parts-num{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}",
    /* 到线建议（v1.14.0）：按客观计数说一句"该抬线"或"该降档"，按钮就在旁边 */
    ".gs-dock-suggest{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
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
    /* ── 逐字动效：字与字之间用 --gs-i 拉开时间差（速度倍率也一起生效） ── */
    "@keyframes gs-charbounce{0%,100%{transform:translateY(0)}25%{transform:translateY(-7px)}45%{transform:translateY(0)}}",
    "@keyframes gs-charwave{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(-6deg)}}",
    "@keyframes gs-charfade{0%{opacity:0}10%{opacity:1}78%{opacity:1}100%{opacity:0}}",
    ".gs-char{display:inline-block;white-space:pre}",
    // 注意：animation 简写会把 animation-delay 重置为 0，所以每条规则都要把 delay 写在简写**之后**，
    // 否则所有字会同时动（等于没有"逐字"效果）。
    ".gs-anim-charbounce .gs-char{animation:gs-charbounce calc(.9s * var(--gs-anim-speed,1)) ease-in-out infinite;animation-delay:calc(var(--gs-i,0) * .075s / var(--gs-anim-speed,1))}",
    ".gs-anim-charwave .gs-char{animation:gs-charwave calc(1.6s * var(--gs-anim-speed,1)) ease-in-out infinite;animation-delay:calc(var(--gs-i,0) * .075s / var(--gs-anim-speed,1))}",
    ".gs-anim-chartype .gs-char{animation:gs-charfade calc(3.2s * var(--gs-anim-speed,1)) linear infinite;animation-delay:calc(var(--gs-i,0) * .075s / var(--gs-anim-speed,1))}",
    ".gs-anim-charrainbow{background-image:linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#b983ff,#ff6b6b);background-size:320% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gs-sweep calc(3.4s * var(--gs-anim-speed,1)) linear infinite}",
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
  for (var i = 0; i < raw.length && out.length < LEGACY_LINES_MAX; i += 1) {
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
  return Object.assign({}, normalizeCore(base), { scenes: sanitizeScenes(base.scenes) });
}

/**
 * 配置主体（不含场景表）。场景里存的快照也走这里，所以它必须与 scenes 无关，避免自我嵌套。
 * @param raw - 任意输入。
 * @returns {Object} 不含 scenes 的合法配置。
 */
function normalizeCore(raw) {
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
    legacyLines: sanitizeLegacyLines(base.legacyLines),
    pool: sanitizePool(base.pool),
    perWorkspace: sanitizeWorkspaceBindings(base.perWorkspace)
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
function schemeOptions(showAll, current) {
  // 精选：默认只列常用几套（当前用的那套永远保留，否则下拉会显示成别的配色，像被改了设置）。
  var list = showAll === true
    ? BAR_SCHEMES.slice()
    : BAR_SCHEMES.filter(function (item) { return PRIME_SCHEMES.indexOf(item.id) !== -1 || item.id === current; });
  var groups = [];
  var index = {};
  for (var i = 0; i < list.length; i += 1) {
    var item = list[i];
    var name = typeof item.group === "string" && item.group.length > 0 ? item.group : "其它";
    if (index[name] === undefined) {
      index[name] = groups.length;
      groups.push({ name: name, items: [] });
    }
    groups[index[name]].items.push(item);
  }
  var nodes = groups.map(function (group) {
    return React.createElement("optgroup", { key: group.name, label: group.name },
      group.items.map(function (item) {
        return React.createElement("option", { key: item.id, value: item.id }, item.label);
      }));
  });
  // v1.19.0：末尾那条「▾ 显示全部 / ▴ 只看常用」与动效、车型完全同一套文案（不再单挂一个按钮）。
  var more = moreOption(showAll === true, BAR_SCHEMES.length, PRIME_SCHEMES.length, "套");
  nodes.push(React.createElement("option", { key: more.value, value: more.value }, more.label));
  return nodes;
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

/**
 * 「上下文构成」每行专属的颜色（v1.15.3）。
 *
 * 为什么需要：构成条原本用 `--gs-scale`（绿→黄→红那条进度条色带），到线时又整条横幅变红底白字，
 * 于是 CSS 里把填充改成 `currentColor` = 纯白 —— 红底上一排白条，谁大谁小只能读数字，看不出"颜色"。
 * 现在按行号给一个固定色：这些色在浅底和红底（#d93026）上都够亮够分得清，不再随主题/皮肤变化。
 */
var PART_COLORS = [
  "#f59e0b", "#0ea5e9", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4",
  "#fb923c", "#a3e635", "#818cf8", "#14b8a6", "#f472b6", "#eab308"
];

/* ─── 进度条外观偏好（纯前端，存浏览器本地；改完立即生效、不用重启） ──── */
var UI_KEY = "gs.signoff.ui";
var UI_DEFAULTS = {
  barHeight: 9, marker: "🚗", markerImage: "", markerScale: 12, facing: "right", imageFlipped: false,
  scheme: "classic", display: "full", showTime: true, meterMode: "budget", budgetMode: "daily",
  budgetWarn: 75000, budgetCritical: 110000,
  // 花费与上下文（v1.14.0）：数据都来自本机台账，不联网。
  showCost: true,          // 进度条那行显示"本条会话 ≈¥0.42"
  showParts: false,        // 默认收起"上下文构成明细"面板，点一下才展开
  autoSuggest: true,       // 到线时按客观计数提示"建议切大任务/可以降档"
  notifyOnLine: false,     // 到线时发浏览器系统通知（要用户授权，故默认关）
  advOptions: false,       // 长尾选项（40 动效 / 37 配色 / 30 车型）默认收起来
  showDiag: false,         // 诊断分区只在主动打开时出现
  // 计价口径（v1.19.0）：元 / 百万 token。宿主半按这三个数把用量换算成钱；改完重新拉一次花费即生效。
  pricing: { in: 1, cacheRead: 0.02, out: 4 }
};

/** 内置计价口径（元 / 百万 token）：与宿主半的默认单价一致，用作回落基准。 */
var PRICE_DEFAULT = { in: 1, cacheRead: 0.02, out: 4 };

/** 洗一个单价：非数字、负数、超过 1000 元/百万 一律回落内置值（填错最多是没生效，不会把花费算成天文数字）。 */
function normalizePriceValue(value, fallback) {
  var num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num) || num < 0 || num > 1000) return fallback;
  return num;
}

/** 把设置页存的计价口径洗净成 {in, cacheRead, out}。 */
function normalizePricing(raw) {
  var src = raw !== null && typeof raw === "object" ? raw : {};
  return {
    in: normalizePriceValue(src.in, PRICE_DEFAULT.in),
    cacheRead: normalizePriceValue(src.cacheRead, PRICE_DEFAULT.cacheRead),
    out: normalizePriceValue(src.out, PRICE_DEFAULT.out)
  };
}

/** 计价口径是否与内置默认完全一致（设置页显示"内置 / 自定义"用）。 */
function pricingIsDefault(pricing) {
  var p = normalizePricing(pricing);
  return p.in === PRICE_DEFAULT.in && p.cacheRead === PRICE_DEFAULT.cacheRead && p.out === PRICE_DEFAULT.out;
}
/**
 * 预算模式（=「大任务模式」）：三档预设 + 自定义，只决定黄线/红线画在哪。
 * 为什么要有它：日常小任务 7.5 万 tok 就该换会话，但一次大改造/长调研动辄十几万 tok，
 * 拿日常线去卡会一直报红，提醒就变成了噪音。所以给一个"一键抬线 / 一键降线"的档位：
 * ① 全局默认档存在 gs.signoff.ui.budgetMode（设置页里选）；
 * ② 本会话临时档存在 gs.signoff.mode.<sessionId>（进度条上的小胶囊点一下就切，不影响默认）；
 * ③ 谁生效：本会话临时档 > 全局默认档 > 内置默认（日常）。
 */
var BUDGET_MODE_KEY = "gs.signoff.mode.";
var DEFAULT_BUDGET_MODE = "daily";
var BUDGET_MODES = [
  { id: "daily", label: "日常", warn: 75000, critical: 110000, hint: "小任务：一件事聊完就换新会话（7.5 万提醒 / 11 万必须换）" },
  { id: "big", label: "大任务", warn: 150000, critical: 200000, hint: "一次做完再换：大改造、长调研用这个（15 万 / 20 万）" },
  { id: "save", label: "省着聊", warn: 50000, critical: 75000, hint: "最省：更早换会话，代价是重读上下文（5 万 / 7.5 万）" },
  { id: "custom", label: "自定义", warn: null, critical: null, hint: "用设置页里手填的黄线/红线" }
];
/** 小胶囊点一下的轮转顺序；最后一项是空串 = 清掉本会话临时档，回到默认档。 */
var BUDGET_MODE_CYCLE = ["daily", "big", "save", ""];
var BAR_HEIGHTS = [6, 9, 12, 16];
var MARKER_SCALES = [
  { value: 6, label: "小" },
  { value: 12, label: "中" },
  { value: 20, label: "大" }
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
/**
 * 长尾选项的"精选"集合（v1.14.0）。
 *
 * 为什么要有它：40 种动效 / 37 套配色 / 30 种车型全铺在设置页里，选项比需求多一个数量级，
 * 挑一个动效要在下拉里翻半天，还看不清"当前到底设了什么"。默认只露这几个常用的，
 * 想看全部时点旁边的「全部」按钮（存 gs.signoff.ui.advOptions，一次打开就一直开着）。
 */
var PRIME_ANIMATIONS = ["none", "fade", "slide", "shine", "glow", "pulse", "charbounce", "rainbow"];
var PRIME_SCHEMES = ["classic", "bud", "sakura", "candy", "ocean", "ink"];
var PRIME_MARKERS = ["🚗", "🚙", "🚀", "✈️", "⭐", "🐢", ""];
/**
 * 按"精选 / 全部"裁剪一组选项；当前值永远保留（否则下拉会显示成别的档，像被改了设置）。
 * @param {Array} all 全部选项。
 * @param {Array<string>} prime 精选值。
 * @param {boolean} showAll 是否显示全部。
 * @param {*} current 当前值（value 或 value 的变体，如 __none__）。
 */
function pickOptions(all, prime, showAll, current) {
  if (showAll === true) return all.slice();
  var kept = all.filter(function (item) { return prime.indexOf(item.value) !== -1; });
  var extra = all.filter(function (item) { return prime.indexOf(item.value) === -1 && item.value === current; });
  return kept.concat(extra);
}

/**
 * 「精选 ↔ 全部」的统一文案（v1.19.0）：配色 / 动效 / 车型三处长尾下拉以前各写各的 ——
 * 配色旁边挂一个「全部 37」按钮，动效与车型是下拉末尾一条「▾ 显示全部（N 项）」，
 * 而且展开之后就再也收不回来（只能去设置页底部那个开关切）。
 * 现在三处共用这两条文案与同一个开关值（`gs.signoff.ui.advOptions`）：
 * 收起时「▾ 显示全部（N 套）」，展开时「▴ 只看常用（M 套）」——展开后能从同一个下拉里收回精选。
 * @param {boolean} showAll 当前是不是"全部"。
 * @param {number} allCount 全部条数。
 * @param {number} primeCount 精选条数。
 * @param {string} unit 量词（"项" / "套" / "种"）。
 */
function moreOptionLabel(showAll, allCount, primeCount, unit) {
  var u = typeof unit === "string" && unit.length > 0 ? unit : "项";
  var all = typeof allCount === "number" && isFinite(allCount) ? allCount : 0;
  var prime = typeof primeCount === "number" && isFinite(primeCount) ? primeCount : 0;
  if (showAll === true) return "▴ 只看常用（" + prime + " " + u + "）";
  return "▾ 显示全部（" + all + " " + u + "）";
}

/**
 * 那条统一下拉项（value 固定 `__more__` / `__less__`，认这两个值就切 advOptions）。
 * @returns {{value: string, label: string}}
 */
function moreOption(showAll, allCount, primeCount, unit) {
  return {
    value: showAll === true ? "__less__" : "__more__",
    label: moreOptionLabel(showAll, allCount, primeCount, unit)
  };
}

/** 认「▾ 显示全部 / ▴ 只看常用」这两个特殊值；是就切开关并返回 true。 */
function isMoreOptionValue(value) {
  return value === "__more__" || value === "__less__";
}

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
    if (typeof savedUi.showTime === "boolean") uiState.showTime = savedUi.showTime;
    // 进度条口径：默认按"你自己的预算线"（100% = 必须换会话那条线），也可以切回"占模型窗口"。
    if (savedUi.meterMode === "budget" || savedUi.meterMode === "window") uiState.meterMode = savedUi.meterMode;
    if (typeof savedUi.budgetWarn === "number" && isFinite(savedUi.budgetWarn)) uiState.budgetWarn = Math.min(900000, Math.max(5000, Math.round(savedUi.budgetWarn)));
    if (typeof savedUi.budgetCritical === "number" && isFinite(savedUi.budgetCritical)) uiState.budgetCritical = Math.min(999000, Math.max(10000, Math.round(savedUi.budgetCritical)));
    if (uiState.budgetCritical <= uiState.budgetWarn) uiState.budgetCritical = Math.round(uiState.budgetWarn * 1.5);
    // 预算档（大任务模式）：认不出来的值就当没设置，回落到内置默认"日常"。
    if (typeof savedUi.budgetMode === "string") {
      uiState.budgetMode = normalizeBudgetMode(savedUi.budgetMode) === "" ? DEFAULT_BUDGET_MODE : savedUi.budgetMode;
    }
    if (typeof savedUi.markerImage === "string" && savedUi.markerImage.length < 400 * 1024) uiState.markerImage = savedUi.markerImage;
    // 花费 / 明细 / 建议 / 通知 / 长尾选项 / 诊断：只认布尔，认不出来就用默认值。
    if (typeof savedUi.showCost === "boolean") uiState.showCost = savedUi.showCost;
    if (typeof savedUi.showParts === "boolean") uiState.showParts = savedUi.showParts;
    if (typeof savedUi.autoSuggest === "boolean") uiState.autoSuggest = savedUi.autoSuggest;
    if (typeof savedUi.notifyOnLine === "boolean") uiState.notifyOnLine = savedUi.notifyOnLine;
    if (typeof savedUi.advOptions === "boolean") uiState.advOptions = savedUi.advOptions;
    if (typeof savedUi.showDiag === "boolean") uiState.showDiag = savedUi.showDiag;
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

function notifyUiListeners() {
  uiListeners.forEach(function (fn) {
    try { fn(); } catch (error) { console.error("[greet-signoff] ui listener failed", error); }
  });
}

function setUiPrefs(patch) {
  uiState = Object.assign({}, uiState, patch);
  try { window.localStorage.setItem(UI_KEY, JSON.stringify(uiState)); } catch (error) { /* 忽略写入失败 */ }
  notifyUiListeners();
}

/* ─── 本会话临时预算档：只影响当前的这一条会话，不动全局默认档 ────────────── */

/** 读过的本会话档位（key = gs.signoff.mode.<sessionId>），避免每次渲染都同步读 localStorage。 */
var sessionModeMemo = {};

function sessionModeKey(sessionId) {
  return typeof sessionId === "string" && sessionId.length > 0 ? BUDGET_MODE_KEY + sessionId : "";
}

/**
 * 读本会话生效的临时档（没设过就是空串）。
 * @param {string} sessionId 会话 id（空串 = 还没进会话）。
 * @returns {string} 档位 id，或空串。
 */
function readSessionMode(sessionId) {
  var key = sessionModeKey(sessionId);
  if (key === "") return "";
  if (Object.prototype.hasOwnProperty.call(sessionModeMemo, key)) return sessionModeMemo[key];
  var value = "";
  try { value = normalizeBudgetMode(window.localStorage.getItem(key) || ""); } catch (error) { value = ""; }
  sessionModeMemo[key] = value;
  return value;
}

/**
 * 写本会话的临时档（空串 = 清掉，回到默认档），并通知界面重算。
 * @param {string} sessionId 会话 id。
 * @param {string} mode 档位 id 或空串。
 */
function writeSessionMode(sessionId, mode) {
  var key = sessionModeKey(sessionId);
  if (key === "") return;
  var value = normalizeBudgetMode(mode);
  sessionModeMemo[key] = value;
  try {
    if (value === "") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch (error) { /* 隐私模式：只留在内存里 */ }
  notifyUiListeners();
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
var FOLD_DEFAULTS = { text: true, font: true, deco: true, scenes: false, alert: false, legacy: false, bar: false, diag: false };
var FOLD_KEY = "gs.signoff.folds";

/** 顶部快速跳转条：顺序就是面板里的顺序（标签短一点，一行放得下）。 */
var SECTION_NAV = [
  { key: "text", label: "文案" },
  { key: "font", label: "字体" },
  { key: "deco", label: "外观" },
  { key: "scenes", label: "场景" },
  { key: "alert", label: "提醒" },
  { key: "bar", label: "进度条" },
  { key: "cost", label: "成本" },
  { key: "legacy", label: "旧文案" },
  { key: "diag", label: "诊断" }
];

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

/* ─── 深浅判定（方案 C：dark-only 皮肤也能认出来） ─────────────────────── */

/**
 * 解析 CSS 颜色（#rgb / #rrggbb / rgb() / rgba()）→ [r,g,b]。
 * 解析不出来、或完全透明（看不出底色）时返回 null。
 * @param {string} value CSS 颜色。
 * @returns {number[]|null} 三元组。
 */
var CSS_RGB_CACHE = new Map();

function parseCssRgb(value) {
  if (typeof value !== "string") return null;
  var text = value.trim().toLowerCase();
  if (text.length === 0) return null;
  if (CSS_RGB_CACHE.has(text)) return CSS_RGB_CACHE.get(text);
  var out = null;
  var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex !== null) {
    var body = hex[1];
    if (body.length === 3) body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
    out = [
      parseInt(body.slice(0, 2), 16),
      parseInt(body.slice(2, 4), 16),
      parseInt(body.slice(4, 6), 16)
    ];
  } else {
    var fn = /^rgba?\(([^)]*)\)$/.exec(text);
    if (fn !== null) {
      var parts = fn[1].split(/[\s,\/]+/).filter(function (part) { return part.length > 0; });
      if (parts.length >= 4) {
        var alpha = Number(parts[3]);
        if (!isFinite(alpha) || alpha === 0) parts = [];   // 全透明：没有底色可言
      }
      if (parts.length >= 3) {
        // 兼容百分比写法（rgb(10% 20% 30%)）
        var channels = [parts[0], parts[1], parts[2]].map(function (part) {
          var pct = part.indexOf("%") >= 0;
          var num = parseFloat(part);
          if (!isFinite(num)) return NaN;
          return Math.max(0, Math.min(255, Math.round(pct ? num * 2.55 : num)));
        });
        if (channels.every(function (n) { return isFinite(n); })) out = channels;
      }
    }
  }
  if (CSS_RGB_CACHE.size > 200) CSS_RGB_CACHE.clear();
  CSS_RGB_CACHE.set(text, out);
  return out;
}

/**
 * CSS 颜色 → 亮度（0=黑，1=白）；解析不出来返回 null。
 * @param {string} value CSS 颜色。
 * @returns {number|null} 亮度。
 */
function colorLuminance(value) {
  var rgb = parseCssRgb(value);
  if (rgb === null) return null;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/**
 * 深色判定的**纯函数**部分：把页面上的几条证据合成一个布尔值。
 * 抽成纯函数是为了可测——无头页面里拿不到真实皮肤，但"什么算深色"这条规则必须锁住。
 * 判据（任一成立即按深色处理，按可靠性从高到低）：
 *   ① body[data-ds-dark-theme]：DSH 自带深色主题的官方标记；
 *   ② 根元素 computed `color-scheme` 含 dark：dark-only 皮肤（astral-choir 等）就是这么声明的；
 *   ③ 系统偏好 prefers-color-scheme: dark；
 *   ④ 页面底色亮度 < 0.5：皮肤只改 CSS 变量、上面三条都不成立时的兜底。
 * @param {Object} signals 证据对象 {bodyDarkAttr,colorScheme,prefersDark,bgLuminance}。
 * @returns {boolean} 是否按深色处理。
 */
function darkFromSignals(signals) {
  var s = signals === null || signals === undefined ? {} : signals;
  if (s.bodyDarkAttr === true) return true;
  if (typeof s.colorScheme === "string" && s.colorScheme.toLowerCase().indexOf("dark") >= 0) return true;
  if (s.prefersDark === true) return true;
  if (typeof s.bgLuminance === "number" && isFinite(s.bgLuminance) && s.bgLuminance < 0.5) return true;
  return false;
}

/** 当前判定结果（由 refreshDarkTheme 维护；组件订阅后随皮肤切换自动重渲染）。 */
var darkState = { dark: false };
var darkListeners = new Set();
var darkWatch = null;
/** 已经写到 <html data-gs-dark> 上的值（防止"写属性→观察器→再写"的死循环）。 */
var darkAttrValue = null;
/** 合并触发的定时器。 */
var darkRefreshTimer = null;

/** 从页面读"是不是深色"的几条证据；读不到的留空，绝不抛错。 */
function readDarkSignals() {
  var signals = { bodyDarkAttr: false, colorScheme: "", prefersDark: false, bgLuminance: null };
  try {
    var body = typeof document === "undefined" ? null : document.body;
    var root = typeof document === "undefined" ? null : document.documentElement;
    if (body !== null && body !== undefined && typeof body.hasAttribute === "function") {
      signals.bodyDarkAttr = body.hasAttribute("data-ds-dark-theme") === true;
    }
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      if (root !== null && root !== undefined) {
        var rootStyle = window.getComputedStyle(root);
        if (rootStyle !== null && rootStyle !== undefined) {
          signals.colorScheme = String(rootStyle.colorScheme || "");
          signals.bgLuminance = colorLuminance(String(rootStyle.backgroundColor || ""));
        }
      }
      if (body !== null && body !== undefined) {
        var bodyStyle = window.getComputedStyle(body);
        if (bodyStyle !== null && bodyStyle !== undefined) {
          var bodyLum = colorLuminance(String(bodyStyle.backgroundColor || ""));
          // body 完全透明（看不出底色）时保留根元素的结论
          if (bodyLum !== null) signals.bgLuminance = bodyLum;
        }
      }
    }
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      signals.prefersDark = mq !== null && mq !== undefined && mq.matches === true;
    }
  } catch (error) { /* 拿不到证据就当浅色，绝不因为判定失败影响渲染 */ }
  return signals;
}

/**
 * 重算深浅判定：把结果写到 `<html data-gs-dark="1|0">`（对话里那两行的深色档 CSS 就挂在这个标记上），
 * 结果变化时通知订阅者重渲染。
 *
 * ⚠️ 这里必须"值没变就不写属性"：观察器盯着 html 的属性，而 setAttribute 写在观察范围内，
 * 哪怕值一样也会产生一条 mutation 记录 —— 无脑写会变成 写→观察→写 的死循环，把渲染进程卡死。
 * @returns {boolean} 当前是否深色。
 */
function refreshDarkTheme() {
  var next = darkFromSignals(readDarkSignals());
  try {
    var root = typeof document === "undefined" ? null : document.documentElement;
    var want = next ? "1" : "0";
    if (root !== null && root !== undefined && typeof root.setAttribute === "function" && darkAttrValue !== want) {
      root.setAttribute("data-gs-dark", want);
      darkAttrValue = want;
    }
  } catch (error) { /* 忽略：写不上标记就只影响 CSS 那一路，内联样式仍按 darkState 走 */ }
  if (next === darkState.dark) return next;
  darkState.dark = next;
  darkListeners.forEach(function (listener) {
    try { listener(); } catch (error) { console.error("[greet-signoff] dark listener failed", error); }
  });
  return next;
}

/** 合并短时间内的多次触发（观察器回调里可能连着来好几条记录），避免重复读 computed style。 */
function scheduleDarkRefresh() {
  if (darkRefreshTimer !== null) return;
  if (typeof window === "undefined" || typeof window.setTimeout !== "function") { refreshDarkTheme(); return; }
  darkRefreshTimer = window.setTimeout(function () {
    darkRefreshTimer = null;
    refreshDarkTheme();
  }, 50);
}

/**
 * 装上深浅判定的监听（只装一次）：皮肤切换改的是 html 属性/CSS 变量，
 * 所以盯 html 与 body 的属性变化 + 系统偏好变化，外加一个低频兜底对表。
 */
function ensureDarkWatch() {
  if (darkWatch !== null) return;
  refreshDarkTheme();
  var observer = null;
  var media = null;
  var onMedia = function () { refreshDarkTheme(); };
  var timer = null;
  try {
    if (typeof MutationObserver === "function" && typeof document !== "undefined" && document.documentElement !== undefined) {
      // 只盯跟皮肤有关的几个属性：皮肤加载器会改 data-dsh-*、class、style；
      // 全属性观察既费性能，也更容易把无关变化引进来（回调统一走合并触发的 scheduleDarkRefresh）。
      observer = new MutationObserver(function () { scheduleDarkRefresh(); });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-dsh-skin", "data-dsh-custom-theme", "data-gs-dark", "data-ds-dark-theme"]
      });
      if (document.body !== null && document.body !== undefined) {
        observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-ds-dark-theme"] });
      }
    }
  } catch (error) { observer = null; }
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      if (media !== null && media !== undefined && typeof media.addEventListener === "function") media.addEventListener("change", onMedia);
    }
  } catch (error) { media = null; }
  try {
    // 兜底：皮肤换法若只是替换 CSS 变量、又没动属性，属性监听就看不到；每 8 秒对一次表（读 computed style 很便宜）。
    if (typeof window !== "undefined" && typeof window.setInterval === "function") timer = window.setInterval(refreshDarkTheme, 8000);
  } catch (error) { timer = null; }
  darkWatch = { observer: observer, media: media, onMedia: onMedia, timer: timer };
}

/** 拆掉深浅判定的监听（插件停用时不留定时器）。 */
function disposeDarkWatch() {
  if (darkWatch === null) return;
  try { if (darkWatch.observer !== null) darkWatch.observer.disconnect(); } catch (error) { /* 忽略 */ }
  try { if (darkRefreshTimer !== null && typeof window !== "undefined") { window.clearTimeout(darkRefreshTimer); darkRefreshTimer = null; } } catch (error) { /* 忽略 */ }
  try {
    if (darkWatch.media !== null && typeof darkWatch.media.removeEventListener === "function") darkWatch.media.removeEventListener("change", darkWatch.onMedia);
  } catch (error) { /* 忽略 */ }
  try { if (darkWatch.timer !== null && typeof window !== "undefined") window.clearInterval(darkWatch.timer); } catch (error) { /* 忽略 */ }
  darkWatch = null;
}

/**
 * 当前是不是深色（综合判定；结果缓存，由观察器维护，不在渲染里读 computed style）。
 * @returns {boolean} 是否深色。
 */
function isDarkTheme() {
  return darkState.dark === true;
}

/** 订阅深浅判定的 React 钩子：皮肤一切换，用到它的组件会跟着重渲染。 */
function useDarkTheme() {
  var pair = React.useState(darkState.dark);
  var setDark = pair[1];
  React.useEffect(function () {
    var listener = function () { setDark(darkState.dark); };
    darkListeners.add(listener);
    ensureDarkWatch();
    refreshDarkTheme();
    return function () { darkListeners.delete(listener); };
  }, []);
  return pair[0];
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

/**
 * 预览里的文本内容：逐字动效时拆成一个个 `<span class="gs-char">`（用 --gs-i 拉开时间差），
 * 其余动效就是一段普通文本。对话正文里的逐字包装由 installChatStyler 做同样的事。
 * @param {Object} line 配置里的行对象。
 * @returns {*} 可以直接作为 React 子节点的内容。
 */
function renderLineText(line) {
  if (!isPerCharAnimation(line.animation)) return line.text;
  return splitGraphemes(line.text).map(function (ch, index) {
    return React.createElement("span", {
      key: "ch" + index,
      className: "gs-char",
      style: { "--gs-i": String(index) }
    }, ch);
  });
}

/**
 * 取出"样式字段"（不含文案与图片），用于把一行的外观整包复制到另一行。
 * @param line - 行配置。
 * @returns {Object} 只含样式字段的补丁。
 */
function lineStyleSource(line) {
  var out = {};
  var keys = Object.keys(DEFAULT_LINE);
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    if (key === "text" || key === "image") continue;
    if (line[key] !== undefined) out[key] = line[key];
  }
  return out;
}

/**
 * 渲染一行"开场/收尾"的样子（编辑器预览与输入框上方卡片共用）。
 * @param line - 行配置。
 * @param label - 前缀标签（预设小样卡传空串）。
 * @param key - React key。
 * @returns {Object} React 元素。
 */
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
  children.push(React.createElement("span", { key: "text", style: lineStyle(line) }, renderLineText(line)));
  return React.createElement("div", {
    key: key,
    className: lineClassOf(line, "gs-line gs-decor"),
    style: lineVars(line)
  }, React.createElement("b", null, label), children);
}

/* ─── 编辑器 ─────────────────────────────────────────────────────────── */

function Editor() {
  var store = useConfig();
  // 深浅皮肤一变就重渲染：预览里的深色档颜色（<字段>Dark）跟着换，
  // 不用手动刷新页面。（方案 C：dark-only 皮肤只改 CSS 变量，光靠 body 属性认不出来。）
  var dark = useDarkTheme();
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

  /** 图片拖拽悬停态（拖进来时给个虚线框反馈）。 */
  var dragPair = React.useState(false);
  var dragOver = dragPair[0];
  var setDragOver = dragPair[1];

  /** 上一次保存之前的配置（供「撤销上次保存」一键回退；null = 还没保存过）。 */
  var revertPair = React.useState(null);
  var revertConfig = revertPair[0];
  var setRevertConfig = revertPair[1];

  /**
   * 套用一套外观预设：以 PRESET_BASE 打底再叠加这套预设，**文案与图片原样保留**。
   * 之所以要打底：预设只写它关心的字段，不打底的话你之前手调过的底色/边框会残留，
   * 同一套预设在不同行上长得不一样。
   * @param {Object} preset STYLE_PRESETS 里的一项。
   */
  function applyPreset(preset) {
    var targets = presetBoth ? ["greeting", "signOff"] : [tab];
    var patch = {};
    var style = Object.assign({}, PRESET_BASE, preset.style);
    for (var i = 0; i < targets.length; i += 1) {
      var key = targets[i];
      patch[key] = Object.assign({}, draft[key], style);
    }
    dirtyRef.current = true;
    setTouched(true);
    setSaved(false);
    setDraft(Object.assign({}, draft, patch));
    setNotice("已套用「" + preset.name + "」外观（文案与图片未改动），正在保存…");
  }

  /** 这套预设是不是当前行的外观（按预设自己声明的字段比对，用于高亮）。 */
  function presetIsActive(preset) {
    var style = Object.assign({}, PRESET_BASE, preset.style);
    var keys = Object.keys(style);
    for (var i = 0; i < keys.length; i += 1) {
      if (line[keys[i]] !== style[keys[i]]) return false;
    }
    return true;
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
   * 一次性展开/收起所有分区（状态照旧记在浏览器本地）。
   * @param open - true 全部展开，false 全部收起。
   */
  function setAllFolds(open) {
    var next = Object.assign({}, folds);
    Object.keys(FOLD_DEFAULTS).forEach(function (key) { next[key] = open === true; });
    setFolds(next);
    writeFoldState(next);
  }

  /**
   * 跳到某个分区：先把它展开，再滚到视野里（卡片有 scroll-margin-top，不会被吸顶预览挡住）。
   * @param key - 分区标识。
   */
  function jumpToSection(key) {
    var next = Object.assign({}, folds);
    next[key] = true;
    setFolds(next);
    writeFoldState(next);
    window.setTimeout(function () {
      var el = document.querySelector('[data-gs-sec="' + key + '"]');
      if (el !== null && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
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
    // 记下"这次保存之前"的那份配置：保存成功后「撤销上次保存」就能一键回退。
    var previous = store.config;
    // __client 只是给宿主日志留个可辨识的标记（宿主 normalize 会丢弃未知字段）。
    var body = Object.assign({}, payload, { __client: (auto === true ? "auto@" : "settings@") + Date.now() });
    saveConfig(body)
      .then(function (next) {
        dirtyRef.current = false;
        setTouched(false);
        setFail(0);
        setDraft(next);
        setSaved(true);
        setRevertConfig(previous);
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
   *
   * 注意：children 是**可变参数**（可以传多个元素）。最后一项如果是个"普通对象"（不是 React 元素），
   * 才当作 options —— 之前只支持一个 children，多传的内容会被静默当成 options 丢掉
   * （2026-09-18 实测发现「外观样式」里的形状/填充/圆角/底色/边框/边色/阴影就是这么整块消失的）。
   * @param {string} title 标题。
   * @param {string} key 分区标识（同时是折叠状态与 React key）。
   * @param {...*} children 内容（可多个）。
   * @returns {Object} React 元素。
   */
  function section(title, key) {
    var rest = Array.prototype.slice.call(arguments, 2);
    var last = rest.length > 0 ? rest[rest.length - 1] : undefined;
    var hasOptions = last !== null && typeof last === "object" && !Array.isArray(last) && React.isValidElement(last) !== true;
    var opts = hasOptions ? rest.pop() : {};
    var open = folds[key] !== undefined ? folds[key] === true : opts.defaultOpen !== false;
    var children = rest.length === 1 ? rest[0] : rest;
    return React.createElement("div", { className: "gs-card", key: key, "data-gs-sec": key },
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

  /**
   * 长尾下拉（v1.14.0）：默认只列"精选"几项，末尾挂一条「▾ 显示全部（N 项）」——
   * 选中它只把 advOptions 打开、不改变当前值，下拉立刻变全量。这样 40 动效 / 30 车型
   * 不会再一上来就糊满整屏，想要冷门选项也就多点一下。
   * v1.19.0：文案与「收起」由 moreOption / moreOptionLabel 统一产出（配色也改成同一套），
   * 展开之后末尾那条变成「▴ 只看常用（M 项）」，从同一个下拉里就能收回精选。
   */
  function pickedCell(label, all, prime, value, onChange, key, wide) {
    var list = pickOptions(all, prime, ui.advOptions === true, value);
    list = list.concat([moreOption(ui.advOptions === true, all.length, prime.length, "项")]);
    return selectCell(label, list, value, function (next) {
      if (isMoreOptionValue(next)) { setUiPrefs({ advOptions: next === "__more__" }); return; }
      onChange(next);
    }, key, wide);
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

  /** 文案池：开关两行共用，池子内容各存各的；这里只读当前标签页那一行。 */
  var poolCfg = draft.pool !== undefined && draft.pool !== null ? draft.pool : DEFAULTS.pool;
  var poolKind = tab === "signOff" ? "signOff" : "greeting";
  var poolText = Array.isArray(poolCfg[poolKind]) ? poolCfg[poolKind].join("\n") : "";
  var poolSize = (Array.isArray(poolCfg.greeting) ? poolCfg.greeting.length : 0) + (Array.isArray(poolCfg.signOff) ? poolCfg.signOff.length : 0);

  /** 文案池的字段补丁（开关、模式、某一行句子）。 */
  function patchPool(patch) {
    patchTop({ pool: Object.assign({}, poolCfg, patch) });
  }

  /* ── 场景：整份配置的命名快照，一键整包切换 ─────────────────────────── */

  /** 生成一个没被占用的场景 id（s1…s8）。 */
  function nextSceneId() {
    for (var i = 1; i <= SCENES_MAX; i += 1) {
      var id = "s" + i;
      if (!scenes.items.some(function (item) { return item.id === id; })) return id;
    }
    return "s" + Date.now().toString(36).slice(-4);
  }

  /** 把当前设置存成一个新场景，并把它设为当前场景。 */
  function saveScene() {
    var name = sceneName.trim();
    if (name.length === 0) { setNotice("先给场景起个名字（如「工作」），再点「存成场景」"); return; }
    if (scenes.items.length >= SCENES_MAX) { setNotice("场景最多 " + SCENES_MAX + " 个：先删掉一个再存"); return; }
    var id = nextSceneId();
    var item = { id: id, name: name.slice(0, SCENE_NAME_MAX), config: normalizeCore(draft) };
    var next = { active: id, items: scenes.items.concat([item]) };
    setSceneName("");
    commit(Object.assign({}, normalizeCore(draft), { scenes: next }), false);
    setNotice("已存下场景「" + item.name + "」：以后点它就能一键切回来");
  }

  /** 切到某个场景（整包替换当前设置）。 */
  function applyScene(item) {
    commit(Object.assign({}, item.config, { scenes: { active: item.id, items: scenes.items } }), false);
    setNotice("已切到场景「" + item.name + "」");
  }

  /** 用当前设置覆盖某个场景。 */
  function overwriteScene(item) {
    var next = {
      active: item.id,
      items: scenes.items.map(function (one) {
        return one.id === item.id ? { id: one.id, name: one.name, config: normalizeCore(draft) } : one;
      })
    };
    commit(Object.assign({}, normalizeCore(draft), { scenes: next }), false);
    setNotice("已用当前设置覆盖场景「" + item.name + "」");
  }

  /** 删掉某个场景。 */
  function deleteScene(item) {
    var next = {
      active: scenes.active === item.id ? "" : scenes.active,
      items: scenes.items.filter(function (one) { return one.id !== item.id; })
    };
    commit(Object.assign({}, normalizeCore(draft), { scenes: next }), false);
    setNotice("已删除场景「" + item.name + "」");
  }

  /** 自检结果（null = 还没跑过）。 */
  var selfCheckPair = React.useState(null);
  var selfCheck = selfCheckPair[0];
  var setSelfCheck = selfCheckPair[1];

  /** 场景的名字输入框 + 场景表。 */
  var sceneNamePair = React.useState("");
  var sceneName = sceneNamePair[0];
  var setSceneName = sceneNamePair[1];
  var scenes = draft.scenes !== undefined && draft.scenes !== null ? draft.scenes : DEFAULTS.scenes;

  /** 按工作区绑定：开关 + 绑定表。 */
  var wsCfg = draft.perWorkspace !== undefined && draft.perWorkspace !== null ? draft.perWorkspace : DEFAULTS.perWorkspace;

  /** 工作区绑定的字段补丁。 */
  function patchWs(patch) {
    patchTop({ perWorkspace: Object.assign({}, wsCfg, patch) });
  }

  /** 改一条绑定里的某个字段。 */
  function patchWsItem(index, patch) {
    var next = wsCfg.items.slice();
    next[index] = Object.assign({}, next[index], patch);
    patchWs({ items: next });
  }

  /**
   * 从页面里猜一个工作区路径（DSH 的工作区条目通常把绝对路径放在 title 上）。
   * 猜不到就返回空串，让用户自己填。
   * @returns {string} 猜到的路径。
   */
  function guessWorkspacePath() {
    if (typeof document === "undefined") return "";
    var nodes = document.querySelectorAll("[title]");
    for (var i = 0; i < nodes.length; i += 1) {
      var title = nodes[i].getAttribute("title") || "";
      var hit = /([A-Za-z]:\\[^"<>|\r\n]{1,180})/.exec(title);
      if (hit !== null) return hit[1].trim();
    }
    return "";
  }

  /** 「填当前工作区」：猜一个路径填进(最后一条空路径 / 新加一条)。 */
  function fillCurrentWorkspace() {
    var guess = guessWorkspacePath();
    if (guess === "") { setNotice("没在页面上找到工作区路径，手动填一下（例如 E:\\harness）"); return; }
    var items = wsCfg.items.slice();
    var blank = -1;
    for (var i = 0; i < items.length; i += 1) {
      if (String(items[i].path || "").trim() === "") { blank = i; break; }
    }
    if (blank >= 0) items[blank] = Object.assign({}, items[blank], { path: guess });
    else if (items.length < WORKSPACE_MAX) items.push({ path: guess, greeting: "", signOff: "" });
    else { setNotice("绑定已满 " + WORKSPACE_MAX + " 条：先删一条再加"); return; }
    patchWs({ items: items });
    setNotice("已填入工作区路径：" + guess + "（再写上这个项目专用的开场/收尾就生效）");
  }

  /**
   * 跑一遍自检：把"样式没生效/数字不对/看着怪"这类问题一次问到底，
   * 逐项给 ✅/⚠️ 与一句话结论，不用再来回翻设置。
   */
  function runSelfCheck() {
    var lines = [];
    var fails = 0;
    function add(ok, text) {
      if (!ok) fails += 1;
      lines.push((ok ? "✅ " : "⚠️ ") + text);
    }
    function report() { setSelfCheck({ running: false, lines: lines, ok: fails === 0 }); }

    var cfg = state.config;
    add(state.loaded, "配置读取：" + (state.loaded ? (state.path || "已读取") : "失败 · " + (state.error || "未知原因")));
    var gText = typeof cfg.greeting.text === "string" ? cfg.greeting.text.trim() : "";
    var sText = typeof cfg.signOff.text === "string" ? cfg.signOff.text.trim() : "";
    var poolNow = cfg.pool !== undefined && cfg.pool !== null ? cfg.pool : DEFAULTS.pool;
    var poolCount = (Array.isArray(poolNow.greeting) ? poolNow.greeting.length : 0) + (Array.isArray(poolNow.signOff) ? poolNow.signOff.length : 0);
    add(gText.length > 0 || sText.length > 0 || poolCount > 0,
      "固定文案：开场 " + (gText.length > 0 ? "有" : "空") + " / 收尾 " + (sText.length > 0 ? "有" : "空")
      + " · 文案池 " + (poolNow.enabled === true ? "开启（" + poolCount + " 句）" : "未开启"));
    var hits = typeof document !== "undefined" ? document.querySelectorAll(".gs-chat-line").length : 0;
    add(stylerStats.runs > 0, "贴样式器：运行 " + stylerStats.runs + " 次 · 本页命中 " + hits + " 行（命中 0 说明当前这页还没有对得上的固定行）");
    var dock = typeof document !== "undefined" ? document.querySelector(".gs-dock-bar") : null;
    add(dock !== null, "进度条：" + (dock !== null ? "已挂载（读数 " + (dock.getAttribute("aria-valuenow") || "未知") + "）" : "未挂载（输入框上方的卡片没出现）"));
    var signals = readDarkSignals();
    add(true, "深浅判定：" + (isDarkTheme() ? "深色" : "浅色")
      + "（body 标记 " + (signals.bodyDarkAttr ? "有" : "无")
      + " · color-scheme " + (signals.colorScheme === "" ? "未声明" : signals.colorScheme)
      + " · 系统偏好 " + (signals.prefersDark ? "深色" : "浅色")
      + " · 底色亮度 " + (signals.bgLuminance === null ? "未知" : signals.bgLuminance.toFixed(2)) + "）");
    var timeRow = typeof document !== "undefined" ? document.querySelector(".gs-dock-time") : null;
    add(true, "进度条时间行：" + (timeRow !== null
      ? "已显示 · " + String(timeRow.textContent || "").trim()
      : "未显示（形态要选「完整」，或打开了「时间显示」）"));
    add(true, "连接自愈：检查 " + healStats.checks + " 次 · 异常 " + healStats.stuck + " 次 · 自动重载 " + healStats.reloads + " 次");

    setSelfCheck({ running: true, lines: lines, ok: false });
    fetch("/api/greet-signoff", { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data === null) { add(false, "宿主半：配置接口没响应（插件可能没加载）"); report(); return null; }
        var same = data.hostVersion === CLIENT_VERSION;
        add(same, "版本：宿主半 v" + (data.hostVersion || "?") + " / 浏览器半 v" + CLIENT_VERSION + (same ? "" : "（不一致 → 需要重启一次 dsh web）"));
        return fetch("/api/greet-signoff/rule-text", { cache: "no-store" })
          .then(function (response) { return response.ok ? response.json() : null; });
      })
      .then(function (rt) {
        if (rt !== null && rt !== undefined) {
          var text = typeof rt.text === "string" ? rt.text : "";
          add(text.length > 0, "规则文本：" + (text.length > 0 ? "生成正常（" + text.length + " 字）" : "为空 —— 两行文案都空时属正常"));
          var stats = rt.stats;
          add(true, "会话识别：" + (rt.sessionId === null || rt.sessionId === undefined ? "还没跑过模型调用" : (rt.exactSession === true ? "精确命中" : "兜底命中（最近跑过的会话）"))
            + " · 上一轮统计：" + (stats === null || stats === undefined ? "暂无" : (stats.rounds + " 次调用 / " + stats.lastMs + "ms / " + stats.lastTokens + " tokens / " + (stats.lastModel || "模型未知"))));
        }
        return fetch("/api/greet-signoff/session", { cache: "no-store" })
          .then(function (response) { return response.ok ? response.json() : null; });
      })
      .then(function (si) {
        if (si !== null && si !== undefined && si.ok === true) {
          var started = typeof si.startedAt === "number" && isFinite(si.startedAt) && si.startedAt > 0 ? si.startedAt : null;
          add(started !== null, "会话时间：" + (started === null
            ? "宿主半没给出会话创建时间（进度条退回本地估算）"
            : "开始于 " + formatClock(started) + " · 已聊 " + formatDuration(Date.now() - started))
            + " · " + (si.sessionId === null || si.sessionId === undefined ? "还没跑过模型调用" : (si.exactSession === true ? "按 id 精确命中" : "按 id 查询未命中")));
        }
        report();
      })
      .catch(function () { add(false, "自检请求失败（服务可能刚重启或没在跑）"); report(); });
  }

  // 本地外观偏好提前取：下面「动效 / 配色 / 小车」那些"精选 vs 全部"的下拉要用它
  // （原来只在进度条分区里取，位置太靠后）。
  var ui = useUiPrefs();
  // 花费台账（v1.14.0）：跨会话的今日 / 近 7 天 + 最贵几条，数据来自本机 usage-ledger.json。
  var costPair = React.useState(null);
  var costInfo = costPair[0];
  var setCostInfo = costPair[1];
  React.useEffect(function () {
    var alive = true;
    function pull() {
      fetchCostInfo("", 7).then(function (data) { if (alive && data !== null && data !== undefined) setCostInfo(data); });
    }
    pull();
    var timer = window.setInterval(pull, 120000);
    return function () { alive = false; window.clearInterval(timer); };
  }, []);

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
      React.createElement("div", { className: "gs-quicknav", key: "quicknav" },
        SECTION_NAV.map(function (item) {
          return React.createElement("button", {
            key: item.key, type: "button", className: "gs-chip",
            title: "跳到「" + item.label + "」并展开",
            onClick: function () { jumpToSection(item.key); }
          }, item.label);
        }),
        React.createElement("span", { className: "gs-quicknav-gap" }),
        React.createElement("button", {
          type: "button", className: "gs-chip", title: "展开全部分区",
          onClick: function () { setAllFolds(true); }
        }, "全部展开"),
        React.createElement("button", {
          type: "button", className: "gs-chip", title: "收起全部分区",
          onClick: function () { setAllFolds(false); }
        }, "全部收起")
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
            ["{year}", "年"], ["{month}", "月"], ["{day}", "日"], ["{time}", "时:分"],
            ["{count}", "本会话第几次模型调用（本次）"], ["{model}", "最近一次调用用的模型名"],
            ["{elapsed}", "上一次调用耗时，如 12.4s"], ["{tokens}", "上一次调用用量，如 3.1k"]
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
        React.createElement("div", { className: "gs-inline", key: "copy-other" },
          React.createElement("button", {
            type: "button", className: "gs-btn",
            title: "把这一行的文案复制到另一行（只复制文案，样式各留各的）",
            onClick: function () {
              var other = tab === "greeting" ? "signOff" : "greeting";
              var patch = {};
              patch[other] = Object.assign({}, draft[other], { text: line.text });
              patchTop(patch);
              setNotice("已把这句文案复制到" + (other === "greeting" ? "开场语" : "结束语"));
            }
          }, "文案复制到" + (tab === "greeting" ? "收尾" : "开场")),
          React.createElement("button", {
            type: "button", className: "gs-btn",
            title: "把这一行的样式也复制到另一行（字号/颜色/形状/动效等，文案不动）",
            onClick: function () {
              var other = tab === "greeting" ? "signOff" : "greeting";
              var patch = {};
              patch[other] = Object.assign({}, draft[other], lineStyleSource(line));
              patchTop(patch);
              setNotice("已把这行的外观复制到" + (other === "greeting" ? "开场语" : "结束语"));
            }
          }, "外观复制到" + (tab === "greeting" ? "收尾" : "开场"))
        ),
        React.createElement("div", { className: "gs-hint", key: "resolved" },
          "现在会解析成：" + (resolveTemplate(line.text, new Date()).replace(/\n/g, " ⏎ ") || "（空）")),
        React.createElement("div", { className: "gs-hint", key: "runtime-vars" },
          "{count} {model} {elapsed} {tokens} 由服务端每轮填真实值（{elapsed} 与 {tokens} 是**上一次调用**的），页面按通配符匹配，所以数值怎么变都能贴上样式。"),
        React.createElement("div", {
          className: "gs-hint",
          title: "点「全部表情」展开全部可显示表情（" + emojiTotalLabel() + "），可用中文名搜索（如「皇冠」「鞭炮」「钱包」）。也可以直接用系统表情面板：Win + ." + (EMOJI_SCAN.blank > 0 ? " 已自动隐藏 " + EMOJI_SCAN.blank + " 个本机字体没有字形的表情。" : "")
        }, "常用表情在上面，点「全部表情」可搜索全部 " + emojiTotalLabel() + "（Win + . 也能调系统面板）"),
        // 文案池：让这一行"每轮换一句"。
        React.createElement("div", { className: "gs-pool", key: "pool" },
          React.createElement("div", { className: "gs-inline gs-pool-head" },
            React.createElement("label", { className: "gs-inline" },
              React.createElement("input", {
                type: "checkbox", checked: poolCfg.enabled === true,
                onChange: function (event) { patchPool({ enabled: event.target.checked }); }
              }),
              React.createElement("span", { className: "gs-label" }, "文案池：让" + (poolKind === "signOff" ? "收尾" : "开场") + "每轮换一句")
            ),
            React.createElement("span", { className: "gs-inline" },
              React.createElement("select", {
                className: "gs-input gs-select", style: { width: 124, flex: "none" },
                value: poolCfg.mode, disabled: poolCfg.enabled !== true,
                onChange: function (event) { patchPool({ mode: event.target.value }); }
              },
                React.createElement("option", { value: "random" }, "随机挑一句"),
                React.createElement("option", { value: "sequence" }, "按顺序轮换")
              ),
              React.createElement("span", { className: "gs-hint" }, "共 " + poolSize + " 句 · 开关两行共用")
            )
          ),
          React.createElement("textarea", {
            className: "gs-textarea gs-pool-text", value: poolText,
            placeholder: "一行一句（最多 " + POOL_MAX + " 句）。留空则这一行继续用上面的固定文案。",
            onChange: function (event) {
              var patch = {};
              patch[poolKind] = event.target.value.split("\n");
              patchPool(patch);
            }
          }),
          React.createElement("div", { className: "gs-inline" },
            React.createElement("button", {
              type: "button", className: "gs-btn",
              title: "把上面的固定文案也放进池子，让它一起参与随机/轮换",
              onClick: function () {
                var current = typeof line.text === "string" ? line.text.trim() : "";
                if (current.length === 0) { setNotice("上面的固定文案还是空的，先写一句再放进池子"); return; }
                var next = (Array.isArray(poolCfg[poolKind]) ? poolCfg[poolKind] : []).slice();
                if (next.indexOf(current) >= 0) { setNotice("这句已经在池子里了"); return; }
                next.push(current);
                var patch = {};
                patch[poolKind] = next;
                patchPool(patch);
                setNotice("已把当前文案放进池子");
              }
            }, "把上面的文案加进池子"),
            React.createElement("span", { className: "gs-hint" },
              poolCfg.enabled !== true
                ? "未开启：这一行用上面的固定文案"
                : (poolSize === 0 ? "已开启但池子是空的：这一行仍用固定文案" : "开启中：每轮从池子里挑一句，页面样式对每一句都生效"))
          )
        )
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
        pickedCell("动效", ANIMATIONS, PRIME_ANIMATIONS, line.animation,
          function (value) { setLine({ animation: value }); }, "animation"),
        sliderCell("速度", line.animSpeed, 1, 4, 1, "×", function (value) { setLine({ animSpeed: value }); }, "animSpeed"),
        React.createElement("div", { className: "gs-cell gs-cell-wide", key: "image" },
          React.createElement("span", { className: "gs-label" }, "图片"),
          React.createElement("div", {
            className: dragOver ? "gs-cellgroup gs-dropzone gs-dropzone-on" : "gs-cellgroup gs-dropzone",
            onDragOver: function (event) { event.preventDefault(); if (!dragOver) setDragOver(true); },
            onDragLeave: function () { setDragOver(false); },
            onDrop: function (event) {
              event.preventDefault();
              setDragOver(false);
              var file = event.dataTransfer !== null && event.dataTransfer !== undefined && event.dataTransfer.files !== undefined
                ? event.dataTransfer.files[0]
                : null;
              if (file) loadImage(file);
            }
          },
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
              : React.createElement("span", { className: "gs-hint" }, "PNG / JPEG / GIF / WebP ≤300KB（也可直接把图片拖到这块里）")
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
      // 一键外观改成"小样卡网格"：每张卡直接把当前文案按该预设渲染出来，挑起来不用靠名字猜。
      React.createElement("div", { className: "gs-preset-grid", key: "presets" },
        STYLE_PRESETS.map(function (preset) {
          var style = Object.assign({}, PRESET_BASE, preset.style);
          var previewLine = Object.assign({}, line, style, { image: "", animation: "none" });
          var active = presetIsActive(preset);
          return React.createElement("button", {
            key: preset.id, type: "button",
            className: active ? "gs-preset-card gs-preset-card-on" : "gs-preset-card",
            title: "套用「" + preset.name + "」的外观（文案与图片不动）",
            onClick: function () { applyPreset(preset); }
          },
            React.createElement("span", { className: "gs-preset-card-head" },
              React.createElement("span", { className: "gs-preset-dot", style: { background: preset.dot } }),
              preset.name
            ),
            React.createElement("span", { className: "gs-preset-card-demo" }, lineRender(previewLine, "", "p-" + preset.id))
          );
        })
      ),
      React.createElement("div", { className: "gs-inline", key: "preset-actions" },
        React.createElement("button", {
          type: "button", className: presetBoth ? "gs-tab gs-tab-on" : "gs-tab",
          title: "开：一次改两行；关：只改当前标签页",
          onClick: function () { setPresetBoth(!presetBoth); }
        }, presetBoth ? "两行都套" : "只套本页"),
        React.createElement("button", {
          type: "button", className: "gs-btn",
          title: "把当前行的外观恢复成默认（文案与图片不动）",
          onClick: function () { applyPreset({ name: "默认外观", style: {} }); }
        }, "恢复默认外观"),
        React.createElement("span", { className: "gs-hint" }, "点卡片即套用；文案与图片不会被改")
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
          React.createElement("span", { className: "gs-swatches" },
            COLORS.filter(function (color) { return color !== ""; }).map(function (color) {
              return React.createElement("button", {
                key: "bg-" + color, type: "button", className: "gs-swatch gs-swatch-mini",
                style: { background: color }, title: "常用底色 " + color,
                onClick: function () { setLine({ bgColor: color, fill: "solid" }); }
              });
            })
          ),
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
          React.createElement("span", { className: "gs-swatches" },
            COLORS.filter(function (color) { return color !== ""; }).map(function (color) {
              return React.createElement("button", {
                key: "bd-" + color, type: "button", className: "gs-swatch gs-swatch-mini",
                style: { borderColor: color }, title: "常用边框色 " + color,
                onClick: function () { setLine({ borderColor: color, borderWidth: line.borderWidth > 0 ? line.borderWidth : 1 }); }
              });
            })
          ),
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
    section("场景（一键整包切换 · 工作 / 生活 / 深夜）", "scenes",
      React.createElement("div", { key: "scenes-body" },
        React.createElement("div", { className: "gs-hint" },
          "场景 = 保存那一刻的整份设置（文案、字体、外观、阈值、文案池）。点场景名＝立刻整包切过去；✎＝用当前设置覆盖它；✕＝删除。"),
        scenes.items.length === 0
          ? React.createElement("div", { className: "gs-hint" }, "还没有场景：给下面起个名字（如「工作」），点「存成场景」就行。")
          : React.createElement("div", { className: "gs-scene-list" },
              scenes.items.map(function (item) {
                return React.createElement("span", { className: "gs-scene-item", key: item.id },
                  React.createElement("button", {
                    type: "button", className: scenes.active === item.id ? "gs-btn gs-btn-on" : "gs-btn",
                    title: "切到「" + item.name + "」（整包替换当前设置）",
                    onClick: function () { applyScene(item); }
                  }, item.name),
                  React.createElement("button", {
                    type: "button", className: "gs-btn gs-scene-mini", title: "用当前设置覆盖「" + item.name + "」",
                    onClick: function () { overwriteScene(item); }
                  }, "✎"),
                  React.createElement("button", {
                    type: "button", className: "gs-btn gs-scene-mini", title: "删除「" + item.name + "」",
                    onClick: function () { deleteScene(item); }
                  }, "✕")
                );
              })
            ),
        React.createElement("div", { className: "gs-inline" },
          React.createElement("input", {
            className: "gs-input", style: { width: 168, flex: "none" }, value: sceneName,
            placeholder: "场景名，如 工作 / 生活 / 深夜",
            onChange: function (event) { setSceneName(event.target.value); }
          }),
          React.createElement("button", { type: "button", className: "gs-btn", onClick: saveScene }, "存成场景"),
          React.createElement("span", { className: "gs-hint" }, "最多 " + SCENES_MAX + " 个 · 当前 " + scenes.items.length + " 个")
        ),
        // 按工作区自动换文案：与场景同属"什么时候用哪套文案"，所以放在同一个分区里。
        React.createElement("div", { className: "gs-pool" },
          React.createElement("div", { className: "gs-inline gs-pool-head" },
            React.createElement("label", { className: "gs-inline" },
              React.createElement("input", {
                type: "checkbox", checked: wsCfg.enabled === true,
                onChange: function (event) { patchWs({ enabled: event.target.checked }); }
              }),
              React.createElement("span", { className: "gs-label" }, "按工作区自动换文案（切到哪个项目就用它的开场/收尾）")
            ),
            React.createElement("span", { className: "gs-hint" }, wsCfg.items.length + " 条")
          ),
          React.createElement("div", { className: "gs-hint" },
            "路径按目录前缀匹配（不区分大小写、斜杠随便写），多条命中取路径最长的那条。优先级：工作区绑定 > 文案池 > 固定文案。"),
          wsCfg.items.map(function (item, index) {
            return React.createElement("div", { className: "gs-ws-item", key: "ws-" + index },
              React.createElement("div", { className: "gs-inline" },
                React.createElement("input", {
                  className: "gs-input", style: { flex: "1 1 auto", minWidth: 120 }, value: item.path,
                  placeholder: "工作区路径，如 E:\\harness",
                  onChange: function (event) { patchWsItem(index, { path: event.target.value }); }
                }),
                React.createElement("button", {
                  type: "button", className: "gs-btn",
                  onClick: function () { patchWs({ items: wsCfg.items.filter(function (one, i) { return i !== index; }) }); }
                }, "删除")
              ),
              React.createElement("div", { className: "gs-inline" },
                React.createElement("input", {
                  className: "gs-input", style: { flex: "1 1 0", minWidth: 100 }, value: item.greeting,
                  placeholder: "这个项目的开场（留空则不分工作区）",
                  onChange: function (event) { patchWsItem(index, { greeting: event.target.value }); }
                }),
                React.createElement("input", {
                  className: "gs-input", style: { flex: "1 1 0", minWidth: 100 }, value: item.signOff,
                  placeholder: "这个项目的收尾（可留空）",
                  onChange: function (event) { patchWsItem(index, { signOff: event.target.value }); }
                })
              )
            );
          }),
          React.createElement("div", { className: "gs-inline" },
            React.createElement("button", {
              type: "button", className: "gs-btn",
              onClick: function () {
                if (wsCfg.items.length >= WORKSPACE_MAX) { setNotice("最多 " + WORKSPACE_MAX + " 条：先删一条再加"); return; }
                patchWs({ items: wsCfg.items.concat([{ path: "", greeting: "", signOff: "" }]) });
              }
            }, "+ 添加一条工作区"),
            React.createElement("button", {
              type: "button", className: "gs-btn", title: "从页面里找当前工作区路径填进去",
              onClick: fillCurrentWorkspace
            }, "填当前工作区")
          )
        )
      ),
      {
        defaultOpen: false,
        summary: scenes.items.length === 0
          ? "未设置"
          : (scenes.active === ""
              ? scenes.items.length + " 个 · 未标记当前"
              : "当前：" + ((scenes.items.filter(function (one) { return one.id === scenes.active; })[0] || {}).name || scenes.active))
      }
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
        React.createElement("span", { className: "gs-hint" }, "最多 " + LEGACY_LINES_MAX + " 条；空行会拦住保存，填上或删掉即可")
      ),
      {
        defaultOpen: false,
        summary: (draft.legacyLines || []).length === 0 ? "未设置" : (draft.legacyLines || []).length + " 条"
      }
    )
  ];

  // 进度条外观：纯前端偏好（存浏览器本地），选一下立即生效，不用保存、不用重启。
  // （ui 已在 body 构造前取好：外观 / 进度条分区的"精选 vs 全部"下拉都要用它。）
  body.push(section("进度条外观（立即生效，存浏览器本地）", "bar", grid("bar-grid", [
      selectCell("形态", [
        { value: "full", label: "完整（进度条 + 小车 + 百分比）" },
        { value: "compact", label: "紧凑细条（不显示百分比气泡）" },
        { value: "text", label: "只显示一行文字" }
      ], ui.display, function (value) { setUiPrefs({ display: value }); }, "display", true),
      selectCell("粗细", BAR_HEIGHTS.map(function (h) { return { value: h, label: h + "px" }; }), ui.barHeight,
        function (value) { setUiPrefs({ barHeight: Number(value) }); }, "barHeight"),
      // 「大小 + 朝向」合并成一项（v1.14.0）：朝向固定"车头向右"（天生朝左的车型自动镜像），
      // 多给一个"原样"开关只是多一格设置、多一个没意义的选择。
      selectCell("尺寸", MARKER_SCALES, ui.markerScale,
        function (value) { setUiPrefs({ markerScale: Number(value) }); }, "markerScale"),
      cell("配色", React.createElement("span", { className: "gs-cellgroup" },
        React.createElement("span", {
          className: "gs-scheme-bar",
          style: { background: "linear-gradient(90deg," + schemeOf(ui.scheme).colors[0] + "," + schemeOf(ui.scheme).colors[1] + "," + schemeOf(ui.scheme).colors[2] + ")" }
        }),
        React.createElement("select", {
          className: "gs-input gs-select", value: ui.scheme,
          title: "共 " + BAR_SCHEMES.length + " 套配色（默认只列常用 " + PRIME_SCHEMES.length + " 套；"
            + "展开或收回都在下拉末尾那一条，和动效、车型一个用法）",
          onChange: function (event) {
            var next = event.target.value;
            if (isMoreOptionValue(next)) { setUiPrefs({ advOptions: next === "__more__" }); return; }
            setUiPrefs({ scheme: next });
          }
        }, schemeOptions(ui.advOptions === true, ui.scheme))
      ), "scheme"),
      selectCell("时间显示", [
        { value: "on", label: "显示（已聊多久 + 实测速率）" },
        { value: "off", label: "不显示" }
      ], ui.showTime === false ? "off" : "on",
        function (value) { setUiPrefs({ showTime: value !== "off" }); }, "showTime", true),
      // 进度条口径：默认按"你自己的预算线"，而不是按 100 万的模型窗口（那个永远看着很安全）。
      selectCell("口径", [
        { value: "budget", label: "按你的预算线（推荐）" },
        { value: "window", label: "占模型窗口（旧口径）" }
      ], ui.meterMode === "window" ? "window" : "budget",
        function (value) { setUiPrefs({ meterMode: value === "window" ? "window" : "budget" }); }, "meterMode", true),
      // 预算模式（大任务模式）：一键切档，不用每次手改两个数字。
      cell("预算模式", React.createElement("span", { className: "gs-cellgroup" },
        BUDGET_MODES.map(function (item) {
          return React.createElement("button", {
            key: "mode-" + item.id, type: "button",
            className: ui.budgetMode === item.id ? "gs-mode-pill gs-mode-pill-on" : "gs-mode-pill",
            title: item.hint + (item.id === "custom" ? "" : "（全局默认档）"),
            onClick: function () { setUiPrefs({ budgetMode: item.id }); }
          }, item.label);
        })
      ), "budgetMode", true),
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "modeHint" },
        React.createElement("span", { className: "gs-hint" },
          "预算模式只决定两条线画在哪：日常 7.5 万/11 万、大任务 15 万/20 万、省着聊 5 万/7.5 万、自定义用下面手填的两个数。"
          + "进度条行里那个 🎯 小胶囊点一下就能给「本会话」临时换档（不动这里的默认档），横幅上的「切大任务」是同一个作用；"
          + "大任务干完开新会话，临时档自然作废、回到这里的默认档。")
      ),
      cell("黄线（自定义档）", React.createElement("span", { className: "gs-cellgroup" },
        numInput(ui.budgetWarn, 5000, 900000, 5000, function (value) { setUiPrefs({ budgetWarn: Math.round(value) }); }),
        React.createElement("span", { className: "gs-label gs-unit" }, "tok 提醒")
      ), "budgetWarn"),
      cell("红线（自定义档）", React.createElement("span", { className: "gs-cellgroup" },
        numInput(ui.budgetCritical, 10000, 999000, 5000, function (value) { setUiPrefs({ budgetCritical: Math.round(value) }); }),
        React.createElement("span", { className: "gs-label gs-unit" }, "tok 必须换")
      ), "budgetCritical"),
      // ── 计价口径（v1.19.0）：DSH 调价后不用等插件更新，改这三个数就行 ──────────
      cell("未命中输入", React.createElement("span", { className: "gs-cellgroup" },
        numInput(normalizePricing(ui.pricing).in, 0, 1000, 0.1, function (value) {
          setUiPrefs({ pricing: Object.assign({}, normalizePricing(ui.pricing), { in: value }) });
        }),
        React.createElement("span", { className: "gs-label gs-unit" }, "元/百万")
      ), "priceIn"),
      cell("缓存命中输入", React.createElement("span", { className: "gs-cellgroup" },
        numInput(normalizePricing(ui.pricing).cacheRead, 0, 1000, 0.01, function (value) {
          setUiPrefs({ pricing: Object.assign({}, normalizePricing(ui.pricing), { cacheRead: value }) });
        }),
        React.createElement("span", { className: "gs-label gs-unit" }, "元/百万")
      ), "priceCache"),
      cell("输出", React.createElement("span", { className: "gs-cellgroup" },
        numInput(normalizePricing(ui.pricing).out, 0, 1000, 0.5, function (value) {
          setUiPrefs({ pricing: Object.assign({}, normalizePricing(ui.pricing), { out: value }) });
        }),
        React.createElement("span", { className: "gs-label gs-unit" }, "元/百万")
      ), "priceOut"),
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "pricingHint" },
        React.createElement("span", { className: "gs-hint" },
          "计价口径：进度条上那个「≈¥」= 三个单价 × 对应的 token 用量（默认 1 / 0.02 / 4 元每百万，"
          + "是本机台账反推出来的）。DSH 若调价，改这里即可，不用等插件更新。当前："
          + (pricingIsDefault(ui.pricing) ? "内置默认" : "自定义") + "。"),
        React.createElement("button", {
          type: "button", className: "gs-btn",
          onClick: function () { setUiPrefs({ pricing: { in: PRICE_DEFAULT.in, cacheRead: PRICE_DEFAULT.cacheRead, out: PRICE_DEFAULT.out } }); }
        }, "恢复默认")
      ),
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "meterHint" },
        React.createElement("span", { className: "gs-hint" },
          "预算口径下 100% = 你当前档位的红线（默认「日常」：7.5 万 tok 变黄、11 万 tok 整条变红），条下弹红底大字「🚨 该开新会话了」，"
          + "浏览器标签页标题也会加 🚨 —— 不用盯着数字看。超了会显示「超 N 倍」。想回到以前那种「占模型窗口 24%」就切上面的口径。")
      ),
      // v1.19.0：按历史峰值给建议（只提示，必须点「采纳」才会真的改）。样本不足 5 条就整行不出现。
      (function () {
        var suggestion = suggestBudget(collectPeakSamples(), ui.budgetWarn, ui.budgetCritical);
        if (suggestion === null) return null;
        return React.createElement("div", { className: "gs-cell gs-cell-wide", key: "budgetSuggest" },
          React.createElement("span", { className: "gs-label" }, "建议档位"),
          React.createElement("span", { className: "gs-hint" },
            "💡 " + suggestion.reason + " → 建议黄线 " + formatWan(suggestion.warn) + " / 红线 " + formatWan(suggestion.critical) + "。"),
          React.createElement("button", {
            type: "button", className: "gs-btn",
            onClick: function () {
              setUiPrefs({ budgetWarn: suggestion.warn, budgetCritical: suggestion.critical, budgetMode: "custom" });
            }
          }, "采纳（切到自定义档）")
        );
      })(),
      // 小车：默认只列 7 个常见车型，其余收进「显示全部」（v1.14.0）。
      // v1.19.0：展开/收起文案与配色、动效统一（同一套 moreOption）。
      selectCell("小车", (function () {
        var all = BAR_MARKERS.map(function (item) {
          return { value: item.value === "" ? "__none__" : item.value, label: item.label === "" ? "无" : (item.label + " " + item.name) };
        });
        var current = ui.markerImage !== "" ? "__custom__" : (ui.marker === "" ? "__none__" : ui.marker);
        var prime = PRIME_MARKERS.map(function (one) { return one === "" ? "__none__" : one; });
        var list = pickOptions(all, prime, ui.advOptions === true, current);
        list = list.concat([moreOption(ui.advOptions === true, all.length, prime.length, "种")]);
        if (ui.markerImage !== "") list = list.concat([{ value: "__custom__", label: "自定义图片" }]);
        return list;
      })(), ui.markerImage !== "" ? "__custom__" : (ui.marker === "" ? "__none__" : ui.marker),
        function (value) {
          if (isMoreOptionValue(value)) { setUiPrefs({ advOptions: value === "__more__" }); return; }
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
  // 花费与上下文（v1.14.0）：把"钱花在哪、上下文被谁撑大"摆到设置页，跨会话台账也在这。
  // 数据全部读本机文件（usage-ledger.json），不联网；宿主半是旧版就整段显示成"读不到"。
  var costHint = costInfo === null || costInfo === undefined
    ? "还没读到台账（宿主半是旧版时这里会一直空着，不影响进度条）"
    : "今天 ≈" + formatCny(costInfo.today !== null && costInfo.today !== undefined ? costInfo.today.costCNY : 0)
      + " · 近 " + String(costInfo.week !== null && costInfo.week !== undefined && typeof costInfo.week.days === "number" ? costInfo.week.days : 7) + " 天 ≈"
      + formatCny(costInfo.week !== null && costInfo.week !== undefined ? costInfo.week.costCNY : 0)
      + " · 单价：未命中 ¥" + String(normalizePricing(ui.pricing).in) + "/M、缓存命中 ¥" + String(normalizePricing(ui.pricing).cacheRead) + "/M、输出 ¥" + String(normalizePricing(ui.pricing).out) + "/M"
      + (pricingIsDefault(ui.pricing) ? "（内置默认）" : "（自定义，可在上面「计价口径」里改）") + "。"
      + "留意输出价是缓存读的 200 倍 —— 少让我啰嗦，比省那点上下文更省钱。";
  var topList = costInfo !== null && costInfo !== undefined && Array.isArray(costInfo.top) ? costInfo.top : [];
  var topHint = topList.length === 0 ? ""
    : topList.map(function (item, index) {
        var name = typeof item.title === "string" && item.title.length > 0 ? item.title : String(item.sessionId === undefined ? "" : item.sessionId).slice(0, 8);
        return (index + 1) + ") " + name + " " + formatCny(item.costCNY);
      }).join(" · ");
  body.push(section("花费与上下文（读本机台账，不联网）", "cost", grid("cost-grid", [
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "costSum" },
        React.createElement("span", { className: "gs-label" }, "花了多少"),
        React.createElement("span", { className: "gs-hint" }, costHint)
      ),
      topHint === "" ? null : React.createElement("div", { className: "gs-cell gs-cell-wide", key: "costTop" },
        React.createElement("span", { className: "gs-label" }, "最贵会话"),
        React.createElement("span", { className: "gs-hint" }, topHint)
      ),
      // v1.19.0：与台账对账 —— 单价若已过时（DSH 调价），这里会明显对不上，提醒去改计价口径。
      (costInfo === null || costInfo === undefined || costInfo.reconcile === null || costInfo.reconcile === undefined
        ? null
        : React.createElement("div", { className: "gs-cell gs-cell-wide", key: "costReconcile" },
            React.createElement("span", { className: "gs-label" }, "与台账对账"),
            React.createElement("span", {
              className: costInfo.reconcile.gapRatio > 0.2 ? "gs-hint gs-dock-note-warn" : "gs-hint"
            },
              "本次算得 " + formatCny(costInfo.reconcile.computedCNY)
              + " · 台账 " + formatCny(costInfo.reconcile.ledgerCostCNY)
              + " · 差 " + String(Math.round((costInfo.reconcile.gapRatio || 0) * 1000) / 10) + "%"
              + (costInfo.reconcile.gapRatio > 0.2
                ? "（差得偏多：DSH 可能调过价，改上面「计价口径」即可）"
                : "（差值是投影扫描与台账聚合的口径差异，正常）"))
          )),
      selectCell("显示花费", [
        { value: "on", label: "进度条那行写 ≈¥…" },
        { value: "off", label: "不显示" }
      ], ui.showCost === false ? "off" : "on",
        function (value) { setUiPrefs({ showCost: value !== "off" }); }, "showCost"),
      selectCell("上下文明细", [
        { value: "off", label: "默认收起（推荐）" },
        { value: "on", label: "默认展开" }
      ], ui.showParts === true ? "on" : "off",
        function (value) { setUiPrefs({ showParts: value === "on" }); }, "showParts"),
      selectCell("档位建议", [
        { value: "on", label: "该抬线/该降档时提一句" },
        { value: "off", label: "不提示" }
      ], ui.autoSuggest === false ? "off" : "on",
        function (value) { setUiPrefs({ autoSuggest: value !== "off" }); }, "autoSuggest", true),
      selectCell("系统通知", [
        { value: "off", label: "不通知" },
        { value: "on", label: "到线时发浏览器通知" }
      ], ui.notifyOnLine === true ? "on" : "off",
        function (value) {
          if (value !== "on") { setUiPrefs({ notifyOnLine: false }); return; }
          // 要浏览器授权才发得出去：先问权限，拿到才把开关打开（拿不到就如实说明，不留一个假开关）。
          try {
            if (typeof window.Notification !== "function") { setNotice("这个浏览器不支持系统通知"); return; }
            if (window.Notification.permission === "granted") { setUiPrefs({ notifyOnLine: true }); return; }
            window.Notification.requestPermission().then(function (result) {
              setUiPrefs({ notifyOnLine: result === "granted" });
              if (result !== "granted") setNotice("浏览器没给通知权限，系统通知没打开");
            });
            return;
          } catch (error) {
            setNotice("申请通知权限失败：" + String(error !== null && error !== undefined && error.message ? error.message : error));
          }
        }, "notifyOnLine", true),
      selectCell("选项范围", [
        { value: "prime", label: "精选（推荐）" },
        { value: "all", label: "全部（动效 / 配色 / 车型）" }
      ], ui.advOptions === true ? "all" : "prime",
        function (value) { setUiPrefs({ advOptions: value === "all" }); }, "advOptions", true),
      React.createElement("div", { className: "gs-cell gs-cell-wide", key: "diagToggle" },
        React.createElement("span", { className: "gs-label" }, "诊断"),
        React.createElement("button", {
          type: "button", className: "gs-btn",
          onClick: function () { setUiPrefs({ showDiag: ui.showDiag !== true }); }
        }, ui.showDiag === true ? "隐藏诊断分区" : "显示诊断分区（排障用）")
      )
    ]), {
      defaultOpen: false,
      summary: costInfo === null || costInfo === undefined
        ? "读不到台账"
        : "今日 ≈" + formatCny(costInfo.today !== null && costInfo.today !== undefined ? costInfo.today.costCNY : 0)
    }));
  if (error !== "") body.push(React.createElement("div", { className: "gs-hint gs-hint-error", key: "error", role: "alert" }, error));
  else if (invalid !== null) body.push(React.createElement("div", { className: "gs-hint gs-hint-error", key: "invalid", role: "alert" }, "还差一步：" + invalid));
  if (notice !== "") body.push(React.createElement("div", { className: "gs-hint", key: "notice" }, notice));
  // 诊断：自查用（样式没贴上时看"命中行数/跳过非助手"）。
  // v1.14.0 起默认**不显示**——它对日常使用是纯噪音，只在主动打开时出现：
  // 底部那行「显示诊断分区」小字，或者 localStorage 里把 gs.signoff.ui.showDiag 设为 true。
  if (ui.showDiag === true) body.push(section("诊断（样式没生效时先看这里）", "diag",
    React.createElement("div", { className: "gs-diag" },
      React.createElement("div", null, "插件版本：v" + CLIENT_VERSION + "（浏览器半）"),
      React.createElement("div", null, "配置文件：" + (store.path || "（未知，宿主半可能没加载）")),
      React.createElement("div", null, "配置来源：" + (state.error ? "读取失败 · " + state.error : store.loaded ? "已读取" : "尚未读取")),
      React.createElement("div", null, "贴样式器：运行 " + stylerStats.runs + " 次 · 上次耗时 " + stylerStats.lastMs + "ms"),
      React.createElement("div", null, "上次扫描：命中 " + stylerStats.matched + " 行 / 重扫 " + stylerStats.scanned + " 块 / 共 " + stylerStats.blocks + " 块 · 跳过非助手 " + stylerStats.skippedNonAssistant + " 块"),
      React.createElement("div", null, "匹配模式：" + matchModeLabel(state.config.matchMode) + " · 贴样式范围：" + (state.config.onlyAssistant === false ? "整段对话" : "只贴我的回复") + " · 旧文案 " + (state.config.legacyLines || []).length + " 条"),
      React.createElement("div", null, "当前标签页命中：" + (typeof document !== "undefined" ? document.querySelectorAll(".gs-chat-line").length : 0) + " 行（整页）"),
      React.createElement("div", null, "宿主导航条读数：" + (typeof document !== "undefined" && document.querySelector(".gs-dock-bar") ? (document.querySelector(".gs-dock-bar").getAttribute("aria-valuenow") || "未知") : "未挂载")),
      React.createElement("div", null, "连接自愈：检查 " + healStats.checks + " 次 · 看到异常 " + healStats.stuck + " 次 · 已自动重载 " + healStats.reloads + " 次（" + (healStats.lastWhy || "暂无动作") + "）"),
      React.createElement("div", { className: "gs-selfcheck" },
        React.createElement("button", {
          type: "button", className: "gs-btn",
          disabled: selfCheck !== null && selfCheck.running === true,
          onClick: function () { runSelfCheck(); }
        }, selfCheck !== null && selfCheck.running === true ? "自检中…" : "跑一遍自检"),
        React.createElement("span", { className: "gs-hint" }, "一次问到底：配置、文案、贴样式、进度条、连接自愈、宿主半版本与上一轮统计"),
        selfCheck === null ? null : React.createElement("div", {
          className: selfCheck.ok === true ? "gs-selfcheck-lines gs-selfcheck-ok" : "gs-selfcheck-lines"
        }, (selfCheck.lines || []).map(function (line, index) {
          return React.createElement("div", { key: "sc-" + index }, line);
        }))
      )
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
      disabled: revertConfig === null,
      title: revertConfig === null ? "还没保存过，没得撤销" : "回到上一次保存之前的那份配置",
      onClick: function () {
        if (revertConfig === null) return;
        var back = revertConfig;
        setRevertConfig(null);
        commit(back, false);
        setNotice("已撤销上一次保存");
      }
    }, "撤销上次保存"),
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

/* ─── 进度条的时间维度：已聊多久 / 还能聊多久（都要真实数字，不做摆设） ──── */

/** 时间行多久走一次（毫秒）。5 秒够"看得见在动"，又不至于让进度条组件每秒重渲染。 */
var TIME_TICK_MS = 5000;
/** 会话开始时间的缓存时长：宿主半的答案一分钟问一次就够了。 */
var SESSION_TTL_MS = 60000;
/** 采样窗口：只拿最近这段时间的读数算消耗速率（更早的节奏不代表现在）。 */
var SAMPLE_WINDOW_MS = 45 * 60000;
/** 采样点上限（5 秒一个点，45 分钟约 540 个，留点余量）。 */
var SAMPLE_LIMIT = 600;

/**
 * 毫秒 → 「45 秒 / 12 分 / 1 小时 3 分 / 2 小时」。
 * @param {number} ms 时长。
 * @returns {string} 给人看的时长；数字无效时给 "—"。
 */
function formatDuration(ms) {
  if (typeof ms !== "number" || !isFinite(ms) || ms < 0) return "—";
  var sec = Math.round(ms / 1000);
  if (sec < 60) return sec + " 秒";
  var min = Math.round(sec / 60);
  if (min < 60) return min + " 分";
  var hours = Math.floor(min / 60);
  var rest = min % 60;
  return rest === 0 ? hours + " 小时" : hours + " 小时 " + rest + " 分";
}

/**
 * 时间戳 → 本地 "HH:MM"。
 * @param {number} ms Unix 毫秒。
 * @returns {string} 时刻；无效时给空串。
 */
function formatClock(ms) {
  if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return "";
  var date = new Date(ms);
  var pad = function (value) { return (value < 10 ? "0" : "") + value; };
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

/**
 * 用采样点算"每分钟烧掉多少 token"。
 * 采样点形如 `{t, used}`，按时间升序；跨度不足 minSpanMs、或读数没有净增长时返回 null
 * （宁可不给估计，也不要给一个假数字）。
 * v1.18.0：minSpanMs 可调（默认 60 秒）。进度条上放宽到 20 秒 —— 聊得快的会话两轮之间
 * 常常不到一分钟，卡 60 秒会让"实测速率"一直显示 "—"（发哥反馈过这个）。
 * @param {Array} samples 采样点。
 * @param {number} [minSpanMs] 最小时间跨度（毫秒），缺省 60000。
 * @returns {number|null} token/分钟。
 */
function tokensPerMinute(samples, minSpanMs) {
  if (!Array.isArray(samples) || samples.length < 2) return null;
  var floor = typeof minSpanMs === "number" && isFinite(minSpanMs) && minSpanMs > 0 ? minSpanMs : 60000;
  var first = samples[0];
  var last = samples[samples.length - 1];
  if (first === null || last === null || typeof first.t !== "number" || typeof last.t !== "number") return null;
  var spanMs = last.t - first.t;
  if (!(spanMs >= floor)) return null;
  var delta = Number(last.used) - Number(first.used);
  if (!(delta > 0)) return null;
  return delta / (spanMs / 60000);
}

/** 速率的最小时间跨度（进度条用）：20 秒。 */
var RATE_MIN_SPAN_MS = 20000;

/**
 * 时间轴采样不够时（刚刷新页面 / 才聊了不到 20 秒）的退路：拿"最近两次轮次跃升"直接算斜率。
 * 跃升点和增量都是真发生过的数，比不给强；但只认跨度 ≥ minSpanMs 的那一对，避免噪声。
 * @param {Array<number>} jumpTimes 每次跃升的时刻（升序）。
 * @param {Array<number>} jumps 每次跃升的 token 增量（与 jumpTimes 尾部对齐）。
 * @param {number} [minSpanMs] 最小跨度，缺省 20000。
 * @returns {number|null} token/分钟。
 */
function rateFromJumps(jumpTimes, jumps, minSpanMs) {
  if (!Array.isArray(jumpTimes) || !Array.isArray(jumps)) return null;
  if (jumpTimes.length < 2 || jumps.length < 2) return null;
  var floor = typeof minSpanMs === "number" && isFinite(minSpanMs) && minSpanMs > 0 ? minSpanMs : RATE_MIN_SPAN_MS;
  var lastT = jumpTimes[jumpTimes.length - 1];
  var prevT = jumpTimes[jumpTimes.length - 2];
  var lastJump = jumps[jumps.length - 1];
  if (typeof lastT !== "number" || typeof prevT !== "number" || !isFinite(lastT) || !isFinite(prevT)) return null;
  var spanMs = lastT - prevT;
  if (!(spanMs >= floor)) return null;
  var delta = Number(lastJump);
  if (!(delta > 0)) return null;
  return delta / (spanMs / 60000);
}

/**
 * 估算"还能聊多久"：优先用实测速率（token/分钟），退回到"每轮均值 × 已观测的每轮间隔"。
 * @param {number} remainingTokens 剩余 token。
 * @param {number|null} ratePerMinute 实测速率。
 * @param {number|null} turnsLeft 估算还能聊几轮。
 * @param {number|null} msPerTurn 实测每轮耗时。
 * @returns {number|null} 毫秒；数据都不够时返回 null。
 */
function remainingTimeMs(remainingTokens, ratePerMinute, turnsLeft, msPerTurn) {
  if (typeof remainingTokens !== "number" || !isFinite(remainingTokens)) return null;
  if (remainingTokens <= 0) return 0;
  if (typeof ratePerMinute === "number" && isFinite(ratePerMinute) && ratePerMinute > 0) {
    return remainingTokens / ratePerMinute * 60000;
  }
  if (typeof turnsLeft === "number" && turnsLeft > 0 && typeof msPerTurn === "number" && isFinite(msPerTurn) && msPerTurn > 0) {
    return turnsLeft * msPerTurn;
  }
  return null;
}

/**
 * 轮数数组 → 平均每轮耗时（毫秒）；间隔样本少于 2 个时返回 null。
 * @param {Array} times 每轮读数跳变的时刻（升序）。
 * @returns {number|null} 平均间隔。
 */
function averageTurnMs(times) {
  if (!Array.isArray(times) || times.length < 3) return null;
  var sum = 0;
  var count = 0;
  for (var i = 1; i < times.length; i += 1) {
    var gap = times[i] - times[i - 1];
    if (gap > 0 && gap < 6 * 3600000) { sum += gap; count += 1; }
  }
  if (count === 0) return null;
  return sum / count;
}

/** 「上一轮 ↑X.X 万」的警示线：单轮涨这么多 tok 就标红。 */
var RISE_WARN_TOKENS = 50000;

/**
 * 上一轮涨了多少（纯函数）：取账本里最近一次跃升的幅度（每次跃升=一轮回复吃掉的 token）。
 * 账本不足两次跃升（第一次只是建立基线）或数值脏时返回 null，宁可不出数也不给假数字。
 * @param {Object} sampler 采样账本。
 * @returns {number|null} tok 数。
 */
function lastJumpRise(sampler) {
  if (sampler === null || sampler === undefined || typeof sampler !== "object") return null;
  var jumps = Array.isArray(sampler.jumps) ? sampler.jumps : [];
  if (jumps.length < 2) return null;
  var last = jumps[jumps.length - 1];
  var prev = jumps[jumps.length - 2];
  if (typeof last !== "number" || !isFinite(last) || last <= 0) return null;
  if (typeof prev !== "number" || !isFinite(prev) || prev <= 0) return null;
  return last;
}

/* ─── 会话开始时间：宿主半给（浏览器半看不到 session.header.createdAt） ──── */

var SESSION_API = API + "/session";
// v1.14.0：花费与上下文明细两个只读接口（宿主半读本机台账/projcache，不联网）。
var CONTEXT_API = API + "/context";
var COST_API = API + "/cost";
/** 会话信息缓存：同一会话一分钟内不重复问。 */
var sessionInfoCache = { key: "", at: 0, data: null };
/** 明细/花费的缓存（v1.14.0）：这两样都来自磁盘文件，没必要每次重渲染都去问一遍。 */
var contextCache = { key: "", at: 0, data: null };
var costCache = { key: "", at: 0, data: null };
var CONTEXT_TTL_MS = 45000;
var COST_TTL_MS = 60000;
/** 拿不到宿主半答案时的本地兜底（按会话 id 记"第一次见到它的时刻"，刷新页面不丢）。 */
var SESSION_START_KEY = "gs.signoff.starts";

/** 本地兜底：读出/记下某个会话"第一次被这个浏览器看到的时刻"。 */
function localSessionStart(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  var map = {};
  try {
    var raw = window.localStorage.getItem(SESSION_START_KEY);
    var parsed = raw === null ? null : JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") map = parsed;
  } catch (error) { map = {}; }
  var hit = map[sessionId];
  if (typeof hit === "number" && isFinite(hit) && hit > 0) return hit;
  var now = Date.now();
  map[sessionId] = now;
  // 只留最近的 20 个会话，别把 localStorage 撑大
  var keys = Object.keys(map);
  if (keys.length > 20) {
    keys.sort(function (a, b) { return (map[b] || 0) - (map[a] || 0); });
    for (var i = 20; i < keys.length; i += 1) delete map[keys[i]];
  }
  try { window.localStorage.setItem(SESSION_START_KEY, JSON.stringify(map)); } catch (error) { /* 隐私模式：忽略 */ }
  return now;
}

/* ─── 活跃时长（v1.18.0）：只统计"这个会话真正在聊的时间" ────────────────────
 * 为什么不再直接拿 session.header.createdAt 去减：
 *   ① 那是"会话文件的创建时间"：隔天接着聊同一条会话时，中间十几个小时的断档也会被算进去；
 *   ② 宿主半在不知道"你看的是哪条会话"时会退回它自己记的上一个会话，于是把**上一次**的
 *      创建时间给过来 —— 直接信它，新会话就会顶着上次的已聊时长（发哥 2026-09-20 报的问题）。
 * 所以改成按会话 id 各自记账（绝不跨会话），两次心跳间隔超过 idleMaxMs 就当断档、不累加。
 */
var ACTIVE_KEY_PREFIX = "gs.signoff.active.";
/** 断档阈值：心跳间隔超过这个数就不算"一直在聊"。 */
var ACTIVE_IDLE_MAX_MS = 5 * 60000;
/** 新会话判定：创建时间距今不超过这个数，才敢把"创建到现在"当作已聊时长。 */
var ACTIVE_FRESH_MAX_MS = 30 * 60000;

/**
 * 记账一步：把"从上次心跳到现在"的这段时间累进本会话的活跃时长（纯函数，便于单测）。
 * 首次见到某个会话时，只有"刚创建不久"的会话才用它创建到现在的时间做起点；
 * 恢复的旧会话（创建于很久以前）从 0 起算 —— 宁可少算，也不把几小时的断档吞进来。
 * @param {{totalMs:number,lastAt:number}|null} prev 上一次的记账（lastAt=0 表示首次见到）。
 * @param {number} now 现在（Unix 毫秒）。
 * @param {number|null} createdAt 宿主半给的会话创建时间；不确定是当前会话时传 null。
 * @param {{idleMaxMs?:number,freshMaxMs?:number}} [opts] 阈值覆盖（测试用）。
 * @returns {{totalMs:number,lastAt:number}} 新的记账。
 */
function activeElapsed(prev, now, createdAt, opts) {
  var o = opts === undefined || opts === null ? {} : opts;
  var idleMax = typeof o.idleMaxMs === "number" && isFinite(o.idleMaxMs) && o.idleMaxMs > 0 ? o.idleMaxMs : ACTIVE_IDLE_MAX_MS;
  var freshMax = typeof o.freshMaxMs === "number" && isFinite(o.freshMaxMs) && o.freshMaxMs > 0 ? o.freshMaxMs : ACTIVE_FRESH_MAX_MS;
  var total = prev !== null && prev !== undefined && typeof prev.totalMs === "number" && isFinite(prev.totalMs) && prev.totalMs > 0
    ? prev.totalMs : 0;
  var lastAt = prev !== null && prev !== undefined && typeof prev.lastAt === "number" && isFinite(prev.lastAt) && prev.lastAt > 0
    ? prev.lastAt : 0;
  if (typeof now !== "number" || !isFinite(now) || now <= 0) return { totalMs: total, lastAt: lastAt };
  if (lastAt > 0) {
    var gap = now - lastAt;
    if (gap > 0 && gap <= idleMax) total += gap;
    return { totalMs: total, lastAt: now };
  }
  var created = typeof createdAt === "number" && isFinite(createdAt) && createdAt > 0 ? createdAt : 0;
  if (created > 0 && now > created && now - created <= freshMax) total = now - created;
  return { totalMs: total, lastAt: now };
}

/**
 * 读某个会话的活跃记账（按会话 id 分开存，互不串档）。
 * @param {string} sessionId 会话 id。
 * @returns {{totalMs:number,lastAt:number}|null} 没记过返回 null。
 */
function readActiveRecord(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  try {
    var raw = window.localStorage.getItem(ACTIVE_KEY_PREFIX + sessionId);
    if (raw === null) return null;
    var parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;
    var totalMs = typeof parsed.totalMs === "number" && isFinite(parsed.totalMs) && parsed.totalMs > 0 ? parsed.totalMs : 0;
    var lastAt = typeof parsed.lastAt === "number" && isFinite(parsed.lastAt) && parsed.lastAt > 0 ? parsed.lastAt : 0;
    if (totalMs === 0 && lastAt === 0) return null;
    return { totalMs: totalMs, lastAt: lastAt };
  } catch (error) { return null; }
}

/**
 * 写某个会话的活跃记账。
 * @param {string} sessionId 会话 id。
 * @param {number} totalMs 累计活跃毫秒。
 * @param {number} lastAt 上次心跳时刻。
 * @returns {void}
 */
function writeActiveRecord(sessionId, totalMs, lastAt) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return;
  var total = typeof totalMs === "number" && isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0;
  var last = typeof lastAt === "number" && isFinite(lastAt) && lastAt > 0 ? Math.round(lastAt) : 0;
  if (total === 0 && last === 0) return;
  try { window.localStorage.setItem(ACTIVE_KEY_PREFIX + sessionId, JSON.stringify({ totalMs: total, lastAt: last })); } catch (error) { /* 隐私模式：忽略 */ }
}

/* v1.19.0 多标签账本互斥：一个会话开两个标签时只让一个标签写账本（否则时长/采样翻倍）。
   抢锁主逻辑是 localStorage（gs.signoff.lock.<id> = { tabId, at }），BroadcastChannel 只做辅助同步。 */
var LOCK_KEY_PREFIX = "gs.signoff.lock.";
/** 锁有效期：超过就当上一个标签没了，别的标签可以接手。 */
var LOCK_TTL_MS = 12000;

/** 生成标签 id（每标签一次，刷新换新的）。 */
function randomTabId() {
  var rand = "";
  try { rand = Math.random().toString(36).slice(2, 10); } catch (error) { rand = ""; }
  return "tab-" + Date.now().toString(36) + "-" + rand;
}
var MY_TAB_ID = randomTabId();
/** 别的标签广播过来的锁（比 localStorage 里的新就用它）。 */
var peerLocks = {};
var lockChannel = null;
var lockChannelTried = false;

/** 惰性建 BroadcastChannel（浏览器不支持就当没有，不影响功能）。 */
function lockChannelOf() {
  if (lockChannelTried) return lockChannel;
  lockChannelTried = true;
  try {
    if (typeof BroadcastChannel === "function") {
      lockChannel = new BroadcastChannel("gs.signoff.lock");
      lockChannel.onmessage = function (event) {
        var data = event === null || event === undefined ? null : event.data;
        if (data === null || typeof data !== "object" || data.type !== "lock") return;
        if (typeof data.sessionId !== "string" || data.sessionId.length === 0) return;
        if (typeof data.tabId !== "string" || data.tabId.length === 0) return;
        var at = typeof data.at === "number" && isFinite(data.at) ? data.at : 0;
        var seen = peerLocks[data.sessionId];
        if (seen === undefined || at >= seen.at) peerLocks[data.sessionId] = { tabId: data.tabId, at: at };
      };
    }
  } catch (error) { lockChannel = null; }
  return lockChannel;
}

/**
 * 谁该记账（纯函数）：锁为空 / 过期（now - lockAt >= 12000）/ 锁是自己 → "self"；别人且未过期 → "other"。
 * 脏时间戳一律当"没锁"（自己上，功能不瘫）。
 * @param {string} myTabId 本标签 id。
 * @param {string} lockTabId 锁里的标签 id（空串=没锁）。
 * @param {number} lockAt 锁写入时刻。
 * @param {number} now 现在。
 * @returns {string} "self" | "other"。
 */
function pickLeader(myTabId, lockTabId, lockAt, now) {
  if (typeof myTabId !== "string" || myTabId.length === 0) return "self";
  if (typeof lockTabId !== "string" || lockTabId.length === 0) return "self";
  if (lockTabId === myTabId) return "self";
  if (typeof lockAt !== "number" || !isFinite(lockAt) || lockAt <= 0) return "self";
  if (typeof now !== "number" || !isFinite(now) || now <= 0) return "self";
  return now - lockAt >= LOCK_TTL_MS ? "self" : "other";
}

/** 读锁：localStorage 为主，广播过来的更近期就用它。 */
function readTabLock(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  var stored = null;
  try {
    var raw = window.localStorage.getItem(LOCK_KEY_PREFIX + sessionId);
    var parsed = raw === null ? null : JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && typeof parsed.tabId === "string" && parsed.tabId.length > 0) {
      stored = { tabId: parsed.tabId, at: typeof parsed.at === "number" && isFinite(parsed.at) ? parsed.at : 0 };
    }
  } catch (error) { stored = null; }
  var peer = peerLocks[sessionId];
  if (peer !== undefined && peer !== null && (stored === null || peer.at > stored.at)) return { tabId: peer.tabId, at: peer.at };
  return stored;
}

/** 心跳开始时的"谁记账"：抢到就写锁 + 广播并返回 true；没抢到返回 false（只读显示，不写账本）。 */
function heartbeatIsLeader(sessionId, now) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return true;
  var stamp = typeof now === "number" && isFinite(now) && now > 0 ? now : Date.now();
  var lock = readTabLock(sessionId);
  if (pickLeader(MY_TAB_ID, lock === null ? "" : lock.tabId, lock === null ? 0 : lock.at, stamp) !== "self") return false;
  try { window.localStorage.setItem(LOCK_KEY_PREFIX + sessionId, JSON.stringify({ tabId: MY_TAB_ID, at: stamp })); } catch (error) { /* 隐私模式 */ }
  var channel = lockChannelOf();
  if (channel !== null && typeof channel.postMessage === "function") {
    try { channel.postMessage({ type: "lock", sessionId: sessionId, tabId: MY_TAB_ID, at: stamp }); } catch (error) { /* 通道坏了 */ }
  }
  return true;
}

/* ─── 读数采样账本（v1.18.0）：按会话 id 存，刷新页面不清零 ──────────────────
 * 以前 samples/jumps 只活在内存里，刷新一次就归零 → "实测速率"和"到线约还有"要重新等
 * 一轮读数才出现，看着就像功能坏了。现在按会话 id 落盘（互不串档），刷新后立刻能算。
 */
var SAMPLER_KEY_PREFIX = "gs.signoff.sampler.";

/** 一个空的采样账本。 */
function emptySampler() {
  return { last: null, jumps: [], samples: [], jumpTimes: [], lastUsedAt: 0, savedAt: 0 };
}

/**
 * 读某个会话的采样账本；坏数据一律丢掉当空账本（宁可没有，也不要 NaN 数字）。
 * @param {string} sessionId 会话 id。
 * @returns {Object} 采样账本。
 */
function readSamplerRecord(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return emptySampler();
  var parsed = null;
  try {
    var raw = window.localStorage.getItem(SAMPLER_KEY_PREFIX + sessionId);
    parsed = raw === null ? null : JSON.parse(raw);
  } catch (error) { return emptySampler(); }
  if (parsed === null || typeof parsed !== "object") return emptySampler();
  var base = emptySampler();
  if (Array.isArray(parsed.samples)) {
    for (var i = 0; i < parsed.samples.length; i += 1) {
      var point = parsed.samples[i];
      if (point !== null && typeof point === "object" && typeof point.t === "number" && isFinite(point.t)
        && typeof point.used === "number" && isFinite(point.used)) base.samples.push({ t: point.t, used: point.used });
    }
    if (base.samples.length > SAMPLE_LIMIT) base.samples = base.samples.slice(-SAMPLE_LIMIT);
  }
  if (Array.isArray(parsed.jumps)) {
    for (var j = 0; j < parsed.jumps.length; j += 1) {
      if (typeof parsed.jumps[j] === "number" && isFinite(parsed.jumps[j]) && parsed.jumps[j] > 0) base.jumps.push(parsed.jumps[j]);
    }
    if (base.jumps.length > 6) base.jumps = base.jumps.slice(-6);
  }
  if (Array.isArray(parsed.jumpTimes)) {
    for (var k = 0; k < parsed.jumpTimes.length; k += 1) {
      if (typeof parsed.jumpTimes[k] === "number" && isFinite(parsed.jumpTimes[k]) && parsed.jumpTimes[k] > 0) base.jumpTimes.push(parsed.jumpTimes[k]);
    }
    if (base.jumpTimes.length > 12) base.jumpTimes = base.jumpTimes.slice(-12);
  }
  if (typeof parsed.last === "number" && isFinite(parsed.last) && parsed.last >= 0) base.last = parsed.last;
  if (typeof parsed.lastUsedAt === "number" && isFinite(parsed.lastUsedAt) && parsed.lastUsedAt > 0) base.lastUsedAt = parsed.lastUsedAt;
  return base;
}

/**
 * 写某个会话的采样账本。
 * @param {string} sessionId 会话 id。
 * @param {Object} sampler 账本。
 * @returns {void}
 */
function writeSamplerRecord(sessionId, sampler) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return;
  if (sampler === null || sampler === undefined || typeof sampler !== "object") return;
  try {
    window.localStorage.setItem(SAMPLER_KEY_PREFIX + sessionId, JSON.stringify({
      last: typeof sampler.last === "number" && isFinite(sampler.last) ? sampler.last : null,
      jumps: Array.isArray(sampler.jumps) ? sampler.jumps.slice(-6) : [],
      samples: Array.isArray(sampler.samples) ? sampler.samples.slice(-SAMPLE_LIMIT) : [],
      jumpTimes: Array.isArray(sampler.jumpTimes) ? sampler.jumpTimes.slice(-12) : [],
      lastUsedAt: typeof sampler.lastUsedAt === "number" && isFinite(sampler.lastUsedAt) ? sampler.lastUsedAt : 0
    }));
  } catch (error) { /* 隐私模式 / 配额满：忽略，功能照常但刷新后会归零 */ }
}

/**
 * 收集"最近若干次会话的上下文峰值"（v1.19.0）：给「该把黄线/红线设到哪」提供依据。
 * 数据直接来自各会话已有的采样账本（gs.signoff.sampler.<id>），**不新增任何存储**。
 * @returns {Array<{sessionId:string, tokens:number, at:number}>} 按峰值降序、最多 30 条。
 */
function collectPeakSamples() {
  var out = [];
  try {
    var total = window.localStorage.length;
    for (var i = 0; i < total; i += 1) {
      var key = window.localStorage.key(i);
      if (key === null || key.indexOf(SAMPLER_KEY_PREFIX) !== 0) continue;
      var id = key.slice(SAMPLER_KEY_PREFIX.length);
      var record = readSamplerRecord(id);
      var peak = 0;
      for (var j = 0; j < record.samples.length; j += 1) {
        if (record.samples[j].used > peak) peak = record.samples[j].used;
      }
      if (peak > 0) out.push({ sessionId: id, tokens: peak, at: record.lastUsedAt });
    }
  } catch (error) { return []; }
  out.sort(function (a, b) { return b.tokens - a.tokens; });
  return out.slice(0, 30);
}

/** 取 90 分位（排序后按 Math.ceil(n*0.9)-1 取；样本很少时自然退化成最大值）。 */
function percentile90(list) {
  var values = [];
  for (var i = 0; i < list.length; i += 1) {
    if (typeof list[i] === "number" && isFinite(list[i]) && list[i] > 0) values.push(list[i]);
  }
  if (values.length === 0) return 0;
  values.sort(function (a, b) { return a - b; });
  return values[Math.min(values.length - 1, Math.ceil(values.length * 0.9) - 1)];
}

/** 取整到 step 的倍数，并夹在 [min, max]（非数字一律回落到 min）。 */
function roundToStep(value, step, min, max) {
  var rounded = Math.round(value / step) * step;
  if (!isFinite(rounded)) return min;
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

/**
 * 按历史峰值建议预算档位（v1.19.0）。**只给建议，绝不自动改用户的设置**。
 * 样本不足 5 条时返回 null —— 宁可不说，也不拿两三条记录去猜。
 * @param {Array} peaks collectPeakSamples() 的结果。
 * @param {number} warn 当前黄线。
 * @param {number} critical 当前红线。
 * @returns {Object|null} { warn, critical, sampleCount, reason }。
 */
function suggestBudget(peaks, warn, critical) {
  var list = Array.isArray(peaks) ? peaks : [];
  var tokens = [];
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] !== null && typeof list[i] === "object" && typeof list[i].tokens === "number"
      && isFinite(list[i].tokens) && list[i].tokens > 0) tokens.push(list[i].tokens);
  }
  if (tokens.length < 5) return null;
  var p90 = percentile90(tokens);
  if (p90 <= 0) return null;
  var nextWarn = roundToStep(p90 * 0.8, 5000, 5000, 900000);
  var nextCritical = roundToStep(p90 * 1.2, 5000, 10000, 999000);
  if (nextCritical <= nextWarn) nextCritical = nextWarn + 5000;
  return {
    warn: nextWarn,
    critical: nextCritical,
    sampleCount: tokens.length,
    reason: "按最近 " + String(tokens.length) + " 次会话的峰值 " + formatWan(p90) + " 估算（当前 " + formatWan(warn) + " / " + formatWan(critical) + "）"
  };
}

/**
 * 问宿主半要"这个会话什么时候开始的 + 上一轮统计"。
 * 失败（插件宿主半没加载 / 网络抖动）时返回上一次的答案（可能是 null），调用方据此退回本地兜底。
 * @param {string} sessionId 当前会话 id（空串表示"宿主半自己找当前会话"）。
 * @returns {Promise<Object|null>} 会话信息。
 */
function fetchSessionInfo(sessionId) {
  var key = typeof sessionId === "string" ? sessionId : "";
  var now = Date.now();
  if (sessionInfoCache.data !== null && sessionInfoCache.key === key && now - sessionInfoCache.at < SESSION_TTL_MS) {
    return Promise.resolve(sessionInfoCache.data);
  }
  var url = SESSION_API + (key.length > 0 ? "?sessionId=" + encodeURIComponent(key) : "");
  return fetch(url, { cache: "no-store", headers: { accept: "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (data === null || data === undefined || data.ok !== true) return sessionInfoCache.data;
      sessionInfoCache = { key: key, at: Date.now(), data: data };
      return data;
    })
    .catch(function () { return sessionInfoCache.data; });
}

/**
 * 上下文构成明细（v1.14.0）：宿主半去读本机 projcache，回答"这些 token 到底是谁占的"。
 * 拿不到（宿主半没装新版 / 没这个会话的投影）就返回上一次的结果（可能是 null），调用方只做"有就显示"。
 * @param {string} sessionId 当前会话 id（空串=让宿主半自己找）。
 * @returns {Promise<Object|null>} { parts:[{label,tokens,share}], source, window, surfaceTokens }。
 */
function fetchContextParts(sessionId) {
  var key = typeof sessionId === "string" ? sessionId : "";
  var now = Date.now();
  if (contextCache.data !== null && contextCache.key === key && now - contextCache.at < CONTEXT_TTL_MS) {
    return Promise.resolve(contextCache.data);
  }
  var url = CONTEXT_API + (key.length > 0 ? "?sessionId=" + encodeURIComponent(key) : "");
  return fetch(url, { cache: "no-store", headers: { accept: "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (data === null || data === undefined || data.ok !== true) return contextCache.data;
      contextCache = { key: key, at: Date.now(), data: data };
      return data;
    })
    .catch(function () { return contextCache.data; });
}

/**
 * 花费读数（v1.14.0）：本条会话 / 今日 / 最近 N 天花了多少钱，外加最贵的几条会话。
 * 单价由宿主半按本机台账的计价口径算（未命中 ¥1/M、缓存命中 ¥0.02/M、输出 ¥4/M）。
 * @param {string} sessionId 当前会话 id。
 * @param {number} days 统计最近几天（默认 7）。
 * @returns {Promise<Object|null>} { session:{costCNY}, today:{costCNY}, week:{costCNY}, top:[…] }。
 */
function fetchCostInfo(sessionId, days) {
  // v1.19.0：单价跟着设置页走（宿主半按这三个数换算），所以缓存 key 必须带上单价 ——
  // 否则用户改完单价，页面还拿旧缓存显示旧价钱。
  var pricing = normalizePricing(uiState.pricing);
  var priceKey = pricing.in + "," + pricing.cacheRead + "," + pricing.out;
  var key = (typeof sessionId === "string" ? sessionId : "") + "#" + String(days === undefined ? 7 : days) + "#" + priceKey;
  var now = Date.now();
  if (costCache.data !== null && costCache.key === key && now - costCache.at < COST_TTL_MS) {
    return Promise.resolve(costCache.data);
  }
  var query = [];
  if (typeof sessionId === "string" && sessionId.length > 0) query.push("sessionId=" + encodeURIComponent(sessionId));
  query.push("days=" + String(days === undefined ? 7 : days));
  query.push("priceIn=" + String(pricing.in));
  query.push("priceCache=" + String(pricing.cacheRead));
  query.push("priceOut=" + String(pricing.out));
  var url = COST_API + "?" + query.join("&");
  return fetch(url, { cache: "no-store", headers: { accept: "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (data === null || data === undefined || data.ok !== true) return costCache.data;
      costCache = { key: key, at: Date.now(), data: data };
      return data;
    })
    .catch(function () { return costCache.data; });
}

/**
 * 把金额写成好看的中文写法：0.4 分钱以下给"<¥0.01"，一元以下给三位小数，其余两位。
 * @param {number} value 金额（元）。
 * @returns {string} 形如 "¥0.42"。
 */
function formatCny(value) {
  if (typeof value !== "number" || !isFinite(value) || value <= 0) return "¥0";
  if (value < 0.005) return "<¥0.01";
  if (value < 1) {
    // 一元以下给三位小数，但把没意义的尾 0 去掉（¥0.42 而不是 ¥0.420），至少留两位。
    var text = value.toFixed(3).replace(/0+$/, "");
    var dot = text.indexOf(".");
    if (dot === -1) text += ".00";
    else if (text.length - dot === 2) text += "0";
    return "¥" + text;
  }
  return "¥" + value.toFixed(2);
}

/**
 * 到线时的浏览器系统通知（v1.14.0）。
 * 只在两个条件都满足时发：用户在设置页开了开关、浏览器已授权。
 * 同一会话同一条线用 tag 去重，不会连发一串。
 * @param {string} title 标题。
 * @param {string} body 正文。
 * @returns {boolean} 是否真的发出去了。
 */
function notifyOnLine(title, body) {
  try {
    if (typeof window === "undefined" || typeof window.Notification !== "function") return false;
    if (window.Notification.permission !== "granted") return false;
    var note = new window.Notification(title, { body: body, tag: "gs-budget-line" });
    if (note !== null && note !== undefined && typeof note.close === "function") {
      window.setTimeout(function () { try { note.close(); } catch (error) { /* 已关 */ } }, 15000);
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 找出"与进度条同宽的那层 composer 容器"（hero 态与对话态的类名/层级都可能不一样）。
 * 优先按类名找 composerStack；找不到、或它量出来宽度为 0（宿主插槽常是 display:contents）时，
 * 就往上找第一个"真的有宽度"的祖先 —— 那层才是进度条真正的布局父级。
 * @param dockEl - 进度条所在容器。
 * @returns {Element|null} 容器元素，找不到返回 null。
 */
function composerArea(dockEl) {
  try {
    if (dockEl === null || typeof dockEl.getBoundingClientRect !== "function") return null;
    var stack = typeof dockEl.closest === "function" ? dockEl.closest('[class*="composerStack"]') : null;
    if (stack !== null && stack.getBoundingClientRect().width > 0) return stack;
    var cur = dockEl.parentElement;
    while (cur !== null) {
      if (cur.getBoundingClientRect().width > 0) return cur;
      cur = cur.parentElement;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/** 输入框本体：DSH 现在是 contenteditable 富文本，不再一定是 textarea —— 只认 textarea 会量不到。 */
var COMPOSER_INPUT_SEL = 'textarea, [contenteditable], [role="textbox"]';

/**
 * 找出输入框卡片（带 `_card` 类的那层）—— 进度条要和它对左右边线。
 * @param stack - composer 容器（composerArea 的结果）。
 * @returns {Element|null} 卡片元素，找不到返回 null。
 */
function composerCard(stack) {
  if (stack === null || typeof stack.querySelector !== "function") return null;
  var input = stack.querySelector(COMPOSER_INPUT_SEL);
  if (input !== null && typeof input.closest === "function") {
    var hit = input.closest('[class*="_card"]');
    if (hit !== null && typeof stack.contains === "function" && stack.contains(hit)) return hit;
  }
  // 退化：同容器里宽度小于容器、且内部含输入框的元素中取最宽的那个（通常就是输入框卡片）。
  var best = 0;
  var found = null;
  var nodes = stack.querySelectorAll("div");
  for (var i = 0; i < nodes.length; i += 1) {
    var node = nodes[i];
    var box = node.getBoundingClientRect();
    if (box.width < 120) continue;
    if (node.querySelector(COMPOSER_INPUT_SEL) === null) continue;
    if (box.width > best) { best = box.width; found = node; }
  }
  return found;
}

/**
 * 量出进度条左右需要留多少，才能与输入框卡片左右对齐。
 * 输入框卡片是 composer 里带 `_card` 类的那层（其外层 composerStack 与我们在同一宽度），
 * hero 态与对话态的缩进不一样，所以每次实时量，而不是写死像素。
 * v1.17.1：加了"量歪了就别用"的保护（两条边加起来不该超过容器一半、卡片不该比容器宽）；
 * 量不到就返回 null，调用方会保留上一次的值，绝不把进度条挤成一条。
 * @param dockEl - 进度条所在容器。
 * @returns {Object|null} {left, right} 左右内边距（px）；量不到返回 null。
 */
function composerInsets(dockEl) {
  try {
    var stack = composerArea(dockEl);
    if (stack === null) return null;
    var card = composerCard(stack);
    if (card === null) return null;
    var dockRect = dockEl.getBoundingClientRect();
    var cardRect = card.getBoundingClientRect();
    if (!(dockRect.width > 0) || !(cardRect.width > 0)) return null;
    var left = Math.max(0, Math.round(cardRect.left - dockRect.left));
    var right = Math.max(0, Math.round(dockRect.right - cardRect.right));
    if (left + right > dockRect.width * 0.5) return null;
    if (cardRect.width > dockRect.width + 2) return null;
    return { left: left, right: right };
  } catch (error) {
    console.error("[greet-signoff] inset measure failed", error);
    return null;
  }
}

/**
 * 阈值提醒：占用到了哪一档、该显示哪句话。
 * 抽成纯函数是为了可测 —— 无头页面里拿不到真实的 `contextPressure` 投影，
 * 所以"高占用时长什么样"由单测覆盖，组件只负责把它渲染出来。
 * @param percent - 当前占用百分比（0-100）。
 * @param warnPercent - 黄色阈值。
 * @param criticalPercent - 红色阈值。
 * @returns {{tone: string, line: string|null}} tone: ok/warn/critical；line: 提醒文案（ok 时为 null）。
 */
function contextAlert(percent, warnPercent, criticalPercent) {
  if (typeof percent !== "number" || !isFinite(percent)) return { tone: "ok", line: null };
  if (percent >= criticalPercent) return { tone: "critical", line: "🚨 上下文即将占满：先点「总结要点」再开新会话" };
  if (percent >= warnPercent) return { tone: "warn", line: "⚠️ 上下文接近上限：建议先总结要点，再开新会话" };
  return { tone: "ok", line: null };
}

/**
 * 按"你自己的预算线"读占用：**100% = 你设的「必须换会话」线**（默认 11 万 tok）。
 * 这是给发哥用的口径——原来的"占模型窗口"分母是 100 万，24% 看着很安全，其实早就该换会话了。
 * 抽成纯函数便于单测：什么算接近、什么算超了，规则必须锁住。
 * @param {number|null} used 当前占用 token（拿不到读数时传 null）。
 * @param {number} warnTokens 黄线（提醒）token 数。
 * @param {number} criticalTokens 红线（必须换）token 数。
 * @returns {{percent:number,tone:string,ratio:number,over:boolean,warnPercent:number,warn:number,critical:number}} 读数。
 */
function budgetReading(used, warnTokens, criticalTokens) {
  var warn = typeof warnTokens === "number" && isFinite(warnTokens) && warnTokens > 0 ? Math.round(warnTokens) : 75000;
  var critical = typeof criticalTokens === "number" && isFinite(criticalTokens) && criticalTokens > warn
    ? Math.round(criticalTokens)
    : Math.round(warn * 1.5);
  var warnPercent = Math.max(1, Math.min(99, Math.round(warn / critical * 100)));
  if (typeof used !== "number" || !isFinite(used) || used < 0) {
    return { percent: 0, tone: "ok", ratio: 0, over: false, warnPercent: warnPercent, warn: warn, critical: critical };
  }
  var ratio = used / critical;
  return {
    percent: Math.round(ratio * 100),
    tone: used >= critical ? "critical" : (used >= warn ? "warn" : "ok"),
    ratio: ratio,
    over: used >= critical,
    warnPercent: warnPercent,
    warn: warn,
    critical: critical
  };
}

/** 把 token 数夹进合法范围（与设置页输入框的 min/max 对齐）。 */
function clampBudgetTokens(value, min, max, fallback) {
  if (typeof value !== "number" || !isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * 认档位 id：认不出来（没设过、手改坏了、旧版本存的）一律返回空串，由调用方决定回落。
 * @param {string} mode 档位 id。
 * @returns {string} 合法档位 id，或空串。
 */
function normalizeBudgetMode(mode) {
  if (typeof mode !== "string") return "";
  for (var i = 0; i < BUDGET_MODES.length; i += 1) {
    if (BUDGET_MODES[i].id === mode) return mode;
  }
  return "";
}

/** 档位的展示名（认不出来当"日常"）。 */
function budgetModeLabel(mode) {
  var id = normalizeBudgetMode(mode);
  for (var i = 0; i < BUDGET_MODES.length; i += 1) {
    if (BUDGET_MODES[i].id === id) return BUDGET_MODES[i].label;
  }
  return BUDGET_MODES[0].label;
}

/** 档位的一句话说明（胶囊 tooltip / 设置页提示用）。 */
function budgetModeHint(mode) {
  var id = normalizeBudgetMode(mode);
  for (var i = 0; i < BUDGET_MODES.length; i += 1) {
    if (BUDGET_MODES[i].id === id) return BUDGET_MODES[i].hint;
  }
  return BUDGET_MODES[0].hint;
}

/**
 * 算出"现在真正生效"的两条线：本会话临时档 > 全局默认档 > 内置默认；档位是 custom 时用手填的两个数。
 * @param {string} globalMode 全局档（gs.signoff.ui.budgetMode）。
 * @param {string} sessionMode 本会话临时档（空串 = 没设）。
 * @param {number} customWarn 手填黄线。
 * @param {number} customCritical 手填红线。
 * @returns {{mode:string,warn:number,critical:number,scope:string,custom:boolean}} scope: session | global | default。
 */
function resolveBudgetMode(globalMode, sessionMode, customWarn, customCritical) {
  var session = normalizeBudgetMode(sessionMode);
  var global = normalizeBudgetMode(globalMode);
  var mode = session !== "" ? session : (global !== "" ? global : DEFAULT_BUDGET_MODE);
  var scope = session !== "" ? "session" : (global !== "" ? "global" : "default");
  var warn = clampBudgetTokens(customWarn, 5000, 900000, UI_DEFAULTS.budgetWarn);
  var critical = clampBudgetTokens(customCritical, 10000, 999000, UI_DEFAULTS.budgetCritical);
  if (critical <= warn) critical = Math.round(warn * 1.5);
  for (var i = 0; i < BUDGET_MODES.length; i += 1) {
    if (BUDGET_MODES[i].id === mode && BUDGET_MODES[i].warn !== null) {
      warn = BUDGET_MODES[i].warn;
      critical = BUDGET_MODES[i].critical;
    }
  }
  return { mode: mode, warn: warn, critical: critical, scope: scope, custom: mode === "custom" };
}

/**
 * 胶囊点一下切下一档：日常 → 大任务 → 省着聊 → 跟随默认（空串 = 清掉本会话临时档）。
 * 自定义档不在轮转里（它要在设置页填数），从自定义点一下会回到"日常"。
 * @param {string} mode 当前生效档。
 * @returns {string} 下一档 id，或空串（跟随默认）。
 */
function nextBudgetMode(mode) {
  var index = BUDGET_MODE_CYCLE.indexOf(normalizeBudgetMode(mode));
  if (index < 0) return BUDGET_MODE_CYCLE[0];
  return BUDGET_MODE_CYCLE[(index + 1) % BUDGET_MODE_CYCLE.length];
}

/**
 * token 数的中文直观写法：248930 → "24.9 万"，110000 → "11 万"，3200 → "3.2k"。
 * 比 "1.2k/1.0M" 更贴发哥的说话习惯（他关心的是"几万 tok"）。
 * @param {number} value token 数。
 * @returns {string} 展示文本。
 */
function formatWan(value) {
  if (typeof value !== "number" || !isFinite(value)) return "?";
  if (Math.abs(value) < 10000) return formatTokens(value);
  var wan = value / 10000;
  return (Math.abs(wan - Math.round(wan)) < 0.05 ? String(Math.round(wan)) : wan.toFixed(1)) + " 万";
}

/* ─── 方案 7「KPI 三格」的读数（纯函数，UI 与单测共用） ──────────────────── */

/** 花费固定"财神金"、时长固定蓝：深浅两档各一个，深色下用亮一档（保证暗底上也看得清）。 */
var KPI_GOLD = "#b8860b";
var KPI_GOLD_DARK = "#e6b84d";
var KPI_BLUE = "#2563eb";
var KPI_BLUE_DARK = "#7aa2ff";
/* v1.16.0 新增两格：预算档（紫，与"设置里的档位"同色系）、实测速率（青，避开状态色绿以免和占用混淆） */
var KPI_VIOLET = "#7c3aed";
var KPI_VIOLET_DARK = "#c4b5fd";
var KPI_TEAL = "#0f766e";
var KPI_TEAL_DARK = "#5eead4";
/* v1.17.0 第六格：到线约还有几轮（玫红 —— 与状态色绿/黄/红、上面五格都不撞色） */
var KPI_ROSE = "#be185d";
var KPI_ROSE_DARK = "#f9a8d4";

/**
 * 把十六进制色变成"同色淡底"（配色 C：数字后面垫一层胶囊底）。
 * 用 rgba 而不是固定色值，是因为占用那格的颜色可能来自用户自选的配色方案，浅/深主题都得跟着走。
 * @param {string} color "#rrggbb" 或 "#rgb"。
 * @param {number} alpha 透明度（浅色档 0.14 / 深色档 0.24）。
 * @returns {string} "rgba(r,g,b,a)"。
 */
function tintOf(color, alpha) {
  var rgb = hexToRgb(color);
  var a = typeof alpha === "number" && isFinite(alpha) ? alpha : 0.14;
  return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
}

/**
 * 方案 7 的三格读数（配色 A：语义状态色；配色 C：数字胶囊底）：
 * ① 上下文占用 —— 颜色就是状态本身（安全=绿 / 到提醒线=黄 / 到必须换线=红），不用比大小就知道"还能不能聊"；
 * ② 本条会话花费 —— 固定财神金；③ 已聊时长 —— 固定蓝。
 * 任何一格没数据一律写 "—"（写 0 会看起来像坏了），且不给颜色、不给底色。
 * @param {Object} opts {hasReading, occupancyText, limitText, costText, elapsedText,
 *   showMode, modeText, modeSuffix, showRate, rateText, showTurns, turnsText, tone, palette, dark}
 * @returns {Array} 三个 { key, label, value, suffix, color, background, state }。
 */
/**
 * 「上下文占用」那一格的悬停说明（v1.19.0）：把"这个数到底是怎么来的"写清楚。
 * 读数就是 DSH 自己算的那份上下文投影（`contextPressure`）：
 *   显示值 = pressureTokens（**上一次**请求真正喂进去的 prompt）+（当前界面总览 − 采样那一刻的总览）。
 * 所以它是"发下一条消息时预计要喂进去多少"，不是"屏幕上现在有多少字"，也不会随打字实时变——
 * 一轮请求结束后才刷新一次，天然滞后一轮。这一格以前只有数字没有解释，看着像随手估的。
 * @param {{usedTokens?: number, warn?: number, critical?: number, capacity?: number, meterMode?: string}} opts
 * @returns {string} 多行 tooltip 文本。
 */
function occupancyTip(opts) {
  var o = opts !== null && typeof opts === "object" ? opts : {};
  var num = function (value) {
    return typeof value === "number" && isFinite(value) && value > 0 ? value : null;
  };
  var meterMode = o.meterMode === "window" ? "window" : "budget";
  var used = num(o.usedTokens);
  var warn = num(o.warn);
  var critical = num(o.critical);
  var capacity = num(o.capacity);
  var lines = ["上下文占用：这个数是怎么来的（采样口径）"];
  lines.push("· 说人话：它是「发下一条消息时预计要喂进去多少 token」，不是屏幕上现在有多少字，"
    + "也不是谁估的 —— 是 DSH 自己算出来的那份上下文投影。");
  lines.push("· 数怎么来的：上一次请求真正喂进去的 prompt（pressureTokens）"
    + " + 那次采样之后界面上新增的部分（当前总览 − 采样时的总览）。");
  lines.push("· 多久刷新：只在每轮请求结束后更新一次，所以天然滞后一轮 —— 你刚发的那句话要等这轮答完才计入。");
  if (meterMode === "budget") {
    if (warn !== null && critical !== null) {
      lines.push("· 百分比口径：按你的预算线算（黄线 " + formatWan(warn) + " tok 提醒 / 红线 "
        + formatWan(critical) + " tok 必须换会话），100% = 红线；想看「占模型窗口」的老口径，去设置里切。");
    }
    if (used !== null && critical !== null) {
      lines.push("· 这次读数：约 " + formatWan(used) + " tok"
        + (used > critical ? "（已经超过红线，建议开新会话）" : "（红线 " + formatWan(critical) + " tok）") + "。");
    }
  } else {
    if (used !== null && capacity !== null) {
      lines.push("· 百分比口径：按模型窗口算（读数 " + formatWan(used) + " tok / 窗口 " + formatWan(capacity)
        + " tok），所以看着永远很安全 —— 这只是旧口径。");
    } else {
      lines.push("· 百分比口径：按模型窗口算（旧口径，看着永远很安全）。");
    }
  }
  lines.push("· 想知道是谁占的：点下面的「上下文构成」，按占比从大到小排，前几名就是能砍的地方。");
  return lines.join("\n");
}

function dockKpiCells(opts) {
  var o = opts !== undefined && opts !== null ? opts : {};
  var occupancyTipText = typeof o.occupancyTip === "string" ? o.occupancyTip : "";
  var palette = Array.isArray(o.palette) && o.palette.length >= 3 ? o.palette : BAR_SCHEMES[0].colors;
  var dark = o.dark === true;
  var tone = o.tone === "critical" || o.tone === "warn" ? o.tone : "ok";
  var alpha = dark ? 0.24 : 0.14;
  var stateColor = tone === "critical" ? palette[2] : (tone === "warn" ? palette[1] : palette[0]);
  var gold = dark ? KPI_GOLD_DARK : KPI_GOLD;
  var blue = dark ? KPI_BLUE_DARK : KPI_BLUE;
  var occText = typeof o.occupancyText === "string" ? o.occupancyText : "";
  var limitText = typeof o.limitText === "string" ? o.limitText : "";
  var costText = typeof o.costText === "string" ? o.costText : "";
  var elapsedText = typeof o.elapsedText === "string" ? o.elapsedText : "";
  var hasReading = o.hasReading === true;
  // v1.16.0：第四格「预算档」与第五格「实测速率」——发哥要求把原来散在别处的这两个功能
  // 并进这一排，样式与前三格完全一致（上面小标签 + 下面同色淡底数字胶囊）。
  // 都是"显式要才出现"（showMode/showRate），老调用方拿到的仍然是三格，行为不变。
  var modeText = typeof o.modeText === "string" ? o.modeText : "";
  var modeSuffix = typeof o.modeSuffix === "string" ? o.modeSuffix : "";
  var rateText = typeof o.rateText === "string" ? o.rateText : "";
  // v1.17.0：第六格「到线约还有」（还剩几轮）——同样从时间行搬进来，紧跟实测速率之后。
  var turnsText = typeof o.turnsText === "string" ? o.turnsText : "";
  var violet = dark ? KPI_VIOLET_DARK : KPI_VIOLET;
  var teal = dark ? KPI_TEAL_DARK : KPI_TEAL;
  var rose = dark ? KPI_ROSE_DARK : KPI_ROSE;
  var cell = function (key, label, text, color, suffix, title) {
    var known = text !== "";
    return {
      key: key,
      label: label,
      value: known ? text : "—",
      suffix: known && typeof suffix === "string" ? suffix : "",
      color: known ? color : "",
      background: known ? tintOf(color, alpha) : "",
      // v1.19.0：每格可以带自己的悬停说明；占用格用 occupancyTip 把采样口径写清楚。
      title: typeof title === "string" ? title : "",
      state: key === "usage" ? tone : (known ? "on" : "off")
    };
  };
  var cells = [
    cell("usage", "上下文占用", hasReading ? occText : "", stateColor, limitText, occupancyTipText),
    cell("cost", "本条会话花费", costText === "" ? "" : "≈" + costText, gold),
    cell("time", "已聊时长", elapsedText, blue)
  ];
  if (o.showMode === true) cells.push(cell("mode", "预算档", modeText, violet, modeSuffix));
  if (o.showRate === true) cells.push(cell("rate", "实测速率", rateText, teal));
  if (o.showTurns === true) cells.push(cell("turns", "到线约还有", turnsText, rose));
  return cells;
}


/**
 * 让标签页标题带上提醒前缀：不用盯着页面看，扫一眼浏览器标签就知道该换会话了。
 * 传空串表示撤掉前缀（切回安全区或组件卸载时都会摘干净）。
 * @param {string} flag "" | "⚠️ " | "🚨 "
 */
function useTitleFlag(flag) {
  React.useEffect(function () {
    if (typeof document === "undefined") return undefined;
    var current = String(document.title || "");
    var base = current.replace(/^(?:🚨|⚠️)\s*/, "");
    if (flag === "") {
      if (current !== base) document.title = base;
      return undefined;
    }
    document.title = flag + base;
    return function () {
      var now = String(document.title || "");
      if (now.indexOf(flag) === 0) document.title = now.slice(flag.length);
    };
  }, [flag]);
}

/**
 * 找输入框元素。DSH 的输入框是一段 contenteditable 的 `[role="textbox"]`，
 * 挂在 `data-slot="conversation.composer"` 里；`[data-dsh-part="composer-input"]` 是更早版本的钩子，
 * 现在页面上**并不存在**（2026-09-18 实测），所以这里按"钩子 → 插槽 → 可见的最后一个可编辑元素"逐级兜底。
 * @returns {Element|null} 输入框元素。
 */
function findComposerEl() {
  if (typeof document === "undefined") return null;
  var direct = document.querySelector('[data-dsh-part="composer-input"]');
  if (direct !== null) return direct;
  var inSlot = document.querySelector('[data-slot="conversation.composer"] [role="textbox"], [data-slot="conversation.composer.bar"] [role="textbox"]');
  if (inSlot !== null) return inSlot;
  var cands = document.querySelectorAll('[role="textbox"], textarea, [contenteditable="true"]');
  for (var i = cands.length - 1; i >= 0; i -= 1) {
    var rect = cands[i].getBoundingClientRect();
    if (rect.width > 40 && rect.height > 10) return cands[i];
  }
  return null;
}

/** 读输入框里的文字（contenteditable 用 textContent，表单元素用 value）。 */
function readComposerText(el) {
  if (el === null || el === undefined) return "";
  if (typeof el.value === "string") return el.value;
  return el.textContent || "";
}

/**
 * 把一段文字写进输入框。DSH 的输入框是 React 完全受控的 contenteditable：
 * 实测（2026-09-18）直接改 textContent 会被立刻回滚，所以这里按"三级递进"来：
 * ① 选中末尾 → `execCommand('insertText')`；② 退回原生 setter + input 事件；
 * ③ 最后**回读校验**，只有真的写进去了才返回 true —— 调用方据此决定要不要退到剪贴板。
 * @param text - 要写入的文字。
 * @returns {boolean} 是否真的写进了输入框。
 */
function fillComposer(text) {
  var el = findComposerEl();
  if (el === null) return false;
  if (typeof el.focus === "function") el.focus();
  var editable = el.getAttribute("contenteditable") !== null;
  if (editable) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var selection = window.getSelection();
      if (selection !== null) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (typeof document.execCommand === "function") document.execCommand("insertText", false, text);
    } catch (error) { /* 落到下面的兜底 */ }
  }
  if (readComposerText(el).indexOf(text.slice(0, 6)) < 0) {
    var tag = el.tagName;
    var proto = tag === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : (tag === "INPUT" ? window.HTMLInputElement.prototype : null);
    if (proto !== null) {
      var desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc !== undefined && typeof desc.set === "function") desc.set.call(el, text);
      else el.value = text;
    } else {
      el.textContent = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (typeof el.focus === "function") el.focus();
  return readComposerText(el).indexOf(text.slice(0, 6)) >= 0;
}

/**
 * 上下文快满时，点「总结要点」要交给用户的那句话。
 * 注意：这里是"把要求准备好"，不代替用户按回车 —— 免得误触直接把话发出去。
 */
var SUMMARY_PROMPT = "请把本次会话整理成一份交接摘要：目标、已确认的结论、涉及的关键文件或路径、待办与注意事项。写完后我会带着它开新会话继续。";
/**
 * 交接包：摘要要落盘成工作区根目录的 HANDOFF.md，新会话开局才读得到（宿主提示段里也约定了"有就先读"）。
 * v1.19.0：落盘不再靠模型写文件 —— 模型只把摘要当正文输出并用两行标记包起来，前端监听到标记后调宿主
 * POST /handoff 写文件；省一次工具往返，也不怕它忘了写。落盘失败仍有剪贴板兜底。
 */
var HANDOFF_FILE = "HANDOFF.md";
/** 交接摘要的起止标记（要模型原样输出成两行，前端据此把中间那段正文抠出来）。 */
var HANDOFF_MARK_START = "<<<HANDOFF>>>";
var HANDOFF_MARK_END = "<<<END>>>";
var HANDOFF_PROMPT = "请把本次会话整理成一份交接摘要：目标、已确认的结论、涉及的关键文件或路径、待办与注意事项。"
  + "把这份摘要**直接作为你的回复正文输出**，并用两行标记把它包起来：第一行只写 " + HANDOFF_MARK_START
  + "，最后一行只写 " + HANDOFF_MARK_END + "，中间只放摘要正文。"
  + "不要用 write 工具写文件、不要在标记之外多写其它内容 —— 这个界面会自动把标记中间的内容落盘成工作区根目录的 "
  + HANDOFF_FILE + "。接着我会开新会话，带着这份文件继续。";

/* ─── 交接摘要监听（v1.19.0）：正文里出现标记 → 调宿主接口落盘 ─────────────────
 * 观察的是 document.body（不能假设 [data-dsh-part="message-body"] 挂载时就存在 ——
 * hero 欢迎态下一条消息都没有，实测这些元素数量为 0）。取文本时优先用 message-body 这个
 * 稳定语义钩子，钩子变了就退回"任意同时含两个标记的元素"，保证功能不因属性改名而失效。
 */
var HANDOFF_API = API + "/handoff";
/** 落盘结果显示在哪：进度条组件挂上时把 setSumNotice 写进来（拿不到就只留控制台）。 */
var handoffNoticeSink = null;
/** DOM 静止这么久才抓（流式期间不抓，免得落盘半截）；太短的片段不落盘（多半是误抓，输入框里那句"要求"也含标记）。 */
var HANDOFF_SCAN_DELAY_MS = 900;
var HANDOFF_MIN_CHARS = 32;
/** 监听器状态（一个页面只需要一个）。 */
var handoffWatch = { observer: null, timer: 0, lastText: "", busy: false, queued: "", done: {} };

function handoffNotice(text) {
  if (typeof handoffNoticeSink === "function") {
    try { handoffNoticeSink(text); return; } catch (error) { /* 组件已卸载：落到控制台 */ }
  }
  console.log("[greet-signoff] " + text);
}

/** 抠出两个标记之间的内容（纯函数）：没标记 / 缺结束标记 / 内容不足 HANDOFF_MIN_CHARS → null。 */
function extractHandoffText(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  var start = text.indexOf(HANDOFF_MARK_START);
  if (start < 0) return null;
  var from = start + HANDOFF_MARK_START.length;
  var end = text.indexOf(HANDOFF_MARK_END, from);
  if (end < 0) return null;
  var body = text.slice(from, end).replace(/^[\s\u200B\uFEFF]+|[\s\u200B\uFEFF]+$/g, "");
  return body.length < HANDOFF_MIN_CHARS ? null : body;
}

/** 同一段摘要只落盘一次用的去重键（长度 + 头尾各 48 字）。 */
function handoffKey(body) {
  var text = typeof body === "string" ? body : "";
  if (text.length <= 96) return text.length + ":" + text;
  return text.length + ":" + text.slice(0, 48) + ":" + text.slice(-48);
}

/** 落盘失败兜底：把摘要复制到剪贴板。 */
function copyHandoffFallback(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(function () { }, function () { });
    }
  } catch (error) { /* 剪贴板被禁：忽略 */ }
}

/** 问宿主半要当前会话的工作目录（POST /handoff 必须带绝对路径 cwd）。 */
function fetchWorkspaceCwd() {
  return fetch(API + "/rule-text", { cache: "no-store", headers: { accept: "application/json" } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (data === null || data === undefined || data.ok !== true) return null;
      return typeof data.cwd === "string" && data.cwd.length > 0 ? data.cwd : null;
    })
    .catch(function () { return null; });
}

/** 交给宿主落盘：任何失败都只提示 + 剪贴板兜底，绝不抛（不能把进度条搞坏）。 */
function submitHandoff(text) {
  if (typeof text !== "string" || text.length === 0) return;
  handoffWatch.busy = true;
  var finish = function (message) {
    handoffWatch.busy = false;
    handoffNotice(message);
    var queued = handoffWatch.queued;
    handoffWatch.queued = "";
    if (queued.length > 0) submitHandoff(queued);
  };
  fetchWorkspaceCwd().then(function (cwd) {
    if (cwd === null) {
      copyHandoffFallback(text);
      finish("抓到交接摘要了，但拿不到当前工作区路径：摘要已复制到剪贴板，粘成 " + HANDOFF_FILE + " 一样能用。");
      return null;
    }
    return fetch(HANDOFF_API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ cwd: cwd, filename: HANDOFF_FILE, text: text })
    }).then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data !== null && data !== undefined && data.ok === true) {
          var parts = String(typeof data.path === "string" && data.path.length > 0 ? data.path : HANDOFF_FILE).split(/[\\/]/);
          var name = parts[parts.length - 1];
          var bytes = typeof data.bytes === "number" && isFinite(data.bytes) ? data.bytes : 0;
          finish("已写入 " + name + "（" + bytes + " 字节" + (data.replaced === true ? "，旧内容备份成 " + name + ".bak" : "")
            + "）—— 开新会话就能直接读到。");
          return;
        }
        var reason = data !== null && data !== undefined && typeof data.error === "string" ? data.error : "宿主接口没响应";
        copyHandoffFallback(text);
        finish("交接摘要落盘失败（" + reason + "）：已复制到剪贴板，粘成 " + HANDOFF_FILE + " 也能用。");
      });
  }).catch(function () {
    copyHandoffFallback(text);
    finish("交接摘要落盘失败（接口异常）：已复制到剪贴板，粘成 " + HANDOFF_FILE + " 也能用。");
  });
}

/** 候选节点：优先助手正文（message-body），没有就退回"同时含两个标记"的容器。 */
function handoffCandidateNodes() {
  if (typeof document === "undefined") return [];
  var list = [];
  var bodies = document.querySelectorAll('[data-dsh-part="message-body"]');
  for (var i = 0; i < bodies.length; i += 1) list.push(bodies[i]);
  if (list.length > 0) return list;
  var boxes = document.querySelectorAll('[data-streaming],[data-dsh-part="message-row"],[data-dsh-part="scrollport"],article,main');
  for (var j = boxes.length - 1; j >= 0; j -= 1) {
    var el = boxes[j];
    if (el === null || el === undefined) continue;
    // 输入框里的那段"要求"里也有这两个标记，别把它当摘要
    if (typeof el.closest === "function") {
      var inComposer = null;
      try { inComposer = el.closest('[contenteditable],textarea,[data-dsh-part="composer-input"]'); } catch (error) { inComposer = null; }
      if (inComposer !== null) continue;
    }
    var text = typeof el.textContent === "string" ? el.textContent : "";
    if (text.indexOf(HANDOFF_MARK_START) >= 0 && text.indexOf(HANDOFF_MARK_END) >= 0) list.push(el);
  }
  return list;
}

/** 扫一次：从最新那个候选节点抠摘要，抠到就交给宿主落盘。 */
function scanHandoffBodies() {
  var nodes = handoffCandidateNodes();
  if (nodes.length === 0) return;
  var node = nodes[nodes.length - 1];
  if (node === null || node === undefined) return;
  // 还在流式输出：等它写完（属性没变过也没关系 —— 900ms 的静默去抖也会等到它写完）
  if (typeof node.closest === "function") {
    var streaming = null;
    try { streaming = node.closest("[data-streaming]"); } catch (error) { streaming = null; }
    if (streaming !== null) return;
  }
  var text = typeof node.textContent === "string" ? node.textContent : "";
  if (text.length === 0 || text === handoffWatch.lastText) return;
  handoffWatch.lastText = text;
  var body = extractHandoffText(text);
  if (body === null || body.length < HANDOFF_MIN_CHARS) return;
  var key = handoffKey(body);
  if (handoffWatch.done[key] === true) return;
  handoffWatch.done[key] = true;
  if (handoffWatch.busy) { handoffWatch.queued = body; return; }
  submitHandoff(body);
}

/** 把一串 mutation 合并成一次扫描（去抖：文本静下来 HANDOFF_SCAN_DELAY_MS 之后才看）。 */
function scheduleHandoffScan() {
  if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
  if (handoffWatch.timer !== 0) window.clearTimeout(handoffWatch.timer);
  handoffWatch.timer = window.setTimeout(function () {
    handoffWatch.timer = 0;
    try { scanHandoffBodies(); } catch (error) { console.error("[greet-signoff] handoff scan failed", error); }
  }, HANDOFF_SCAN_DELAY_MS);
}

/** 装上监听：观察 document.body，元素还没出现时观察也已经生效。 */
function startHandoffWatcher() {
  if (handoffWatch.observer !== null) return;
  if (typeof document === "undefined" || typeof MutationObserver !== "function") return;
  if (document.body === null || document.body === undefined) return;
  try {
    handoffWatch.observer = new MutationObserver(function () { scheduleHandoffScan(); });
    handoffWatch.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (error) {
    handoffWatch.observer = null;
    return;
  }
  scheduleHandoffScan();
}

/** 卸下监听（插件被卸载 / 页面要走了）。 */
function stopHandoffWatcher() {
  if (handoffWatch.observer !== null) {
    try { handoffWatch.observer.disconnect(); } catch (error) { /* 已经断了 */ }
    handoffWatch.observer = null;
  }
  if (handoffWatch.timer !== 0 && typeof window !== "undefined") {
    window.clearTimeout(handoffWatch.timer);
    handoffWatch.timer = 0;
  }
}

/** 页面是不是在后台（隐藏）——隐藏时这一次心跳整个跳过：不写账本、不重算、也不抢锁。 */
function pageHidden() {
  if (typeof document === "undefined") return false;
  if (document.hidden === true) return true;
  return typeof document.visibilityState === "string" && document.visibilityState === "hidden";
}

function GreetDock(props) {
  var store = useConfig();
  var config = store.config;
  // 外观偏好（含进度条口径/预算档）先取：口径决定下面所有读数怎么算。
  var ui = useUiPrefs();
  var sessionId = props !== null && props !== undefined && props.session !== null && props.session !== undefined
    && typeof props.session.sessionId === "string" ? props.session.sessionId : "";
  // 预算档：本会话临时档 > 全局默认档 > 内置默认（custom 档用手填的两个数）。
  var sessionBudgetMode = readSessionMode(sessionId);
  var modeInfo = resolveBudgetMode(ui.budgetMode, sessionBudgetMode, ui.budgetWarn, ui.budgetCritical);
  var pressure = props !== null && props !== undefined && typeof props.useProjection === "function"
    ? props.useProjection("contextPressure")
    : undefined;
  var occupancy = occupancyOf(pressure);
  var hasReading = occupancy !== null;
  var usedTokens = hasReading ? occupancy.used : -1;
  var windowPercent = hasReading ? occupancy.percent : 0;
  var meterMode = ui.meterMode === "window" ? "window" : "budget";
  var budget = budgetReading(hasReading ? usedTokens : null, modeInfo.warn, modeInfo.critical);
  // percent：budget 口径下 100% = 你设的「必须换会话」线（可以超过 100%，表示超了多少）；
  // window 口径下沿用旧行为（占模型窗口）。
  var percent = meterMode === "budget" ? budget.percent : windowPercent;
  var alert = contextAlert(hasReading ? windowPercent : Number.NaN, config.warnPercent, config.criticalPercent);
  var tone = meterMode === "budget" ? budget.tone : alert.tone;
  // 颜色带的两个分界：budget 口径用"黄线/红线换算成预算的百分比"，window 口径沿用配置里的百分比。
  var barWarnPercent = meterMode === "budget" ? budget.warnPercent : config.warnPercent;
  var barCriticalPercent = meterMode === "budget" ? 100 : config.criticalPercent;
  // 标签页标题提醒：扫一眼标签就知道该换会话了。
  useTitleFlag(tone === "critical" ? "🚨 " : (tone === "warn" ? "⚠️ " : ""));
  // 深浅主题（方案 C 的判定结果，皮肤一切换这里就重渲染）：方案 7 的数字胶囊底要按主题换透明度与亮色档。
  var dockDark = useDarkTheme();
  // ── v1.14.0：到线时（1）按"客观计数"给一句建议（只提示，不替用户改档）；
  //            （2）可选的浏览器系统通知（页面在后台也能收到）。
  // 建议的判据全是已经发生过的数：超线倍数 + 当前档位。不预测、不自动切档。
  React.useEffect(function () {
    if (ui.autoSuggest === false || !hasReading) { setBudgetSuggest(""); return; }
    if (budget.ratio >= 1 && modeInfo.mode !== "big" && modeInfo.mode !== "custom") {
      setBudgetSuggest("这条会话已经超线 " + budget.ratio.toFixed(1) + " 倍，还在涨 —— 如果是个没干完的大任务，切「大任务」比反复报红有用。");
      return;
    }
    if (budget.ratio > 0 && budget.ratio < 0.45 && modeInfo.mode === "big") {
      setBudgetSuggest("这条会话离红线还远（用到 " + Math.round(budget.ratio * 100) + "%），大任务档可以先降回「日常」。");
      return;
    }
    setBudgetSuggest("");
  }, [hasReading, usedTokens, modeInfo.mode, ui.autoSuggest, budget.ratio]);
  // 系统通知：开关打开 + 浏览器已授权才发；Notification 的 tag 让同一会话同一条线只提醒一次。
  var notifiedRef = React.useRef("");
  React.useEffect(function () {
    if (ui.notifyOnLine !== true) return;
    if (tone === "ok") { notifiedRef.current = ""; return; }
    var key = sessionId + ":" + tone;
    if (notifiedRef.current === key) return;
    notifiedRef.current = key;
    notifyOnLine(tone === "critical" ? "🚨 该开新会话了" : "⚠️ 快到提醒线了",
      "已用 ~" + formatWan(usedTokens) + " tok（预算 " + formatWan(budget.critical) + "）· 本条会话 ≈" + (costText === "" ? "—" : costText));
  }, [tone, sessionId, ui.notifyOnLine, usedTokens, budget.critical, costText]);

  var dockRef = React.useRef(null);
  var insetPair = React.useState(null);
  var insets = insetPair[0];
  var setInsets = insetPair[1];
  /** 点过「总结要点」之后的提示（空串 = 没点过）。 */
  var sumPair = React.useState("");
  var sumNotice = sumPair[0];
  var setSumNotice = sumPair[1];
  // v1.19.0：交接摘要落盘的结果就显示在这行 .gs-dock-note 上（监听器在 apply 里装，这里只登记出口）。
  React.useEffect(function () {
    handoffNoticeSink = setSumNotice;
    return function () {
      if (handoffNoticeSink === setSumNotice) handoffNoticeSink = null;
    };
  }, []);

  // 与输入框对齐：实时量输入框卡片相对本容器的左右缩进（hero/对话态、侧栏收放、滚动条出现都会变）。
  React.useEffect(function () {
    function measure() {
      var el = dockRef.current;
      if (el === null) return;
      var next = composerInsets(el);
      // 量不到（卡片还没挂上 / 正处在切换动画里）就保留上一次的值 —— 别把已经对齐的边线抖回去。
      if (next === null) return;
      setInsets(function (prev) {
        if (prev !== null && prev.left === next.left && prev.right === next.right) return prev;
        return next;
      });
    }
    // 所有触发都合并到一帧里跑，避免"一次切换引发一串强制布局"。
    var raf = 0;
    function schedule() {
      if (raf !== 0) return;
      var rafFn = typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame
        : function (fn) { return window.setTimeout(fn, 16); };
      raf = rafFn(function () { raf = 0; measure(); });
    }
    measure();
    // 不再用定时轮询：那会在整个会话期间反复做强制同步布局（querySelectorAll + getBoundingClientRect）。
    // v1.17.1 修的是"有时候对齐、有时候不对齐"：
    //   ① 原来 observe 的是 el.parentElement —— 那是宿主的插槽层（display:contents，宽高恒为 0），
    //      ResizeObserver 永远不会回调，等于没有观察者；真会变尺寸的是 composer 容器与输入框卡片。
    //   ② hero↔对话态切换、侧栏收放、会话加载完这些变化不一定改尺寸（只改位置），
    //      所以除 ResizeObserver 外再挂一个 MutationObserver（子节点/类名/内联样式），任何重排都补测一次。
    window.addEventListener("resize", schedule);
    var late = [setTimeout(measure, 300), setTimeout(measure, 1200), setTimeout(measure, 2600)];
    var observers = [];
    var el = dockRef.current;
    var stack = composerArea(el);
    var card = composerCard(stack);
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(schedule);
      [stack, stack === null ? null : stack.parentElement, card, el].forEach(function (node) {
        if (node === null || node === undefined) return;
        try { ro.observe(node); } catch (error) { /* 观察不了就算了，还有 MutationObserver 与 resize */ }
      });
      observers.push(ro);
    }
    if (typeof MutationObserver === "function" && stack !== null) {
      var mo = new MutationObserver(schedule);
      try {
        mo.observe(stack, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
        observers.push(mo);
      } catch (error) { /* 同上 */ }
    }
    return function () {
      for (var i = 0; i < late.length; i += 1) clearTimeout(late[i]);
      window.removeEventListener("resize", schedule);
      for (var j = 0; j < observers.length; j += 1) {
        try { observers[j].disconnect(); } catch (error) { /* 已经断了 */ }
      }
    };
  }, []);

  // 百分比直接取投影的实时值（不再节流）：车头上的数字随占用实时变化。
  // ── 时间维度：① 已聊多久（宿主半给的会话创建时间，拿不到退回本地记的"第一次见到"）
  //               ② 还能聊多久（按实测 token/分钟，数据不够退回轮数估算）
  // 两个来源都要"真的在走"：读数每 5 秒重算一次，进度条不再是一张贴上去就不动的图。
  var nowPair = React.useState(function () { return Date.now(); });
  var now = nowPair[0];
  var setNow = nowPair[1];
  var infoPair = React.useState(null);
  var sessionInfo = infoPair[0];
  var setSessionInfo = infoPair[1];
  var localPair = React.useState(null);
  var localStart = localPair[0];
  var setLocalStart = localPair[1];
  // ── v1.18.0：本会话"真正聊了多久"。不再用宿主半的创建时间直接相减（那会把上次会话、
  //    以及隔夜断档一起算进来），而是按会话 id 各自记账：每 5 秒心跳累加，断档不累加。
  var activePair = React.useState(0);
  var activeSessionMs = activePair[0];
  var setActiveSessionMs = activePair[1];
  var activeRef = React.useRef({ id: "", totalMs: 0, lastAt: 0, savedAt: 0 });
  // v1.19.0：页面被隐藏的时刻（0=没在隐藏）。回到可见时用它把隐藏的这段时间从活跃时长里摘掉。
  var hiddenSinceRef = React.useRef(0);
  // ── v1.14.0：花费与"上下文被谁撑大"。两者都读本机台账/projcache，拿不到就当没有，
  //    绝不会因为宿主半是旧版或文件缺失而把进度条本体搞坏。
  var costPair = React.useState(null);
  var costInfo = costPair[0];
  var setCostInfo = costPair[1];
  var partsPair = React.useState(null);
  var partsInfo = partsPair[0];
  var setPartsInfo = partsPair[1];
  /** 到线时按"客观计数"给出的一句话建议（空串 = 不提示）。 */
  var suggestPair = React.useState("");
  var budgetSuggest = suggestPair[0];
  var setBudgetSuggest = suggestPair[1];
  React.useEffect(function () {
    var alive = true;
    function pull() {
      fetchCostInfo(sessionId, 7).then(function (data) {
        if (alive && data !== null && data !== undefined) setCostInfo(data);
      });
    }
    pull();
    var timer = window.setInterval(pull, SESSION_TTL_MS);
    return function () { alive = false; window.clearInterval(timer); };
  }, [sessionId, usedTokens]);
  React.useEffect(function () {
    var alive = true;
    fetchContextParts(sessionId).then(function (data) {
      if (alive && data !== null && data !== undefined) setPartsInfo(data);
    });
    return function () { alive = false; };
  }, [sessionId, usedTokens]);
  React.useEffect(function () {
    // v1.19.0：页面在后台（document.hidden）时，这一次心跳整个跳过 —— 不重算、不写账本，
    // 因为活跃时长与采样账本都不该被"后台挂着的标签页"推动。
    function tick() {
      if (pageHidden()) { hiddenSinceRef.current = Date.now(); return; }
      setNow(Date.now());
    }
    var timer = window.setInterval(tick, TIME_TICK_MS);
    /** 回到可见：立刻补跑一次心跳，并把隐藏那段时间从活跃时长里摘掉（不改"超 5 分钟算断档"的规则）。 */
    function onVisibility() {
      if (pageHidden()) { hiddenSinceRef.current = Date.now(); return; }
      if (hiddenSinceRef.current > 0) {
        hiddenSinceRef.current = 0;
        if (activeRef.current.lastAt > 0) activeRef.current.lastAt = Date.now();
      }
      setNow(Date.now());
    }
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return function () {
      window.clearInterval(timer);
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, []);
  React.useEffect(function () {
    setLocalStart(sessionId.length === 0 ? null : localSessionStart(sessionId));
  }, [sessionId]);
  React.useEffect(function () {
    var alive = true;
    function pull() {
      fetchSessionInfo(sessionId).then(function (data) {
        if (!alive) return;
        if (data !== null && data !== undefined && typeof data === "object") setSessionInfo(data);
      });
    }
    pull();
    var timer = window.setInterval(pull, SESSION_TTL_MS);
    return function () { alive = false; window.clearInterval(timer); };
  }, [sessionId]);

  // 采样"每一轮大概吃掉多少 token"：占用只在下一轮请求过后才跳一截，
  // 因此把 >200 的正向增量当作一次"又走了一轮"，取最近几次的均值来估算还能聊几轮。
  var samplerRef = React.useRef({ loadedId: null, state: emptySampler() });
  // v1.18.0：账本按会话 id 从 localStorage 恢复（刷新页面不丢），会话一换就换成那条会话自己的账本。
  if (samplerRef.current.loadedId !== sessionId) {
    samplerRef.current.loadedId = sessionId;
    samplerRef.current.state = readSamplerRecord(sessionId);
  }
  React.useEffect(function () {
    if (usedTokens < 0) return;
    if (pageHidden()) return;
    var sampler = samplerRef.current.state;
    var stamp = Date.now();
    if (sampler.last === null) { sampler.last = usedTokens; sampler.lastUsedAt = stamp; return; }
    var delta = usedTokens - sampler.last;
    if (delta > 200) {
      sampler.jumps.push(delta);
      if (sampler.jumps.length > 6) sampler.jumps.shift();
      sampler.jumpTimes.push(stamp);
      if (sampler.jumpTimes.length > 12) sampler.jumpTimes.shift();
      sampler.last = usedTokens;
      sampler.lastUsedAt = stamp;
      // 每记满一轮就落盘一次：这是"速率/还剩几轮"的核心数据，丢了就得重新等一轮。
      // 只有抢到"记账锁"的标签才写（多标签互斥，v1.19.0）。
      if (heartbeatIsLeader(sessionId, stamp)) writeSamplerRecord(sessionId, sampler);
    } else if (delta < -200) {
      // 压缩/清空导致占用回落：重置基线，别把负数算进每轮成本，也别让速率被这次回落带偏
      sampler.last = usedTokens;
      sampler.lastUsedAt = stamp;
      sampler.samples = [];
      if (heartbeatIsLeader(sessionId, stamp)) writeSamplerRecord(sessionId, sampler);
    }
  }, [usedTokens, sessionId]);
  // 时间轴采样：每次读数走一下或占用变了就记一个 {时刻, 占用} 点，用来算"每分钟烧多少 token"。
  React.useEffect(function () {
    if (!hasReading || usedTokens < 0) return;
    if (pageHidden()) return;
    var sampler = samplerRef.current.state;
    var tail = sampler.samples.length === 0 ? null : sampler.samples[sampler.samples.length - 1];
    if (tail !== null && tail.used === usedTokens && now - tail.t < TIME_TICK_MS) return;
    sampler.samples.push({ t: now, used: usedTokens });
    if (sampler.samples.length > SAMPLE_LIMIT) sampler.samples.shift();
    var cutoff = now - SAMPLE_WINDOW_MS;
    while (sampler.samples.length > 2 && sampler.samples[0].t < cutoff) sampler.samples.shift();
    // 节流落盘（一分钟一次）：刷新页面后"实测速率"立刻能算，不用再等一轮。同样只有 leader 才写。
    if (sampler.savedAt === 0 || now - sampler.savedAt >= 60000) {
      if (heartbeatIsLeader(sessionId, now)) {
        sampler.savedAt = now;
        writeSamplerRecord(sessionId, sampler);
      }
    }
  }, [now, usedTokens, hasReading, sessionId]);
  var jumps = samplerRef.current.state.jumps;
  var avgPerTurn = null;
  if (jumps.length > 0) {
    var jumpSum = 0;
    for (var ji = 0; ji < jumps.length; ji += 1) jumpSum += jumps[ji];
    avgPerTurn = Math.round(jumpSum / jumps.length);
  }
  // 剩余：budget 口径 = 到"必须换会话"线还剩多少（超了就是 0）；window 口径 = 到模型窗口还剩多少。
  var remaining = hasReading
    ? (meterMode === "budget"
        ? Math.max(0, budget.critical - usedTokens)
        : Math.max(0, occupancy.capacity - occupancy.used))
    : null;
  var turnsLeft = avgPerTurn !== null && avgPerTurn > 0 && remaining !== null
    ? Math.max(0, Math.floor(remaining / avgPerTurn))
    : null;
  var overRatioText = budget.ratio >= 1 ? "超 " + budget.ratio.toFixed(1) + " 倍" : "";
  var detail = hasReading
    ? (meterMode === "budget"
        ? "已用 ~" + formatWan(usedTokens) + " tok / 预算 " + formatWan(budget.critical) + "（" + percent + "%"
          + (overRatioText === "" ? "" : "，" + overRatioText) + "）"
          + " · 占模型窗口 " + windowPercent + "%（模型窗口 " + formatTokens(occupancy.capacity) + "）"
          + " · 到线还剩 ~" + formatTokens(remaining)
          + (turnsLeft !== null ? " · 约还能聊 " + turnsLeft + " 轮（最近 " + jumps.length + " 轮均值 ~" + formatTokens(avgPerTurn) + "/轮）" : "")
        : "上下文占用 " + percent + "% · ~" + formatTokens(occupancy.used) + " / " + formatTokens(occupancy.capacity)
          + " · 剩余 ~" + formatTokens(remaining)
          + (turnsLeft !== null ? " · 约还能聊 " + turnsLeft + " 轮（最近 " + jumps.length + " 轮均值 ~" + formatTokens(avgPerTurn) + "/轮）" : ""))
    : "上下文占用未知（发一条消息后显示）";
  var tip = detail;
  // 还没有任何请求记录时不显示 "0%"（那看起来像坏了），显示一个短横。
  var pctText = hasReading ? percent + "%" : "—";
  var shortText = hasReading
    ? (meterMode === "budget"
        ? "已用 ~" + formatWan(usedTokens) + " / " + formatWan(budget.critical) + " tok" + (overRatioText === "" ? "" : " · " + overRatioText)
        : percent + "% · 剩余 ~" + formatTokens(remaining) + (turnsLeft !== null ? " · 约还能聊 " + turnsLeft + " 轮" : ""))
    : "上下文占用未知";

  // ── 时间维度：把"已聊多久 / 还能聊多久"算出来并拼进提示与那一行文字 ──────────
  // v1.18.0 修正：宿主半给的创建时间，只有在"它答的确实是当前这条会话"时才敢用 ——
  // 它拿不到当前会话时会退回它自己记的上一个会话，直接信它就会把上次的已聊时长顶到这次头上。
  var serverStartedAt = sessionInfo !== null && sessionInfo !== undefined && typeof sessionInfo.startedAt === "number"
    && isFinite(sessionInfo.startedAt) && sessionInfo.startedAt > 0
    ? sessionInfo.startedAt : null;
  var serverAnswersThisSession = serverStartedAt !== null && sessionId.length > 0
    && typeof sessionInfo.sessionId === "string" && sessionInfo.sessionId === sessionId;
  // v1.19.0：宿主半与浏览器半版本不一致时，在进度条下面那行小字里直说（设置页自检那条保留不动）。
  var hostVersion = sessionInfo !== null && sessionInfo !== undefined && typeof sessionInfo.hostVersion === "string"
    ? sessionInfo.hostVersion : "";
  var versionNote = hostVersion !== "" && hostVersion !== CLIENT_VERSION
    ? "⚠️ 插件浏览器半 v" + CLIENT_VERSION + " 与宿主半 v" + hostVersion + " 不一致：重启一次 DSH 才会全部生效"
    : "";
  // 活跃时长心跳：每 5 秒走一步，断档（超过 5 分钟没动静）不计入；按会话 id 各自记账，绝不跨会话。
  React.useEffect(function () {
    if (sessionId.length === 0) return;
    // 页面隐藏（后台标签页）时这次心跳整个跳过：不累加、不写账本（v1.19.0）。
    if (pageHidden()) return;
    var rec = activeRef.current;
    if (rec.id !== sessionId) {
      var stored = readActiveRecord(sessionId);
      rec.id = sessionId;
      rec.totalMs = stored === null ? 0 : stored.totalMs;
      rec.lastAt = stored === null ? 0 : stored.lastAt;
      rec.savedAt = 0;
    }
    var next = activeElapsed({ totalMs: rec.totalMs, lastAt: rec.lastAt }, now,
      serverAnswersThisSession ? serverStartedAt : null, null);
    rec.totalMs = next.totalMs;
    rec.lastAt = next.lastAt;
    // 多标签互斥（v1.19.0）：只有抢到记账锁的标签才落盘，没抢到的只读显示，避免时长翻倍。
    if (rec.totalMs > 0 && (rec.savedAt === 0 || now - rec.savedAt >= 30000)) {
      if (heartbeatIsLeader(sessionId, now)) {
        writeActiveRecord(sessionId, rec.totalMs, rec.lastAt);
        rec.savedAt = now;
      }
    }
    if (next.totalMs !== activeSessionMs) setActiveSessionMs(next.totalMs);
  }, [now, sessionId, serverAnswersThisSession, serverStartedAt]);
  var elapsedText = sessionId.length === 0 ? "" : (activeSessionMs > 0 ? formatDuration(activeSessionMs) : "刚刚");
  var startClock = serverAnswersThisSession ? formatClock(serverStartedAt) : "";
  // 实测消耗速率：拿最近 45 分钟的读数采样点算 token/分钟。v1.18.0 起门槛放宽到 20 秒，
  // 采样不够就直接用"最近两次轮次跃升"的斜率兜底 —— 聊得快的会话两轮常常不到一分钟，
  // 以前卡 60 秒会让这一格一直显示 "—"（发哥反馈"上一轮就没显示"）。
  var samples = Array.isArray(samplerRef.current.state.samples) ? samplerRef.current.state.samples : [];
  var ratePerMinute = tokensPerMinute(samples, RATE_MIN_SPAN_MS);
  var rateFromTurnJumps = false;
  if (ratePerMinute === null) {
    ratePerMinute = rateFromJumps(samplerRef.current.state.jumpTimes, samplerRef.current.state.jumps);
    rateFromTurnJumps = ratePerMinute !== null;
  }
  // 读数新鲜度：token 读数只在上一次请求结束后才更新，说清楚"这是几分钟前的读数"，
  // 免得看着时间在走、百分比不动就以为进度条坏了。
  var lastUsedAtValue = samplerRef.current.state.lastUsedAt;
  var readingAgeMs = lastUsedAtValue > 0 ? Math.max(0, now - lastUsedAtValue) : null;
  var staleText = readingAgeMs !== null && readingAgeMs >= 120000 ? "上次读数 " + formatDuration(readingAgeMs) + "前" : "";
  if (elapsedText !== "") {
    detail += " · 已聊 " + elapsedText + (startClock === "" ? "" : "（本会话开始于 " + startClock + "）")
      + "（只算这个会话在聊的时间，断开的不算）";
  }
  if (ratePerMinute !== null) {
    detail += " · 实测 ~" + formatTokens(Math.round(ratePerMinute)) + "/分"
      + (turnsLeft === null ? "" : "（照这个速度，到线大约还有 " + turnsLeft + " 轮）");
  }
  if (staleText !== "") detail += " · " + staleText;
  // 本条会话花了多少钱（v1.14.0）：token 是抽象单位，钱才有体感；也顺手印证"输出比缓存读贵 200 倍"。
  var sessionCost = costInfo !== null && costInfo !== undefined && costInfo.session !== null && costInfo.session !== undefined
    && typeof costInfo.session.costCNY === "number" && isFinite(costInfo.session.costCNY)
    ? costInfo.session.costCNY : null;
  var costText = sessionCost === null ? "" : formatCny(sessionCost);
  if (costText !== "") detail += " · 本条会话 ≈" + costText;
  tip = detail;
  var shortParts = [hasReading
    ? (meterMode === "budget"
        ? "已用 ~" + formatWan(usedTokens) + " / " + formatWan(budget.critical) + " tok" + (overRatioText === "" ? "" : " · " + overRatioText)
        : percent + "% · 剩余 ~" + formatTokens(remaining))
    : "上下文占用未知"];
  if (elapsedText !== "") shortParts.push("已聊 " + elapsedText);
  if (costText !== "" && ui.showCost !== false) shortParts.push("≈" + costText);
  if (ratePerMinute !== null) shortParts.push("实测 ~" + formatTokens(Math.round(ratePerMinute)) + "/分");
  else if (turnsLeft !== null && meterMode !== "window") shortParts.push("约还能聊 " + turnsLeft + " 轮");
  if (hasReading && meterMode === "window") shortParts.push("剩余 ~" + formatTokens(remaining));
  shortText = shortParts.join(" · ");
  // 提醒文案：budget 口径下是"该开新会话了"，window 口径沿用原来的两句话。
  var alertLine = tone === "ok" ? null
    : (meterMode === "budget"
        ? (tone === "critical" ? "🚨 该开新会话了" : "⚠️ 快到你的提醒线了")
        : alert.line);
  var alertSub = tone === "ok" ? "" : (meterMode === "budget"
    ? "已 ~" + formatWan(usedTokens) + " tok（预算 " + formatWan(budget.critical) + (overRatioText === "" ? "，到 " + formatWan(budget.warn) + " 提醒" : "，" + overRatioText + "）")
      + " · 先点「总结要点」再开新会话"
    : "这是「占模型窗口」口径（" + windowPercent + "%），不代表花钱少 —— 切到预算口径更直观");
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

  /**
   * 一键把"交接摘要"要求交给用户：
   * ① 先试着直接写进输入框（DSH 的编辑器受控，未必吃）；
   * ② 写不进去就复制到剪贴板；③ 连剪贴板也不可用，就把整句话显示出来。
   * 全程不自动发送 —— 免得误触把话发出去。
   * v1.19.0：要求里带 <<<HANDOFF>>> / <<<END>>> 标记，模型只回一段带标记的摘要正文，
   * 界面监听到标记后自己调宿主接口落盘（不再要求模型用 write 工具写文件）。
   */
  function askSummary() {
    if (fillComposer(HANDOFF_PROMPT)) {
      setSumNotice("已把「总结要点」写进输入框：按回车发给它 —— 它会回一段带 " + HANDOFF_MARK_START + " 标记的摘要，界面自己落盘成 " + HANDOFF_FILE + "。");
      return;
    }
    var done = function (ok) {
      setSumNotice(ok
        ? "已把交接要求复制到剪贴板：粘到输入框发给我就行（摘要会由界面落盘成 " + HANDOFF_FILE + "）"
        : "输入框写不进去（编辑器受控），请手动把这句话发给我：" + HANDOFF_PROMPT);
    };
    try {
      if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(HANDOFF_PROMPT).then(function () { done(true); }, function () { done(false); });
        return;
      }
    } catch (error) { /* 落到直接显示 */ }
    done(false);
  }

  /**
   * 换预算档（三个入口——进度条胶囊、横幅按钮、设置页——都走这里）：
   * ① 有会话 id → 只写「本会话临时档」，不碰设置页里的默认档；
   * ② 还没进会话（hero 态、拿不到 id）→ 改默认档，免得点了没反应；
   * ③ 传空串 = 清掉本会话临时档，回到默认档。
   * 顺手把「现在生效的两条线」反馈到进度条下面那行提示（.gs-dock-note）里。
   * @param {string} mode 档位 id，或空串（跟随默认）。
   */
  function applyBudgetMode(mode) {
    var id = normalizeBudgetMode(mode);
    if (sessionId === "") {
      var fallback = id === "" ? DEFAULT_BUDGET_MODE : id;
      setUiPrefs({ budgetMode: fallback });
      setSumNotice("默认预算档已设为「" + budgetModeLabel(fallback) + "」。");
      return;
    }
    writeSessionMode(sessionId, id);
    var next = resolveBudgetMode(ui.budgetMode, id, ui.budgetWarn, ui.budgetCritical);
    setSumNotice(id === ""
      ? "已清掉本会话的临时档，回到默认「" + budgetModeLabel(next.mode) + "」（" + formatWan(next.warn) + " 提醒 / " + formatWan(next.critical) + " 必须换）。"
      : "本会话预算档：「" + budgetModeLabel(id) + "」" + formatWan(next.warn) + " 提醒 / " + formatWan(next.critical)
        + " 必须换 —— 只影响这条会话，开新会话即失效。");
  }

  // 导航条式进度条：一辆小车随占用前进，车头实时显示百分比；
  // 颜色按两段式色带随占用变化（0% 安全色 → 黄色阈值 → 红色阈值），到达红色阈值整条纯色并呼吸。
  // 左右内边距由 composerInsets() 实时量出，因此长度始终与输入框对齐、随其缩放。
  var scheme = schemeOf(ui.scheme);
  var palette = scheme.colors;
  // 条子上的位置：budget 口径可以超过 100%（超预算），但画的时候封顶 100%，超出的部分靠横幅说。
  var barPercent = Math.max(0, Math.min(100, percent));
  var color = rampColor(barPercent, barWarnPercent, barCriticalPercent, palette);
  var scale = barScale(barWarnPercent, barCriticalPercent, palette);
  var scaleFaint = barScale(barWarnPercent, barCriticalPercent, palette, 0.22);
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
  // 方案 7 的"贯通线"用当前状态色实色（配色 A：进度条颜色跟占用一致）：
  // 走到哪里就是哪一档的颜色 —— 安全绿 / 提醒黄 / 必须换红；未走到的部分仍留淡色色带（--gs-scale-faint）。
  var stateColor = critical ? palette[2] : (tone === "warn" ? palette[1] : palette[0]);
  var clampLeft = "clamp(" + Math.round(barHeight + 10) + "px, " + barPercent + "%, calc(100% - " + Math.round(barHeight + 10) + "px))";
  var markerNode = markerImage !== ""
    ? React.createElement("img", { className: "gs-marker-img", src: markerImage, alt: "" })
    : React.createElement("span", { className: "gs-marker-emoji" }, marker);

  // 预算档入口（v1.14.0 改成"点开选"）：以前点一下是四档轮转 —— 轮到了哪一档、当前算会话档还是
  // 默认档，全得靠猜。现在点开就是一个列表：四档各自的线都写着，当前档高亮，并注明它从哪来。
  var modeLabel = budgetModeLabel(modeInfo.mode);
  var modeScopeText = modeInfo.scope === "session" ? "本会话临时档（不影响默认）" : "跟随默认档";
  // v1.18.0（发哥提问"日常跟跟随默认档是不是重复了"）：确实重复了 —— 那时"当前档那一行"和
  // 菜单最后一行"跟随默认档"都在说同一件事。现在的规则：当前生效档只在**它自己那一行**标
  // "✓ 来源 · 当前"；「跟随默认档」只在本会话设了临时档时才作为**还原操作**出现。
  var modeSourceText = modeInfo.scope === "session" ? "本会话临时档"
    : (modeInfo.scope === "global" ? "来自默认档" : "内置默认");
  var menuPair = React.useState(false);
  var modeMenuOpen = menuPair[0];
  var setModeMenuOpen = menuPair[1];
  // v1.16.0：胶囊本体不再单独成行 —— 「预算档」成了 KPI 那一排的第四格（样式与占用/花费/时长
  // 完全一致），点那格弹出下面这张菜单；菜单挂在格子里向上弹（原来 fixed 不带坐标，滚动后会漂）。
  var modeMenuNode = modeMenuOpen === true
      ? React.createElement("div", { className: "gs-mode-menu" },
          BUDGET_MODES.map(function (item) {
            var active = item.id === modeInfo.mode;
            return React.createElement("button", {
              key: "pick-" + item.id, type: "button",
              className: active ? "gs-mode-item gs-mode-item-on" : "gs-mode-item",
              title: item.hint,
              onClick: function () { setModeMenuOpen(false); applyBudgetMode(item.id); }
            },
              React.createElement("b", null, item.label),
              React.createElement("span", null, item.warn === null
                ? "用手填的黄线 / 红线"
                : formatWan(item.warn) + " 提醒 / " + formatWan(item.critical) + " 换"),
              active ? React.createElement("i", null, "✓ " + modeSourceText + " · 当前") : null
            );
          }).concat(modeInfo.scope === "session" ? [
            React.createElement("button", {
              key: "pick-default", type: "button",
              className: "gs-mode-item",
              title: "清掉本会话的临时档，回到设置页里选的默认档",
              onClick: function () { setModeMenuOpen(false); applyBudgetMode(""); }
            },
              React.createElement("b", null, "跟随默认档"),
              React.createElement("span", null, "清掉本会话的临时档，回到默认档")
            )
          ] : [])
        )
      : null;

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
      style: { width: barPercent + "%", background: stateColor }
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
      ? React.createElement("button", { type: "button", className: "gs-dock-new", onClick: askSummary }, "总结要点")
      : null,
    canStartSession && alertLine !== null
      ? React.createElement("button", { type: "button", className: "gs-dock-new", onClick: openNewSession }, "开新会话")
      : null
  );
  // 进度条下的信息行（"完整"形态才有；紧凑/纯文字形态把读数并进那一行文字里）。
  // v1.15.0：花费与"已聊多久"搬进了方案 7 的三格读数（左中右三格），这里不再重复渲染，
  // 只留两个三格里没有的数：实测速率与读数新鲜度。
  var showTime = ui.showTime !== false;
  // v1.16.0：「实测速率」从这一行小字升成 KPI 那一排的第五格（样式与占用/花费/时长一致）；
  // v1.17.0（发哥要求）："到线约还有几轮"也从这一行搬进那一排，紧跟实测速率之后，样式一致 ——
  // 这一行只剩"读数新鲜度"，没内容就整行不渲染。
  var rateKpiText = ratePerMinute === null ? "" : "~" + formatTokens(Math.round(ratePerMinute)) + "/分";
  var turnsKpiText = turnsLeft === null ? "" : turnsLeft + " 轮";
  var staleSpan = staleText === "" ? null : React.createElement("span", null, "· " + staleText);
  // v1.19.0（发哥要求）：这一行末尾再加一段「上一轮 ↑X.X 万」—— 上一轮回复让上下文涨了多少。
  // 数据就是采样账本里最近一次轮次跃升；没有（还没聊满两轮）就整段不显示。涨幅 ≥ 5 万标警示色。
  var lastRise = lastJumpRise(samplerRef.current.state);
  var riseWarn = lastRise !== null && lastRise >= RISE_WARN_TOKENS;
  var riseSpan = lastRise === null ? null
    : React.createElement("span", {
        className: "gs-dock-rise" + (riseWarn ? " gs-dock-rise-warn" : ""),
        title: "上一轮回复让上下文涨了 " + formatTokens(lastRise) + " tok"
          + (riseWarn ? "（单轮涨这么多，多半是工具调用或大文件读进来的）" : "")
      }, (staleSpan === null ? "" : "· ") + "上一轮 ↑" + formatWan(lastRise));
  // ── 方案 7（v1.15.0）：上面三格读数（占用 / 花费 / 时长），下面一条贯通进度线 ──────────
  // 三格已经承担了"读数"职责，所以"完整"形态下时间行只留两个不重复的信息：
  // 实测速率（token/分，确实发生过的数）与读数新鲜度；两个都没有就整行不渲染，不留空行。
  // v1.16.0（发哥要求）：这一排除了占用 / 花费 / 时长三格，再加「预算档」与「实测速率」两格 ——
  // 同样的"上面小标签 + 下面同色数字胶囊"样式。预算档那格是可点的（弹出换档菜单），
  // 所以它渲染成 <button>；格数决定列数（4 / 5 / 6），窄窗口由 CSS media query 退回 3 / 2 列。
  // v1.17.0（发哥要求）：再加第六格「到线约还有 N 轮」，位置就在「实测速率」右边。
  var kpiCells = display === "full"
    ? dockKpiCells({
        hasReading: hasReading,
        occupancyText: meterMode === "budget" ? formatWan(usedTokens) : percent + "%",
        limitText: "/ " + (meterMode === "budget" ? formatWan(budget.critical) : formatWan(occupancy.capacity)),
        // v1.19.0：占用格的悬停说明 —— 把"这个数怎么来的、多久刷新一次"写清楚（以前只有数字）。
        occupancyTip: occupancyTip({
          usedTokens: hasReading ? usedTokens : null,
          warn: budget.warn,
          critical: budget.critical,
          capacity: occupancy.capacity,
          meterMode: meterMode
        }),
        costText: ui.showCost === false ? "" : costText,
        elapsedText: elapsedText,
        showMode: true,
        modeText: modeLabel,
        modeSuffix: modeInfo.scope === "session" ? "本会话" : "",
        showRate: showTime,
        rateText: rateKpiText,
        showTurns: showTime,
        turnsText: turnsKpiText,
        tone: tone,
        palette: palette,
        dark: dockDark
      })
    : [];
  var kpiValInner = function (cell) {
    return cell.suffix === ""
      ? cell.value
      : [cell.value, React.createElement("i", { key: "sfx" }, " " + cell.suffix)];
  };
  var kpiNode = display === "full"
    ? React.createElement("div", { className: "gs-dock-kpis gs-dock-kpis-" + kpiCells.length, title: detail },
        kpiCells.map(function (cell) {
          var cellStyle = {};
          if (cell.color !== "") cellStyle.color = cell.color;
          if (cell.background !== "") cellStyle.background = cell.background;
          if (cell.key === "mode") {
            return React.createElement("div", { className: "gs-dock-kpi gs-dock-kpi-mode", key: "kpi-" + cell.key },
              React.createElement("span", { className: "gs-dock-kpi-lab" }, cell.label),
              React.createElement("button", {
                type: "button",
                className: "gs-dock-kpi-val gs-kpi-btn",
                style: cellStyle,
                "aria-expanded": modeMenuOpen === true,
                title: "当前预算档「" + modeLabel + "」：" + formatWan(budget.warn) + " 提醒 / " + formatWan(budget.critical)
                  + " 必须换 · " + modeScopeText + " · " + budgetModeHint(modeInfo.mode) + " · 点开可以换档",
                onClick: function () { setModeMenuOpen(modeMenuOpen !== true); }
              }, kpiValInner(cell)),
              modeMenuNode
            );
          }
          return React.createElement("div", {
            className: "gs-dock-kpi", key: "kpi-" + cell.key,
            // v1.19.0：占用格自带说明（采样口径），其余格没有就回落到整排的 title。
            title: cell.title === "" ? undefined : cell.title
          },
            React.createElement("span", { className: "gs-dock-kpi-lab" }, cell.label),
            React.createElement("span", { className: "gs-dock-kpi-val", style: cellStyle }, kpiValInner(cell))
          );
        })
      )
    : null;
  var metaNode = display === "full" && showTime && (staleSpan !== null || riseSpan !== null)
    ? React.createElement("div", { className: "gs-dock-time", title: detail }, staleSpan, riseSpan)
    : null;
  // 上下文构成明细（v1.14.0）：只告诉"用了多少"没用，得说清"是谁占的"才谈得上砍。
  // 数据由宿主半读本机上下文投影（contextTimeline），这里纯展示；默认收起，点标题才展开。
  // v1.19.0：已经有读数、却始终拿不到花费明细 → 说明宿主半没响应、或本会话还没有投影文件，
  // 直说原因，比只显示一个「—」有用（也顺带提示"重启一次 DSH"这条常见解法）。
  var sourceNote = hasReading && (costInfo === null || costInfo === undefined)
    ? "ℹ️ 拿不到花费明细：宿主半没响应、或本会话还没有投影（重启一次 DSH 试试）"
    : "";
  var parts = partsInfo !== null && partsInfo !== undefined && Array.isArray(partsInfo.parts) ? partsInfo.parts : [];
  var partsOpen = ui.showParts === true;
  // v1.15.3：标题不再带「（这些 token 是谁占的）」这截解释 —— 展开后哪一行是谁占的一目了然，
  // 解释留在 title 提示里，标题本身短一点（红卡里那行是加粗白字，太长反而不像标题）。
  var partsNode = parts.length === 0 ? null
    : React.createElement("div", { className: "gs-dock-parts" },
        React.createElement("button", {
          type: "button", className: "gs-dock-parts-toggle",
          title: "展开看这些 token 是谁占的（按占比排序，前几名就是能砍的地方）",
          onClick: function () { setUiPrefs({ showParts: partsOpen !== true }); }
        }, (partsOpen ? "▾ " : "▸ ") + "上下文构成"),
        partsOpen
          ? React.createElement("div", { className: "gs-parts-list" },
              parts.map(function (item, index) {
                var share = typeof item.share === "number" && isFinite(item.share) ? item.share : 0;
                // 每行一个自己的颜色（红底白条看不清谁是谁，见 PART_COLORS 注释）
                var partColor = PART_COLORS[index % PART_COLORS.length];
                return React.createElement("div", { className: "gs-parts-row", key: "part-" + index },
                  React.createElement("span", { className: "gs-parts-label", title: String(item.key === undefined ? "" : item.key) }, String(item.label === undefined ? item.key : item.label)),
                  React.createElement("span", { className: "gs-parts-track" },
                    React.createElement("span", { className: "gs-parts-fill", style: { width: Math.max(2, Math.round(share * 100)) + "%", "--gs-part-color": partColor } })),
                  React.createElement("span", { className: "gs-parts-num" }, formatWan(item.tokens) + " · " + Math.round(share * 100) + "%")
                );
              }),
              React.createElement("div", { className: "gs-hint" },
                partsInfo !== null && partsInfo !== undefined
                  && (typeof partsInfo.partsTokens === "number" || typeof partsInfo.surfaceTokens === "number")
                  ? "合计 ~" + formatWan(typeof partsInfo.partsTokens === "number" ? partsInfo.partsTokens : partsInfo.surfaceTokens)
                    + " tok，按占比排序（前几名就是能砍的地方）"
                  : "按占比排序")
            )
          : null
      );
  // 到线建议（v1.14.0）：只说一句"按数字看该抬线/该降档"，按钮就在旁边，但不自动改档 ——
  // 换档是用户的决定，插件只负责把"现在这个档合不合适"讲清楚。
  var suggestNode = budgetSuggest === "" ? null
    : React.createElement("div", { className: "gs-dock-suggest" },
        React.createElement("span", { className: "gs-dock-suggest-text" }, "💡 " + budgetSuggest),
        modeInfo.mode === "big"
          ? React.createElement("button", {
              type: "button", className: "gs-dock-new",
              onClick: function () { applyBudgetMode("daily"); }
            }, "降回日常")
          : React.createElement("button", {
              type: "button", className: "gs-dock-new",
              onClick: function () { applyBudgetMode("big"); }
            }, "切大任务")
      );
  // 到线/超线的**大横幅**：不用去读百分比，一眼就知道该开新会话了。
  // 红线是红底白字 + 呼吸；黄线是淡黄底。文字给"已用多少 / 预算多少 / 超了几倍"。
  // v1.15.1：横幅不再单飞 —— 「上下文构成」与「档位建议」并进同一张卡（卡内细线分隔），
  // 三块信息共用同一个边框与底色；卡内展开明细时停掉呼吸闪动（一闪一闪没法逐行读数）。
  var buildBanner = function (withExtras) {
    if (tone === "ok") return null;
    return React.createElement("div", {
      className: "gs-dock-banner " + (critical ? "gs-dock-banner-critical" : "gs-dock-banner-warn")
        + (withExtras === true && partsOpen === true ? " gs-dock-banner-open" : "")
    },
    React.createElement("div", { className: "gs-dock-banner-top" },
    React.createElement("span", { className: "gs-dock-banner-main" },
      React.createElement("span", { className: "gs-dock-banner-title" }, alertLine),
      React.createElement("span", { className: "gs-dock-banner-sub" }, alertSub)
    ),
    React.createElement("span", { className: "gs-dock-actions" },
      modeInfo.mode === "big"
        ? null
        : React.createElement("button", { type: "button", className: "gs-dock-new", title: "把本会话的预算线抬到 15 万/20 万（大任务模式，只影响这条会话）", onClick: function () { applyBudgetMode("big"); } }, "切大任务"),
      modeInfo.scope === "session"
        ? React.createElement("button", { type: "button", className: "gs-dock-new", title: "清掉本会话的临时预算档，回到默认档", onClick: function () { applyBudgetMode(""); } }, "跟随默认预算")
        : null,
      canStartSession
        ? React.createElement("button", { type: "button", className: "gs-dock-new", title: "把「交接摘要」的要求交给你（能写进输入框就写，否则复制到剪贴板）", onClick: askSummary }, "总结要点")
        : null,
      canStartSession
        ? React.createElement("button", { type: "button", className: "gs-dock-new", onClick: openNewSession }, "开新会话")
        : null
    )
    ),
    // 卡内下半张：上下文构成（可展开）+ 档位建议，各带一条细分隔线
    withExtras === true ? partsNode : null,
    withExtras === true ? suggestNode : null
    );
  };
  // 完整形态用带附加信息的卡；纯文字形态塞在行内，只保留标题行（不然一行塞不下）
  var bannerNode = buildBanner(true);
  var bannerNodeInline = buildBanner(false);
  return React.createElement("div", {
    className: dockClass,
    ref: dockRef,
    style: {
      "--gs-bar-h": (display === "compact" ? 4 : barHeight) + "px",
      "--gs-marker-extra": markerExtra + "px",
      "--gs-scale": scale,
      "--gs-scale-faint": scaleFaint,
      "--gs-percent": Math.max(1, barPercent),
      "--gs-danger": dangerColor
    }
  },
    React.createElement("div", { className: "gs-tip" }, tip),
    React.createElement("div", { className: "gs-dock-row", style: rowStyle },
      // v1.15.2：所有零件装进**同一个**胶囊容器（.gs-dock-stack）——
      // 三格读数 / 进度条 / 时间行 / 预算胶囊 / 到线横幅 / 上下文构成 / 档位建议 / 提示，
      // 共用一条边框、一个底色、一条左右边界；不再各起一方（既难看又多占纵向空间）。
      // 缩进仍只来自 .gs-dock-row 的 insets，所以内层白底不会撑出"多余白框"。
      React.createElement("div", { className: "gs-dock-stack", "data-gs-stack": "1" },
        // 方案 7：三格读数在最上（与输入框同宽同左右边界，缩进来自 .gs-dock-row 的 insets）
        kpiNode,
        display === "text" ? textNode : barNode,
        display === "full" ? metaNode : null,
        // 预算模式（v1.16.0）：完整形态下它是 KPI 那一排的第四格（见 kpiNode）；
        // 紧凑 / 纯文字形态没有那一排，就退回原来的小胶囊，保证任何形态都够得着换档。
        display === "full"
          ? null
          : React.createElement("div", { className: "gs-dock-mode" },
              React.createElement("button", {
                type: "button",
                className: "gs-mode-pill" + (modeInfo.scope === "session" ? " gs-mode-pill-on" : ""),
                "aria-expanded": modeMenuOpen === true,
                title: "当前预算档「" + modeLabel + "」：" + formatWan(budget.warn) + " 提醒 / " + formatWan(budget.critical)
                  + " 必须换 · " + modeScopeText + " · " + budgetModeHint(modeInfo.mode) + " · 点开可以换档",
                onClick: function () { setModeMenuOpen(modeMenuOpen !== true); }
              }, "🎯 " + modeLabel + (modeInfo.scope === "session" ? "（本会话）" : "")),
              modeMenuNode
            ),
        // 纯文字形态没有进度条和横幅的位置，所以把横幅也塞进行内（保持"一眼就知道"）
        display === "text" ? bannerNodeInline : null,
        display === "text" ? null : bannerNode,
        // 上下文构成明细 / 档位建议：到线时已经并进上面那张横幅卡里（一个边框一块信息），
        // 只有"没到线"时才各自独立成行 —— 没有卡可依附，就还是原来的轻量小字。
        display === "text" || tone !== "ok" ? null : partsNode,
        display === "text" || tone !== "ok" ? null : suggestNode,
        (sumNotice === "" && versionNote === "" && sourceNote === "") ? null
          : React.createElement("div", { className: "gs-dock-note" },
              versionNote === "" ? null : React.createElement("div", { className: "gs-dock-note-warn" }, versionNote),
              sourceNote === "" ? null : React.createElement("div", null, sourceNote),
              sumNotice === "" ? null : React.createElement("div", null, sumNotice))
      )
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
    // 深色档：两条选择器并行生效——
    //   ① body[data-ds-dark-theme]：DSH 官方深色主题；
    //   ② html[data-gs-dark="1"]：综合判定的结果（dark-only 皮肤只改 CSS 变量、不加官方属性，靠这条兜住）。
    if (line.colorDark !== "" || line.bgColorDark !== "" || line.borderColorDark !== "") {
      darkRules.push('body[data-ds-dark-theme] ' + cls + ',html[data-gs-dark="1"] ' + cls + '{' + lineCssDecls(line, true) + '}');
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
  // 含运行时变量的固定行：服务端会把 {model}/{count}/{elapsed}/{tokens} 换成具体值，
  // 页面这边用通配符匹配，数值换成多少都认得。
  if (wanted.runtimeNormRe !== undefined && wanted.runtimeNormRe !== null && wanted.runtimeNormRe.test(norm)) return true;
  // 逐字相同档只认"归一化后完全相同"（含标点），不做任何折叠
  if (mode === "exact") return false;
  var fold = foldFixedLine(rawText);
  if (fold.length > 0 && fold === wanted.fold) return true;
  if (wanted.runtimeFoldRe !== undefined && wanted.runtimeFoldRe !== null && fold.length > 0 && wanted.runtimeFoldRe.test(fold)) return true;
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
 * "本轮信息变量"名单：这些变量的值只有服务端知道（模型名、第几次调用、上一次耗时与用量），
 * 页面侧**不解析**它们，而是把它们换成通配符来匹配 —— 这样服务端换成任何数值都贴得上样式。
 * 名单必须与宿主半 index.mjs 的 RUNTIME_VARS 保持一致。
 */
var RUNTIME_VARS = ["model", "count", "elapsed", "lastelapsed", "tokens", "lasttokens"];

/**
 * 把含运行时变量的文案编译成"通配符正则"；不含这类变量时返回 null。
 * 做法：先把变量换成不可能出现的占位符 → 整体正则转义 → 再把占位符换成 `.+?`。
 * @param text - 已经过归一化或折叠的文案。
 * @returns {RegExp|null} 可用来匹配整行的正则。
 */
function runtimeVarRegex(text) {
  if (typeof text !== "string" || text.indexOf("{") < 0) return null;
  var hit = false;
  var marked = text.replace(/\{([a-zA-Z]+)\}/g, function (all, rawName) {
    if (RUNTIME_VARS.indexOf(String(rawName).toLowerCase()) < 0) return all;
    hit = true;
    return "\u0001";
  });
  if (!hit) return null;
  var escaped = marked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.split("\u0001").join(".+?") + "$");
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
      // 含 {model}/{count}/{elapsed}/{tokens} 时，值只有服务端知道 → 用通配符匹配整行
      runtimeNormRe: runtimeVarRegex(normalizeFixedLine(text)),
      runtimeFoldRe: runtimeVarRegex(foldFixedLine(text)),
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
      // 逐字包装要先还原：否则换动效后那一行会一直停在"一堆 span"的状态
      if (typeof el.getAttribute === "function" && el.getAttribute("data-gs-chars") === "1") unwrapChars(el);
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
      if (text.length > 0) {
        var compiled = compileWantedLine(pair[0], text, now);
        for (var i = 0; i < compiled.length; i += 1) list.push(compiled[i]);
      }
      // 文案池：池子里的每一句都要能贴上样式（宿主每轮挑哪一句由它自己决定，页面只负责"都认识"）。
      var poolCfg = state.config.pool;
      var poolList = poolCfg !== undefined && poolCfg.enabled === true && Array.isArray(poolCfg[pair[0]]) ? poolCfg[pair[0]] : [];
      for (var p = 0; p < poolList.length; p += 1) {
        var poolText = typeof poolList[p] === "string" ? poolList[p].trim() : "";
        if (poolText.length === 0 || poolText === text) continue;
        var poolCompiled = compileWantedLine(pair[0], poolText, now);
        for (var q = 0; q < poolCompiled.length; q += 1) list.push(poolCompiled[q]);
      }
      // 按工作区绑定的文案：页面不知道当前是哪个工作区，但匹配是"逐字相等"，把全部绑定文案都当候选最稳。
      var wsCfg = state.config.perWorkspace;
      var wsList = wsCfg !== undefined && wsCfg.enabled === true && Array.isArray(wsCfg.items) ? wsCfg.items : [];
      for (var w = 0; w < wsList.length; w += 1) {
        var wsText = wsList[w] !== null && typeof wsList[w] === "object" && typeof wsList[w][pair[0]] === "string"
          ? wsList[w][pair[0]].trim()
          : "";
        if (wsText.length === 0 || wsText === text) continue;
        var wsCompiled = compileWantedLine(pair[0], wsText, now);
        for (var v = 0; v < wsCompiled.length; v += 1) list.push(wsCompiled[v]);
      }
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
      if (el.childElementCount > 1 && (typeof el.getAttribute !== "function" || el.getAttribute("data-gs-chars") !== "1")) continue;
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
    syncChars(el, line);
    marks.set(el, true);
  }

  /**
   * 逐字动效需要给每个字单独包一层 span，才能做出"一个字接一个字"的效果。
   * 只在**消息不再流式输出**、且元素是纯文本叶子时做：流式期间 React 会不停改写文本，
   * 这时动它的子节点容易和 React 打架；等消息定稿后再包，效果一样但不冒险。
   * @param {Element} el 固定行元素。
   * @param {Object} line 这一行的配置。
   */
  function syncChars(el, line) {
    var want = isPerCharAnimation(line.animation);
    var wrapped = typeof el.getAttribute === "function" && el.getAttribute("data-gs-chars") === "1";
    if (!want) {
      if (wrapped) unwrapChars(el);
      return;
    }
    if (wrapped) return;
    if (typeof el.closest === "function" && el.closest("[data-streaming]") !== null) return;
    if (typeof el.querySelector === "function" && el.querySelector("img") !== null) return;
    var parts = splitGraphemes(el.textContent || "");
    if (parts.length === 0 || parts.length > 60) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < parts.length; i += 1) {
      var span = document.createElement("span");
      span.className = "gs-char";
      span.style.setProperty("--gs-i", String(i));
      span.textContent = parts[i];
      frag.appendChild(span);
    }
    el.textContent = "";
    el.appendChild(frag);
    el.setAttribute("data-gs-chars", "1");
  }

  /** 把逐字包装还原成一段纯文本（切换动效或清理标记时用）。 */
  function unwrapChars(el) {
    el.textContent = el.textContent;
    if (typeof el.removeAttribute === "function") el.removeAttribute("data-gs-chars");
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

/* ─── 连接自愈：DSH 重启后，别让页面永远停在"自动重连中" ─────────────────── */

/**
 * DSH 自带文案里属于"连不上"的那几种；纯函数，便于单测。
 * - 连接异常 / 自动重连中（后面 1-3 个点每 500ms 前进）/ 立即重连（悬浮态）
 * - "连接成功"是恢复提示，**不算**卡住。
 * @param text - 元素文本（可能带省略号或零宽字符）。
 * @returns 是否属于连接异常提示。
 */
var RECONNECT_STUCK_RE = /^(自动重连中|连接异常|立即重连|重连失败|Reconnecting|Disconnected|Reconnect now)\s*[.。·…]*$/;

function isReconnectStuckText(text) {
  if (typeof text !== "string") return false;
  var clean = text.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "").replace(/\s+/g, " ").trim();
  return RECONNECT_STUCK_RE.test(clean);
}

/**
 * 页面上是不是正显示"连接异常"。
 * 只认叶子（childElementCount ≤ 1）且整段文本完全匹配，避免误伤正文里提到"重连"的文字。
 * @returns 是否可见连接异常提示。
 */
function reconnectStuckVisible() {
  if (typeof document === "undefined" || document.body === null) return false;
  var nodes = document.querySelectorAll("span,div,p,button,li");
  for (var i = 0; i < nodes.length; i += 1) {
    if (nodes[i].childElementCount > 1) continue;
    if (isReconnectStuckText(nodes[i].textContent)) return true;
  }
  return false;
}

/**
 * 输入框里有没有还没发出去的草稿。
 * 有草稿就不自动重载 —— 宁可多等一会儿，也不能把用户正在写的东西弄丢。
 * @returns 草稿是否存在。
 */
function composerHasDraft() {
  var el = findComposerEl();
  if (el === null) return false;
  return readComposerText(el).trim() !== "";
}

/** 自愈统计（设置页"诊断"区读取）。 */
var healStats = { checks: 0, stuck: 0, reloads: 0, lastAt: 0, lastWhy: "" };

var HEAL_KEY = "dsh-greet-signoff:selfheal";
var HEAL_TICK_MS = 5000;
var HEAL_STUCK_TICKS = 6; // 连续 30 秒都连不上才动手
var HEAL_MIN_GAP_MS = 60000;
var HEAL_MAX_PER_HOUR = 3;

/** 读本标签页这一小时里已经自动重载了几次（用 sessionStorage 跨重载累计，防死循环）。 */
function healBudget() {
  var empty = { count: 0, first: 0 };
  try {
    var raw = window.sessionStorage.getItem(HEAL_KEY);
    if (raw === null) return empty;
    var parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return empty;
    var count = typeof parsed.count === "number" ? parsed.count : 0;
    var first = typeof parsed.first === "number" ? parsed.first : 0;
    if (first === 0 || Date.now() - first > 3600000) return empty;
    return { count: count, first: first };
  } catch (error) {
    return empty;
  }
}

/** 记一次自动重载。 */
function healRecord() {
  var budget = healBudget();
  try {
    window.sessionStorage.setItem(HEAL_KEY, JSON.stringify({ count: budget.count + 1, first: budget.first === 0 ? Date.now() : budget.first }));
  } catch (error) { /* 隐私模式等场景写不了，照样重载 */ }
}

/**
 * 连接看门狗：DSH 每次重启都会换访问令牌，已经打开的页面手里的旧握手就永远续不上了，
 * 界面会一直停在"自动重连中"（官方文案本身建议手动重开/刷新）。
 * 这里做成自动的：连续 30 秒看到连接异常、且服务端本身可达（`/` 还是 200）、且输入框没有草稿时，
 * 自动重载一次页面 —— 重载会用 cookie 重新握手，页面就自己活了。
 * 边界：服务真挂了（探活失败）不重载，避免刷屏；本标签页每小时最多 3 次，两次之间至少隔 60 秒。
 * @param ctx - 本行的插件上下文（定时器挂在它上面，插件停用即自动清掉）。
 */
function installConnectionWatchdog(ctx) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof window.fetch !== "function") return;
  var stuckTicks = 0;
  var reloading = false;
  var lastReloadAt = 0;

  function canReload() {
    if (reloading) return false;
    if (lastReloadAt !== 0 && Date.now() - lastReloadAt < HEAL_MIN_GAP_MS) return false;
    return healBudget().count < HEAL_MAX_PER_HOUR;
  }

  function reloadNow() {
    reloading = true;
    lastReloadAt = Date.now();
    healRecord();
    healStats.reloads += 1;
    healStats.lastAt = Date.now();
    healStats.lastWhy = "服务可达但界面停在重连，已自动重载";
    // 等一拍再重载，让这一轮渲染和统计先落定。
    window.setTimeout(function () { window.location.reload(); }, 400);
  }

  function tick() {
    healStats.checks += 1;
    if (!reconnectStuckVisible()) { stuckTicks = 0; return; }
    stuckTicks += 1;
    healStats.stuck += 1;
    if (stuckTicks < HEAL_STUCK_TICKS || !canReload()) return;
    if (composerHasDraft()) { healStats.lastWhy = "输入框里有草稿，暂不重载"; return; }
    window.fetch(window.location.origin + "/", { cache: "no-store", credentials: "same-origin" })
      .then(function (response) {
        var status = response === undefined ? 0 : response.status;
        if (status === 200) { stuckTicks = 0; reloadNow(); return; }
        // 401/403：页面自己的登录态已经失效，重载只会换一张错误页，不动手更好。
        healStats.lastWhy = "页面登录态已失效（HTTP " + status + "），不自动重载";
      })
      .catch(function () { healStats.lastWhy = "服务暂时不可达，等它起来"; });
  }

  ctx.effect(function () {
    var timer = window.setInterval(tick, HEAL_TICK_MS);
    return function () { window.clearInterval(timer); };
  }, "greet-signoff:connection-watchdog");
}

/**
 * 调试钩子：把几个纯函数与统计挂到 window 上。
 * 用途：① 本仓库的自动化验证（无头 Chrome 里直接调 fillComposer，验证"总结要点"到底能不能写进输入框）；
 *      ② 出问题时在控制台敲 `__dshGreetSignoff` 就能看版本、自愈计数、输入框定位结果。
 * 只暴露只读信息与两个无害工具函数，插件停用时整个对象会被删掉。
 * @param ctx - 本行的插件上下文。
 */
function installDebugHook(ctx) {
  if (typeof window === "undefined") return;
  window.__dshGreetSignoff = {
    version: CLIENT_VERSION,
    findComposerEl: findComposerEl,
    readComposerText: readComposerText,
    fillComposer: fillComposer,
    composerHasDraft: composerHasDraft,
    contextAlert: contextAlert,
    healStats: healStats,
    stylerStats: stylerStats,
    summaryPrompt: SUMMARY_PROMPT
  };
  ctx.effect(function () {
    return function () {
      try { delete window.__dshGreetSignoff; } catch (error) { window.__dshGreetSignoff = undefined; }
    };
  }, "greet-signoff:debug-hook");
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
  // 方案 C：先把深浅判定装起来（结果写到 <html data-gs-dark>）。
  // 对话里那两行的深色档 CSS 就挂在这个标记上，所以它必须在贴样式之前算出来。
  ctx.effect(function () {
    ensureDarkWatch();
    return disposeDarkWatch;
  }, "greet-signoff:dark-watch");
  ctx.effect(function () {
    var tag = document.createElement("style");
    tag.dataset.plugin = "dsh-greet-signoff";
    tag.textContent = css();
    document.head.appendChild(tag);
    return function () { tag.remove(); };
  }, "greet-signoff:css");

  // 连接自愈要在 slots 检查之前装：即使 slots 服务没就绪，页面卡在"自动重连中"时也该能自救。
  installConnectionWatchdog(ctx);
  // v1.19.0 交接摘要监听：观察 document.body（不能假设 message-body 挂载时就存在 ——
  // hero 欢迎态下一条消息都没有），正文里出现标记就调宿主 /handoff 落盘。
  ctx.effect(function () {
    startHandoffWatcher();
    return stopHandoffWatcher;
  }, "greet-signoff:handoff-watch");
  // 调试钩子也提前挂：出问题时（哪怕设置页打不开）控制台里也能拿到版本与统计。
  installDebugHook(ctx);

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
    // 预算口径（"该开新会话了"就是按这条线算的）
    budgetReading: budgetReading,
    formatWan: formatWan,
    // 预算模式（大任务模式）：档位解析、切档轮转
    resolveBudgetMode: resolveBudgetMode,
    normalizeBudgetMode: normalizeBudgetMode,
    budgetModeLabel: budgetModeLabel,
    budgetModeHint: budgetModeHint,
    nextBudgetMode: nextBudgetMode,
    budgetModes: BUDGET_MODES,
    budgetModeCycle: BUDGET_MODE_CYCLE,
    // v1.14.0：长尾选项裁剪 + 金额写法（设置页精简 / 花费显示都靠这两个纯函数）
    pickOptions: pickOptions,
    // v1.19.0：长尾选项「精选 ↔ 全部」的统一文案与那条特殊项（配色/动效/车型共用）
    moreOptionLabel: moreOptionLabel,
    moreOption: moreOption,
    isMoreOptionValue: isMoreOptionValue,
    formatCny: formatCny,
    primeAnimations: PRIME_ANIMATIONS,
    primeSchemes: PRIME_SCHEMES,
    primeMarkers: PRIME_MARKERS,
    legacyLinesMax: LEGACY_LINES_MAX,
    // 深浅判定（方案 C）与进度条时间维度
    parseCssRgb: parseCssRgb,
    colorLuminance: colorLuminance,
    darkFromSignals: darkFromSignals,
    isDarkTheme: isDarkTheme,
    chatCss: chatCss,
    formatDuration: formatDuration,
    formatClock: formatClock,
    tokensPerMinute: tokensPerMinute,
    rateFromJumps: rateFromJumps,
    rateMinSpanMs: RATE_MIN_SPAN_MS,
    // v1.18.0：活跃时长记账 + 采样账本（按会话 id 分开存，刷新/切会话都不串）
    activeElapsed: activeElapsed,
    emptySampler: emptySampler,
    // v1.19.0：进度条「上一轮 ↑」/ 交接摘要标记解析 / 多标签账本互斥
    lastJumpRise: lastJumpRise,
    riseWarnTokens: RISE_WARN_TOKENS,
    extractHandoffText: extractHandoffText,
    handoffMarkStart: HANDOFF_MARK_START,
    handoffMarkEnd: HANDOFF_MARK_END,
    handoffMinChars: HANDOFF_MIN_CHARS,
    pickLeader: pickLeader,
    // v1.19.0：档位建议（按历史峰值）+ 计价口径（单价可配置 / 与台账对账）
    suggestBudget: suggestBudget,
    percentile90: percentile90,
    roundToStep: roundToStep,
    normalizePricing: normalizePricing,
    normalizePriceValue: normalizePriceValue,
    pricingIsDefault: pricingIsDefault,
    priceDefault: PRICE_DEFAULT,
    tabLockTtlMs: LOCK_TTL_MS,
    activeIdleMaxMs: ACTIVE_IDLE_MAX_MS,
    activeFreshMaxMs: ACTIVE_FRESH_MAX_MS,
    remainingTimeMs: remainingTimeMs,
    averageTurnMs: averageTurnMs,
    hexToRgb: hexToRgb,
    mixRgb: mixRgb,
    // v1.15.0：方案 7「KPI 三格」的读数与数字胶囊底（配色 A 语义色 + C 胶囊底）
    dockKpiCells: dockKpiCells,
    // v1.19.0：占用格的悬停说明（采样口径：上一次请求的 prompt + 之后新增，滞后一轮）
    occupancyTip: occupancyTip,
    tintOf: tintOf,
    rampColor: rampColor,
    barScale: barScale,
    lineCssDecls: lineCssDecls,
    matchModeLabel: matchModeLabel,
    isPerCharAnimation: isPerCharAnimation,
    isReconnectStuckText: isReconnectStuckText,
    sanitizePool: sanitizePool,
    sanitizePoolList: sanitizePoolList,
    sanitizeScenes: sanitizeScenes,
    sanitizeWorkspaceBindings: sanitizeWorkspaceBindings,
    pathKey: pathKey,
    lineStyleSource: lineStyleSource,
    normalizeCore: normalizeCore,
    runtimeVarRegex: runtimeVarRegex,
    findComposerEl: findComposerEl,
    readComposerText: readComposerText,
    contextAlert: contextAlert,
    matchLineText: matchLineText,
    splitGraphemes: splitGraphemes,
    renderLineText: renderLineText
  }
};
return module.exports; } });
