import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createHash } from "crypto";
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  unlink,
} from "fs/promises";
import path from "path";

// 声音映射：前端 key → Edge-TTS voiceShortName
export const VOICES: Record<string, string> = {
  xiaoxiao: "zh-CN-XiaoxiaoNeural", // 温暖亲切（默认）
  xiaochen: "zh-CN-XiaochenNeural", // 温柔治愈
  xiaoyi: "zh-CN-XiaoyiNeural", // 活泼明亮
};

export const VOICE_LABELS: Record<string, string> = {
  xiaoxiao: "晓晓 · 温暖",
  xiaochen: "晓晨 · 治愈",
  xiaoyi: "晓伊 · 活泼",
};

const CACHE_DIR = path.join(process.cwd(), "uploads", ".tts-cache");

// 单次合成文本上限（SSML 安全限制）
const MAX_TEXT_LENGTH = 3000;

// 缓存文件上限，超出后清理最旧的
const CACHE_MAX_FILES = 300;
const CACHE_CLEAN_BATCH = 100;

function getCacheKey(voice: string, rate: number, text: string): string {
  return createHash("md5")
    .update(`${voice}:${rate}:${text}`)
    .digest("hex");
}

// 缓存文件数量超限时，按修改时间清理最旧的一批
async function cleanCacheIfNeeded(): Promise<void> {
  try {
    const files = await readdir(CACHE_DIR);
    const mp3s = files.filter((f) => f.endsWith(".mp3"));
    if (mp3s.length <= CACHE_MAX_FILES) return;
    const withStats = await Promise.all(
      mp3s.map(async (f) => {
        const s = await stat(path.join(CACHE_DIR, f)).catch(() => null);
        return { f, s };
      })
    );
    const valid = withStats
      .filter((x) => x.s)
      .sort((a, b) => a.s!.mtimeMs - b.s!.mtimeMs);
    for (const { f } of valid.slice(0, CACHE_CLEAN_BATCH)) {
      await unlink(path.join(CACHE_DIR, f)).catch(() => {});
    }
  } catch {
    // 清理失败不影响朗读
  }
}

/**
 * 使用 Edge-TTS 将文本合成为 MP3 音频。
 * 带 MD5 缓存：同一段文字 + 同一声音 + 同一语速不重复合成。
 */
export async function synthesize(
  text: string,
  voiceKey: string,
  rate: number = 0
): Promise<Buffer> {
  if (!text || text.trim().length === 0) {
    throw new Error("文本为空");
  }

  const voiceShortName = VOICES[voiceKey] || VOICES.xiaoxiao;
  const safeRate = Math.max(-100, Math.min(100, rate || 0));

  // 截断超长文本（SSML 限制）
  const safeText =
    text.length > MAX_TEXT_LENGTH
      ? text.slice(0, MAX_TEXT_LENGTH)
      : text;

  // 检查缓存
  const cacheKey = getCacheKey(voiceKey, safeRate, safeText);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
  try {
    const cached = await readFile(cachePath);
    return cached;
  } catch {
    // 缓存未命中，继续合成
  }

  // 合成
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    voiceShortName,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  const { audioStream } = tts.toStream(safeText, { rate: safeRate });
  const chunks: Buffer[] = [];

  for await (const chunk of audioStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  tts.close();

  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length === 0) {
    throw new Error("TTS 合成返回空音频");
  }

  // 写入缓存
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath, audioBuffer).catch(() => {
    // 缓存写入失败不影响播放
  });
  await cleanCacheIfNeeded();

  return audioBuffer;
}
