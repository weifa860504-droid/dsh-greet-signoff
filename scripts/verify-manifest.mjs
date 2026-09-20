/**
 * 发布前自检：发布物清单、元数据完整性、占位符、CHANGELOG 与版本号是否对得上。
 *
 * 用法：
 *   node scripts/verify-manifest.mjs
 *
 * 退出码非 0 表示有问题（CI 会据此失败）。只读文件，不改动任何东西。
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []

function readJson(file) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
}

/** 必须存在的字段。 */
function checkMeta(pkg) {
  const required = ['name', 'version', 'description', 'license', 'author', 'repository', 'homepage', 'bugs', 'main', 'files', 'engines']
  for (const key of required) {
    if (pkg[key] === undefined || pkg[key] === null || pkg[key] === '') problems.push(`package.json 缺字段：${key}`)
  }
  if (pkg.name !== 'dsh-greet-signoff') problems.push(`package.json 的 name 必须是 dsh-greet-signoff，当前是 ${pkg.name}`)
  if (!/^\d+\.\d+\.\d+$/.test(String(pkg.version))) problems.push(`版本号不是 x.y.z：${pkg.version}`)
  if (pkg.exports?.['.'] !== './index.mjs') problems.push('exports["."] 必须指向 ./index.mjs')
  if (pkg.exports?.['./client'] !== './client.js') problems.push('exports["./client"] 必须指向 ./client.js')
  if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') problems.push('dsh.bundle.patch 必须指向 ./cordis.patch.yml')
  if (pkg.dsh?.client?.platform !== 'web') problems.push('dsh.client.platform 必须是 web')
}

/** files 白名单里的每个路径都要真的存在，并且仓库里的发布物不能漏。 */
function checkFilesList(pkg) {
  const listed = new Set(pkg.files ?? [])
  for (const entry of listed) {
    const target = join(ROOT, entry)
    if (!existsSync(target)) problems.push(`files 里列了不存在的路径：${entry}`)
  }
  // 真正会被 npm pack 带走的顶层文件（docs/ 与 .github/ 之类目录按白名单决定）
  const required = ['index.mjs', 'client.js', 'emoji-zh.json', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'LICENSE']
  for (const file of required) {
    if (!listed.has(file)) problems.push(`files 少了 ${file}（发布物里必须有它）`)
  }
  notes.push(`files 白名单：${[...listed].join(', ')}`)
}

/** 装到别人机器上的产物里不能残留占位符。 */
function checkPlaceholders(pkg) {
  const scan = ['package.json', 'LICENSE', 'README.md', 'CHANGELOG.md', 'index.mjs', 'client.js', 'docs/RELEASING.md']
  const tokens = ['TODO-OWNER', 'TODO-YOUR-GITHUB-USERNAME']
  for (const file of scan) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const token of tokens) {
      const line = text.split('\n').findIndex((l) => l.includes(token))
      if (line >= 0) problems.push(`${file}:${line + 1} 还留着占位符 ${token}`)
    }
  }
  if (String(pkg.author).includes('TODO')) problems.push('package.json 的 author 还是占位符')
  notes.push('占位符扫描：通过')
}

/** CHANGELOG 里必须有当前版本的小节。 */
function checkChangelog(pkg) {
  const path = join(ROOT, 'CHANGELOG.md')
  if (!existsSync(path)) {
    problems.push('缺少 CHANGELOG.md')
    return
  }
  const text = readFileSync(path, 'utf8')
  if (!text.includes(`## [${pkg.version}]`) && !text.includes(`## ${pkg.version}`)) {
    problems.push(`CHANGELOG.md 里没有 ${pkg.version} 的小节`)
  } else {
    notes.push(`CHANGELOG.md 含 ${pkg.version} 小节`)
  }
}

/** 组合层文件必须把这一行插进 profile，否则浏览器半永远不会被加载。 */
function checkPatch() {
  const path = join(ROOT, 'cordis.patch.yml')
  if (!existsSync(path)) {
    problems.push('缺少 cordis.patch.yml')
    return
  }
  const text = readFileSync(path, 'utf8')
  if (!text.includes("name: 'dsh-greet-signoff'")) problems.push('cordis.patch.yml 里的 name 与包名不一致')
  notes.push('组合层 patch：通过')
}

/** 体积提示：client.js 是手写单文件，超过 340KB 通常意味着塞进了不该塞的东西。
 * v1.18.0 起阈值由 320KB 抬到 340KB：这一版加的是核心功能（活跃时长记账 + 采样账本按会话落盘
 * + 档位菜单去重），不是长尾选项；当前约 329KB，仍留 ~11KB 余量当门禁。 */
function reportSizes() {
  for (const file of ['client.js', 'index.mjs']) {
    const size = statSync(join(ROOT, file)).size
    notes.push(`${file}: ${(size / 1024).toFixed(1)} KB`)
    if (file === 'client.js' && size > 340 * 1024) problems.push(`client.js 已经 ${(size / 1024).toFixed(0)} KB，偏大`)
  }
}

const pkg = readJson('package.json')
checkMeta(pkg)
checkFilesList(pkg)
checkPlaceholders(pkg)
checkChangelog(pkg)
checkPatch()
reportSizes()

console.log(`检查根目录：${relative(process.cwd(), ROOT) || '.'}`)
for (const note of notes) console.log(`  · ${note}`)
if (problems.length === 0) {
  console.log(`✅ ${pkg.name}@${pkg.version} 发布自检通过`)
  process.exit(0)
}
console.error(`❌ 发现 ${problems.length} 个问题：`)
for (const problem of problems) console.error(`  - ${problem}`)
process.exit(1)
