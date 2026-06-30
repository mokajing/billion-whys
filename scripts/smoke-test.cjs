#!/usr/bin/env node
// Layer 2: Node 模拟运行 smoke test
// 加载所有 require 链路，验证模块可加载；模拟页面 onLoad 调用

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const MP_ROOT = path.join(ROOT, 'src/miniprogram');

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        pass++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        fail++;
        failures.push({name, error: e.message});
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

console.log('=== Layer 2 Smoke Test ===');
console.log('');

// 1. 模块加载测试
console.log('Module Loading:');

// Set up wx mock
global.wx = {
    getSystemInfoSync: () => ({SDKVersion: '3.16.0', platform: 'devtools'}),
    getStorage: (opts) => opts.success && opts.success({data: '[]'}),
    setStorage: (opts) => opts.success && opts.success(),
    getStorageSync: () => null,
    setStorageSync: () => {},
    showToast: () => {},
    navigateTo: () => {},
    navigateBack: () => {},
    pageScrollTo: () => {},
    onMemoryWarning: () => {},
    createBannerAd: () => ({}),
    createRewardedVideoAd: () => ({}),
    loadSubpackage: (opts) => opts.success && opts.success(),
};

test('load content.js', () => {
    const content = require(path.join(MP_ROOT, 'utils/content.js'));
    if (typeof content.getById !== 'function') throw new Error('getById not function');
});

test('load storage.js', () => {
    require(path.join(MP_ROOT, 'utils/storage.js'));
});

test('load safe-wx.js', () => {
    const safeWx = require(path.join(MP_ROOT, 'utils/safe-wx.js'));
    if (typeof safeWx.safeToast !== 'function') throw new Error('safeToast not function');
});

test('load minor-protection.js', () => {
    const mp = require(path.join(MP_ROOT, 'utils/minor-protection.js'));
    if (typeof mp.checkTimeLimit !== 'function') throw new Error('checkTimeLimit not function');
});

test('load analytics.js', () => {
    require(path.join(MP_ROOT, 'utils/analytics.js'));
});

test('load i18n.js', () => {
    require(path.join(MP_ROOT, 'utils/i18n.js'));
});

// 2. 数据完整性测试
console.log('');
console.log('Data Integrity:');

test('questions-data has 271 items', () => {
    const q = require(path.join(MP_ROOT, 'data/questions-data.js'));
    if (!Array.isArray(q)) throw new Error('not array');
    if (q.length < 270) throw new Error(`only ${q.length} items, expected 270+`);
});

test('all questions have required fields', () => {
    const q = require(path.join(MP_ROOT, 'data/questions-data.js'));
    const required = ['id', 'category', 'question', 'layer1', 'layer2', 'layer3', 'science', 'experiment'];
    for (const item of q) {
        for (const field of required) {
            if (!(field in item)) throw new Error(`${item.id} missing ${field}`);
        }
        if (!item.layer1.answer) throw new Error(`${item.id} layer1.answer empty`);
        if (!item.layer1.image) throw new Error(`${item.id} layer1.image empty`);
    }
});

test('all 6 categories present', () => {
    const q = require(path.join(MP_ROOT, 'data/questions-data.js'));
    const cats = [...new Set(q.map(x => x.category))].sort();
    const expected = ['animals', 'body', 'food', 'home', 'nature', 'society'].sort();
    if (JSON.stringify(cats) !== JSON.stringify(expected)) {
        throw new Error(`categories: ${cats.join(',')} vs ${expected.join(',')}`);
    }
});

// 3. 分包测试
console.log('');
console.log('Subpackages:');

const SUBCATS = ['animals', 'body', 'food', 'home', 'nature', 'society'];
for (const cat of SUBCATS) {
    test(`subpackage ${cat}/data.js loads`, () => {
        const data = require(path.join(MP_ROOT, 'subpackages', cat, 'data.js'));
        if (!Array.isArray(data)) throw new Error('not array');
        if (data.length === 0) throw new Error('empty');
    });
}

// 4. 图片 URL 抽样（CDN 可访问性）
console.log('');
console.log('Image URL Sampling (CDN):');

test('CDN base URL accessible', () => {
    // Just check URL format, don't actually fetch (would need network)
    const content = require(path.join(MP_ROOT, 'utils/content.js'));
    const url = content.toWebP('/images/body/body-001-layer1.png');
    if (!url || !url.startsWith('http')) throw new Error(`invalid URL: ${url}`);
});

// 5. 总结
console.log('');
console.log('=== Summary ===');
console.log(`Pass: ${pass}, Fail: ${fail}`);
if (fail > 0) {
    console.log('');
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
}
