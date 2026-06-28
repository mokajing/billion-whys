import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 反 V7.2 第62轮 P0：MP 三处硬编码 version 漂移（app.js/profile.js/privacy.wxml）
// Why: 发布 0.3.0 时若遗漏任一处，用户看到的版本号会矛盾，合规审计也失败
// How to apply: 每次 build:mp-data 后此测试必须通过；package.json bump 后需重跑 build:mp-data
describe('MP version source sync', () => {
  const pkgPath = resolve(__dirname, '../../../../package.json')
  const versionJsonPath = resolve(__dirname, '../../../../src/miniprogram/data/version.json')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  it('miniprogram/data/version.json exists and matches package.json version', () => {
    const v = JSON.parse(readFileSync(versionJsonPath, 'utf8'))
    expect(v.version, 'version.json.version must equal package.json version — run `npm run build:mp-data` after bumping').toBe(pkg.version)
    expect(typeof v.releaseDate).toBe('string')
    expect(v.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('app.js reads version from data/version.json (no hardcoded 0.2.0)', () => {
    const appJs = readFileSync(
      resolve(__dirname, '../../../../src/miniprogram/app.js'),
      'utf8'
    )
    expect(appJs, 'app.js must require ./data/version.json').toContain(
      "require('./data/version.json')"
    )
    // 反 Pattern: 不允许出现硬编码版本字符串 '0.2.0'
    expect(appJs).not.toMatch(/version:\s*['"]0\.\d+\.\d+['"]/)
  })

  it('privacy.wxml binds version dynamically (no hardcoded v0.2.0)', () => {
    const wxml = readFileSync(
      resolve(__dirname, '../../../../src/miniprogram/pages/privacy/privacy.wxml'),
      'utf8'
    )
    expect(wxml).toContain('{{version')
    expect(wxml).toContain('{{releaseDate')
    // 不允许出现硬编码版本号字符串
    expect(wxml).not.toMatch(/v0\.\d+\.\d+/)
  })

  it('profile.js fallback is "unknown", not a lying version', () => {
    const js = readFileSync(
      resolve(__dirname, '../../../../src/miniprogram/pages/profile/profile.js'),
      'utf8'
    )
    expect(js).toContain("'unknown'")
    // 反 V7.2 之前 fallback '0.1.0' 误导用户
    expect(js).not.toContain("'0.1.0'")
  })
})
