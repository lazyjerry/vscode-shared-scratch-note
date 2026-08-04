# Changelog

本檔案記錄 Shared Scratch Note 的版本變更，格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### Changed

- 筆記改以原生 `TextEditor` 開啟，取代 Panel 中的 Webview，使 GitHub Copilot、Claude Code 等 AI 擴充套件可直接讀寫筆記內容。
- 自動存檔改由編輯器變更事件觸發，輸入停止約 0.5 秒後寫入。
- 多視窗同步改由 VS Code 的檔案變更偵測處理。

### Removed

- Panel 中的 Note 檢視與其 Webview 編輯器。
- Webview 專屬的 Markdown 快捷鍵（列點延續、Tab 縮排、`Cmd/Ctrl+B`／`I`／`K`、貼上 URL 建立連結）；改由 VS Code 內建 Markdown 支援與使用者自選的 Markdown 擴充套件提供。

### Known issues

- Remote SSH 或 Dev Container 視窗中，本機筆記路徑會被視為遠端路徑而可能開啟失敗。

## [0.0.1] - 2026-08-04

### Added

- VS Code Panel 中的共用 Markdown 暫記，內容保存於擴充套件全域儲存。
- 同一 VS Code 發行版本與 Profile 的多個視窗間即時同步。
- Markdown 列點延續、Tab／Shift+Tab 縮排、`Cmd/Ctrl+B`／`I`／`K` 快速插入語法。
- 選取文字後貼上 HTTP(S) URL 自動建立 Markdown 連結。
