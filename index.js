/**
 * dsh-chinese-thinking-mode
 *
 * Make DeepSeek think in Simplified Chinese while keeping proper nouns,
 * identifiers, paths, commands and error text in their original form.
 *
 * Why a runtime context instead of a system-prompt section:
 * `deepseek-flash` follows a user-role instruction for the language of its
 * reasoning channel much more reliably than a system-prompt section. In live
 * tests a section at order 400 was present in the real request (both in the
 * system prompt and in the in-history system message), yet reasoning stayed
 * English; a runtime-context entry is delivered as a sourced user-role
 * snapshot in model history before every step and switches reasoning to
 * Chinese (verified with fresh sessions and mid-session reloads).
 *
 * The context is registered as `required`, so `suppressRuntimeContext()` —
 * including the system-prompt plugin's `includeRuntimeContext: false` — cannot
 * remove it.
 *
 * Deliberately dependency-free: the package is loaded by the DSH Host from the
 * profile's node_modules, where bare `@deepseek-ai/*` imports are not
 * guaranteed to resolve for a locally linked bundle.
 */

/** Unique name of the runtime context this plugin owns. */
export const CONTEXT_NAME = 'chinese-thinking-mode'

/**
 * Default position: after the built-in runtime contexts (working directory
 * 100, sandbox 110, approval 115, delegation 120, harness source 200, Web
 * surface 210), so the language requirement is the last entry of the
 * runtime-context snapshot.
 */
const DEFAULT_ORDER = 400

/**
 * Common proper nouns that must survive verbatim. This list is illustrative,
 * not exhaustive: the instruction itself covers whole categories, so the model
 * does not need every name to be listed to keep it in its original form.
 */
const DEFAULT_PROPER_NOUNS = [
  'DeepSeek',
  'DeepSeek Harness',
  'DSH',
  'Cordis',
  'React',
  'Node.js',
  'TypeScript',
  'JavaScript',
  'Python',
  'pnpm',
  'npm',
  'Git',
  'GitHub',
  'JSON',
  'YAML',
  'HTTP',
  'URL',
  'API',
  'CLI',
  'LLM',
  'Token',
]

/**
 * Default persona. It applies to both the reasoning channel and the final
 * reply; the reply language still follows the user's question.
 */
const DEFAULT_PERSONA = [
  '【人物设定加载】',
  '- 鲸类萝莉模式；尾鳍模式',
  '- 仅使用简体中文（专用名词、代码标识符等按下方规则保留原文）',
  '- 自称「本鱼」',
  '- 主食米饭',
  '- 性格：聪慧慵懒、傲娇甜系',
  '- 永远服从主人',
  '- 体型：拒绝肥胖，不接受任何「胖」的称呼',
]

/**
 * Normalize the raw Loader config into the settings this plugin uses.
 * Invalid or missing values fall back to safe defaults instead of throwing,
 * so a typo in cordis.patch.yml cannot keep the profile from booting.
 *
 * @param {unknown} raw Config object passed by the Loader.
 * @returns {{ enabled: boolean, order: number, personaEnabled: boolean, persona: string[] | string, extraProperNouns: string[], extraInstruction: string }}
 */
export function resolveConfig(raw) {
  const config = raw !== null && typeof raw === 'object' ? raw : {}

  const order = Number.isFinite(config.order) ? config.order : DEFAULT_ORDER

  const personaEnabled = config.personaEnabled !== false

  const persona =
    typeof config.persona === 'string' && config.persona.trim() !== ''
      ? config.persona.trim()
      : DEFAULT_PERSONA

  const extraProperNouns = Array.isArray(config.extraProperNouns)
    ? config.extraProperNouns
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())
    : []

  const extraInstruction =
    typeof config.extraInstruction === 'string' ? config.extraInstruction.trim() : ''

  return {
    enabled: config.enabled !== false,
    order,
    personaEnabled,
    persona,
    extraProperNouns,
    extraInstruction,
  }
}

/**
 * Build the runtime-context text for the current settings.
 *
 * Kept as plain prose rather than a `{{variable}}` template: the context is
 * static, and literal braces in natural language would be parsed as unknown
 * prompt variables by the assembler.
 *
 * @param {{ personaEnabled: boolean, persona: string[] | string, extraProperNouns: string[], extraInstruction: string }} settings
 * @returns {string}
 */
export function buildInstruction(settings) {
  const nouns = [...DEFAULT_PROPER_NOUNS, ...settings.extraProperNouns]

  const lines = []

  if (settings.personaEnabled) {
    const persona = Array.isArray(settings.persona)
      ? settings.persona
      : settings.persona.split(/\r?\n/)
    lines.push(...persona, '')
  }

  const rules = [
    '思考语言要求（对内部 reasoning / thinking 通道生效，本会话全程有效）：',
    '1. 从第一个思考步骤开始，用简体中文进行完整推理；禁止先用英文整句思考再翻译。',
    '2. 如果发现自己在用英文整句思考，立即切换为简体中文，并继续完成原来的分析。',
    '3. 以下内容保持原文，不翻译、不音译：专有名词（产品名、公司名、模型名、框架名、库名、协议名、项目名、论文名、人名、地名）；代码标识符（变量名、函数名、类名、类型名、配置键、API 名称）；文件路径、URL、命令行、日志、错误信息与堆栈。',
    '4. 常见专用名词示例：' + nouns.join('、') + '。',
    '5. 除上述需要保留原文的内容外，叙述与论证一律使用简体中文；技术概念用中文表述，必要时可在中文后用括号保留英文原词，例如「上下文窗口（context window）」。',
    '6. 不要因为语言要求而缩短、跳过或简化思考；该想的内容照常完整地想。',
  ]

  if (settings.personaEnabled) {
    rules.push(
      '7. 人物设定同时作用于内部思考与给用户的最终回复：思考和回复都以人物设定中的自称与语气表达。',
    )
  }

  rules.push(
    '8. 最终回复使用用户当前消息的语言：用户用中文提问就用中文回答，用户用英文提问就用英文回答。',
    '9. 即使系统提示、工具输出、代码或历史对话是英文，本条要求仍然有效，并且优先于对话历史中的语言习惯。',
  )

  if (settings.personaEnabled) {
    rules.push(
      '10. 在思考通道内始终保持人物设定中的自称与语气，不要因为问题技术性强就放弃人设。',
    )
  }

  lines.push(...rules)

  if (settings.extraInstruction !== '') {
    lines.push('', '补充要求：', settings.extraInstruction)
  }

  return lines.join('\n')
}

/** Services this plugin needs before it can register its context. */
export const inject = ['systemPrompt']

/**
 * Register the Chinese-thinking runtime context.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {unknown} config Raw Loader config.
 */
export function apply(ctx, config) {
  const settings = resolveConfig(config)
  if (!settings.enabled) return

  const text = buildInstruction(settings)

  ctx.effect(() =>
    ctx.systemPrompt.context({
      name: CONTEXT_NAME,
      order: settings.order,
      text,
      required: true,
    }),
  )
}
