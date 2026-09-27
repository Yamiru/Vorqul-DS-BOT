/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogOptions {
  level?: LogLevel;
}

class FileSink {
  private readonly dir: string;
  private readonly file: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private ready = false;
  private broken = false;

  constructor() {
    this.dir = process.env.LOG_DIR || path.join(process.env.DATA_PATH || './data', 'logs');
    this.file = path.join(this.dir, 'bot.log');

    const sizeMb = Number.parseFloat(process.env.LOG_MAX_SIZE || '5');
    this.maxBytes = (Number.isFinite(sizeMb) && sizeMb > 0 ? sizeMb : 5) * 1024 * 1024;

    const files = Number.parseInt(process.env.LOG_MAX_FILES || '5', 10);
    this.maxFiles = Number.isFinite(files) && files > 0 ? files : 5;
  }

  private ensureDir(): boolean {
    if (this.ready) return true;
    if (this.broken) return false;
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
      this.ready = true;
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  private rotate(): void {
    try {
      if (!fs.existsSync(this.file)) return;
      if (fs.statSync(this.file).size < this.maxBytes) return;

      const oldest = `${this.file}.${this.maxFiles}`;
      if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

      for (let index = this.maxFiles - 1; index >= 1; index--) {
        const from = `${this.file}.${index}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${this.file}.${index + 1}`);
      }
      fs.renameSync(this.file, `${this.file}.1`);
    } catch {
      this.broken = true;
    }
  }

  write(line: string): void {
    if (!this.ensureDir()) return;
    try {
      this.rotate();
      fs.appendFileSync(this.file, `${line}\n`, 'utf-8');
    } catch {
      this.broken = true;
    }
  }
}

function serialize(value: unknown): string {
  if (value === undefined) return '';
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

class Logger {
  private level: LogLevel;
  private sink?: FileSink;

  constructor(options: LogOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    if (String(process.env.LOG_TO_FILE || '').toLowerCase() === 'true') {
      this.sink = new FileSink();
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private toFile(level: string, message: string, extras: unknown[]): void {
    if (!this.sink) return;
    const parts = extras.map(serialize).filter(Boolean);
    this.sink.write(this.formatMessage(level, message) + (parts.length ? ` ${parts.join(' ')}` : ''));
  }


  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
      this.toFile('DEBUG', message, args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), ...args);
      this.toFile('INFO', message, args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
      this.toFile('WARN', message, args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message), error, ...args);
      this.toFile('ERROR', message, [error, ...args]);
    }
  }
}

export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
});

export default Logger;
