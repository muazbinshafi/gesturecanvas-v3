/**
 * Recording mode — mixes the canvas video stream with the camera audio (if any)
 * and records to a webm file via MediaRecorder.
 */
export interface Recorder {
  stop: () => Promise<Blob>;
  getMimeType: () => string;
}

export function startRecording(opts: { canvas: HTMLCanvasElement; cameraStream?: MediaStream | null; fps?: number }): Recorder {
  const { canvas, cameraStream, fps = 30 } = opts;
  const canvasStream = canvas.captureStream(fps);
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (cameraStream) {
    cameraStream.getAudioTracks().forEach((t) => tracks.push(t));
  }
  const merged = new MediaStream(tracks);

  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  let mime = "";
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) { mime = c; break; }
  }
  const rec = new MediaRecorder(merged, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.start(250);

  return {
    getMimeType: () => mime || "video/webm",
    stop: () => new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        canvasStream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: mime || "video/webm" }));
      };
      rec.stop();
    }),
  };
}

export async function requestPiP(video: HTMLVideoElement): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = video as any;
  if (typeof v.requestPictureInPicture === "function") {
    try { await v.requestPictureInPicture(); return true; } catch { return false; }
  }
  return false;
}
