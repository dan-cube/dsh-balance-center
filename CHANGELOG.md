# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-04

Initial public release: model provider balances and subscription quotas in the
DSH sidebar, with a native settings page, bilingual copy and explainable
unreadable connections.

### Added

- Sidebar rows above the account row: one row per readable balance or quota
  source, shown only in the wide sidebar.
- Balance sources: DeepSeek (account login and official API key, merged into one
  row), Kimi / Moonshot (China and international), OpenRouter, StepFun, Novita AI,
  one-api / new-api style relays, and custom JSON sources.
- Subscription quota sources: GLM Coding Plan (Z.ai / BigModel), MiniMax Token
  Plan (China / international) and Kimi For Coding (Kimi Code membership key or
  DSH sign-in). Quota rows render as “X% left · reset in …”, preferring the
  5-hour window and keeping the weekly window.
- Native Settings page: per-source show/hide, ordering, label language
  (auto / 中文 / EN), refresh interval, page language (follow app / 中文 / English),
  manual refresh, and a custom-source editor with a controlled Test connection.
- About section with the five-part support/limits/how/privacy/version summary and
  public links to the maintainer account and repository.
- “Other detected connections” explains unreadable routes; rejected keys and
  network failures stay in the sources list with an inline reason.
- DeepSeek official connections are merged by default (display policy, not proof
  of shared account ownership); the split switch restores per-connection rows.

### Security

- Provider keys are read only by the Host process; the browser never receives
  them, and provider response bodies, headers and keys are never returned.
- Test connection reads only saved credentials: an unsaved key is never
  transmitted to the Host, and saving remains an explicit action.
- Authenticated custom balance endpoints must use HTTPS (loopback excepted), so a
  saved key is never sent to a cleartext remote endpoint.
- Upstream provider error text is not forwarded to the browser; the page receives
  only the status and HTTP code.

### Known limitations

- SiliconFlow retired its `user/info` balance API on 2026-08-14 (live HTTP 410);
  it is shown as unsupported until the vendor publishes a replacement.
- Kimi For Coding quotas need a Kimi Code membership key (or DSH sign-in); an
  ordinary Moonshot API key reads the balance only.
- GLM Coding Plan and MiniMax Token Plan quotas need the matching subscription
  plan; top-up accounts report “no plan”.
- OpenAI, Anthropic, Gemini, Alibaba Bailian/Qwen, Volcengine Ark, Baidu Qianfan,
  Tencent Hunyuan, iFlytek Spark, Groq, Together and similar expose no ordinary
  API-key balance endpoint and are not listed.
- DSH 0.3.x is not declared or tested; the supported range is
  `>=0.2.1-rc.5 <0.3.0-0`.
