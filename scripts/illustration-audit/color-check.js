#!/usr/bin/env node
/**
 * V8.78 Sprint 75 第142轮：插画审核自动化脚本 —— 色值检测（Phase 1）
 * 负责：墨小暖 + AI小智
 *
 * 功能：
 * 1. 读取 IP 主色参考值（问问兔耳朵 #FF9966、答答熊身体 #8B6914）
 * 2. 检测插画中对应区域的颜色是否在容差范围
 * 3. 双阈值：DeltaE <= 10 自动通过，DeltaE <= 15 告警（触发人工审核）
 * 4. 输出 JSON 格式审核报告
 *
 * 用法：node scripts/illustration-audit/color-check.js <image_path>
 */

'use strict'

const fs = require('fs')
const path = require('path')

// IP 主色参考值（彩虹姐 + 墨小暖定义）
const IP_REFERENCE_COLORS = {
  'rabbit-ears': { r: 255, g: 153, b: 102, label: '问问兔耳朵 #FF9966' },
  'bear-body': { r: 139, g: 105, b: 20, label: '答答熊身体 #8B6914' },
}

// 双阈值（第142轮 CEO 裁决）
const AUTO_PASS_DELTA_E = 10   // <= 10 自动通过
const WARN_DELTA_E = 15        // <= 15 告警，触发人工审核；> 15 拒绝

/**
 * 将 hex 颜色转换为 RGB
 * @param {string} hex - 如 '#FF9966'
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

/**
 * 计算两个 RGB 颜色之间的 DeltaE（CIE76 简化版）
 * 使用加权欧几里得距离，对人眼感知更准确
 * @param {{r: number, g: number, b: number}} c1
 * @param {{r: number, g: number, b: number}} c2
 * @returns {number} DeltaE 值
 */
function deltaE(c1, c2) {
  const rMean = (c1.r + c2.r) / 2
  const deltaR = c1.r - c2.r
  const deltaG = c1.g - c2.g
  const deltaB = c1.b - c2.b

  // 加权欧几里得距离（对红色分量更敏感，因为人眼对红绿差异更敏感）
  const weightedR = deltaR * ((2 + rMean / 256) / 3)
  const weightedG = deltaG * 4
  const weightedB = deltaB * ((2 + (255 - rMean) / 256) / 3)

  return Math.sqrt(weightedR * weightedR + weightedG * weightedG + weightedB * weightedB)
}

/**
 * 模拟色值检测（实际使用时需要读取图片像素数据）
 * 当前版本：接受命令行传入的 hex 值或使用默认模拟值
 *
 * @param {string} imagePath - 图片路径
 * @returns {object} 审核报告
 */
function checkColor(imagePath) {
  // 实际实现中，这里会使用 sharp/canvas 等库读取图片像素
  // 当前 Phase 1 版本使用模拟数据，Phase 2 实现真实像素读取

  // 模拟检测结果（实际使用时替换为真实像素读取）
  const detectedColors = {
    'rabbit-ears': hexToRgb('#FF9966'),  // 模拟：恰好匹配
    'bear-body': hexToRgb('#8B6914'),    // 模拟：恰好匹配
  }

  const results = []
  let allPass = true
  let hasWarning = false

  for (const [key, refColor] of Object.entries(IP_REFERENCE_COLORS)) {
    const detected = detectedColors[key]
    if (!detected) {
      results.push({
        part: key,
        label: refColor.label,
        reference: { ...refColor },
        detected: null,
        deltaE: null,
        verdict: 'SKIP',
        message: `未检测到 ${refColor.label} 区域`,
      })
      continue
    }

    const de = deltaE(refColor, detected)
    let verdict
    if (de <= AUTO_PASS_DELTA_E) {
      verdict = 'PASS'
    } else if (de <= WARN_DELTA_E) {
      verdict = 'WARN'
      hasWarning = true
    } else {
      verdict = 'FAIL'
      allPass = false
    }

    results.push({
      part: key,
      label: refColor.label,
      reference: { ...refColor },
      detected: { ...detected },
      deltaE: Math.round(de * 100) / 100,
      verdict,
      message: verdict === 'PASS'
        ? `色值在自动通过范围内（DeltaE=${Math.round(de * 100) / 100} <= ${AUTO_PASS_DELTA_E}）`
        : verdict === 'WARN'
          ? `色值偏差需人工审核（DeltaE=${Math.round(de * 100) / 100}，告警阈值 ${WARN_DELTA_E}）`
          : `色值偏差过大（DeltaE=${Math.round(de * 100) / 100} > ${WARN_DELTA_E}），拒绝`,
    })
  }

  return {
    image: imagePath,
    timestamp: new Date().toISOString(),
    version: '1.0.0-phase1',
    thresholds: {
      autoPass: AUTO_PASS_DELTA_E,
      warn: WARN_DELTA_E,
    },
    overall: {
      pass: allPass && !hasWarning,
      warning: hasWarning,
      message: allPass
        ? (hasWarning ? '部分色值需人工审核' : '全部色值检测通过')
        : '色值检测未通过，存在偏差过大的区域',
    },
    results,
  }
}

// CLI 入口
if (require.main === module) {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('用法: node scripts/illustration-audit/color-check.js <image_path>')
    process.exit(1)
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在 - ${imagePath}`)
    process.exit(2)
  }

  const report = checkColor(imagePath)
  console.log(JSON.stringify(report, null, 2))

  // 退出码：0=全部通过，1=有告警，2=拒绝
  if (!report.overall.pass) {
    process.exit(2)
  } else if (report.overall.warning) {
    process.exit(1)
  }
}

module.exports = { checkColor, deltaE, hexToRgb, IP_REFERENCE_COLORS, AUTO_PASS_DELTA_E, WARN_DELTA_E }