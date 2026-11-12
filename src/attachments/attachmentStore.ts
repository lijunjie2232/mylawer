/**
 * コンテンツアドレス型のローカル添付ファイルストレージ。
 *
 * third/ref-deepseek-harness の packages/attachment/attachment-local/src/file-store.ts および
 * store.ts の設計を踏襲する:
 * - SHA-256 ダイジェストによる重複排除・整合性検証
 * - ステージング書き込み → fsync → ハードリンク（未対応 FS では rename）による原子的公開
 * - パストラバーサル・Windows 予約名・制御文字を排除する fileLeafName サニタイズ
 * - 抽出済みテキストのサイドカーキャッシュ（再読込時に PDF を再パースしない）
 */

import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { chmod, copyFile, link, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/environment.js';
import { extractSupportedFileText } from './textExtractor.js';
import { AttachmentError, type FileAttachmentRef } from './types.js';

const FILE_ID_PATTERN = /^sha256:([a-f0-9]{64})$/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;

function isWindowsDeviceName(name: string): boolean {
  const dot = name.indexOf('.');
  const stem = (dot < 0 ? name : name.slice(0, dot)).replace(/[. ]+$/u, '');
  return WINDOWS_DEVICE_NAME.test(stem);
}

function utf8Prefix(value: string, maxBytes: number): string {
  let bytes = 0;
  let prefix = '';
  for (const ch of value) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (bytes + chBytes > maxBytes) break;
    prefix += ch;
    bytes += chBytes;
  }
  return prefix;
}

/**
 * 呼び出し元の表示ファイル名を安全にサニタイズする。
 * ref-deepseek-harness の fileLeafName と同じ規則。
 */
export function fileLeafName(value: string | undefined): string {
  if (value === undefined) return 'file.txt';
  const leaf = value.slice(Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\')) + 1);
  let clean = leaf
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
    .replace(/[. ]+$/u, '');
  if (isWindowsDeviceName(clean)) clean = `_${clean}`;
  clean = utf8Prefix(clean, 255).replace(/[. ]+$/u, '');
  return clean === '' || clean === '.' || clean === '..' ? 'file.txt' : clean;
}

function parseSha256(attachmentId: string): string {
  const match = FILE_ID_PATTERN.exec(attachmentId);
  if (!match?.[1]) {
    throw new AttachmentError('添付ファイル参照が不正です。', 'INVALID_ATTACHMENT_REF');
  }
  return match[1];
}

async function digestFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath) as AsyncIterable<Buffer>) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function removeQuietly(filePath: string): Promise<void> {
  await unlink(filePath).catch((err: any) => {
    if (err?.code !== 'ENOENT') throw err;
  });
}

async function writeAtomicImmutable(
  root: string,
  targetPath: string,
  data: Uint8Array,
  expectedSha256?: string
): Promise<void> {
  const tmpDir = path.join(root, 'tmp');
  await mkdir(tmpDir, { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });

  const tmpPath = path.join(tmpDir, randomUUID());
  let handle;
  try {
    handle = await open(tmpPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;

    try {
      await link(tmpPath, targetPath);
      await removeQuietly(tmpPath);
    } catch (linkError: any) {
      if (linkError?.code === 'EEXIST') {
        await removeQuietly(tmpPath);
        if (expectedSha256 && (await digestFile(targetPath)) !== expectedSha256) {
          throw new AttachmentError('保存済み添付ファイルの整合性検証に失敗しました。', 'ATTACHMENT_CORRUPT');
        }
      } else if (linkError?.code === 'EXDEV' || linkError?.code === 'EPERM' || linkError?.code === 'ENOTSUP') {
        await rename(tmpPath, targetPath);
      } else {
        throw linkError;
      }
    }

    await chmod(targetPath, 0o400).catch(() => {});
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await removeQuietly(tmpPath).catch(() => {});
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError('添付ファイルの保存に失敗しました。', 'ATTACHMENT_WRITE_FAILED', { cause: error });
  }
}

async function publishAlias(sourcePath: string, aliasPath: string, expectedSha256: string): Promise<void> {
  await mkdir(path.dirname(aliasPath), { recursive: true, mode: 0o700 });
  try {
    await link(sourcePath, aliasPath);
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      if ((await digestFile(aliasPath)) !== expectedSha256) {
        throw new AttachmentError('保存済み添付ファイルの整合性検証に失敗しました。', 'ATTACHMENT_CORRUPT');
      }
    } else if (error?.code === 'EXDEV' || error?.code === 'EPERM' || error?.code === 'ENOTSUP') {
      await copyFile(sourcePath, aliasPath);
    } else {
      throw new AttachmentError('添付ファイルエイリアスの作成に失敗しました。', 'ATTACHMENT_WRITE_FAILED', { cause: error });
    }
  }
  await chmod(aliasPath, 0o400).catch(() => {});
}

export interface SaveFileStreamInput {
  data: AsyncIterable<Uint8Array>;
  name?: string;
  signal?: AbortSignal;
}

export class LocalAttachmentStore {
  private static instance: LocalAttachmentStore;
  public readonly root: string;
  public readonly maxFileBytes: number;

  constructor(options?: { root?: string; maxFileBytes?: number }) {
    const baseDir = options?.root
      ?? config.attachments.dir
      ?? path.resolve(process.cwd(), 'data/attachments/v1');
    this.root = path.resolve(baseDir);
    this.maxFileBytes = options?.maxFileBytes ?? config.attachments.maxFileBytes;
  }

  public static getInstance(): LocalAttachmentStore {
    if (!LocalAttachmentStore.instance) {
      LocalAttachmentStore.instance = new LocalAttachmentStore();
    }
    return LocalAttachmentStore.instance;
  }

  private objectPath(sha256: string): string {
    return path.join(this.root, 'file-objects', sha256.slice(0, 2), sha256);
  }

  private aliasPath(sha256: string, safeName: string): string {
    return path.join(this.root, 'files', sha256.slice(0, 2), sha256, safeName);
  }

  private extractedPath(sha256: string): string {
    return path.join(this.root, 'extracted', sha256.slice(0, 2), `${sha256}.txt`);
  }

  /**
   * 境界付きチャンクストリームを受け取り、上限サイズチェック・テキスト検証＆抽出を行った上で
   * コンテンツアドレス型ストレージに不変オブジェクトとして永続化する。
   */
  public async saveFileStream(input: SaveFileStreamInput): Promise<FileAttachmentRef> {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    for await (const chunk of input.data) {
      input.signal?.throwIfAborted();
      totalBytes += chunk.byteLength;
      if (totalBytes > this.maxFileBytes) {
        const limitMb = Math.round((this.maxFileBytes / (1024 * 1024)) * 10) / 10;
        throw new AttachmentError(
          `ファイルサイズが上限（${limitMb} MB）を超えています。`,
          'FILE_TOO_LARGE'
        );
      }
      chunks.push(chunk);
    }
    input.signal?.throwIfAborted();

    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c.buffer, c.byteOffset, c.byteLength)), totalBytes);
    return this.saveFile(buffer, input.name);
  }

  /**
   * バイト列を検証・テキスト抽出し、原本と抽出テキストを永続化する。
   */
  public async saveFile(data: Uint8Array, rawName?: string): Promise<FileAttachmentRef> {
    const name = fileLeafName(rawName);
    const extracted = await extractSupportedFileText(data, name);

    const sha256 = createHash('sha256').update(data).digest('hex');
    const objPath = this.objectPath(sha256);
    const alsPath = this.aliasPath(sha256, name);
    const txtPath = this.extractedPath(sha256);

    await writeAtomicImmutable(this.root, objPath, data, sha256);
    await publishAlias(objPath, alsPath, sha256);
    await writeAtomicImmutable(this.root, txtPath, Buffer.from(extracted.text, 'utf8'));

    return {
      attachmentId: `sha256:${sha256}`,
      name,
      bytes: data.byteLength,
      mediaType: extracted.mediaType,
      ...(extracted.pageCount !== undefined ? { pageCount: extracted.pageCount } : {}),
      charCount: extracted.charCount,
    };
  }

  /**
   * 保存済み添付ファイルの抽出テキストを読み込む。
   * サイドカーキャッシュが存在すれば即座に返し、無い場合は原本の整合性検証後に再抽出する。
   */
  public async readExtractedText(
    attachmentId: string,
    fileName = 'file.txt'
  ): Promise<string> {
    const sha256 = parseSha256(attachmentId);
    const txtPath = this.extractedPath(sha256);

    try {
      return await readFile(txtPath, 'utf8');
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw new AttachmentError('抽出テキストの読み込みに失敗しました。', 'ATTACHMENT_READ_FAILED', { cause: error });
      }
    }

    // キャッシュ未作成時は原本から整合性検証して再抽出
    const objPath = this.objectPath(sha256);
    let rawBytes: Buffer;
    try {
      rawBytes = await readFile(objPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new AttachmentError('指定された添付ファイルが見つかりません。', 'ATTACHMENT_NOT_FOUND');
      }
      throw new AttachmentError('添付ファイルの読み込みに失敗しました。', 'ATTACHMENT_READ_FAILED', { cause: error });
    }

    const actual = createHash('sha256').update(rawBytes).digest('hex');
    if (actual !== sha256) {
      throw new AttachmentError('保存済み添付ファイルの整合性検証に失敗しました。', 'ATTACHMENT_CORRUPT');
    }

    const extracted = await extractSupportedFileText(rawBytes, fileName);
    await writeAtomicImmutable(this.root, txtPath, Buffer.from(extracted.text, 'utf8')).catch(() => {});
    return extracted.text;
  }
}
