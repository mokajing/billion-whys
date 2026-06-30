#!/usr/bin/env node
/**
 * upload-mp.js — P1-4 DevOps 自动化：miniprogram-ci 体验版上传脚本
 *
 * 用法：
 *   MP_APPID=wxXXXXXXXXXXXXXX \
 *   MP_PRIVATE_KEY_PATH=/abs/path/to/private.key \
 *   MP_VERSION=0.3.26 \
 *   MP_DESC="P1/P2 合规修复" \
 *   node scripts/upload-mp.js
 *
 * 环境变量：
 *   MP_APPID            必填，小程序 AppID（个人主体）
 *   MP_PRIVATE_KEY_PATH 必填，miniprogram-ci 上传密钥绝对路径（从小程序后台下载）
 *   MP_VERSION          可选，语义版本号；默认读 package.json version
 *   MP_DESC             可选，版本说明；默认 "auto upload"
 *   MP_ROBOT            可选，CI 机器人编号 1-30，默认 1
 *   MP_SKIP_NOTIFY      可选，"1" 跳过 webhook 通知（用于本地测试）
 *
 * 退出码：
 *   0 = 上传成功
 *   1 = 上传失败（含密钥/网络/平台错误）
 *   2 = 环境变量缺失
 *
 * Why: 审核报告 P1-4 — 人工上传易失误；CI 自动化降低提审参数缺失风险
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const MP_ROOT = path.join(ROOT, 'src/miniprogram')

function env(key, fallback) {
  const v = process.env[key]
  return (v === undefined || v === '') ? fallback : v
}

function loadPkg() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  } catch (_e) {
    return { version: '0.0.0' }
  }
}

function postWebhook(title, message) {
  if (process.env.MP_SKIP_NOTIFY === '1') return
  const notifyScript = path.join(ROOT, 'notify_groups.sh')
  if (!fs.existsSync(notifyScript)) {
    // 项目根没有 notify_groups.sh 时尝试上层目录
    const alt = path.join(ROOT, '..', 'notify_groups.sh')
    if (fs.existsSync(alt)) {
      runNotify(alt, title, message)
      return
    }
    console.log('[webhook] notify_groups.sh not found, skipping')
    return
  }
  runNotify(notifyScript, title, message)
}

function runNotify(scriptPath, title, message) {
  try {
    execSync(`bash "${scriptPath}" "${title}" "${message}"`, { stdio: 'inherit' })
  } catch (_e) {
    console.warn('[webhook] notify_groups.sh failed; continuing')
  }
}

function main() {
  const appid = env('MP_APPID', '')
  const privateKeyPath = env('MP_PRIVATE_KEY_PATH', '')
  const pkg = loadPkg()
  const version = env('MP_VERSION', pkg.version)
  const desc = env('MP_DESC', 'auto upload')
  const robot = parseInt(env('MP_ROBOT', '1'), 10) || 1

  if (!appid || appid === 'TOURIST_APPID_PERSONAL_PENDING' || /^tourist/i.test(appid)) {
    console.error('[upload-mp] MP_APPID 未配置或仍为占位符；无法上传')
    postWebhook('MP 上传失败', 'MP_APPID 未配置或仍为占位符；请设置正式 AppID 后重试')
    process.exit(2)
  }
  if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
    console.error(`[upload-mp] MP_PRIVATE_KEY_PATH 无效：${privateKeyPath}`)
    postWebhook('MP 上传失败', `MP_PRIVATE_KEY_PATH 无效：${privateKeyPath}`)
    process.exit(2)
  }

  console.log(`[upload-mp] AppID=${appid} version=${version} robot=${robot}`)
  console.log(`[upload-mp] desc=${desc}`)
  console.log(`[upload-mp] miniprogramRoot=${MP_ROOT}`)

  let ci
  try {
    ci = require('miniprogram-ci')
  } catch (_e) {
    console.error('[upload-mp] miniprogram-ci 未安装；请运行 npm i -D miniprogram-ci')
    postWebhook('MP 上传失败', 'miniprogram-ci 未安装；请运行 npm i -D miniprogram-ci')
    process.exit(1)
  }

  const project = new ci.Project({
    appid: appid,
    type: 'miniProgram',
    projectPath: MP_ROOT,
    privateKeyPath: privateKeyPath,
    ignores: ['node_modules/**/*'],
  })

  ci.upload({
    project: project,
    version: version,
    desc: desc,
    setting: {
      es6: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    robot: robot,
  })
    .then((res) => {
      const summary = `小程序体验版上传成功：v${version}（${desc}）。可在微信公众平台-版本管理查看。`
      console.log('[upload-mp] upload success:', res && res.subPackageInfo ? JSON.stringify(res.subPackageInfo) : '')
      postWebhook('MP 体验版上传成功', summary)
      process.exit(0)
    })
    .catch((err) => {
      const errMsg = (err && err.message) ? err.message : String(err)
      console.error('[upload-mp] upload failed:', errMsg)
      postWebhook('MP 上传失败', `v${version} 上传失败：${errMsg.slice(0, 200)}`)
      process.exit(1)
    })
}

main()
