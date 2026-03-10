const fs = require('fs');
const path = require('path');

function readU16LE(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}

function validateIco(icoPath) {
  const buf = fs.readFileSync(icoPath);
  if (buf.length < 6) {
    return { ok: false, reason: '文件过小' };
  }
  const reserved = readU16LE(buf, 0);
  const type = readU16LE(buf, 2);
  const count = readU16LE(buf, 4);
  if (reserved !== 0 || type !== 1 || count < 1) {
    return { ok: false, reason: `头部不符合规范(reserved=${reserved}, type=${type}, count=${count})` };
  }
  const entries = [];
  let has256 = false;
  let hasPNG = false;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const widthByte = buf[off];
    const heightByte = buf[off + 1];
    const width = widthByte === 0 ? 256 : widthByte;
    const height = heightByte === 0 ? 256 : heightByte;
    const size = buf.readUInt32LE(off + 8);
    const imgOffset = buf.readUInt32LE(off + 12);
    entries.push({ width, height, size, imgOffset });
    if (width === 256 && height === 256) has256 = true;
    // PNG 以 8 字节签名开头
    if (buf.slice(imgOffset, imgOffset + 8).toString('hex') === '89504e470d0a1a0a') {
      hasPNG = true;
    }
  }
  return { ok: true, has256, hasPNG, count, entries };
}

const icoPath = path.join(__dirname, '..', 'public', 'icon.ico');
if (!fs.existsSync(icoPath)) {
  console.error('未找到 public/icon.ico');
  process.exit(1);
}
const result = validateIco(icoPath);
if (!result.ok) {
  console.error(`校验失败：${result.reason}`);
  process.exit(2);
}
console.log(`ICON校验通过：共 ${result.count} 个图层`);
console.log(`是否包含256×256：${result.has256 ? '是' : '否'}`);
console.log(`是否为PNG压缩：${result.hasPNG ? '是(至少一个)' : '否(可能为BMP)'}`);
if (!result.has256) {
  console.warn('提示：建议包含 256×256 图层以确保安装包和窗口图标清晰');
}
if (!result.hasPNG) {
  console.warn('提示：建议使用 PNG 压缩的 ICO 减少体积并提升兼容性');
}
