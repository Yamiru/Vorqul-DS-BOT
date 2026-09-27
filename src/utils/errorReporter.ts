/*!
 * Vorqul DS BOT - Error Reporter
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { logger } from './logger.js';

interface SentryLike {
  captureException: (error: unknown, hint?: any) => void;
  captureMessage: (message: string, hint?: any) => void;
}

let sentry: SentryLike | null = null;
let sentryPending = false;

function initSentry(): void {
  if (sentry || sentryPending) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  sentryPending = true;

  const moduleName = '@sentry/node';
  import(moduleName)
    .then((mod: any) => {
      mod.init({
        dsn,
        environment: process.env.NODE_ENV || 'production',
        release: process.env.SENTRY_RELEASE,
        tracesSampleRate: 0,
      });
      sentry = mod as SentryLike;
      logger.info('Sentry je pripojené.');
    })
    .catch(() => {
      logger.warn(
        'SENTRY_DSN je nastavené, ale @sentry/node sa nedá načítať. ' +
          'Doinštaluj ho cez "npm install @sentry/node", alebo DSN odstráň. ' +
          'Chyby sa zatiaľ hlásia len do konzoly a do súboru.'
      );
    });
}

function toSentry(error: unknown, scope: string, meta?: Record<string, unknown>): void {
  initSentry();
  if (!sentry) return;

  try {
    const hint = { tags: { scope }, extra: meta };
    if (error instanceof Error) sentry.captureException(error, hint);
    else sentry.captureMessage(describe(error), hint);
  } catch (error) {
      logger.debug('errorReporter: suppressed error', error);
    }
}

const EXPECTED_DISCORD_CODES = new Set([
  10003, 10008, 10013, 10062, 40060, 50001, 50007, 50013, 50033,
]);

function discordCode(error: unknown): number | undefined {
  const code = (error as any)?.code;
  return typeof code === 'number' ? code : undefined;
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function reportError(scope: string, error: unknown, meta?: Record<string, unknown>): void {
  const context = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const code = discordCode(error);

  if (code !== undefined && EXPECTED_DISCORD_CODES.has(code)) {
    logger.debug(`[${scope}] Discord odmietol operáciu (${code}): ${describe(error)}${context}`);
    return;
  }

  logger.warn(`[${scope}] ${describe(error)}${context}`);
  toSentry(error, scope, meta);
}

export function reportFatal(scope: string, error: unknown, meta?: Record<string, unknown>): void {
  logger.error(`[${scope}] ${describe(error)}`, error instanceof Error ? error : undefined);
  toSentry(error, scope, meta);
}

export function swallow(scope: string, meta?: Record<string, unknown>) {
  return (error: unknown): void => reportError(scope, error, meta);
}
