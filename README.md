# Shared Scratch Note

一份跨專案共用的 Markdown 暫記，以 VS Code 原生編輯器開啟。

不管開著哪個專案，執行 **Shared Scratch Note: Open** 就回到同一份筆記。內容保存在 VS Code 的擴充套件全域儲存，不會寫進任何工作區，也不會出現在 Git 變更裡。

## 功能

- **原生編輯器**：筆記是真正的 `TextDocument`，Markdown 語法標示、預覽、Outline，以及你已安裝的 Markdown 擴充套件全部適用。
- **自動存檔**：輸入停止約 0.5 秒後自動寫入，不需要按 `Cmd/Ctrl+S`。
- **跨專案共用**：同一 VS Code 發行版本與 Profile 的所有視窗共用同一份筆記。
- **完全離線**：不載入遠端資源、不傳送 telemetry、不呼叫任何網路服務。

## AI 工具支援

因為筆記是原生 `TextDocument`，已安裝的 AI 擴充套件可以直接讀取與操作它：

- GitHub Copilot 等擴充套件的 inline completion（行內自動完成）會在筆記中作用。
- Copilot Chat 的 `#file`、`#selection`，以及 Claude Code 等擴充套件的編輯器選取上下文，都能取得筆記內容。
- 可以在筆記裡直接請 AI 改寫、整理或摘要，就像操作專案裡的任何一個檔案。

筆記位於全域儲存而非工作區，因此 `@workspace` 這類全域檢索找不到它 —— 筆記需先被開啟，才會進入 AI 的上下文。

本擴充套件不自行呼叫任何 AI 或網路服務。

## 使用方式

從 Command Palette（`Cmd/Ctrl+Shift+P`）執行 **Shared Scratch Note: Open**。

筆記會以一般分頁開啟，可自行拖曳到側邊或下方的編輯器群組，固定成常駐的暫記區。

## 保存位置與範圍

筆記檔名為 `shared-note.md`，位置由 VS Code 的 `ExtensionContext.globalStorageUri` 決定：

- 不放進目前專案，也不會出現在 Git 變更中。
- 不使用 Settings Sync，不會同步至其他裝置。
- 不同 VS Code Profile、Stable 與 Insiders 各自保存一份。

多視窗同步交由 VS Code 的檔案變更偵測處理：另一個視窗存檔後，未編輯中的分頁會自動重新載入；若該分頁有未存檔的修改，VS Code 會保留你的內容，最終以最後完成存檔者為準。

## 已知限制

- **Remote SSH / Dev Container**：這類視窗中，本機筆記路徑會被視為遠端路徑，可能開啟失敗。擴充套件會顯示含完整路徑的錯誤訊息。
- **不支援 `vscode.dev`**：需要本機檔案系統。
- **無內建 Markdown 快捷鍵**：列點延續、`Cmd/Ctrl+B` 粗體這類編輯輔助由 VS Code 內建 Markdown 支援或你自選的擴充套件提供。

## 開發

建置、測試與封裝流程見 [CONTRIBUTING.md](CONTRIBUTING.md)，發布流程見 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## 授權

[Apache License 2.0](LICENSE)
