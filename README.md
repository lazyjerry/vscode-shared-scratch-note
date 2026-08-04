# Shared Scratch Note

在 VS Code Panel 中提供一份跨專案共用的 Markdown 暫記。內容自動保存在目前 VS Code Profile 的擴充套件全域儲存，不會寫入任何工作區，也不會出現在 Git 變更裡。

## 功能

- **常駐 Panel**：筆記固定在底部 Panel 的 **Note** 分頁，與 Terminal、Problems 並列，不佔用編輯器分頁。
- **跨專案共用**：同一 VS Code 發行版本與 Profile 的不同專案視窗即時同步，目標延遲約 200ms。
- **自動保存**：輸入後自動寫入，關閉並重啟 VS Code 後仍保留。
- **Markdown 編輯輔助**：Enter 延續列點，空白列點再次 Enter 時退出；Tab／Shift+Tab 縮排；`Cmd/Ctrl+B`、`Cmd/Ctrl+I`、`Cmd/Ctrl+K` 插入語法；選中文字後貼上 HTTP(S) URL 自動建立連結。
- **完全離線**：不載入遠端資源、不傳送 telemetry、不呼叫任何網路服務。

多個視窗同時修改同一份筆記時，採最後完成寫入者優先。

## 使用方式

安裝後，在底部 Panel 選擇 **Note**，或從 Command Palette 執行 **Shared Scratch Note: Open**。如果已將 VS Code Panel 移到側邊，筆記會沿用該位置。

## AI 工具支援

Panel 內的編輯器是 [Webview](https://code.visualstudio.com/api/extension-guides/webview) `<textarea>`，不是 VS Code `TextDocument`。這決定了哪些 AI 功能能用：

**可以用** —— 筆記本身是磁碟上的真實檔案（見下方保存位置），因此具備檔案系統存取的 AI agent（Claude Code、Codex 等）給定絕對路徑即可讀寫。外部寫入會被本擴充套件的檔案輪詢偵測到並同步回 Panel。

**不能用** —— 依賴 `TextDocument` 的編輯器層級功能一律看不到筆記：

- GitHub Copilot 等擴充套件的 inline completion（行內自動完成）。
- Copilot Chat 的 `#file`、`#selection`，以及其他擴充套件的「目前編輯器選取」上下文。
- 「開啟中的分頁」這類自動帶入的上下文。

若 Panel 中有尚未寫入磁碟的輸入，同時 AI 又直接改寫該檔案，兩邊會互相覆蓋，結果同樣是最後完成寫入者優先。需要 AI 密集操作筆記時，先停止輸入等待保存完成。

本擴充套件不自行呼叫任何 AI 或網路服務。

## 保存位置與範圍

筆記檔名為 `shared-note.md`，位置由 VS Code 的 `ExtensionContext.globalStorageUri` 決定：

- 不放進目前專案，也不會出現在 Git 變更中。
- 不使用 Settings Sync，不會同步至其他裝置。
- 不同 VS Code Profile、Stable 與 Insiders 各自保存一份。
- Remote SSH 或 Dev Container 專案仍由本機 UI Extension 使用本機筆記。
- 不支援 `vscode.dev`。

## 開發

建置、測試與封裝流程見 [CONTRIBUTING.md](CONTRIBUTING.md)，發布流程見 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## 授權

[Apache License 2.0](LICENSE)
