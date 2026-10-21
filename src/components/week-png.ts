import type { WeekExport } from "../schedule/export";

export interface PngLabels {
  open: string;
  closed: string;
  covered: string;
  overQuota: string;
  legend: string;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
const MARGIN = 16;
const SHIFT_WIDTH = 168;
const DAY_WIDTH = 196;
const HEAD_HEIGHT = 94;
const PLAIN_HEAD_HEIGHT = 64;
const LINE = 28;
const RED = "#b91c1c";
/** A little more saturated than the light weekly board, and well short of a strong tint. */
const SHIFT_FILL = { m: "#ffebcd", a: "#d9e8ff", n: "#e8deff" } as const;
const SHIFT_CLOSED = { m: "#fff3e4", a: "#e8f0ff", n: "#f0ebff" } as const;

function rowHeight(row: WeekExport["rows"][number]): number {
  const lines = Math.max(2, ...row.cells.map((cell) => cell.people.reduce((sum, person) => sum + (person.hours ? 2 : 1), 0) + (cell.covered ? 1 : 0) + (cell.open ? 1 : 0)));
  return lines * LINE + 16;
}

/** Draws the published week onto a canvas. Columns run right to left in Hebrew. */
export function drawWeek(data: WeekExport, labels: PngLabels, scale = 2): HTMLCanvasElement {
  const width = MARGIN * 2 + SHIFT_WIDTH + DAY_WIDTH * data.days.length;
  const hebrew = Boolean(data.hebrewSubtitle);
  const tableTop = MARGIN + (hebrew ? 80 : 58);
  const headHeight = hebrew ? HEAD_HEIGHT : PLAIN_HEAD_HEIGHT;
  const heights = data.rows.map(rowHeight);
  const height = tableTop + headHeight + heights.reduce((sum, value) => sum + value, 0) + MARGIN;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.direction = data.dir;
  const rtl = data.dir === "rtl";
  const left = (offset: number, size: number) => (rtl ? width - MARGIN - offset - size : MARGIN + offset);
  const startX = rtl ? width - MARGIN : MARGIN;

  ctx.fillStyle = "#f7f4ee";
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1c1917";
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(data.title, startX, MARGIN + 26);
  ctx.fillStyle = "#57534e";
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText(data.subtitle, startX, MARGIN + 48);
  ctx.fillStyle = "#78716c";
  ctx.font = `400 14px ${FONT}`;
  ctx.fillText(data.hebrewSubtitle, startX, MARGIN + 68);

  const fit = (text: string, room: number) => {
    if (ctx.measureText(text).width <= room) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > room) cut = cut.slice(0, -1);
    return `${cut}…`;
  };

  const columns = [{ offset: 0, size: SHIFT_WIDTH }, ...data.days.map((_, index) => ({ offset: SHIFT_WIDTH + DAY_WIDTH * index, size: DAY_WIDTH }))];
  const cell = (column: number, top: number, rowSize: number, fill: string) => {
    const x = left(columns[column].offset, columns[column].size);
    ctx.fillStyle = fill;
    ctx.fillRect(x, top, columns[column].size, rowSize);
    ctx.strokeStyle = "#e4ddd0";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, columns[column].size - 1, rowSize - 1);
    return x + columns[column].size / 2;
  };

  ctx.textAlign = "center";
  data.days.forEach((day, index) => {
    const center = cell(index + 1, tableTop, headHeight, "#ffffff");
    ctx.fillStyle = "#1c1917";
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(day.name, center, tableTop + 26);
    ctx.fillStyle = "#57534e";
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText(day.date, center, tableTop + 46);
    ctx.fillStyle = "#78716c";
    ctx.font = `400 13px ${FONT}`;
    ctx.fillText(day.hebrew, center, tableTop + 64);
    if (day.holidays.length) {
      ctx.fillStyle = "#6d28d9";
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText(fit(day.holidays.join(" · "), DAY_WIDTH - 16), center, tableTop + 83);
    }
  });
  cell(0, tableTop, headHeight, "#ffffff");

  let top = tableTop + headHeight;
  data.rows.forEach((row, rowIndex) => {
    const size = heights[rowIndex];
    const center = cell(0, top, size, SHIFT_FILL[row.kind]);
    ctx.fillStyle = "#1c1917";
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(row.shift, center, top + 30);
    ctx.fillStyle = "#44403c";
    ctx.font = `400 15px ${FONT}`;
    ctx.save();
    ctx.direction = "ltr";
    ctx.fillText(row.hours, center, top + 52);
    ctx.restore();

    row.cells.forEach((item, day) => {
      const fill = item.closed ? SHIFT_CLOSED[row.kind] : item.open ? "#fecaca" : SHIFT_FILL[row.kind];
      const middle = cell(day + 1, top, size, fill);
      let y = top + 30;
      if (item.closed) {
        ctx.fillStyle = "#78716c";
        ctx.font = `400 16px ${FONT}`;
        ctx.fillText(labels.closed, middle, y);
        return;
      }
      for (const person of item.people) {
        ctx.fillStyle = person.hours ? RED : "#1c1917";
        ctx.font = `${person.hours ? 600 : 500} 18px ${FONT}`;
        ctx.fillText(person.over ? `${person.name} · ${labels.overQuota}` : person.name, middle, y);
        y += LINE;
        if (person.hours) {
          ctx.font = `400 15px ${FONT}`;
          ctx.save();
          ctx.direction = "ltr";
          ctx.fillText(person.hours, middle, y);
          ctx.restore();
          y += LINE;
        }
      }
      if (item.covered) {
        ctx.fillStyle = "#115e59";
        ctx.font = `500 16px ${FONT}`;
        ctx.fillText(labels.covered, middle, y);
        y += LINE;
      }
      if (item.open) {
        ctx.fillStyle = RED;
        ctx.font = `700 16px ${FONT}`;
        ctx.fillText(`${labels.open} ${item.open}`, middle, y);
      }
    });
    top += size;
  });

  return canvas;
}

export function downloadWeekPng(data: WeekExport, labels: PngLabels, fileName: string): void {
  drawWeek(data, labels).toBlob((blob) => {
    if (blob) downloadBlob(blob, fileName);
  }, "image/png");
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
