#!/bin/zsh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is required. Please install Node.js LTS first." buttons {"OK"} default button "OK"'
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is required. Please install Python 3 first." buttons {"OK"} default button "OK"'
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  osascript -e 'display dialog "yt-dlp is required. Install it with: python3 -m pip install -U yt-dlp" buttons {"OK"} default button "OK"'
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  osascript -e 'display dialog "ffmpeg is required for highest quality video merging. Install it with Homebrew: brew install ffmpeg" buttons {"OK"} default button "OK"'
  exit 1
fi

nohup node "$DIR/server.js" >/tmp/local-video-downloader.log 2>&1 &
