import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LegalSkill {
  name: string;
  description: string;
  body: string;
}

let cache: LegalSkill[] | null = null;

/**
 * `skills/<name>/SKILL.md` を読み込む。
 * harness と同じく frontmatter（name / description）＋本文という最小構成だけを扱う。
 * ponytail: 値は 1 行前提の素朴なパーサ。複数行 YAML が必要になったら yaml パーサに置き換える。
 */
export function loadLegalSkills(): LegalSkill[] {
  if (cache) return cache;

  const root = path.join(__dirname, '../../skills');
  if (!fs.existsSync(root)) {
    cache = [];
    return cache;
  }

  const skills: LegalSkill[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;

    try {
      const raw = fs.readFileSync(file, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      skills.push({
        name: meta.name || entry.name,
        description: meta.description || '',
        body: body.trim(),
      });
    } catch {
      // 壊れた SKILL.md は無視して他のスキルを止めない
    }
  }

  cache = skills;
  return cache;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { meta, body: match[2] };
}

/** スキルをモデル向けの `<skill_content>` ブロックに描画する */
export function renderSkills(skills: LegalSkill[]): string {
  return skills
    .map(skill => {
      const description = skill.description ? ` description="${escapeAttribute(skill.description)}"` : '';
      return `<skill_content name="${escapeAttribute(skill.name)}"${description}>\n${skill.body}\n</skill_content>`;
    })
    .join('\n\n');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
