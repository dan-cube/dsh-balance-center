/**
 * Client half of the balance-center bundle.
 *
 * Draws one compact line per readable balance source directly above the
 * sidebar account row as `label：symbol+amount` (for example
 * `DeepSeek 余额：¥308.04` or `Kimi 余额：¥50.00`), and contributes its own page to
 * Settings where the user chooses what to show, the order, the refresh
 * interval, a label language per source (auto / 中文 / EN), and edits custom
 * sources. Only sources this Harness can actually read are listed.
 *
 * Data: the member balance comes from the account Remote namespace; provider
 * and custom balances come from the bundle's Host half over the private
 * Connection RPC channel `/balance-center`. No credential or provider payload
 * ever reaches this file — the Host sends numbers, a currency code and a status.
 *
 * Preferences live in localStorage; custom-source secrets are stored through the
 * Harness credential service under generated `BALANCE_CENTER_*` references and
 * never leave the Host.
 */
window.__ModuleLoader__.load({
  id: 'dsh-balance-center',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Same-origin route of the bundle's Host half (the shared cookie-authenticated "/api" channel). */
    const ROUTE = '/api/balance-center'.slice(1);
    /** localStorage key for this plugin's preferences. */
    const STORAGE_KEY = 'dsh-balance-center/prefs.v1';
    /** Style tag identity shared by every load of this module. */
    const STYLE_ID = 'dsh-balance-center/balance-center.css';
    /** Credential reference name grammar (POSIX shell identifier). */
    const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

    /** Simplified Chinese copy (the key-set source of truth). */
    const zh = {
      nav: '余额与额度',
      title: '模型余额与额度',
      aboutName: 'DSH 模型余额与额度中心',
      subtitle: '在侧边栏账号上方显示 DeepSeek 余额、已接入的模型 API 余额，以及订阅套餐额度。',
      sectionSources: '余额来源',
      sectionGeneral: '通用设置',
      sectionHelp: '说明',
      sourcesHint: '自动读取本机 DSH 已接入的账号与模型服务；打开开关即可让它在侧边栏显示。',
      noProviders: '暂未检测到已接入的 API 模型服务。可在「设置 → 模型」中添加服务商或自定义模型 API，添加后这里会自动出现。',
      refreshNow: '立即刷新',
      refreshing: '刷新中…',
      lastUpdated: '更新于 {time}',
      neverRead: '尚未读取',
      hostUnavailable: '插件后台尚未就绪；重启 DSH 后即可读取 API 余额。DeepSeek 余额不受影响。',
      sectionInterval: '自动刷新间隔',
      sectionLanguage: '页面语言',
      languageAuto: '跟随应用',
      manual: '手动',
      seconds: '{n} 秒',
      minutes: '{n} 分钟',
      moveUp: '上移',
      moveDown: '下移',
      customAdd: '添加自定义余额源',
      customEdit: '编辑',
      customDelete: '删除',
      customName: '名称',
      customNamePlaceholder: '例如：中转站 A',
      customUrl: '余额接口地址（GET，返回 JSON）',
      customUrlPlaceholder: 'https://api.example.com/user/balance',
      customAuth: '鉴权方式',
      authBearer: 'Authorization: Bearer',
      authHeader: '自定义请求头',
      authNone: '无需鉴权',
      customHeader: '请求头名称',
      customKey: 'API Key',
      customKeySaved: '已保存密钥，留空表示不修改',
      customKeyMissing: '尚未保存密钥',
      customJsonPath: '余额字段路径',
      customJsonPathPlaceholder: 'data.balance',
      customJsonPathHint: 'JSON 中余额数字的路径，例如 data.balance 或 data[0].total',
      customCurrency: '币种',
      customSave: '保存',
      customCancel: '取消',
      customTest: '测试连接',
      customTesting: '测试中…',
      customTestOk: '连接成功：{value}',
      customTestFail: '连接失败：{message}',
      customInvalid: '请填写名称和有效的 http(s) 地址。',
      customDeleteHint: '删除该来源？已保存的密钥也会一并移除。',
      customTooMany: '自定义来源最多 20 个。',
      aboutSupport: '1. 支持余额 / 额度',
      aboutApiLabel: 'API 余额',
      aboutMembershipLabel: '会员额度',
      aboutApiList: 'DeepSeek（账号登录 / 官方 API Key）、Kimi / Moonshot、OpenRouter、StepFun、Novita、one-api / new-api 中转站、自定义 JSON 接口。',
      aboutMembershipList: 'GLM Coding Plan（Z.ai / 智谱）、MiniMax Token Plan（国内 / 国际）、Kimi For Coding（Kimi Code 会员 Key 或 DSH 登录态）。',
      aboutUnsupported: '2. 暂不支持',
      aboutUnsupportedList: 'SiliconFlow（官方接口已下线）、OpenAI、Anthropic、Gemini、阿里云百炼 / 通义、火山方舟、百度千帆、腾讯混元、讯飞星火、Groq、Together、Fireworks、Mistral、ModelScope 等；这些平台没有普通 API Key 可读的余额接口。',
      aboutHow: '3. 实现方式',
      aboutHowText: '用各平台的 API Key 或会员 Key 直接查询对应的官方余额 / 额度接口；自定义源会请求你填写的地址。额度以「剩余 % · 重置时间」显示，不是充值余额；点「立即刷新」会重新读取最新数据。',
      aboutPrivacy: '4. 隐私保护',
      aboutPrivacyText: '密钥只保存在本机 DSH 凭据库，由本机宿主在查询时读取，用于向对应平台（自定义源为你填写的地址）发起请求；插件本身没有服务器，不收集、不上传任何数据。浏览器只收到状态与数字；未保存的密钥不会发送，测试连接只使用已保存凭据，鉴权自定义源要求 HTTPS（本机地址除外）。',
      aboutVersion: '5. 版本信息',
      aboutMeta: 'v{version} · 开发者 {author} · 更新于 {updated}',
      aboutScope: '验证范围：DeepSeek、Kimi 余额与 Kimi For Coding 额度已实机验证；StepFun、Novita、GLM、MiniMax 适配器已通过接口 fixtures，未在真实账号复现。',
      aboutGitHub: 'GitHub',
      labelGlm: 'GLM Coding',
      labelMinimax: 'MiniMax',
      labelKimiCoding: 'Kimi Coding',
      labelStepfun: 'StepFun',
      labelNovita: 'Novita',
      quotaSuffix: ' 额度',
      quotaRemaining: '剩余 {percent}%',
      quotaCounts: '剩余 {remaining}/{total}',
      quotaResetSuffix: ' · {time}',
      minutesShort: '{n} 分钟',
      hoursShort: '{n} 小时',
      hoursMinutes: '{n} 小时 {m} 分',
      daysShort: '{n} 天',
      daysHours: '{n} 天 {h} 小时',
      statusNoPlan: '无订阅套餐',
      statusSigninExpired: '订阅登录已过期，请重新登录',
      statusApiRetired: '官方余额接口已下线（HTTP {status}）',
      statusFailedHttp: '读取失败（HTTP {status}）',
      sectionUnavailable: '检测到的其他连接',
      unavailableHint: '以下连接已接入 DSH，但当前无法读取余额或额度，因此不会显示在侧边栏。',
      detailPlan: '套餐 {level}',
      detailWindow5h: '5 小时池剩余 {value}',
      detailWindowWeek: '周池剩余 {value}',
      detailWindowTools: '工具额度剩余 {value}',
      resettingNow: '即将重置',
      errorInvalidUrl: '接口地址无效',
      errorJsonPath: 'JSON 字段路径没有取到数字',
      errorNoNumber: '返回内容里没有数字余额',
      errorCredentialWrite: '凭据保存失败',
      customTestSaveFirst: '请先保存密钥后再测试；未保存的密钥不会发送到后台。',
      customTestSavedHint: '测试连接使用已保存的密钥；新填写的密钥需先保存才会生效。',
      customInsecureUrl: '鉴权模式下的自定义接口必须使用 HTTPS（本机地址除外），避免密钥明文传输。',
      unknownError: '未知错误',
      unavailableLabel: '{name}（{id}）',
      currencyCny: '人民币（元）',
      currencyUsd: '美元（美元）',
      currencyTokens: 'Token 数量',
      statusLoading: '读取中',
      statusNoCredential: '未配置密钥',
      statusUnsupported: '不支持查询',
      statusRejected: '密钥无效',
      statusFailed: '读取失败',
      statusSignedOut: '未登录',
      detailGranted: '赠金 {value}',
      detailToppedUp: '充值 {value}',
      detailVoucher: '代金券 {value}',
      detailCash: '现金 {value}',
      detailUsed: '已用 {value}',
      detailGateway: '网关 {name}',
      accountLabel: 'DeepSeek 余额',
      deepseekApiLabel: 'DeepSeek 余额',
      labelKimi: 'Kimi 余额',
      labelSiliconflow: 'SiliconFlow 余额',
      labelOpenrouter: 'OpenRouter 余额',
      labelIntl: '（国际版）',
      mergedDeepseekLabel: 'DeepSeek 余额',
      mergedHint: '已合并 {n} 个 DeepSeek 连接：{list}',
      sourceMember: '账号登录',
      sourceApiKey: 'API Key',
      splitDeepseek: '分开展示 DeepSeek 的多个连接',
      splitDeepseekHint: '默认合并为一行（官方余额是同一个平台钱包）；打开后分别显示账号登录与每个 API 连接的余额。',
      labelLang: '标签语言',
      langAutoShort: '自动',
      colon: '：',
      emptySources: '暂无可显示的余额来源。请在「设置 → 模型」添加模型服务商，或在下方添加自定义余额源。',
      providerSuffix: ' 余额',
      unitCny: '元',
      unitUsd: '美元',
      unitTokens: 'Token',
    };
    /** English copy, complete against the zh key set. */
    const en = {
      nav: 'Balance & Quota',
      title: 'Balance & Quota',
      aboutName: 'DSH Balance & Quota Center',
      subtitle: 'Shows DeepSeek, model API balances and subscription quotas above the sidebar account row.',
      sectionSources: 'Balance sources',
      sectionGeneral: 'General',
      sectionHelp: 'About',
      sourcesHint: 'Reads the account and model access configured in this Harness. Turn a switch on to show that source in the sidebar.',
      noProviders: 'No model API access detected yet. Add a provider or a custom model API in Settings → Models; it appears here automatically.',
      refreshNow: 'Refresh now',
      refreshing: 'Refreshing…',
      lastUpdated: 'Updated {time}',
      neverRead: 'Not read yet',
      hostUnavailable: 'The plugin background is not ready. Restart DSH to read API balances; the DeepSeek balance still works.',
      sectionInterval: 'Auto-refresh interval',
      sectionLanguage: 'Page language',
      languageAuto: 'Follow app',
      manual: 'Manual',
      seconds: '{n} s',
      minutes: '{n} min',
      moveUp: 'Move up',
      moveDown: 'Move down',
      customAdd: 'Add custom balance source',
      customEdit: 'Edit',
      customDelete: 'Delete',
      customName: 'Name',
      customNamePlaceholder: 'e.g. Relay A',
      customUrl: 'Balance endpoint (GET, JSON)',
      customUrlPlaceholder: 'https://api.example.com/user/balance',
      customAuth: 'Authentication',
      authBearer: 'Authorization: Bearer',
      authHeader: 'Custom header',
      authNone: 'No auth',
      customHeader: 'Header name',
      customKey: 'API key',
      customKeySaved: 'Key saved; leave blank to keep it',
      customKeyMissing: 'No key saved',
      customJsonPath: 'Balance field path',
      customJsonPathPlaceholder: 'data.balance',
      customJsonPathHint: 'Path to the balance number, e.g. data.balance or data[0].total',
      customCurrency: 'Currency',
      customSave: 'Save',
      customCancel: 'Cancel',
      customTest: 'Test connection',
      customTesting: 'Testing…',
      customTestOk: 'Connected: {value}',
      customTestFail: 'Failed: {message}',
      customInvalid: 'Enter a name and a valid http(s) URL.',
      customDeleteHint: 'Delete this source? Its saved key is removed too.',
      customTooMany: 'At most 20 custom sources.',
      aboutSupport: '1. Balances & quotas',
      aboutApiLabel: 'API balances',
      aboutMembershipLabel: 'Membership quotas',
      aboutApiList: 'DeepSeek (account login / official API key), Kimi / Moonshot, OpenRouter, StepFun, Novita, one-api / new-api relays, custom JSON endpoints.',
      aboutMembershipList: 'GLM Coding Plan (Z.ai / BigModel), MiniMax Token Plan (CN / Intl), Kimi For Coding (Kimi Code membership key or DSH sign-in).',
      aboutUnsupported: '2. Not supported',
      aboutUnsupportedList: 'SiliconFlow (retired API), OpenAI, Anthropic, Gemini, Alibaba Bailian / Qwen, Volcengine Ark, Baidu Qianfan, Tencent Hunyuan, iFlytek Spark, Groq, Together, Fireworks, Mistral, ModelScope and similar — no ordinary-API-key balance endpoint.',
      aboutHow: '3. How it works',
      aboutHowText: 'Queries the matching official balance or quota endpoint with each vendor’s API key or membership key; custom sources request the URL you enter. Quotas show as “X% left · reset in …”, not top-up balances; “Refresh now” re-reads the latest data.',
      aboutPrivacy: '4. Privacy',
      aboutPrivacyText: 'Keys stay in the local DSH credential store and are read by the local Host when a query runs, only to call the matching vendor (or the URL you enter for a custom source). The plugin has no server and collects or uploads nothing. The browser receives status and numbers only; unsaved keys are never sent, Test connection uses saved credentials only, and authenticated custom sources must use HTTPS (localhost excepted).',
      aboutVersion: '5. Version',
      aboutMeta: 'v{version} · by {author} · updated {updated}',
      aboutScope: 'Verification: DeepSeek/Kimi balances and Kimi For Coding quota were verified live; StepFun, Novita, GLM and MiniMax adapters were validated with interface fixtures, not a real account.',
      aboutGitHub: 'GitHub',
      labelGlm: 'GLM Coding',
      labelMinimax: 'MiniMax',
      labelKimiCoding: 'Kimi Coding',
      labelStepfun: 'StepFun',
      labelNovita: 'Novita',
      quotaSuffix: ' quota',
      quotaRemaining: '{percent}% left',
      quotaCounts: '{remaining}/{total} left',
      quotaResetSuffix: ' · {time}',
      minutesShort: '{n}m',
      hoursShort: '{n}h',
      hoursMinutes: '{n}h{m}m',
      daysShort: '{n}d',
      daysHours: '{n}d{h}h',
      statusNoPlan: 'No subscription plan',
      statusSigninExpired: 'Subscription sign-in expired; sign in again',
      statusApiRetired: 'Official balance API retired (HTTP {status})',
      statusFailedHttp: 'Read failed (HTTP {status})',
      sectionUnavailable: 'Other detected connections',
      unavailableHint: 'These connections are set up in the Harness but cannot be read right now, so they are not shown in the sidebar.',
      detailPlan: 'Plan {level}',
      detailWindow5h: '5h pool {value} left',
      detailWindowWeek: 'Weekly pool {value} left',
      detailWindowTools: 'Tools quota {value} left',
      resettingNow: 'resetting now',
      errorInvalidUrl: 'invalid endpoint URL',
      errorJsonPath: 'the JSON field path did not resolve to a number',
      errorNoNumber: 'the response carried no numeric balance',
      errorCredentialWrite: 'saving the credential failed',
      customTestSaveFirst: 'Save the key before testing; an unsaved key is never sent to the Host.',
      customTestSavedHint: 'Test connection uses the saved credential; a newly typed key takes effect only after saving.',
      customInsecureUrl: 'Authenticated custom endpoints must use HTTPS (localhost excepted) so the key is never sent in cleartext.',
      unknownError: 'unknown error',
      unavailableLabel: '{name} ({id})',
      currencyCny: 'CNY (元)',
      currencyUsd: 'USD',
      currencyTokens: 'Tokens',
      statusLoading: 'Loading',
      statusNoCredential: 'No key',
      statusUnsupported: 'Not available',
      statusRejected: 'Key rejected',
      statusFailed: 'Failed',
      statusSignedOut: 'Signed out',
      detailGranted: 'Granted {value}',
      detailToppedUp: 'Topped up {value}',
      detailVoucher: 'Vouchers {value}',
      detailCash: 'Cash {value}',
      detailUsed: 'Used {value}',
      detailGateway: 'via {name}',
      accountLabel: 'DeepSeek',
      deepseekApiLabel: 'DeepSeek',
      labelKimi: 'Kimi',
      labelSiliconflow: 'SiliconFlow',
      labelOpenrouter: 'OpenRouter',
      labelIntl: ' (Intl)',
      mergedDeepseekLabel: 'DeepSeek',
      mergedHint: 'Merged {n} DeepSeek connections: {list}',
      sourceMember: 'Account login',
      sourceApiKey: 'API key',
      splitDeepseek: 'Split DeepSeek connections',
      splitDeepseekHint: 'Merged by default (official balances read the same platform wallet). Turn on to show the account login and each API connection separately.',
      labelLang: 'Label language',
      langAutoShort: 'Auto',
      colon: ': ',
      emptySources: 'No readable balance source yet. Add a model provider in Settings → Models, or a custom balance source below.',
      providerSuffix: '',
      unitCny: 'CNY',
      unitUsd: 'USD',
      unitTokens: 'tokens',
    };
    /** Dictionaries by language code. */
    const DICTS = { zh, en };
    /** Preference defaults. */
    /** Public plugin version shown in the About section; must equal package.json version. */
    const PLUGIN_VERSION = '1.0.0';
    /** Public developer/maintainer shown in the About section. */
    const PLUGIN_AUTHOR = 'dan-cube';
    /** Release date shown in the About section (publisher may confirm it before publishing). */
    const PLUGIN_UPDATED = '2026-11-04';
    /** Public GitHub account linked in the About section. */
    const PLUGIN_ACCOUNT = 'https://github.com/dan-cube';
    /** Public repository linked in the About section. */
    const PLUGIN_REPO = 'https://github.com/dan-cube/dsh-balance-center';

    const DEFAULT_PREFS = { language: 'auto', refreshSeconds: 60, hidden: [], order: [], customSources: [], sourceLang: {}, splitDeepseek: false };

    /** Legacy per-connection keys collapsed into the merged DeepSeek source. */
    const LEGACY_SOURCE_KEYS = { account: 'deepseek', 'provider:deepseek-official': 'deepseek', 'provider:deepseek': 'deepseek' };

    /** @returns a de-duplicated key list with legacy DeepSeek keys folded into the merged key. */
    function migrateKeys(keys) {
      return Array.from(new Set(keys.map((key) => LEGACY_SOURCE_KEYS[key] ?? key)));
    }

    /** @returns text when the value is a non-empty string. */
    function text(value) {
      return typeof value === 'string' && value !== '' ? value : undefined;
    }

    /** @returns the Host release version carried by the bootstrap payload, or a neutral fallback. */
    function releaseVersion() {
      const boot = globalThis.__DSH_BOOT__;
      const version = boot && boot.release && boot.release.version;
      return typeof version === 'string' && version !== '' ? version : '0.0.0';
    }

    /** @returns the account Remote metadata for this page's current language and zone. */
    function accountMetadata(ctx) {
      return {
        version: releaseVersion(),
        locale: ctx.locale.getSnapshot().active,
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      };
    }

    /** @returns {zh|en} for the current preference and app locale. */
    function resolveLang(prefs, ctx) {
      if (prefs.language === 'zh' || prefs.language === 'en') return prefs.language;
      const active = String(ctx.locale.getSnapshot().active || 'en').toLowerCase();
      return active.startsWith('zh') ? 'zh' : 'en';
    }

    /** Translate one key, interpolating `{name}` placeholders. */
    function tr(lang, key, vars) {
      const dict = DICTS[lang] ?? DICTS.en;
      const template = dict[key] ?? DICTS.en[key] ?? key;
      if (vars === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
    }

    /** @returns grouped integer digits. */
    function groupDigits(digits) {
      return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /** @returns exact cents for a Platform decimal string truncated toward zero. */
    function decimalCents(value) {
      const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value).trim());
      if (match === null) return null;
      const fraction = match[3] || '';
      const exponent = parseInt(match[4] || '0', 10);
      const digits = ((match[2] || '0') + fraction).replace(/^0+(?=\d)/, '') || '0';
      const scale = exponent - fraction.length + 2;
      let cents;
      if (scale >= 0) {
        cents = Number(digits) * Math.pow(10, scale);
        if (!Number.isFinite(cents)) return null;
      } else {
        const drop = -scale;
        cents = drop >= digits.length ? 0 : Number(digits.slice(0, digits.length - drop));
      }
      return (match[1] === '-' ? -1 : 1) * cents;
    }

    /** @returns display units for a provider amount: cents for fiat, integer count for tokens. */
    function amountToUnits(value, currency) {
      if (!Number.isFinite(value)) return undefined;
      if (currency === 'TOKENS') return Math.round(value);
      if (value < 0) return Math.round(value * 100);
      return Math.floor(value * 100 + 1e-6);
    }

    /** @returns money text without the unit. */
    function formatUnits(units, currency) {
      if (units === undefined || units === null) return '—';
      if (currency === 'TOKENS') return groupDigits(String(Math.round(units)));
      const negative = units < 0;
      const absolute = Math.abs(units);
      const whole = groupDigits(String(Math.floor(absolute / 100)));
      const fraction = String(absolute % 100).padStart(2, '0');
      return `${negative ? '-' : ''}${whole}.${fraction}`;
    }

    /** @returns the localized unit for a currency code. */
    function unitOf(currency, lang) {
      if (currency === 'TOKENS') return tr(lang, 'unitTokens');
      if (currency === 'CNY') return tr(lang, 'unitCny');
      if (currency === 'USD') return tr(lang, 'unitUsd');
      return currency ?? '';
    }

    /** @returns a localized reason why a detected connection cannot be read. */
    function unreadableReason(source, lang) {
      if (source.status === 'failed' && source.httpStatus === 410 && source.family === 'siliconflow') {
        return tr(lang, 'statusApiRetired', { status: source.httpStatus });
      }
      if (source.status === 'failed' && source.httpStatus !== undefined) {
        return tr(lang, 'statusFailedHttp', { status: source.httpStatus });
      }
      const status = statusText(source, lang);
      if (status !== '') return status;
      if (typeof source.message === 'string' && source.message !== '') return source.message;
      return tr(lang, 'statusFailed');
    }

    /** @returns the localized display label of one source. */
    function sourceLabel(source, lang) {
      if (source.merged === true && source.family === 'deepseek') {
        const label = source.mergedHasAccount === true ? tr(lang, 'mergedDeepseekLabel') : tr(lang, 'deepseekApiLabel');
        return label + (source.variant === 'intl' ? tr(lang, 'labelIntl') : '');
      }
      if (source.kind === 'account') return tr(lang, 'accountLabel') + (source.variant === 'intl' ? tr(lang, 'labelIntl') : '');
      if (source.kind === 'provider') {
        const suffix = source.variant === 'intl' ? tr(lang, 'labelIntl') : '';
        switch (source.family) {
          case 'deepseek': return tr(lang, 'deepseekApiLabel') + suffix;
          case 'kimi': return tr(lang, 'labelKimi') + suffix;
          case 'siliconflow': return tr(lang, 'labelSiliconflow') + suffix;
          case 'openrouter': return tr(lang, 'labelOpenrouter');
          case 'glm': return tr(lang, 'labelGlm') + suffix + tr(lang, 'quotaSuffix');
          case 'minimax': return tr(lang, 'labelMinimax') + suffix + tr(lang, 'quotaSuffix');
          case 'kimi-coding': return tr(lang, 'labelKimiCoding') + tr(lang, 'quotaSuffix');
          case 'stepfun': return tr(lang, 'labelStepfun') + tr(lang, 'providerSuffix');
          case 'novita': return tr(lang, 'labelNovita') + tr(lang, 'providerSuffix');
          default: return `${source.name}${tr(lang, 'providerSuffix')}`;
        }
      }
      return source.name;
    }

    /** @returns the label language for one source: its own choice, else the page language. */
    function labelLangOf(source, prefs, ctx) {
      const override = prefs.sourceLang !== undefined ? prefs.sourceLang[source.key] : undefined;
      if (override === 'zh' || override === 'en') return override;
      return resolveLang(prefs, ctx);
    }

    /** @returns the currency symbol shown before an amount. */
    function symbolOf(currency) {
      if (currency === 'CNY') return '¥';
      if (currency === 'USD') return '$';
      return undefined;
    }

    /** @returns the ready amount rendered with its currency symbol/suffix. */
    function moneyText(source, lang) {
      if (source.status !== 'ready') return '—';
      if (source.currency === 'TOKENS') return `${formatUnits(source.units, 'TOKENS')} ${unitOf('TOKENS', lang)}`;
      if (source.subCent === true) {
        const symbol = symbolOf(source.currency);
        return symbol === undefined ? '<0.01' : `<${symbol}0.01`;
      }
      const number = formatUnits(source.units, source.currency);
      const symbol = symbolOf(source.currency);
      if (symbol !== undefined) return `${symbol}${number}`;
      const code = source.currency ?? '';
      return code === '' ? number : `${code}${code.length > 2 ? ' ' : ''}${number}`;
    }

    /** @returns a percentage rendered without trailing zeros. */
    function formatPercent(value) {
      if (!Number.isFinite(value)) return '—';
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    /** @returns a localized short duration such as `2h31m` / `2 小时 31 分`. */
    function formatDuration(milliseconds, lang) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return tr(lang, 'resettingNow');
      const minutes = Math.max(1, Math.floor(milliseconds / 60000));
      if (minutes < 60) return tr(lang, 'minutesShort', { n: minutes });
      const hours = Math.floor(minutes / 60);
      const restMinutes = minutes % 60;
      if (hours < 24) {
        return restMinutes === 0 ? tr(lang, 'hoursShort', { n: hours }) : tr(lang, 'hoursMinutes', { n: hours, m: restMinutes });
      }
      const days = Math.floor(hours / 24);
      const restHours = hours % 24;
      return restHours === 0 ? tr(lang, 'daysShort', { n: days }) : tr(lang, 'daysHours', { n: days, h: restHours });
    }

    /** @returns the quota window that best represents the subscription row. */
    function quotaWindowOf(source) {
      const windows = Array.isArray(source.quota?.windows) ? source.quota.windows : [];
      return windows.find((window) => window.key === 'session')
        ?? windows.find((window) => window.key === 'week')
        ?? windows[0];
    }

    /** @returns the main quota text plus its reset suffix, or undefined. */
    function quotaValueText(source, lang) {
      const window = quotaWindowOf(source);
      if (window === undefined) return undefined;
      let main;
      if (window.remainingPercent !== undefined) {
        main = tr(lang, 'quotaRemaining', { percent: formatPercent(window.remainingPercent) });
      } else if (window.remaining !== undefined && window.total !== undefined) {
        main = tr(lang, 'quotaCounts', {
          remaining: groupDigits(String(Math.round(window.remaining))),
          total: groupDigits(String(Math.round(window.total))),
        });
      } else {
        return undefined;
      }
      const suffix = window.resetAt === undefined
        ? ''
        : tr(lang, 'quotaResetSuffix', { time: formatDuration(window.resetAt - Date.now(), lang) });
      return { main, suffix };
    }

    /** @returns one window's localized detail text. */
    function quotaWindowDetail(window, lang) {
      const percent = window.remainingPercent === undefined ? undefined : `${formatPercent(window.remainingPercent)}%`;
      const value = percent
        ?? `${groupDigits(String(Math.round(window.remaining ?? 0)))}/${groupDigits(String(Math.round(window.total ?? 0)))}`;
      const key = window.key === 'week' ? 'detailWindowWeek' : window.key === 'tools' ? 'detailWindowTools' : 'detailWindow5h';
      return tr(lang, key, { value });
    }

    /** @returns a localized status sentence for a source. */
    function statusText(source, lang) {
      switch (source.status) {
        case 'no_credential': return tr(lang, 'statusNoCredential');
        case 'unsupported': return tr(lang, 'statusUnsupported');
        case 'rejected': return tr(lang, 'statusRejected');
        case 'signedOut': return tr(lang, 'statusSignedOut');
        case 'loading': return tr(lang, 'statusLoading');
        case 'failed': return tr(lang, 'statusFailed');
        case 'no_plan': return tr(lang, 'statusNoPlan');
        case 'signin_expired': return tr(lang, 'statusSigninExpired');
        default: return '';
      }
    }

    /** @returns the detail parts of a ready source as short localized text. */
    function detailParts(source, lang) {
      if (source.quota !== null && typeof source.quota === 'object') {
        const parts = [];
        if (typeof source.quota.planLevel === 'string' && source.quota.planLevel !== '') {
          parts.push(tr(lang, 'detailPlan', { level: source.quota.planLevel }));
        }
        for (const window of Array.isArray(source.quota.windows) ? source.quota.windows : []) {
          parts.push(quotaWindowDetail(window, lang));
        }
        return parts;
      }
      const detail = source.detail;
      if (detail === null || typeof detail !== 'object') return [];
      const currency = source.currency;
      const parts = [];
      const add = (amount, key) => {
        const units = amountToUnits(amount, currency);
        if (units === undefined) return;
        parts.push(tr(lang, key, { value: `${formatUnits(units, currency)} ${unitOf(currency, lang)}` }));
      };
      add(detail.granted, 'detailGranted');
      add(detail.toppedUp, 'detailToppedUp');
      add(detail.voucher, 'detailVoucher');
      add(detail.cash, 'detailCash');
      add(detail.used, 'detailUsed');
      if (typeof detail.gateway === 'string' && detail.gateway !== '') {
        parts.push(tr(lang, 'detailGateway', { name: detail.gateway }));
      }
      return parts;
    }

    /** Tiny observable store with subscribe/get/set. */
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        get: () => value,
        set: (next) => {
          value = typeof next === 'function' ? next(value) : next;
          for (const listener of listeners) listener();
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    }

    /** Subscribe a component to a store. */
    function useStore(store) {
      const [, force] = React.useState(0);
      React.useEffect(() => store.subscribe(() => force((value) => value + 1)), [store]);
      return store.get();
    }

    /** Re-render on the app locale signal. */
    function useLocale(ctx) {
      const [, force] = React.useState(0);
      React.useEffect(() => ctx.locale.subscribe(() => force((value) => value + 1)), [ctx]);
    }

    /** @returns true for a plausible stored custom source. */
    function isSourceLike(value) {
      return value !== null && typeof value === 'object'
        && typeof value.id === 'string' && value.id !== ''
        && typeof value.url === 'string' && value.url !== '';
    }

    /** @returns the label-language map with legacy DeepSeek keys folded into the merged key. */
    function migrateLangKeys(map) {
      const next = {};
      for (const [key, value] of Object.entries(map)) next[LEGACY_SOURCE_KEYS[key] ?? key] = value;
      return next;
    }

    /** @returns the preference object from localStorage, normalized and defaulted. */
    function loadPrefs() {
      let stored;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        stored = raw === null ? undefined : JSON.parse(raw);
      } catch {
        stored = undefined;
      }
      const source = stored !== null && typeof stored === 'object' ? stored : {};
      return {
        language: source.language === 'zh' || source.language === 'en' ? source.language : DEFAULT_PREFS.language,
        refreshSeconds: Number.isFinite(source.refreshSeconds) ? source.refreshSeconds : DEFAULT_PREFS.refreshSeconds,
        hidden: Array.isArray(source.hidden) ? migrateKeys(source.hidden.filter((key) => typeof key === 'string')) : [],
        order: Array.isArray(source.order) ? migrateKeys(source.order.filter((key) => typeof key === 'string')) : [],
        customSources: Array.isArray(source.customSources) ? source.customSources.filter(isSourceLike) : [],
        sourceLang: source.sourceLang !== null && typeof source.sourceLang === 'object'
          ? migrateLangKeys(Object.fromEntries(Object.entries(source.sourceLang).filter(([, value]) => value === 'zh' || value === 'en')))
          : {},
        splitDeepseek: source.splitDeepseek === true,
      };
    }

    /** @returns a credential reference derived from a custom source id. */
    function credentialRefOf(source) {
      const explicit = source !== undefined && typeof source.credentialRef === 'string' ? source.credentialRef : '';
      if (REF_PATTERN.test(explicit)) return explicit;
      const safe = String(source?.id ?? 'custom').replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
      return `BALANCE_CENTER_${safe}`.slice(0, 60);
    }

    /** Call one Host endpoint on the authenticated same-origin channel. */
    async function callHost(endpoint, payload) {
      try {
        const response = await fetch(ROUTE, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint, ...payload }),
          signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
        });
        if (!response.ok) return { ok: false, error: { code: `http-${response.status}`, message: `HTTP ${response.status}` } };
        const body = await response.json();
        if (body === null || typeof body !== 'object') return { ok: false, error: { code: 'bad-response', message: 'empty response' } };
        return body;
      } catch (error) {
        return { ok: false, error: { code: 'transport', message: String(error?.message ?? error) } };
      }
    }

    /** @returns the credentials Remote namespace, or undefined when the composition lacks it. */
    function credentialsOf(ctx) {
      try {
        return ctx.remote === undefined ? undefined : ctx.remote.credentials;
      } catch {
        return undefined;
      }
    }

    /** Write one credential value through the Harness credential service. */
    async function setCredential(ctx, ref, value) {
      if (!REF_PATTERN.test(ref)) return false;
      const credentials = credentialsOf(ctx);
      if (credentials === undefined || typeof credentials.set !== 'function') return false;
      try {
        const result = await credentials.set(ref, value);
        return result !== null && typeof result === 'object' && result.ok === true;
      } catch {
        return false;
      }
    }

    /** Remove one credential value; best effort. */
    async function unsetCredential(ctx, ref) {
      if (!REF_PATTERN.test(ref)) return;
      const credentials = credentialsOf(ctx);
      if (credentials === undefined || typeof credentials.unset !== 'function') return;
      try {
        await credentials.unset(ref);
      } catch {
        /* the value may already be absent */
      }
    }

    /** Read and normalize the DeepSeek member balance from the account Remote namespace. */
    async function readAccountSource(ctx, metadata) {
      const account = ctx.remote === undefined ? undefined : ctx.remote.account;
      if (account === undefined || typeof account.getBalance !== 'function') return { status: 'unsupported' };
      let result;
      try {
        result = await account.getBalance(metadata);
      } catch {
        return { status: 'failed' };
      }
      if (result === null || typeof result !== 'object' || result.ok !== true) return { status: 'failed' };
      const value = result.value;
      if (value === null || value === undefined) return { status: 'signedOut' };
      if (value.status !== 'ready') return { status: 'failed' };
      const wallets = Array.isArray(value.value) ? value.value : [];
      const bonuses = Array.isArray(value.bonusWallets) ? value.bonusWallets : [];
      const all = wallets.concat(bonuses);
      let currency = all.some((wallet) => wallet !== null && typeof wallet === 'object' && wallet.currency === 'CNY') ? 'CNY' : undefined;
      if (currency === undefined) {
        const first = all.find((wallet) => wallet !== null && typeof wallet === 'object' && typeof wallet.currency === 'string');
        currency = first === undefined ? 'CNY' : first.currency;
      }
      let cents = 0;
      let positive = false;
      for (const wallet of all) {
        if (wallet === null || typeof wallet !== 'object' || wallet.currency !== currency) continue;
        const part = decimalCents(wallet.balance);
        if (part === null) continue;
        cents += part;
        if (part > 0) positive = true;
      }
      const base = { status: 'ready', currency, units: cents, variant: currency === 'USD' ? 'intl' : 'cn' };
      if (cents === 0 && positive) return { ...base, subCent: true };
      return base;
    }

    /** Normalize one Host provider record into a render source. */
    function providerSource(record) {
      const source = {
        key: `provider:${record.id}`,
        kind: 'provider',
        id: record.id,
        name: record.name ?? record.id,
        status: record.status ?? 'failed',
        family: record.family,
        variant: record.variant,
        currency: record.currency,
        detail: record.detail,
        message: record.message,
        httpStatus: record.httpStatus,
      };
      if (record.status === 'ready') {
        if (record.quota !== null && typeof record.quota === 'object' && Array.isArray(record.quota.windows)) {
          source.quota = record.quota;
          return source;
        }
        const units = amountToUnits(record.amount, record.currency);
        if (units === undefined) return { ...source, status: 'failed' };
        source.units = units;
        if (units === 0 && record.amount > 0) source.subCent = true;
      }
      return source;
    }

    /** Normalize one custom source record plus its stored definition. */
    function customSource(record, definition) {
      const source = {
        key: `custom:${record.id}`,
        kind: 'custom',
        id: record.id,
        name: definition?.name ?? record.name ?? record.id,
        status: record.status ?? 'loading',
        currency: record.currency ?? definition?.currency ?? 'CNY',
        definition,
      };
      if (record.status === 'ready') {
        const units = amountToUnits(record.amount, record.currency ?? definition?.currency);
        if (units === undefined) return { ...source, status: 'failed' };
        source.units = units;
        if (units === 0 && record.amount > 0) source.subCent = true;
      }
      return source;
    }

    /** Build the source list from the latest data and definitions. */
    function allSources(data, prefs) {
      const list = [];
      if (data.account !== undefined) list.push({ key: 'account', kind: 'account', id: 'account', name: '', ...data.account });
      const definitions = new Map((prefs.customSources ?? []).map((source) => [source.id, source]));
      const records = new Map();
      for (const provider of data.providers ?? []) list.push(providerSource(provider));
      for (const record of data.custom ?? []) records.set(record.id, record);
      for (const definition of definitions.values()) {
        const record = records.get(definition.id);
        list.push(customSource(record ?? {
          id: definition.id,
          name: definition.name,
          status: data.error === 'host' ? 'failed' : 'loading',
        }, definition));
        records.delete(definition.id);
      }
      for (const record of records.values()) list.push(customSource(record, definitions.get(record.id)));
      return list;
    }

    /** @returns true when this source can actually be read on this Harness (so it may be listed). */
    function readable(source) {
      if (source.kind === 'provider') {
        return source.status !== 'unsupported'
          && source.status !== 'no_credential'
          && source.status !== 'loading'
          && source.status !== 'no_plan'
          && source.status !== 'signin_expired';
      }
      if (source.kind === 'account') return source.status === 'ready';
      return true;
    }

    /** @returns the merge group of one source; every DeepSeek connection shares one row. */
    function mergeKeyOf(source) {
      if (source.kind === 'account') return 'deepseek';
      if (source.kind === 'provider' && source.family === 'deepseek') return 'deepseek';
      return source.key;
    }

    /** @returns the display priority of one DeepSeek connection inside its merged row. */
    function mergePriority(source) {
      if (source.kind === 'account') return 0;
      if (source.id === 'deepseek-official') return 1;
      if (source.id === 'deepseek') return 2;
      return 3;
    }

    /** @returns the localized short label of one merged DeepSeek connection. */
    function mergedMemberLabel(source, lang) {
      return source.kind === 'account' ? tr(lang, 'sourceMember') : tr(lang, 'sourceApiKey');
    }

    /** @returns sources with the DeepSeek member login and API connections collapsed into one row. */
    function mergeDeepseek(sources) {
      const groups = new Map();
      for (const source of sources) {
        const key = mergeKeyOf(source);
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [source]);
        else group.push(source);
      }
      const merged = [];
      for (const [key, members] of groups) {
        if (members.length === 1) {
          merged.push(members[0]);
          continue;
        }
        const ordered = members.slice().sort((left, right) => mergePriority(left) - mergePriority(right));
        const chosen = ordered.find((source) => source.status === 'ready') ?? ordered[0];
        merged.push({
          ...chosen,
          key,
          family: 'deepseek',
          merged: true,
          mergedHasAccount: members.some((source) => source.kind === 'account'),
          mergedCount: members.length,
          mergedMembers: ordered,
        });
      }
      return merged;
    }

    /** @returns the source list the UI may show and let the user configure. */
    function listSources(data, prefs) {
      const sources = allSources(data, prefs).filter(readable);
      return prefs.splitDeepseek === true ? sources : mergeDeepseek(sources);
    }

    /** @returns visible, ready sources in the user's order. */
    function visibleSources(data, prefs) {
      const hidden = new Set(prefs.hidden ?? []);
      const order = prefs.order ?? [];
      const rank = (key) => {
        const index = order.indexOf(key);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      return listSources(data, prefs)
        .filter((source) => !hidden.has(source.key))
        .filter((source) => source.status === 'ready')
        .sort((left, right) => rank(left.key) - rank(right.key));
    }


    /** Sidebar rows and the settings page share the injected stylesheet. */
    const CSS = `
.dshab_rows{box-sizing:border-box;display:flex;flex-direction:column;width:100%;min-width:0;margin:2px 0 -4px;padding:0 4px;pointer-events:none}
.dshab_row{display:flex;align-items:center;gap:0;height:21px;min-width:0;font-size:13px;line-height:18px;white-space:nowrap;-webkit-user-select:none;user-select:none}
.dshab_rowLabel{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}
.dshab_rowValue{flex:none;margin-left:0;color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.dshab_rowMeta{font-weight:400;color:var(--dsw-alias-label-tertiary)}
.dshab_page{display:flex;flex-direction:column;gap:20px;padding:8px 0 24px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dshab_pageHead{display:flex;flex-direction:column;gap:4px}
.dshab_pageTitle{font-size:16px;font-weight:600;line-height:24px;margin:0}
.dshab_pageSubtitle{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:0}
.dshab_section{display:flex;flex-direction:column;gap:8px}
.dshab_sectionTitle{font-size:14px;font-weight:500;line-height:22px;margin:0}
.dshab_card{box-sizing:border-box;display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-bg-layer-1);padding:4px 16px}
.dshab_setting{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:46px;padding:8px 0}
.dshab_setting + .dshab_setting{border-top:.5px solid var(--dsw-alias-border-l1)}
.dshab_settingMain{display:flex;flex-direction:column;gap:2px;min-width:0}
.dshab_settingLabel{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dshab_settingHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dshab_settingControl{display:flex;align-items:center;gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.dshab_statusReady{color:var(--dsw-alias-state-success-primary)}
.dshab_statusWarn{color:var(--dsw-alias-state-warn-primary)}
.dshab_statusError{color:var(--dsw-alias-state-error-primary)}
.dshab_amount{font-variant-numeric:tabular-nums;font-weight:600}
.dshab_switch{box-sizing:border-box;display:inline-flex;align-items:center;flex:none;width:36px;height:20px;padding:2px;border-radius:999px;border:none;background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .15s ease}
.dshab_switch:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.dshab_switchOn{background:var(--dsw-alias-brand-primary)}
.dshab_switchThumb{width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-inverted,#fff);transform:translateX(0);transition:transform .15s ease}
.dshab_switchOn .dshab_switchThumb{transform:translateX(16px)}
.dshab_select,.dshab_input{box-sizing:border-box;height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.dshab_select:focus-visible,.dshab_input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dshab_input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dshab_btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}
.dshab_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshab_btn:disabled{opacity:.5;cursor:default}
.dshab_btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dshab_btnPrimary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted,#fff)}
.dshab_btnPrimary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.9}
.dshab_iconBtn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer}
.dshab_selectSmall{box-sizing:border-box;height:26px;padding:0 4px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.dshab_selectSmall:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dshab_iconBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshab_iconBtn:disabled{opacity:.4;cursor:default}
.dshab_editor{display:flex;flex-direction:column;gap:10px;padding:12px 0 8px;border-top:.5px solid var(--dsw-alias-border-l1)}
.dshab_field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dshab_fieldLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dshab_fieldRow{display:flex;gap:10px;flex-wrap:wrap}
.dshab_fieldRow > .dshab_field{flex:1 1 180px}
.dshab_editorActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none}
.dshab_editorStatus{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:0}
.dshab_empty{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:4px 0}
.dshab_about{display:flex;flex-direction:column;gap:12px;padding:10px 0}
.dshab_aboutName{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.dshab_aboutLinks{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dshab_aboutLink{color:var(--dsw-alias-label-primary);text-decoration:underline;text-underline-offset:2px}
.dshab_aboutBlock{display:flex;flex-direction:column;gap:3px}
.dshab_aboutTitle{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary)}
.dshab_aboutLine,.dshab_aboutText{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dshab_aboutLabel{color:var(--dsw-alias-label-tertiary)}
.dshab_footerNote{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
`;

    /** Install the stylesheet once per page. */
    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const selector = 'style[data-plugin-css=' + JSON.stringify(STYLE_ID) + ']';
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-balance-center';
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
      };
    }

    // ---------------------------------------------------------------------
    // Presentational primitives matching shipped Settings pages.
    // ---------------------------------------------------------------------

    /** One labeled row with a trailing control. */
    function SettingRow({ label, hint, control }) {
      return h('div', { className: 'dshab_setting' },
        h('div', { className: 'dshab_settingMain' },
          h('span', { className: 'dshab_settingLabel' }, label),
          hint === undefined || hint === '' ? null : h('span', { className: 'dshab_settingHint' }, hint)),
        h('div', { className: 'dshab_settingControl' }, control));
    }

    /** Native-looking on/off switch. */
    function Switch({ checked, onChange, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked === true,
        'aria-label': label,
        className: checked === true ? 'dshab_switch dshab_switchOn' : 'dshab_switch',
        onClick: () => onChange(checked !== true),
      }, h('span', { className: 'dshab_switchThumb' }));
    }

    /** Plain outline button. */
    function Button({ children, onClick, disabled, primary, title }) {
      return h('button', {
        type: 'button',
        className: primary === true ? 'dshab_btn dshab_btnPrimary' : 'dshab_btn',
        onClick,
        disabled: disabled === true,
        title,
      }, children);
    }

    /** Compact row-action button. */
    function IconButton({ children, onClick, disabled, label }) {
      return h('button', {
        type: 'button',
        className: 'dshab_iconBtn',
        onClick,
        disabled: disabled === true,
        'aria-label': label,
        title: label,
      }, children);
    }

    /** Select bound to a string value. */
    function Select({ value, onChange, options, label, className }) {
      return h('select', {
        className: className ?? 'dshab_select',
        value,
        'aria-label': label,
        onChange: (event) => onChange(event.target.value),
      }, options.map((option) => h('option', { key: String(option.value), value: option.value }, option.label)));
    }

    /** Text input bound to a string value. */
    function TextInput({ value, onChange, placeholder, label, type }) {
      return h('input', {
        className: 'dshab_input',
        type: type ?? 'text',
        value,
        placeholder,
        'aria-label': label,
        onChange: (event) => onChange(event.target.value),
      });
    }

    /** One field with a caption above it. */
    function Field({ label, hint, children }) {
      return h('div', { className: 'dshab_field' },
        h('span', { className: 'dshab_fieldLabel' }, label),
        children,
        hint === undefined ? null : h('span', { className: 'dshab_fieldLabel' }, hint));
    }

    /** @returns a readable error message from a failed RPC result or status record. */
    function describeError(result) {
      if (result === null || result === undefined) return 'unknown error';
      if (typeof result === 'string') return result;
      const error = result.error;
      if (error !== undefined && typeof error.message === 'string') return error.message;
      if (typeof result.message === 'string') return result.message;
      return 'unknown error';
    }

    /** @returns true when an authenticated custom URL would send its key in cleartext. */
    function insecureCustomUrl(draft) {
      if ((draft.authMode ?? 'bearer') === 'none') return false;
      let parsed;
      try {
        parsed = new URL(String(draft.url ?? '').trim());
      } catch {
        return false;
      }
      if (parsed.protocol === 'https:') return false;
      const host = parsed.hostname;
      const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1'
        || host === '[::1]' || host.endsWith('.localhost');
      return !loopback;
    }

    /** @returns a localized version of a technical error message when it is one we know. */
    function localizeError(message, lang) {
      const raw = typeof message === 'string' ? message.trim() : '';
      if (raw === '') return tr(lang, 'unknownError');
      if (raw === 'invalid url') return tr(lang, 'errorInvalidUrl');
      if (raw === 'jsonPath did not resolve to a number') return tr(lang, 'errorJsonPath');
      if (raw === 'response carried no numeric balance') return tr(lang, 'errorNoNumber');
      if (raw === 'credential write failed') return tr(lang, 'errorCredentialWrite');
      if (raw === 'insecure url') return tr(lang, 'customInsecureUrl');
      if (raw === 'unknown error') return tr(lang, 'unknownError');
      return message;
    }

    /** @returns a test result value formatted with the shared money rules. */
    function testValueText(value, fallbackCurrency) {
      const amount = value === null || typeof value !== 'object' ? undefined : value.amount;
      if (!Number.isFinite(amount)) return '—';
      const currency = value?.currency ?? fallbackCurrency;
      const units = amountToUnits(amount, currency);
      if (units === undefined) return '—';
      if (units === 0 && amount > 0) return '<0.01';
      return formatUnits(units, currency);
    }

    /** Label-language choice rendered in each source row. */
    const LABEL_LANGUAGES = [
      { value: 'auto' },
      { value: 'zh' },
      { value: 'en' },
    ];

    /** One source line inside the Settings page. */
    function SourceSetting({ source, lang, labelLang, labelLangValue, visible, canUp, canDown, onToggle, onUp, onDown, onEdit, onDelete, onLabelLang }) {
      const detail = detailParts(source, labelLang).join(' · ');
      const status = source.status === 'ready' ? '' : unreadableReason(source, labelLang);
      const mergedHint = source.merged === true
        ? tr(labelLang, 'mergedHint', {
          n: source.mergedCount,
          list: source.mergedMembers.map((member) => {
            const suffix = member.status === 'ready' ? '' : `（${statusText(member, labelLang)}）`;
            return `${mergedMemberLabel(member, labelLang)}${suffix}`;
          }).join('、'),
        })
        : '';
      const baseHint = status !== '' ? status : detail;
      const hint = mergedHint === '' ? baseHint : baseHint === '' ? mergedHint : `${mergedHint} · ${baseHint}`;
      const tone = status !== '' && (source.status === 'rejected' || source.status === 'failed')
        ? 'dshab_settingHint dshab_statusError'
        : status !== '' && source.status === 'no_credential'
          ? 'dshab_settingHint dshab_statusWarn'
          : 'dshab_settingHint';
      const languageOptions = LABEL_LANGUAGES.map((choice) => ({
        value: choice.value,
        label: choice.value === 'auto' ? tr(lang, 'langAutoShort') : choice.value === 'zh' ? '中文' : 'EN',
      }));
      const quota = source.quota === undefined ? undefined : quotaValueText(source, labelLang);
      const value = quota === undefined ? moneyText(source, labelLang) : quota.main;
      return h('div', { className: 'dshab_setting' },
        h('div', { className: 'dshab_settingMain' },
          h('span', { className: 'dshab_settingLabel' }, `${sourceLabel(source, labelLang)}${tr(labelLang, 'colon')}${source.status === 'ready' ? value : ''}`),
          hint === '' ? null : h('span', { className: tone }, hint)),
        h('div', { className: 'dshab_settingControl' },
          source.kind === 'custom' ? null : h(Select, {
            className: 'dshab_selectSmall',
            value: labelLangValue ?? 'auto',
            label: tr(lang, 'labelLang'),
            onChange: onLabelLang,
            options: languageOptions,
          }),
          h(IconButton, { onClick: onUp, disabled: canUp !== true, label: tr(lang, 'moveUp') }, '↑'),
          h(IconButton, { onClick: onDown, disabled: canDown !== true, label: tr(lang, 'moveDown') }, '↓'),
          source.kind === 'custom' ? h(IconButton, { onClick: onEdit, label: tr(lang, 'customEdit') }, '✎') : null,
          source.kind === 'custom' ? h(IconButton, { onClick: onDelete, label: tr(lang, 'customDelete') }, '✕') : null,
          h(Switch, { checked: visible !== false, onChange: onToggle, label: sourceLabel(source, labelLang) })));
    }


    /** Custom-source editor form. */
    function CustomEditor({ lang, initial, onCancel, onSave, onTest }) {
      const [draft, setDraft] = React.useState(initial);
      const [busy, setBusy] = React.useState(false);
      const [test, setTest] = React.useState(undefined);
      const patch = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
      const credentialRef = credentialRefOf(draft);
      const save = async () => {
        if (draft.name.trim() === '' || !/^https?:\/\//i.test(draft.url.trim())) {
          setTest({ ok: false, message: tr(lang, 'customInvalid') });
          return;
        }
        if (insecureCustomUrl(draft)) {
          setTest({ ok: false, message: tr(lang, 'customInsecureUrl') });
          return;
        }
        setBusy(true);
        const saved = await onSave({ ...draft, name: draft.name.trim(), url: draft.url.trim(), credentialRef });
        setBusy(false);
        if (saved === true) onCancel();
      };
      const runTest = async () => {
        if (draft.url.trim() === '' || !/^https?:\/\//i.test(draft.url.trim())) {
          setTest({ ok: false, message: tr(lang, 'customInvalid') });
          return;
        }
        if (insecureCustomUrl(draft)) {
          setTest({ ok: false, message: tr(lang, 'customInsecureUrl') });
          return;
        }
        setBusy(true);
        const result = await onTest({ ...draft, credentialRef });
        setBusy(false);
        if (result !== null && typeof result === 'object' && result.ok === true) {
          const value = result.value;
          if (value !== null && typeof value === 'object' && value.status !== 'ready') {
            const unsaved = typeof draft.key === 'string' && draft.key.trim() !== '';
            setTest({
              ok: false,
              message: unsaved && value.status === 'no_credential'
                ? tr(lang, 'customTestSaveFirst')
                : tr(lang, 'customTestFail', { message: localizeError(statusText(value, lang), lang) }),
            });
            return;
          }
          setTest({ ok: true, message: tr(lang, 'customTestOk', { value: `${testValueText(value, draft.currency)} ${unitOf(value?.currency ?? draft.currency, lang)}` }) });
        } else {
          setTest({ ok: false, message: tr(lang, 'customTestFail', { message: localizeError(describeError(result), lang) }) });
        }
      };
      return h('div', { className: 'dshab_editor' },
        h('div', { className: 'dshab_fieldRow' },
          h(Field, { label: tr(lang, 'customName') },
            h(TextInput, { value: draft.name, onChange: (value) => patch('name', value), placeholder: tr(lang, 'customNamePlaceholder'), label: tr(lang, 'customName') })),
          h(Field, { label: tr(lang, 'customCurrency') },
            h(Select, {
              value: draft.currency,
              label: tr(lang, 'customCurrency'),
              onChange: (value) => patch('currency', value),
              options: [
                { value: 'CNY', label: tr(lang, 'currencyCny') },
                { value: 'USD', label: tr(lang, 'currencyUsd') },
                { value: 'TOKENS', label: tr(lang, 'currencyTokens') },
              ],
            }))),
        h(Field, { label: tr(lang, 'customUrl') },
          h(TextInput, { value: draft.url, onChange: (value) => patch('url', value), placeholder: tr(lang, 'customUrlPlaceholder'), label: tr(lang, 'customUrl') })),
        h('div', { className: 'dshab_fieldRow' },
          h(Field, { label: tr(lang, 'customAuth') },
            h(Select, {
              value: draft.authMode,
              label: tr(lang, 'customAuth'),
              onChange: (value) => patch('authMode', value),
              options: [
                { value: 'bearer', label: tr(lang, 'authBearer') },
                { value: 'header', label: tr(lang, 'authHeader') },
                { value: 'none', label: tr(lang, 'authNone') },
              ],
            })),
          draft.authMode === 'header'
            ? h(Field, { label: tr(lang, 'customHeader') },
              h(TextInput, { value: draft.headerName, onChange: (value) => patch('headerName', value), label: tr(lang, 'customHeader') }))
            : null,
          draft.authMode === 'none'
            ? null
            : h(Field, { label: tr(lang, 'customKey'), hint: draft.hasKey === true ? tr(lang, 'customKeySaved') : tr(lang, 'customKeyMissing') },
              h(TextInput, { type: 'password', value: draft.key ?? '', onChange: (value) => patch('key', value), label: tr(lang, 'customKey') }))),
        h(Field, { label: tr(lang, 'customJsonPath'), hint: tr(lang, 'customJsonPathHint') },
          h(TextInput, { value: draft.jsonPath, placeholder: tr(lang, 'customJsonPathPlaceholder'), onChange: (value) => patch('jsonPath', value), label: tr(lang, 'customJsonPath') })),
        h('div', { className: 'dshab_settingHint' }, tr(lang, 'customTestSavedHint')),
        h('div', { className: 'dshab_editorActions' },
          h(Button, { onClick: save, disabled: busy, primary: true }, tr(lang, 'customSave')),
          h(Button, { onClick: runTest, disabled: busy }, busy === true ? tr(lang, 'customTesting') : tr(lang, 'customTest')),
          h(Button, { onClick: onCancel, disabled: busy }, tr(lang, 'customCancel')),
          test === undefined
            ? null
            : h('span', { className: test.ok === true ? 'dshab_editorStatus dshab_statusReady' : 'dshab_editorStatus dshab_statusError' }, test.message)));
    }

    /** Plugin definition returned into the Client root. */
    return {
      inject: ['slots', 'locale', 'remote', 'remote.account', 'remote.credentials'],
      apply(ctx) {
        ctx.effect(installStyles, 'balance-center: styles');

        /** Preference store (localStorage-backed). */
        const prefsStore = createStore(loadPrefs());
        /** Data store fed by the account Remote and the Host provider channel. */
        const dataStoreStore = createStore({ account: { status: 'loading' }, providers: undefined, custom: [], loading: false, error: undefined, at: 0 });

        /** Re-read the account balance and the Host provider snapshot. */
        async function refresh() {
          if (dataStoreStore.get().loading === true) return;
          dataStoreStore.set((current) => ({ ...current, loading: true }));
          const prefs = prefsStore.get();
          const metadata = accountMetadata(ctx);
          const accountTask = readAccountSource(ctx, metadata).catch(() => ({ status: 'failed' }));
          const hostTask = callHost('snapshot', { customSources: prefs.customSources });
          const account = await accountTask;
          const host = await hostTask;
          const hostOk = host.ok === true;
          dataStoreStore.set({
            account,
            providers: hostOk === true ? host.value.providers ?? [] : undefined,
            custom: hostOk === true ? host.value.custom ?? [] : [],
            loading: false,
            error: hostOk === true ? undefined : 'host',
            at: Date.now(),
          });
        }
        const dataStore = { store: dataStoreStore, refresh };

        /** Refresh scheduling: interval, focus, visibility. */
        let timer = 0;
        const arm = () => {
          window.clearInterval(timer);
          const seconds = prefsStore.get().refreshSeconds;
          if (seconds > 0) {
            timer = window.setInterval(() => {
              if (document.visibilityState !== 'hidden') refresh();
            }, seconds * 1000);
          }
        };
        ctx.effect(() => {
          const offPrefs = prefsStore.subscribe(arm);
          const onFocus = () => refresh();
          const onVisibility = () => {
            if (document.visibilityState === 'visible') refresh();
          };
          window.addEventListener('focus', onFocus);
          document.addEventListener('visibilitychange', onVisibility);
          arm();
          refresh();
          return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
            offPrefs();
          };
        }, 'balance-center: refresh scheduler');
        ctx.effect(() => {
          if (ctx.remote === undefined || typeof ctx.remote.$on !== 'function') return () => {};
          const events = ['llm/adapters-updated', 'settings/document-updated', 'credentials/record-updated', 'credentials/reference-updated'];
          const stops = [];
          for (const name of events) {
            try {
              stops.push(ctx.remote.$on(name, () => refresh()));
            } catch {
              /* an event key outside this build's allowlist simply does not refresh */
            }
          }
          return () => {
            for (const stop of stops) if (typeof stop === 'function') stop();
          };
        }, 'balance-center: provider change listeners');

        /** Sidebar lines above the account row. */
        function BalanceRows({ wide }) {
          useLocale(ctx);
          const prefs = useStore(prefsStore);
          const data = useStore(dataStore.store);
          if (wide !== true) return null;
          const sources = visibleSources(data, prefs);
          if (sources.length === 0) return null;
          return h('div', { className: 'dshab_rows', role: 'status', 'aria-live': 'polite' },
            sources.map((source) => {
              const sourceLang = labelLangOf(source, prefs, ctx);
              const quota = source.quota === undefined ? undefined : quotaValueText(source, sourceLang);
              const value = quota === undefined ? moneyText(source, sourceLang) : quota.main;
              const meta = quota === undefined || quota.suffix === '' ? null : h('span', { className: 'dshab_rowMeta' }, quota.suffix);
              return h('div', { className: 'dshab_row', key: source.key },
                h('span', { className: 'dshab_rowLabel' }, `${sourceLabel(source, sourceLang)}${tr(sourceLang, 'colon')}`),
                h('span', { className: 'dshab_rowValue' }, value, meta));
            }));
        }

        /** The plugin's page inside Settings. */
        function BalanceSettingsPage() {
          useLocale(ctx);
          const prefs = useStore(prefsStore);
          const data = useStore(dataStore.store);
          const lang = resolveLang(prefs, ctx);
          const [editor, setEditor] = React.useState(undefined);
          const [busy, setBusy] = React.useState(false);
          const sources = listSources(data, prefs);
          const unavailable = allSources(data, prefs).filter((source) => source.kind === 'provider' && !readable(source));
          const hidden = new Set(prefs.hidden ?? []);
          const order = prefs.order ?? [];
          const rank = (key) => {
            const index = order.indexOf(key);
            return index === -1 ? Number.MAX_SAFE_INTEGER : index;
          };
          const ordered = sources.slice().sort((left, right) => rank(left.key) - rank(right.key));

          /** Persist the whole preference patch. */
          const persist = (patch) => {
            const next = { ...prefsStore.get(), ...patch };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
              /* storage may be unavailable; the in-memory preference still applies */
            }
            prefsStore.set(next);
          };
          const setSourceLang = (key, value) => {
            const current = { ...(prefsStore.get().sourceLang ?? {}) };
            if (value === 'auto') delete current[key];
            else current[key] = value;
            persist({ sourceLang: current });
          };
          React.useEffect(() => {
            const timer = window.setTimeout(() => {
              if (Date.now() - dataStore.store.get().at > 1500) dataStore.refresh();
            }, 120);
            return () => window.clearTimeout(timer);
          }, []);
          const move = (key, delta) => {
            const keys = ordered.map((source) => source.key);
            const index = keys.indexOf(key);
            const target = index + delta;
            if (index === -1 || target < 0 || target >= keys.length) return;
            keys.splice(index, 1);
            keys.splice(target, 0, key);
            persist({ order: keys });
          };
          const toggle = (key) => {
            const next = hidden.has(key) ? Array.from(hidden).filter((candidate) => candidate !== key) : Array.from(hidden).concat(key);
            persist({ hidden: next });
          };
          const refreshNow = async () => {
            setBusy(true);
            await refresh();
            setBusy(false);
          };
          const saveSource = async (draft) => {
            const saved = {
              id: draft.id,
              name: draft.name,
              url: draft.url,
              authMode: draft.authMode,
              headerName: draft.headerName ?? 'x-api-key',
              jsonPath: draft.jsonPath ?? '',
              currency: draft.currency ?? 'CNY',
              credentialRef: credentialRefOf(draft),
            };
            if (typeof draft.key === 'string' && draft.key !== '') {
              const stored = await setCredential(ctx, saved.credentialRef, draft.key);
              if (stored !== true) return false;
            }
            const next = (prefs.customSources ?? []).filter((source) => source.id !== saved.id).concat(saved);
            persist({ customSources: next });
            await refresh();
            return true;
          };
          const testSource = async (draft) => {
            // Testing reads only the saved credential reference. A key typed
            // into the editor but not saved is never transmitted: it must be
            // saved first, then tested through the credential store.
            const source = {
              id: draft.id,
              name: draft.name,
              url: draft.url,
              authMode: draft.authMode,
              headerName: draft.headerName,
              jsonPath: draft.jsonPath,
              currency: draft.currency,
              credentialRef: credentialRefOf(draft),
            };
            return callHost('test', { source });
          };
          const deleteSource = async (source) => {
            if (window.confirm(tr(lang, 'customDeleteHint')) !== true) return;
            const definition = (prefs.customSources ?? []).find((item) => item.id === source.id);
            if (definition !== undefined) await unsetCredential(ctx, credentialRefOf(definition));
            persist({
              customSources: (prefs.customSources ?? []).filter((item) => item.id !== source.id),
              hidden: (prefs.hidden ?? []).filter((key) => key !== source.key),
              order: (prefs.order ?? []).filter((key) => key !== source.key),
            });
            if (editor !== undefined && editor.id === source.id) setEditor(undefined);
            await refresh();
          };
          const addSource = () => {
            if ((prefs.customSources ?? []).length >= 20) return;
            const id = `src${Date.now().toString(36)}`;
            setEditor({
              id,
              name: '',
              url: '',
              authMode: 'bearer',
              headerName: 'x-api-key',
              jsonPath: 'data.balance',
              currency: 'CNY',
              credentialRef: credentialRefOf({ id }),
              key: '',
              hasKey: false,
            });
          };
          const editSource = (source) => {
            const definition = (prefs.customSources ?? []).find((item) => item.id === source.id);
            if (definition === undefined) return;
            setEditor({ ...definition, key: '', hasKey: true });
          };
          const updatedText = data.at === 0
            ? tr(lang, 'neverRead')
            : tr(lang, 'lastUpdated', { time: new Date(data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
          return h('div', { className: 'dshab_page' },
            h('div', { className: 'dshab_pageHead' },
              h('h2', { className: 'dshab_pageTitle' }, tr(lang, 'title')),
              h('p', { className: 'dshab_pageSubtitle' }, tr(lang, 'subtitle'))),
            h('section', { className: 'dshab_section' },
              h('h3', { className: 'dshab_sectionTitle' }, tr(lang, 'sectionSources')),
              h('div', { className: 'dshab_card' },
                h('div', { className: 'dshab_setting' },
                  h('div', { className: 'dshab_settingMain' },
                    h('span', { className: 'dshab_settingHint' }, data.error === 'host' ? tr(lang, 'hostUnavailable') : tr(lang, 'sourcesHint'))),
                  h('div', { className: 'dshab_settingControl' },
                    h(Button, { onClick: refreshNow, disabled: busy }, busy === true ? tr(lang, 'refreshing') : tr(lang, 'refreshNow')))),
                ordered.map((source) => h(SourceSetting, {
                  key: source.key,
                  source,
                  lang,
                  labelLang: labelLangOf(source, prefs, ctx),
                  labelLangValue: prefs.sourceLang === undefined ? undefined : prefs.sourceLang[source.key],
                  onLabelLang: (value) => setSourceLang(source.key, value),
                  visible: !hidden.has(source.key),
                  canUp: ordered.indexOf(source) > 0,
                  canDown: ordered.indexOf(source) < ordered.length - 1,
                  onToggle: () => toggle(source.key),
                  onUp: () => move(source.key, -1),
                  onDown: () => move(source.key, 1),
                  onEdit: () => editSource(source),
                  onDelete: () => deleteSource(source),
                })),
                ordered.length === 0
                  ? h('div', { className: 'dshab_setting' },
                    h('div', { className: 'dshab_settingMain' },
                      h('span', { className: 'dshab_empty' }, tr(lang, 'emptySources'))))
                  : null,
                editor === undefined
                  ? h('div', { className: 'dshab_setting' },
                    h('div', { className: 'dshab_settingMain' },
                      h('span', { className: 'dshab_settingHint' }, updatedText)),
                    h('div', { className: 'dshab_settingControl' },
                      h(Button, { onClick: addSource }, tr(lang, 'customAdd'))))
                  : h(CustomEditor, {
                    key: editor.id,
                    lang,
                    initial: editor,
                    onCancel: () => setEditor(undefined),
                    onSave: saveSource,
                    onTest: testSource,
                  }))),
            unavailable.length === 0 ? null : h('section', { className: 'dshab_section' },
              h('h3', { className: 'dshab_sectionTitle' }, tr(lang, 'sectionUnavailable')),
              h('div', { className: 'dshab_card' },
                h('div', { className: 'dshab_setting' },
                  h('div', { className: 'dshab_settingMain' },
                    h('span', { className: 'dshab_settingHint' }, tr(lang, 'unavailableHint')))),
                unavailable.map((source) => h('div', { className: 'dshab_setting', key: source.key },
                  h('div', { className: 'dshab_settingMain' },
                    h('span', { className: 'dshab_settingLabel' }, source.id === source.name ? source.name : tr(lang, 'unavailableLabel', { name: source.name, id: source.id })),
                    h('span', { className: 'dshab_settingHint dshab_statusWarn' }, unreadableReason(source, lang))))))),
            h('section', { className: 'dshab_section' },
              h('h3', { className: 'dshab_sectionTitle' }, tr(lang, 'sectionGeneral')),
              h('div', { className: 'dshab_card' },
                h(SettingRow, {
                  label: tr(lang, 'sectionInterval'),
                  control: h(Select, {
                    value: String(prefs.refreshSeconds),
                    label: tr(lang, 'sectionInterval'),
                    onChange: (value) => persist({ refreshSeconds: Number(value) }),
                    options: [
                      { value: '15', label: tr(lang, 'seconds', { n: 15 }) },
                      { value: '30', label: tr(lang, 'seconds', { n: 30 }) },
                      { value: '60', label: tr(lang, 'minutes', { n: 1 }) },
                      { value: '120', label: tr(lang, 'minutes', { n: 2 }) },
                      { value: '300', label: tr(lang, 'minutes', { n: 5 }) },
                      { value: '0', label: tr(lang, 'manual') },
                    ],
                  }),
                }),
                h(SettingRow, {
                  label: tr(lang, 'sectionLanguage'),
                  control: h(Select, {
                    value: prefs.language,
                    label: tr(lang, 'sectionLanguage'),
                    onChange: (value) => persist({ language: value }),
                    options: [
                      { value: 'auto', label: tr(lang, 'languageAuto') },
                      { value: 'zh', label: '中文' },
                      { value: 'en', label: 'English' },
                    ],
                  }),
                }),
                h(SettingRow, {
                  label: tr(lang, 'splitDeepseek'),
                  hint: tr(lang, 'splitDeepseekHint'),
                  control: h(Switch, {
                    checked: prefs.splitDeepseek === true,
                    onChange: (value) => persist({ splitDeepseek: value }),
                    label: tr(lang, 'splitDeepseek'),
                  }),
                }))),
            h('section', { className: 'dshab_section' },
              h('h3', { className: 'dshab_sectionTitle' }, tr(lang, 'sectionHelp')),
              h('div', { className: 'dshab_card' },
                h('div', { className: 'dshab_about' },
                  h('div', { className: 'dshab_aboutName' }, tr(lang, 'aboutName')),
                  h('div', { className: 'dshab_aboutBlock' },
                    h('div', { className: 'dshab_aboutTitle' }, tr(lang, 'aboutSupport')),
                    h('div', { className: 'dshab_aboutLine' },
                      h('span', { className: 'dshab_aboutLabel' }, `${tr(lang, 'aboutApiLabel')}${tr(lang, 'colon')}`),
                      tr(lang, 'aboutApiList')),
                    h('div', { className: 'dshab_aboutLine' },
                      h('span', { className: 'dshab_aboutLabel' }, `${tr(lang, 'aboutMembershipLabel')}${tr(lang, 'colon')}`),
                      tr(lang, 'aboutMembershipList'))),
                  h('div', { className: 'dshab_aboutBlock' },
                    h('div', { className: 'dshab_aboutTitle' }, tr(lang, 'aboutUnsupported')),
                    h('div', { className: 'dshab_aboutText' }, tr(lang, 'aboutUnsupportedList'))),
                  h('div', { className: 'dshab_aboutBlock' },
                    h('div', { className: 'dshab_aboutTitle' }, tr(lang, 'aboutHow')),
                    h('div', { className: 'dshab_aboutText' }, tr(lang, 'aboutHowText'))),
                  h('div', { className: 'dshab_aboutBlock' },
                    h('div', { className: 'dshab_aboutTitle' }, tr(lang, 'aboutPrivacy')),
                    h('div', { className: 'dshab_aboutText' }, tr(lang, 'aboutPrivacyText'))),
                  h('div', { className: 'dshab_aboutBlock' },
                    h('div', { className: 'dshab_aboutTitle' }, tr(lang, 'aboutVersion')),
                    h('div', { className: 'dshab_aboutText' }, tr(lang, 'aboutScope')),
                    h('div', { className: 'dshab_footerNote' }, tr(lang, 'aboutMeta', { version: PLUGIN_VERSION, author: PLUGIN_AUTHOR, updated: PLUGIN_UPDATED })),
                    h('div', { className: 'dshab_aboutLinks' },
                      `${tr(lang, 'aboutGitHub')}: `,
                      h('a', { className: 'dshab_aboutLink', href: PLUGIN_ACCOUNT, target: '_blank', rel: 'noreferrer' }, PLUGIN_AUTHOR),
                      ' · ',
                      h('a', { className: 'dshab_aboutLink', href: PLUGIN_REPO, target: '_blank', rel: 'noreferrer' }, 'dsh-balance-center')))))));
        }

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'balance-center',
          order: 100,
        }, BalanceRows));

        /** Settings page; re-register when the display language changes so the nav label follows. */
        let sectionDispose;
        let lastLanguage;
        const mountSection = () => {
          if (typeof sectionDispose === 'function') sectionDispose();
          lastLanguage = prefsStore.get().language;
          sectionDispose = ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: 'balance-center',
            order: 12,
            label: () => tr(resolveLang(prefsStore.get(), ctx), 'nav'),
          }, BalanceSettingsPage));
        };
        mountSection();
        ctx.effect(() => {
          const offPrefs = prefsStore.subscribe(() => {
            if (prefsStore.get().language !== lastLanguage) mountSection();
          });
          const offLocale = ctx.locale.subscribe(() => {
            if (prefsStore.get().language === 'auto') mountSection();
          });
          return () => {
            offPrefs();
            offLocale();
            if (typeof sectionDispose === 'function') sectionDispose();
          };
        }, 'balance-center: settings section lifetime');
      },
    };
  },
});
