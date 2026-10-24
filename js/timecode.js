// Timecode-rekenen (SMPTE), inclusief drop-frame voor 29,97 en 59,94.

export const FPS = [['23.976', '23,976'], ['24', '24'], ['25', '25 (PAL)'], ['29.97', '29,97 NDF'], ['29.97df', '29,97 DF'], ['30', '30'], ['48', '48'], ['50', '50'], ['59.94df', '59,94 DF'], ['60', '60']];

const base = (fps) => Math.round(parseFloat(fps));
const isDF = (fps) => String(fps).endsWith('df');

export function tcToFrames(tc, fps = '24') {
  const parts = String(tc || '').trim().split(/[:;.]/).map((x) => parseInt(x, 10) || 0);
  while (parts.length < 4) parts.unshift(0);
  const [hh, mm, ss, ff] = parts.slice(-4);
  const nb = base(fps);
  let frames = ((hh * 60 + mm) * 60 + ss) * nb + ff;
  if (isDF(fps)) {
    const drop = nb === 60 ? 4 : 2;
    const totalMin = hh * 60 + mm;
    frames -= drop * (totalMin - Math.floor(totalMin / 10));
  }
  return frames;
}

export function framesToTc(frames, fps = '24') {
  const nb = base(fps);
  let f = Math.round(Math.abs(frames));
  const neg = frames < 0;
  if (isDF(fps)) {
    const drop = nb === 60 ? 4 : 2;
    const per10 = nb * 600 - drop * 9;
    const per1 = nb * 60 - drop;
    const d = Math.floor(f / per10), m = f % per10;
    f += drop * 9 * d + (m > drop ? drop * Math.floor((m - drop) / per1) : 0);
  }
  const ff = f % nb, s = Math.floor(f / nb), ss = s % 60, mm = Math.floor(s / 60) % 60, hh = Math.floor(s / 3600);
  const p = (n) => String(n).padStart(2, '0');
  return `${neg ? '-' : ''}${p(hh)}:${p(mm)}:${p(ss)}${isDF(fps) ? ';' : ':'}${p(ff)}`;
}

/** Werkelijke seconden (houdt rekening met 1000/1001-snelheden). */
export const framesToSeconds = (frames, fps = '24') => frames / (parseFloat(fps) || 24);
