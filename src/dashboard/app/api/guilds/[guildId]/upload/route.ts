/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';
import { rateLimit, clientIp } from '@/lib/rateLimit';

const MAX_INLINE_BYTES = 500 * 1024;

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  if (!rateLimit(`write:${clientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  try {
    const { guildId } = params;
    if (!/^\d{5,25}$/.test(guildId)) {
      return NextResponse.json({ error: 'Invalid guild id' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const target = formData.get('target') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    if (!allowedTypes[file.type]) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP' }, { status: 400 });
    }

    if (file.size >= MAX_INLINE_BYTES) {
      return NextResponse.json({
        error: 'Images over 500KB cannot be embedded directly. Use a smaller image or paste an external image URL instead.'
      }, { status: 400 });
    }

    const safeTarget = String(target || 'file').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'file';
    const ext = allowedTypes[file.type];

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength >= MAX_INLINE_BYTES) {
      return NextResponse.json({
        error: 'Images over 500KB cannot be embedded directly. Use a smaller image or paste an external image URL instead.'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      url: `data:${file.type};base64,${buffer.toString('base64')}`,
      filename: `${guildId}_${safeTarget}_${Date.now()}.${ext}`,
      size: buffer.byteLength
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
