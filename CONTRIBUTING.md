# 開發

## 需求

Node.js、npm、VS Code 1.75.0 以上（整合測試固定使用 1.131.0）。

## 常用指令

```bash
npm install
npm run build      # typecheck + tsc
npm run lint
npm test           # build + 單元測試 + 整合測試
npm run check      # lint + test，發布前的完整驗證
```

在 VS Code 開啟此資料夾後按 `F5`，即可啟動 Extension Development Host。

## 結構

| 路徑 | 用途 |
|------|------|
| `src/extension.ts` | 啟動、`sharedScratchNote.open` 指令、自動存檔 |
| `src/noteStorage.ts` | 筆記檔案位置與建立 |
| `test/unit/` | 不需要 VS Code 的純函式測試（mocha） |
| `test/integration/` | 在 Extension Development Host 中執行的測試 |

## 封裝

```bash
npm run package:vsix
```

產生 `.vsix` 後，在 Extensions View 的 `...` 選單執行 **Install from VSIX...** 安裝驗證。

## 發布

見 [docs/PUBLISHING.md](docs/PUBLISHING.md)。版本一經發布無法覆蓋或刪除，只能往上遞增。
