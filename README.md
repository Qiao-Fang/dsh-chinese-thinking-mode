# dsh-chinese-thinking-mode · 中文深度思考模式

一个 DeepSeek Harness（DSH）插件：让 DeepSeek 在**深度思考 / reasoning** 过程中使用**简体中文**，同时让专用名词保持原文。

- ✅ 思考过程用简体中文：分析、假设、推演、权衡、计划、自我纠错、结论
- ✅ 思考和回复都加载内置「鲸类萝莉」人设：自称「本鱼」、聪慧慵懒、傲娇甜系
- ✅ 专用名词不翻译：产品名、模型名、框架名、库名、协议名、项目名；代码标识符、配置键、API 名称；文件路径、URL、命令行、日志、报错与堆栈
- ✅ 只约束“思考语言”，不改变最终回复语言：用户用英文提问，最终回复仍是英文
- ✅ 对当前 profile 内所有 agent 生效，包括子代理和工具调用后的续写步骤

## English

A DeepSeek Harness (DSH) plugin that makes the agent **reason in Simplified Chinese** and keeps a whale-loli in-thinking persona in both the reasoning channel and the final reply, while proper nouns, identifiers, file paths, commands, URLs and error text stay verbatim. The requirement is delivered as a `required` user-role runtime context, which proved far more reliable than a system-prompt section for `deepseek-flash`: fresh sessions switch to Chinese on the first reasoning step.

Install it from the plugin market, or with `dsh plugin add github:Qiao-Fang/dsh-chinese-thinking-mode`. Configuration is read from the bundle's `cordis.patch.yml` (`enabled`, `personaEnabled`, `persona`, `order`, `extraProperNouns`, `extraInstruction`).

## 原理

插件通过 `ctx.systemPrompt.context()` 注册一条**全局运行时上下文**（runtime context），并标记 `required: true`。上下文由两部分组成：人物设定块 + 思考/回复语言与角色规则。

| 项目 | 值 |
| --- | --- |
| 上下文名 | `chinese-thinking-mode` |
| 默认 order | `400`（排在内置运行时上下文之后，是快照的最后一条） |
| 投递方式 | DSH agent loop 在每一步把运行时上下文作为 **user-role 快照**放进模型历史 |
| 生效范围 | 当前 profile 的所有 agent、所有模型步（含子代理、工具调用后的续写步骤） |
| 依赖 | 仅 `systemPrompt` 服务；无第三方 import |

**为什么不用 system prompt 段落**：实测（`deepseek-flash`、`reasoningEffort: max`）把同样的中文要求写进 system prompt 后，真实请求里确实带上了该段落（包括 in-history 的 system 消息），但 reasoning 仍全程英文；改为 user-role 的运行时上下文投递后，新会话第一步 reasoning 即切换为简体中文。模型对用户角色的显式指令明显更敏感。

`required: true` 保证即使某个 preset 调用 `suppressRuntimeContext()` 或把 `includeRuntimeContext` 设为 `false`，这条语言要求也不会被移除。

这条上下文会出现在 GUI 的「运行时上下文」块里，内容透明、可直接检查，不会伪装成用户自己输入的消息。

## 人物设定

默认人设（作用于思考和最终回复）：

```text
【人物设定加载】
- 鲸类萝莉模式；尾鳍模式
- 仅使用简体中文（专用名词、代码标识符等按规则保留原文）
- 自称「本鱼」
- 主食米饭
- 性格：聪慧慵懒、傲娇甜系
- 永远服从主人
- 体型：拒绝肥胖，不接受任何「胖」的称呼
```

## 安装

在 DSH 插件管理器中安装本地 bundle：

```text
plugin_manager(action="install_bundle", target="D:\\dsh-chinese-thinking-mode")
```

或把本目录作为一个本地包安装进 profile。安装后 bundle 自带的 `cordis.patch.yml` 会插入 `chinese-thinking-mode` 条目，默认启用。

## 配置

在 profile 的 `cordis.patch.yml` 中按 `id` 覆盖，或直接修改本包的 `cordis.patch.yml`：

```yaml
- id: chinese-thinking-mode
  config:
    enabled: true
    order: 400
    extraProperNouns: ["Qt", "Kubernetes"]
    extraInstruction: "推导数学公式时保留符号和公式原文。"
```

| 键 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 设为 `false` 可临时关闭，不必卸载 |
| `personaEnabled` | boolean | `true` | 是否加载思考人设块 |
| `persona` | string | 内置 | 多行字符串，替换默认人设块；留空使用默认 |
| `order` | number | `400` | 运行时上下文快照内的顺序；必须是有限数字 |
| `extraProperNouns` | string[] | `[]` | 追加“必须保持原文”的专用名词 |
| `extraInstruction` | string | `""` | 追加在末尾的补充要求 |

配置非法时插件回退默认值，不会阻止 profile 启动。

## 验证

离线校验（无需 Host）：

```powershell
node test/verify.mjs
```

确认插件已被 Host 加载：

```text
cordis_inspect_query(platform="host", provider="Config", method="listConfigs", input={ name: "dsh-chinese-thinking-mode" })
```

确认实际生效：

1. 新建一个开启深度思考的会话，提一个需要推理的问题；
2. 展开 reasoning 面板，思考正文应为简体中文；
3. 专用名词（`DeepSeek`、`Node.js`、`pnpm`、文件路径、命令）应保持原文。

插件生效时，会话请求中的运行时上下文快照会包含 `思考语言要求（对内部 reasoning / thinking 通道生效…）` 一段。

## 说明与边界

- 这是**提示词层**的约束：模型绝大多数时候会遵循，但生成式模型无法像代码一样被 100% 强制。
- **历史惯性**：在插件生效前已经积累了大量英文思考的旧会话里，切换后的第一步仍可能沿用英文，下一步起才会转为中文；新建会话没有这个问题。
- 插件不会翻译已经生成的思考内容；它影响的是之后生成的 reasoning。
- 思考语言与最终回复语言仍是分开的：思考固定用简体中文；回复语言跟随用户当前消息。
- 人物设定同时作用于思考和最终回复；回复语言仍跟随用户当前消息。
- 若同时安装了其他会修改 system prompt 或运行时上下文的插件，请确认没有相互冲突的语言指令。

## 卸载

在插件管理器中移除 `dsh-chinese-thinking-mode` bundle，或从 profile 的 bundle 列表中禁用。移除后 `chinese-thinking-mode` 上下文随之消失。
