/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import zlib from 'zlib';

export class ZipError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  crc: number;
  offset: number;
  isDirectory: boolean;
}

export interface ZipLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

let crcTable: Uint32Array | null = null;

export function crc32(data: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function readZip(buffer: Buffer, limits: ZipLimits): ZipEntry[] {
  if (buffer.length < 22) throw new ZipError('not_zip');

  let eocd = -1;
  const floor = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('not_zip');

  const disk = buffer.readUInt16LE(eocd + 4);
  const total = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || total === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new ZipError('unsupported', 'multi-disk and zip64 archives are not supported');
  }
  if (total > limits.maxFiles) throw new ZipError('too_many_files');
  if (centralOffset + centralSize > buffer.length) throw new ZipError('not_zip');

  const entries: ZipEntry[] = [];
  let pos = centralOffset;
  let totalBytes = 0;

  for (let i = 0; i < total; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE) throw new ZipError('not_zip');

    const madeBy = buffer.readUInt16LE(pos + 4);
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const crc = buffer.readUInt32LE(pos + 16);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const externalAttributes = buffer.readUInt32LE(pos + 38);
    const offset = buffer.readUInt32LE(pos + 42);
    if (pos + 46 + nameLength > buffer.length) throw new ZipError('not_zip');
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
    pos += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw new ZipError('encrypted');
    if (method !== 0 && method !== 8) throw new ZipError('unsupported', `compression method ${method}`);
    if (compressedSize === 0xffffffff || size === 0xffffffff) throw new ZipError('unsupported', 'zip64');
    if (madeBy >> 8 === 3 && ((externalAttributes >>> 16) & 0xf000) === 0xa000) throw new ZipError('symlink');

    const isDirectory = name.endsWith('/');
    if (!isDirectory) {
      if (size > limits.maxFileBytes) throw new ZipError('file_too_large');
      totalBytes += size;
      if (totalBytes > limits.maxTotalBytes) throw new ZipError('too_large');
    }
    entries.push({ name, method, compressedSize, size, crc, offset, isDirectory });
  }
  return entries;
}

export function extractEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const at = entry.offset;
  if (at + 30 > buffer.length || buffer.readUInt32LE(at) !== LOCAL_SIGNATURE) throw new ZipError('not_zip');
  const start = at + 30 + buffer.readUInt16LE(at + 26) + buffer.readUInt16LE(at + 28);
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new ZipError('not_zip');

  const raw = buffer.subarray(start, end);
  let data: Buffer;
  if (entry.method === 0) {
    if (raw.length !== entry.size) throw new ZipError('corrupt');
    data = Buffer.from(raw);
  } else {
    try {
      data = zlib.inflateRawSync(raw, { maxOutputLength: entry.size + 1 });
    } catch {
      throw new ZipError('corrupt');
    }
  }
  if (data.length !== entry.size || crc32(data) !== entry.crc) throw new ZipError('corrupt');
  return data;
}
