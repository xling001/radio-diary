## 变更说明
<!-- 请简述本 PR 解决的问题、改动模块与设计思路 -->

## 检查清单
- [ ] 已遵循去病理化、温和的表达风格
- [ ] 未新增任何联网上报、外部 CDN 或非预期权限
- [ ] 视图层 (`ui/` / `pages/`) 仅通过 `core/index.js` 调用算法层
- [ ] 已运行 `node app/scripts/verify-contract.mjs` 且 0 失败
- [ ] 已运行 `node app/scripts/audit-svelte-tokens.mjs` 无新增硬编码违规
- [ ] 已运行 `app/scripts/test-*.mjs` 全部通过
- [ ] 未包含私人录音、签名密钥 (`*.keystore`) 或构建产物
