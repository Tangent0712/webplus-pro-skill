# WebPlus Pro 模板语法契约（NJUPT 通用）

来源：官方 v2 响应式通用模板 + 多个线上模板实测。
不同模板的字段/class 约定可能不同 —— 以「目标模板实际渲染出的 HTML」为准，
本文件给的是通用规律与最常踩的坑。

## 1. 结构标记

```html
<body>
<!--Start||headTop--> … <!--End||headTop-->
<!--Start||head-->    … <!--End||head-->
<!--Start||nav-->     … <!--End||nav-->
<!--Start||focus-->   … <!--End||focus-->   <!-- 横幅/轮播 -->
<!--Start||content--> … <!--End||content-->
<!--Start||footer-->  … <!--End||footer-->
</body>
```

- **面板**：`<div frag="面板NN">`，纯分组，可省。
- **窗口**：`<div frag="窗口NN" portletmode="…">`，数据挂载点，同页唯一。
- **窗口内容**：`<div frag="窗口内容">`，真正被渲染/循环的区域；绑定窗口建议写上。
- **静态内容不要放进 `frag="窗口NN"`**：后台窗口登记会覆盖/清空模板 HTML。

## 2. portletmode 对照

| portletmode | 含义 | 常用位置 |
|---|---|---|
| `simpleSiteAttri` | 站点属性（名称/Logo/版权/电话） | header / footer |
| `simpleSiteName` / `simpleSiteLogo` | 站点名 / Logo | header |
| `simpleColumnAnchor` | 当前栏目名 `{栏目名称}` | 列表页标题 |
| `simpleColumnAttri` | 栏目属性 `{当前位置}` `{栏目名称}` | 面包屑 / 横幅 |
| `simpleColumnList` | 当前栏目的子栏目树 | 列表页侧栏 |
| `simpleColumnPath` | 栏目路径（PathCycle） | 面包屑 |
| `simpleList` | 文章列表（Info 循环） | 首页 / 列表页 |
| `simpleArticleAttri` | 文章属性（标题/时间/内容…） | 文章页 / 单页 |
| `simpleSudyNavi` | 多级栏目导航（Navi 循环） | 顶部主菜单 |
| `search` | 系统搜索组件 | header |
| `windowTitle` / `windowMore` | 窗口标题 / 更多按钮 | 首页板块 |

不写 `portletmode` = 静态窗口（后台仍可改绑）。**未绑定数据源的窗口输出 `null` 或被清空。**

## 3. 循环标记

```html
<!-- 文章循环 -->
<!--[InfoCycleBegin]-->
  <li class="news-row">
    <span class="t"><!--[FieldCycleBegin]-->{标题}<!--[FieldCycleEnd]--></span>
    <span class="d">{发布时间}</span>
  </li>
<!--[InfoCycleEnd]-->

<!-- 导航 -->
<!--[NaviStructBegin]--> … <!--[NaviItemCycleBegin]--> … 
  <!--[MenuStructBegin]--> … <!--[MenuItemCycleBegin]--> … <!--[SubMenuList]--> … <!--[MenuItemCycleEnd]--> … <!--[MenuStructEnd]-->
… <!--[NaviItemCycleEnd]--> … <!--[NaviStructEnd]-->

<!-- 栏目树 -->
<!--[ColumnStructBegin]--> <!--[ColumnCycleBegin]--> … <!--[SubColumnStructBegin]--> … <!--[ColumnCycleEnd]--> … <!--[ColumnStructEnd]-->
<!-- 栏目路径 -->
<!--[PathCycleBegin]--> / <a href="{栏目URL}">{栏目名称}</a> <!--[PathCycleEnd]-->
```

## 4. 字段速查

- 站点：`{站点URL} {站点名称} {站点Logo} {站点版权} {站点电话}`
- 栏目：`{栏目名称} {栏目URL} {栏目图片URL} {当前位置} {打开方式} {级别样式} {选中样式}`
- 文章：`{标题} {标题内容} {副标题} {简介} {内容} {发布者} {发布时间} {动态浏览次数}`
  `{文章URL} {缩略图} {图片路径} {附件} {序号值} {上一篇} {下一篇} {更多按钮}`
- 日期格式：`{发布时间(yyyy)} {发布时间(MM)} {发布时间(dd)} {发布时间(yyyy-MM)} {发布时间(MM-dd)} {发布时间(MM.dd)}`

## 5. 真实模板的「非官方」约定（踩过坑）

1. **站点名可能渲染成 class 而非字段**：
   `simpleSiteAttri` 窗口被渲染为 `<span class='Site_Name'>站名</span>`，
   footer 同理 `.Site_Name` / 栏目 `.Column_Name`。→ 给这些 class 写 CSS，而不是用 `{站点名称}`。
2. **`{标题}` 自带 `<a>`**（启用标题绑链接时）：
   `title="{标题}"` 会把 `<a>` 注入属性；`<a href="{文章URL}">{标题}</a>` 会嵌套 `<a>` 导致 DOM 塌陷。
   → 列表项不要包 `<a>`，用 CSS 修饰生成的链接（`.news-row .t a{color:inherit;text-decoration:none}`）。
3. **`{栏目名称}` 在非循环处可能不替换**（视 portlet 而定）→ 该位置写静态文本。
4. **编译后的 `style.css` 常缺工具类**：`.hidden`、`.lg:flex`、`.w-40`、`.top-full`、
   `.py-12/.py-16`、`.line-clamp-*`、`.md:col-span-*`、`.truncate`、`.sticky` 等。
   → 关键类内联进 `<head>` 的 `<style>`（最稳，不怕缓存）。
5. **`{站点URL}` 不能出现在 CSS `url()` / data URI 中**，会被重写成坏路径。
   URL 前缀优先用相对路径（`tzgg/list.psp`）。
6. **响应式 display 工具类缺失会「藏内容」**：`<aside class="hidden md:block">` 若
   `.md:block` 缺失，内容永远不显示。补齐 `@media (min-width:768px){.md\:block{display:block}}`。
7. **栏目已发布文章只有 1 篇时，列表页会渲染成单篇正文**（输出 `wp_single wp_column_article`
   而不是 `InfoCycle` 列表）。此时前端按列表解析（如找 `.news-row`）会拿不到数据 →
   表现成「暂无数据」。**发布 ≥2 篇即可恢复列表**；单页栏目（简介/联系我们）本就是单篇，属预期。
   判断方法：`curl /{vd}/{urlName}/list.psp | grep -c 'class="news-row"'`。

## 5.5 面包屑 / 侧栏的两个常见坑

1. **`{当前位置}` 自带「首页」**：渲染结果是 `<a>首页</a><span class='possplit'>…</span><a>栏目</a>…`。
   模板若在它前面再写一个「首页」链接 → 出现「首页 / 首页 中心新闻」。
   修法：加一段 JS 去掉 `{当前位置}` 容器里第一个 `<a>` 与第一个 `.possplit`：
   ```js
   document.querySelectorAll('[frag="窗口05"] span,[frag="窗口10"] span').forEach(function(span){
     if (!span.querySelector('.possplit')) return;
     var a = span.querySelector('a'), s = span.querySelector('.possplit');
     if (a) a.remove(); if (s) s.remove();
   });
   ```
2. **`simpleColumnPath` 可能不渲染**（输出空 div）。改用 `simpleColumnAttri` + `{当前位置}` 即可，
   再配合上面的去重脚本。
3. **叶子栏目（如「联系我们」）的侧栏会渲染成一个空的「栏目导航」卡片**。
   修法：检测 `[frag="窗口06"]` 内没有 `a[href]` 时隐藏整个 `aside`，主内容区自动占满：
   ```js
   var box = document.querySelector('[frag="窗口06"]');
   if (box && !box.querySelector('a[href]')) { var a = box.closest('aside'); if (a) a.style.display='none'; }
   ```

## 6. 前端兜底渲染（当 portlet 绑定不可用时）

```html
<div id="dynamic-news-container" style="min-height:420px">…骨架…</div>
<script>
(async function(){
  const res = await fetch('tzgg/list.psp');           // 相对路径，兼容预览与正式域名
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const rows = Array.from(doc.querySelectorAll('.news-row')).slice(0, 4);
  // 首条大图卡 + 其余小列表：模板里同时写两种形态，用 :first-child / :not(:first-child) 切换
})();
</script>
```

要点：
- 先给容器固定 `min-height` 再显示 loading，避免 CLS 抖动；loading 图标写死 `style="width:24px;height:24px"`（不要依赖可能缺失的工具类）。
- 抽正文/首图：`fetch(文章URL)` → `.wp_articlecontent`（`innerText` 做简介，`img.src` 做缩略图），失败给 `onerror` 占位图。
- 占位图可用 Base64 内联，避免服务器静态资源损坏；**校验 base64 能正确解码**（曾有空格被转成 `!` 导致图标消失）。

## 6.5 分页组件美化（`#wp_paging_wNN`）

WebPlus 的 `simpleList` 分页由系统注入，默认样式（`/_js/_portletPlugs/simpleNews/css/simplenews.css`）
只有 `float:right` + 行内排列，紧贴列表且很丑。分页 DOM 结构：

```html
<div id="wp_paging_wNN">
  <ul class="wp_paging clearfix">
    <li class="pages_count">每页 <em class="per_count">14</em> 记录 总共 <em class="all_count">6</em> 记录</li>
    <li class="page_nav">
      <a class="first"><span>第一页</span></a>
      <a class="prev"><span>&lt;&lt;上一页</span></a>
      <a class="next"><span>下一页&gt;&gt;</span></a>
      <a class="last"><span>尾页</span></a>
    </li>
    <li class="page_jump">页码 <em class="curr_page">1</em>/<em class="all_pages">1</em>
      <input class="pageNum"><a class="pagingJump">跳转到 </a></li>
  </ul>
</div>
```

美化要点（用 `#wp_paging_wNN` 提权 + `!important` 覆盖系统样式）：
- `#wp_paging_wNN { margin-top:28px; padding-top:22px; border-top:1px dashed #d8dbe6; clear:both; }` —— 解决「贴住列表」。
- `.wp_paging { float:none!important; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px 18px; }`
  并重置 `li/span/a { float:none!important; height:auto; margin-left:0; }`。
- 按钮做成胶囊：`border-radius:9999px; height:34px; padding:0 14px; border:1px solid #dcdfe8; background:#fff;`，
  hover 用主题色；当前页/跳转按钮用主色实底。
- **只有 1 页时** prev/next 点了没反应 → 加一段小 JS 判断 `em.all_pages` 文本为 `1` 时给
  `.page_nav` / `.page_jump` 加 `.is-disabled`（`pointer-events:none; opacity:.55`），避免"假按钮"。
- 数字页码类名按 `.page_num a` / `a.page_num` / `.current` 兜底写样式（多页时系统才输出）。

## 7. 搜索组件定制（`portletmode="search"`）

WebPlus 输出的是 `<table>` + `input[type=submit]`，样式老、兼容差。可靠做法：
1. 保留 `<form>`（action / `keyword` 字段不动）。
2. 页面加载时用 JS 把 `form.innerHTML` 换成自定义结构：
   `input.custom-search-input`（`name="keyword"`）+ `button.custom-search-btn`（内联 SVG 放大镜）。
3. `.expanded` class 控制展开；失焦收起；拦截 `submit`——未展开或关键词为空时不提交，只展开聚焦。
4. 不要依赖 `input[type=submit]` 的背景图/`appearance:none`，部分内核会强制系统样式导致按钮透明。

## 8. 校验清单（改完模板必查）

- [ ] 区域标记齐全且顺序正确
- [ ] 每个 `frag="窗口NN"` 都有 `frag="窗口内容"`，窗口号同页不重复
- [ ] 静态区块没有误放进 `frag` 窗口
- [ ] 循环标记成对（Info/Field/Navi/Menu/Column/Path）
- [ ] 字段拼写正确，日期格式合法
- [ ] `<head>` 里内联了模板用到的所有工具类
- [ ] 无嵌套 `<a>`、无 `{站点URL}` 进入 CSS url()
- [ ] `curl` 页面：无 `null`、导航/页脚/搜索完整、DOM 嵌套正常
