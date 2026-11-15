import { marked } from "marked";
import { getAssetUrl } from "./browserStorage";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

function normalizeHtmlBlock(html: string): string {
  const lines = html.trim().split("\n").filter(line => line.trim());
  const indentation = Math.min(...lines.map(line => line.match(/^\s*/)?.[0].length ?? 0));
  return lines.map(line => line.slice(indentation)).join("\n");
}

/**
 * Converte caminhos relativos de imagem (ex: assets/foto.png) para URLs exibíveis
 */
export function resolveAssetUrl(src: string, _currentWikiPath: string | null): string {
  if (!src) return "";
  let trimmed = src.trim();
  // Se o usuário digitou ![alt](foto.png) ou colocou aspas/parênteses/WikiLink acidentalmente
  trimmed = trimmed.replace(/^!\[(.*?)\]\((.*?)\)$/, "$2").replace(/^['"]|['"]$/g, "").trim();
  trimmed = trimmed.replace(/^\[\[(.*?)\]\]$/, "$1").trim();
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  return getAssetUrl(normalized);
}

function escapeAttribute(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderCustomBody(markdown: string, currentWikiPath: string | null): string {
  return parseFandomMarkdown(markdown, currentWikiPath).html;
}

function getEditorParts(innerContent: string): { title: string; body: string }[] {
  const markerRegex = /^[ \t]*:::(?:part|col(?:umn|una)?)(?:[ \t]+titulo="([^"]*)")?[^\r\n]*$/gm;
  const markers = Array.from(innerContent.matchAll(markerRegex));
  if (!markers.length) {
    return innerContent
      .split(/\r?\n\s*---\s*\r?\n/)
      .map((body) => ({ title: "", body: body.trim() }))
      .filter((part) => part.body);
  }

  return markers.map((marker, index) => {
    const markerEnd = (marker.index ?? 0) + marker[0].length;
    const bodyStart = markerEnd + (innerContent[markerEnd] === "\r" ? 2 : 1);
    const bodyEnd = index + 1 < markers.length
      ? markers[index + 1].index ?? innerContent.length
      : innerContent.length;
    return {
      title: (marker[1] || "").replace(/&quot;/g, '"').trim(),
      body: innerContent.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function renderEditorParts(innerContent: string, currentWikiPath: string | null): string {
  const parts = getEditorParts(innerContent);
  if (!parts.length) return "";

  const count = parts.length;
  const gridColumns = count === 2
    ? "grid-cols-1 md:grid-cols-2"
    : count === 3
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
  const renderedParts = parts.map((part, index) => `
    <section class="min-w-0 px-4 first:pl-0 last:pr-0 ${index > 0 ? "border-t border-slate-800 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4" : ""}">
      ${part.title ? `<h2 class="text-sm font-semibold text-indigo-300 border-b border-slate-800 pb-2 mb-3">${marked.parseInline(part.title)}</h2>` : ""}
      <div class="text-sm leading-relaxed">
        ${renderCustomBody(part.body, currentWikiPath)}
      </div>
    </section>
  `).join("");

  return normalizeHtmlBlock(`
    <div class="my-4 w-full not-prose" data-fandom="editorparts">
      <div class="grid ${gridColumns} gap-0 items-start">
        ${renderedParts}
      </div>
    </div>
  `);
}

function flattenEditorParts(innerContent: string): string {
  return getEditorParts(innerContent).map((part) => part.body).filter(Boolean).join("\n\n");
}

function flattenLegacyColumnBlocks(markdown: string): string {
  const lines: { start: number; end: number; text: string }[] = [];
  const lineRegex = /[^\r\n]*(?:\r\n|\n|\r|$)/g;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = lineRegex.exec(markdown)) !== null && lineMatch[0]) {
    lines.push({
      start: lineMatch.index,
      end: lineMatch.index + lineMatch[0].length,
      text: lineMatch[0].replace(/(?:\r\n|\n|\r)$/, ""),
    });
  }

  let output = "";
  let cursor = 0;
  for (let index = 0; index < lines.length; index++) {
    if (!/^:::columns(?:\s.*)?$/.test(lines[index].text.trim())) continue;

    let nestedBlocks = 0;
    let closingIndex = -1;
    for (let candidate = index + 1; candidate < lines.length; candidate++) {
      const line = lines[candidate].text.trim();
      if (/^:::(?:infobox|notice|quote|gallery|section)\b/i.test(line)) {
        nestedBlocks++;
      } else if (/^:::endcolumns\s*$/i.test(line)) {
        closingIndex = candidate;
        break;
      } else if (/^:::\s*$/.test(line)) {
        if (nestedBlocks > 0) nestedBlocks--;
        else {
          closingIndex = candidate;
          break;
        }
      }
    }

    if (closingIndex === -1) continue;

    const openingEnd = lines[index].end;
    const closingStart = lines[closingIndex].start;
    output += markdown.slice(cursor, lines[index].start);
    output += `\n\n${flattenEditorParts(markdown.slice(openingEnd, closingStart))}\n\n`;
    cursor = lines[closingIndex].end;
    index = closingIndex;
  }

  return output + markdown.slice(cursor);
}

/**
 * Processa blocos customizados do Fandom:
 * - :::infobox ... :::
 * - :::editorparts ... :::endparts (partes editáveis em colunas no artigo)
 * - :::columns ... ::: (formato antigo de partes editáveis)
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
  const protectedBlocks: string[] = [];

  const storeProtected = (html: string) => {
    const placeholder = `<!--OPD_BLOCK_${protectedBlocks.length}-->`;
    protectedBlocks.push(html);
    return `\n\n${placeholder}\n\n`;
  };

  let content = rawMarkdown;

  // Renderizar as partes editáveis lado a lado no artigo.
  content = content.replace(
    /:::editorparts[^\r\n]*\r?\n([\s\S]*?)\r?\n\s*:::endparts(?:\s*\r?\n|$)/gi,
    (_match, innerContent) => storeProtected(renderEditorParts(innerContent, currentWikiPath))
  );

  content = content.replace(
    /:::columns[^\r\n]*\r?\n([\s\S]*?)\r?\n\s*:::endcolumns(?:\s*\r?\n|$)/gi,
    (_match, innerContent) => storeProtected(renderEditorParts(innerContent, currentWikiPath))
  );

  content = flattenLegacyColumnBlocks(content);

  // Processar Seções Isoladas antigas :::section ... ::: retrocompatibilidade
  content = content.replace(/:::section(?:\s+titulo="([^"]+)")?([\s\S]*?):::/g, (_match, rawTitle, sectionBody) => {
    const title = rawTitle ? rawTitle.trim() : "Seção";
    const parsedSubContent = renderCustomBody(sectionBody.trim(), currentWikiPath);

    const sectionHtml = normalizeHtmlBlock(`
      <div class="fandom-section-card border border-slate-800 bg-slate-900/50 rounded-xl p-4 my-4 shadow-sm not-prose" data-fandom="section">
        <div class="fandom-section-header flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <h3 class="text-sm font-bold text-indigo-300 m-0">
            ${marked.parseInline(title)}
          </h3>
        </div>
        <div class="fandom-section-body text-xs text-slate-300">
          ${parsedSubContent}
        </div>
      </div>
    `);

    return storeProtected(sectionHtml);
  });

  // 3. Processar Blocos de Infobox :::infobox ... :::
  content = content.replace(/:::infobox([\s\S]*?):::/g, (_match, blockContent) => {
    const lines = blockContent.trim().split("\n");
    let title = "Infobox";
    let image = "";
    let caption = "";
    const rows: { label: string; value: string; isSection?: boolean }[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

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
              ${marked.parseInline(row.label)}
            </div>
          `;
        }

        return `
          <div class="fandom-infobox-row">
            <div class="fandom-infobox-label">${marked.parseInline(row.label)}</div>
            <div class="fandom-infobox-value">${marked.parseInline(row.value)}</div>
          </div>
        `;
      })
      .join("");

    const blockHtml = normalizeHtmlBlock(`
      <div class="fandom-infobox-wrapper not-prose">
        <aside class="fandom-infobox" data-fandom="infobox">
          <div class="fandom-infobox-header">
            <span class="fandom-infobox-title">${marked.parseInline(title)}</span>
          </div>
          ${
            resolvedImage
              ? `
              <div class="fandom-infobox-media">
                <img src="${escapeAttribute(resolvedImage)}" alt="${escapeAttribute(title)}" class="fandom-infobox-image" />
                ${caption ? `<div class="fandom-infobox-caption">${marked.parseInline(caption)}</div>` : ""}
              </div>
            `
              : ""
          }
          <div class="fandom-infobox-data">
            ${rowsHtml}
          </div>
        </aside>
      </div>
    `);

    return storeProtected(blockHtml);
  });

  // 4. Processar Caixas de Aviso :::notice tipo="spoiler|info|warning|canon" ... :::
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
    const bodyHtml = renderCustomBody(body.trim(), currentWikiPath);

    const blockHtml = normalizeHtmlBlock(`
      <div class="fandom-notice fandom-notice-${escapeAttribute(type)} not-prose" data-fandom="notice">
        <div class="fandom-notice-indicator"></div>
        <div class="fandom-notice-content">
          <div class="fandom-notice-title">${marked.parseInline(title)}</div>
          <div class="fandom-notice-body">${bodyHtml}</div>
        </div>
      </div>
    `);

    return storeProtected(blockHtml);
  });

  // 5. Processar Caixas de Citação :::quote autor="..." ... :::
  content = content.replace(/:::quote(?:\s+autor="([^"]+)")?([\s\S]*?):::/g, (_match, rawAuthor, body) => {
    const author = rawAuthor || "";
    const quoteHtml = renderCustomBody(body.trim(), currentWikiPath);

    const blockHtml = normalizeHtmlBlock(`
      <div class="fandom-quote-box not-prose" data-fandom="quote">
        <span class="fandom-quote-mark">“</span>
        <blockquote class="fandom-quote-text">${quoteHtml}</blockquote>
        ${author ? `<div class="fandom-quote-author">— ${marked.parseInline(author)}</div>` : ""}
      </div>
    `);

    return storeProtected(blockHtml);
  });

  // 6. Processar Galerias de Imagens :::gallery ... :::
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
              <img src="${escapeAttribute(resolved)}" alt="${escapeAttribute(caption)}" class="fandom-gallery-img" />
            </div>
            ${caption ? `<div class="fandom-gallery-caption">${marked.parseInline(caption)}</div>` : ""}
          </div>
        `;
      })
      .join("");

    const blockHtml = normalizeHtmlBlock(`
      <div class="fandom-gallery-grid not-prose" data-fandom="gallery">
        ${itemsHtml}
      </div>
    `);

    return storeProtected(blockHtml);
  });

  // 7. Converter WikiLinks [[Nome da Página]] para elementos interativos
  content = content.replace(/\[\[(.*?)\]\]/g, (_match, rawName) => {
    const cleanName = rawName.trim();
    const encoded = encodeURIComponent(cleanName);
    return `<span class="wiki-link-pill" data-wikilink="${encoded}">🔗 <span class="wiki-link-text">${cleanName}</span></span>`;
  });

  // 8. Resolver imagens Markdown padrão ![Legenda](assets/...)
  content = content.replace(/!\[(.*?)\]\((.*?)\)/g, (_match, alt, src) => {
    const resolved = resolveAssetUrl(src, currentWikiPath);
    return `<figure class="fandom-article-figure not-prose"><img src="${escapeAttribute(resolved)}" alt="${escapeAttribute(alt)}" class="fandom-article-img" />${alt ? `<figcaption class="fandom-article-figcaption">${alt}</figcaption>` : ""}</figure>`;
  });

  // 9. Extrair cabeçalhos para o Índice (TOC)
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

  // 10. Renderizar Markdown com Marked
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  let parsedHtml = marked.parse(content) as string;

  // 11. Restaurar os blocos customizados protegidos intactos (sem corromper o HTML)
  for (let i = 0; i < protectedBlocks.length; i++) {
    const placeholderRegex = new RegExp(`(<p>\\s*)?<!--OPD_BLOCK_${i}-->(\\s*<\\/p>)?`, "g");
    parsedHtml = parsedHtml.replace(placeholderRegex, protectedBlocks[i]);
  }

  return { html: parsedHtml, toc };
}
