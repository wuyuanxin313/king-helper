const fs = require('fs');
const path = require('path');

function readPngSize(buf) {
  // PNG signature (8 bytes) + IHDR chunk: length(4) + "IHDR"(4) + width(4) + height(4)
  const sig = buf.slice(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error('不是PNG文件');
  const ihdr = buf.indexOf(Buffer.from('IHDR'));
  if (ihdr < 0) throw new Error('未找到IHDR');
  const width = buf.readUInt32BE(ihdr + 4);
  const height = buf.readUInt32BE(ihdr + 8);
  return { width, height };
}

function createIcoFromPng(pngBuf) {
  const size = pngBuf.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count: 1

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 -> 0
  entry[1] = 0; // height 256 -> 0
  entry[2] = 0; // color count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bitcount
  entry.writeUInt32LE(size, 8); // bytes in resource
  entry.writeUInt32LE(6 + 16, 12); // image offset

  return Buffer.concat([header, entry, pngBuf]);
}

const srcPngPath = path.join(__dirname, '..', 'public', 'icon.png');
const outIcoPath = path.join(__dirname, '..', 'public', 'icon.ico');
if (!fs.existsSync(srcPngPath)) {
  console.error('未找到 public/icon.png。请将源图片保存为 public/icon.png');
  process.exit(1);
}
const pngBuf = fs.readFileSync(srcPngPath);
const { width, height } = readPngSize(pngBuf);
if (width !== 256 || height !== 256) {
  console.error(`当前PNG尺寸为 ${width}x${height}，需要 256x256。请先将图片缩放到 256x256 后再生成ICO。`);
  process.exit(2);
}
const icoBuf = createIcoFromPng(pngBuf);
fs.writeFileSync(outIcoPath, icoBuf);
console.log('已生成 public/icon.ico (包含256×256 PNG图层)');
