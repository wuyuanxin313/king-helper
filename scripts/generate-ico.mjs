import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pngPath = path.join(root, 'public', 'ip-pictures', 'default.png')
const buildDir = path.join(root, 'build')
const outIco = path.join(buildDir, 'icon.ico')
const outFavicon = path.join(root, 'public', 'favicon.ico')

if (!fs.existsSync(pngPath)) {
  throw new Error(`Missing PNG: ${pngPath}`)
}

const png = fs.readFileSync(pngPath)

const headerSize = 6
const entrySize = 16
const imageOffset = headerSize + entrySize

const buf = Buffer.alloc(imageOffset)
buf.writeUInt16LE(0, 0)
buf.writeUInt16LE(1, 2)
buf.writeUInt16LE(1, 4)

buf.writeUInt8(0, 6)
buf.writeUInt8(0, 7)
buf.writeUInt8(0, 8)
buf.writeUInt8(0, 9)
buf.writeUInt16LE(1, 10)
buf.writeUInt16LE(32, 12)
buf.writeUInt32LE(png.length, 14)
buf.writeUInt32LE(imageOffset, 18)

fs.mkdirSync(buildDir, { recursive: true })
fs.writeFileSync(outIco, Buffer.concat([buf, png]))
fs.writeFileSync(outFavicon, Buffer.concat([buf, png]))
