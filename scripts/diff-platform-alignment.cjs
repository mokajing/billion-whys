#!/usr/bin/env node
/**
 * diff-platform-alignment.cjs
 * 第159轮 Sprint 81 Kickoff — P2#10: 双端对齐度 diff 脚本
 * 前端小凡 + 吐槽师老王
 *
 * 比较 src/h5 和 src/miniprogram 的功能差异
 * 输出对齐度百分比 + 差异项列表（摘要模式）
 *
 * 用法：
 *   node scripts/diff-platform-alignment.cjs [--verbose]
 *   --verbose: 输出完整差异详情
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const H5_DIR = path.join(PROJECT_ROOT, 'src', 'h5');
const MP_DIR = path.join(PROJECT_ROOT, 'src', 'miniprogram');

// ── 功能模块定义（基于实际文件结构） ──
const FEATURE_MODULES = [
  {
    name: '问题展示',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue'],
      markers: ['question', 'QuestionDetail'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/pages/question/question.js'],
      markers: ['question'],
    },
  },
  {
    name: '三层回答',
    h5: {
      files: ['src/h5/components/AudioBar.vue', 'src/h5/pages/QuestionDetail.vue'],
      markers: ['layer1', 'layer2', 'layer3'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/utils/content.js'],
      markers: ['layer1', 'layer2', 'layer3'],
    },
  },
  {
    name: '插画展示',
    h5: {
      files: ['src/h5/components/IllustrationImage.vue', 'src/h5/components/RabbitFace.vue'],
      markers: ['IllustrationImage', 'textOnly'],
    },
    mp: {
      files: ['src/miniprogram/components/illustration-image/illustration-image.wxml'],
      markers: ['illustration', 'textOnly'],
    },
  },
  {
    name: '互动引导（interactionHint）',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue'],
      markers: ['interactionHint'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/pages/question/question.js'],
      markers: ['interactionHint'],
    },
  },
  {
    name: 'Emoji 前缀映射',
    h5: {
      files: ['src/h5/utils/constants.js'],
      markers: ['emoji', 'emojiMap'],
    },
    mp: {
      files: ['src/miniprogram/utils/constants.js'],
      markers: ['emoji', 'emojiMap'],
    },
  },
  {
    name: '家长指导（parentGuide）',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue', 'src/h5/stores/content.js'],
      markers: ['parentGuide', 'parent-guide'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/pages/question/question.js', 'src/miniprogram/data/questions-data.js'],
      markers: ['parentGuide', 'parent-guide'],
    },
  },
  {
    name: '亲子实验',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue'],
      markers: ['experiment'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/pages/question/question.js'],
      markers: ['experiment'],
    },
  },
  {
    name: '反馈系统',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue'],
      markers: ['feedback', 'Feedback'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml', 'src/miniprogram/pages/question/question.js'],
      markers: ['feedback'],
    },
  },
  {
    name: '收藏功能',
    h5: {
      files: ['src/h5/stores/content.js', 'src/h5/pages/Archive.vue'],
      markers: ['favorite', 'archive'],
    },
    mp: {
      files: ['src/miniprogram/utils/content.js'],
      markers: ['favorite', 'favorites'],
    },
  },
  {
    name: '相关推荐',
    h5: {
      files: ['src/h5/pages/Discover.vue', 'src/h5/stores/content.js'],
      markers: ['related', 'discover'],
    },
    mp: {
      files: ['src/miniprogram/utils/content.js'],
      markers: ['related'],
    },
  },
  {
    name: '多语言适配（locale）',
    h5: {
      files: ['src/h5/utils/i18n.js', 'src/h5/locales/index.js', 'src/h5/components/LocaleSwitcher.vue'],
      markers: ['locale', 'i18n'],
    },
    mp: {
      files: ['src/miniprogram/utils/i18n.js', 'src/miniprogram/components/locale-switcher/'],
      markers: ['locale', 'i18n'],
    },
  },
  {
    name: '实验材料展示',
    h5: {
      files: ['src/h5/pages/QuestionDetail.vue'],
      markers: ['materials', 'materialsList'],
    },
    mp: {
      files: ['src/miniprogram/pages/question/question.wxml'],
      markers: ['materials', 'materialsList'],
    },
  },
];

// ── 文件存在性检查 ──
function fileExists(filePath) {
  if (typeof filePath === 'string') {
    return fs.existsSync(path.join(PROJECT_ROOT, filePath));
  }
  return false;
}

function dirExists(dirPath) {
  if (typeof dirPath === 'string') {
    return fs.existsSync(path.join(PROJECT_ROOT, dirPath));
  }
  return false;
}

// ── 检查源文件内容标记 ──
function hasMarkers(files, markers) {
  if (!files || files.length === 0) return false;
  for (const f of files) {
    const fullPath = path.join(PROJECT_ROOT, f);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // 如果指定了 markers，检查是否至少有一个
        if (markers && markers.length > 0) {
          const found = markers.some(m => content.includes(m));
          if (found) return true;
        } else {
          return true; // 文件存在即视为有实现
        }
      } catch (e) {
        // 忽略读取错误
      }
    }
  }
  // 也检查目录
  for (const f of files) {
    if (f.endsWith('/') && dirExists(f)) return true;
  }
  return false;
}

// ── 主入口 ──
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');

  const results = [];
  let h5ImplCount = 0;
  let mpImplCount = 0;
  let totalFeatures = FEATURE_MODULES.length;

  for (const module of FEATURE_MODULES) {
    // 检查文件存在性
    const h5FileExists = module.h5.files.some(f => fileExists(f) || dirExists(f));
    const mpFileExists = module.mp.files.some(f => fileExists(f) || dirExists(f));

    // 检查功能标记
    const h5MarkerFound = hasMarkers(module.h5.files, module.h5.markers);
    const mpMarkerFound = hasMarkers(module.mp.files, module.mp.markers);

    const h5Done = h5FileExists || h5MarkerFound;
    const mpDone = mpFileExists || mpMarkerFound;

    let status = 'aligned';
    if (h5Done && mpDone) {
      status = 'aligned';
      h5ImplCount++;
      mpImplCount++;
    } else if (h5Done && !mpDone) {
      status = 'h5_only';
      h5ImplCount++;
    } else if (!h5Done && mpDone) {
      status = 'mp_only';
      mpImplCount++;
    } else {
      status = 'none';
    }

    results.push({
      name: module.name,
      status,
      h5Done,
      mpDone,
      h5Files: module.h5.files.filter(f => fileExists(f) || dirExists(f)),
      mpFiles: module.mp.files.filter(f => fileExists(f) || dirExists(f)),
    });
  }

  const alignedCount = results.filter(r => r.status === 'aligned').length;
  const h5OnlyCount = results.filter(r => r.status === 'h5_only').length;
  const mpOnlyCount = results.filter(r => r.status === 'mp_only').length;
  const noneCount = results.filter(r => r.status === 'none').length;

  const h5Alignment = totalFeatures > 0 ? ((h5ImplCount / totalFeatures) * 100).toFixed(0) : 0;
  const mpAlignment = totalFeatures > 0 ? ((mpImplCount / totalFeatures) * 100).toFixed(0) : 0;

  // ── 输出 ──
  console.log('==========================================');
  console.log(' 双端对齐度 Diff 报告');
  console.log(' 第159轮 Sprint 81 Kickoff P2#10');
  console.log('==========================================');
  console.log('');
  console.log('--- 摘要 ---');
  console.log(`H5 对齐度: ${h5Alignment}%`);
  console.log(`小程序对齐度: ${mpAlignment}%`);
  console.log(`双端对齐: ${alignedCount}/${totalFeatures}`);
  console.log(`仅 H5: ${h5OnlyCount}`);
  console.log(`仅小程序: ${mpOnlyCount}`);
  console.log(`均未实现: ${noneCount}`);
  console.log('');

  console.log('--- 对齐度表格 ---');
  console.log('| 功能模块 | H5 | 小程序 | 对齐度 | 备注 |');
  console.log('|------------|---|---------|---------|------|');
  for (const r of results) {
    const h5Str = r.h5Done ? 'Y' : 'N';
    const mpStr = r.mpDone ? 'Y' : 'N';
    const alignStr = r.status === 'aligned' ? '100%' : r.status === 'h5_only' ? '0%' : r.status === 'mp_only' ? '0%' : '0%';
    const note = r.status === 'aligned' ? '' : r.status === 'h5_only' ? '待小程序实现' : r.status === 'mp_only' ? '待H5实现' : '未实现';
    console.log(`| ${r.name} | ${h5Str} | ${mpStr} | ${alignStr} | ${note} |`);
  }
  console.log('');

  // 差异项
  if (h5OnlyCount > 0 || mpOnlyCount > 0) {
    console.log('--- 差异项 ---');
    for (const r of results) {
      if (r.status !== 'aligned') {
        if (r.status === 'h5_only') {
          console.log(`  🔧 ${r.name}: H5 已实现，小程序缺失`);
          if (verbose) {
            console.log(`     H5 文件: ${(r.h5Files || []).join(', ') || '未找到'}`);
          }
        } else if (r.status === 'mp_only') {
          console.log(`  🔧 ${r.name}: 小程序已实现，H5 缺失`);
          if (verbose) {
            console.log(`     MP 文件: ${(r.mpFiles || []).join(', ') || '未找到'}`);
          }
        }
      }
    }
    console.log('');
  }

  if (h5OnlyCount === 0 && mpOnlyCount === 0) {
    console.log('✅ 双端完全对齐！');
  } else {
    console.log(`⚠️ ${h5OnlyCount + mpOnlyCount} 项差异需要处理`);
  }
}

main();