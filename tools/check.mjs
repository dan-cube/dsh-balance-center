#!/usr/bin/env node
/**
 * Static release checks for the dsh-balance-center bundle (no dependencies).
 * Run from the repository root: `node tools/check.mjs [--strict]`.
 *
 * --strict turns the "not publish-ready yet" warnings (placeholders, missing
 * screenshots) into failures.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')
const failures = []
const warnings = []
const ok = (message) => console.log(`ok   ${message}`)
const fail = (message) => { failures.push(message); console.log(`FAIL ${message}`) }
const warn = (message) => { warnings.push(message); console.log(`WARN ${message}`) }

const readText = (rel) => readFileSync(join(root, rel), 'utf8')
const readJson = (rel) => JSON.parse(readText(rel))
const exists = (rel) => existsSync(join(root, rel))

// ---------------------------------------------------------------- package.json
let pkg
try {
  pkg = readJson('package.json')
  ok('package.json parses')
} catch (error) {
  fail(`package.json does not parse: ${error.message}`)
}

if (pkg !== undefined) {
  if (typeof pkg.name === 'string' && /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.name)) ok(`package name ${pkg.name}`)
  else fail(`package name is not a valid npm package name: ${JSON.stringify(pkg.name)}`)
  if (typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) ok(`version ${pkg.version}`)
  else fail(`version is not a SemVer version: ${JSON.stringify(pkg.version)}`)
  if (pkg.license === 'MIT') ok('license MIT')
  else fail(`license must be MIT, got ${JSON.stringify(pkg.license)}`)
  if (pkg.type === 'module') ok('type module')
  else fail('package.json must declare "type": "module"')
  if (pkg.dsh?.bundle?.patch === './cordis.patch.yml') ok('declares dsh.bundle.patch')
  else fail('package.json must declare dsh.bundle.patch = ./cordis.patch.yml')
  if (pkg.dsh?.client?.platform === 'web') ok('declares dsh.client.platform web')
  else fail('package.json must declare dsh.client.platform = web')
  if (Array.isArray(pkg.dsh?.client?.inject)) ok(`dsh.client.inject: ${pkg.dsh.client.inject.join(', ')}`)
  else fail('package.json must declare a dsh.client.inject array')
  if (typeof pkg.engines?.dsh === 'string' && pkg.engines.dsh !== '') ok(`engines.dsh = ${pkg.engines.dsh}`)
  else fail('package.json must declare engines.dsh so the market can check compatibility')

  // ------------------------------------------------------------- files list
  const listed = Array.isArray(pkg.files) ? pkg.files : []
  if (listed.length === 0) fail('package.json files list is empty')
  const expand = (entry) => {
    if (!entry.includes('*')) return [entry]
    const segments = entry.split('/')
    const index = segments.findIndex((segment) => segment.includes('*'))
    const dir = segments.slice(0, index).join('/') || '.'
    if (!exists(dir)) return []
    const pattern = new RegExp('^' + segments[index].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
    const rest = segments.slice(index + 1)
    const matches = []
    for (const name of readdirSync(join(root, dir))) {
      if (!pattern.test(name)) continue
      matches.push(rest.length === 0 ? join(dir, name) : null)
    }
    return matches.filter(Boolean)
  }
  for (const entry of listed) {
    const matches = expand(entry)
    if (matches.length === 0) fail(`files entry matches nothing: ${entry}`)
    else ok(`files entry ${entry} → ${matches.length} path(s)`)
  }
  for (const required of ['README.md', 'README.zh.md', 'README.en.md', 'LICENSE', 'CHANGELOG.md']) {
    if (exists(required)) ok(`present ${required}`)
    else fail(`missing ${required}`)
  }
}

// ---------------------------------------------------------------- bundle patch
if (exists('cordis.patch.yml')) {
  const patch = readText('cordis.patch.yml')
  if (pkg !== undefined && patch.includes(`name: '${pkg.name}'`)) ok('cordis.patch.yml mounts the package name')
  else fail(`cordis.patch.yml must mount name: '${pkg?.name ?? '<package>'}'`)
  const id = patch.match(/^\s*-\s*id:\s*'?([^'\s]+)'?/mu)?.[1]
  if (id !== undefined) ok(`patch row id ${id}`)
  else fail('cordis.patch.yml has no row id')
} else {
  fail('missing cordis.patch.yml')
}

// ---------------------------------------------------------------- Host half
if (exists('index.js')) {
  try {
    const host = await import(pathToFileURL(join(root, 'index.js')).href)
    if (typeof host.apply === 'function') ok('index.js exports apply()')
    else fail('index.js must export apply()')
    if (Array.isArray(host.inject)) ok(`index.js inject: ${host.inject.join(', ')}`)
    else fail('index.js must export an inject array')
  } catch (error) {
    fail(`index.js does not import: ${error.message}`)
  }
  const hostSource = readText('index.js')
  if (hostSource.includes("'/api/balance-center'")) ok('Host route /api/balance-center present')
  else fail('Host route /api/balance-center is missing')
} else {
  fail('missing index.js')
}

// ---------------------------------------------------------------- Client half
if (exists('client.js')) {
  const client = readText('client.js')
  if (pkg !== undefined && client.includes(`id: '${pkg.name}'`)) ok('client bundle id matches package name')
  else fail(`client.js must register id: '${pkg?.name ?? '<package>'}'`)
  if (client.includes('window.__ModuleLoader__.load(')) ok('client half uses the module loader')
  else fail('client.js does not call window.__ModuleLoader__.load')
  for (const banned of ['@local/', '/Users/', 'TEMPORARY', 'console.warn("[balance-center] verification']) {
    if (client.includes(banned) || (exists('index.js') && readText('index.js').includes(banned))) fail(`development leftover: ${banned}`)
  }
  ok('no development leftovers in code')
} else {
  fail('missing client.js')
}

// ---------------------------------------------------------------- locale + icon
for (const locale of ['en', 'zh']) {
  const rel = `locale/${locale}.json`
  if (!exists(rel)) { fail(`missing ${rel}`); continue }
  try {
    const dict = readJson(rel)
    if (typeof dict.meta?.title === 'string' && dict.meta.title !== '') ok(`${rel} meta.title`)
    else fail(`${rel} is missing meta.title`)
    if (typeof dict.meta?.description === 'string' && dict.meta.description !== '') ok(`${rel} meta.description`)
    else fail(`${rel} is missing meta.description`)
  } catch (error) {
    fail(`${rel} does not parse: ${error.message}`)
  }
}
if (exists('icon.svg')) {
  const size = statSync(join(root, 'icon.svg')).size
  if (size <= 256 * 1024 && readText('icon.svg').trimStart().startsWith('<svg')) ok(`icon.svg (${size} bytes)`)
  else fail('icon.svg must be a valid SVG under 256 KiB')
} else {
  fail('missing icon.svg')
}

// ---------------------------------------------------------------- publish readiness
const placeholderFiles = ['package.json', 'README.md', 'README.zh.md', 'docs/market-entry.npm.example.json', 'docs/market-entry.git.example.json']
const placeholders = placeholderFiles.filter((rel) => exists(rel) && readText(rel).includes('OWNER'))
if (placeholders.length === 0) ok('no OWNER placeholders left')
else warn(`replace the OWNER placeholder in: ${placeholders.join(', ')}`)

const screenshots = ['docs/screenshots/sidebar.png', 'docs/screenshots/settings.png']
const missing = screenshots.filter((rel) => !exists(rel))
if (missing.length === 0) ok('both README screenshots are present')
else warn(`missing README screenshots: ${missing.join(', ')} (run: sh tools/capture-screenshots.sh)`)

// ---------------------------------------------------------------- client activation smoke test
// Loads the browser bundle the way the DSH module loader does, materializes its
// factory, and applies the plugin against a stub context. This catches a renamed
// module id, a broken factory, or an apply() that throws before the page loads.
if (exists('client.js')) {
  try {
    const vm = await import('node:vm')
    const clientSource = readText('client.js')
    let registration
    const styleTag = { dataset: {}, textContent: '' }
    const windowStub = {
      __ModuleLoader__: { load: (value) => { registration = value } },
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    const context = {
      window: windowStub,
      document: {
        visibilityState: 'hidden',
        querySelector: () => null,
        createElement: () => styleTag,
        head: { appendChild: () => {} },
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      localStorage: { getItem: () => null, setItem: () => {} },
      console,
      setTimeout,
      clearTimeout,
    }
    context.globalThis = context
    vm.createContext(context)
    new vm.Script(clientSource, { filename: 'client.js' }).runInContext(context)

    if (registration === undefined) throw new Error('client.js did not call window.__ModuleLoader__.load')
    if (pkg !== undefined && registration.id !== pkg.name) fail(`client bundle id ${JSON.stringify(registration.id)} does not match package ${pkg.name}`)
    else ok('client bundle registers the package id')
    if (typeof registration.factory !== 'function') throw new Error('module registration has no factory')
    const plugin = registration.factory((name) => (name === 'react' ? {} : undefined))
    if (plugin === null || typeof plugin !== 'object') throw new Error('factory did not return a plugin')
    if (!Array.isArray(plugin.inject)) fail('client plugin has no inject array')
    else ok(`client plugin inject: ${plugin.inject.join(', ')}`)
    if (typeof plugin.apply !== 'function') throw new Error('client plugin has no apply()')

    const slots = []
    const ctx = {
      effect: (fn) => { fn(); return () => {} },
      locale: { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {} },
      slots: {
        inject: (key, callback) => { slots.push(key); callback(); return () => {} },
        register: () => () => {},
      },
      remote: { $on: () => () => {} },
    }
    plugin.apply(ctx)
    for (const expected of ['sidebar.footer.action', 'settings.section']) {
      if (!slots.includes(expected)) fail(`client plugin did not register into ${expected}`)
    }
    ok(`client plugin applies and registers: ${slots.join(', ')}`)
  } catch (error) {
    fail(`client half does not load/apply: ${error.message}`)
  }
}

// ---------------------------------------------------------------- adapter and quota parser fixtures
// Exercises the new balance/quota adapters against a stubbed fetch so a renamed
// endpoint, a missing auth header or a field rename fails the release check.
try {
  const host = await import(pathToFileURL(join(root, 'index.js')).href)
  const test = host.__test
  if (test === undefined || typeof test !== 'object') {
    fail('index.js does not expose the parser test surface (__test)')
  } else {
    const originalFetch = globalThis.fetch
    const calls = []
    const queue = []
    const signal = new AbortController().signal
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), headers: { ...(init?.headers ?? {}) } })
      const spec = queue.shift() ?? { status: 500, body: {} }
      const status = spec.status ?? 200
      return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
        async json() { return spec.body },
      }
    }
    try {
      queue.push({ body: { data: { accounts: [{ balance: '9.50' }] } } })
      let result = await test.readStepFun({ key: 'k', baseURL: undefined, declared: false, signal })
      if (result.status === 'ready' && result.amount === 9.5) ok('StepFun balance adapter')
      else fail('StepFun balance adapter did not parse the fixture')
      if (calls[0]?.url === 'https://api.stepfun.com/v1/accounts' && calls[0]?.headers.authorization === 'Bearer k') ok('StepFun request shape')
      else fail('StepFun request URL/header changed')

      calls.length = 0
      queue.push({ body: { availableBalance: '123456' } })
      result = await test.readNovita({ key: 'n', baseURL: 'https://api.novita.ai/v3/openai', declared: true, signal })
      if (result.status === 'ready' && Math.abs(result.amount - 12.3456) < 1e-9) ok('Novita balance adapter')
      else fail('Novita balance adapter did not parse the fixture')
      if (calls[0]?.url === 'https://api.novita.ai/v3/user/balance') ok('Novita request shape')
      else fail('Novita request URL changed')

      calls.length = 0
      queue.push({ body: { code: 200, success: true, data: { level: 'pro', limits: [{ type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 44, nextResetTime: 1781345721976 }] } } })
      result = await test.readGlmQuota({ token: 'z', baseURL: 'https://api.z.ai/api/coding/paas/v4', id: 'zai', signal })
      if (result.status === 'ready' && result.quota.windows[0].remainingPercent === 56) ok('GLM Coding quota adapter')
      else fail('GLM Coding quota adapter did not parse the fixture')
      if (calls[0]?.url === 'https://api.z.ai/api/monitor/usage/quota/limit' && calls[0]?.headers.authorization === 'z') ok('GLM request shape (raw key, no Bearer)')
      else fail('GLM request URL/header changed')

      calls.length = 0
      queue.push({ body: { base_resp: { status_code: 0 }, model_remains: [{ current_interval_total_count: 1000, current_interval_usage_count: 250, current_interval_remaining_count: 750, current_interval_remaining_percent: 75, end_time: 1781345721976 }] } })
      result = await test.readMinimaxQuota({ token: 'm', baseURL: 'https://api.minimax.io/anthropic', id: 'minimax', signal })
      if (result.status === 'ready' && result.quota.windows[0].remainingPercent === 75) ok('MiniMax Token Plan quota adapter')
      else fail('MiniMax quota adapter did not parse the fixture')
      if (calls[0]?.url === 'https://www.minimax.io/v1/token_plan/remains') ok('MiniMax request shape')
      else fail('MiniMax request URL changed')

      calls.length = 0
      queue.push({ body: { usage: { limit: '100', remaining: '74', resetTime: '2026-02-11T17:32:50.757941Z' }, limits: [{ window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' }, detail: { limit: '100', remaining: '85', resetTime: '2026-02-07T12:32:50.757941Z' } }], user: { membership: { level: 'LEVEL_INTERMEDIATE' } } } })
      result = await test.readKimiQuota({ token: 'c', signal })
      if (result.status === 'ready' && result.quota.windows[0].remainingPercent === 85) ok('Kimi Coding quota adapter')
      else fail('Kimi Coding quota adapter did not parse the fixture')
      if (calls[0]?.url === 'https://api.kimi.com/coding/v1/usages' && calls[0]?.headers.authorization === 'Bearer c') ok('Kimi Coding request shape')
      else fail('Kimi Coding request URL/header changed')

      queue.push({ status: 401, body: {} })
      result = await test.readKimiQuota({ token: 'expired', signal })
      if (result.status === 'signin_expired') ok('Kimi Coding 401 → sign-in expired status')
      else fail('Kimi Coding 401 should map to signin_expired')

      if (test.parseGlmQuota({ code: 500, success: false, msg: '无套餐' }).status === 'no_plan') ok('GLM no-plan response mapped')
      else fail('GLM no-plan response should map to no_plan')

      // Provider business errors must not echo upstream text either.
      queue.push({ body: { code: 500, message: 'AUDIT_MSG_SENTINEL' } })
      const moonshotEcho = await test.readMoonshot({ key: 'k', baseURL: 'https://api.moonshot.cn/v1', signal })
      if (moonshotEcho.status === 'failed' && !JSON.stringify(moonshotEcho).includes('AUDIT_MSG_SENTINEL')) ok('Moonshot business-error text is not forwarded')
      else fail('Moonshot business-error text leaked into the provider result')
      queue.push({ body: { code: 500, message: 'AUDIT_MSG_SENTINEL' } })
      const siliconEcho = await test.readSiliconFlow({ key: 'k', baseURL: 'https://api.siliconflow.cn/v1', signal, declared: false })
      if (siliconEcho.status === 'failed' && !JSON.stringify(siliconEcho).includes('AUDIT_MSG_SENTINEL')) ok('SiliconFlow business-error text is not forwarded')
      else fail('SiliconFlow business-error text leaked into the provider result')

      // Upstream text must never be echoed to the browser.
      const redacted = test.parseGlmQuota({ code: 500, success: false, msg: 'AUDIT_SENTINEL_SECRET' })
      if (!JSON.stringify(redacted).includes('AUDIT_SENTINEL_SECRET')) ok('upstream error text is not forwarded')
      else fail('upstream error text leaked into the parser result')

      // Kimi returns a short-cycle window and a weekly window together; the
      // weekly zero must survive.
      const kimiBoth = test.parseKimiUsages({
        usage: { limit: '100', remaining: '0', resetTime: '2026-11-11T12:00:00Z' },
        limits: [{ window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' }, detail: { limit: '100', remaining: '85', resetTime: '2026-11-04T17:00:00Z' } }],
      })
      const kimiWeek = kimiBoth === undefined ? undefined : kimiBoth.quota?.windows?.find((window) => window.key === 'week')
      const kimiSession = kimiBoth === undefined ? undefined : kimiBoth.quota?.windows?.find((window) => window.key === 'session')
      if (kimiWeek !== undefined && kimiSession !== undefined && kimiWeek.remainingPercent === 0) ok('Kimi keeps the weekly window next to the session window')
      else fail('Kimi weekly window was dropped or the zero remaining was lost')

      // Numeric strings and numbers must normalise to the same instant.
      if (test.timestampOf(1790000000) === test.timestampOf('1790000000')) ok('timestampOf treats numeric strings consistently')
      else fail('timestampOf parsed a numeric string differently from a number')

      // Custom-source testing reads only the saved credential reference.
      const callsBeforeKey = calls.length
      queue.push({ body: { data: { totalBalance: '12.34' } } })
      const fakeContext = {
        get: (name) => name === 'credentials' ? { resolve: async () => ({ value: 'DUMMY_SAVED_KEY' }) } : undefined,
      }
      const keyResult = await test.readCustomSource(fakeContext, {
        id: 'check-source', name: 'check-source', url: 'https://example.test/balance',
        authMode: 'bearer', credentialRef: 'CHECK_REF', jsonPath: 'data.totalBalance', currency: 'CNY',
      }, signal)
      if (keyResult.status === 'ready' && keyResult.amount === 12.34) ok('custom-source test uses the saved credential reference')
      else fail('custom-source test did not resolve the saved credential reference')
      if (calls[callsBeforeKey]?.headers?.authorization === 'Bearer DUMMY_SAVED_KEY') ok('custom-source test sends the resolved saved key to the target')
      else fail('custom-source test did not use the resolved saved key')

      // Authenticated custom endpoints must be HTTPS; cleartext targets are
      // rejected before any request is sent.
      const callsBeforeInsecure = calls.length
      queue.push({ body: { data: { totalBalance: '1' } } })
      const insecureResult = await test.readCustomSource(fakeContext, {
        id: 'check-insecure', name: 'check-insecure', url: 'http://example.test/balance',
        authMode: 'bearer', credentialRef: 'CHECK_REF', jsonPath: 'data.totalBalance', currency: 'CNY',
      }, signal)
      if (insecureResult.status === 'failed' && insecureResult.message === 'insecure url' && calls.length === callsBeforeInsecure) {
        ok('authenticated custom-source HTTP is rejected before any request')
      } else {
        fail('authenticated custom-source HTTP was not rejected safely')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  }
} catch (error) {
  fail(`adapter fixtures do not run: ${error.message}`)
}

// ---------------------------------------------------------------- i18n parity
// Both UI languages must carry the same keys, and every literal tr() lookup must
// resolve, so the plugin never falls back to a raw key in either language.
try {
  const source = readText('client.js')
  const extractKeys = (name) => {
    const marker = `const ${name} = {`
    const start = source.indexOf(marker)
    if (start === -1) return undefined
    let depth = 0
    let end = -1
    for (let index = source.indexOf('{', start); index < source.length; index += 1) {
      if (source[index] === '{') depth += 1
      else if (source[index] === '}') {
        depth -= 1
        if (depth === 0) { end = index; break }
      }
    }
    if (end === -1) return undefined
    const body = source.slice(start, end)
    const keys = new Set()
    for (const match of body.matchAll(/^\s{6}([A-Za-z][A-Za-z0-9]*)\s*:/gmu)) keys.add(match[1])
    return keys
  }
  const zhKeys = extractKeys('zh')
  const enKeys = extractKeys('en')
  if (zhKeys === undefined || enKeys === undefined) {
    fail('could not read the zh/en copy dictionaries from client.js')
  } else if (zhKeys.size < 40 || enKeys.size < 40) {
    fail(`copy dictionaries look incomplete (zh ${zhKeys.size}, en ${enKeys.size})`)
  } else {
    const missingEn = [...zhKeys].filter((key) => !enKeys.has(key))
    const missingZh = [...enKeys].filter((key) => !zhKeys.has(key))
    if (missingEn.length === 0 && missingZh.length === 0) ok(`i18n parity: ${zhKeys.size} keys in zh and en`)
    else fail(`i18n mismatch — missing in en: ${missingEn.join(', ') || '—'}; missing in zh: ${missingZh.join(', ') || '—'}`)
    const used = new Set()
    for (const match of source.matchAll(/tr\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g)) used.add(match[1])
    const unknown = [...used].filter((key) => !zhKeys.has(key))
    if (unknown.length === 0) ok(`i18n keys: all ${used.size} literal tr() keys exist in both dictionaries`)
    else fail(`tr() references unknown keys: ${unknown.join(', ')}`)
  }
} catch (error) {
  fail(`i18n parity check failed: ${error.message}`)
}

// ---------------------------------------------------------------- identity and boundary guards
try {
  const clientSource = readText('client.js')
  const hostSource = readText('index.js')
  const pick = (name) => new RegExp(`const ${name} = '([^']*)'`).exec(clientSource)?.[1]
  const aboutVersion = pick('PLUGIN_VERSION')
  const aboutAuthor = pick('PLUGIN_AUTHOR')
  const aboutRepo = pick('PLUGIN_REPO')
  if (pkg !== undefined) {
    if (aboutVersion === pkg.version) ok(`About version ${aboutVersion} matches package.json`)
    else fail(`About version ${aboutVersion} does not match package.json ${pkg.version}`)
    if (aboutAuthor === pkg.author) ok(`About developer ${aboutAuthor} matches package.json`)
    else fail(`About developer ${aboutAuthor} does not match package.json author ${pkg.author}`)
    const repo = typeof pkg.repository?.url === 'string' ? pkg.repository.url.replace(/\.git$/, '') : undefined
    if (aboutRepo === repo) ok('About repository matches package.json repository')
    else fail(`About repository ${aboutRepo} does not match ${repo}`)
    const account = pick('PLUGIN_ACCOUNT')
    if (typeof account === 'string' && account.endsWith(`/${pkg.author}`)) ok('About GitHub account matches the developer')
    else fail('About GitHub account does not match the developer')
  }
  // Testing must never save a credential.
  const testSource = /const testSource = async \(draft\) => \{([\s\S]*?)\n          \};/.exec(clientSource)?.[1]
  if (testSource === undefined) fail('client Test connection implementation was not found')
  else if (testSource.includes('setCredential(')) fail('Test connection writes a credential; testing must not persist')
  else if (/testKey|\.key\b/.test(testSource)) fail('Test connection transmits the unsaved key')
  else if (!testSource.includes('credentialRef')) fail('Test connection does not use the saved credential reference')
  else ok('Test connection uses only the saved credential reference (no plaintext key)')
  if (/testKey/.test(hostSource)) fail('Host still accepts an unsaved test key')
  else ok('Host accepts no unsaved test key')
  // No whole-snapshot cache: credential changes must be visible immediately.
  if (/snapshotCache|const TTL_MS/.test(hostSource)) fail('snapshot cache is back; credential changes could stay stale')
  else ok('no snapshot cache (credential changes are read immediately)')
} catch (error) {
  fail(`identity/boundary guards failed: ${error.message}`)
}

// ---------------------------------------------------------------- summary
console.log('')
if (failures.length > 0) {
  console.log(`${failures.length} failure(s) — not publishable.`)
  process.exit(1)
}
if (strict && warnings.length > 0) {
  console.log(`${warnings.length} warning(s) — --strict treats them as failures.`)
  process.exit(1)
}
console.log(warnings.length === 0 ? 'All checks passed.' : `Static checks passed with ${warnings.length} warning(s).`)
