# 本地视频批量下载器 / Local Batch Video Downloader

**简体中文** | [English](README.en.md)

在自己的电脑打开一个中文网页，把视频链接加入本地队列，选择保存目录、画质或音频格式，再查看结果。当前支持站点模式包括 YouTube、Facebook、Instagram、TikTok、抖音和小红书；实际能否下载取决于目标内容、自己的访问权限和站点当前规则。

## 功能特性

- 一行一个链接，批量加入队列，查看状态和日志。
- 自动识别或指定站点，提供最佳画质、1080p–2K、4K、MP3 选项；这些选项不保证源内容存在对应清晰度。
- 默认保存到**当前用户的 Downloads 文件夹**，也可以在网页中选择目录。
- 可选读取自己的浏览器登录态或自己提供的 cookies.txt；配置和文件留在本机。
- 支持源码运行；仓库带 Windows 和 macOS 便携包构建脚本。

## 运行环境

| 使用方式 | 要准备什么 |
| --- | --- |
| Windows 源码运行 | Node.js LTS、yt-dlp、FFmpeg；yt-dlp 没有独立可执行文件时还需要 Python 3 |
| macOS 源码运行 | Node.js、Python 3 / yt-dlp、FFmpeg、终端使用权限 |
| 便携包 | 自己构建出的完整便携目录，必须保留 node、vendor、public 等文件 |

依赖来源：[Node.js](https://nodejs.org/) · [Python](https://www.python.org/downloads/) · [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [FFmpeg](https://ffmpeg.org/download.html)。从源码下载本仓库不会自动得到这些第三方二进制文件。

## Windows：第一次启动

1. 在 GitHub 点绿色 **Code → Download ZIP**，下载后右键**全部解压**。
2. 在 Windows 安装 Node.js，安装 Python 时勾选 **Add Python to PATH**；准备 FFmpeg/FFprobe 并加入 PATH。
3. 在解压目录的地址栏输入 `powershell`，按回车，执行：

```powershell
node --version
python --version
python -m pip install -U yt-dlp
ffmpeg -version
```

4. 双击 `start.bat`；窗口会启动 `server.js`。也可在当前目录运行：

```powershell
node server.js
```

5. 保持服务窗口开启，在浏览器打开 `http://127.0.0.1:3218`。首次自动打开页面过早时，服务就绪后刷新一次。

## 第一个下载任务

1. 选择站点模式；不确定时先用“自动识别”。
2. 粘贴一个你有权下载的公开视频链接，先用一个短视频验证流程。
3. 检查保存目录，选择画质；源视频没有 4K 时不会凭空生成 4K。
4. 点**加入下载队列**，查看状态和日志。
5. 完成后点**打开保存目录**，检查实际文件大小与能否播放。

登录态与 cookies.txt 是可选功能。公开视频先按默认方式尝试；确实需要授权时，使用自己的登录状态。不要把 cookies.txt、浏览器资料或下载内容提交到 GitHub。

## macOS 源码方式

安装 Node.js、Python 3、yt-dlp 和 FFmpeg 后，在解压目录终端运行：

```bash
chmod +x launch-mac.command
./launch-mac.command
```

也可以运行 `node server.js` 后打开同一本地地址。Windows 的 exe 不能直接在 Mac 使用。

## 需要发给别人时怎么打包

Windows 上准备 Node.js 后双击 `build-exe.bat`，它调用 `build/build-portable-win.ps1` 构建便携包。生成结果在 `release/windows/`，发送**完整 portable 目录或生成的 ZIP**，不要只发单个 exe。

macOS 构建入口是 `build/build-mac-portable.sh`；GitHub Actions 中已有 macOS 构建工作流。是否生成成功以具体工作流运行记录和产物为准，仓库有脚本不等于已验证所有 Mac 型号。

## 常见问题

| 现象 | 处理方法 |
| --- | --- |
| 双击窗口闪退 | 在该目录运行 `node server.js` 看错误；先检查 node 是否可用。 |
| 找不到 yt-dlp | 用启动程序可见的 Python 执行 `python -m pip install -U yt-dlp`，或配置自己的 YTDLP_PATH。 |
| 只有画面没有声音 / 合并失败 | 检查 FFmpeg 是否可用，重新查看任务日志。 |
| 某站点提示登录或提取失败 | 更新 yt-dlp，核对原链接和自己的访问权限；站点限制可能暂时无法解决。 |
| 3218 被占用 | 关闭你自己之前启动的下载器实例，再启动一次。 |
| 便携版在别人电脑打不开 | 确认发送了整个便携目录，包含 node、vendor 和 public。 |

## 当前限制

本工具不承诺所有站点、所有画质和所有链接都成功；不提供 DRM 解密。下载结果取决于站点、内容权限、网络和第三方提取器。请只保存自己有权访问和使用的内容。本文根据仓库启动脚本、server.js 和网页界面核对，未以你的账号批量下载或读取 Cookie。
