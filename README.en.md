# Local Batch Video Downloader / 本地视频批量下载器

[简体中文](README.md) | **English**

Run a local web page to queue video URLs, choose an output directory and quality/audio option, then inspect downloaded files. Site modes include YouTube, Facebook, Instagram, TikTok, Douyin and Xiaohongshu. Availability depends on the content, your access rights and current platform behavior.

## Features

- One URL per line with local queue status and logs.
- Automatic or explicit site selection; best, 1080p–2K, 4K and MP3 options. A requested quality is not a guarantee that the source provides it.
- Defaults to the current user's Downloads folder, with a directory picker.
- Optional use of your own browser session or cookies.txt, kept locally.
- Source launch plus Windows/macOS portable-build scripts.

## Requirements

| Mode | Requirements |
| --- | --- |
| Windows source | Node.js LTS, yt-dlp and FFmpeg; Python 3 if yt-dlp is not a standalone executable |
| macOS source | Node.js, Python 3 / yt-dlp, FFmpeg and terminal access |
| Portable | A complete package you built, including node, vendor and public files |

Dependency sources: [Node.js](https://nodejs.org/), [Python](https://www.python.org/downloads/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [FFmpeg](https://ffmpeg.org/download.html). Downloading repository source does not include all third-party executables.

## First run on Windows

1. Choose **Code → Download ZIP** on GitHub and extract the whole archive.
2. Install Node.js. If using Python, select **Add Python to PATH**. Install FFmpeg/FFprobe and make them available on PATH.
3. Open the extracted folder in File Explorer, type `powershell` in its address bar and press Enter:

```powershell
node --version
python --version
python -m pip install -U yt-dlp
ffmpeg -version
```

4. Run `start.bat` and leave the service window open, or run this from the project directory:

```powershell
node server.js
```

5. Open `http://127.0.0.1:3218`. If the automatic browser tab opens before startup finishes, refresh it once the server is ready.

## First download

1. Select a site mode, or start with automatic detection.
2. Paste one short public video URL you are allowed to download.
3. Check the output directory and quality. Selecting 4K cannot create detail absent from the source.
4. Click **加入下载队列** (Add to queue), then inspect status and logs.
5. Click **打开保存目录** (Open output folder) and check file size and playback.

Try public content with defaults first. Browser-session/cookies.txt access is optional and must use your own account. Do not commit cookies, browser profiles or downloaded media to GitHub.

## macOS source launch

After installing Node.js, Python 3, yt-dlp and FFmpeg, run this from the extracted project:

```bash
chmod +x launch-mac.command
./launch-mac.command
```

You may also run `node server.js` and open the same local URL. A Windows exe does not run directly on macOS.

## Sharing a portable build

On Windows, run `build-exe.bat` after installing Node.js. It calls `build/build-portable-win.ps1`; outputs are under `release/windows/`. Share the whole portable directory or generated ZIP, not a single exe.

macOS builds use `build/build-mac-portable.sh`; macOS GitHub Actions workflows are also included. Check the actual workflow run and artifacts for success. Having build scripts does not prove compatibility with every Mac.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Window closes immediately | Run `node server.js` from PowerShell and inspect the error; check Node availability. |
| yt-dlp not found | Install it using the Python visible to the server, or configure your YTDLP_PATH. |
| No audio / merge fails | Check FFmpeg availability and the task log. |
| Login/extraction failure | Update yt-dlp and check the original URL and your permissions; some platform restrictions remain unresolved. |
| Port 3218 occupied | Close your own earlier downloader instance and restart. |
| Portable build fails on another PC | Confirm the complete directory includes node, vendor and public. |

## Limits

Not every site, quality or link is guaranteed to work. DRM decryption is not provided. Results depend on platform behavior, content access, networking and the extractor. Save only content you may access and use. This guide was checked against launch scripts, server.js and the UI; no account cookies were read and no bulk download was performed for documentation validation.
