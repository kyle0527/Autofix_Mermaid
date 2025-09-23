# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Schema 驗證系統** - 使用 AJV 對 RulePack 和 PromptPack 進行嚴格 JSON Schema 驗證
  - 新增 `validate-schema.js` 腳本，支援批次驗證 `rules/rulepack.json` 和 `rules/promptpack.json`
  - 整合 AJV 2020 draft 支援，提供完整的 JSON Schema 驗證功能
  - 在 GitHub Actions CI 流程中加入強制 Schema 驗證步驟
  - 新增 `npm run validate:schema` 和 `npm run test:schema` 指令

### Added - Testing
- 建立完整的 Schema 驗證單元測試套件 (`test/unit/schema-validation.test.mjs`)
  - 涵蓋正向測試（有效文件通過驗證）和負向測試（無效文件被攔截）
  - 驗證錯誤訊息的可讀性和完整性
  - 提供 3 份故意設計的錯誤樣本作為測試案例：
    - `rules/rulepack.bad1.json` - 缺少必填欄位測試
    - `rules/rulepack.bad2.json` - 資料類型錯誤與無效值測試
    - `rules/promptpack.bad1.json` - PromptPack 錯誤測試

### Changed
- 更新 `scripts/run-tests.js` 以包含 Schema 驗證測試執行
- 更新 `.github/workflows/ci.yml` 在 PR 驗證流程中加入嚴格 Schema 驗證
- 擴充 `package.json` scripts 區塊，新增 Schema 相關指令

### Documentation
- 在 `README.md` 中新增「📋 Schema 驗證系統」章節
  - 詳細說明支援的驗證類型與快速驗證指令
  - 提供錯誤訊息範例與故障排除指引
  - 說明 CI/CD 整合機制

### Dependencies
- 新增 `ajv ^8.17.1` 作為開發依賴，支援 JSON Schema 驗證功能

### Fixed
- **TypeScript 配置現代化** - 解決 TypeScript 編譯器deprecation 警告
  - 更新所有 `tsconfig.json` 檔案中的 `moduleResolution` 設定
  - 將過時的 `"node"` 模式升級為現代的 `"bundler"` 模式
  - 影響範圍：JavaScript、TypeScript、Python 解析器配置
  - 確保與 TypeScript 5.x 版本的完全相容性

- **Export UI 系統重構** - 完全重寫損壞的導出模組，提供雙API架構
  - 解決merge衝突造成的嚴重檔案損壞問題（`autofix/ui/exporter.py`）
  - 新增現代化 `Exporter`, `ExportConfig`, `DiagramBundle` 類別
  - 支援多格式同步導出：Mermaid, HTML, PNG, JSON, CSV
  - 實作原子檔案操作與SHA256完整性校驗
  - 保持100%向後相容性，現有CLI和API調用無需修改
  - 移除對第三方套件的依賴，純標準庫實作
  - 新增自動MANIFEST追蹤與錯誤容忍機制

## [3.7] - 2025-09-16

### Added
- Tree-sitter 支援的智能 Python 程式碼分析
- 多語言程式碼靜態分析能力
- 自動生成並修正符合規範的 Mermaid 語法

### Changed
- 現代化 UI 介面設計
- 即時預覽與互動調整功能

### Fixed
- 改善 Mermaid 語法相容性問題
- 修復檔案路徑處理相關錯誤