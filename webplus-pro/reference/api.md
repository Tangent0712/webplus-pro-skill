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

```
POST /_web/_column/api/column/create.rst?parentId=<父栏目>&_p=<siteId>
     name=<名>&aliasName=<urlName>&navigationCK/navigation=true&readOnly=false
     &synchronize=true&complex=false&defaultMain=true&staticTypeId=0&selectColumn=0&act=add&id=0

GET  /_web/_cms/folder/api/articleEdit/new.rst?_p=<siteId>&defColumnId=<cid>&siteFolderId=<fid>&flowDefId=0&act=add&artTypeId=1
     表单 #articleFM；保存草稿 saveArticle()；创建并发布 exportContent()+createArticleAndPublishURL
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
