# 設定檔說明

`diagrammender.config.json` 用來調整 CLI 與 UI 的行為。

| 欄位 | 說明 | 預設值 |
| --- | --- | --- |
| `ignore` | 要忽略的檔案或目錄，支援 [glob](https://en.wikipedia.org/wiki/Glob_(programming)) 樣式。 | `[]` |
| `rules.noGraphKeyword` | 偵測到 `graph` 關鍵字時停用 `upgradeGraphKeyword` 修復規則。 | `false` |
| `output.format` | 輸出格式，可選 `text` 或 `json`。JSON 會額外附上 `notes`。 | `text` |

範例設定：

```json
{
  "ignore": ["**/test/**"],
  "rules": { "noGraphKeyword": true },
  "output": { "format": "json" }
}
```

> 提示：CLI 預設會從分析目標的根目錄尋找 `diagrammender.config.json` 與 Schema，
> 可透過 `--config <dir>` 指定其他設定位置；同時可使用 `--json` / `--text`
> 覆寫輸出格式。

