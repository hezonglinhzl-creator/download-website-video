const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, spawnSync } = require("child_process");
const { randomUUID } = require("crypto");

const HOST = "127.0.0.1";
const PORT = 3218;
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "public");
const PUBLIC_DIR = fs.existsSync(DEFAULT_PUBLIC_DIR) ? DEFAULT_PUBLIC_DIR : __dirname;
const APP_ROOT = process.pkg ? path.dirname(process.execPath) : __dirname;
const VENDOR_DIR = path.join(APP_ROOT, "vendor");
const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), "Downloads");
const IS_PACKAGED = Boolean(process.pkg);
const PLATFORM = process.platform;
const DOWNLOADER = resolveDownloader();
const FFMPEG_LOCATION = resolveFfmpegLocation();

const jobs = [];
let queueActive = false;

fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

const SOURCE_PROFILES = {
  generic: {
    label: "自动识别",
    hint: "自动判断站点并用常规下载策略处理。",
    headers: {},
  },
  youtube: {
    label: "YouTube",
    hint: "按 YouTube 链路处理，适合普通视频、Shorts 和分享链接。",
    headers: {
      Referer: "https://www.youtube.com/",
    },
  },
  tiktok: {
    label: "TikTok",
    hint: "优先按 TikTok 提取器处理；如果公开链路失败，可改用登录态或 cookies.txt。",
    headers: {
      Referer: "https://www.tiktok.com/",
    },
  },
  instagram: {
    label: "Instagram",
    hint: "适合帖子、Reels 和分享链接；如果需要更高清晰度，可启用登录态或 cookies.txt。",
    headers: {
      Referer: "https://www.instagram.com/",
    },
  },
  facebook: {
    label: "Facebook",
    hint: "优先按 Facebook 视频/Reels 链路处理；如果需要登录后权限，可启用登录态或 cookies.txt。",
    headers: {
      Referer: "https://www.facebook.com/",
    },
  },
  douyin: {
    label: "抖音",
    hint: "优先按抖音提取器处理；如果提示 fresh cookies，建议直接填写 cookies.txt。",
    headers: {
      Referer: "https://www.douyin.com/",
    },
  },
  xiaohongshu: {
    label: "小红书",
    hint: "优先按小红书提取器处理；如果公开链路失败，建议改用 cookies.txt 重试。",
    headers: {
      Referer: "https://www.xiaohongshu.com/",
    },
  },
  "resource-sniff": {
    label: "资源嗅探",
    hint: "像 IDM 一样尽量抓取页面里的直链、m3u8、mp4 资源作为回退方案。",
    headers: {},
  },
};

function resolveDownloader() {
  const envDownloader = process.env.YTDLP || process.env.YTDLP_PATH;
  const executableName = PLATFORM === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localDownloader = path.join(VENDOR_DIR, executableName);

  if (envDownloader && fs.existsSync(envDownloader)) {
    return {
      command: envDownloader,
      prefixArgs: [],
      label: envDownloader,
      mode: "binary",
    };
  }

  if (fs.existsSync(localDownloader)) {
    return {
      command: localDownloader,
      prefixArgs: [],
      label: localDownloader,
      mode: "binary",
    };
  }

  if (commandExists(executableName)) {
    return {
      command: executableName,
      prefixArgs: [],
      label: executableName,
      mode: "path-binary",
    };
  }

  return {
    command: resolvePythonCommand(),
    prefixArgs: ["-m", "yt_dlp"],
    label: "python -m yt_dlp",
    mode: "python-module",
  };
}

function commandExists(command) {
  const checker = PLATFORM === "win32" ? "where.exe" : "command";
  const args = PLATFORM === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, args, {
    shell: PLATFORM !== "win32",
    windowsHide: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

function resolvePythonCommand() {
  const envPython = process.env.PYTHON || process.env.PYTHON_PATH;
  const candidates = [
    envPython,
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Programs",
      "Python",
      "Python312",
      "python.exe"
    ),
    "python",
    "py",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.endsWith(".exe")) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate;
  }

  return "python";
}

function resolveFfmpegLocation() {
  const envFfmpeg = process.env.FFMPEG || process.env.FFMPEG_PATH;
  const executableName = PLATFORM === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const localFfmpeg = path.join(VENDOR_DIR, executableName);

  if (envFfmpeg && fs.existsSync(envFfmpeg)) {
    return path.dirname(envFfmpeg);
  }

  if (fs.existsSync(localFfmpeg)) {
    return VENDOR_DIR;
  }

  return "";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not Found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function openAppInBrowser() {
  const appUrl = `http://${HOST}:${PORT}`;
  const launcher = getSystemLauncher(appUrl);
  const child = spawn(launcher.command, launcher.args, {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function getSystemLauncher(targetPath) {
  if (PLATFORM === "win32") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "", targetPath],
    };
  }

  if (PLATFORM === "darwin") {
    return {
      command: "open",
      args: [targetPath],
    };
  }

  return {
    command: "xdg-open",
    args: [targetPath],
  };
}

function normalizeUrls(rawUrls) {
  return String(rawUrls || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectPlatform(url) {
  const normalized = String(url || "").toLowerCase();

  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }
  if (
    normalized.includes("facebook.com") ||
    normalized.includes("fb.watch") ||
    normalized.includes("m.facebook.com")
  ) {
    return "facebook";
  }
  if (normalized.includes("instagram.com")) {
    return "instagram";
  }
  if (
    normalized.includes("tiktok.com") ||
    normalized.includes("vm.tiktok.com") ||
    normalized.includes("vt.tiktok.com")
  ) {
    return "tiktok";
  }
  if (normalized.includes("douyin.com") || normalized.includes("iesdouyin.com")) {
    return "douyin";
  }
  if (
    normalized.includes("xiaohongshu.com") ||
    normalized.includes("xhslink.com") ||
    normalized.includes("xhs.cn")
  ) {
    return "xiaohongshu";
  }

  return "generic";
}

function resolveSourceMode(requestedMode, url) {
  if (requestedMode && requestedMode !== "generic") {
    return SOURCE_PROFILES[requestedMode] ? requestedMode : "generic";
  }
  return detectPlatform(url);
}

function createJob(url, options) {
  const sourceMode = resolveSourceMode(options.sourceMode, url);
  const profile = SOURCE_PROFILES[sourceMode] || SOURCE_PROFILES.generic;
  return {
    id: randomUUID(),
    url,
    status: "queued",
    progress: "等待下载",
    percent: 0,
    speedText: "-",
    speedBytes: 0,
    etaText: "-",
    downloadedBytes: 0,
    totalBytes: 0,
    format: options.format,
    sourceMode,
    sourceLabel: profile.label,
    sourceHint: profile.hint,
    outputDir: options.outputDir,
    useCookies: options.useCookies,
    browser: options.browser,
    cookiesPath: options.cookiesPath,
    extractor: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attemptCount: 0,
    activeAttempt: "",
    log: ["任务已加入队列"],
    filePath: "",
    error: "",
  };
}

function findJob(jobId) {
  return jobs.find((job) => job.id === jobId);
}

function pushLog(job, message) {
  job.log.push(message);
  if (job.log.length > 24) {
    job.log = job.log.slice(-24);
  }
  job.updatedAt = new Date().toISOString();
}

function parseByteCount(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function parseSpeedText(speedText) {
  const match = String(speedText || "")
    .trim()
    .match(/^([\d.]+)\s*([KMGT]?i?B)\/s$/i);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    KIB: 1024,
    KB: 1000,
    MIB: 1024 ** 2,
    MB: 1000 ** 2,
    GIB: 1024 ** 3,
    GB: 1000 ** 3,
    TIB: 1024 ** 4,
    TB: 1000 ** 4,
  };

  return Math.round(amount * (multipliers[unit] || 0));
}

function buildBaseArgs(job) {
  const args = [
    "--newline",
    "--restrict-filenames",
    "--no-playlist",
    "--windows-filenames",
    "--retries",
    "8",
    "--fragment-retries",
    "8",
    "--file-access-retries",
    "4",
    "--retry-sleep",
    "http:exp=1:8",
    "--retry-sleep",
    "fragment:exp=1:8",
    "--concurrent-fragments",
    "8",
    "--http-chunk-size",
    "10M",
    "--socket-timeout",
    "20",
    "--progress-template",
    "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress.eta)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s",
    "--print",
    "before_dl:extractor=%(extractor)s",
    "--print",
    "after_move:filepath=%(filepath)s",
    "-P",
    job.outputDir,
  ];

  if (FFMPEG_LOCATION) {
    args.push("--ffmpeg-location", FFMPEG_LOCATION);
  }

  if (job.format === "audio") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    args.push("--merge-output-format", "mp4", "--remux-video", "mp4");
    if (job.format === "hd-2k") {
      args.push("-S", "vcodec:h264,res:1440,fps,hdr:12,acodec:aac");
    } else if (job.format === "4k") {
      args.push("-S", "vcodec:h264,res:2160,fps,hdr:12,acodec:aac");
    } else {
      args.push("-S", "vcodec:h264,res,fps,hdr:12,acodec:aac");
    }
    args.push("-f", "bv*+ba/b");
  }

  return args;
}

function appendHeaders(args, headers) {
  for (const [key, value] of Object.entries(headers || {})) {
    args.push("--add-header", `${key}:${value}`);
  }
}

function buildExtraArgsForMode(job) {
  switch (job.sourceMode) {
    case "facebook":
      return ["--use-extractors", "facebook,default,generic"];
    case "instagram":
      return ["--use-extractors", "Instagram,default,generic"];
    case "youtube":
      return ["--use-extractors", "youtube,default"];
    case "tiktok":
    case "douyin":
      return ["--use-extractors", "TikTok,Douyin,default,generic"];
    case "xiaohongshu":
      return ["--use-extractors", "XiaoHongShu,default,generic"];
    default:
      return [];
  }
}

function buildAttemptPlan(job) {
  const profile = SOURCE_PROFILES[job.sourceMode] || SOURCE_PROFILES.generic;
  const wantsCookies = Boolean(job.useCookies);
  const wantsCookieFile = Boolean(job.cookiesPath);
  const attempts = [];

  const addAttempt = (label, options = {}) => {
    const args = buildBaseArgs(job);
    appendHeaders(args, profile.headers);
    args.push(...buildExtraArgsForMode(job));

    if (options.forceGeneric) {
      args.push("--use-extractors", "default,generic");
    }

    if (options.cookiesFile && job.cookiesPath) {
      args.push("--cookies", job.cookiesPath);
    } else if (options.cookies) {
      args.push("--cookies-from-browser", job.browser);
    }

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }

    args.push(job.url);
    attempts.push({ label, args });
  };

  addAttempt("标准站点解析", {
    cookies: wantsCookies && !wantsCookieFile,
    cookiesFile: wantsCookieFile,
  });

  if (wantsCookies) {
    addAttempt("关闭登录态后的公开重试", {
      cookies: false,
      cookiesFile: false,
    });
  }

  addAttempt("IDM 风格资源嗅探回退", {
    cookies: wantsCookies && !wantsCookieFile,
    cookiesFile: wantsCookieFile,
    forceGeneric: true,
    extraArgs: ["--check-formats"],
  });

  return attempts;
}

function parseProgressLine(job, line) {
  if (line.startsWith("download:")) {
    const [, payload] = line.split("download:");
    const [percent, speed, eta, downloadedBytes, totalBytes, totalBytesEstimate] = payload.split("|");
    const percentText = (percent || "").trim() || "处理中";
    const numericPercent = Number.parseFloat(percentText.replace("%", "").trim());
    job.percent = Number.isFinite(numericPercent) ? Math.min(Math.max(numericPercent, 0), 100) : job.percent;
    job.speedText = (speed || "").trim() || "-";
    job.speedBytes = parseSpeedText(job.speedText);
    job.etaText = (eta || "").trim() || "-";
    job.downloadedBytes = parseByteCount(downloadedBytes);
    job.totalBytes = parseByteCount(totalBytes) || parseByteCount(totalBytesEstimate) || job.totalBytes;
    job.progress = `${percentText} | 速度 ${job.speedText} | ETA ${job.etaText}`;
    job.updatedAt = new Date().toISOString();
    return;
  }

  if (line.startsWith("filepath=")) {
    job.filePath = line.slice("filepath=".length).trim();
    pushLog(job, `已保存到: ${job.filePath}`);
    return;
  }

  if (line.startsWith("extractor=")) {
    job.extractor = line.slice("extractor=".length).trim();
    job.updatedAt = new Date().toISOString();
    return;
  }

  if (line.startsWith("ERROR:")) {
    job.error = line;
  }

  if (line) {
    pushLog(job, line);
  }
}

function runAttempt(job, attempt) {
  return new Promise((resolve) => {
    const child = spawn(DOWNLOADER.command, [...DOWNLOADER.prefixArgs, ...attempt.args], {
      cwd: APP_ROOT,
      windowsHide: true,
    });

    child.stdout.on("data", (chunk) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          parseProgressLine(job, trimmed);
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          parseProgressLine(job, trimmed);
        }
      }
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        error: error.message,
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        error: code === 0 ? "" : job.error || `yt-dlp exited with code ${code}`,
      });
    });
  });
}

async function runJob(job) {
  fs.mkdirSync(job.outputDir, { recursive: true });
  job.status = "running";
  job.progress = "准备下载";
  job.percent = 0;
  job.speedText = "-";
  job.speedBytes = 0;
  job.etaText = "-";
  job.downloadedBytes = 0;
  job.totalBytes = 0;
  job.error = "";
  job.updatedAt = new Date().toISOString();

  const attempts = buildAttemptPlan(job);

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    job.attemptCount = index + 1;
    job.activeAttempt = attempt.label;
    pushLog(job, `开始第 ${index + 1} 次尝试: ${attempt.label}`);

    const result = await runAttempt(job, attempt);
    if (result.ok) {
      job.status = "completed";
      job.percent = 100;
      job.speedText = "-";
      job.speedBytes = 0;
      job.etaText = "0s";
      job.progress = "下载完成";
      job.error = "";
      if (!job.filePath) {
        pushLog(job, "任务完成，文件已写入输出目录");
      }
      job.updatedAt = new Date().toISOString();
      return;
    }

    pushLog(job, `第 ${index + 1} 次失败: ${result.error || `退出码 ${result.code}`}`);

    if (index < attempts.length - 1) {
      job.progress = "切换策略重试中";
      job.speedText = "-";
      job.speedBytes = 0;
      job.etaText = "-";
      job.updatedAt = new Date().toISOString();
      continue;
    }

    job.status = "failed";
    job.progress = "下载失败";
    job.speedText = "-";
    job.speedBytes = 0;
    job.error = result.error || `yt-dlp exited with code ${result.code}`;
    job.updatedAt = new Date().toISOString();
  }
}

async function processQueue() {
  if (queueActive) {
    return;
  }

  queueActive = true;
  while (true) {
    const nextJob = jobs.find((job) => job.status === "queued");
    if (!nextJob) {
      break;
    }
    await runJob(nextJob);
  }
  queueActive = false;
}

function openFolder(folderPath) {
  return new Promise((resolve, reject) => {
    const launcher = getSystemLauncher(folderPath);
    const child = spawn(launcher.command, launcher.args, {
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${launcher.command} exited with code ${code}`));
      }
    });
  });
}

function pickFolderDialog(initialDir) {
  if (PLATFORM === "darwin") {
    return pickFolderDialogMac(initialDir);
  }

  if (PLATFORM !== "win32") {
    return Promise.resolve("");
  }

  return pickFolderDialogWindows(initialDir);
}

function pickFolderDialogWindows(initialDir) {
  return new Promise((resolve, reject) => {
    const safeInitialDir = String(initialDir || DEFAULT_OUTPUT_DIR).replaceAll("'", "''");
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$dialog.SelectedPath = '${safeInitialDir}'`,
      "$dialog.ShowNewFolderButton = $true",
      "$result = $dialog.ShowDialog()",
      "if ($result -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "  Write-Output $dialog.SelectedPath",
      "}",
    ].join("; ");

    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && stderr.trim()) {
        reject(new Error(stderr.trim()));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function pickFolderDialogMac(initialDir) {
  return new Promise((resolve, reject) => {
    const defaultDir = fs.existsSync(initialDir || "")
      ? initialDir
      : path.join(os.homedir(), "Downloads");
    const safeInitialDir = escapeAppleScriptString(defaultDir || os.homedir());
    const script = [
      `set defaultFolder to POSIX file "${safeInitialDir}"`,
      'set chosenFolder to choose folder with prompt "Choose download folder" default location defaultFolder',
      "POSIX path of chosenFolder",
    ];

    const args = script.flatMap((line) => ["-e", line]);
    const child = spawn("osascript", args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        if (stderr.includes("User canceled")) {
          resolve("");
          return;
        }
        reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function escapeAppleScriptString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Bad Request");
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      host: HOST,
      port: PORT,
      defaultOutputDir: DEFAULT_OUTPUT_DIR,
      jobCount: jobs.length,
      downloaderCommand: DOWNLOADER.label,
      downloaderMode: DOWNLOADER.mode,
      ffmpegLocation: FFMPEG_LOCATION,
      packaged: IS_PACKAGED,
      sourceProfiles: Object.entries(SOURCE_PROFILES).map(([key, value]) => ({
        key,
        label: value.label,
        hint: value.hint,
      })),
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/jobs") {
    sendJson(res, 200, { jobs: jobs.slice().reverse() });
    return;
  }

  if (req.method === "POST" && req.url === "/api/downloads") {
    try {
      const body = await parseBody(req);
      const urls = normalizeUrls(body.urls);
      const outputDir = String(body.outputDir || DEFAULT_OUTPUT_DIR).trim() || DEFAULT_OUTPUT_DIR;
      const format = String(body.format || "best");
      const sourceMode = String(body.sourceMode || "generic");
      const browser = String(body.browser || "chrome");
      const useCookies = Boolean(body.useCookies);
      const cookiesPath = String(body.cookiesPath || "").trim();

      if (!urls.length) {
        sendJson(res, 400, { ok: false, error: "请至少输入一个视频链接" });
        return;
      }

      const newJobs = urls.map((url) =>
        createJob(url, {
          outputDir,
          format,
          sourceMode,
          useCookies,
          browser,
          cookiesPath,
        })
      );

      jobs.push(...newJobs);
      void processQueue();

      sendJson(res, 200, {
        ok: true,
        message: `已加入 ${newJobs.length} 个任务`,
        added: newJobs.length,
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: "请求格式不正确" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/open-output") {
    try {
      const body = await parseBody(req);
      const folderPath = String(body.outputDir || DEFAULT_OUTPUT_DIR).trim() || DEFAULT_OUTPUT_DIR;
      fs.mkdirSync(folderPath, { recursive: true });
      await openFolder(folderPath);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/pick-output") {
    try {
      const body = await parseBody(req);
      const initialDir = String(body.outputDir || DEFAULT_OUTPUT_DIR).trim() || DEFAULT_OUTPUT_DIR;
      const pickedPath = await pickFolderDialog(initialDir);
      sendJson(res, 200, {
        ok: true,
        selectedPath: pickedPath || initialDir,
        cancelled: !pickedPath,
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/api/retry/")) {
    const jobId = decodeURIComponent(req.url.slice("/api/retry/".length));
    const job = findJob(jobId);

    if (!job) {
      sendJson(res, 404, { ok: false, error: "任务不存在" });
      return;
    }

    if (job.status === "running" || job.status === "queued") {
      sendJson(res, 400, { ok: false, error: "该任务正在处理中" });
      return;
    }

    job.status = "queued";
    job.progress = "等待重试";
    job.percent = 0;
    job.speedText = "-";
    job.speedBytes = 0;
    job.etaText = "-";
    job.downloadedBytes = 0;
    job.totalBytes = 0;
    job.filePath = "";
    job.error = "";
    job.attemptCount = 0;
    job.activeAttempt = "";
    pushLog(job, "任务已重新加入队列");
    void processQueue();

    sendJson(res, 200, { ok: true, message: "任务已重新加入队列" });
    return;
  }

  if (req.method !== "GET") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Video downloader running at http://${HOST}:${PORT}`);
  if (process.env.NO_OPEN_BROWSER !== "1") {
    openAppInBrowser();
  }
});
