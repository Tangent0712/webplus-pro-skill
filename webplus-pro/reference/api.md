# WebPlus Pro 后台 API 速查（NJUPT 通用）

占位符：`<siteId>` 站点 ID、`<tid>` 模板 ID、`<pid>` 页面 ID、`<cid>` 栏目 ID、`<fid>` 内容文件夹 ID、`<wid>` 窗口号（`w06`）。
所有路径都相对 `https://admin.njupt.edu.cn`。

约定：
- `_p` 令牌是**明文 query 的 base64url**，无签名，可现算：
  `as=<siteId>&p=1&m=N&` → base64url。越权 `as` 返回 403。
  常用变体：`as=<siteId>&t=<tid>&d=<pid>&p=1&m=N&`。
- 未登录访问后台 API 常返回 **404**（不是 401）；路径错也是 404；方法错是 **405**。
- 业务错误返回 JSON `{resultCode, errorMsg, result}`；成功常返回字符串 `success`
  或 `{"resultCode":"0","errorMsg":"success"}`。
- 在已登录页面里 `fetch(url, {credentials:'include'})` 调用最稳。

## 0. 身份 / 目标站点发现

```
前台任意页源码：sudy-wp-siteId="<siteId>"、/_visitcount?siteId=<siteId>
模板静态前缀：  /_upload/tpl/{xx}/{xx}/template<tid>/        （从页面 <link>/<img> 里读）
文章 URL：      /{vd}/{yyyy}/{MMdd}/c<cid>a<articleId>/page.psp
后台菜单 _p：   base64url 解码即得 as / t / d 等
```

## 1. 侦察

```
GET /_web/sopplus/portlet/api/getPages.rst?templateId=<tid>&_p=<siteId>
    → items[]: {id, type, name}  type: 1首页 2列表页 3文章页 100文件页

GET /_web/_column/api/columns.rst?_p=<siteId>&columnId=<根栏目>&showType=0
    → 栏目树（含 name / urlName / id / navigation）

GET /_web/_column/api/columnTpl/tree.rst?_p=<siteId>&templateId=null
    → 栏目 + 绑定信息（treegrid 数据）

GET /_web/_cms/folder/api/folder/tree.rst?_p=<siteId>&isNeedShowAllFolder=true
    → 内容文件夹树，节点 id = siteFolderId

GET /_web/_cms/folder/api/articles.rst?_p=<siteId>&hasOnlyDraft=false&siteFolderId=<fid>
    → 文章列表（state 为「已发布」才算发布成功）

GET /_web/_tpl/sop.urls?_p=<siteId>
    → 设计器全部 API URL 表（fetchPortlets/editWindowUrl/savePageUrl/…）

GET /_web/_tpl/page/sopWindowConfMain.jsp?_p=<siteId>&portletId=<wid>&pageId=<pid>&templateId=<tid>
    → 含 portletDoId=NN（窗口底层组件 ID）

GET /_upload/tpl/{xx}/{xx}/template<tid>/<file>
    → 模板静态文件（免登录）：main.htm / listcolumn.htm / displayinfo.htm / style.css / images/*
```

## 2. 模板与页面

```
POST /_web/_tpl/api/page/0.rst?_p=<siteId>&templateId=<tid>&editType=e&_method=PUT
    body: name=<页名>&id=<pid>&saveType=e&content=<完整HTML>
    → success | JSON 警告（模板语法非法，如「面板01下存在非法子对象"窗口内容"」）

POST /_web/sopplus/portlet/api/savePage.rst?_p=<siteId>
    body: templateId=&pageId=&saveType=&htmlString=
    （设计器草稿；与 page/0.rst 可能不是同一存储）

GET  /_web/sopplus/portlet/api/window/content.rst?_p=<siteId>&templateId=&pageId=&windowId=<wid>&siteEntityId=&contentBlockId=
    → { struct, isBindContentBlock, isNeedContentBlock, content }  content='null' 即前台会输出 null

POST /_web/sopplus/portlet/api/window/clear.rst?_p=<siteId>&templateId=&pageId=&portletId=<wid>
    → success（把窗口清成空窗，不再输出 null）
```

## 3. 模板导入 / 绑定

```
POST /doUpload.jsp            multipart, 字段名 qqfile
    → {success:true, fileName:'<uuid>.zip', priviewUrl:'/_temp/<uuid>.zip'}

POST /_web/_tpl/api/tpl/create.rst?_p=<siteId>
    name=<模板名>&enabled=true&staticed=false&tplLocale=1&mainTitleCustom=false
    &jqueryType=3&sourceType=1&zipFilePath=<uuid>.zip&picFilePath=
    &mainPath=[main.htm,UTF-8]main.htm
    &listColumnPath=[listcolumn.htm,UTF-8]listcolumn.htm
    &displayInfoPath=[displayinfo.htm,UTF-8]displayinfo.htm
    → "success,<新模板ID>"

POST /_web/_column/api/templateBinding/create.rst?_p=<siteId>&columnId=<cid>&bindingType={1|2|3}
    body: pageId=<pid>&pageType={1|2|3}
    → JSON {msg,icon,title}；失败信息「保存绑定模板设置失败！」
    注意：路径是 _web/_column/api/...，不是 _web/_columntpl/...
```

## 4. 动态数据（内容块）

```
GET  /_web/sopplus/portlet/api/contentBlock/new.rst?_p=<siteId>&templateId=&pageId=&windowId=<wid>
     → { siteEntityId, contentBlockId }

GET  /_web/sopplus/portlet/api/cbcColumn/tree.rst?_p=<siteId>&siteEntityId=&contentBlockId=
     → 可选源栏目树

POST /_web/_portlet/api/contentBlockConfig/0.rst?_p=<siteId>&siteEntityId=&contentBlockId=&_method=PUT
     body: selectColumnIds=<cid>&complexColumnName=&nodeId=
     → success

GET  /_web/sopplus/portlet/api/contentBlockConfigs.rst?_p=<siteId>&siteEntityId=&contentBlockId=
     → 已绑定列表

POST /_web/_portlet/api/contentBlockAdvConf/0.rst?_p=<siteId>&siteEntityId=&contentBlockId=&_method=PUT
     body: displayType=1&resGetMode=1&articleType=0&resMaxReadRow=5&resLinkType=0&reFirstImgArticle=0

GET  /_web/sopplus/portlet/api/cbcConfig/edit0.rst?_p=<siteId>&siteEntityId=&contentBlockId=
     → 高级配置字段定义（含 currentValue）

经典组件（已知 portletDoId）：
GET  /_web/_portletconf/simplenew/api/simpleNew/new.rst?_p=<siteId>&portletDoId=NN   → 表单
POST /_web/_portletconf/simplenew/api/simpleNew/create.rst?_p=<siteId>               → 保存（返回 success）
```

## 5. 栏目 / 文章

### 5.1 栏目树 / 读取

```
GET /_web/_column/api/columns.rst?_p=<siteId>&columnId=<根栏目>&showType=0
    → {rows:[{id, cid, name(HTML), urlName, opened, readOnly, complex, ...}]}（该父栏目的直接子栏目）
GET /_web/_column/api/columns.rst?_p=<siteId>&showType=0            → rows:[]（必须带 columnId）
GET /_web/_cms/folder/api/folder/tree.rst?_p=<siteId>&isNeedShowAllFolder=true
    → [{id,text,children}]（内容文件夹；新建栏目会同步同名文件夹）
```
> `columns.rst` 的 `name` 是 HTML 片段（含 `<a href="/{vd}/{urlName}/list.psp">名称</a>`），
> 真实子栏目 ID 取 `id`；文章 URL 里的 `c<ID>` 是**栏目 ID**。

### 5.2 新建栏目（**必须带全字段**，否则返回「操作出错，未明确错误原因」）

```
POST /_web/_column/api/column/create.rst?parentId=<父栏目ID>&_p=<siteId>
Content-Type: application/x-www-form-urlencoded

id=0&syncFolderId=&subColumnOrderId=10&picDelete=false&iconPicDelete=false&act=add
&name=<名>&aliasName=<简称>&markName=&complex=false
&navigationCK=on&navigation=true            # 隐藏栏目：去掉 navigationCK，navigation=false
&readOnly=false&staticTypeId=0&synchronizeCK=on&synchronize=true
&link=&target=&urlName=<urlName>&subColumnOrder=10&iconPath=&picPath=
&selectColumn=0&mainColumnId=0&defaultMainCK=on&defaultMain=true&putMainOfChildren=false
&metaKeywords=&metaDescription=&summary=&diplayModel=0&showRule=0&rowCount=&colCount=
&titleFormat=&titleLength=&timeFormat=&thumbPicMode=0&thumbPicWidth=&thumbPicHeight=
&picMode=0&picWidth=&picHeight=
    → "success"（失败为 JSON {msg:"操作出错，未明确错误原因",icon:"error"}）
```
> 只需「名称」即可创建；但 `subColumnOrderId`、`act=add`、`diplayModel`、`showRule` 等**缺一不可**。
> 最稳的获取方式：打开「栏目管理 → 增加」页面，抓一次真实表单提交的 body 照抄（见 §9 逆向套路）。
> 新建成功后栏目自动获得同名内容文件夹（`folder/tree.rst` 里可见），两者 ID 通常不同。

### 5.3 删除栏目 / 移动排序

```
POST /_web/_column/api/columnMoveSort/create.rst?_p=<siteId>&showType=0&parentId=<父>&ids=…  # 拖拽排序
（删除栏目走栏目管理页的删除按钮；一般直接删内容文件夹即可）
```

### 5.4 发布文章（新增 + 直接发布）

```
POST /_web/_cms/folder/api/publishArticle/create.rst?_p=<siteId>&siteFolderId=<fid>&artTypeId=1
Content-Type: application/x-www-form-urlencoded

siteFolderId=<fid>&title=<标题>&articleType=1&publisher=<作者>&newsDate=<yyyy-MM-dd>
&pageNum=1&pageContent0=<正文 HTML>      # ★ 正文真实字段名是 pageContent0（不是 content）
&thumbImagePath=<封面图文件名>           # ★ 封面/缩略图字段
    → "success"
```
- **正文图片引用 `/_temp/<file>`**：发布时系统会把文件搬到
  `/_upload/article/images/xx/xx/<file>` **并改写 src**（永久可用）。
  参考完整 HTML：`<p><img src="/_temp/<file>" /></p>`。
- 只存草稿/走流程：同目录下 `finalizeArticle/create.rst`（定稿）、`articleEdit/new.rst`（表单）。
- 编辑器表单里正文 textarea 的 name 就是 `pageContent0`，
  `saveArticle()` 内部先 `exportContent()` 把富文本写回该字段。

### 5.5 列出 / 删除文章

```
POST /_web/_cms/folder/api/articles.rst?_p=<siteId>&hasOnlyDraft=false&siteFolderId=<fid>
    → {total, rows:[{id, artId, articleTitle(HTML), state:"<font color='blue'>已发布</font>", ...}]}
      id    = siteArticleId（删除/编辑用）
      artId = 文章 ID（出现在前台 URL 的 c<栏目ID>a<artId>）

POST /_web/_cms/folder/api/articles.rst?_p=<siteId>&_method=delete&siteFolderId=<fid>
     body: selectedIds=<id1,id2,...>          # ★ 字段名是 selectedIds（用 ids 会返回 {"icon":"warning"} 且不生效）
    → "success"
```

### 5.6 文章编辑表单（读字段名）

```
GET /_web/_cms/folder/api/articleEdit/new.rst?_p=<siteId>&defColumnId=<cid>&siteFolderId=<fid>&flowDefId=0&act=add&artTypeId=1
    → 表单 #articleFM，含（部分）：
      title / shortTitle / pageContent0 / thumbImagePath / thumbImagePath1 / linkUrl / summary
      createArticleAndPublishURL  = ../publishArticle/create.rst?_p=…&siteFolderId=<fid>&artTypeId=1
      createArticleAndFinalizeURL = ../finalizeArticle/create.rst?_p=…&siteFolderId=<fid>&artTypeId=1
```

## 6. 缓存 / 发布

```
POST /_web/_core/caches/api/userCaches.rst?_p=<siteId>&_method=delete&clearAll=1
     → success

前台实时地址：/{vd}/main.psp、/{vd}/{urlName}/list.psp、
             /{vd}/{yyyy}/{MMdd}/c<cid>a<articleId>/page.psp
无虚拟目录时：/_s<siteId>/main.psp、/_s<siteId>/<cid>/list.psp
对外域名发布：仅超管「系统站点 → 站点发布」（子站点后台无此菜单，构造越权 as 会 403）
```

## 7. 返回码经验

| 现象 | 含义 |
|---|---|
| 404（HTML 错误页） | 未登录 / 路径不存在 |
| 405（Method Not Allowed） | 接口只支持 GET（或只支持 POST） |
| `{"resultCode":"0","errorMsg":"success"}` | 成功 |
| 裸字符串 `success` | 成功（老接口） |
| `resultCode: '19' 获取内容块基本参数异常` | windowId 或 templateId/pageId 不匹配 |
| `resultCode: '18' 缺少组件Id！` | 需要 portletDoId |
| `resultCode: '25' 获取backendParams参数异常` | 设计器结构保存缺内部参数，改用经典 `page/0.rst` |
| `resultCode: '2' 页面类型为空！` | 接口需要 `pageType` |
| `resultCode: '5' 缺少窗口Id` | 接口需要 `windowId` |
| `resultCode: '21' 缺少id` | 需要 `id` 参数 |

## 8. 设计器 / 组件 / 模板资源

```
GET  /_web/sopplus/portlet/api/getPages.rst?templateId=<tid>&_p=<siteId>
     → {items:[{id,type,name,url}]}  → 可拿到首页/列表页/文章页/文件页的 pageId

GET  /_web/sopplus/portlet/api/portlets.rst?pageType=1&templateId=<tid>&pageId=<pid>&_p=<siteId>
     → 组件目录（74 个），按「常用/新闻/图片/栏目/组件/其他」分组：
       {zjmc:"新闻列表", zjid:"ptDef36_simpleNews", confpage:"/_web/_portletconf/simplenew/api/simpleNew/new.rst?portletDoId=36&defModeName=SimpleNewsPortlet&_p=…"}
       图片类含「多图交替1/2/…」「图片滚动」「sudyfocus1.4-带缩略图切换」等；
       { pageType 缺省 → {"resultCode":"2","errorMsg":"页面类型为空！"} }

GET  /_web/sopplus/portlet/api/modeTypes/new.rst?_p=<siteId>
     → 模板「模式」列表（normal/simpleNews/nav/simpleSudyNavi/columnList/simpleList/simpleSiteAttri/…）
       每项含 structureTags（InfoCycleBegin…）与 attrTags（{标题} {内容} …）

GET  /_web/_tpl/sop.urls?_p=<siteId>          # 设计器整套 API 表
```

模板「资源文件」管理（**只能放 CSS/JS，不能放图片**；`images/` 为禁改目录）：

```
GET  /_web/_tpl/sopTplResFiles.jsp?templateId=<tid>&_p=<siteId>       # 资源文件管理页
POST /doUpload.jsp?_p=<siteId>                                        # 先上传到 /_temp
POST /_web/_tpl/api/file/create.rst?templateId=<tid>&_p=<siteId>      # type=2 本地上传，落地到模板目录
```
> 结论：模板里的 `images/` 无法通过后台接口增删；要换模板图片，
> 要么走「重新导入模板 zip」，要么**改用文章正文图（`/_upload/article/...`）由前端引用**（推荐）。

## 9. 逆向套路（接口/参数未知时）

1. 打开对应「表单页 / 管理页 / 设计器」，用 Playwright `page.on('request')` 抓真实提交。
   例：新建栏目的 body 就是从 `_web/_column/api/column/new.rst?…&act=add` 表单提交里抓到的。
2. `page.on('pageerror')` 抓内联脚本语法错误（WebPlus 重写会制造 `Invalid regular expression flags`）。
3. 表单字段名优先从前端 JS 找：正文=`pageContent0`、封面=`thumbImagePath`、
   删除 `articles.rst` 用 `selectedIds`、搜索字段 `keyword`。
4. 上传文件统一先 `POST /doUpload.jsp`（字段名 `qqfile`），
   返回**非严格 JSON**：`{success:true,fileName:'<uuid>.<ext>',priviewUrl:'/_temp/<uuid>.<ext>'}`，
   用正则 `/fileName\s*:\s*'([^']+)'/` 提取，别直接 `JSON.parse`。
