# 贡献指南 (Contributing to 电波日记 MtF 版)

欢迎为 **电波日记 MtF 版 (Radio Diary)** 提交 Issue、改进建议或 Pull Request！本项目主要面向跨性别女性（MtF）的日常嗓音探索，同时也欢迎声学算法研究与工程优化贡献。

---

## 一、提交前须知

1. **去病理化与温和表达**：
   - 所有界面文案、练习提示与文档不得使用打分羞辱、病理化标签或焦虑诱发用语（`app/scripts/verify-contract.mjs` 包含关键词守卫）。
2. **离线与零联网红线**：
   - 严禁引入远程埋点、第三方云端统计、外部 CDN 脚本或自动上传音频的网络请求。
3. **架构边界（Core Read-only Facade）**：
   - `app/web/src/ui/` 与 `app/web/src/pages/` 一律通过 `app/web/src/core/index.js` 访问声学能力，禁止直接 import `dsp/` 或 `metrics/`。
4. **隐私保护（切勿提交私人素材）**：
   - 请不要在 PR 或公开 Issue 中附带他人或自己的敏感真实人声录音文件（`.wav` / `.m4a` / `.mp3`）或未脱敏路径。单测请使用 `app/scripts/lib/synth.mjs` 合成信号。
5. **理论知识库维护位置**：
   - 声学常模、解剖学与长篇训练教程由独立仓库 [xling001/transvoice-mandarin-handbook](https://github.com/xling001/transvoice-mandarin-handbook) 维护，本仓库仅聚焦软件实现与精炼应用内指引。

---

## 二、开发与提交自检流程

在提交 Pull Request 前，请在本地运行以下检查并确保全部通过：

```bash
# 1. 安装依赖并验证前端构建
cd app/web
npm ci
npm run build
cd ../..

# 2. 架构契约与 Design Token 检查
node app/scripts/verify-contract.mjs
node app/scripts/audit-svelte-tokens.mjs

# 3. 声学算法合成信号回归测试
node app/scripts/test-pitch.mjs
node app/scripts/test-formants-vowel.mjs
node app/scripts/test-sibilance.mjs
node app/scripts/test-vq.mjs
node app/scripts/test-metrics.mjs
node app/scripts/test-dsp-full.mjs
node app/scripts/test-audit-round.mjs
```

Windows PowerShell 下建议同时运行静态语法与 DOM 检查：

```powershell
.\app\scripts\check.ps1
```

如改动涉及 `app/android/`，请附带验证打包：

```powershell
.\app\scripts\build-apk.ps1
```

---

## 三、分支与 Commit 规范

- 请基于最新 `main` 分支拉取特性分支（如 `feat/...`、`fix/...`、`docs/...`）。
- 建议使用清晰简明的 Commit 标题，例如：
  - `fix(dsp): ...`
  - `feat(ui): ...`
  - `docs: ...`
