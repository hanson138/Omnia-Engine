# Omnia Character Cognition · SillyTavern 扩展 0.2

这是一个可本地安装的 SillyTavern 原生 UI 扩展，用于检验“先筛选角色此刻在意的信息，再由 ST 原有模型写对白”是否改善角色扮演。它不修改 ST 核心，也不是 Omnia 世界运行时。默认 `OFF + mock`；真实 Jev 与长期对照质量尚未验证，详见[实测记录](docs/RESULTS.md)。

```text
当前角色卡 + 近期可见对话 + 绑定及已启用的全局世界书
  → 有来源 ID 的候选证据
  → mock 或本机 Jev 桥
  → 本轮 CognitionSnapshot
  → ST extension prompt（生成结束立即清理）
  → ST 已配置的主模型写对白
```

`OFF` 不请求也不注入；`RELEVANCE` 选择显著证据；`COGNITION` 再选择回应倾向；`DEBUG` 额外显示候选、选中 ID 与注入内容。当前只支持单角色聊天，群聊会在诊断中说明跳过。Jev 不负责写对白，也不把发言自动当作世界事实。

## 安装到本机 ST

需要 Node.js 22 或更新版本；不需要 Docker、WSL 或 Linux。本仓库已包含构建好的 `index.js`，所以**安装扩展时无需运行 npm**。先在 PowerShell 中进入本仓库，把下列路径改成你的 SillyTavern 安装目录：

```powershell
cd E:\Codex_local\new_project\omnia-cognition-st
.\scripts\install-local.ps1 -SillyTavernPath 'E:\path\to\SillyTavern'
```

如果你使用了 ST 多用户模式，另传 `-UserHandle '用户名'`。脚本检查 ST 和用户目录后，只复制 `manifest.json`、`index.js`、`style.css`。刷新 ST 页面，打开顶部**扩展程序**，在“Omnia · 角色认知”抽屉设置模式。先用 `mock + DEBUG` 做单角色接线测试；正式接 Jev 时再切换 `bridge`。如果之前启用了同名 TavernHelper 全局实验脚本，请先关闭它，否则会重复注入。

本仓库根目录已有 ST 所需的 `manifest.json`、`index.js` 与 `style.css`，以后放到可访问的 Git 仓库后，可用 ST 的“扩展程序 → 安装扩展程序”输入仓库 URL。**目前没有远程仓库或导入 URL。** 当前 ST 安装器只接受 HTTP(S) Git URL，不接受本机目录或 ZIP；上面的本机复制方式已实测。[ST 扩展安装说明](https://docs.sillytavern.app/extensions/)

本次隔离测试宿主位于 `.local-host/SillyTavern`，已被 Git 忽略。在该目录运行 `node server.js --port 8000` 可启动它。测试假模型可从本仓库运行 `node tests/live/openai-stub.mjs`；它只用于检查注入，不评价对白质量。

## 本机 Jev 桥

桥服务与 ST 主模型连接分开运行。它复用同级 `../omnia-engine/packages/jev/dist` 中的 `AiSdkJevClient`。在**启动桥的 PowerShell 窗口**设置 `AI_GATEWAY_API_KEY` 环境变量，然后在本仓库运行：

```powershell
$env:ST_ALLOWED_ORIGIN = 'http://127.0.0.1:8000'
npm run bridge
```

桥只监听 `127.0.0.1:43187`。若你的 ST 地址为 `http://localhost:8000`，请把 `ST_ALLOWED_ORIGIN` 改为完全相同的来源。扩展抽屉里的“检查本机桥”会报告桥是否运行、密钥是否配置，不会显示密钥值。**不要把网关密钥输入 ST 扩展、角色卡或世界书。** 本轮只验证了无密钥情况下的健康检查与失败开放，未发起真实 Jev 请求。

## 开发与阅读

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

`npm run build` 会更新根目录 `index.js`，同时构建旧 TavernHelper 实验包到 `dist/omnia-cognition.js` 和本机桥 `dist/bridge-server.mjs`。锁文件固定依赖版本；首次 `npm ci` 需要访问 npm，之后本地测试和构建无需网络。

先读[接口核对](REFERENCE_NOTES.md)、[架构与学习说明](docs/ARCHITECTURE.md)、[安全边界](docs/SECURITY.md)，再读[对照实验](docs/EXPERIMENT.md)和[实际结果](docs/RESULTS.md)。
