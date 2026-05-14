# 本地视频批量下载器

这是一个在你电脑本地运行的中文网页工具，适合批量下载常见站点的公开视频链接。

## 功能

- 一行一个链接，批量加入任务
- 本地队列显示下载状态和简易日志
- 支持最佳画质、720p、仅提取音频
- 可尝试读取浏览器登录状态处理你自己有权限的内容
- 默认下载到 `C:\Users\sales\Downloads`

## 启动

### 方法 1：直接双击

双击 `start.bat`

### 方法 2：命令行启动

```powershell
cd "C:\Users\sales\Documents\New project 3"
node server.js
```

然后打开：

[`http://127.0.0.1:3218`](http://127.0.0.1:3218)

## 打包成 EXE

双击 `build-exe.bat`

生成后的文件在：

`dist\local-video-downloader.exe`

说明：

- 这个 `exe` 是本机启动器，双击后会启动当前项目里的下载器
- 适合你这台电脑直接使用

## Windows 便携版

现在推荐使用 `build-exe.bat` 生成便携版：

```powershell
build-exe.bat
```

生成目录：

`release\windows\portable`

发送给别人时，请发送 `release\windows\local-video-downloader-windows-portable.zip`，或者发送整个 `release\windows\portable` 文件夹。不要只发送单个 `exe`。这个文件夹会包含：

- `start-windows.bat`
- `node.exe`
- `server.js`
- `public`
- `vendor\yt-dlp.exe`
- `vendor\ffmpeg.exe`

普通 Windows 用户收到后，解压并双击 `start-windows.bat` 即可启动。

## 注意

- 这个工具依赖 `Python + yt-dlp + ffmpeg`
- 当前机器已经安装 `yt-dlp`
- 不是所有平台内容都能下载
- DRM、私密内容、无权限内容、平台限制内容不保证可用
- 请只下载你自己有权访问和保存的内容

## Mac 使用说明

Mac 可以运行同一套网页下载工具，但不能直接使用 Windows 的 `exe` 文件。

项目已经提供云端 macOS 打包和测试流程：

- `.github/workflows/build-mac.yml`
- `build/build-mac-portable.sh`

上传到 GitHub 后，运行 `Build and test macOS package`，云端会在 macOS runner 上完成：

- 打包 `Local Video Downloader.app`
- 启动打包后的 app 内置服务
- 检查 `/api/health`
- 实际下载 YouTube 测试视频
- 上传 `release\mac\local-video-downloader-mac-x64.zip` 和 `release\mac\local-video-downloader-mac-arm64.zip`

如果只是源码方式在 Mac 上运行：

把整个项目文件夹复制到 Mac，然后安装：

- Node.js LTS
- Python 3
- yt-dlp
- ffmpeg

首次使用时在终端运行：

```bash
cd "/path/to/New project 3"
chmod +x launch-mac.command
./launch-mac.command
```

以后可以双击 `launch-mac.command` 启动。

说明：
- Windows 的 `dist/local-video-downloader.exe` 只适合 Windows
- 真正的 Mac `.app` 或 `.dmg` 需要在 Mac 上打包和签名
- Mac 版会使用系统 `open` 打开浏览器和下载目录，并用系统选择窗口选择保存目录
