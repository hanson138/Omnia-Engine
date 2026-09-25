# Phase 0 当前结果（2026-09-26）

已在隔离目录 `.local-host/SillyTavern` 安装并运行 SillyTavern 1.19.0 与 TavernHelper 4.11.0，插件面板在真实宿主中加载成功。用户此前没有 SillyTavern 安装，本次测试宿主只供本地实验。**没有真实 Jev 调用、真实生成模型回复质量测试或 OFF/B/C 角色质量对照数据**；不能把 mock 的注入成功解释为认知提升。

在干净临时目录以 `npm ci` 安装锁定依赖后，`npm test` 为 **6 个文件、19 个测试通过**；`npm run typecheck` 与 `npm run build` 均退出码 0。浏览器脚本打包约 483 KB，桥脚本约 6.6 KB。测试覆盖候选 ID/认识状态、有限检索、mock 输出、非法 ID/响应、OFF、群聊跳过、异步换聊天、超时、过载冷却、停止清理、桥 Origin/输入校验。另启动本机桥发出合法格式的探针请求；没有密钥时返回 HTTP 503 `unavailable`，未误报成功。

真实宿主加载发现：外部打包脚本不能在没有 `script_id` 的情况下使用 TavernHelper 的脚本变量。因此设置改为全局变量中的命名空间 `omniaCognitionSettings`，重载后面板正常出现。单角色 Seraphina 聊天中，`SillyTavern.getContext()` 的 chat ID 与角色 ID、角色卡、对话和绑定世界书均被读取。`DEBUG + mock` 处理用户发言后，面板显示已注入的证据 ID 和应答倾向；本机假模型端点实际收到的生成请求含 **1 个** `<omnia_character_cognition>` 块，并成功返回一条回复。切换 `OFF` 后下一轮请求含 **0 个**该块，证明一次性注入没有泄漏到后续轮次。假模型只记录模型名、消息数、流式标志和提示块计数，不记录聊天正文。测试端点源码见 `tests/live/openai-stub.mjs`。

本机 Jev 桥的无密钥探针返回 HTTP 503 `unavailable`，未误报成功。LM Studio 在本轮末未提供 `127.0.0.1:1234` 服务，CLI 唤醒守护进程超时，因此没有用本地真实模型测文本质量。浏览器 Origin 与 Jev 桥的真实跨进程请求、Jev 正常响应、多个回合中的认知质量仍需下一轮验证。

已知实验限制：世界书只是关键词回退，未复用 ST 完整激活/向量检索；一次 Direct Choice 最多选一条显著证据；没有角色私有知识过滤；群聊禁用；没有 appraisal；提示块是否被主 LLM 遵守尚无实测。能够迁回 Omnia 的是候选/快照/提供者接口与过期结果控制；TavernHelper 事件、世界书读取、注入和面板属于 SillyTavern 专用适配。
