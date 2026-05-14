const els = {
  urls: document.getElementById("urls"),
  outputDir: document.getElementById("outputDir"),
  format: document.getElementById("format"),
  useCookies: document.getElementById("useCookies"),
  browser: document.getElementById("browser"),
  cookiesPath: document.getElementById("cookiesPath"),
  pickDirBtn: document.getElementById("pickDirBtn"),
  submitBtn: document.getElementById("submitBtn"),
  openBtn: document.getElementById("openBtn"),
  message: document.getElementById("message"),
  jobs: document.getElementById("jobs"),
  modeHint: document.getElementById("modeHint"),
  queueHint: document.getElementById("queueHint"),
  statTotal: document.getElementById("statTotal"),
  statRunning: document.getElementById("statRunning"),
  statCompleted: document.getElementById("statCompleted"),
  statPercent: document.getElementById("statPercent"),
  statSpeed: document.getElementById("statSpeed"),
};

let pollTimer = null;
let sourceMode = "generic";

const STATUS_TEXT = {
  queued: "排队中",
  running: "下载中",
  completed: "已完成",
  failed: "失败",
};

const FORMAT_TEXT = {
  best: "自动最佳画质",
  "hd-2k": "1080p - 2K",
  "4k": "4K",
  audio: "仅音频 MP3",
};

const SOURCE_MODE_TEXT = {
  generic: "自动识别",
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  douyin: "抖音",
  xiaohongshu: "小红书",
  "resource-sniff": "资源嗅探",
};

const SOURCE_MODE_HINT = {
  generic: "自动判断站点并用常规下载策略处理。",
  youtube: "适合普通视频、Shorts 和分享链接。",
  facebook: "优先按 Facebook 视频/Reels 处理；如果需要登录后权限，可启用浏览器登录态或 cookies.txt。",
  instagram: "适合帖子、Reels 和分享链接；如果需要更高清晰度，可启用登录态或 cookies.txt。",
  tiktok: "优先按 TikTok 提取器处理；如果公开链路失败，可改用登录态或 cookies.txt。",
  douyin: "优先按抖音提取器处理；如果提示 fresh cookies，建议直接填写 cookies.txt。",
  xiaohongshu: "优先按小红书提取器处理；如果公开链路失败，建议改用 cookies.txt 重试。",
  "resource-sniff": "像 IDM 一样更积极地抓页面里的 mp4、m3u8 等资源，适合标准模式失败时手动指定。",
};

function setMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.style.color = isError ? "#b73333" : "#6a5d50";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const digits = size >= 100 || index === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[index]}`;
}

function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function updateToolbar(jobs) {
  const total = jobs.length;
  const running = jobs.filter((job) => job.status === "running").length;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const queueing = jobs.filter((job) => job.status === "queued").length;
  const speedBytes = jobs
    .filter((job) => job.status === "running")
    .reduce((sum, job) => sum + (Number(job.speedBytes) || 0), 0);

  const progressSum = jobs.reduce((sum, job) => {
    if (job.status === "completed") {
      return sum + 100;
    }
    const percent = Number(job.percent);
    return sum + (Number.isFinite(percent) ? Math.max(0, Math.min(percent, 100)) : 0);
  }, 0);

  const overallPercent = total ? Math.round(progressSum / total) : 0;

  els.statTotal.textContent = String(total);
  els.statRunning.textContent = String(running);
  els.statCompleted.textContent = String(completed);
  els.statPercent.textContent = `${overallPercent}%`;
  els.statSpeed.textContent = formatSpeed(speedBytes);
  els.queueHint.textContent = total
    ? `状态每 2 秒自动刷新，当前 ${running} 个下载中，${queueing} 个排队`
    : "状态每 2 秒自动刷新";

  document.title =
    total > 0
      ? `${overallPercent}% · ${formatSpeed(speedBytes)} · 本地视频下载工具`
      : "本地视频下载工具";
}

function renderJobs(jobs) {
  updateToolbar(jobs);

  if (!jobs.length) {
    els.jobs.innerHTML = '<div class="empty">还没有任务，先贴几个链接试试。</div>';
    return;
  }

  els.jobs.innerHTML = jobs
    .map((job) => {
      const lines = [...job.log];
      if (job.error) {
        lines.push(`error: ${job.error}`);
      }

      const statusText = STATUS_TEXT[job.status] || job.status;
      const formatText = FORMAT_TEXT[job.format] || job.format;
      const sourceModeText = SOURCE_MODE_TEXT[job.sourceMode] || job.sourceLabel || "自动识别";
      const retryButton =
        job.status === "failed" || job.status === "completed"
          ? `<button class="mini-btn" data-retry="${escapeHtml(job.id)}">重新下载</button>`
          : "";
      const percent = Number.isFinite(Number(job.percent))
        ? Math.max(0, Math.min(Number(job.percent), 100))
        : 0;
      const totalBytesLine =
        Number(job.totalBytes) > 0
          ? `<div>大小：${escapeHtml(formatBytes(job.downloadedBytes))} / ${escapeHtml(formatBytes(job.totalBytes))}</div>`
          : `<div>已下载：${escapeHtml(formatBytes(job.downloadedBytes))}</div>`;

      return `
        <article class="job">
          <div class="job-top">
            <div class="job-url">${escapeHtml(job.url)}</div>
            <span class="badge ${escapeHtml(job.status)}">${escapeHtml(statusText)}</span>
          </div>
          <div class="job-progress">
            <span style="width: ${percent}%"></span>
          </div>
          <div class="job-meta">
            <div>进度：${escapeHtml(job.progress)}</div>
            <div>来源：${escapeHtml(sourceModeText)}</div>
            <div>模式：${escapeHtml(formatText)}</div>
            <div>策略：${escapeHtml(job.activeAttempt || "等待开始")}</div>
            <div>提取器：${escapeHtml(job.extractor || "-")}</div>
            <div>Cookies：${escapeHtml(job.cookiesPath || (job.useCookies ? `浏览器 ${job.browser}` : "未启用"))}</div>
            <div>当前网速：${escapeHtml(job.speedText || "-")}</div>
            <div>预计剩余：${escapeHtml(job.etaText || "-")}</div>
            ${totalBytesLine}
            <div>保存目录：${escapeHtml(job.outputDir)}</div>
            ${job.filePath ? `<div>输出文件：${escapeHtml(job.filePath)}</div>` : ""}
          </div>
          <div class="job-log">${escapeHtml(lines.join("\n"))}</div>
          ${retryButton ? `<div class="job-actions">${retryButton}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

async function refreshJobs() {
  try {
    const data = await fetchJson("/api/jobs", {
      method: "GET",
      headers: {},
    });
    renderJobs(data.jobs || []);
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function init() {
  try {
    const health = await fetchJson("/api/health", {
      method: "GET",
      headers: {},
    });
    els.outputDir.value = health.defaultOutputDir;
    setMessage("本地服务已启动，可以开始粘贴链接。");
    await refreshJobs();
  } catch (error) {
    setMessage(`服务启动失败：${error.message}`, true);
  }

  pollTimer = window.setInterval(refreshJobs, 2000);
}

function applySourceMode(mode) {
  sourceMode = mode;
  els.modeHint.textContent = SOURCE_MODE_HINT[mode] || SOURCE_MODE_HINT.generic;

  document.querySelectorAll(".preset-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  if (["facebook", "instagram", "tiktok", "douyin", "xiaohongshu"].includes(mode)) {
    els.browser.value = "chrome";
  }
}

els.submitBtn.addEventListener("click", async () => {
  const urls = els.urls.value.trim();
  if (!urls) {
    setMessage("请先输入至少一个链接。", true);
    return;
  }

  els.submitBtn.disabled = true;
  setMessage("正在加入队列...");

  try {
    const data = await fetchJson("/api/downloads", {
      method: "POST",
      body: JSON.stringify({
        urls,
        outputDir: els.outputDir.value.trim(),
        format: els.format.value,
        sourceMode,
        useCookies: els.useCookies.checked,
        browser: els.browser.value,
        cookiesPath: els.cookiesPath.value.trim(),
      }),
    });
    setMessage(data.message || "已加入下载队列");
    els.urls.value = "";
    await refreshJobs();
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    els.submitBtn.disabled = false;
  }
});

document.querySelectorAll(".preset-btn").forEach((button) => {
  button.addEventListener("click", () => {
    applySourceMode(button.dataset.mode || "generic");
  });
});

els.openBtn.addEventListener("click", async () => {
  try {
    await fetchJson("/api/open-output", {
      method: "POST",
      body: JSON.stringify({
        outputDir: els.outputDir.value.trim(),
      }),
    });
    setMessage("已打开保存目录。");
  } catch (error) {
    setMessage(error.message, true);
  }
});

els.pickDirBtn.addEventListener("click", async () => {
  els.pickDirBtn.disabled = true;

  try {
    const data = await fetchJson("/api/pick-output", {
      method: "POST",
      body: JSON.stringify({
        outputDir: els.outputDir.value.trim(),
      }),
    });

    if (data.selectedPath) {
      els.outputDir.value = data.selectedPath;
      setMessage(data.cancelled ? "已保留当前目录。" : "已更新保存目录。");
    }
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    els.pickDirBtn.disabled = false;
  }
});

els.jobs.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-retry]");
  if (!button) {
    return;
  }

  const jobId = button.getAttribute("data-retry");
  button.disabled = true;

  try {
    const data = await fetchJson(`/api/retry/${encodeURIComponent(jobId)}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setMessage(data.message || "任务已重新加入队列");
    await refreshJobs();
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }
});

applySourceMode("generic");
void init();
