import { Context, Logger, Schema, Service } from 'koishi'
import type skia from '@ltxhhz/skia-canvas-for-koishi'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import tar from 'tar'
import superagent from 'superagent'
export type * from '@ltxhhz/skia-canvas-for-koishi'

export const name = 'skia-canvas'

export interface Config {
  nodeBinaryPath?: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    nodeBinaryPath: Schema.path({
      filters: ['directory'],
      allowCreate: true
    })
      .description('Canvas binary file storage directory')
      .default('data/assets/canvas')
  }).i18n({
    zh: {
      nodeBinaryPath: 'Canvas 文件存放目录'
    }
  })
])

const skiaVersion = '1.0.1',
  napiLabel = 'napi-v6'

declare module 'koishi' {
  interface Context {
    skia: Skia
  }
}

export class Skia extends Service {
  Canvas: typeof skia.Canvas
  loadImage: typeof skia.loadImage
  FontLibrary: typeof skia.FontLibrary
  Path2D: typeof skia.Path2D
  Image: typeof skia.Image
  ImageData: typeof skia.ImageData
  CanvasGradient: typeof skia.CanvasGradient
  CanvasPattern: typeof skia.CanvasPattern
  CanvasTexture: typeof skia.CanvasTexture
  App: typeof skia.App
  DOMMatrix: typeof skia.DOMMatrix
  DOMPoint: typeof skia.DOMPoint
  DOMRect: typeof skia.DOMRect
  Window: typeof skia.Window

  logger: Logger

  constructor(ctx: Context, public config: Config) {
    super(ctx, 'skia')
    this.logger = ctx.logger('skia')
  }

  protected override async start() {
    const { nodeBinaryPath = 'data/assets/canvas' } = this.config
    const nodeDir = path.resolve(this.ctx.baseDir, nodeBinaryPath)

    fs.mkdirSync(nodeDir, { recursive: true })
    const s = await this.getNativeBinding(nodeDir)
    for (const key in s) {
      if (Object.hasOwn(s, key)) {
        this[key] = s[key]
      }
    }
  }

  private async getNativeBinding(nodeDir: string) {
    const { platform, arch } = process
    let nativeBinding: any
    let nodeName: string

    const platformArchMap = {
      win32: {
        x64: `win32-x64-${napiLabel}-unknown`
      },
      darwin: {
        x64: `darwin-x64-${napiLabel}-unknown`,
        arm64: `darwin-arm64-${napiLabel}-unknown`
      },
      linux: {
        x64: `linux-x64-${this.isMusl() ? 'musl' : 'glibc'}`,
        arm64: this.isMusl() ? `linux-arm64-${napiLabel}-musl` : '',
        arm: `linux-arm-${napiLabel}-glibc`
      }
    }
    if (!platformArchMap[platform]) {
      throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
    }
    if (!platformArchMap[platform][arch]) {
      throw new Error(`Unsupported architecture on ${platform}: ${arch}`)
    }

    nodeName = platformArchMap[platform][arch]

    const nodeFile = nodeName + '.node'
    const nodePath = path.join(nodeDir, 'package', nodeFile)
    fs.mkdirSync(path.join(nodeDir, 'package'), { recursive: true })
    const localFileExisted = fs.existsSync(nodePath)
    global.__SKIA_DOWNLOAD_PATH = nodePath
    try {
      if (!localFileExisted) {
        this.logger.info('初始化 skia 服务')
        await this.handleFile(nodeName, nodePath, nodeDir)
      }
      nativeBinding = require('@ltxhhz/skia-canvas-for-koishi')
    } catch (e) {
      this.logger.error('An error was encountered while processing the binary', e)
      throw new Error(`Failed to use ${nodePath} on ${platform}-${arch}`)
    }
    return nativeBinding
  }

  private async handleFile(fileName: string, filePath: string, nodeDir: string) {
    return new Promise<void>((resolve, reject) => {
      const tmpd = path.join(nodeDir, fileName)
      fs.rmSync(tmpd, { recursive: true, force: true })
      fs.mkdirSync(tmpd)
      const tmp = path.join(tmpd, fileName + '.tar.gz')
      superagent
        .get(`https://registry.npmmirror.com/-/binary/skia-canvas/v${skiaVersion}/${fileName}.tar.gz`)
        .on('progress', e => {
          this.logger.info(e.direction + ' 已完成 ' + e.percent + '%')
        })
        .on('error', err => {
          this.logger.error('下载文件时出错：', err)
          reject(err)
        })
        .pipe(fs.createWriteStream(tmp))
        .on('finish', () => {
          this.logger.info(`文件已成功下载到 ${tmp}，开始解压`)
          const unzip = zlib.createGunzip()

          const tarExtract = tar.x({
            cwd: tmpd
          })
          fs.createReadStream(tmp)
            .pipe(unzip)
            .pipe(tarExtract)
            .on('finish', () => {
              this.logger.info('文件解压完成。')
              fs.renameSync(path.join(tmpd, 'v6/index.node'), filePath)
              fs.rmSync(tmpd, { recursive: true, force: true })
              resolve()
            })
            .on('error', err => {
              this.logger.error('解压文件时出错：', err)
              reject(err)
            })
        })
        .on('error', err => {
          this.logger.error('下载文件时出错：', err)
          reject(err)
        })
    })
  }

  private isMusl() {
    // For Node 10
    if (!process.report || typeof process.report.getReport !== 'function') {
      try {
        const lddPath = require('child_process').execSync('which ldd').toString().trim()
        return fs.readFileSync(lddPath, 'utf8').includes('musl')
      } catch (e) {
        return true
      }
    } else {
      const report: { header: any } = process.report.getReport() as unknown as {
        header: any
      }
      const glibcVersionRuntime = report.header?.glibcVersionRuntime
      return !glibcVersionRuntime
    }
  }
}

export function apply(ctx: Context) {
  ctx.plugin(Skia)
}

