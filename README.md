# webplus-pro-skill

南京邮电大学 **WebPlus Pro**（苏迪科技网站群，`admin.njupt.edu.cn`）站点生产与交付的通用 Agent Skill。

适用于「不能改源码，只能做模板包 + 后台配置」的网站群场景，覆盖：

- **完整生产链路**：侦察 → 模板包 → 导入模板 → 绑定页面 → 建栏目/文件夹 → 录文章 → 清缓存 → 验收 → 交付打包
- **隐藏后台 API**：`savePage.rst` / `templateBinding` / `contentBlock` / `portletDoId` / 上传导入 / 缓存清理 /
  建栏目 / 发布文章（`publishArticle` + `pageContent0`）/ 删除文章（`articles.rst?_method=delete`）
- **模板语法契约**：`frag="面板/窗口/窗口内容"`、`portletmode`、`InfoCycle`、字段表、日期格式
- **前端兜底渲染**：Portlet 绑定失效时用 JS 抓 `list.psp` 渲染动态列表；含**轮播图配方**（静态骨架 + 首图提取 + `localStorage`/`CacheStorage` 本地缓存）
- **踩坑速查**：字面量 `null`、窗口被后台登记覆盖、Tailwind 工具类缺失、`{标题}` 嵌套 `<a>`、
  WebPlus 重写 `URL(...)` 导致内联脚本报错、设计器 header 竖排、搜索组件重构等
- **CLI 工具**：`scripts/wp.mjs`（侦察 / 拉取模板 / 导入 / 绑定 / 保存页面 / 建栏目 / 发布·删除文章 / 上传 / 清缓存）

## 更新日志

- **2026-09-21**：补齐「建栏目 / 发布文章 / 删除文章」的完整接口与参数（含 `pageContent0` 正文、
  `/_temp` → `/_upload/article/images` 图片落盘时机）；新增轮播图配方与前端本地缓存方案；
  记录 WebPlus 重写 `URL(` 的隐蔽坑与设计器 header 面板/多余 `</div>` 问题；
  `wp.mjs` 新增 `columns / col-create / upload / article-create / article-delete` 命令。

## 安装

Skill 是通用的 `SKILL.md` 目录格式，把 `webplus-pro/` 整个文件夹放到对应 agent 的 skills 目录：

| Agent | 目录 |
|---|---|
| 跨 agent 通用（推荐） | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| opencode | `~/.config/opencode/skills/` |
| Codex CLI | `~/.codex/skills/` |
| Gemini CLI | `~/.gemini/skills/` |

```bash
git clone git@github.com:Tangent0712/webplus-pro-skill.git
cp -R webplus-pro-skill/webplus-pro ~/.agents/skills/
```

项目级安装则放进仓库内：`.claude/skills/`、`.opencode/skills/` 等。

安装后**重启 agent**（skill 一般在启动时加载）。

## CLI 依赖

`scripts/wp.mjs` 需要 Node 18+ 与 `playwright-core`：

```bash
npm i playwright-core
# 或指向已有安装
WP_PLAYWRIGHT=/path/to/node_modules/playwright-core node scripts/wp.mjs --help
```

使用前需以远程调试端口启动浏览器并**人工登录后台**：

```bash
# macOS 示例
"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/wp-edge-profile \
  --no-first-run --no-default-browser-check --remote-allow-origins='*'
```

常用命令：

```bash
# 免登录侦察：站点ID / 模板ID / 静态前缀 / 栏目ID
node webplus-pro/scripts/wp.mjs discover https://admin.njupt.edu.cn/<vd>/main.psp

# 免登录拉取线上模板（含 images/extends/css 资源）
node webplus-pro/scripts/wp.mjs pull <templateId> ./out --page=<该模板渲染的页面URL>

# 导入模板 / 绑定页面 / 保存页面 / 清缓存（需已登录）
node webplus-pro/scripts/wp.mjs import ./template.zip "模板名" --as=<siteId>
node webplus-pro/scripts/wp.mjs bind <columnId> <1|2|3> <pageId> <1|2|3> --as=<siteId>
node webplus-pro/scripts/wp.mjs save-page <templateId> <pageId> ./main.htm --as=<siteId>
node webplus-pro/scripts/wp.mjs clear-cache --as=<siteId>

# 栏目 / 文章 / 上传
node webplus-pro/scripts/wp.mjs columns <parentColumnId> --as=<siteId>
node webplus-pro/scripts/wp.mjs col-create <parentColumnId> "栏目标题" <urlName> --hidden --as=<siteId>
node webplus-pro/scripts/wp.mjs articles <siteFolderId> --as=<siteId>
node webplus-pro/scripts/wp.mjs article-create <siteFolderId> "文章标题" --image=./hero.jpg --as=<siteId>
node webplus-pro/scripts/wp.mjs article-delete <siteFolderId> <siteArticleId[,id2]> --as=<siteId>
node webplus-pro/scripts/wp.mjs upload ./pic.jpg --as=<siteId>
```

> 文章正文里的图片引用 `/_temp/<file>` 时，**发布时系统会自动搬到** `/_upload/article/images/...`
> 并改写 `src` —— 无需自建图床。

`--as` 可省略：脚本会从当前打开的后台页 `_p` 中自动解析站点 ID。

## 文件结构

```
webplus-pro/
├── SKILL.md                     # 主流程：铁律 / 侦察 / 生产链路 / 交付 / SOP
├── reference/
│   ├── api.md                   # 后台 API 清单 + 返回码经验
│   ├── template-syntax.md       # 模板标记 / 字段 / portletmode / 兜底渲染
│   └── pitfalls.md              # 易错点 + 可照抄配方（搜索框/分页/导航高亮/面包屑/兜底渲染）
└── scripts/
    └── wp.mjs                   # CLI 工具
```

## 说明

- 文中 `<siteId>` / `<templateId>` / `<pageId>` / `<columnId>` / `<folderId>` 均为占位符，按 `SKILL.md` §2 侦察出真实值。
- 不含任何账号、Cookie、`_p` 令牌等凭证；后台 API 调用复用使用者自己的登录态。
- 对外域名发布需要**超级管理员**权限（「系统站点 → 站点发布」），普通子站点管理员没有该菜单。
