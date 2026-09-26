# Jev 直连可行性记录（2026-09-27）

## 当前边界

浏览器扩展目前只认识 `CharacterCognitionProvider.evaluate`，实现为确定性 mock 或请求 `127.0.0.1` 的本机桥；桥通过相邻 Omnia 构建包的 `AiSdkJevClient` 调用 Vercel AI Gateway。`CognitionSnapshot` 在注入 ST 提示词前校验请求、聊天、角色、消息和候选 ID。入口见 [`src/providers.ts`](../src/providers.ts)、[`src/runtime.ts`](../src/runtime.ts) 和 [`bridge/jev.ts`](../bridge/jev.ts)。

## 官方接口与实际预检

| 路径 | 官方契约 | 从本机 ST 来源的无密钥 OPTIONS 预检 | 含义 |
| --- | --- | --- | --- |
| TypeSafe 原生 HTTP | `POST https://api.typesafe.ai/v1/systemone`；Bearer key；`model: "jev-latest"`；Choice 回答含 `choice`、`probabilities`、`confidence`。[TypeSafe API reference](https://docs.typesafe.ai/api) | `Origin: http://127.0.0.1:8000`、请求头 `authorization,content-type` → HTTP 400 `Disallowed CORS origin`，没有 `Access-Control-Allow-Origin`。 | 以当前来源用普通浏览器 `fetch` 不能读取结果；应从本机服务直连 TypeSafe。 |
| Vercel Gateway HTTP | `POST https://ai-gateway.vercel.sh/v1/evaluate`；Bearer key；`model: "typesafe-ai/jev"`；使用 Gateway 的 question/answer 格式。[Vercel Evaluation docs](https://vercel.com/docs/ai-gateway/modalities/evaluation) | 同一来源与请求头 → HTTP 200，`Access-Control-Allow-Origin: http://127.0.0.1:8000`。 | 浏览器发起 Gateway 请求在 CORS 预检上可行；尚未以有效密钥验证实际评估响应。 |

这两次 OPTIONS 均未发送密钥或对话数据。CORS 结果只代表 2026-09-27 对 `127.0.0.1:8000` 的预检，不保证其他来源、未来服务配置或真实 POST 成功。TypeSafe 官方 JavaScript SDK 的示例面向 Node.js 20+，从 `TYPESAFE_API_KEY` 环境变量取密钥。[TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)

## 下一阶段的两条直连路径

1. **TypeSafe 原生直连（优先）**：把现有本机桥改成自包含服务，不再动态依赖相邻 Omnia 构建包。它从服务端环境变量读取 TypeSafe key，使用官方原生 HTTP 格式，严格映射 Choice 结果到现有 `CognitionSnapshot`。保留 mock、取消、超时、过期结果拒绝和失败后 ST 正常生成。对 `401/422/429/529` 分类显示状态；429/529 按限流策略退避。此路径绕过 Vercel，但仍需要一个本机服务进程。
2. **浏览器直接发起请求（可选实验模式）**：当前只能以 Gateway `/v1/evaluate` 作为可行候选，且需要用户临时提供 Gateway key。密钥进入浏览器执行环境时，其他有同等页面权限的扩展/脚本可接触它；即便不持久化也无法消除此边界。该模式不应复用 TypeSafe 原生 key，也不应声称为安全的默认选项。先用不带真实对话的假响应与有效 key 的最小 smoke 证明真实 POST、响应映射和取消行为，再决定是否交付。

两条路径应共享候选构建、Choice 问题定义、响应结构校验与诊断字段，传输和认证分开。Jev 只在应用给出的候选中选择，不能返回任意状态补丁。下一轮正式实现前需明确浏览器模式的密钥生命周期与 UI 警示，并在 ST 实际来源上再测 CORS。

SillyTavern 的 UI 扩展运行在浏览器；Server Plugin 可以添加 Node 端 API，但默认 `enableServerPlugins: false`，且不隔离文件系统权限。这使 Server Plugin 可作后续更紧密的集成方案，首轮不宜把它作为“一键 UI 扩展”的隐含依赖。[ST UI 扩展](https://docs.sillytavern.app/for-contributors/writing-extensions/)、[Server Plugins](https://docs.sillytavern.app/for-contributors/server-plugins/)
