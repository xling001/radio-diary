# 第三方依赖与许可说明 (Third-Party Notices)

本项目源码采用 [MIT License](LICENSE) 开源。以下列出开发构建期依赖、运行时环境与算法参考资料的许可情况。

---

## 一、前端构建期依赖 (`app/web/package.json`)

以下包仅用于 `vite build` 本地静态打包产物生成；打包后输出为纯离线静态资源（不请求外部 CDN 或远程服务端）：

| 包名 | 用途 | 许可 |
|---|---|---|
| `svelte` | UI 组件编译框架 | MIT |
| `vite` | 前端构建打包工具 | MIT |
| `@sveltejs/vite-plugin-svelte` | Vite Svelte 编译插件 | MIT |

---

## 二、声学算法与原生运行环境

- **声学 DSP 与指标层**（`app/web/src/dsp/`、`app/web/src/metrics/`）：基于公开声学文献与工程规范自主实现（YIN、LPC、FFT、H1-H2、CPP、Jitter/Shimmer 等），不携带第三方闭源二进制库。
- **Android 宿主外壳**（`app/android/`）：仅使用 Android 系统标准 SDK（WebView、AudioRecord / WebRTC 音频权限桥接、原生物理返回键与文件导出桥接），未引入 AndroidX 或第三方 SDK。

---

## 三、算法思路参考项目

在算法设计与常模标定中参考并致谢以下开源项目（均以独立参考资料形式研究，未将外部完整代码库打包进入构建产物）：

| 项目 | 许可证 | 参考方向 |
|---|---|---|
| [Koenami](https://github.com/transnavi/koenami) | MIT | 五项核心指标定义、门控条件、判定刻度与 ΔF 归一化口径 |
| [simple-voice-tools-for-trans](https://github.com/theforeveriris/simple-voice-tools-for-trans) | MIT | 纯前端 YIN 工程组织、LPC + Durand-Kerner 求根与咝音频谱重心思路 |

---

## 四、构建工具链（不随发行包分发）

| 工具 | 来源 | 许可 |
|---|---|---|
| Android SDK Build-Tools (`aapt2` / `d8` / `zipalign` / `apksigner`) | Google | Android SDK License |
| OpenJDK / Alibaba Dragonwell | Adoptium / Alibaba | GPLv2 with Classpath Exception |
| Node.js | OpenJS Foundation | MIT |
