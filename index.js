/**
 * Host half of the balance-center bundle.
 *
 * Discovers the model providers configured in this Harness, reads their
 * billing endpoints with credentials that never leave this process, and serves
 * the resulting numbers to the Client half over a private, authenticated
 * Connection RPC channel (`/balance-center`).
 *
 * The shipped DeepSeek *member* balance keeps its own Client Remote path and is
 * intentionally not read here.
 *
 * Security posture: this module owns every secret read. It never returns a key,
 * a header or a raw provider body to the browser — only numbers, a currency code
 * and a status word. Provider billing endpoints are a best-effort external
 * surface: every route is isolated, timed out, and never trusted blindly.
 */

/** Required service: the authenticated Host RPC carrier registered by the launched Web app. */
export const inject = ['connection']

/** Exact Fetch route served on the authenticated shared `/api` channel. */
const ROUTE_PATH = '/api/balance-center'
/** Per-request timeout for provider billing calls. */
const TIMEOUT_MS = 8_000
/** Cache lifetime for the unauthenticated gateway fingerprint probe. */
const FINGERPRINT_TTL_MS = 10 * 60_000

/** Credential reference name grammar (POSIX shell identifier). */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
/** OpenAI-compatible pi-ai protocols that a relay/gateway can speak. */
const OPENAI_COMPATIBLE_APIS = ['openai-completions', 'openai-responses']
/** Ambient credential refs per known route, tried after the configured apiKeyEnv. */
const AMBIENT_REFS = {
  'deepseek-official': ['DEEPSEEK_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  'moonshotai-cn': ['MOONSHOT_API_KEY'],
  moonshotai: ['MOONSHOT_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  stepfun: ['STEPFUN_API_KEY'],
  novita: ['NOVITA_API_KEY'],
  zai: ['ZAI_API_KEY'],
  'zai-coding-cn': ['ZAI_CODING_CN_API_KEY'],
  minimax: ['MINIMAX_API_KEY'],
  'minimax-cn': ['MINIMAX_CN_API_KEY'],
  'kimi-coding': ['KIMI_API_KEY'],
}
/** Route ids served by an adapter, with their fallback base URLs. */
const ROUTE_ADAPTERS = {
  'deepseek-official': 'deepseek',
  deepseek: 'deepseek',
  'moonshotai-cn': 'moonshot',
  moonshotai: 'moonshot',
  openrouter: 'openrouter',
  zai: 'glm-quota',
  'zai-coding-cn': 'glm-quota',
  minimax: 'minimax-quota',
  'minimax-cn': 'minimax-quota',
  'kimi-coding': 'kimi-quota',
}
/** Hostname → adapter for declared (custom model API) routes. */
const HOST_ADAPTERS = {
  'api.deepseek.com': 'deepseek',
  'api.moonshot.cn': 'moonshot',
  'api.moonshot.ai': 'moonshot',
  'api.siliconflow.cn': 'siliconflow',
  'api.siliconflow.com': 'siliconflow',
  'openrouter.ai': 'openrouter',
  'api.stepfun.com': 'stepfun',
  'api.novita.ai': 'novita',
  'api.z.ai': 'glm-quota',
  'open.bigmodel.cn': 'glm-quota',
  'bigmodel.cn': 'glm-quota',
  'api.minimax.io': 'minimax-quota',
  'api.minimaxi.com': 'minimax-quota',
  'api.kimi.com': 'kimi-quota',
}
/** Fallback base URLs used when a route's profile carries none. */
const FALLBACK_BASE = {
  deepseek: 'https://api.deepseek.com',
  moonshot: 'https://api.moonshot.cn/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  stepfun: 'https://api.stepfun.com/v1',
  novita: 'https://api.novita.ai/v3',
}
/** Route ids that must never be read here: the shipped member balance owns them. */
const SKIP_ROUTES = new Set(['deepseek-account'])
/** Unauthenticated gateway fingerprint cache, keyed by origin. */
const fingerprintCache = new Map()

/** @returns text when the value is a non-empty string. */
function text(value) {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** @returns a finite number from a number or decimal string. */
function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** @returns true when the value can be a credential reference. */
function isRefName(value) {
  return typeof value === 'string' && REF_PATTERN.test(value)
}

/** @returns the hostname of a URL, or undefined. */
function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/** @returns the origin of a base URL, the fallback's origin, or undefined when neither is usable. */
function originOf(baseURL, fallback) {
  const candidate = text(baseURL) ?? fallback
  if (candidate === undefined) return undefined
  try {
    return new URL(candidate).origin
  } catch {
    return fallback === undefined ? undefined : new URL(fallback).origin
  }
}

/** @returns the base URL with a trailing slash, so relative paths resolve inside it. */
function trail(baseURL) {
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

/**
 * Fetch JSON without ever throwing for HTTP/contract failures.
 * @param url - absolute URL.
 * @param init - fetch init (headers, method).
 * @param signal - cancellation and timeout signal.
 * @returns status kind, parsed body when it is JSON, and the HTTP status.
 */
async function getJson(url, init, signal) {
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      ...init,
      signal,
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch {
    return { kind: 'network', message: 'network error' }
  }
  const type = (response.headers.get('content-type') ?? '').toLowerCase()
  let body
  if (type.includes('json')) {
    try {
      body = await response.json()
    } catch {
      body = undefined
    }
  }
  if (response.status === 401) return { kind: 'rejected', httpStatus: 401 }
  if (response.status === 403) return { kind: 'forbidden', httpStatus: 403, body }
  if (response.status === 404) return { kind: 'unsupported', httpStatus: 404 }
  if (!response.ok) return { kind: 'failed', httpStatus: response.status }
  if (body === undefined) return { kind: 'unsupported', httpStatus: response.status }
  return { kind: 'ok', httpStatus: response.status, body }
}

/** @returns a ready status carrying a number and a currency code. */
function ready(amount, currency, detail) {
  if (amount === undefined || !Number.isFinite(amount)) {
    return { status: 'failed', message: 'response carried no numeric balance' }
  }
  return {
    status: 'ready',
    amount,
    currency,
    ...detail === undefined ? {} : { detail },
  }
}

/** @returns a failure status from a getJson result. */
function failureOf(result) {
  if (result.kind === 'rejected' || result.kind === 'forbidden') return { status: 'rejected' }
  return {
    status: result.kind === 'unsupported' ? 'unsupported' : 'failed',
    ...result.httpStatus === undefined ? {} : { httpStatus: result.httpStatus },
    ...result.kind === 'network' ? { message: 'network error' } : {},
  }
}

/** @returns a percentage clamped to 0..100, or undefined. */
function percentOf(value) {
  const parsed = numeric(value)
  if (parsed === undefined) return undefined
  return Math.min(100, Math.max(0, parsed))
}

/** @returns the remaining share of a used percentage, or undefined. */
function remainingFromUsed(value) {
  const used = percentOf(value)
  return used === undefined ? undefined : Math.round((100 - used) * 100) / 100
}

/** @returns the remaining share of a remaining/total pair, or undefined. */
function remainingFromCounts(remaining, total) {
  if (remaining === undefined || total === undefined || total <= 0) return undefined
  return Math.round(Math.min(100, Math.max(0, (remaining / total) * 100)) * 100) / 100
}

/** @returns epoch milliseconds from a number/string timestamp, or undefined. */
function timestampOf(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value
  }
  const raw = text(value)
  if (raw === undefined) return undefined
  const parsed = Date.parse(raw)
  if (Number.isFinite(parsed)) return parsed
  const secondsOrMillis = numeric(raw)
  if (secondsOrMillis === undefined || secondsOrMillis <= 0) return undefined
  return secondsOrMillis < 1e12 ? secondsOrMillis * 1000 : secondsOrMillis
}

/** @returns the window length in minutes from a pi-ai style window object, or undefined. */
function windowMinutes(window) {
  const duration = numeric(window?.duration)
  if (duration === undefined) return undefined
  const unit = text(window?.timeUnit) ?? ''
  if (unit.includes('HOUR')) return duration * 60
  if (unit.includes('DAY')) return duration * 60 * 24
  if (unit.includes('SECOND')) return duration / 60
  return duration
}

/** @returns a ready status carrying subscription quota windows. */
function readyQuota(quota) {
  const windows = Array.isArray(quota?.windows) ? quota.windows.filter((window) => {
    if (window === null || typeof window !== 'object') return false
    return window.remainingPercent !== undefined || window.remaining !== undefined || window.total !== undefined
  }) : []
  if (windows.length === 0) return { status: 'no_plan' }
  return { status: 'ready', quota: { ...quota, windows } }
}

/** StepFun: GET /v1/accounts → account balance. */
function parseStepFunBalance(body) {
  const amount = numeric(body?.balance)
    ?? numeric(body?.data?.balance)
    ?? numeric(body?.accounts?.[0]?.balance)
    ?? numeric(body?.data?.accounts?.[0]?.balance)
    ?? numeric(body?.data?.[0]?.balance)
  if (amount === undefined) return { status: 'failed', message: 'response carried no numeric balance' }
  return ready(amount, 'CNY')
}

/** Novita AI: GET /v3/user/balance → availableBalance in 0.0001 USD units. */
function parseNovitaBalance(body) {
  const raw = numeric(body?.availableBalance) ?? numeric(body?.data?.availableBalance) ?? numeric(body?.balance)
  if (raw === undefined) return { status: 'failed', message: 'response carried no numeric balance' }
  return ready(raw / 10000, 'USD')
}

/** GLM Coding Plan: /api/monitor/usage/quota/limit response body. */
function parseGlmQuota(body) {
  if (body?.code !== undefined && numeric(body.code) !== 200) return { status: 'no_plan' }
  if (body?.success === false) return { status: 'no_plan' }
  const limits = Array.isArray(body?.data?.limits) ? body.data.limits : []
  const find = (type, unit, number) => limits.find((item) => item?.type === type && item?.unit === unit && item?.number === number)
  const windows = []
  const session = find('TOKENS_LIMIT', 3, 5)
  if (session !== undefined) {
    windows.push({
      key: 'session',
      remainingPercent: remainingFromUsed(session.percentage),
      resetAt: timestampOf(session.nextResetTime),
    })
  }
  const week = find('TOKENS_LIMIT', 6, 1)
  if (week !== undefined) {
    windows.push({
      key: 'week',
      remainingPercent: remainingFromUsed(week.percentage),
      resetAt: timestampOf(week.nextResetTime),
    })
  }
  const tools = find('TIME_LIMIT', 5, 1)
  if (tools !== undefined) {
    const remaining = numeric(tools.remaining)
    const total = numeric(tools.usage)
    windows.push({
      key: 'tools',
      remaining,
      total,
      remainingPercent: remainingFromUsed(tools.percentage) ?? remainingFromCounts(remaining, total),
      resetAt: timestampOf(tools.nextResetTime),
    })
  }
  return readyQuota({ kind: 'glm', planLevel: text(body?.data?.level), windows })
}

/** MiniMax Token Plan: /v1/token_plan/remains response body. */
function parseMinimaxQuota(body) {
  const statusCode = numeric(body?.base_resp?.status_code)
  if (statusCode !== undefined && statusCode !== 0) return { status: 'no_plan' }
  const item = Array.isArray(body?.model_remains) ? body.model_remains[0] : undefined
  if (item === undefined || item === null) return { status: 'no_plan' }
  const total = numeric(item.current_interval_total_count)
  const used = numeric(item.current_interval_usage_count)
  const remaining = numeric(item.current_interval_remaining_count)
    ?? numeric(item.current_interval_remains_count)
    ?? (total !== undefined && used !== undefined ? total - used : undefined)
  const remainingPercent = percentOf(item.current_interval_remaining_percent) ?? remainingFromCounts(remaining, total)
  const resetAt = timestampOf(item.end_time)
    ?? (numeric(item.remains_time) === undefined ? undefined : Date.now() + numeric(item.remains_time) * 1000)
  const planLevel = text(item.current_subscribe_title) ?? text(item.plan_name) ?? text(item.plan)
  return readyQuota({
    kind: 'minimax',
    planLevel,
    windows: [{ key: 'session', remaining, total, remainingPercent, resetAt }],
  })
}

/** Kimi For Coding subscription: /coding/v1/usages response body. */
function parseKimiUsages(body) {
  const windows = []
  const addWindow = (window) => {
    if (!windows.some((existing) => existing.key === window.key)) windows.push(window)
  }
  for (const item of Array.isArray(body?.limits) ? body.limits : []) {
    const detail = item?.detail
    if (detail === null || typeof detail !== 'object') continue
    const total = numeric(detail.limit)
    const remaining = numeric(detail.remaining)
    if (total === undefined && remaining === undefined) continue
    const minutes = windowMinutes(item?.window)
    addWindow({
      key: minutes !== undefined && minutes >= 360 ? 'week' : 'session',
      remaining,
      total,
      remainingPercent: percentOf(detail.remainingPercent) ?? remainingFromCounts(remaining, total),
      resetAt: timestampOf(detail.resetTime),
    })
  }
  // `usage` is the weekly window; keep it even when `limits` already carries a
  // short-cycle window, and never let 0 remaining read as "no data".
  const usage = body?.usage
  if (usage !== null && typeof usage === 'object') {
    const total = numeric(usage.limit)
    const remaining = numeric(usage.remaining)
    if (total !== undefined || remaining !== undefined) {
      addWindow({
        key: 'week',
        remaining,
        total,
        remainingPercent: remainingFromCounts(remaining, total),
        resetAt: timestampOf(usage.resetTime),
      })
    }
  }
  return readyQuota({
    kind: 'kimi-coding',
    planLevel: text(body?.user?.membership?.level),
    windows,
  })
}

/** DeepSeek official API key: GET /user/balance. */
async function readDeepSeek({ key, baseURL, signal }) {
  const origin = originOf(baseURL, FALLBACK_BASE.deepseek)
  const result = await getJson(new URL('/user/balance', origin).href, {
    headers: { authorization: `Bearer ${key}` },
  }, signal)
  if (result.kind !== 'ok') return failureOf(result)
  const wallets = Array.isArray(result.body?.balance_infos) ? result.body.balance_infos : []
  const wallet = wallets.find((item) => item?.currency === 'CNY') ?? wallets[0]
  const currency = wallet?.currency === 'USD' ? 'USD' : 'CNY'
  const detail = {}
  const granted = numeric(wallet?.granted_balance)
  const toppedUp = numeric(wallet?.topped_up_balance)
  if (granted !== undefined) detail.granted = granted
  if (toppedUp !== undefined) detail.toppedUp = toppedUp
  return ready(numeric(wallet?.total_balance), currency, Object.keys(detail).length === 0 ? undefined : detail)
}

/** Moonshot / Kimi: GET {base}/users/me/balance. */
async function readMoonshot({ key, baseURL, signal, declared }) {
  const base = text(baseURL) ?? (declared === true ? undefined : FALLBACK_BASE.moonshot)
  if (base === undefined) return { status: 'unsupported' }
  const currency = hostOf(base) === 'api.moonshot.ai' ? 'USD' : 'CNY'
  const result = await getJson(new URL('users/me/balance', trail(base)).href, {
    headers: { authorization: `Bearer ${key}` },
  }, signal)
  if (result.kind !== 'ok') return failureOf(result)
  if (result.body?.code !== undefined && result.body.code !== 0) return { status: 'failed' }
  const detail = {}
  const voucher = numeric(result.body?.data?.voucher_balance)
  const cash = numeric(result.body?.data?.cash_balance)
  if (voucher !== undefined) detail.voucher = voucher
  if (cash !== undefined) detail.cash = cash
  return ready(numeric(result.body?.data?.available_balance), currency, Object.keys(detail).length === 0 ? undefined : detail)
}

/** SiliconFlow: GET {base}/user/info; currency follows the host. */
async function readSiliconFlow({ key, baseURL, signal, declared }) {
  const base = text(baseURL) ?? (declared === true ? undefined : FALLBACK_BASE.siliconflow)
  if (base === undefined) return { status: 'unsupported' }
  const currency = hostOf(base)?.endsWith('.com') === true ? 'USD' : 'CNY'
  const result = await getJson(new URL('user/info', trail(base)).href, {
    headers: { authorization: `Bearer ${key}` },
  }, signal)
  if (result.kind !== 'ok') return failureOf(result)
  if (result.body?.code !== undefined && result.body.code !== 20000) return { status: 'failed' }
  const amount = numeric(result.body?.data?.totalBalance) ?? numeric(result.body?.data?.balance)
  return ready(amount, currency)
}

/** OpenRouter: management key reads account credits; an inference key reads its own limit. */
async function readOpenRouter({ key, baseURL, signal }) {
  const base = text(baseURL) ?? FALLBACK_BASE.openrouter
  const headers = { authorization: `Bearer ${key}` }
  const credits = await getJson(new URL('credits', trail(base)).href, { headers }, signal)
  if (credits.kind === 'ok') {
    const total = numeric(credits.body?.data?.total_credits)
    const used = numeric(credits.body?.data?.total_usage)
    if (total !== undefined && used !== undefined) return ready(total - used, 'USD', { total, used })
  }
  if (credits.kind === 'rejected') return { status: 'rejected' }
  const keyInfo = await getJson(new URL('key', trail(base)).href, { headers }, signal)
  if (keyInfo.kind !== 'ok') return failureOf(keyInfo)
  const limit = numeric(keyInfo.body?.data?.limit_remaining)
  const usage = numeric(keyInfo.body?.data?.usage)
  if (limit !== undefined) return ready(limit, 'USD', usage === undefined ? undefined : { used: usage })
  return { status: 'unsupported', detail: usage === undefined ? undefined : { used: usage } }
}

/**
 * one-api / new-api style gateway: fingerprint `/api/status`, then the
 * OpenAI-compatible dashboard billing pair.
 */
async function readGateway({ key, baseURL, signal }) {
  const origin = originOf(baseURL, undefined)
  if (origin === undefined) return { status: 'unsupported' }
  const fingerprint = await gatewayFingerprint(origin, signal)
  if (fingerprint === undefined) return { status: 'unsupported' }
  const headers = { authorization: `Bearer ${key}` }
  const subscription = await getJson(new URL('/v1/dashboard/billing/subscription', origin).href, { headers }, signal)
  if (subscription.kind !== 'ok') return failureOf(subscription)
  const usageResult = await getJson(new URL('/v1/dashboard/billing/usage', origin).href, { headers }, signal)
  if (usageResult.kind !== 'ok') return { status: 'failed', ...usageResult.httpStatus === undefined ? {} : { httpStatus: usageResult.httpStatus } }
  const hardLimit = numeric(subscription.body?.hard_limit_usd) ?? numeric(subscription.body?.system_hard_limit_usd)
  const cents = numeric(usageResult.body?.total_usage)
  if (hardLimit === undefined || cents === undefined) return { status: 'unsupported' }
  let amount = hardLimit - cents / 100
  let currency = 'USD'
  if (fingerprint.displayInCurrency === false) amount = amount / fingerprint.quotaPerUnit
  if (fingerprint.currency === 'CNY') {
    currency = 'CNY'
  } else if (fingerprint.currency === 'CUSTOM') {
    amount = amount * fingerprint.exchangeRate
    currency = fingerprint.symbol ?? '¤'
  } else if (fingerprint.currency === 'TOKENS') {
    currency = 'TOKENS'
  }
  return ready(amount, currency, { gateway: fingerprint.systemName })
}

  /** StepFun: GET /v1/accounts. */
async function readStepFun({ key, baseURL, signal, declared }) {
  const origin = originOf(baseURL, declared === true ? undefined : FALLBACK_BASE.stepfun)
  if (origin === undefined) return { status: 'unsupported' }
  const result = await getJson(new URL('/v1/accounts', origin).href, {
    headers: { authorization: `Bearer ${key}` },
  }, signal)
  if (result.kind !== 'ok') return failureOf(result)
  return parseStepFunBalance(result.body)
}

/** Novita AI: GET /v3/user/balance. */
async function readNovita({ key, baseURL, signal, declared }) {
  const origin = originOf(baseURL, declared === true ? undefined : FALLBACK_BASE.novita)
  if (origin === undefined) return { status: 'unsupported' }
  const result = await getJson(new URL('/v3/user/balance', origin).href, {
    headers: { authorization: `Bearer ${key}` },
  }, signal)
  if (result.kind !== 'ok') return failureOf(result)
  return parseNovitaBalance(result.body)
}

/**
 * GLM Coding Plan quota. The subscription endpoint authenticates with the raw
 * API key in `authorization` (no Bearer prefix) on both clouds.
 */
async function readGlmQuota({ token, baseURL, id, signal }) {
  const host = id === 'zai' || hostOf(baseURL) === 'api.z.ai' ? 'https://api.z.ai' : 'https://open.bigmodel.cn'
  const result = await getJson(new URL('/api/monitor/usage/quota/limit', host).href, {
    headers: { authorization: token },
  }, signal)
  if (result.kind !== 'ok') return result.kind === 'rejected' || result.kind === 'forbidden'
    ? { status: 'rejected', httpStatus: result.httpStatus }
    : failureOf(result)
  return parseGlmQuota(result.body)
}

/** MiniMax Token Plan quota: /v1/token_plan/remains on the matching region. */
async function readMinimaxQuota({ token, baseURL, id, signal }) {
  const cn = id === 'minimax-cn' || hostOf(baseURL) === 'api.minimaxi.com'
  const origin = cn ? 'https://api.minimaxi.com' : 'https://www.minimax.io'
  const result = await getJson(`${origin}/v1/token_plan/remains`, {
    headers: { authorization: `Bearer ${token}` },
  }, signal)
  if (result.kind !== 'ok') return result.kind === 'rejected' || result.kind === 'forbidden'
    ? { status: 'rejected', httpStatus: result.httpStatus }
    : failureOf(result)
  return parseMinimaxQuota(result.body)
}

/** Kimi For Coding subscription quota: /coding/v1/usages. */
async function readKimiQuota({ token, signal }) {
  const result = await getJson('https://api.kimi.com/coding/v1/usages', {
    headers: { authorization: `Bearer ${token}` },
  }, signal)
  if (result.kind === 'rejected' || result.kind === 'forbidden') return { status: 'signin_expired' }
  if (result.kind !== 'ok') return failureOf(result)
  return parseKimiUsages(result.body)
}

/**
 * Read the public gateway fingerprint once per origin.
 * @returns conversion info, or undefined when the origin is not a known gateway.
 */
async function gatewayFingerprint(origin, signal) {
  const cached = fingerprintCache.get(origin)
  if (cached !== undefined && Date.now() - cached.at < FINGERPRINT_TTL_MS) return cached.value
  const result = await getJson(new URL('/api/status', origin).href, {}, signal)
  let value
  if (result.kind === 'ok' && result.body?.success === true && result.body?.data !== undefined) {
    const data = result.body.data
    const quotaPerUnit = numeric(data.quota_per_unit)
    const displayType = text(data.quota_display_type)
    const rate = numeric(data.custom_currency_exchange_rate)
    value = {
      quotaPerUnit: quotaPerUnit !== undefined && quotaPerUnit > 0 ? quotaPerUnit : 500000,
      displayInCurrency: data.display_in_currency !== false,
      currency: displayType === 'CNY' ? 'CNY' : displayType === 'TOKENS' ? 'TOKENS' : displayType === 'CUSTOM' ? 'CUSTOM' : 'USD',
      symbol: text(data.custom_currency_symbol),
      exchangeRate: rate !== undefined && rate > 0 ? rate : 1,
      systemName: text(data.system_name),
    }
  }
  fingerprintCache.set(origin, { at: Date.now(), value })
  return value
}

/** Resolve the first configured key among a route's candidate references. */
async function resolveKey(ctx, refs) {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return undefined
  for (const ref of refs) {
    let hit
    try {
      hit = await credentials.resolve(ref)
    } catch {
      hit = undefined
    }
    const value = hit?.value
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/** Enumerate every callable model route with the config and refs needed to price it. */
function discoverRoutes(ctx) {
  const llm = ctx.get('llm')
  if (llm === undefined) return []
  const settings = ctx.get('settings')
  let forms = []
  try {
    forms = settings?.describe?.() ?? []
  } catch {
    forms = []
  }
  const formByNs = new Map(forms.map((form) => [form.ns, form]))
  const directory = llm.listConfigurableProviders?.() ?? []
  const routes = []
  for (const provider of llm.listProviders?.() ?? []) {
    if (SKIP_ROUTES.has(provider.id)) continue
    const entry = directory.find((candidate) => candidate.provider === provider.id)
    const form = entry === undefined ? undefined : formByNs.get(entry.settingsNs)
    const profile = entry === undefined
      ? undefined
      : entry.settingsPath.reduce((node, key) => (node == null ? undefined : node[key]), form?.value)
    const refs = []
    if (isRefName(profile?.apiKeyEnv)) refs.push(profile.apiKeyEnv)
    for (const envName of entry?.nativeAuth?.env ?? []) if (isRefName(envName) && !refs.includes(envName)) refs.push(envName)
    for (const ambient of AMBIENT_REFS[provider.id] ?? []) if (!refs.includes(ambient)) refs.push(ambient)
    routes.push({
      id: provider.id,
      name: text(provider.name) ?? provider.id,
      declared: entry?.declared === true,
      baseURL: text(profile?.baseURL) ?? text(entry?.defaultBaseURL),
      api: text(profile?.api),
      refs,
    })
  }
  return routes
}

/** Pick the adapter for a discovered route, or undefined when the route cannot report anything. */
function adapterFor(route) {
  const byId = ROUTE_ADAPTERS[route.id]
  if (byId !== undefined) return byId
  const host = hostOf(route.baseURL)
  const byHost = host === undefined ? undefined : HOST_ADAPTERS[host]
  if (byHost !== undefined) return byHost
  if (route.declared === true && host !== undefined && (route.api === undefined || OPENAI_COMPATIBLE_APIS.includes(route.api))) {
    return 'gateway'
  }
  return undefined
}

/** @returns the display family of a route, so the Client can localize its label. */
function familyOf(route) {
  if (route.id.startsWith('deepseek')) return 'deepseek'
  if (route.id.startsWith('moonshotai')) return 'kimi'
  if (route.id.startsWith('openrouter')) return 'openrouter'
  if (route.id === 'zai' || route.id === 'zai-coding-cn') return 'glm'
  if (route.id.startsWith('minimax')) return 'minimax'
  if (route.id === 'kimi-coding') return 'kimi-coding'
  if (route.id === 'stepfun') return 'stepfun'
  if (route.id === 'novita') return 'novita'
  const host = hostOf(route.baseURL)
  if (host === 'api.deepseek.com') return 'deepseek'
  if (host === 'api.moonshot.cn' || host === 'api.moonshot.ai') return 'kimi'
  if (host === 'api.siliconflow.cn' || host === 'api.siliconflow.com') return 'siliconflow'
  if (host === 'openrouter.ai') return 'openrouter'
  if (host === 'api.stepfun.com') return 'stepfun'
  if (host === 'api.novita.ai') return 'novita'
  if (host === 'api.z.ai' || host === 'open.bigmodel.cn' || host === 'bigmodel.cn') return 'glm'
  if (host === 'api.minimax.io' || host === 'api.minimaxi.com') return 'minimax'
  if (host === 'api.kimi.com') return 'kimi-coding'
  return route.declared === true ? 'gateway' : undefined
}

/** @returns 'cn' | 'intl' for the family variant the route/currency identifies, or undefined. */
function variantOf(route, currency) {
  const host = hostOf(route.baseURL) ?? ''
  if (route.id.startsWith('moonshotai') || host === 'api.moonshot.cn' || host === 'api.moonshot.ai') {
    return host === 'api.moonshot.ai' || route.id === 'moonshotai' ? 'intl' : 'cn'
  }
  if (host === 'api.siliconflow.cn' || host === 'api.siliconflow.com') return host.endsWith('.com') ? 'intl' : 'cn'
  if (route.id.startsWith('deepseek') || host === 'api.deepseek.com') {
    if (currency === 'USD') return 'intl'
    if (currency === 'CNY') return 'cn'
    return undefined
  }
  if (route.id === 'zai' || host === 'api.z.ai') return 'intl'
  if (route.id === 'zai-coding-cn' || host === 'open.bigmodel.cn' || host === 'bigmodel.cn') return 'cn'
  if (route.id === 'minimax' || host === 'api.minimax.io') return 'intl'
  if (route.id === 'minimax-cn' || host === 'api.minimaxi.com') return 'cn'
  if (route.id === 'stepfun' || host === 'api.stepfun.com') return 'cn'
  if (route.id === 'novita' || host === 'api.novita.ai') return 'intl'
  return undefined
}

/**
 * Read the credential pi-ai stored for one route: an api-key record, or the
 * OAuth grant a sign-in produced (Kimi For Coding stores its token this way).
 * @returns a normalised credential, or undefined when nothing is stored.
 */
async function resolveStoredCredential(ctx, providerId) {
  if (!/^[a-z][a-z0-9-]*$/.test(providerId)) return undefined
  const credentials = ctx.get('credentials')
  if (credentials === undefined || typeof credentials.readRecord !== 'function') return undefined
  let record
  try {
    record = await credentials.readRecord(`llm-pi-ai/${providerId}`)
  } catch {
    return undefined
  }
  if (record === undefined || record === null) return undefined
  if (record.kind === 'api-key') {
    if (typeof record.key === 'string' && record.key !== '') return { type: 'api_key', key: record.key }
    for (const value of Object.values(record.env ?? {})) {
      if (typeof value === 'string' && value !== '') return { type: 'api_key', key: value }
    }
    return undefined
  }
  const payload = record.payload
  if (payload !== null && typeof payload === 'object' && payload.type === 'oauth'
    && typeof payload.access === 'string' && payload.access !== '') {
    return { type: 'oauth', access: payload.access, expires: numeric(payload.expires) }
  }
  return undefined
}

/** Read one route's balance or subscription quota. Never throws. */
async function readRoute(ctx, route, signal) {
  const family = familyOf(route)
  const adapter = adapterFor(route)
  const variant = variantOf(route, undefined)
  if (adapter === undefined) {
    return { id: route.id, name: route.name, family, status: 'unsupported' }
  }
  let credential
  try {
    const key = await resolveKey(ctx, route.refs)
    if (key !== undefined) credential = { type: 'api_key', key }
  } catch {
    credential = undefined
  }
  if (credential === undefined) {
    try {
      credential = await resolveStoredCredential(ctx, route.id)
    } catch {
      credential = undefined
    }
  }
  if (credential === undefined) {
    return { id: route.id, name: route.name, family, adapter, variant, status: 'no_credential' }
  }
  if (adapter === 'kimi-quota' && credential.type === 'oauth' && credential.expires !== undefined
    && credential.expires < Date.now() + 30_000) {
    return { id: route.id, name: route.name, family, adapter, variant, status: 'signin_expired' }
  }
  const calls = {
    deepseek: readDeepSeek,
    moonshot: readMoonshot,
    siliconflow: readSiliconFlow,
    openrouter: readOpenRouter,
    gateway: readGateway,
    stepfun: readStepFun,
    novita: readNovita,
    'glm-quota': readGlmQuota,
    'minimax-quota': readMinimaxQuota,
    'kimi-quota': readKimiQuota,
  }
  const call = calls[adapter]
  let result
  try {
    result = adapter === 'glm-quota' || adapter === 'minimax-quota' || adapter === 'kimi-quota'
      ? await call({ token: credential.type === 'oauth' ? credential.access : credential.key, baseURL: route.baseURL, id: route.id, signal })
      : await call({ key: credential.key, baseURL: route.baseURL, declared: route.declared, signal })
  } catch {
    result = { status: 'failed', message: 'request failed' }
  }
  return { id: route.id, name: route.name, family, adapter, variant: variantOf(route, result.currency), ...result }
}

/** Resolve a dotted/bracketed JSON path such as `data.balance` or `data[0].total`. */
function readPath(value, path) {
  if (path === '') return value
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter((segment) => segment !== '')
  let node = value
  for (const segment of segments) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[segment]
  }
  return node
}

/** Read one user-configured custom source. Never throws. */
async function readCustomSource(ctx, source, signal) {
  const id = text(source?.id)
  const name = text(source?.name) ?? id
  const url = text(source?.url)
  const base = { id: id ?? 'custom', name: name ?? 'custom', kind: 'custom' }
  if (url === undefined || !/^https?:\/\//i.test(url)) return { ...base, status: 'failed', message: 'invalid url' }
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return { ...base, status: 'failed', message: 'invalid url' }
  }
  const loopback = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'
    || parsedUrl.hostname === '::1' || parsedUrl.hostname === '[::1]' || parsedUrl.hostname.endsWith('.localhost')
  if (source?.authMode !== 'none' && parsedUrl.protocol !== 'https:' && !loopback) {
    return { ...base, status: 'failed', message: 'insecure url' }
  }
  const credentialRef = text(source?.credentialRef)
  let key
  if (isRefName(credentialRef) && source?.authMode !== 'none') {
    key = await resolveKey(ctx, [credentialRef])
    if (key === undefined) return { ...base, status: 'no_credential' }
  }
  const headers = {}
  if (key !== undefined) {
    const mode = text(source?.authMode) ?? 'bearer'
    if (mode === 'header') headers[text(source?.headerName) ?? 'x-api-key'] = key
    else headers.authorization = `Bearer ${key}`
  }
  const result = await getJson(url, { headers }, signal)
  if (result.kind !== 'ok') return { ...base, ...failureOf(result) }
  const raw = readPath(result.body, text(source?.jsonPath) ?? '')
  const amount = numeric(raw)
  if (amount === undefined) return { ...base, status: 'failed', message: 'jsonPath did not resolve to a number' }
  return { ...base, status: 'ready', amount, currency: text(source?.currency) ?? 'CNY' }
}

/** Compose the whole snapshot from live provider reads (no snapshot cache). */
async function buildSnapshot(ctx, customSourcesInput, signal) {
  const customSources = Array.isArray(customSourcesInput) ? customSourcesInput.slice(0, 20) : []
  const routes = discoverRoutes(ctx)
  const providers = await Promise.all(routes.map((route) => readRoute(ctx, route, signal).catch(() => ({
    id: route.id,
    name: route.name,
    status: 'failed',
    message: 'request failed',
  }))))
  const custom = await Promise.all(customSources.map((source) => readCustomSource(ctx, source, signal).catch(() => ({
    id: text(source?.id) ?? 'custom',
    name: text(source?.name) ?? 'custom',
    kind: 'custom',
    status: 'failed',
    message: 'request failed',
  }))))
  return { at: Date.now(), providers, custom }
}

/** @returns a signal that also aborts after the per-request timeout. */
function combineSignals(signal) {
  if (signal === undefined) return AbortSignal.timeout(TIMEOUT_MS)
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, TIMEOUT_MS)
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }, { once: true })
  return controller.signal
}

/**
 * Serve the balance snapshot over the authenticated exact Fetch route.
 * The route lives under the shared `/api` channel, so the browser's signed
 * session cookie authenticates it and only the owner page may call it.
 * @param ctx - Host plugin context carrying the Connection service.
 */
export function apply(ctx) {
  ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let payload
      try {
        payload = await request.json()
      } catch {
        payload = undefined
      }
      const signal = combineSignals(request.signal)
      try {
        if (payload?.endpoint === 'snapshot') {
          return Response.json({ ok: true, value: await buildSnapshot(ctx, payload?.customSources, signal) })
        }
        if (payload?.endpoint === 'test') {
          // Testing reads only the saved credential reference; a key that the
          // user has not saved yet is not accepted from the browser at all.
          return Response.json({ ok: true, value: await readCustomSource(ctx, payload?.source, signal) })
        }
        return Response.json({ ok: false, error: { code: 'bad-endpoint', message: `unknown endpoint ${JSON.stringify(payload?.endpoint)}`, details: {} } })
      } catch {
        return Response.json({ ok: false, error: { code: 'balance-failure', message: 'request failed', details: {} } })
      }
    },
  })
}

/** Internal parser surface for the static checks and local fixtures; not used at runtime. */
export const __test = {
  readCustomSource,
  readMoonshot,
  readSiliconFlow,
  readStepFun,
  readNovita,
  readGlmQuota,
  readMinimaxQuota,
  readKimiQuota,
  parseStepFunBalance,
  parseNovitaBalance,
  parseGlmQuota,
  parseMinimaxQuota,
  parseKimiUsages,
  remainingFromUsed,
  remainingFromCounts,
  timestampOf,
  windowMinutes,
}
