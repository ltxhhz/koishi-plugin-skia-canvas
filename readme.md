# @ltxhhz/koishi-plugin-skia-canvas

[![npm](https://img.shields.io/npm/v/@ltxhhz/koishi-plugin-skia-canvas?style=flat-square)](https://www.npmjs.com/package/@ltxhhz/koishi-plugin-skia-canvas)

基于 [samizdatco/skia-canvas: A GPU-accelerated 2D graphics environment for Node.js (github.com)](https://github.com/samizdatco/skia-canvas) 提供 koishi 的 skia 服务

## 食用方法

> 查看更多：[samizdatco/skia-canvas: A GPU-accelerated 2D graphics environment for Node.js (github.com)](https://github.com/samizdatco/skia-canvas)

```ts
import type {} from '@ltxhhz/koishi-plugin-skia-canvas' //引入类型

const { Canvas, loadImage } = ctx.skia //使用其他模块
```

## 用例

* [ltxhhz/koishi-plugin-imagify-skia: koishi 插件，使用 skia-canvas 的图形化输出，性能优于 puppeteer (github.com)](https://github.com/ltxhhz/koishi-plugin-imagify-skia)
* [ltxhhz/koishi-plugin-give-you-some-color: 给你点颜色看看 | 发送颜色图片 (github.com)](https://github.com/ltxhhz/koishi-plugin-give-you-some-color)

## 区别

感谢[另一个项目](https://github.com/Kokoro-js/koishi-plugin-skia-canvas)提供思路，他这个项目同样提供了基于另一个 skia 项目的 canvas 服务 [Brooooooklyn/canvas: High performance skia binding to Node.js. Zero system dependencies and pure npm packages without any postinstall scripts nor node-gyp. (github.com)](https://github.com/Brooooooklyn/canvas)

两者主要的区别，或者说我要自己手搓这个项目的目的是

- 本项目使用的 [samizdatco/skia-canvas: A GPU-accelerated 2D graphics environment for Node.js (github.com)](https://github.com/samizdatco/skia-canvas) 库多提供了文本排版的功能（比如文本换行），而我懒得自己实现
- [samizdatco/skia-canvas: A GPU-accelerated 2D graphics environment for Node.js (github.com)](https://github.com/samizdatco/skia-canvas) 对平台的支持没有另一个多
- 其他的暂时没注意
