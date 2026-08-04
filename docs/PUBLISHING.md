# 發布到 VS Code Marketplace

Shared Scratch Note 上架與改版的完整流程。首次發布請從「一、帳號與認證」開始；之後的改版只需執行「二、發布」。

整套流程都在 `scripts/publish.sh`，`npm run release` 為入口。這個腳本自帶所有發布前檢查，不依賴任何 repo 外的工具。

## 零、上架前置設定

首次上架時完成、之後不需再動的設定：

| 項目 | 說明 |
|------|------|
| `private` | 不得為 `true`。vsce 讀 npm 的同一欄位，標記 private 的套件會被拒絕發布。 |
| `icon` | `resources/icon.png`（128×128）。由 `resources/icon.svg` 經 `scripts/make-icon.sh` 產生。 |
| `engines.vscode` | `^1.75.0`。設成最新版等於只有最新版 VS Code 的使用者裝得起來。 |
| `@types/vscode` | 與 `engines.vscode` 對齊，避免誤用超出宣告範圍的 API。 |
| `keywords` / `bugs` | 供 Marketplace 搜尋與問題回報連結使用。 |
| `CHANGELOG.md` | Marketplace 會渲染成獨立分頁。必須有 `## [Unreleased]` 標題，發布腳本靠它搬移版本紀錄。 |
| `.vscodeignore` | 決定哪些檔案進 VSIX。**與 git 無關**——vsce 會打包任何沒被它排除的檔案，包含未進版控的。 |

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

## 二、發布

發布分兩階段，中間隔一個 commit，讓每個發布出去的版本都對應得到可追溯的 commit。

**階段一：版本準備**

```bash
npm run release patch     # 或 minor / major
```

改 `package.json`、`package-lock.json` 的版本，並把 `CHANGELOG.md` 的 `[Unreleased]` 內容整段搬到新版本號下。**不 commit、不打包、不上傳。** 檢查 diff 後自行提交。

`[Unreleased]` 是空的會直接失敗——沒有變更就不該發版。

**階段二：發布**

```bash
DRY_RUN=1 npm run release     # 走完打包與稽核，止於上傳前
npm run release               # 完整發布
```

腳本依序執行：

1. 工作區乾淨檢查
2. `package.json` 欄位驗證（`private`、必填欄位、SemVer 格式）
3. 比對 Marketplace 版本，本機必須嚴格大於遠端
4. `npm run check`（lint + build + unit + integration）
5. `vsce package`
6. VSIX 內的 manifest 與 `package.json` 比對
7. **VSIX 內容稽核**——含有 `src/`、`test/`、`scripts/`、`docs/`、`.claude/`、`.agents/`、`CLAUDE.md`、`AGENTS.md` 任何一項就中止
8. 安裝到本機 VS Code
9. 互動確認（輸入 `yes`）
10. 上傳**同一個**已稽核的 VSIX（`vsce publish --packagePath`）
11. 輪詢 Marketplace 直到版本上架且 SHA-256 相符

第 8 步之後務必實際執行一次 **Shared Scratch Note: Open** 並輸入幾個字確認自動存檔。腳本能驗證 VSIX 的內容物，但驗不了 UI 是否真的能動。

發布後 Marketplace 需數分鐘驗證才會上架，狀態見 <https://marketplace.visualstudio.com/manage/publishers/workjerry>。

**版本號一經發布無法覆蓋或刪除，只能往上遞增。** 這是腳本要求互動確認與工作區乾淨的原因。

## 三、設計取捨

**build 與 publish 分離。** `npm run check`、`npm run package:vsix` 只產生並驗證本機 artifact，即使環境中存在 `VSCE_PAT` 也不會上傳。上傳只發生在 `scripts/publish.sh`，且需顯式執行加互動確認。避免 CI 或本機建置意外推出一個無法回收的版本。

**版本準備與發布分兩次執行。** 若讓 `vsce publish patch` 自行 bump，它會在上傳前重新打包一次——那麼稽核過、安裝驗證過的 VSIX 就不是實際上傳的那一份。改成先準備版本、commit，再打包一次並用 `--packagePath` 上傳同一個檔案，驗證對象與發布對象才是同一個 artifact。

**VSIX 內容稽核以 `.vscodeignore` 為準，不看 git。** vsce 會打包工作目錄裡任何沒被 `.vscodeignore` 排除的檔案，未進版控的也照包。`.gitignore` 擋不住它。0.0.2 準備期間，`.claude/` 的整套工具腳本與 `CLAUDE.md` 就是這樣進到 VSIX 裡的，靠這道稽核才攔下來。新增這類本機工具目錄時，兩個 ignore 檔都要加。

**icon 生成不進 build。** `scripts/make-icon.sh` 依賴 macOS 的 `sips`，掛進 `npm run build` 會讓非 macOS 環境的建置失敗。`resources/icon.png` 直接進版控，只有在 `icon.svg` 改動時才手動重跑。

**engines 下限選 1.75.0 的理由。** 程式實際用到的 API——`workspace.openTextDocument`、`window.showTextDocument`、`workspace.onDidChangeTextDocument`（皆為 1.0 起）、`Uri.joinPath`（1.45）、`ExtensionContext.globalStorageUri`（1.44）——最低只需 1.45。取 1.75（2023-01）是留一段安全邊際，同時涵蓋絕大多數仍在使用的 VS Code。要更保守可再下修，但每次下修都要重跑 `npm run typecheck` 確認型別定義中沒有超前的 API。

## 四、後續維護

- 開發過程中把變更寫進 `CHANGELOG.md` 的 `[Unreleased]` 段落即可，搬到版本號下由 `npm run release <bump>` 處理。
- `README.md` 整份就是 Marketplace 頁面內容，維持使用者導向。開發相關說明放 `CONTRIBUTING.md`（已由 `.vscodeignore` 排除，不進 VSIX）。
- 要下架某個版本用 `npx vsce unpublish workjerry.shared-scratch-note@<version>`；下架整個擴充是 `npx vsce unpublish workjerry.shared-scratch-note`，**擴充名稱會被永久保留、無法重新使用**。
