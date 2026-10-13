import { marked } from "marked";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Converte caminhos relativos de imagem (ex: assets/foto.png) para URLs exibíveis no Tauri
 */
export function resolveAssetUrl(src: string, currentWikiPath: string | null): string {
  if (!src) return "";
  const trimmed = src.trim();

  // URLs remotas (http, https, data:) já estão prontas
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  // Se tivermos a pasta da wiki atual, convertemos o caminho absoluto com convertFileSrc
  if (currentWikiPath) {
    const normalizedWiki = currentWikiPath.replace(/\\/g, "/").replace(/\/$/, "");
    const normalizedSrc = trimmed.replace(/\\/g, "/").replace(/^\//, "");
    const fullPath = `${normalizedWiki}/${normalizedSrc}`;
    try {
      return convertFileSrc(fullPath);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Processa blocos customizados do Fandom:
 * - :::infobox ... :::
 * - :::quote ... :::
 * - :::notice ... :::
 * - :::gallery ... :::
 * E também converte [[WikiLinks]] e gera o Índice (TOC)
 */
export function parseFandomMarkdown(
  rawMarkdown: string,
  currentWikiPath: string | null
): { html: string; toc: TocItem[] } {
  if (!rawMarkdown) return { html: "", toc: [] };

  const toc: TocItem[] = [];
  let content = rawMarkdown;

  // 1. Processar Blocos de Infobox :::infobox ... :::
  content = content.replace(/:::infobox([\s\S]*?):::/g, (_match, blockContent) => {
    const lines = blockContent.trim().split("\n");
    let title = "Infobox";
    let image = "";
    let caption = "";
    const rows: { label: string; value: string; isSection?: boolean }[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Seção: [Nome da Seção]
      if (line.startsWith("[") && line.endsWith("]")) {
        rows.push({
          label: line.slice(1, -1),
          value: "",
          isSection: true,
        });
        continue;
      }

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (key.toLowerCase() === "title" || key.toLowerCase() === "título") {
        title = val;
      } else if (key.toLowerCase() === "image" || key.toLowerCase() === "imagem") {
        image = val;
      } else if (key.toLowerCase() === "caption" || key.toLowerCase() === "legenda") {
        caption = val;
      } else {
        rows.push({ label: key, value: val });
      }
    }

    const resolvedImage = image ? resolveAssetUrl(image, currentWikiPath) : "";

    const rowsHtml = rows
      .map((row) => {
        if (row.isSection) {
          return `
            <div class="fandom-infobox-section-header">
              ${row.label}
            </div>
          `;
        }

        return `
          <div class="fandom-infobox-row">
            <div class="fandom-infobox-label">${row.label}</div>
            <div class="fandom-infobox-value">${row.value}</div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="fandom-infobox-wrapper">
        <aside class="fandom-infobox" data-fandom="infobox">
          <div class="fandom-infobox-header">
            <span class="fandom-infobox-title">${title}</span>
          </div>
          ${
            resolvedImage
              ? `
              <div class="fandom-infobox-media">
                <img src="${resolvedImage}" alt="${title}" class="fandom-infobox-image" />
                ${caption ? `<div class="fandom-infobox-caption">${caption}</div>` : ""}
              </div>
            `
              : ""
          }
          <div class="fandom-infobox-data">
            ${rowsHtml}
          </div>
        </aside>
      </div>
    `;
  });

  // 2. Processar Caixas de Aviso :::notice tipo="spoiler|info|warning|canon" ... :::
  content = content.replace(/:::notice(?:\s+tipo="([^"]+)")?(?:\s+titulo="([^"]+)")?([\s\S]*?):::/g, (_match, rawType, rawTitle, body) => {
    const type = (rawType || "info").toLowerCase();
    const defaultTitles: Record<string, string> = {
      spoiler: "Alerta de Spoiler",
      warning: "Aviso Importante",
      info: "Informação Canônica",
      canon: "Conteúdo Oficial",
      wip: "Artigo em Construção",
    };
    const title = rawTitle || defaultTitles[type] || "Nota";
    const bodyText = body.trim();

    return `
      <div class="fandom-notice fandom-notice-${type}" data-fandom="notice">
        <div class="fandom-notice-indicator"></div>
        <div class="fandom-notice-content">
          <div class="fandom-notice-title">${title}</div>
          <div class="fandom-notice-body">${bodyText}</div>
        </div>
      </div>
    `;
  });

  // 3. Processar Caixas de Citação :::quote autor="..." ... :::
  content = content.replace(/:::quote(?:\s+autor="([^"]+)")?([\s\S]*?):::/g, (_match, rawAuthor, body) => {
    const author = rawAuthor || "";
    const quoteText = body.trim();

    return `
      <div class="fandom-quote-box" data-fandom="quote">
        <span class="fandom-quote-mark">“</span>
        <blockquote class="fandom-quote-text">${quoteText}</blockquote>
        ${author ? `<div class="fandom-quote-author">— ${author}</div>` : ""}
      </div>
    `;
  });

  // 4. Processar Galerias de Imagens :::gallery ... :::
  content = content.replace(/:::gallery([\s\S]*?):::/g, (_match, blockContent) => {
    const lines = blockContent.trim().split("\n");
    const itemsHtml = lines
      .map((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        const parts = trimmed.split("|");
        const src = parts[0]?.trim();
        const caption = parts[1]?.trim() || "";
        if (!src) return "";
        const resolved = resolveAssetUrl(src, currentWikiPath);
        return `
          <div class="fandom-gallery-item">
            <div class="fandom-gallery-img-wrapper">
              <img src="${resolved}" alt="${caption}" class="fandom-gallery-img" />
            </div>
            ${caption ? `<div class="fandom-gallery-caption">${caption}</div>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <div class="fandom-gallery-grid" data-fandom="gallery">
        ${itemsHtml}
      </div>
    `;
  });

  // 5. Converter WikiLinks [[Nome da Página]] para elementos interativos
  content = content.replace(/\[\[(.*?)\]\]/g, (_match, rawName) => {
    const cleanName = rawName.trim();
    const encoded = encodeURIComponent(cleanName);
    return `<span class="wiki-link-pill" data-wikilink="${encoded}">🔗 <span class="wiki-link-text">${cleanName}</span></span>`;
  });

  // 6. Resolver imagens Markdown padrão ![Legenda](assets/...)
  content = content.replace(/!\[(.*?)\]\((.*?)\)/g, (_match, alt, src) => {
    const resolved = resolveAssetUrl(src, currentWikiPath);
    return `<figure class="fandom-article-figure"><img src="${resolved}" alt="${alt}" class="fandom-article-img" />${alt ? `<figcaption class="fandom-article-figcaption">${alt}</figcaption>` : ""}</figure>`;
  });

  // 7. Extrair cabeçalhos para o Índice (TOC)
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(rawMarkdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim().replace(/\[\[(.*?)\]\]/g, "$1");
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    toc.push({ id, text, level });
  }

  // 8. Renderizar Markdown com Marked
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const parsedHtml = marked.parse(content) as string;

  return { html: parsedHtml, toc };
}

