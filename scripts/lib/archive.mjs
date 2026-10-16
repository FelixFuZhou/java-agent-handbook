import { deflateRawSync, inflateRawSync } from 'node:zlib';

// 小型静态资源 ZIP：UTF-8 文件名、固定时间与权限、不包含目录扫描或 ZIP64。
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
export function safePath(path) {
  if (typeof path !== 'string' || !/^[a-zA-Z0-9_.\/-]+$/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '..' || p === '.'))
    throw new Error('非法发布文件路径');
  return path;
}
export function createZip(entries) {
  const input = [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (input.length > 65535) throw new Error('ZIP 文件数超过教学资源上限');
  const local = [], central = [], seen = new Set(); let offset = 0;
  for (const [path, value] of input) {
    safePath(path);
    if (seen.has(path)) throw new Error('重复 ZIP 文件路径');
    seen.add(path);
    const name = Buffer.from(path, 'utf8'), raw = Buffer.from(value), data = deflateRawSync(raw, { level: 9 });
    if (raw.length > 32 * 1024 * 1024) throw new Error('单文件超过发布资源上限');
    const crc = crc32(raw), header = Buffer.alloc(30), directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(0x314, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(raw.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, data); central.push(directory, name); offset += header.length + name.length + data.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(input.length, 8); end.writeUInt16LE(input.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
export function readZip(bytes) {
  const zip = Buffer.from(bytes), end = zip.length - 22;
  if (end < 0 || zip.readUInt32LE(end) !== 0x06054b50 || zip.readUInt16LE(end + 20) !== 0) throw new Error('不支持的 ZIP 结构');
  const count = zip.readUInt16LE(end + 10), files = new Map(); let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP 目录损坏');
    const size = zip.readUInt32LE(cursor + 20), rawSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extra = zip.readUInt16LE(cursor + 30), comment = zip.readUInt16LE(cursor + 32);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'); safePath(name);
    const position = zip.readUInt32LE(cursor + 42);
    if (rawSize > 32 * 1024 * 1024 || files.has(name) || position + 30 > zip.length || zip.readUInt32LE(position) !== 0x04034b50) throw new Error('非法 ZIP 条目');
    const start = position + 30 + zip.readUInt16LE(position + 26) + zip.readUInt16LE(position + 28);
    if (start + size > end || zip.readUInt16LE(cursor + 10) !== 8) throw new Error('ZIP 压缩内容损坏');
    const raw = inflateRawSync(zip.subarray(start, start + size), { maxOutputLength: 32 * 1024 * 1024 });
    if (raw.length !== rawSize || crc32(raw) !== zip.readUInt32LE(cursor + 16)) throw new Error('ZIP 校验失败');
    files.set(name, raw); cursor += 46 + nameLength + extra + comment;
  }
  return files;
}
