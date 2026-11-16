import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { chromeExecutable } from "../chrome.js";

export interface CtaOverlayOptions {
  /** Total duration of the animated CTA sequence in seconds (default 3.2s). */
  duration?: number;
  likeText?: string;
  commentText?: string;
  subscribeText?: string;
  subscribedText?: string;
  headerText?: string;
  /** Layout orientation or vertical offset percentage from top (default 64 for 9:16, 72 for 16:9). */
  yPercent?: number;
}

function buildCtaHtml(width: number, height: number, opts: Required<CtaOverlayOptions>): string {
  const isVertical = height > width;
  const scale = isVertical ? width / 1080 : height / 1080;
  const topPct = opts.yPercent;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    background: transparent !important;
    overflow: hidden;
    font-family: "Fira Sans", "Adwaita Sans", "DejaVu Sans", system-ui, sans-serif;
  }
  .stage {
    position: absolute;
    left: 50%;
    top: ${topPct}%;
    transform: translate(-50%, -50%) scale(${scale.toFixed(4)});
    transform-origin: center center;
    width: ${isVertical ? 940 : 1120}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .dock {
    width: 100%;
    padding: ${isVertical ? "30px 28px" : "26px 34px"};
    border-radius: 34px;
    background: linear-gradient(145deg, rgba(12, 20, 28, 0.84), rgba(16, 30, 38, 0.78));
    border: 2px solid rgba(120, 230, 255, 0.28);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    opacity: 0;
  }
  .header {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 2.2px;
    text-transform: uppercase;
    color: #9EE9FF;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }
  .row {
    width: 100%;
    display: flex;
    flex-direction: ${isVertical ? "column" : "row"};
    align-items: center;
    justify-content: center;
    gap: ${isVertical ? "18px" : "20px"};
  }
  .pill {
    position: relative;
    width: ${isVertical ? "82%" : "auto"};
    min-width: ${isVertical ? "0" : "290px"};
    padding: 20px 30px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #fff;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: 0.4px;
    background: rgba(255, 255, 255, 0.11);
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    opacity: 0;
    transform: scale(0.5);
  }
  .pill svg { width: 38px; height: 38px; flex-shrink: 0; }
  .pill.sub {
    background: linear-gradient(135deg, #EF4444, #DC2626);
    border-color: rgba(255, 160, 160, 0.45);
  }
  .pill.sub.done {
    background: linear-gradient(135deg, #1E293B, #0F172A);
    border-color: rgba(250, 204, 21, 0.7);
    color: #FDE047;
  }
  .pill.like.active {
    background: linear-gradient(135deg, #0EA5E9, #0284C7);
    border-color: rgba(125, 211, 252, 0.85);
    box-shadow: 0 0 32px rgba(56, 189, 248, 0.45);
  }
  .pill.comment.active {
    background: linear-gradient(135deg, #F59E0B, #D97706);
    border-color: rgba(253, 224, 71, 0.85);
    box-shadow: 0 0 32px rgba(245, 158, 11, 0.45);
  }
  .ripple {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 4px solid rgba(255, 255, 255, 0.9);
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 0;
    pointer-events: none;
  }
  .dots { display: inline-flex; gap: 5px; margin-left: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; opacity: 0.35; }
</style>
</head>
<body>
  <div class="stage">
    <div class="dock" id="dock">
      <div class="header" id="hdr">${opts.headerText}</div>
      <div class="row">
        <div class="pill like" id="pLike">
          <svg id="icoLike" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
          <span>${opts.likeText}</span>
          <div class="ripple" id="rLike"></div>
        </div>
        <div class="pill comment" id="pComment">
          <svg id="icoComment" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-3H6V7h12v2z"/></svg>
          <span>${opts.commentText}</span>
          <span class="dots" id="cDots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
          <div class="ripple" id="rComment"></div>
        </div>
        <div class="pill sub" id="pSub">
          <svg id="icoBell" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
          <span id="subLabel">${opts.subscribeText}</span>
          <div class="ripple" id="rSub"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const spring = (t) => {
      const x = clamp(t);
      if (x === 0) return 0;
      if (x === 1) return 1;
      return 1 - Math.pow(2, -10 * x) * Math.cos((x * 10 - 0.75) * ((2 * Math.PI) / 3));
    };
    const setPop = (el, t, start) => {
      const p = clamp((t - start) / 0.45);
      const s = 0.55 + 0.45 * spring(p);
      el.style.opacity = clamp(p * 3).toFixed(3);
      el.style.transform = "scale(" + s.toFixed(4) + ")";
    };
    const setTap = (pill, ripple, t, tapAt) => {
      const dt = t - tapAt;
      if (dt < 0) return false;
      if (dt < 0.28) {
        const p = dt / 0.28;
        const press = 1 - 0.08 * Math.sin(p * Math.PI);
        pill.style.transform = "scale(" + press.toFixed(4) + ")";
      }
      if (dt < 0.55) {
        const rp = dt / 0.55;
        ripple.style.opacity = (1 - rp).toFixed(3);
        ripple.style.transform = "translate(-50%, -50%) scale(" + (0.3 + rp * 3.8).toFixed(3) + ")";
      } else {
        ripple.style.opacity = "0";
      }
      return dt >= 0.12;
    };

    window.__setTime = (t, total) => {
      const dock = document.getElementById("dock");
      const fadeIn = clamp(t / 0.35);
      const fadeOut = clamp((total - t) / 0.35);
      dock.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);

      const pLike = document.getElementById("pLike");
      const pComment = document.getElementById("pComment");
      const pSub = document.getElementById("pSub");

      setPop(pLike, t, 0.12);
      setPop(pComment, t, 0.36);
      setPop(pSub, t, 0.60);

      const liked = setTap(pLike, document.getElementById("rLike"), t, 1.05);
      pLike.classList.toggle("active", liked);
      if (liked) {
        const w = Math.sin(Math.min(1, (t - 1.17) / 0.35) * Math.PI) * -14;
        document.getElementById("icoLike").style.transform = "rotate(" + w.toFixed(1) + "deg) scale(" + (1 + 0.15 * Math.sin(Math.min(1, (t - 1.17) / 0.35) * Math.PI)).toFixed(3) + ")";
      }

      const commented = setTap(pComment, document.getElementById("rComment"), t, 1.55);
      pComment.classList.toggle("active", commented);
      const dots = document.querySelectorAll("#cDots .dot");
      dots.forEach((d, idx) => {
        const pulse = commented ? (0.4 + 0.6 * Math.abs(Math.sin((t * 6) - idx * 0.9))) : 0.35;
        d.style.opacity = pulse.toFixed(2);
      });

      const subbed = setTap(pSub, document.getElementById("rSub"), t, 2.05);
      pSub.classList.toggle("done", subbed);
      document.getElementById("subLabel").textContent = subbed ? ${JSON.stringify(opts.subscribedText)} : ${JSON.stringify(opts.subscribeText)};
      if (subbed) {
        const dt = t - 2.17;
        const ring = dt < 0.7 ? Math.sin(dt * 32) * 18 * (1 - dt / 0.7) : 0;
        document.getElementById("icoBell").style.transform = "rotate(" + ring.toFixed(1) + "deg)";
      }
    };
  </script>
</body>
</html>`;
}

/**
 * Renders a transparent QuickTime/VP9-alpha MOV (PNG codec in RGBA) of animated Like/Comment/Subscribe badges.
 */
export async function renderCtaOverlayVideo(args: {
  width: number;
  height: number;
  fps: number;
  ffmpegPath?: string;
  options?: CtaOverlayOptions;
}): Promise<{ movPath: string; duration: number; cleanup: () => void }> {
  const opts: Required<CtaOverlayOptions> = {
    duration: args.options?.duration ?? 3.2,
    likeText: args.options?.likeText ?? "Beğen",
    commentText: args.options?.commentText ?? "Yorum Yap",
    subscribeText: args.options?.subscribeText ?? "Abone Ol",
    subscribedText: args.options?.subscribedText ?? "Abone Olundu",
    headerText: args.options?.headerText ?? "Maceraya Katıl",
    yPercent: args.options?.yPercent ?? (args.height > args.width ? 63 : 72),
  };

  const workDir = mkdtempSync(join(tmpdir(), "flow-cta-"));
  mkdirSync(workDir, { recursive: true });
  const movPath = join(workDir, "cta_overlay.mov");
  const totalFrames = Math.max(12, Math.round(opts.duration * args.fps));

  const browser = await chromium.launch({
    executablePath: chromeExecutable(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const context = await browser.newContext({ viewport: { width: args.width, height: args.height } });
    const page = await context.newPage();
    await page.setContent(buildCtaHtml(args.width, args.height, opts), { waitUntil: "load" });

    const ff = spawn(
      args.ffmpegPath ?? "ffmpeg",
      ["-y", "-v", "error", "-f", "image2pipe", "-vcodec", "png", "-r", String(args.fps), "-i", "-", "-c:v", "png", "-pix_fmt", "rgba", movPath],
      { stdio: ["pipe", "ignore", "pipe"] },
    );

    let errText = "";
    ff.stderr.on("data", (d: Buffer) => {
      errText += d.toString();
    });

    const ffDone = new Promise<void>((ok, fail) => {
      ff.on("error", fail);
      ff.on("close", (code) => (code === 0 ? ok() : fail(new Error(`CTA overlay ffmpeg failed (${code}): ${errText}`))));
    });

    for (let i = 0; i < totalFrames; i++) {
      const t = (i / totalFrames) * opts.duration;
      await page.evaluate(([sec, total]) => (window as unknown as { __setTime: (a: number, b: number) => void }).__setTime(sec, total), [
        t,
        opts.duration,
      ]);
      const buf = await page.screenshot({ type: "png", omitBackground: true });
      if (!ff.stdin.write(buf)) {
        await new Promise<void>((r) => ff.stdin.once("drain", r));
      }
    }
    ff.stdin.end();
    await ffDone;
  } finally {
    await browser.close().catch(() => {});
  }

  return {
    movPath,
    duration: opts.duration,
    cleanup: () => rmSync(workDir, { recursive: true, force: true }),
  };
}
