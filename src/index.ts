import { Context, Schema, Service } from 'koishi'
import type skia from '@ltxhhz/skia-canvas-for-koishi'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import * as tar from 'tar'
import { Stream } from 'stream'

export type * from '@ltxhhz/skia-canvas-for-koishi'

export const name = 'skia-canvas'
export const filter = false
export const inject = ['http']

const skiaVersion = '1.0.2'
// napiLabel = ''

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

  declare readonly config: Required<Skia.Config>

  constructor(ctx: Context, config: Skia.Config) {
    super(ctx, 'skia')
    // this.logger = ctx.logger('skia')
    this.ctx.logger.debug('输入配置：', config)
    this.config = {
      nodeBinaryPath: 'data/assets/canvas',
      fontsPath: 'data/assets/fonts',
      fontAliases: {},
      timeout: 6e4,
      ...config
    }
    // this.getVersions(this.ctx)
  }

  async start() {
    const nodeDir = path.resolve(this.ctx.baseDir, this.config.nodeBinaryPath)

    fs.mkdirSync(nodeDir, { recursive: true })
    const s = await this.getNativeBinding(nodeDir)
    for (const key in s) {
      if (Object.hasOwn(s, key)) {
        this[key] = s[key]
      }
    }
    const p = path.resolve(this.ctx.baseDir, this.config.fontsPath)
    fs.mkdirSync(p, { recursive: true })
    let fonts = await getAllFiles(p)
    if (Object.keys(this.config.fontAliases).length > 0) {
      for (const alias in this.config.fontAliases) {
        if (Object.hasOwn(this.config.fontAliases, alias)) {
          const font = this.config.fontAliases[alias]
          const fontPath = Array.isArray(font) ? font.map(e => path.resolve(this.ctx.baseDir, this.config.fontsPath, e)) : path.resolve(this.ctx.baseDir, this.config.fontsPath, font)
          try {
            this.ctx.logger.info('字体被加载', this.FontLibrary.use(alias, fontPath))
            const fontFilenames = Array.isArray(font) ? font.map(e => path.basename(e)) : [path.basename(font)]
            fonts = fonts.filter(e => !fontFilenames.includes(e)) // 不重复加载
          } catch (error) {
            this.ctx.logger.error('字体加载失败', error)
          }
        }
      }
    }
    try {
      this.ctx.logger.info('字体被加载', this.FontLibrary.use(fonts))
    } catch (error) {
      this.ctx.logger.error('字体加载失败', error)
    }
  }

  private async getNativeBinding(nodeDir: string) {
    const { platform, arch } = process
    let nativeBinding: any

    const platformArchMap = {
      win32: {
        x64: `win32-x64-unknown`
      },
      darwin: {
        x64: `darwin-x64-unknown`,
        arm64: `darwin-arm64-unknown`
      },
      linux: {
        x64: `linux-x64-${this.isMusl() ? 'musl' : 'glibc'}`,
        arm64: `linux-arm64-${this.isMusl() ? 'musl' : 'glibc'}`
        // arm: `linux-arm-glibc`
      }
    }
    if (!platformArchMap[platform]) {
      throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
    }
    if (!platformArchMap[platform][arch]) {
      throw new Error(`Unsupported architecture on ${platform}: ${arch}`)
    }

    const nodeName = platformArchMap[platform][arch]

    const nodeFile = skiaVersion + '_' + nodeName + '.node'
    const nodePath = path.join(nodeDir, 'package', nodeFile)
    fs.mkdirSync(path.join(nodeDir, 'package'), { recursive: true })
    const localFileExisted = fs.existsSync(nodePath)
    global.__SKIA_DOWNLOAD_PATH = nodePath
    try {
      this.ctx.logger.info('初始化 skia 服务')
      this.ctx.logger.debug(`文件 ${nodePath} 是否存在: ${localFileExisted}`)
      if (!localFileExisted) {
        this.ctx.logger.info(`${skiaVersion} 版本二进制文件不存在，开始下载`)
        const p = path.join(nodeDir, 'package')
        const files = fs.readdirSync(p)
        let unk = false
        files.forEach(fn => {
          this.ctx.logger.info(`其他版本文件可删除 ${fn}`)
          // const v = fn.match(/^\d+\.\d+\.\d+_/)
          // if (v) {
          // try {
          //   fs.rmSync(path.join(p, fn), { recursive: true, force: true })
          //   this.ctx.logger.info('删除旧文件', fn)
          // } catch (error) {
          //   this.ctx.logger.warn('删除旧文件失败', fn, error)
          // }
          // } else {
          //   unk = true
          // }
        })
        // if (unk) {
        //   this.ctx.logger.warn('目录下似乎有旧版本文件，请检查并删除', p)
        // }
        await this.handleFile(nodeName, nodePath)
      }
      nativeBinding = require('@ltxhhz/skia-canvas-for-koishi')
      this.ctx.logger.info('初始化 skia 完成')
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
            const verDir = fs.readdirSync(tmpd).filter(e => fs.statSync(path.join(tmpd, e)).isDirectory())
            if (verDir.length > 0) {
              const ver = verDir.sort().reverse()[0]
              const nodeFile = path.join(tmpd, ver, 'index.node')
              this.ctx.logger.info(`正在复制 ${nodeFile} 文件到 ${filePath}`)
              try {
                fs.copyFileSync(nodeFile, filePath)
              } catch (error) {
                this.ctx.logger.error('复制文件失败', error)
                reject(error)
                return
              }
            } else {
              this.ctx.logger.error('压缩包目录为空，请检查')
              reject('压缩包目录为空，请检查')
              return
            }
            setTimeout(() => {
              // ENOTEMPTY: directory not empty
              try {
                fs.rmSync(tmpd, { recursive: true, force: true })
                this.ctx.logger.info('文件已删除。')
              } catch (error) {
                this.ctx.logger.info('路径删除失败，可手动删除。', tmpd, error)
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
    if (os.platform() == 'win32') {
      return false // Windows does not use musl
    }
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

  private async getVersions(ctx: Context): Promise<string[]> {
    const versionFile = path.resolve(this.ctx.baseDir, this.config.nodeBinaryPath, 'versions.txt')
    try {
      const response = (
        await ctx.http.get<Record<string, string>[]>('https://registry.npmmirror.com/-/binary/skia-canvas', {
          timeout: this.config.timeout
        })
      ).map(e => e.name.replace(/^v|\/$/g, ''))
      try {
        fs.writeFileSync(versionFile, response.join('\n'))
      } catch (error) {
        this.ctx.logger.error(error)
      }
      this.ctx.logger.info('获取版本列表成功', response)
      return response
    } catch (error) {
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf-8').split('\n')
      } else {
        return []
      }
    }
  }
}

export namespace Skia {
  export interface Config {
    nodeBinaryPath?: string
    fontsPath?: string
    fontAliases?: { [alias: string]: string[] | string }
    timeout?: number
  }
  export let Config: Schema<Config> = Schema.object({
    nodeBinaryPath: Schema.path({
      filters: ['directory'],
      allowCreate: true
    })
      .description('Canvas binary file storage directory')
      .default('data/assets/canvas'),
    fontsPath: Schema.path({
      filters: ['directory'],
      allowCreate: true
    })
      .description('Fonts storage directory')
      .default('data/assets/fonts'),
    fontAliases: Schema.any()
      .default({})
      .description('Font aliases, relative to [fontsPath], type is `{ [alias: string]: string[]|string }`, e.g. `{ "sans": ["Noto Sans CJK SC", "path/to/Noto Sans CJK JP"] }`'),
    timeout: Schema.number().default(6e4).description('Download timeout (ms)')
  }).i18n({
    zh: {
      version: 'skia-canvas 版本，从版本列表中选择',
      nodeBinaryPath: 'Canvas 文件存放目录',
      fontsPath: '字体存放目录',
      fontAliases: '字体别名，路径相对[字体存放目录]，类型为 `{ [alias: string]: string[]|string }`，例如 `{ "sans": ["Noto Sans CJK SC", "path/to/Noto Sans CJK JP"] }`',
      timeout: '下载超时时间(ms)'
    }
  })
}

export default Skia

async function getAllFiles(dir: string) {
  let results: string[] = []

  const files = await fsp.readdir(dir, { withFileTypes: true })

  for (const file of files) {
    const fullPath = path.join(dir, file.name)

    if (file.isDirectory()) {
      results = results.concat(await getAllFiles(fullPath))
    } else {
      results.push(fullPath)
    }
  }

  return results
}
