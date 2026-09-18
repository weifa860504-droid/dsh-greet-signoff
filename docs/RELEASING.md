# 发版流程（维护者自用）

本仓库的发布物是 **npm 包 / git 仓库** 两种形态，内容以本目录的源码为准。
下面每一步都可复制执行；带 🔴 的步骤会改动本机正在使用的 DSH profile，建议挑空闲时机做。

## 0. 发版前自检（必须全绿）

```sh
node --check index.mjs
node --check client.js
node --test test/                      # 13 个纯函数单测（用最小 DOM 桩加载 client.js）
node scripts/verify-manifest.mjs       # 元数据 / 发布物清单 / 占位符 / CHANGELOG 版本一致性
npm pack --dry-run                     # 看一眼真正会被打包的文件
```

再确认三件事：

- `package.json` 的 `version` 已递增，且 `CHANGELOG.md` 里有对应小节；
- `package.json` 的 `dsh.compatibility.dshReleases` 里写的版本都是**本机实际跑过**的，不要凭猜写 `compatible`；
- `author` / `repository` / `homepage` / `bugs` / `LICENSE` 里的用户名是当前 GitHub 账号，没有残留占位符。

### 可选：开启 CI（当前仓库尚未启用）

`docs/ci-workflow.yml` 是一份现成的 GitHub Actions 工作流（语法检查 + 单测 + `verify-manifest` + `npm pack --dry-run` + 表情索引可解析）。
**启用只需 30 秒，在浏览器里做**（因为 token 权限限制，命令行推不上去）：

1. 打开 https://github.com/weifa860504-droid/dsh-greet-signoff/new/main/.github/workflows
2. 文件名填 `ci.yml`，把 `docs/ci-workflow.yml` 的内容整段粘进去
3. 点 **Commit changes**

> 为什么不能用命令行：**推送 `.github/workflows/` 下的文件要求 token 带 `workflow` 权限**
> （classic token 需在 `repo` 之外额外勾选，fine-grained token 需要 "Workflows" 写权限）。
> 缺这个权限时，GitHub 会**整条拒绝**这次 push（哪怕其它文件都合法），报错形如
> `refusing to allow a Personal Access Token to create or update workflow ... without workflow scope`；
> Contents API 走同一条校验，返回 404。给 token 补上 `workflow` 权限后，也可以直接
> `git mv docs/ci-workflow.yml .github/workflows/ci.yml && git-push.ps1 <repo> origin main` 一步到位。

### 可选：发布到 npm

包内容已经过 `npm pack --dry-run` 校验（`index.mjs` / `client.js` / `emoji-zh.json` / `cordis.patch.yml` / README / CHANGELOG / LICENSE / docs）。
发布需要你自己的 npm 账号：

```sh
npm login                 # 首次需要，浏览器或 OTP 登录
npm publish --access public
npm view dsh-greet-signoff version     # 回读确认
```

发布后用户可以直接 `dsh plugin --profile web add dsh-greet-signoff`（比 `github:` 安装更标准）。
若开了 2FA，`npm publish` 会要求一次性验证码。

## 1. 本机安装冒烟测试 🔴

在一台干净的 profile 或另一台机器上执行，确认"装 → 挂载 → 启动日志干净"：

```sh
# 从本地目录安装（开发调试用）
dsh plugin --profile web add <本仓库绝对路径>

# 或从 GitHub 安装（发布后）
dsh plugin --profile web add github:weifa860504-droid/dsh-greet-signoff
```

装完**必须重启** `dsh web`（本包声明了组合层，页面刷新不够）。重启后检查三处：

1. 输入框上方出现上下文占用导航条（空白新会话显示 `—`，发一条消息后出现百分比）；
2. 「设置 → 开场收尾」有配置页，改动能保存并在下一次回复生效；
3. 启动日志里没有 `greet-signoff` 相关的 `error`（服务缺失会打 `[greet-signoff] ... unavailable`）。

> 不想打扰正在使用的实例时，可以先用备用端口空跑：
> `node <npm 全局目录>/@deepseek-ai/dsh/lib/bin.js web --port 3099 --no-open`，
> 从 stdout 抓带 token 的地址验证，验完按 PID 精确结束进程（**不要**按进程名批量杀）。

## 2. 推到 GitHub

仓库首次创建（GitHub 网页或 API 都行）：

- 仓库名：`dsh-greet-signoff`，**public**，不要自动加 README / .gitignore（本仓库已有）；
- Description 一句话说清"是什么 + 能干什么"，不塞安装命令；
- Topics：`dsh-plugin`、`deepseek-harness`，再加 1–3 个功能词（`status-bar`、`ui`、`chat`）。

```sh
git init -b main            # 只有第一次需要
git add -A
git commit -m "feat: 开场语与收尾语 1.1.0"
git remote add origin https://github.com/weifa860504-droid/dsh-greet-signoff.git
git push -u origin main
git tag v1.1.0 && git push origin v1.1.0
```

> 本机目前没有装 git。替代方案是用 GitHub REST API + 个人访问令牌直接建仓并上传文件，
> 但常规做法仍是装一次 Git for Windows，后续维护都省事。

可选：到官方 Discussions 的 `Show Your Plugins!` 板块发一条介绍（**公开可见，需账号所有者本人同意**）。

## 3. 发布后

- 改代码后同步：本机运行目录 `$DSH_HOME/profiles/web/node_modules/dsh-greet-signoff` 指向本仓库
  （`dsh plugin add <本地路径>` 建的是 junction / link），**不是两份副本**，改完只需重启 `dsh web`；
  若当初是从 GitHub 装的，则重装一次即可。
- 版本号：每次发布前改 `package.json` 的 `version` + 补 `CHANGELOG.md` + 打 tag；
- 兼容性：在更高版本 DSH 上实测通过后，再往 `dshReleases` 里追加。

## 4. 目录约定

| 路径 | 作用 |
| --- | --- |
| `index.mjs` | 宿主半：系统提示段、`GET/POST /api/greet-signoff`、图片资产与 `$DSH_HOME/greet-signoff.json` 读写 |
| `client.js` | 浏览器半：设置页、通用页入口、输入区导航条、对话里固定行的样式 |
| `cordis.patch.yml` | 组合层：把本包作为一行插进 profile（`name` 必须与包名、目录名一致） |
| `scripts/verify-manifest.mjs` | 发布自检 |
| `docs/` | README 引用的截图与本文件 |
