# 《答案之书》Agent 工作流规范与开发准则

## 🚨 核心铁律：先本地实测，确认无误后再 Push (Local Verification First)

**任何代码改动严禁未经本地实测验证直接执行 `git push`！**

每次对本项目代码（前端 [index.html](file:///Users/tau/Documents/code/answer/index.html)、服务端 [server.js](file:///Users/tau/Documents/code/answer/server.js)、抽签算法 [pages.js](file:///Users/tau/Documents/code/answer/pages.js) 或样式/动效/交互）进行修改后，必须严格遵循四步闭环工作流：

---

### 第一步：代码修改与服务热重载 (Edit & Reload)
1. 完成文件修改后，检查代码语法与逻辑完整性。
2. 若改动涉及 [server.js](file:///Users/tau/Documents/code/answer/server.js) 或 [pages.js](file:///Users/tau/Documents/code/answer/pages.js)，必须确保本地服务端正常重启：
   - 检查服务端口 3900 状态。
   - 请求 `http://localhost:3900/api/health` 确保返回 `{"status":"ok",...}`。

### 第二步：本地多维度实测 (Local Testing & Verification)
必须在本地环境下针对改动点进行真实测试，验证通过方可继续：
1. **接口与算法验证（服务端/数据层）**：
   - 使用多组典型问题（情感、事业、抉择、生活琐事等）请求 `/api/ask` 多次。
   - 核验返回数据格式合法性、神谕选页多样性（杜绝特定问题锁定单页）、字数区间（严格 75~100 字）、语气留白克制性。
2. **UI、动效与视觉表现验证（前端/交互层）**：
   - 若修改涉及 UI 布局、CSS 动效、翻书效果或粒子系统，必须使用 Puppeteer 脚本在真实移动端视口（如 iPhone 14 Pro）下截取完整流程关键帧。
   - 重点核对：
     - **翻书过程**：3D 纸张翻转自然、有墨痕与立体透视，无底层表单重影穿帮，无旋转圈遮挡。
     - **粒子流动**：平滑星轨流动，杜绝高频逐帧抖动或瞬移。
     - **排版基准**：左页与右页垂直居中、底部页码与朱砂「天机」印章左右对称工整。
     - **时序仪式感**：神谕打字期间隐藏操作按钮，打印完成后平滑淡入。
3. **控制台与报错零容忍**：
   - 确保无控制台 JavaScript 报错、无网络 4xx/5xx 异常。

### 第三步：汇报实测结果 (Report Results)
- 向用户展示本地测试的结果与数据对比，确保效果符合预期。

### 第四步：清理并 Push (Clean, Commit & Push)
1. 清理所有测试生成的临时脚本与临时产物，确保 `git status` 干净无污染。
2. 编写规范语义化的 Commit 消息：
   `git add <files> && git commit -m "feat/fix: <改动说明>"`
3. 推送至远程仓库：
   `git push origin main`
