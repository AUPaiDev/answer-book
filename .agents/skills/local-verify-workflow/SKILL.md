---
name: local-verify-workflow
description: >-
  Mandatory workflow for the Answer Book project: always run thorough local testing
  (API checks, mobile UI screenshots, animation verification) and verify results before git pushing.
---

# Local Verification Workflow (先本地实测，确认无误后再 Push)

本 Skill 定义了《答案之书》项目在进行任何代码修改后的标准本地验证与发布流程。

## 适用场景
- 任何前端、后端、算法或样式修改后的提测与发布阶段。
- 严禁跳过本地验证直接 push。

## 执行步骤

### 1. 服务健康检查
```bash
curl -s http://localhost:3900/api/health
```
必须返回 `{"status":"ok"}` 确认本地服务正常。

### 2. 接口与算法批量验证
针对典型问题进行连续多次抽样请求：
```bash
for q in "我什么时候暴富" "今晚要不要加班" "我今晚吃什么" "我什么时候结婚"; do
  curl -s -X POST http://localhost:3900/api/ask -H "Content-Type: application/json" -d "{\"question\":\"$q\"}" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'{d[\"page\"]}页 | {d[\"oracle\"]} | {len(d[\"reading\"])}字')"
done
```
核验指标：
- 页码分散度（无特定词锁定）
- 字数在 75~100 字区间
- 解读语气克制留白，无违禁词

### 3. 前端 UI 与动效截图验证
对 UI/动画相关修改，使用 Puppeteer 脚本截取移动端关键帧：
- 封面页
- 输入提问页
- 翻书加载中（检查 3D 纸张翻转、无表单重影、粒子平滑无抖动）
- 打字机打字中（检查操作按钮隐藏）
- 揭晓完成态（检查左右书页对称性、页码与天机印章水平对齐）
- 再次询问（检查淡出重置平滑性）

### 4. 提交与推送
```bash
# 1. 确认工作区无残留临时文件
git status
# 2. 提交并推送
git add <files>
git commit -m "fix/feat: 明确的改动说明"
git push origin main
```
