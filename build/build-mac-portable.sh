#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_BASE_DIR="$ROOT/release/mac"
RELEASE_DIR="$RELEASE_BASE_DIR/portable"
PACKAGE_SUFFIX="${PACKAGE_SUFFIX:-$(uname -m)}"
APP_NAME="Local Video Downloader.app"
APP_DIR="$RELEASE_DIR/$APP_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
APP_RESOURCES_DIR="$RESOURCES_DIR/app"
VENDOR_DIR="$APP_RESOURCES_DIR/vendor"
ZIP_PATH="$RELEASE_BASE_DIR/local-video-downloader-mac-${PACKAGE_SUFFIX}.zip"

mkdir -p "$MACOS_DIR" "$APP_RESOURCES_DIR/public" "$VENDOR_DIR" "$RELEASE_BASE_DIR"

cp "$ROOT/server.js" "$APP_RESOURCES_DIR/server.js"
cp -R "$ROOT/public/." "$APP_RESOURCES_DIR/public/"
cp "$ROOT/README.md" "$APP_RESOURCES_DIR/README.md"

if command -v node >/dev/null 2>&1; then
  mkdir -p "$RESOURCES_DIR/node/bin"
  cp "$(command -v node)" "$RESOURCES_DIR/node/bin/node"
else
  echo "node is required for building the mac package" >&2
  exit 1
fi

if [ ! -x "$VENDOR_DIR/yt-dlp" ]; then
  echo "Downloading yt-dlp for macOS..."
  curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos" -o "$VENDOR_DIR/yt-dlp"
  chmod +x "$VENDOR_DIR/yt-dlp"
fi

if [ ! -x "$VENDOR_DIR/ffmpeg" ]; then
  if [ -n "${FFMPEG_BINARY:-}" ] && [ -x "$FFMPEG_BINARY" ]; then
    cp "$FFMPEG_BINARY" "$VENDOR_DIR/ffmpeg"
  elif command -v ffmpeg >/dev/null 2>&1; then
    cp "$(command -v ffmpeg)" "$VENDOR_DIR/ffmpeg"
  else
    echo "ffmpeg is required on the build machine" >&2
    exit 1
  fi
  chmod +x "$VENDOR_DIR/ffmpeg"
fi

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Local Video Downloader</string>
  <key>CFBundleDisplayName</key>
  <string>Local Video Downloader</string>
  <key>CFBundleIdentifier</key>
  <string>local.video.downloader</string>
  <key>CFBundleVersion</key>
  <string>1.1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.1.0</string>
  <key>CFBundleExecutable</key>
  <string>local-video-downloader</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/local-video-downloader" <<'LAUNCHER'
#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
NODE_BIN="$(cd "$(dirname "$0")/../Resources/node/bin" && pwd)/node"

cd "$APP_ROOT"
nohup "$NODE_BIN" "$APP_ROOT/server.js" >/tmp/local-video-downloader.log 2>&1 &
LAUNCHER

chmod +x "$MACOS_DIR/local-video-downloader"
chmod +x "$RESOURCES_DIR/node/bin/node"

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$APP_DIR" || true
fi

cd "$RELEASE_DIR"
/usr/bin/zip -qry "$ZIP_PATH" "$APP_NAME"

echo "Mac portable package is ready:"
echo "  $ZIP_PATH"
