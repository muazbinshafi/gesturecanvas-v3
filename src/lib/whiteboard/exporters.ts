/**
 * SVG and PDF exporters for the whiteboard.
 */
import jsPDF from "jspdf";
import { getStroke } from "perfect-freehand";
import type { BoardObject, BoardData, Point } from "./types";

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function strokePathD(points: Point[], size: number): string {
  if (points.length < 2) return "";
  const stroke = getStroke(points.map((p) => [p.x, p.y, p.p ?? 0.5]), { size: size * 2.2, thinning: 0.5, smoothing: 0.6, streamline: 0.5 });
  if (!stroke.length) return "";
  let d = `M ${stroke[0][0].toFixed(2)} ${stroke[0][1].toFixed(2)}`;
  for (let i = 1; i < stroke.length; i++) d += ` L ${stroke[i][0].toFixed(2)} ${stroke[i][1].toFixed(2)}`;
  return d + " Z";
}

export function boardToSVG(board: BoardData, background: string): string {
  const w = board.width, h = board.height;
  const items: string[] = [];
  items.push(`<rect width="${w}" height="${h}" fill="${background}"/>`);
  for (const o of board.objects) {
    if (o.type === "stroke") {
      const d = strokePathD(o.points, o.size);
      if (d) items.push(`<path d="${d}" fill="${o.color}"/>`);
    } else if (o.type === "rect") {
      const x = Math.min(o.x, o.x + o.w), y = Math.min(o.y, o.y + o.h);
      items.push(`<rect x="${x}" y="${y}" width="${Math.abs(o.w)}" height="${Math.abs(o.h)}" fill="none" stroke="${o.color}" stroke-width="${Math.max(2, o.size)}"/>`);
    } else if (o.type === "circle") {
      items.push(`<ellipse cx="${o.x + o.w / 2}" cy="${o.y + o.h / 2}" rx="${Math.abs(o.w) / 2}" ry="${Math.abs(o.h) / 2}" fill="none" stroke="${o.color}" stroke-width="${Math.max(2, o.size)}"/>`);
    } else if (o.type === "arrow") {
      const x2 = o.x + o.w, y2 = o.y + o.h;
      items.push(`<line x1="${o.x}" y1="${o.y}" x2="${x2}" y2="${y2}" stroke="${o.color}" stroke-width="${Math.max(2, o.size)}" stroke-linecap="round"/>`);
      const ang = Math.atan2(o.h, o.w); const head = Math.max(10, o.size * 3);
      const ax1 = x2 - head * Math.cos(ang - Math.PI / 6), ay1 = y2 - head * Math.sin(ang - Math.PI / 6);
      const ax2 = x2 - head * Math.cos(ang + Math.PI / 6), ay2 = y2 - head * Math.sin(ang + Math.PI / 6);
      items.push(`<line x1="${x2}" y1="${y2}" x2="${ax1}" y2="${ay1}" stroke="${o.color}" stroke-width="${Math.max(2, o.size)}" stroke-linecap="round"/>`);
      items.push(`<line x1="${x2}" y1="${y2}" x2="${ax2}" y2="${ay2}" stroke="${o.color}" stroke-width="${Math.max(2, o.size)}" stroke-linecap="round"/>`);
    } else if (o.type === "text") {
      items.push(`<text x="${o.x}" y="${o.y + o.size}" fill="${o.color}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${o.size}">${escapeXml(o.text)}</text>`);
    } else if (o.type === "sticky") {
      items.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.bg}" stroke="rgba(0,0,0,0.2)"/>`);
      items.push(`<text x="${o.x + 10}" y="${o.y + 22}" fill="#1f2937" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14">${escapeXml(o.text)}</text>`);
    } else if (o.type === "image") {
      items.push(`<image x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" href="${o.src}"/>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${items.join("")}</svg>`;
}

export async function boardToPDF(board: BoardData, background: string, pngBlob: Blob | null): Promise<Blob> {
  const w = board.width, h = board.height;
  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
  if (pngBlob) {
    const dataUrl = await blobToDataURL(pngBlob);
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
  } else {
    pdf.setFillColor(background);
    pdf.rect(0, 0, w, h, "F");
  }
  return pdf.output("blob");
}

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

// Convenience for downloading objects as files in the browser.
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
