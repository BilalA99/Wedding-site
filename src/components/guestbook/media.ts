"use client";

/** Client-side media inspection + thumbnail generation. All best-effort:
 * when a browser can't decode a format (e.g. HEIC in Chrome) we upload the
 * original anyway and let the admin gallery fall back to a placeholder. */

const THUMB_MAX_WIDTH = 640;

/** Reads a video's duration from its metadata without playing it. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const cleanup = (value: number | null) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const timer = setTimeout(() => cleanup(null), 10_000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = video.duration;
      cleanup(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      cleanup(null);
    };
    video.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const attempt = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), type, quality),
    );
  const webp = await attempt("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  return attempt("image/jpeg", 0.82);
}

function drawScaled(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const scale = Math.min(1, THUMB_MAX_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Grabs a frame ~1.5s in (or mid-clip for very short videos). */
export function makeVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 15_000);

    video.onloadedmetadata = () => {
      const target =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(1.5, video.duration / 2)
          : 0;
      video.currentTime = target;
    };
    video.onseeked = async () => {
      clearTimeout(timer);
      try {
        if (!video.videoWidth) return finish(null);
        const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
        finish(await canvasToBlob(canvas));
      } catch {
        finish(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    video.src = url;
  });
}

/** Downscales a photo for the admin gallery. */
export async function makePhotoThumbnail(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = drawScaled(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return await canvasToBlob(canvas);
  } catch {
    // Fall back to <img> decode (covers HEIC on Safari).
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const finish = async (ok: boolean) => {
        const blob =
          ok && img.naturalWidth
            ? await canvasToBlob(
                drawScaled(img, img.naturalWidth, img.naturalHeight),
              )
            : null;
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = url;
    });
  }
}
