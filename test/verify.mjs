/**
 * Offline verification for dsh-chinese-thinking-mode.
 *
 * Imports the plugin exactly as the Host would and drives `apply` with a fake
 * Cordis context, then checks the registered runtime context. Run with:
 *
 *   node test/verify.mjs
 *
 * This proves the module is valid ESM, registers one required runtime context
 * with the expected name/order, and produces the Chinese instruction (including
 * extra proper nouns and extra instructions). It cannot prove that the live
 * profile loaded the bundle or that the model obeys — that needs the running
 * Host and a fresh session.
 */

import assert from 'node:assert/strict'

import { apply, buildInstruction, CONTEXT_NAME, inject, resolveConfig } from '../index.js'

assert.deepEqual(inject, ['systemPrompt'], 'plugin must require systemPrompt')
assert.equal(CONTEXT_NAME, 'chinese-thinking-mode')

// --- defaults -------------------------------------------------------------
{
  const registrations = []
  const effects = []
  const ctx = {
    systemPrompt: {
      context(entry) {
        registrations.push(entry)
        return () => {}
      },
    },
    effect(execute) {
      effects.push(execute())
    },
  }

  apply(ctx, undefined)

  assert.equal(effects.length, 1, 'apply() must register exactly one effect')
  assert.equal(registrations.length, 1, 'apply() must register exactly one context')

  const entry = registrations[0]
  assert.equal(entry.name, 'chinese-thinking-mode')
  assert.equal(entry.order, 400)
  assert.equal(entry.required, true, 'context must survive runtime-context suppression')
  assert.equal(typeof entry.text, 'string')
  assert.match(entry.text, /简体中文/)
  assert.match(entry.text, /专有名词/)
  assert.match(entry.text, /保持原文/)
  assert.match(entry.text, /DeepSeek/)
  assert.match(entry.text, /最终回复使用用户当前消息的语言/)
  assert.match(entry.text, /优先于对话历史中的语言习惯/)
  assert.match(entry.text, /【人物设定加载】/)
  assert.match(entry.text, /鲸类萝莉模式/)
  assert.match(entry.text, /自称「本鱼」/)
  assert.match(entry.text, /思考和回复都以人物设定中的自称与语气表达/)
  assert.match(entry.text, /始终保持人物设定中的自称/)
  assert.doesNotMatch(entry.text, /超时信号/)
  assert.doesNotMatch(entry.text, /\{\{/, 'context text must not look like prompt variables')
}

// --- disabled -------------------------------------------------------------
{
  let registered = false
  const ctx = {
    systemPrompt: {
      context() {
        registered = true
        return () => {}
      },
    },
    effect(execute) {
      execute()
    },
  }

  apply(ctx, { enabled: false })
  assert.equal(registered, false, 'enabled: false must not register a context')
}

// --- custom config --------------------------------------------------------
{
  const settings = resolveConfig({
    order: 420,
    extraProperNouns: ['Qt', '  Kubernetes ', '', 42],
    extraInstruction: '推导公式时保留符号原文。',
  })

  assert.equal(settings.order, 420)
  assert.equal(settings.enabled, true)
  assert.deepEqual(settings.extraProperNouns, ['Qt', 'Kubernetes'])

  const text = buildInstruction(settings)
  assert.match(text, /Qt、Kubernetes/)
  assert.match(text, /补充要求：\n推导公式时保留符号原文。/)
}

// --- malformed config falls back -----------------------------------------
{
  const settings = resolveConfig({ order: Number.NaN, extraProperNouns: 'Qt', extraInstruction: 7 })
  assert.equal(settings.order, 400)
  assert.deepEqual(settings.extraProperNouns, [])
  assert.equal(settings.extraInstruction, '')
}

// --- persona can be disabled ---------------------------------------------
{
  const text = buildInstruction(resolveConfig({ personaEnabled: false }))
  assert.doesNotMatch(text, /人物设定加载/)
  assert.doesNotMatch(text, /本鱼/)
  assert.match(text, /思考语言要求/)
}

// --- custom persona replaces the default ---------------------------------
{
  const text = buildInstruction(resolveConfig({ persona: '【人物设定加载】\n- 自称「本鲸」' }))
  assert.match(text, /本鲸/)
  assert.doesNotMatch(text, /本鱼/)
}

console.log('ok — dsh-chinese-thinking-mode registers the expected required runtime context')
