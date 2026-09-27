import { logger } from './logger.js';

export interface WelcomeCardOptions {
  avatarUrl: string;
  title: string;
  subtitle: string;
  backgroundUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

let canvasMod: any = null;
let canvasUnavailable = false;

async function getCanvas(): Promise<any | null> {
  if (canvasMod) return canvasMod;
  if (canvasUnavailable) return null;
  try {
    const moduleName = '@napi-rs/canvas';
    canvasMod = await import(moduleName);
    return canvasMod;
  } catch {
    canvasUnavailable = true;
    logger.warn('Welcome karta vypnutá - balík @napi-rs/canvas nie je nainštalovaný (npm i @napi-rs/canvas).');
    return null;
  }
}

function roundedClip(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const IMAGE_LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Image load timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function fitText(ctx: any, text: string, maxWidth: number, baseSize: number, font: string): number {
  let size = baseSize;
  do {
    ctx.font = `${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 16);
  return size;
}

export async function generateWelcomeCard(opts: WelcomeCardOptions): Promise<Buffer | null> {
  const canvas = await getCanvas();
  if (!canvas) return null;

  const { createCanvas, loadImage } = canvas;

  const W = 1024;
  const H = 320;
  const accent = opts.accentColor || '#5865f2';
  const textColor = opts.textColor || '#ffffff';
  const bgColor = opts.backgroundColor || '#1e1f22';

  try {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    if (opts.backgroundUrl) {
      try {
        const bg = await withTimeout<any>(loadImage(opts.backgroundUrl), IMAGE_LOAD_TIMEOUT_MS);

        const ratio = Math.max(W / bg.width, H / bg.height);
        const bw = bg.width * ratio;
        const bh = bg.height * ratio;
        ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
      } catch {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0.35)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    const avatarSize = 150;
    const ax = W / 2 - avatarSize / 2;
    const ay = 36;

    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, ay + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    try {
      const avatar = await withTimeout<any>(loadImage(opts.avatarUrl), IMAGE_LOAD_TIMEOUT_MS);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
      ctx.restore();
    } catch (error) {
        logger.debug('welcomeCard: suppressed error', error);
      }

    ctx.textAlign = 'center';
    ctx.fillStyle = textColor;

    const titleSize = fitText(ctx, opts.title, W - 80, 48, 'sans-serif');
    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(opts.title, W / 2, ay + avatarSize + 60);

    const subSize = fitText(ctx, opts.subtitle, W - 120, 28, 'sans-serif');
    ctx.font = `${subSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(opts.subtitle, W / 2, ay + avatarSize + 60 + subSize + 16);
    ctx.shadowBlur = 0;

    roundedClip(ctx, 0, H - 6, W, 6, 0);
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - 6, W, 6);

    return c.toBuffer('image/png');
  } catch (err) {
    logger.error('Generovanie welcome karty zlyhalo:', err as Error);
    return null;
  }
}
