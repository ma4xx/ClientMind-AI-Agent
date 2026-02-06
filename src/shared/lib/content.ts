import fs from 'fs';
import path from 'path';

export interface LocalPage {
  title?: string;
  description?: string;
  content: string;
  [key: string]: any;
}

/**
 * Get local page content from content/pages/*.mdx
 */
export async function getLocalPage({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}): Promise<LocalPage | null> {
  const contentDir = path.join(process.cwd(), 'content/pages');
  const files = [
    path.join(contentDir, `${slug}.${locale}.mdx`),
    path.join(contentDir, `${slug}.mdx`),
  ];

  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Simple frontmatter parser
      const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
      const match = fileContent.match(frontmatterRegex);

      if (match) {
        const yaml = match[1];
        const content = match[2];
        const metadata: Record<string, string> = {};

        yaml.split('\n').forEach((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            metadata[key] = value;
          }
        });

        return {
          title: metadata.title || '',
          description: metadata.description || '',
          content,
          ...metadata,
        };
      }

      return {
        content: fileContent,
      };
    }
  }

  return null;
}
