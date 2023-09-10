# @ltxhhz/koishi-plugin-skia-canvas

[![npm](https://img.shields.io/npm/v/@ltxhhz/koishi-plugin-skia-canvas?style=flat-square)](https://www.npmjs.com/package/@ltxhhz/koishi-plugin-skia-canvas)


基于 [skia-canvas](https://github.com/samizdatco/skia-canvas) 提供 koishi 的 skia 服务

## 食用方法
> 查看更多：[skia-canvas](https://github.com/samizdatco/skia-canvas)

```ts
import type {} from '@ltxhhz/koishi-plugin-skia-canvas' //引入类型

const { Canvas, loadImage } = ctx.skia //使用其他模块
```

## 区别

感谢[另一个项目](https://github.com/Kokoro-js/koishi-plugin-skia-canvas)提供思路，这个项目同样提供了基于[另一个](https://github.com/Brooooooklyn/canvas) skia 项目的 canvas 服务

两者主要的区别，或者说我要自己手搓这个项目的目的是
- 本项目使用的 [skia-canvas](https://github.com/samizdatco/skia-canvas) 库多提供了文本排版的功能，而我懒得自己实现
- [skia-canvas](https://github.com/samizdatco/skia-canvas) 对平台的支持没有另一个多
- 其他的暂时没注意
