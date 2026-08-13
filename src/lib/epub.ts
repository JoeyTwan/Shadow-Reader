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

export interface EpubData {
  text: string;
  title: string;
  chapterCount: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
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
  const rawTitle = packageData.metadata?.["dc:title"];
  const title = (Array.isArray(rawTitle) ? rawTitle[0] : rawTitle ?? "")
    .trim()
    .replace(/\s+/g, " ");

  // 4. 构建 manifest：id → href
  const manifestMap = new Map<string, string>();
  for (const item of asArray(packageData.manifest?.item)) {
    const id = item["@_id"];
    const href = item["@_href"];
    if (id && href) {
      manifestMap.set(id, decodeURIComponent(href));
    }
  }

  // 5. 按 spine 顺序提取章节文本
  const chapters: string[] = [];
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
      chapters.push(text);
    }
  }

  if (chapters.length === 0) {
    throw new Error("未能从 EPUB 中提取到任何文本内容");
  }

  return {
    text: chapters.join("\n\n"),
    title,
    chapterCount: chapters.length,
  };
}
