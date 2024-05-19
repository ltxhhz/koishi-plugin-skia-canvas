import { Context, Schema, Service } from 'koishi'
import type skia from '@ltxhhz/skia-canvas-for-koishi'
import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import * as tar from 'tar'
import { Stream } from 'stream'

export type * from '@ltxhhz/skia-canvas-for-koishi'

export const name = 'skia-canvas'
export const filter = false

export interface Config {
  nodeBinaryPath?: string
  timeout?: number
}

export const Config: Schema<Config> = Schema.object({
  nodeBinaryPath: Schema.path({
    filters: ['directory'],
    allowCreate: true
  })
    .description('Canvas binary file storage directory')
    .default('data/assets/canvas'),
  timeout: Schema.number().default(6e4).description('Download timeout (ms)')
}).i18n({
  zh: {
    nodeBinaryPath: 'Canvas 文件存放目录',
    timeout: '下载超时时间(ms)'
  }
})

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

  declare readonly config: Required<Config>

  constructor(ctx: Context, config: Config) {
    super(ctx, 'skia')
    // this.logger = ctx.logger('skia')
    this.config = {
      nodeBinaryPath: 'data/assets/canvas',
      timeout: 6e4,
      ...config
    }
  }

  protected override async start() {
    const nodeDir = path.resolve(this.ctx.baseDir, this.config.nodeBinaryPath)

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

    const platformArchMap = {
      win32: {
        x64: `win32-x64-${napiLabel}-unknown`
      },
      darwin: {
        x64: `darwin-x64-${napiLabel}-unknown`,
        arm64: `darwin-arm64-${napiLabel}-unknown`
      },
      linux: {
        x64: `linux-x64-${napiLabel}-${this.isMusl() ? 'musl' : 'glibc'}`,
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

    const nodeName = platformArchMap[platform][arch]

    const nodeFile = nodeName + '.node'
    const nodePath = path.join(nodeDir, 'package', nodeFile)
    fs.mkdirSync(path.join(nodeDir, 'package'), { recursive: true })
    const localFileExisted = fs.existsSync(nodePath)
    global.__SKIA_DOWNLOAD_PATH = nodePath
    try {
      if (!localFileExisted) {
        this.ctx.logger.info('初始化 skia 服务')
        await this.handleFile(nodeName, nodePath)
        this.ctx.logger.info('初始化 skia 完成')
      }
      nativeBinding = require('@ltxhhz/skia-canvas-for-koishi')
    } catch (e) {
      this.ctx.logger.error('An error was encountered while processing the binary', e)
      throw new Error(`Failed to use ${nodePath} on ${platform}-${arch}`)
    }
    return nativeBinding
  }

  private async handleFile(fileName: string, filePath: string) {
    return new Promise<void>((resolve, reject) => {
      const tmpd = path.join(os.tmpdir(), fileName)
      fs.rmSync(tmpd, { recursive: true, force: true })
      fs.mkdirSync(tmpd)
      const tmp = path.join(tmpd, fileName + '.tar.gz')
      this.downloadFile(`https://registry.npmmirror.com/-/binary/skia-canvas/v${skiaVersion}/${fileName}.tar.gz`, tmp).then(() => {
        this.ctx.logger.info(`文件已成功下载到 ${tmp}，开始解压`)
        const unzip = zlib.createGunzip()

        const tarExtract = tar.x({
          cwd: tmpd
        })
        fs.createReadStream(tmp)
          .pipe(unzip)
          .pipe(tarExtract)
          .on('finish', () => {
            this.ctx.logger.info('文件解压完成。')
            fs.renameSync(path.join(tmpd, 'v6/index.node'), filePath)
            setTimeout(() => {
              // ENOTEMPTY: directory not empty
              try {
                fs.rmSync(tmpd, { recursive: true, force: true })
                this.ctx.logger.info('文件已删除。')
              } catch (error) {
                this.ctx.logger.info('路径删除失败，可手动删除。', tmpd)
              }
              resolve()
            }, 300)
          })
          .on('error', err => {
            this.ctx.logger.error('解压文件时出错：', err)
            reject(err)
          })
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

  private async downloadFile(url: string, path: string) {
    const response = await this.ctx.http.get(url, {
      responseType: 'stream',
      timeout: this.config.timeout
      // onDownloadProgress: (event) => {
      //   this.ctx.logger.info(
      //     `下载进度：${Math.round((event.loaded / event.total) * 100)}%`,
      //   )
      // },
    })
    const file = Stream.Writable.toWeb(fs.createWriteStream(path))
    await response.pipeTo(file)
    // this.ctx.logger.info(`${url} download complete`)
  }
}

export function apply(ctx: Context) {
  ctx.plugin(Skia)
}
