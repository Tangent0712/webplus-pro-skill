#!/usr/bin/env node
/**
 * WebPlus Pro helper CLI.
 *
 * 前置：npm i playwright-core；浏览器以 --remote-debugging-port=9222 启动并已人工登录后台。
 *
 * 用法（<siteId> 用 --as 指定，默认为当前管理站点；ID 请先用 discover 侦察）：
 *   node wp.mjs discover <pageUrl>                # 免登录：siteId / 模板ID / 静态前缀 / 栏目ID / 是否有 null
 *   node wp.mjs pull <templateId> <outDir> --page=<该模板渲染的任意页面URL>   # 免登录拉模板
 *   node wp.mjs probe <templateId> [--as=<siteId>]
 *   node wp.mjs pages <templateId> [--as=<siteId>]
 *   node wp.mjs save-page <templateId> <pageId> <file> [--name=默认首页] [--as=<siteId>]
 *   node wp.mjs import <zipPath> <name> [--enabled=true] [--as=<siteId>]
 *   node wp.mjs bind <columnId> <bindingType 1|2|3> <pageId> <pageType 1|2|3> [--as=<siteId>]
 *   node wp.mjs bind-source <templateId> <pageId> <windowId w06> <columnId> [--as=<siteId>]
 *   node wp.mjs articles <siteFolderId> [--as=<siteId>]
 *   node wp.mjs clear-cache [--as=<siteId>]
 *
 * 全局参数：--as=<siteId>  --cdp=<http://127.0.0.1:9222>  --playwright=<playwright-core 包目录>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of args) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? 'true' : m[2];
  else positional.push(a);
}

const CDP = flags.cdp || 'http://127.0.0.1:9222';
const BASE = 'https://admin.njupt.edu.cn';
const buildToken = (site) => Buffer.from(`as=${site}&p=1&m=N&`).toString('base64url');
let SITE = flags.as || null;
let TOKEN = SITE ? buildToken(SITE) : null;
const withToken = (p) => `${BASE}${p}${p.includes('?') ? '&' : '?'}_p=${TOKEN}`;

const [cmd, ...rest] = positional;

async function loadPlaywright() {
  try {
    return await import('playwright-core');
  } catch {}
  const dir = process.env.WP_PLAYWRIGHT || flags.playwright;
  if (dir) {
    for (const f of ['index.mjs', 'index.js', 'lib/index.js']) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) return await import(pathToFileURL(p).href);
    }
  }
  throw new Error(
    '缺少 playwright-core：在项目根目录执行 npm i playwright-core，或设置 WP_PLAYWRIGHT=<playwright-core 包目录>'
  );
}

async function withPage(fn) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  const pages = browser.contexts()[0].pages();
  const page = pages.find((p) => p.url().includes('admin.njupt.edu.cn')) || pages[0];
  if (!page) throw new Error('未找到后台页面，请先启动浏览器并登录后台');
  if (!TOKEN) {
    const m = page.url().match(/[?&]_p=([A-Za-z0-9_-]+)/);
    const decoded = m ? Buffer.from(m[1], 'base64url').toString('utf8') : '';
    const as = (decoded.match(/(?:^|&)as=(\d+)/) || [])[1];
    if (!as) throw new Error('无法从当前后台页推导站点 ID，请加 --as=<siteId>');
    SITE = as;
    TOKEN = buildToken(as);
    console.error(`[wp] 使用站点 as=${SITE}（从当前后台页推导，可用 --as 覆盖）`);
  }
  try {
    return await fn(page);
  } finally {
    await browser.close(); // 仅断开 CDP 连接
  }
}

async function api(page, url, { method = 'GET', body } = {}) {
  return page.evaluate(
    async ({ url, method, body }) => {
      const init = { method, credentials: 'include' };
      if (body) {
        init.body = new URLSearchParams(body);
        init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      }
      const res = await fetch(url, init);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
    { url, method, body }
  );
}

const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

async function main() {
  switch (cmd) {
    case 'pages': {
      const tid = rest[0];
      await withPage(async (page) => {
        const r = await api(page, withToken(`/_web/sopplus/portlet/api/getPages.rst?templateId=${tid}`));
        out(r?.result?.data?.items ?? r);
      });
      break;
    }

    case 'probe': {
      const tid = rest[0];
      const root = flags.root || '0';
      await withPage(async (page) => {
        const pages = await api(page, withToken(`/_web/sopplus/portlet/api/getPages.rst?templateId=${tid}`));
        const columns = await api(page, withToken(`/_web/_column/api/columns.rst?columnId=${root}&showType=0`));
        const folders = await api(page, withToken(`/_web/_cms/folder/api/folder/tree.rst?isNeedShowAllFolder=true`));
        out({
          templateId: tid,
          pages: pages?.result?.data?.items,
          columns: columns?.result?.data ?? columns,
          folders: folders?.result?.data ?? folders,
        });
      });
      break;
    }

    case 'save-page': {
      const [tid, pid, file] = rest;
      if (!tid || !pid || !file) throw new Error('用法: save-page <templateId> <pageId> <file> [--name=默认首页]');
      const content = fs.readFileSync(file, 'utf8');
      const name = flags.name || '默认首页';
      await withPage(async (page) => {
        const r = await api(
          page,
          withToken(`/_web/_tpl/api/page/0.rst?templateId=${tid}&editType=e&_method=PUT`),
          { method: 'POST', body: { name, id: pid, saveType: 'e', content } }
        );
        out(r);
        if (String(r).includes('success')) {
          out(await api(page, withToken('/_web/_core/caches/api/userCaches.rst?_method=delete&clearAll=1'), { method: 'POST' }));
        }
      });
      break;
    }

    case 'import': {
      const [zip, name] = rest;
      if (!zip || !name) throw new Error('用法: import <zipPath> <name>');
      const b64 = fs.readFileSync(zip).toString('base64');
      const enabled = flags.enabled !== 'false';
      await withPage(async (page) => {
        const upload = await page.evaluate(
          async ({ url, b64 }) => {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            const fd = new FormData();
            fd.append('qqfile', new Blob([arr], { type: 'application/zip' }), 'template.zip');
            return await fetch(url, { method: 'POST', body: fd, credentials: 'include' }).then((r) => r.text());
          },
          { url: `${BASE}/doUpload.jsp`, b64 }
        );
        const fileName = (upload.match(/fileName:'([^']+)'/) || [])[1];
        if (!fileName) throw new Error('上传失败: ' + upload);
        out({ upload: fileName });
        const r = await api(page, withToken('/_web/_tpl/api/tpl/create.rst'), {
          method: 'POST',
          body: {
            name,
            enabled: String(enabled),
            staticed: 'false',
            tplLocale: '1',
            mainTitleCustom: 'false',
            jqueryType: '3',
            sourceType: '1',
            zipFilePath: fileName,
            picFilePath: '',
            mainPath: '[main.htm,UTF-8]main.htm',
            listColumnPath: '[listcolumn.htm,UTF-8]listcolumn.htm',
            displayInfoPath: '[displayinfo.htm,UTF-8]displayinfo.htm',
          },
        });
        out(r);
      });
      break;
    }

    case 'bind': {
      const [columnId, bindingType, pageId, pageType] = rest;
      if (!columnId || !bindingType || !pageId || !pageType)
        throw new Error('用法: bind <columnId> <bindingType 1|2|3> <pageId> <pageType 1|2|3>');
      await withPage(async (page) => {
        const r = await api(
          page,
          withToken(`/_web/_column/api/templateBinding/create.rst?columnId=${columnId}&bindingType=${bindingType}`),
          { method: 'POST', body: { pageId, pageType } }
        );
        out(r);
      });
      break;
    }

    case 'bind-source': {
      const [tid, pid, windowId, columnId] = rest;
      if (!tid || !pid || !windowId || !columnId)
        throw new Error('用法: bind-source <templateId> <pageId> <windowId> <columnId>');
      await withPage(async (page) => {
        const cb = await api(
          page,
          withToken(`/_web/sopplus/portlet/api/contentBlock/new.rst?templateId=${tid}&pageId=${pid}&windowId=${windowId}`)
        );
        const { siteEntityId, contentBlockId } = cb?.result?.data ?? {};
        if (!contentBlockId) throw new Error('取内容块失败: ' + JSON.stringify(cb));
        out({ siteEntityId, contentBlockId });
        out(
          await api(
            page,
            withToken(
              `/_web/_portlet/api/contentBlockConfig/0.rst?siteEntityId=${siteEntityId}&contentBlockId=${contentBlockId}&_method=PUT`
            ),
            { method: 'POST', body: { selectColumnIds: columnId, complexColumnName: '', nodeId: '' } }
          )
        );
        out(
          await api(
            page,
            withToken(
              `/_web/_portlet/api/contentBlockAdvConf/0.rst?siteEntityId=${siteEntityId}&contentBlockId=${contentBlockId}&_method=PUT`
            ),
            {
              method: 'POST',
              body: {
                displayType: '1',
                resGetMode: '1',
                articleType: '0',
                resMaxReadRow: '5',
                resLinkType: '0',
                reFirstImgArticle: '0',
              },
            }
          )
        );
      });
      break;
    }

    case 'articles': {
      const folderId = rest[0];
      await withPage(async (page) => {
        const r = await api(
          page,
          withToken(`/_web/_cms/folder/api/articles.rst?hasOnlyDraft=false&siteFolderId=${folderId}`)
        );
        out(r?.result?.data?.items ?? r);
      });
      break;
    }

    case 'clear-cache': {
      await withPage(async (page) => {
        out(await api(page, withToken('/_web/_core/caches/api/userCaches.rst?_method=delete&clearAll=1'), { method: 'POST' }));
      });
      break;
    }

    case 'discover': {
      const [pageUrl] = rest;
      if (!pageUrl) throw new Error('用法: discover <pageUrl>');
      const html = await (await fetch(pageUrl)).text();
      const siteId = (html.match(/sudy-wp-siteId="(\d+)"/) || html.match(/siteId=(\d+)/) || [])[1];
      const tplMatch = html.match(/\/_upload\/tpl\/[^"'\s)]*?\/template(\d+)\//);
      const columns = [...new Set([...html.matchAll(/c(\d+)a\d+\/page\.psp/g)].map((m) => m[1]))];
      const listLinks = [...new Set([...html.matchAll(/href="([^"]*\/list\.psp)"/g)].map((m) => m[1]))].slice(0, 30);
      out({
        url: pageUrl,
        siteId: siteId || null,
        templateId: tplMatch ? tplMatch[1] : null,
        templateBase: tplMatch ? tplMatch[0] : null,
        columnsInArticleLinks: columns,
        listLinks,
        hasSearchPortlet: /portletmode="search"|class="wp_search"/.test(html),
        hasNullLiteral: />\s*null\s*</.test(html),
      });
      break;
    }

    case 'pull': {
      const [tid, outDir] = rest;
      if (!tid || !outDir) throw new Error('用法: pull <templateId> <outDir> --page=<该模板渲染的任意页面URL>');
      let base = flags.base;
      if (!base && flags.page) {
        const html = await (await fetch(flags.page)).text();
        const m = html.match(/\/_upload\/tpl\/[^"'\s)]*?\/template(\d+)\//);
        if (!m) throw new Error('页面里没找到模板静态前缀');
        if (m[1] !== String(tid)) {
          throw new Error(`该页面用的是模板 ${m[1]}，不是 ${tid}；请换一个由目标模板渲染的页面`);
        }
        base = m[0];
      }
      if (!base) throw new Error('请提供 --page=<页面URL> 或 --base=/_upload/tpl/xx/xx/template<tid>/');
      base = base.replace(/\/$/, '') + '/';
      const origin = flags.origin || (flags.page ? new URL(flags.page).origin : BASE);
      const basePath = base.startsWith('http') ? new URL(base).pathname.replace(/\/$/, '') + '/' : base;
      const baseUrl = base.startsWith('http') ? base : origin + base;

      const seeds = (flags.files || 'main.htm,listcolumn.htm,displayinfo.htm,collection.htm,database.htm,members.htm,publications.htm,scholar.htm,style.css,media.css,mobile.css,extends/extends.js,extends/extends.css,extends/database.js,extends/members.js')
        .split(',').map((s) => s.trim()).filter(Boolean);

      const fetched = new Map(); // relPath -> Buffer
      const failed = [];
      const ASSET_RE = /\.(htm|html|css|js|mjs|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|json|txt|pdf)$/i;
      async function get(rel) {
        if (fetched.has(rel)) return fetched.get(rel);
        if (/^(https?:|data:|#|\/|javascript:|\{|\$)/.test(rel)) return null;
        const clean = rel.replace(/^\.\//, '');
        if (clean.includes('${')) return null;
        if (!ASSET_RE.test(clean)) return null; // 跳过 .psp/.jsp 等动态页
        try {
          const r = await fetch(baseUrl + clean);
          if (!r.ok) { failed.push(clean); return null; }
          const buf = Buffer.from(await r.arrayBuffer());
          fetched.set(clean, buf);
          return buf;
        } catch { failed.push(clean); return null; }
      }

      function refsOf(text) {
        const refs = new Set();
        for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
        for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) refs.add(m[1]);
        // JS 字符串里的资源路径，如 onerror="this.src='images/x.svg'"
        for (const m of text.matchAll(/['"]([^'"\s]+\.(?:svg|png|jpe?g|gif|webp|ico))['"]/gi)) refs.add(m[1]);
        return [...refs];
      }

      for (const s of seeds) await get(s);
      // 从已拉到的 htm/css 里递归收集相对资源
      for (const [rel, buf] of [...fetched.entries()]) {
        if (!/\.(htm|html|css)$/i.test(rel)) continue;
        const text = buf.toString('utf8');
        const dir = path.posix.dirname(rel);
        for (const ref of refsOf(text)) {
          let relRef;
          if (ref.startsWith('/')) {
            if (!ref.startsWith(basePath)) continue; // 站内其他目录，跳过
            relRef = ref.slice(basePath.length);
          } else {
            relRef = path.posix.normalize(path.posix.join(dir, ref));
          }
          if (relRef.startsWith('..')) continue;
          await get(relRef);
        }
      }

      let ok = 0;
      for (const [rel, buf] of fetched.entries()) {
        const dest = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        ok++;
      }
      console.log(`pulled ${ok} files into ${outDir} (base: ${base})`);
      if (failed.length) console.log('未命中（可忽略，常见于非必需文件）:', failed.slice(0, 15).join(', '));
      break;
    }

    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
