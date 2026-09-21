# WebPlus 易错点与成品配方（照抄可用）

本文是 `SKILL.md` §6 的展开版：每个坑都给「症状 → 根因 → 处理」，能贴代码的直接给完整片段。
所有代码都按「模板内联（`<head>` 的 `<style>` / `</body>` 前的 `<script>`）」使用，
不改系统文件、不需要后台特殊权限。

---

## 一、搜索组件（`portletmode="search"`）

### 症状
- 放大镜/搜索按钮**看不见**，或鼠标移上去才发现有个透明按钮；
- 按钮有系统自带的灰色底/边框，跟设计不搭；
- 输入框文字不垂直居中；
- 想做成「默认只有一个放大镜，点击展开输入，失焦收起」，结果出现：收起后文字没隐藏、点一下直接跳搜索结果、返回后图标左边多出可点的小空隙。

### 根因
WebPlus 输出的是一张 `<table>` + `<input type="submit">`：
1. `input[type=submit]` 会被部分浏览器（尤其 WebKit 内核）强制渲染系统样式，背景图/`appearance:none` 都不一定生效；
2. 用 CSS 折叠 hack 依赖 `:focus-within` + 绝对定位覆盖，状态多、易出上面那串 bug；
3. Base64 背景图一旦编码损坏（例如空格被转成 `!`）会静默不显示；
4. 在 CSS `url()` 里写 `{站点URL}` 会被系统重写成 `/_upload/.../data:image...` 的坏路径。

### 配方（推荐：保留 WebPlus 表单，用 JS 重建 DOM）

**CSS（放 `<head>`）**
```html
<style>
.custom-search-form { display:flex; align-items:center; height:40px; border-radius:9999px;
  background:transparent; border:1px solid transparent; padding:0 4px; margin:0;
  transition:background .3s,border-color .3s,padding .3s; }
.custom-search-form.expanded { background:rgba(220,224,233,.45); border-color:rgba(4,38,126,.15);
  padding:0 4px 0 14px; }
.custom-search-input { width:0; padding:0; border:0; outline:0; background:transparent;
  font-size:14px; line-height:1.2; color:#1a1b21; transition:width .3s,padding .3s; }
.custom-search-form.expanded .custom-search-input { width:150px; padding-right:8px; }
.custom-search-input::placeholder { color:#8a8c99; }
.custom-search-btn { display:flex; align-items:center; justify-content:center;
  width:32px; height:32px; flex:0 0 auto; border:0; background:transparent; color:#444652;
  border-radius:50%; cursor:pointer; padding:0; transition:background .2s,color .2s; }
.custom-search-btn:hover { background:rgba(68,70,82,.12); color:#04267e; }
.custom-search-btn svg { display:block; }
</style>
```

**JS（放 `</body>` 前）**
```html
<script>
(function(){
  function buildSearch(){
    var wrap = document.querySelector('.wp_search');       // WebPlus 生成的容器
    if (!wrap) return;
    var form = wrap.closest('form');                        // 复用系统 form（action/keyword 不动）
    if (!form || form.getAttribute('data-custom-search') === '1') return;
    form.setAttribute('data-custom-search', '1');
    form.removeAttribute('onsubmit');                       // 去掉系统内联校验
    form.className = 'custom-search-form';
    form.setAttribute('role', 'search');
    form.innerHTML =
      '<input type="text" name="keyword" id="keyword" class="custom-search-input"'
      + ' placeholder="搜索..." autocomplete="off" aria-label="搜索关键词">'
      + '<button type="submit" class="custom-search-btn" aria-label="搜索" title="搜索">'
      + '<svg style="width:20px;height:20px;fill:currentColor" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>'
      + '</svg></button>';
    var input = form.querySelector('.custom-search-input');
    var btn = form.querySelector('.custom-search-btn');
    input.addEventListener('focus', function(){ form.classList.add('expanded'); });
    input.addEventListener('blur', function(){
      setTimeout(function(){ if (document.activeElement !== input) form.classList.remove('expanded'); }, 150);
    });
    btn.addEventListener('mousedown', function(e){
      if (!form.classList.contains('expanded')) { e.preventDefault(); form.classList.add('expanded'); input.focus(); }
    });
    form.addEventListener('submit', function(e){
      // 收起状态或空关键词：只展开聚焦，绝不跳转
      if (!form.classList.contains('expanded') || !input.value.trim()) {
        e.preventDefault(); form.classList.add('expanded'); input.focus();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSearch);
  else buildSearch();
})();
</script>
```

**要点**：图标用**内联 SVG**（DOM 元素），不要用 `background-image`；表单保留系统 `action`，
搜索结果页仍由 WebPlus 提供；`.expanded` 只管视觉，`submit` 事件负责防误跳。

---

## 二、分页组件（`#wp_paging_wNN`）

### 症状
- 分页紧贴列表、`float:right` 挤成一坨，很难看；
- 只有 1 页时「第一页/上一页/下一页/尾页」看着能点，点了没反应。

### 根因
系统样式来自 `/_js/_portletPlugs/simpleNews/css/simplenews.css`，只有 `float:right` 和行内排列。

### DOM 结构
```html
<div id="wp_paging_wNN">
  <ul class="wp_paging clearfix">
    <li class="pages_count">每页 <em class="per_count">14</em> 记录 总共 <em class="all_count">6</em> 记录</li>
    <li class="page_nav">
      <a class="first"><span>第一页</span></a><a class="prev"><span>&lt;&lt;上一页</span></a>
      <a class="next"><span>下一页&gt;&gt;</span></a><a class="last"><span>尾页</span></a>
    </li>
    <li class="page_jump">页码 <em class="curr_page">1</em>/<em class="all_pages">1</em>
      <input class="pageNum"><a class="pagingJump">跳转到 </a></li>
  </ul>
</div>
```

### 配方

**CSS（放 `<head>`；用 `#wp_paging_wNN` 提权 + `!important` 覆盖系统 float）**
```html
<style>
#wp_paging_w08 { margin-top:28px; padding-top:22px; border-top:1px dashed #d8dbe6; clear:both; }
#wp_paging_w08 .wp_paging { float:none !important; display:flex; align-items:center;
  justify-content:space-between; flex-wrap:wrap; gap:10px 18px; font-size:14px; color:#444652;
  margin:0; padding:0; }
#wp_paging_w08 .wp_paging li { float:none !important; display:inline-flex; align-items:center;
  height:auto !important; line-height:1 !important; margin:0 !important; }
#wp_paging_w08 .wp_paging li span, #wp_paging_w08 .wp_paging li a { float:none !important; margin-left:0 !important; }
#wp_paging_w08 .wp_paging .pages_count { color:#8a8c99; }
#wp_paging_w08 .wp_paging .pages_count em { font-style:normal; color:#04267e; font-weight:700; margin:0 2px; }
#wp_paging_w08 .wp_paging .page_nav { display:inline-flex; gap:8px; }
#wp_paging_w08 .wp_paging .page_nav a { display:inline-flex; align-items:center; height:34px;
  padding:0 14px; border:1px solid #dcdfe8; border-radius:9999px; background:#fff; color:#04267e;
  font-size:13px; line-height:1; text-decoration:none; transition:all .2s; }
#wp_paging_w08 .wp_paging .page_nav a:hover { background:#f4f2fb; border-color:#04267e; color:#ba1a1a; }
#wp_paging_w08 .wp_paging .page_nav.is-disabled a { color:#b6b9c6; border-color:#eceef4;
  background:#fafbfd; pointer-events:none; }
/* 多页时系统才输出的数字页码，类名做兜底 */
#wp_paging_w08 .wp_paging .page_num a, #wp_paging_w08 .wp_paging a.page_num { display:inline-flex;
  align-items:center; justify-content:center; min-width:34px; height:34px; padding:0 8px;
  border:1px solid #dcdfe8; border-radius:9999px; background:#fff; color:#444652;
  font-size:13px; text-decoration:none; transition:all .2s; }
#wp_paging_w08 .wp_paging .page_num a:hover, #wp_paging_w08 .wp_paging a.page_num:hover { background:#f4f2fb; border-color:#04267e; }
#wp_paging_w08 .wp_paging .current a, #wp_paging_w08 .wp_paging a.current { background:#04267e !important;
  border-color:#04267e !important; color:#fff !important; font-weight:700; }
#wp_paging_w08 .wp_paging .page_jump { display:inline-flex; align-items:center; gap:8px; color:#8a8c99; }
#wp_paging_w08 .wp_paging .page_jump .pages em { color:#04267e; font-weight:700; font-style:normal; }
#wp_paging_w08 .wp_paging .page_jump input.pageNum { width:48px !important; height:34px !important;
  margin:0 !important; padding:0 6px !important; border:1px solid #dcdfe8 !important;
  border-radius:8px !important; background:#fff !important; text-align:center; font-size:13px; }
#wp_paging_w08 .wp_paging .page_jump .pagingJump { display:inline-flex; align-items:center; height:34px;
  padding:0 16px; border-radius:9999px; background:#04267e; color:#fff; font-size:13px;
  line-height:1; text-decoration:none; transition:all .2s; }
#wp_paging_w08 .wp_paging .page_jump .pagingJump:hover { background:#ba1a1a; color:#fff; }
@media (max-width:640px){ #wp_paging_w08 .wp_paging { justify-content:center; } }
</style>
```

**JS（单页时禁用假按钮；放 `</body>` 前）**
```html
<script>
(function(){
  try {
    var box = document.querySelector('#wp_paging_w08');
    if (!box) return;
    var all = box.querySelector('.all_pages');
    if (all && all.innerText.replace(/\s/g, '') === '1') {
      var nav = box.querySelector('.page_nav'); if (nav) nav.classList.add('is-disabled');
      var jump = box.querySelector('.page_jump'); if (jump) jump.classList.add('is-disabled');
    }
  } catch(e) {}
})();
</script>
```

> 每个列表窗口的分页容器 id 是 `#wp_paging_w<窗口号>`（如 `w08`）。窗口号变了要跟着改选择器。

---

## 三、导航高亮 / 面包屑 / 侧栏

### 3.1 父栏目页面没有高亮
**根因**：访问父栏目 `/vd/dtzx/list.psp` 时，系统渲染的其实是**第一个子栏目**的内容，
而侧栏链接指向子栏目 URL，按 pathname 匹配不上。

**配方**：一级导航直接指向首个子栏目 + 加 `parentMap` 兜底。
```js
var parentMap = {
  '/zhanyou/zxgk/list.psp':'/zhanyou/zxjj/list.psp',
  '/zhanyou/dtzx/list.psp':'/zhanyou/zxxw/list.psp',
  '/zhanyou/xsyj/list.psp':'/zhanyou/xshd/list.psp',
  '/zhanyou/jlhz/list.psp':'/zhanyou/yskp/list.psp'
};
// 计算完 href 之后：
if (parentMap[href]) href = parentMap[href];
```
（导航脚本与侧栏脚本都要加；子菜单命中时记得同时给父级 `a.nav-item` 加 `.nav-active`。）

### 3.2 叶子栏目（如「联系我们」）侧栏是空卡片
```js
var box = document.querySelector('[frag="窗口06"]');
if (box && !box.querySelector('a[href]')) {
  var aside = box.closest('aside');
  if (aside) aside.style.display = 'none';   // 主内容 flex:1 自动占满
}
```

### 3.3 面包屑「首页」重复
**根因**：`{当前位置}` 自带 `<a>首页</a><span class='possplit'>`，模板前面又写了一个首页链接。
```js
document.querySelectorAll('[frag="窗口04"] span, [frag="窗口05"] span, [frag="窗口10"] span').forEach(function(span){
  if (!span.querySelector('.possplit')) return;
  var a = span.querySelector('a'), s = span.querySelector('.possplit');
  if (a) a.remove(); if (s) s.remove();
});
```

### 3.4 `simpleColumnPath` 不渲染（只剩「当前位置：」）
改用 `simpleColumnAttri` + `{当前位置}`：
```html
<div frag="窗口10" portletmode="simpleColumnAttri"><span>{当前位置}</span></div>
```

---

## 四、动态列表数据

### 4.1 前台出现字面量 `null`
`simpleList` 窗口没绑「信息来源」→ 绑栏目，或走 4.3 的前端兜底。

### 4.2 列表页显示成一篇正文
栏目**已发布文章只有 1 篇**时，系统把列表渲染成 `wp_single wp_column_article`（单篇），
前端按 `.news-row` 解析自然「暂无数据」。**再发布 ≥2 篇即恢复列表**；
单页栏目（中心简介/联系我们）本就是单篇，属预期。
自查：`curl /vd/{urlName}/list.psp | grep -c 'class="news-row"'`。

### 4.3 前端兜底渲染（Portlet 绑定不生效时的可靠方案）
```html
<div id="dynamic-news-container" style="min-height:420px">…骨架/加载中…</div>
<script>
(function(){
  var container = document.getElementById('dynamic-news-container');
  var cache = {}, pending = {};                 // 加载即缓存 + 防并发
  function buildHtml(key){
    var col = COLS[key];
    return fetch(col.url).then(function(r){ return r.text(); }).then(function(text){
      var doc = new DOMParser().parseFromString(text, 'text/html');
      var rows = Array.prototype.slice.call(doc.querySelectorAll('.news-row'), 0, 4);
      if (!rows.length) return '<div>暂无数据</div>';
      var first = rows[0].querySelector('.t a');
      // 首条大图卡：再 fetch 文章页，从 .wp_articlecontent 抽首图与摘要
      return fetch(first.getAttribute('href')).then(function(r){ return r.text(); }).then(function(art){
        var a = new DOMParser().parseFromString(art, 'text/html');
        var content = a.querySelector('.wp_articlecontent');
        var thumb = content && content.querySelector('img') ? content.querySelector('img').src : 'data:image/svg+xml;base64,…';
        var brief = content ? content.innerText.replace(/\s+/g,' ').slice(0,80) + '…' : '';
        return render(rows, first, thumb, brief);      // 自己拼 HTML
      });
    });
  }
  function prefetch(key){
    if (cache[key]) return Promise.resolve(cache[key]);
    if (pending[key]) return pending[key];
    pending[key] = buildHtml(key).then(function(h){ cache[key]=h; delete pending[key]; return h; })
      .catch(function(e){ delete pending[key]; throw e; });
    return pending[key];
  }
  // 进入页面：先渲染当前 tab，再后台预取其他 tab；切换直接命中缓存
})();
</script>
```
要点：
- **相对路径**（`tzgg/list.psp`）兼容后台预览与对外域名；不要写死 `/zhanyou/...`；
- 容器先给 `min-height` 再显示 loading，避免 CLS 抖动；loading 图标写死 `style="width:24px;height:24px"`（别依赖可能缺失的工具类）；
- 大图卡 + 小列表同构循环时，用 `:first-child` / `:not(:first-child)` 切换两种形态；
- 占位图用 **Base64 内联**（避免服务器静态资源损坏），但要验证能正确解码。

---

## 五、模板 HTML 层

| 症状 | 根因 | 处理 |
|---|---|---|
| 静态区块整体消失 | 内容放进了 `frag="窗口NN"`，被后台窗口登记覆盖/清空 | 静态内容用普通 `<div>` |
| 导航塌成竖排、下拉 1 字宽 | 编译后的 `style.css` 缺 `.hidden`/`.lg:flex`/`.w-40`/`.top-full` 等 | 这些类内联进 `<head>`，并用 `@media` 补齐 `md:`/`lg:` 变体 |
| 响应式内容永远不显示 | `class="hidden md:block"` 但 `.md:block` 缺失 | 补 `@media (min-width:768px){.md\:block{display:block}}` |
| 列表行日期换行/点不中 | `{标题}` 自带 `<a>`，模板再包 `<a>` → 嵌套 `<a>`，浏览器自动闭合外层 | 列表项不包 `<a>`，用 CSS 修饰生成的链接 |
| 站点名样式丢失 | 字段被渲染成 `<span class='Site_Name'>` 而非 `{站点名称}` | 给 `.Site_Name` / `.Column_Name` 写 CSS |
| 图标/图片不显示 | Base64 编码损坏（空格变 `!`）、`{站点URL}` 进了 CSS `url()` | 校验 base64 解码；图标改用内联 SVG DOM；`url()` 里只用相对路径 |
| 子页面排版崩 | 用正则批量改 HTML，少/多闭合 `<div>` | 只做整块精准替换；改完用 DOM 解析或逐页 `curl` 校验 |
| 文章页太"现代"、甲方不喜欢 | 双栏 + 侧栏卡片设计 | 改单栏居中阅读（`max-w-4xl mx-auto`），参考校内常规新闻页 |

---

## 六、后台操作类

| 症状 | 根因 | 处理 |
|---|---|---|
| 改了模板前台没变 | 缓存 / 改错存储层 / 窗口登记覆盖 | 清缓存（`userCaches.rst?...&clearAll=1`）；确认改的是 `page/0.rst`；静态内容别放窗口 |
| 接口 404 | 未登录 / 路径错 | 404 多为未登录或路径不存在（不是 401） |
| 接口 405 | 方法错 | 换 GET/POST（有的接口只支持一种） |
| 绑定失败「保存绑定模板设置失败！」 | 路径写错 | 正确路径是 `/_web/_column/api/templateBinding/create.rst`，不是 `_columntpl` |
| 设计器保存窗口结构报 `backendParams` 异常 | 缺设计器内部参数 | 改用经典 `page/0.rst` PUT 整页保存 |
| 内容块绑定成功但前台仍 `null` | 设计器草稿与经典引擎不同步 | 走 §四 4.3 前端兜底，或核对 `contentBlockConfigs` 实际记录 |
| 对外域名未更新 | 需要超管发布 | 子站点后台无「站点发布」菜单，找超管；前台 `main.psp` 是实时的，不用等发布 |

---

## 七、前台 JS / 资源路径被系统重写（很隐蔽）

| 症状 | 根因 | 处理 |
|---|---|---|
| 内联 `<script>` 报 `Invalid regular expression flags` | 代码里出现字面量 `URL(`（如 `URL.createObjectURL(blob)`、`FileReader.readAsDataURL(blob)`），WebPlus 把括号里的参数当成**相对路径**，重写成 `/_upload/tpl/.../blob` | 避免任何 `URL(` 字面量：用 `window['URL']['createObjectURL'](blob)`；或 `var read = fr.readAsDataURL; read.call(fr, blob)` |
| 图片/接口 404，路径被加了 `/_upload/tpl/...` 前缀 | `src` / CSS `url()` / JS 里的资源路径被相对化重写 | 资源用绝对路径（`/...`），别用会被误判成路径的裸标识符 |
| 刷新后破图一闪 | 骨架 `<img src="images/xxx">` 指向模板目录里不存在的文件（新图没随模板导入） | 骨架不放 `<img>`，用渐变/底色占位；真实图加载后淡入（`.hero-img.hero-ready`） |
| 轮播每次刷新都重新拉数据/图片 | `list.psp`、文章页无缓存头，图片只给 ETag 但仍回 200 | 前端 `localStorage`（元数据 + TTL）+ `CacheStorage`（图片 bytes）本地缓存，二次访问 0 请求 |
| 正文图片 `/_temp/<file>` 会不会被清 | `doUpload.jsp` 只进临时区 | 文章 `pageContent0` 里引用 `/_temp/<file>`，**发布时系统会自动搬到** `/_upload/article/images/xx/xx/` 并改写 src（永久可用） |
| 设计器里顶部导航竖排/错位，实时页却正常 | 模板 header 多了 `</div>` 提前闭合 `<nav>`；且标题/导航/搜索是三个独立 `面板`，设计器按块竖排 | 删掉多余的 `</div>`；把「标题 + 导航链接 + 搜索窗口」塞进**同一个 `frag="面板01"`** 并给它 `class="flex justify-between items-center w-full"`，设计器才按一行渲染 |
| 浏览器 URL 里写死站点 ID（如 `_p=YXM9OTMmdD05NDUmcD0xJm09TiY_`）导致进错站 | `_p` 是 `as=<siteId>&p=1&m=N&` 的 base64url | 现算：`as=444` → `YXM9NDQ0JnA9MSZtPU4m`，直接改地址栏进入目标站点后台 |
