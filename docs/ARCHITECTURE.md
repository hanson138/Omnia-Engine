# 架构与学习说明

这个脚本只接管“角色此刻应注意什么、倾向怎样回应”，不接管世界状态或对白生成。`src/host.ts` 将 TavernHelper 的角色、消息、世界书接口转为有限的 `HostContext`；`src/retrieval.ts` 用最近消息与世界书关键词构造候选证据；`src/providers.ts` 返回只含候选 ID 的 `CognitionSnapshot`；`src/runtime.ts` 负责本轮注入与失效；`src/prompt.ts` 将快照写成简短内部指导。

普通玩家发送的事件顺序是：`GENERATION_AFTER_COMMANDS` → `MESSAGE_SENT`（这时用户消息才进入历史）→ 构造提示词 → 生成结束。脚本在前者标记本轮，在后者读取消息并限时等待认知结果。重生成等没有新用户消息的操作则在前者评估。TavernHelper 把事件监听包装后交给 ST 的事件系统，源码会返回监听器的 Promise；本地宿主加假模型端点已验证普通发送路径。

注入由 `injectPrompts` 写到 ST 的 extension prompt，而非可见聊天历史，选项 `once:true`。脚本同时在结束、停止、聊天变化和 iframe `pagehide` 手动调用 `uninject`，确保异常流程也清理。面板可改 role/depth，以便对照提示位置；当前默认 `system / depth 0` 只是实验起点。

异步请求开始时记录 chat ID、角色 ID、最后消息 ID 与本地 epoch。切换聊天或角色会增加 epoch 并 abort；结果回来后还要重新读取宿主上下文，四者都匹配才可注入。角色卡内容、发言、世界书条目都只是候选来源：`utterance` 表示有人说过，不能自动当真；`lore` 也不保证当前角色知道。因此这还不具备 Omnia 的完整认识论隔离。

Jev 的选择与检索是两层。关键词匹配只回答“可能相关”，Jev 选择回答“对这个角色此刻最显著”。首版 RELEVANCE 一次 Direct Choice 选一个候选 ID 或 `none`；COGNITION 同一请求再选一个策略。没有每轮 appraisal，没有向量库。主对白仍由 SillyTavern 已配置的 LLM 写出。

浏览器 iframe 不持有 `AI_GATEWAY_API_KEY`。`bridge/server.ts` 是只监听 loopback 的小服务，校验请求结构和浏览器 Origin；`bridge/jev.ts` 从同级 Omnia 构建包加载 `AiSdkJevClient`，只有 Node 环境变量有密钥。浏览器 iframe 并不是密钥保险箱：外部脚本仍可能读取页面数据，因此只运行审计过的脚本。
