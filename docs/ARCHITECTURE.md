# 架构与学习说明

原生扩展只接管“角色此刻应注意什么、倾向怎样回应”，不接管世界状态或对白生成。仓库根目录的 `manifest.json` 加载构建后的 `index.js` 与 `style.css`。`src/st-entry.ts` 连接 ST 事件与设置；`src/st-host.ts` 把 ST 当前角色、可见聊天及角色/聊天/全局世界书转成有限的 `HostContext`。`src/retrieval.ts` 用近期消息和关键词构造候选证据；`src/providers.ts` 产出只含来源 ID 的 `CognitionSnapshot`；`src/runtime.ts` 控制本轮注入与失效；`src/prompt.ts` 写出内部指导。`src/host.ts` 与 `src/index.ts` 保留为旧 TavernHelper 对照入口，不再是安装所需依赖。

普通玩家发送的事件顺序是：`GENERATION_AFTER_COMMANDS` → `MESSAGE_SENT`（这时用户消息才进入历史）→ 构造提示词 → 生成结束。扩展直接监听 ST 的 `eventSource`，在前者标记本轮，在后者读取消息并限时等待认知结果。重生成等没有新用户消息的操作则在前者评估。本地 ST 加假模型端点已验证普通发送路径。

注入由 ST 的 `setExtensionPrompt` 写入 extension prompt，而非可见聊天历史。`CognitionRuntime` 保存注入句柄，并在生成结束、停止、聊天变化和页面卸载时删除该 ID；本机请求实测下一轮 OFF 不携带旧块。扩展设置抽屉可改 role/depth，以便对照提示位置；默认 `system / depth 0` 只是实验起点。

异步请求开始时记录 chat ID、角色 ID、最后消息 ID 与本地 epoch。切换聊天或角色会增加 epoch 并 abort；结果回来后还要重新读取宿主上下文，四者都匹配才可注入。角色卡内容、发言、世界书条目都只是候选来源：`utterance` 表示有人说过，不能自动当真；`lore` 也不保证当前角色知道。因此这还不具备 Omnia 的完整认识论隔离。

Jev 的选择与检索是两层。关键词匹配只回答“可能相关”，Jev 选择回答“对这个角色此刻最显著”。首版 RELEVANCE 一次 Direct Choice 选一个候选 ID 或 `none`；COGNITION 同一请求再选一个策略。没有每轮 appraisal，没有向量库。主对白仍由 SillyTavern 已配置的 LLM 写出。

浏览器扩展不持有 `AI_GATEWAY_API_KEY`。`bridge/server.ts` 是只监听 loopback 的小服务，校验请求结构和浏览器 Origin，`/health` 只报告桥和密钥配置状态；`bridge/jev.ts` 从同级 Omnia 构建包加载 `AiSdkJevClient`，只有 Node 环境变量有密钥。ST 扩展也能读取页面数据，因此安装第三方代码前仍应审查来源。
