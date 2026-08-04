# 發布到 VS Code Marketplace

Shared Scratch Note 上架與改版的完整流程。首次發布請從「一、帳號與認證」開始；之後的改版只需執行「三、發布」。

## 零、目前狀態

本次已完成的上架前置調整：

| 項目 | 變更 |
|------|------|
| `private: true` | 已移除。vsce 讀 npm 的同一欄位，標記 private 的套件會被拒絕發布。 |
| `icon` | 新增 `resources/icon.png`（128×128）。由 `resources/icon.svg` 經 `scripts/make-icon.sh` 產生。 |
| `engines.vscode` | `^1.131.0` → `^1.75.0`。原設定等於只有最新版 VS Code 的使用者裝得起來。 |
| `@types/vscode` | `^1.125.0` → `^1.75.0`，與 engines 對齊，避免誤用超出宣告範圍的 API。 |
| `keywords` / `bugs` | 新增，供 Marketplace 搜尋與問題回報連結使用。 |
| `CHANGELOG.md` | 新增。Marketplace 會渲染成獨立分頁。 |
| `.vscodeignore` | 排除 `scripts/`、`docs/`、`resources/icon.svg`。 |
| `scripts/publish.sh` | 新增發布腳本，`npm run release` 為入口。 |

驗證結果：`typecheck` / `lint` / `test:unit` 通過，`vsce package` 產出 13 檔 17.87 KB，內容物正確。

`categories` 維持 `["Other"]`。Marketplace 的分類是固定清單（Programming Languages、Snippets、Themes、Notebooks、Data Science…），沒有適合「暫記本」的項目，`Notebooks` 指的是 Jupyter Notebook 支援，語義不符，硬套會讓使用者在錯誤的分類下看到它。曝光交給 `keywords` 處理。

## 一、帳號與認證（一次性）

1. 用 Microsoft 帳號建立 Azure DevOps 組織：<https://dev.azure.com>
2. 建立 Personal Access Token（右上角 User settings → Personal access tokens）：
   - **Organization**：`All accessible organizations`（必須，否則 vsce 認證失敗）
   - **Scopes**：`Custom defined` → `Marketplace` → 勾選 `Manage`
   - **Expiration**：最長 1 年
3. 建立 publisher：<https://marketplace.visualstudio.com/manage>
   - Publisher ID 必須與 `package.json` 的 `"publisher": "workjerry"` 完全一致，建立後不可更改。
4. 本機登入：

   ```bash
   npx vsce login workjerry
   ```

   貼上 PAT。憑證存於系統 keychain。CI 環境改用 `VSCE_PAT` 環境變數。

PAT 到期後 publish 會以認證錯誤失敗，重新產一組再 `vsce login` 即可。

## 二、發布前檢查

```bash
npm ci
npm run check                        # lint + build + unit + integration
DRY_RUN=1 npm run release            # 打包並安裝到本機 VS Code，不上傳
```

`DRY_RUN=1` 會走完打包與本機安裝，止於上傳前。務必在這一步實際執行一次 **Shared Scratch Note: Open** 並輸入幾個字確認自動存檔——`.vscodeignore` 漏檔造成的破損只有在真的安裝後才看得出來，而 `vsce package` 不會報錯。

檢查 `vsce package` 輸出的檔案清單，應只包含 `LICENSE.txt`、`changelog.md`、`readme.md`、`package.json`、`out/src/`、`resources/`。出現 `src/`、`test/`、`node_modules/` 表示 `.vscodeignore` 失效。

## 三、發布

```bash
npm run release           # 發布 package.json 目前的版本
npm run release patch     # 先 bump patch 再發布（同時建立 commit 與 git tag）
npm run release minor
npm run release major
```

腳本流程：工作區乾淨檢查 → `npm run check` → `vsce package` → 安裝到本機 VS Code → 互動確認 → `vsce publish`。

發布後 Marketplace 需 5–10 分鐘驗證才會上架，狀態見 <https://marketplace.visualstudio.com/manage/publishers/workjerry>。

**版本號一經發布無法覆蓋或刪除，只能往上遞增。** 這是腳本要求互動確認與工作區乾淨的原因。

## 四、設計取捨

**build 與 publish 分離。** `npm run check`、`npm run package:vsix` 只產生並驗證本機 artifact，即使環境中存在 `VSCE_PAT` 也不會上傳。上傳只發生在 `scripts/publish.sh`，且需顯式執行加互動確認。避免 CI 或本機建置意外推出一個無法回收的版本。

**icon 生成不進 build。** `scripts/make-icon.sh` 依賴 macOS 的 `sips`，掛進 `npm run build` 會讓非 macOS 環境的建置失敗。`resources/icon.png` 直接進版控，只有在 `icon.svg` 改動時才手動重跑。

**engines 下限選 1.75.0 的理由。** 程式實際用到的 API——`workspace.openTextDocument`、`window.showTextDocument`、`workspace.onDidChangeTextDocument`（皆為 1.0 起）、`Uri.joinPath`（1.45）、`ExtensionContext.globalStorageUri`（1.44）——最低只需 1.45。取 1.75（2023-01）是留一段安全邊際，同時涵蓋絕大多數仍在使用的 VS Code。要更保守可再下修，但每次下修都要重跑 `npm run typecheck` 確認型別定義中沒有超前的 API。

## 五、後續維護

- 每次改版先更新 `CHANGELOG.md` 的 `[Unreleased]` 段落，再移到新版本號下。
- `README.md` 整份就是 Marketplace 頁面內容。其中的「開發」「封裝與安裝」段落對一般使用者是雜訊，若在意頁面觀感可移到獨立的 `CONTRIBUTING.md`。
- 要下架某個版本用 `npx vsce unpublish workjerry.shared-scratch-note@<version>`；下架整個擴充是 `npx vsce unpublish workjerry.shared-scratch-note`，**擴充名稱會被永久保留、無法重新使用**。
