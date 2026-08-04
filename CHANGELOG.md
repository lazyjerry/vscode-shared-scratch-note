# Changelog

本檔案記錄 Shared Scratch Note 的版本變更，格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### Added

- 重新加入 Panel 中的 **Note** 分頁與其 Webview 編輯器，回到 0.0.1 的操作方式。
- 重新加入 Webview 的 Markdown 快捷鍵：列點延續、Tab／Shift+Tab 縮排、`Cmd/Ctrl+B`／`I`／`K`、選取文字後貼上 URL 建立連結。

### Changed

- 自動存檔與多視窗同步改回由擴充套件自行處理（150ms debounce 寫入、200ms 檔案輪詢），不再依賴 VS Code 的編輯器事件與檔案變更偵測。

### Removed

- 以原生 `TextEditor` 開啟筆記的行為。`Shared Scratch Note: Open` 改為聚焦 Panel 中的 Note 分頁。

### Known issues

- 筆記不是 `TextDocument`，因此 inline completion、Copilot Chat 的 `#file`／`#selection` 等編輯器層級的 AI 上下文取不到內容。具備檔案系統存取的 AI agent 仍可依絕對路徑讀寫 `shared-note.md`。
- Panel 有未寫入磁碟的輸入時，若 AI 同時直接改寫該檔案，兩邊會互相覆蓋。

## [0.0.2] - 2026-08-04

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
