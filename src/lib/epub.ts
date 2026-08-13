/**
 * EPUB 文本提取工具
 *
 * EPUB 本质是一个 ZIP 容器：
 * 1. META-INF/container.xml 声明 OPF 元数据文件位置
 * 2. OPF 的 manifest 定义所有资源，spine 定义阅读顺序
 * 3. 按 spine 顺序提取各章节 HTML，转换为纯文本
 */

import AdmZip from "adm-zip";
import { convert } from "html-to-text";
import { XMLParser } from "fast-xml-parser";
import path from "path";

export interface EpubChapter {
  title: string;
  text: string;
  /** 目录层级：1=章/大标题，2=节，3=小节。缺失时按 1 处理 */
  level?: number;
}

// toc.ncx 中 navPoint 的最小结构
interface TocNavPoint {
  navLabel?: { text?: unknown };
  content?: { "@_src"?: unknown };
  navPoint?: unknown;
}

// 目录条目：标题 + 层级（navPoint 嵌套深度）
interface TocEntry {
  label: string;
  level: number;
}

export interface EpubData {
  text: string;
  title: string;
  author: string;
  chapterCount: number;
  chapters: EpubChapter[];
}

/**
 * 从章节 HTML 中提取标题（第一个 h1-h6，其次正文第一短行），提取不到则用「第 N 章」兜底。
 */
function extractChapterTitle(html: string, index: number, text: string): string {
  const match = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (match && match[1]) {
    const title = convert(match[1], { wordwrap: false })
      .trim()
      .replace(/\s+/g, " ");
    if (title && title.length <= 80) return title;
  }
  // 无标题标签的书：用正文第一短行当标题
  const firstLine =
    text
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? "";
  if (firstLine && firstLine.length <= 30 && text.length > firstLine.length * 3) {
    return firstLine;
  }
  return `第 ${index + 1} 章`;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * 从 fast-xml-parser 解析结果中安全提取文本值。
 *
 * 真实 EPUB 的 dc:title / dc:creator 常带 XML 属性（如 opf:role="aut"），
 * 解析结果是对象而不是字符串：{ "@_opf:role": "aut", "#text": "作者名" }。
 * 这里统一处理字符串 / 数组 / 对象三种形态，避免 .trim() 崩溃。
 */
function extractDcValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return extractDcValue(value[0]);
  }
  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const text = obj["#text"];
    if (typeof text === "string") {
      return text.trim().replace(/\s+/g, " ");
    }
    return "";
  }
  return String(value).trim();
}

export async function extractEpub(buffer: Buffer): Promise<EpubData> {
  const zip = new AdmZip(buffer);

  // 1. 读取 container.xml，定位 OPF 文件
  const containerEntry = zip.getEntry("META-INF/container.xml");
  if (!containerEntry) {
    throw new Error("不是有效的 EPUB 文件（缺少 META-INF/container.xml）");
  }
  const container = xmlParser.parse(
    containerEntry.getData().toString("utf-8")
  );
  const rootfiles = asArray(container.container?.rootfiles?.rootfile);
  const rootfilePath = rootfiles[0]?.["@_full-path"];
  if (!rootfilePath) {
    throw new Error("EPUB 元数据不完整（缺少 rootfile 路径）");
  }

  // 2. 读取 OPF 文件
  const opfEntry = zip.getEntry(rootfilePath);
  if (!opfEntry) {
    throw new Error(`EPUB 元数据文件缺失: ${rootfilePath}`);
  }
  const opf = xmlParser.parse(opfEntry.getData().toString("utf-8"));
  const packageData = opf.package;
  if (!packageData) {
    throw new Error("EPUB 元数据格式不正确");
  }

  const opfDir = path.posix.dirname(rootfilePath);

  // 3. 提取书名（dc:title，取第一个）
  const title = extractDcValue(packageData.metadata?.["dc:title"]);

  // 提取作者（dc:creator，取第一个，去掉可能的角色标注如 [美]）
  const author = extractDcValue(
    packageData.metadata?.["dc:creator"]
  ).replace(/^\[[^\]]+\]\s*/, "");

  // 4. 构建 manifest：id → href
  const manifestMap = new Map<string, string>();
  for (const item of asArray(packageData.manifest?.item)) {
    const id = item["@_id"];
    const href = item["@_href"];
    if (id && href) {
      manifestMap.set(id, decodeURIComponent(href));
    }
  }

  // 4.5 读取目录文件 toc.ncx（若有），构建 src → 章节标题 + 层级映射
  // 目录是章节标题的权威来源，比从章节 HTML 猜测更准确；
  // navPoint 嵌套深度即层级（第1章 > 小节），保留层级供阅读器目录分层展示
  const tocMap = new Map<string, TocEntry>();
  const tocId = packageData.spine?.["@_toc"];
  let tocHref = tocId ? manifestMap.get(tocId) : null;
  if (!tocHref) {
    // 兜底：按 media-type 查找 ncx 文件
    for (const item of asArray(packageData.manifest?.item)) {
      if (item["@_media-type"] === "application/x-dtbncx+xml") {
        tocHref = item["@_href"]
          ? decodeURIComponent(item["@_href"])
          : null;
        break;
      }
    }
  }
  if (tocHref) {
    const tocPath = opfDir && opfDir !== "." ? `${opfDir}/${tocHref}` : tocHref;
    const tocEntry = zip.getEntry(tocPath);
    if (tocEntry) {
      try {
        const toc = xmlParser.parse(tocEntry.getData().toString("utf-8"));
        const flattenToc = (points: unknown, level: number): void => {
          for (const point of asArray(points as TocNavPoint[])) {
            const label = extractDcValue(point.navLabel?.text);
            const src = point.content?.["@_src"];
            if (label && typeof src === "string") {
              const key = src.split("#")[0];
              // 同一文件可能被父子 navPoint 重复引用，保留最浅层级（首次出现）
              if (!tocMap.has(key)) {
                tocMap.set(key, { label, level });
              }
            }
            if (point.navPoint) flattenToc(point.navPoint, level + 1);
          }
        };
        flattenToc(toc.ncx?.navMap?.navPoint, 1);
      } catch (e) {
        console.warn("解析 toc.ncx 失败，回退到章节 HTML 提取标题:", e);
      }
    }
  }

  // 5. 按 spine 顺序提取章节文本
  const chapters: EpubChapter[] = [];
  for (const ref of asArray(packageData.spine?.itemref)) {
    // 跳过 linear="no" 的条目（通常是目录页等）
    if (ref["@_linear"] === "no") continue;

    const href = manifestMap.get(ref["@_idref"]);
    if (!href) continue;

    const entryPath = opfDir && opfDir !== "." ? `${opfDir}/${href}` : href;
    const entry = zip.getEntry(entryPath);
    if (!entry) continue;

    const html = entry.getData().toString("utf-8");
    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "img", format: "skip" },
        { selector: "svg", format: "skip" },
        { selector: "nav", format: "skip" },
      ],
    })
      .replace(/\u00a0/g, " ") // 全角空格归一
      .replace(/[ \t]+\n/g, "\n") // 行尾空白
      .replace(/\n{3,}/g, "\n\n") // 压缩多余空行
      .trim();

    if (text.length > 0) {
      // 标题优先级：toc.ncx 目录 > 章节 HTML 标题 > 「第 N 章」兜底
      const hrefKey = href.split("#")[0];
      const tocTitle = tocMap.get(hrefKey);
      chapters.push({
        title: tocTitle?.label || extractChapterTitle(html, chapters.length, text),
        level: tocTitle?.level ?? 1,
        text,
      });
    }
  }

  if (chapters.length === 0) {
    throw new Error("未能从 EPUB 中提取到任何文本内容");
  }

  return {
    text: chapters.map((c) => c.text).join("\n\n"),
    title,
    author,
    chapterCount: chapters.length,
    chapters,
  };
}
