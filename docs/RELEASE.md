# 发版

正式包只来自 GitHub Release。用户在桌面 App 顶栏或 **关于** 里点 **检查更新**，或等启动后的更新提示。

合进 `master`（或 `main`）不会发版。`.github/workflows/build.yml` 仍会在推送时打安装包并上传为 Actions artifact。这条流水线带 `--no-sign`，不读签名 Secret，不创建 Release，也不写 `latest.json`。不推 tag，检查更新会停在上一个 Release。

## 怎么发

1. 把要发布的提交合进默认分支。
2. 让下面三处版本号相同，并且等于即将推送的 tag（去掉前缀 `v`）：
   - `package.json` 的 `version`
   - `src-tauri/tauri.conf.json` 的 `version`（更新器比较的就是这个）
   - `src-tauri/Cargo.toml` 的 `version`
3. 在这份提交上推送 tag：

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   例：三个文件都是 `0.2.0` 时，tag 必须是 `v0.2.0`。

4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) 在 tag `v*` 上触发 `tauri-action`：
   - 创建非 draft 的 GitHub Release
   - 用仓库里已经配置的 GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 做 **minisign** 签名
   - 上传安装包、`.sig` 和 `latest.json`
   - 更新地址已写在 `tauri.conf.json`：`https://github.com/dangzhuotong/tongyun-api/releases/latest/download/latest.json`

5. 用户侧：顶栏或 **关于** 里看清「当前版本」，点 **检查更新**。有新版会下载并重启；已经是最新会提示「已是最新版本」。启动约 3 秒后也会静默检查，有新版同样弹窗。

`workflow_dispatch`（Actions 里手动跑 Release）只构建并上传 artifact，**不**创建 Release，也**不**写入 `latest.json`。

## 签名与 Apple

| | 作用 | 现状 |
| :--- | :--- | :--- |
| minisign（`TAURI_SIGNING_*`） | 更新器确认安装包未被篡改 | 公钥在 `tauri.conf.json`。私钥和密码只在 GitHub Secrets，不要写入仓库 |
| Apple Developer 签名与公证 | 去掉首次打开的「无法验证开发者」 | **未做**。不阻塞检查更新 |

首次从 dmg 安装时，macOS 仍可能提示无法验证。三种办法：

1. 系统设置 → 隐私与安全性 → 往下找到提示，点「仍要打开」；
2. 在「应用程序」里右键点 App，选「打开」，再确认一次；
3. 终端执行：

```bash
xattr -dr com.apple.quarantine /Applications/tongyun-api.app
```

已经装上、且带本更新器的用户，用检查更新换的是 minisign 签过的包。`0.1.0` 没有更新器，需要从 [Releases](https://github.com/dangzhuotong/tongyun-api/releases/latest) 手动装一次 `0.2.0`，之后才能应用内升级。
