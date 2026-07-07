# 已知问题归档 (Known Issues)

> 创建日期：2026-07-07 V8.74 Sprint 73 第138轮
> 维护规则：每个已知问题必须包含 Bug ID、发现 Sprint、影响范围、复现步骤、责任人、状态

---

## 开放问题 (Open)

### KI-001: Pinia getter reactivity 已知限制

- **发现 Sprint**: Sprint 73 (V8.73)
- **影响范围**: H5 content store 的 `dailyPicks`、`hotQuestions` 等 getter 在 `questions` 数组原地更新时不触发响应式更新
- **复现步骤**: 
  1. 在 content store 中直接修改 `questions` 数组元素（非整体替换）
  2. 依赖该 getter 的组件不重新渲染
- **根本原因**: Pinia getter 基于 `reactive` 引用追踪，对数组元素属性的深层修改不会触发
- **当前缓解措施**: 所有 questions 更新使用整体替换（`store.questions = [...newArray]`）
- **待修复时机**: 后续重构统一使用 Immutable 更新模式时彻底解决
- **责任人**: CTO 陈架构
- **状态**: 已知（非阻塞，当前缓解措施覆盖所有场景）

---

## 已修复 (Resolved)

| Bug ID | 标题 | 修复 Sprint | 修复内容 |
|--------|------|------------|----------|
| KI-002 | (待记录) | -- | -- |

---

## 归档说明

- 本文件用于记录非阻塞性、有缓解措施的已知问题
- 如有实际 Bug 导致用户可见问题，应记录在 PRD 主文档的"已知问题"部分
- 每次 Sprint 收尾时 CTO + 测试虫虫联合审查并更新