# Omnia Character Cognition for SillyTavern · Phase 0

这是独立的实验脚本，用来检验“检索到的资料先经过角色认知选择，再交给 SillyTavern 原有生成模型”是否真的改善角色扮演。它不是 Omnia 运行时移植，也不修改 SillyTavern 核心。默认 **OFF + mock**。已在本地 SillyTavern 1.19.0 与 TavernHelper 4.11.0 中完成加载和本机假模型接线测试；角色质量对照尚未进行。详见 [实际结果](docs/RESULTS.md)。

## 已实现的路径

```text
当前角色卡 + 最近对话 + 关键词匹配的绑定世界书
  → 有限候选证据（保留来源 ID；发言只是一项“声称”）
  → Mock 或本机 Jev 桥
  → 本轮私有 CognitionSnapshot
  → TavernHelper.injectPrompts({once:true})
  → SillyTavern 原有模型继续写对白
```

模式：`OFF` 不请求也不注入；`RELEVANCE` 选一项当前显著证据；`COGNITION` 额外选一个高层应答倾向；`DEBUG` 与 COGNITION 相同并在面板显示候选、结果、注入文字和延迟。Jev 不写对白。群聊暂时跳过；普通单角色聊天是验证对象。

## 本地构建

在 Windows PowerShell 进入 `E:\Codex_local\new_project\omnia-cognition-st`，运行：

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

这里需要 Node.js 22 或更新版本，不需要 Docker、WSL 或 Linux。构建会得到 `dist/omnia-cognition.js` 和 `dist/bridge-server.mjs`。依赖版本锁在 `package-lock.json`；安装时需要 npm 可访问包源，安装完成后测试与构建不需要网络。

## 安装到 SillyTavern

1. 按 [SillyTavern 官方安装说明](https://docs.sillytavern.app/installation/windows/)安装并启动 SillyTavern；通过其扩展管理器安装 [JS-Slash-Runner / TavernHelper](https://github.com/N0VI028/JS-Slash-Runner)。
2. 把 `dist/omnia-cognition.js` 复制到 SillyTavern 安装目录下的 `public/scripts/extensions/third-party/JS-Slash-Runner/omnia-cognition.js`。打开 TavernHelper 的[脚本库](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/%E5%9F%BA%E6%9C%AC%E7%94%A8%E6%B3%95/%E8%84%9A%E6%9C%AC%E5%BA%93.html)，新增并启用**全局后台脚本**，内容只需：

   ```js
   const script = document.createElement('script');
   script.src = '/scripts/extensions/third-party/JS-Slash-Runner/omnia-cognition.js';
   document.head.append(script);
   window.addEventListener('pagehide', () => script.remove(), { once: true });
   ```

   这是本次实机验证的加载方式。更新插件时重新构建、复制并刷新页面。全局脚本避免把实验代码写进角色卡。
3. 刷新页面。右下角应出现 `Omnia Cognition · Phase 0` 面板。先选 `mock`，再选 `RELEVANCE` 或 `COGNITION`，用单角色对话验证。`DEBUG` 会显示内部证据，注意不要在公开截图中泄露私密聊天内容。
4. 若脚本没有显示面板，先检查 TavernHelper 脚本库是否启用脚本，以及浏览器控制台的启动错误。当前版本已验证 iframe 能显示面板。

仓库中的 `.local-host/SillyTavern` 是这次创建的隔离测试安装，已由 `.gitignore` 排除，不属于插件交付源码。在本机可从该目录运行 `node server.js --port 8000`，再访问 `http://127.0.0.1:8000/`。`tests/live/openai-stub.mjs` 提供仅本机使用的假模型端点，供接线回归测试，不能用于评价回复质量。

## 使用本机 Jev 桥

只有在 mock 流程验证之后才切换 `bridge`。桥依赖同级 `../omnia-engine/packages/jev/dist` 已构建；它复用现有 `AiSdkJevClient`。在**运行桥的 PowerShell 窗口**设置 `AI_GATEWAY_API_KEY` 环境变量，然后运行：

```powershell
$env:ST_ALLOWED_ORIGIN = 'http://127.0.0.1:8000'
npm run bridge
```

密钥值应在该本机窗口中设置，不要贴进脚本、面板或角色卡。若 SillyTavern 实际地址是 `http://localhost:8000`，把 `ST_ALLOWED_ORIGIN` 改成这个完整来源（协议、主机、端口必须一致）。桥仅监听 `127.0.0.1:43187`。浏览器面板中的 `serviceUrl` 保持默认 `http://127.0.0.1:43187/jev/evaluate`。本轮未读取或使用任何真实密钥，也没有发起真实 Jev 请求。

## 阅读顺序

[REFERENCE_NOTES.md](REFERENCE_NOTES.md) → [架构](docs/ARCHITECTURE.md) → [安全边界](docs/SECURITY.md) → [实验方案](docs/EXPERIMENT.md) → [实际结果](docs/RESULTS.md)。
