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
  const withResolvedImages = markdown.replace(/!\[(.*?)\]\((.*?)\)/g, (_match, alt, src) => {
    const resolved = resolveAssetUrl(src, currentWikiPath);
    return `<img src="${escapeAttribute(resolved)}" alt="${escapeAttribute(alt)}" class="fandom-article-img" />`;
  });
  return marked.parse(withResolvedImages) as string;
}

/**
 * Processa blocos customizados do Fandom:
 * - :::infobox ... :::
 * - :::columns ... ::: (seções verticais dividindo a tela em até 4 colunas)
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

  // 1. Processar Blocos de Colunas/Seções Verticais :::columns ... ::: (máximo 4 colunas dividindo a tela)
  content = content.replace(/(?:^|\r?\n):::columns[^\r\n]*(?:\r?\n)([\s\S]*?)(?:\r?\n\s*:::(?:endcolumns)?\s*(?:\r?\n|$)|$)/gi, (_match, innerContent) => {
    // Regex para capturar colunas dentro do bloco :::columns:
    // Suporta :::col titulo="...", :::col, :::coluna titulo="...", [coluna: ...]
    const colRegex = /(?:^|\r?\n)\s*(?::::col(?:umn|una)?(?:\s+titulo="([^"]*)")?|\[col(?:una)?(?::\s*([^\]]*))?\])([\s\S]*?)(?=(?:\r?\n\s*(?::::col(?:umn|una)?|\[col(?:una)?)|$))/gi;
    let cm;
    const cols: { title?: string; body: string }[] = [];
    while ((cm = colRegex.exec(innerContent)) !== null) {
      const title = (cm[1] || cm[2] || "").trim();
      const body = cm[3].trim().replace(/\r?\n\s*:::(?:endcol)?\s*$/g, "");
      if (body || title) {
        cols.push({ title, body });
      }
    }

    // Se o usuário não utilizou a tag :::col, tenta dividir por separadores horizontais ---
    if (cols.length === 0) {
      const parts = innerContent.split(/\r?\n\s*---\s*\r?\n/);
      for (const part of parts) {
        const cleaned = part.trim().replace(/\r?\n\s*:::\s*$/g, "");
        if (cleaned) cols.push({ body: cleaned });
      }
    }

    // Se ainda estiver vazio mas há conteúdo, usa o conteúdo como coluna única
    if (cols.length === 0 && innerContent.trim()) {
      cols.push({ body: innerContent.trim().replace(/\r?\n\s*:::\s*$/g, "") });
    }

    // Limite máximo de 4 seções verticais
    const finalCols = cols.slice(0, 4);
    const count = Math.max(1, Math.min(4, finalCols.length));

    // Determina classe grid dependendo da quantidade (1 a 4 colunas)
    const gridColsClass = count === 1
      ? "grid-cols-1"
      : count === 2
      ? "grid-cols-1 md:grid-cols-2"
      : count === 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";

    const colsHtml = finalCols
      .map((col, idx) => {
        const parsedBody = renderCustomBody(col.body, currentWikiPath);
        return `
          <div class="fandom-vertical-col flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm min-w-0">
            ${
              col.title
                ? `<div class="font-bold text-xs text-indigo-300 border-b border-slate-800/80 pb-2 mb-3 flex items-center justify-between">
                     <span>${marked.parseInline(col.title)}</span>
                     <span class="text-[10px] text-slate-500 font-mono">Coluna ${idx + 1}</span>
                   </div>`
                : ""
            }
            <div class="text-xs text-slate-300 leading-relaxed flex-1 space-y-2">
              ${parsedBody}
            </div>
          </div>
        `;
      })
      .join("");

    const blockHtml = normalizeHtmlBlock(`
      <div class="fandom-columns-container my-6 not-prose" data-fandom="columns">
        <div class="grid ${gridColsClass} gap-4 items-stretch">
          ${colsHtml}
        </div>
      </div>
    `);

    return storeProtected(blockHtml);
  });

  // 2. Processar Seções Isoladas antigas :::section ... ::: retrocompatibilidade
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
