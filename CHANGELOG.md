# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-17

Adds two quota sources, DSH 0.2.2 UI integrations, low-balance alerts and account
links.

### Added

- **OpenCode Go** subscription quota — `GET https://opencode.ai/inference/go/v1/usage`
  (falls back to `/zen/go/v1/usage`), Bearer API key, rolling / weekly / monthly
  windows. The upstream `percent` is the used share; rows show the remaining share.
- **Xiaomi MiMo** support — pay-as-you-go balance via
  `GET /v1/platform/balance` and Token Plan credits via
  `GET /v1/platform/token_plan` for the CN / AMS / SGP regions.
- **Models page integration** — balance/quota summaries in provider cards and a
  footer summary with refresh, through `settings.models.provider-card` and
  `settings.models.footer`.
- **General settings row** — toggle the sidebar rows and configure low-balance /
  low-quota alerts without opening the plugin page.
- **Navigation icon** for the settings section via `settings.section.icon`.
- **Low-balance / low-quota alerts** shown in the frame-wide overlay
  (`shell.overlay`), with ¥ and % thresholds.
- **Account links** — top-up and usage shortcuts from the account `getState()`
  links; account state changes refresh the snapshot.
- Sidebar visibility master switch (preference `sidebarEnabled`).

### Security

- Xiaomi MiMo adapters validate the request target against the exact official
  HTTPS origin allowlist before attaching a DSH credential; an explicit
  non-official or non-HTTPS address returns the `unsafe_endpoint` status and
  sends no request (official regional fallbacks remain when no explicit address
  is configured).

### Changed

- Verified on DSH `0.2.2-rc.3`; the README compatibility and verification scope
  were updated (the plugin was already compatible with the new account and
  provider APIs).
- `engines.dsh` still declares `>=0.2.1-rc.5 <0.3.0-0`; 0.2.2 is now tested.

### Known limitations

- OpenCode Go and Xiaomi MiMo adapters are validated with interface fixtures, not
  live accounts in this release.
- Qwen Token Plan is not supported: the inference key cannot read the console
  quota gateway (it needs console cookies or cloud AK/SK).

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
