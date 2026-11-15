# 安全与隐私政策 (Security Policy)

## 隐私边界设计

**电波日记 MtF 版** 的核心安全与隐私设计如下：

1. **纯本地运行，无服务器通信**：音频采集、声学分析与手账数据（IndexedDB / LocalStorage）均只在用户设备本地执行与保存。
2. **明确权限最小化**：Android 宿主仅申请 `RECORD_AUDIO` 与 `MODIFY_AUDIO_SETTINGS` 权限；导出的备份/报告保存至系统沙盒或用户明确触发的系统分享/导出目录。
3. **外部链接隔离**：指南页跳转外部开源知识库时通过系统外部浏览器打开，不直接在应用内注入未知第三方脚本。

## 漏洞报告范围

如果你发现以下问题，欢迎及时报告：

- Android `WebView` / `JavascriptInterface` 权限边界或目录穿越风险
- 本地音频文件解析或导出逻辑中的异常安全隐患
- 违背“零联网/无后台外发”原则的非预期网络行为

## 如何报告

- 请优先使用 GitHub 仓库的 **Security → Advisories → Report a vulnerability** 私密提交漏洞详情（若已启用）；
- 若仅涉及常规功能异常且不含高危利用细节，也可在仓库 [Issues](https://github.com/xling001/radio-diary/issues) 中反馈。
- 请勿在公开 Issue 中披露未修复的安全漏洞利用细节或附带任何用户私人录音。
