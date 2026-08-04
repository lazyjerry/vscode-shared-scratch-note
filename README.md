# Shared Scratch Note

在 VS Code Panel 中提供一份跨專案共用的 Markdown 暫記。內容自動保存在目前 VS Code Profile 的擴充套件全域儲存，不會寫入任何工作區。

## 功能

- 多行編輯、選取、複製與貼上。
- 同一 VS Code 發行版本與 Profile 的不同專案視窗即時同步。
- 輸入後自動保存，關閉並重啟 VS Code 後仍會保留。
- Enter 延續 Markdown 列點；空白列點再次 Enter 時退出。
- Tab／Shift+Tab 縮排或取消縮排列點。
- `Cmd/Ctrl+B`、`Cmd/Ctrl+I`、`Cmd/Ctrl+K` 快速插入 Markdown 語法。
- 選中文字後貼上 HTTP(S) URL，自動建立 Markdown 連結。
- 完全離線，不載入遠端資源、不傳送 telemetry。

多個視窗同時修改同一份筆記時，採最後完成寫入者優先。同步目標延遲約為 200ms。

## 使用方式

安裝後，在底部 Panel 選擇 **Note**，或從 Command Palette 執行 **Shared Scratch Note: Open**。如果已將 VS Code Panel 移到側邊，筆記會沿用該位置。

## 開發

需求：Node.js、npm、VS Code 1.131.0。

```bash
npm install
npm run build
npm run lint
npm test
```

在 VS Code 開啟此資料夾後按 `F5`，即可啟動 Extension Development Host。

## 封裝與安裝

```bash
npm run package:vsix
```

產生 `.vsix` 後，在 Extensions View 的 `...` 選單執行 **Install from VSIX...**。

## 保存與同步範圍

筆記檔名為 `shared-note.md`，位置由 VS Code 的 `ExtensionContext.globalStorageUri` 決定：

- 不放進目前專案，也不會出現在 Git 變更中。
- 不使用 Settings Sync，不會同步至其他裝置。
- 不同 VS Code Profile、Stable 與 Insiders 各自保存一份。
- Remote SSH 或 Dev Container 專案仍由本機 UI Extension 使用本機筆記。
- 不支援 `vscode.dev`。

## AI inline completion 評估

第一版不支援 GitHub Copilot 等 AI inline completion（行內自動完成）。Panel 內的編輯器是 [Webview](https://code.visualstudio.com/api/extension-guides/webview) `<textarea>`，不是 VS Code `TextDocument`；[Inline Completion API](https://code.visualstudio.com/api/references/vscode-api) 只會對原生文字文件要求建議。

若未來加入原生 `TextEditor` 模式，才可能使用已安裝 AI 擴充套件的 inline completion，但自訂 URI 是否被特定 AI 擴充套件接受，仍需逐一驗證。本擴充套件不自行呼叫任何 AI 或網路服務。

## 授權

[Apache License 2.0](LICENSE)
