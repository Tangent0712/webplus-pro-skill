---
name: webplus-pro
description: Use when building, editing, importing, binding, or debugging any site on NJUPT WebPlus Pro (南京邮电大学网站群 / admin.njupt.edu.cn / `_web`, `_s<N>`, `main.psp`, `list.psp`, `page.psp`, `frag="窗口"`, `portletmode`, `savePage.rst`, `templateBinding`, `contentBlock`, `templateBinding`). Covers the full production chain (recon → template package → import → bind → columns → articles → verify → publish) plus hidden admin APIs, template syntax, delivery packaging, and known traps. Generic across sites; site/template/column IDs are discovered per task.
license: MIT
metadata:
  domain: webplus-pro
  platform: 苏迪科技 WebPlus Pro（NJUPT 网站群）
---

# NJUPT WebPlus Pro 站点生产与交付（通用）

适用于 `admin.njupt.edu.cn` 下的**任意站点**（各学院/部门/专题站）。
WebPlus Pro **不能改源码**，只能做「模板包 + 后台配置」。本 skill 是从实战项目
（战邮红色文化协同研究中心，site 444 / 模板 4315）提炼的通用方法论与工具集。

> 文中 `<siteId>` / `<templateId>` / `<pageId>` / `<columnId>` / `<folderId>` 都是占位符，
> 每个任务先按 §2 侦察出真实值。`scripts/wp.mjs --as=<siteId>` 指定目标站点。

## 0. 铁律（先看这条，能省一天）

1. **未绑定数据源的 `frag="窗口NN"` 会被系统清空或输出字面量 `null`**。
   纯静态内容必须用普通 `<div>`，绝不能放进 `frag` 窗口。
2. **后台「窗口登记」会覆盖模板 HTML**：窗口登记成什么组件，前台就渲染什么；
   登记为空组件 → 整块清空。
3. **前台 `/{虚拟目录}/main.psp` 是实时的**：改页面 + 清缓存即生效，不需要站点发布。
   发布只影响对外域名（需超管「系统站点 → 站点发布」）。
4. **不要硬编码 `_p` 令牌到仓库**。令牌是明文 query 的 base64url（无签名），可现算：
   `as=<siteId>&p=1&m=N&` → base64url。越权 `as` 会 403。
5. **不要用正则批量改 HTML 结构**（极易少/多闭合 `<div>`）。改完必须用 DOM 解析校验，
   或至少逐页 `curl` 检查关键块。
6. **`{标题}` 会被 Portlet 包成 `<a>`**。再套一层 `<a href="{文章URL}">` 会产生嵌套 `<a>`，
   浏览器自动闭合外层，整行 DOM 塌陷。列表项不要包 `<a>`，用 CSS 给生成的链接上样式。
7. **Tailwind 编译产物常缺类**（`.hidden`/`.lg:flex`/`.py-16`/`.line-clamp-*` …）。
   关键工具类直接内联进页面 `<head>` 的 `<style>`，不要赌 `style.css` 里有。
8. **`{站点URL}` 不能出现在 CSS `url()` 或 data URI 里**，WebPlus 会把它重写成
   `/_upload/.../data:image...` 之类的坏路径。URL 前缀用相对路径最稳。

## 1. 环境与浏览器自动化

- 后台需**人工登录**（用户名/密码，或统一认证），agent 不能代登录。
- 用独立 profile + 远程调试启动浏览器，用户登录一次，之后 Playwright 复用：

```bash
# macOS
"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/wp-edge-profile \
  --no-first-run --no-default-browser-check --remote-allow-origins='*'
# Windows: "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" 同上参数
```

- 连接（`playwright-core`，无需下载浏览器）：

```js
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('admin.njupt.edu.cn'));
```

- **首选在已登录页面里 `page.evaluate(fetch(...))` 调后台 API**（`credentials:'include'`），
  比 `page.goto` 稳得多，也不刷屏。`new_page().goto()` 偶尔 `ERR_CONNECTION_CLOSED`。
- 调试脚本放临时目录，不要把 `_p`、cookie、账号写进仓库。
- 结束前关掉多余标签页，只留核心后台页（吃内存）。

工具：`scripts/wp.mjs`（Node ESM，需 `npm i playwright-core`，或用
`WP_PLAYWRIGHT=<playwright-core 包目录>` 指向已有安装）。
`reference/api.md` 接口清单，`reference/template-syntax.md` 模板语法与字段表。

## 2. 侦察：从零摸清一个站点

**所有 ID 都可以从公开页面/接口推导，不必先登后台：**

| 要找什么 | 怎么找 |
|---|---|
| 站点 ID `<siteId>` | 前台任意页源码里的 `sudy-wp-siteId="<id>"`，或页尾 `/_visitcount?siteId=<id>` |
| 虚拟目录 `<vd>` | 前台入口 `/{vd}/main.psp`；无虚拟目录时是 `/_s<siteId>/main.psp` |
| 模板 ID `<templateId>` | 页面源码里 `/_upload/tpl/**/template<ID>/`；或后台模板管理列表 |
| 页面 ID `<pageId>` | `getPages.rst?templateId=` 或设计器 URL 的 `pageId=` |
| 栏目 ID `<columnId>` | 文章 URL `/yyyy/MMdd/c<栏ID>a<文ID>/page.psp` 里含栏目 ID；或 `columns.rst` 查树 |
| 内容文件夹 `<folderId>` | `folder/tree.rst`（节点 id） |

后台入口（菜单 `data-src` 就是 URL）：

| 功能 | 路径 |
|---|---|
| 模板管理 | `/_web/_tpl/_templateMain.jsp?menuId=12` |
| 栏目管理 | `/_web/_column/_columnManageMain.jsp?menuId=11` |
| 模板绑定 | `/_web/_columntpl/columnTplIndex.jsp?menuId=13` |
| 文档管理 | `/_web/_cms/folder/_articleManageIndex.jsp` |
| 缓存清理 | `/_web/_core/caches/userCaches.jsp` |

常用只读接口（完整清单见 `reference/api.md`）：

```
GET /_web/sopplus/portlet/api/getPages.rst?templateId=<tid>&_p=<siteId>      # 页面列表
GET /_web/_column/api/columns.rst?_p=<siteId>&columnId=<根栏目>&showType=0    # 栏目树
GET /_web/_cms/folder/api/folder/tree.rst?_p=<siteId>&isNeedShowAllFolder=true
GET /_web/_cms/folder/api/articles.rst?_p=<siteId>&hasOnlyDraft=false&siteFolderId=<fid>
GET /_web/_tpl/sop.urls?_p=<siteId>                                           # 设计器全部 API
GET /_web/_tpl/page/sopWindowConfMain.jsp?...&portletId=wNN&pageId=&templateId=  # → portletDoId
GET /_upload/tpl/{xx}/{xx}/template<tid>/<file>                               # 模板静态文件（免登录）
```

**关键洞察**：模板文件本身是公开静态资源，`main.htm / listcolumn.htm / displayinfo.htm / style.css / images/*`
都能直接 `curl` 下来 —— 即使没有后台登录，也能把线上模板导回仓库（`wp.mjs pull`）。

`_p` 令牌：`as=<siteId>&t=<tid>&d=<pageId>&p=1&m=N&` 之类的明文 query 直接 base64url。

## 3. 生产链路（端到端）

### 3.1 设计 → 模板包
- 模板包 = **zip 根目录**直接放 `main.htm`、`listcolumn.htm`、`displayinfo.htm`（必须这三个），
  外加 `style.css`、`extends/`、`images/` 等资源。打包时**排除 `.md`**。
- 首页 `main.htm`、列表页 `listcolumn.htm`、文章页 `displayinfo.htm`；其余 `.htm` 会作为
  「文件页」（type=100）导入，可用于成员/论著/数据库等特殊栏目。
- 内页若沿用官方模板，就直接用官方 `listcolumn.htm`/`displayinfo.htm` 作为底子。

### 3.2 导入模板（新建模板 ID）
```bash
node scripts/wp.mjs import ./template.zip "我的模板_v1" --as=<siteId>
# 内部两步：
# 1) POST /doUpload.jsp   multipart 字段名 qqfile  → {success:true, fileName:'<uuid>.zip'}
# 2) POST /_web/_tpl/api/tpl/create.rst?_p=
#    name/enabled/staticed/tplLocale=1/mainTitleCustom/jqueryType=3/sourceType=1
#    zipFilePath=<uuid>.zip/picFilePath=
#    mainPath='[main.htm,UTF-8]main.htm'
#    listColumnPath='[listcolumn.htm,UTF-8]listcolumn.htm'
#    displayInfoPath='[displayinfo.htm,UTF-8]displayinfo.htm'
# → "success,<templateId>"
```

### 3.3 绑定页面到栏目
```bash
node scripts/wp.mjs bind <columnId> <bindingType 1|2|3> <pageId> <pageType 1|2|3> --as=<siteId>
# bindingType: 1=首页 2=列表页 3=文章页
# 注意路径是 /_web/_column/api/templateBinding/create.rst（不是 _columntpl！）
# body: pageId=&pageType=
```
绑到站点根栏目后子栏目自动继承。

### 3.4 建栏目 / 录文章
- 建栏目：`POST /_web/_column/api/column/create.rst?parentId=<父栏目>&_p=`，
  表单 `name`（必填）、`aliasName`（虚拟目录）、`navigationCK/navigation=true`、
  `readOnly=false`、`synchronize=true`、`complex=false`、`defaultMain=true`、
  `staticTypeId=0`、`selectColumn=0`、`act=add`、`id=0`。
- 文章编辑器：`GET /_web/_cms/folder/api/articleEdit/new.rst?_p=&defColumnId=&siteFolderId=&flowDefId=0&act=add&artTypeId=1`；
  「创建并发布」= `exportContent()` + 提交到 `createArticleAndPublishURL`；
  发布状态用 `articles.rst` 校验（`state` 为「已发布」）。
- 栏目 ↔ 文件夹：栏目默认对应同名内容文件夹；也可把多个文件夹挂到同一栏目。

### 3.5 改模板页面（两条路）
- **经典编辑器**（推荐，语法校验友好）：
  `POST /_web/_tpl/api/page/0.rst?_p=&templateId=&editType=e&_method=PUT`
  body `name=<页名>, id=<pageId>, saveType=e, content=<完整 HTML>`
  返回 `success`，或返回 JSON 警告（如「面板01下存在非法子对象"窗口内容"」）。
- **可视化设计器草稿**：
  `POST /_web/sopplus/portlet/api/savePage.rst` body `templateId,pageId,saveType,htmlString`。
- 两者改的可能是**不同存储**（草稿 vs 页面文件）。改完以 `main.psp` 实际输出为准。

### 3.6 清缓存
```bash
node scripts/wp.mjs clear-cache --as=<siteId>
# POST /_web/_core/caches/api/userCaches.rst?_p=&_method=delete&clearAll=1
```

### 3.7 验收
逐页 `curl` 断言：导航项数量、footer 存在、无字面量 `null`、无坏占位符、
列表页/文章页正常、搜索表单存在。必要时用 Playwright 真机回归 + 截图留档。

## 4. 动态数据：优先 Portlet 绑定，失败再前端兜底

**首选**（能进可视化设计器时）：给窗口绑定「信息来源」栏目。
- 取内容块：`GET /_web/sopplus/portlet/api/contentBlock/new.rst?templateId=&pageId=&windowId=wNN`
  → `siteEntityId` + `contentBlockId`（稳定，可复用）。
- 绑栏目：`POST /_web/_portlet/api/contentBlockConfig/0.rst?...&siteEntityId&contentBlockId&_method=PUT`
  body `selectColumnIds=<栏ID>&complexColumnName=&nodeId=`。
- 高级配置：`POST /_web/_portlet/api/contentBlockAdvConf/0.rst` body
  `displayType=1&resGetMode=1&articleType=0&resMaxReadRow=5&resLinkType=0&reFirstImgArticle=0`。
- 经典组件配置（已知 `portletDoId` 时）：
  `GET /_web/_portletconf/simplenew/api/simpleNew/new.rst?portletDoId=NN` 取表单 → POST 到 `create.rst`。
- 一键：`node scripts/wp.mjs bind-source <tid> <pageId> wNN <columnId> --as=<siteId>`

**兜底**（设计器绑定后前台仍 `null` / 排版无法控制时）：前端 JS 抓取。
- 静态容器占位（骨架 + `min-height` 防抖动），`fetch('xxx/list.psp')` → `DOMParser` 解析
  列表行，再 `fetch(文章URL)` 取 `.wp_articlecontent` 抽简介/首图。
- 相对路径（`tzgg/list.psp`）而不是绝对路径，才能同时兼容后台预览与对外域名。
- 列表不足时可在前端复制补齐，用于排版测试。
- 布局技巧：循环只能输出同构 HTML 时，用 `:first-child` / `:not(:first-child)` 切换
  「大图卡 / 小列表」两种形态。

## 5. 交付细节

推荐仓库结构（站点内容与工具分开）：

```
repo/
├── .opencode/skills/webplus-pro/   # 本 skill
├── docs/                           # API 笔记、复盘、约定
├── template/                       # 交付模板包源文件（打包时排除 .md）
├── template-v2-base/               # 官方底模板（参考，可删）
├── src/                            # 静态设计原型（非 CMS 交付物）
├── template<ID>.zip                # 最终可导入包
└── HANDOFF.md                      # 交接：状态、接口、坑、待办
```

交付物清单：
- [ ] 模板包 zip（根目录含 `main.htm/listcolumn.htm/displayinfo.htm` + 资源）
- [ ] 《配置指南》：栏目树 + ID/urlName、模板/页面 ID、绑定方式、录入规范、发布流程
- [ ] 《CONVENTIONS.md》：模板语法契约（标记、字段、portletmode）
- [ ] 回归证据：各代表页 URL + 截图/断言结果
- [ ] 交接文档：账号权限边界、未完成项（如超管发布）、测试残留物清理清单

权限边界：**对外域名发布 = 超管**「系统站点 → 站点发布」，普通子站点管理员没有该菜单，
构造越权 `as` 令牌会 403。交付时明确写清这一条。

## 6. 高频坑位速查

| 症状 | 根因 | 处理 |
|---|---|---|
| 前台出现字面量 `null` | `simpleList` 未绑「信息来源」 | 绑栏目，或前端兜底 |
| 模板改了前台没变 | 缓存 / 改错存储层 / 窗口登记覆盖 | 清缓存；确认改的是 `page/0.rst` 且窗口不是静态内容 |
| 静态区块整体消失 | 内容放进了 `frag="窗口NN"` | 改成普通 `<div>` |
| 导航塌成竖排 / 下拉 1 字宽 | 编译后的 `style.css` 缺 `.hidden`/`.lg:flex`/`.w-40`/`.top-full` | 内联补齐这些类 |
| 站点名样式丢失 | 字段被渲染成 `<span class='Site_Name'>` 而非 `{站点名称}` | 给 `.Site_Name` 写 CSS |
| 列表行日期换行/点不中 | `{标题}` 自带 `<a>` + 模板再包 `<a>` → 嵌套 | 列表项不包 `<a>`，样式化生成的链接 |
| 图片/图标不显示 | Base64 编码损坏（空格变 `!`）、`{站点URL}` 进了 `url()` | 校验 base64 解码；图标改用内联 SVG DOM |
| 搜索框按钮隐形/有系统底色 | `input[type=submit]` 被浏览器强制渲染系统样式 | 用 JS 换成真实 `<button>` + 内联 SVG |
| 搜索框展开/收起跳动 | 纯 CSS 折叠 hack 脆弱 | JS 控制 `.expanded`，宽度过渡 + 失焦收起 + 拦截空提交 |
| 子页面排版崩 | 正则改 HTML 破坏了 div 嵌套 | DOM 解析校验；精准整块替换 |
| 文章页太现代、甲方不喜欢 | 双栏侧栏设计 | 改单栏居中阅读，参考校内常规新闻页 |

## 7. 修改流程 SOP（每轮都照做）

1. 拉取线上现状（页面/模板文件）留底：`node scripts/wp.mjs pull <tid> ./_live --page=<url>`
2. 本地改 `template/*.htm`，**只动必要的整块**，避免全局正则。
3. 用 `page/0.rst` PUT 上传（返回 `success` 才算成功；有警告必须处理）。
4. 清缓存。
5. `curl` 关键页断言（无 `null`、结构完整、导航/页脚/搜索在）。
6. 需要交互验证时用 Playwright 跑一遍（无 pageerror）。
7. 更新 `HANDOFF.md` / `docs/`，重新打包 zip。
8. 关掉多余标签页。

## 8. 参考案例

本仓库 `zhanyou/` 是一个完整落地案例（site 444 / 模板 4315 / 虚拟目录 `/zhanyou/`）：
- 交付模板：`zhanyou/template/`，可导入包 `zhanyou/template444.zip`
- 配置指南：`zhanyou/template/配置指南.md`
- 实战笔记：`zhanyou/docs/webplus_api_notes.md`
- 交接文档：`HANDOFF.md`

该案例可作为「模板定制 + 前端兜底渲染 + 搜索组件重构」的参照，但**不要照抄其中的
站点/栏目/页面 ID**，那些都是该站点专属的。
