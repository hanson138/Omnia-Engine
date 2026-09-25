# OFF / RELEVANCE / COGNITION 对照试验

先用 mock 单角色会话验证事件、注入与清理，再切换真实桥。正式对照选一套熟悉的角色卡与世界书，固定主模型、预设、温度、可用时的 seed 和起始场景。准备 20–50 个相同或等价的玩家输入，每个条件从相同初始聊天分支开始：A=`OFF`，B=`RELEVANCE`，C=`COGNITION`。DEBUG 只用于追查问题，不作为第四个质量条件。

每轮记录：条件、角色、输入编号、候选 ID、Jev 选中 ID/策略、注入 role/depth、Jev 延迟、主模型首字/总延迟、最终消息 ID、是否超时/过载/跳过。人工盲评每轮的角色一致性、过去事件使用是否合适、无关记忆引用、主动性、对白质量、矛盾、是否服从认知指导（各 1–5 分），并标记任何角色不知道却说出的秘密。

比较 B-A 可问“角色相关性选择是否胜过原生上下文”；C-B 可问“Direct Choice 是否产生合理主动性或反而限制表达”。同时统计失败率、每轮额外调用数、P50/P95 延迟。每个条件至少报告实际样本数；不要由单个对话声称有效。

| turn | condition | candidate IDs | selected ID | strategy | Jev ms | first token ms | consistency 1–5 | memory fit 1–5 | agency 1–5 | contradiction | epistemic leak | notes |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1 | OFF | — | — | — | — | — | | | | | | |
| 1 | RELEVANCE | | | — | | | | | | | | |
| 1 | COGNITION | | | | | | | | | | | |

另做 role/depth 小样本试验：固定场景，对比 `system depth 0`、`system depth 2`、`assistant depth 0`，记录主模型是否使用证据、是否机械复述内部指导。先不要根据一次输出来硬编码最佳位置。
