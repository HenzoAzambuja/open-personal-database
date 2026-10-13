import React, { useState, useMemo, useRef } from "react";
import { parseFandomMarkdown } from "../utils/fandomParser";
import {
  Save,
  BookOpen,
  Edit3,
  Columns,
  Bold,
  Italic,
  Heading,
  Link2,
  List,
  Code,
  Quote,
  FileQuestion,
  Plus,
  Check,
  Sparkles,
  ImagePlus,
  LayoutTemplate,
  AlertTriangle,
  Images,
  ListOrdered,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  FileText,
} from "lucide-react";

interface EditorProps {
  currentWikiPath?: string | null;
  activeFilePath: string | null;
  activeFileTitle: string | null;
  content: string;
  isDirty: boolean;
  onContentChange: (newContent: string) => void;
  onSave: () => void;
  onNavigateWikiLink: (pageName: string) => void;
  onCreatePage: () => void;
  onOpenCreateWiki?: () => void;
  onInsertImage?: () => Promise<string | null>;
}

type ViewMode = "preview" | "edit" | "split";

export const Editor: React.FC<EditorProps> = ({
  currentWikiPath,
  activeFilePath,
  activeFileTitle,
  content,
  isDirty,
  onContentChange,
  onSave,
  onNavigateWikiLink,
  onCreatePage,
  onOpenCreateWiki,
  onInsertImage,
}) => {
  // Modo padrão "preview" (Artigo Fandom) para uma experiência de wiki completa
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parser customizado do Fandom com suporte a Infoboxes, Quotes, Notices, Galerias e WikiLinks
  const { html: renderedHtml, toc } = useMemo(() => {
    return parseFandomMarkdown(content, currentWikiPath || null);
  }, [content, currentWikiPath]);

  // Estatísticas do artigo (contagem de palavras e tempo de leitura)
  const stats = useMemo(() => {
    const textOnly = content.replace(/:::[\s\S]*?:::/g, "").replace(/[#*`_[\]()]/g, "");
    const words = textOnly.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return { words, minutes };
  }, [content]);

  // Captura cliques no container de Preview para navegar via WikiLinks ou abrir Lightbox em imagens
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Clique em WikiLink
    const wikiTarget = (e.target as HTMLElement).closest("[data-wikilink]");
    if (wikiTarget) {
      e.preventDefault();
      e.stopPropagation();
      const raw = wikiTarget.getAttribute("data-wikilink");
      if (raw) {
        const pageName = decodeURIComponent(raw);
        onNavigateWikiLink(pageName);
      }
      return;
    }

    // 2. Clique em Imagem para abrir no Lightbox
    const imgTarget = (e.target as HTMLElement).closest("img");
    if (imgTarget && imgTarget.src) {
      setSelectedLightboxImage(imgTarget.src);
    }
  };

  // Funções de auxílio para inserção de Markdown na posição do cursor
  const insertTextAtCursor = (prefix: string, suffix = "", defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || defaultText;

    const newContent =
      content.substring(0, start) +
      prefix +
      selected +
      suffix +
      content.substring(end);

    onContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    }, 0);
  };

  // Inserir Imagem nativa
  const handleInsertImage = async () => {
    if (!onInsertImage) return;
    const relativePath = await onInsertImage();
    if (relativePath) {
      const imgMarkdown = `\n![Legenda da Imagem](${relativePath})\n`;
      insertTextAtCursor(imgMarkdown);
    }
  };

  // Inserir Template de Infobox Fandom
  const handleInsertInfobox = () => {
    const defaultTitle = activeFileTitle || "Título do Artigo";
    const template = `\n:::infobox
title: ${defaultTitle}
image: assets/imagem.png
caption: Imagem de apresentação
[Informações Gerais]
Nome: ${defaultTitle}
Tipo: Personagem / Conceito
Origem: Local ou Obra
Afiliação: [[Grupo ou Facção]]
Status: Ativo
[Detalhes]
Primeira Aparição: Capítulo 1
Estatística: Valor
:::
\n`;
    insertTextAtCursor(template);
  };

  // Inserir Template de Caixa de Aviso / Spoiler
  const handleInsertNotice = () => {
    const template = `\n:::notice tipo="spoiler" titulo="Alerta de Spoiler"
Este artigo contém revelações e detalhes cruciais sobre a história.
:::\n`;
    insertTextAtCursor(template);
  };

  // Inserir Template de Caixa de Citação
  const handleInsertQuote = () => {
    const template = `\n:::quote autor="Autor ou Personagem"
"Escreva aqui a citação marcante ou diálogo do personagem..."
:::\n`;
    insertTextAtCursor(template);
  };

  // Inserir Template de Galeria de Imagens
  const handleInsertGallery = () => {
    const template = `\n:::gallery
assets/foto1.png | Primeira Aparição
assets/foto2.png | Arte Promocional
:::\n`;
    insertTextAtCursor(template);
  };

  if (!activeFilePath) {
    if (!currentWikiPath) {
      return (
        <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-900/60 to-cyan-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-950/50">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            Bem-vindo ao Open Personal Database
          </h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            Sua ferramenta Local-First para criar e organizar wikis pessoais estilo Fandom com suporte a Infoboxes, Imagens, Galerias e WikiLinks.
          </p>
          <div className="flex items-center gap-3">
            {onOpenCreateWiki && (
              <button
                onClick={onOpenCreateWiki}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 rounded-xl transition shadow-lg shadow-indigo-600/30"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                Criar Minha Wiki
              </button>
            )}
          </div>

          <div className="mt-12 p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl max-w-md text-left text-xs text-slate-400 space-y-2.5">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>🌟 Recursos Estilo Fandom:</span>
            </div>
            <div>
              • <strong>Infoboxes Flutuantes:</strong> Destaque personagens, locais e itens com dados estruturados.
            </div>
            <div>
              • <strong>Imagens e Galerias:</strong> Importe fotos diretamente para a pasta <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">/assets</code> da wiki.
            </div>
            <div>
              • <strong>Caixas de Aviso e Citações:</strong> Crie avisos de spoiler e frases de destaque com formatação temática.
            </div>
            <div>
              • <strong>WikiLinks:</strong> Conecte páginas usando <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">[[Nome da Página]]</code>.
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <FileQuestion className="w-8 h-8 text-indigo-400/80" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">
          Nenhum artigo selecionado
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Selecione uma página na barra lateral para ler ou editar, ou crie uma nova entrada para a sua wiki.
        </p>
        <button
          onClick={onCreatePage}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Criar Novo Artigo
        </button>

        <div className="mt-12 p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl max-w-md text-left text-xs text-slate-400 space-y-2">
          <div className="font-semibold text-slate-300">💡 Dicas de Edição Fandom:</div>
          <div>
            • Clique no botão <strong>Infobox</strong> para adicionar fichas de personagens e tópicos.
          </div>
          <div>
            • Use o botão <strong>Inserir Imagem</strong> para salvar ilustrações automaticamente na sua wiki.
          </div>
          <div>
            • Conecte suas notas com <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">[[Nome da Página]]</code>.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-slate-950 flex flex-col overflow-hidden h-full">
      {/* Barra de Navegação de Artigo (Estilo Fandom Tabs) */}
      <div className="h-14 bg-slate-900/95 border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 gap-4">
        {/* Título e Metadados do Artigo */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                Artigo Fandom
              </span>
              <h1 className="text-sm font-bold text-slate-100 truncate">
                {activeFileTitle || "Sem título"}
              </h1>
              {isDirty ? (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                  Não salvo
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Salvo
                </span>
              )}
            </div>
            <p
              className="text-[10px] text-slate-500 truncate max-w-sm md:max-w-md font-mono"
              title={activeFilePath}
            >
              {activeFilePath}
            </p>
          </div>
        </div>

        {/* Alternador de Abas de Visualização (Fandom Style) & Salvar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "preview"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Visualizar Artigo Fandom"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Artigo</span>
            </button>
            <button
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "edit"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Editar Código Markdown"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "split"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Lado a Lado (Split View)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Dividido</span>
            </button>
          </div>

          {/* Botão de Salvar */}
          <button
            onClick={onSave}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition shadow-sm ${
              isDirty
                ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-600/30"
                : "bg-slate-800 text-slate-500 border border-slate-700/40 cursor-default"
            }`}
            title="Salvar alterações (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar</span>
          </button>
        </div>
      </div>

      {/* Barra de Ferramentas com Recursos Fandom (Ativa em modo de edição ou split) */}
      {viewMode !== "preview" && (
        <div className="h-11 bg-slate-900/80 border-b border-slate-800/80 px-4 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none custom-scrollbar">
          {/* Botão Inserir Imagem Nativa */}
          <button
            onClick={handleInsertImage}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition shrink-0"
            title="Escolher imagem do computador e salvar na pasta /assets"
          >
            <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Imagem</span>
          </button>

          {/* Botão Inserir Infobox Fandom */}
          <button
            onClick={handleInsertInfobox}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition shrink-0"
            title="Inserir Caixa Lateral (Fandom Infobox)"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-cyan-400" />
            <span>Infobox</span>
          </button>

          {/* Botão Inserir Caixa de Aviso / Spoiler */}
          <button
            onClick={handleInsertNotice}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition shrink-0"
            title="Inserir Caixa de Aviso / Spoiler"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Aviso</span>
          </button>

          {/* Botão Inserir Caixa de Citação */}
          <button
            onClick={handleInsertQuote}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-lg transition shrink-0"
            title="Inserir Caixa de Citação"
          >
            <Quote className="w-3.5 h-3.5 text-indigo-400" />
            <span>Citação</span>
          </button>

          {/* Botão Inserir Galeria */}
          <button
            onClick={handleInsertGallery}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 rounded-lg transition shrink-0"
            title="Inserir Galeria de Imagens"
          >
            <Images className="w-3.5 h-3.5 text-purple-400" />
            <span>Galeria</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

          {/* Botão WikiLink */}
          <button
            onClick={() => insertTextAtCursor("[[", "]]", "Nome da Página")}
            className="flex items-center gap-1 px-2 py-1 text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded text-xs transition shrink-0"
            title="Inserir WikiLink ([[Página]])"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">[[WikiLink]]</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

          {/* Formatações Padrão */}
          <button
            onClick={() => insertTextAtCursor("**", "**", "texto")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
            title="Negrito (**texto**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertTextAtCursor("*", "*", "texto")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
            title="Itálico (*texto*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertTextAtCursor("## ", "\n", "Seção")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
            title="Seção (## Título)"
          >
            <Heading className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertTextAtCursor("- ", "\n", "Item")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
            title="Lista (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertTextAtCursor("```\n", "\n```\n", "código")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
            title="Bloco de código"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Corpo Central */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Painel do Editor Textarea */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div
            className={`h-full flex flex-col ${
              viewMode === "split"
                ? "w-1/2 border-r border-slate-800"
                : "w-full"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Escreva seu artigo aqui... Use as ferramentas da barra superior para adicionar Infoboxes, Imagens, Avisos e WikiLinks!"
              className="w-full h-full p-6 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed resize-none outline-none custom-scrollbar focus:ring-0 selection:bg-indigo-900/60 selection:text-white"
              spellCheck={false}
            />
          </div>
        )}

        {/* Painel de Visualização Estilo Fandom */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            onClick={handlePreviewClick}
            className={`h-full overflow-y-auto bg-slate-900/25 custom-scrollbar ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <div className="max-w-4xl mx-auto p-6 md:p-8">
              {/* Cabeçalho do Artigo Fandom */}
              <div className="border-b-2 border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Artigo de Base de Conhecimento
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {activeFileTitle || "Artigo sem título"}
                </h1>

                {/* Barra de Informações do Artigo */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>{stats.words} palavras</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>~{stats.minutes} min de leitura</span>
                  </div>
                  {viewMode === "preview" && (
                    <button
                      onClick={() => setViewMode("edit")}
                      className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar página</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Índice de Conteúdo (Table of Contents - TOC) estilo Fandom/Wikipedia */}
              {toc.length > 1 && (
                <div className="fandom-toc-card mb-6 select-none">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
                      <ListOrdered className="w-4 h-4 text-indigo-400" />
                      <span>Índice</span>
                    </div>
                    <button
                      onClick={() => setIsTocOpen(!isTocOpen)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <span>{isTocOpen ? "ocultar" : "mostrar"}</span>
                      {isTocOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {isTocOpen && (
                    <ol className="text-xs space-y-1 text-slate-300 pl-4 list-decimal">
                      {toc.map((item, index) => (
                        <li key={`${item.id}-${index}`} className="hover:text-indigo-300 transition">
                          <span
                            className="cursor-pointer"
                            style={{ paddingLeft: `${Math.max(0, item.level - 2) * 12}px` }}
                          >
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Conteúdo Renderizado (Infobox flutuando à direita + texto ao redor) */}
              {content.trim() ? (
                <div className="clearfix">
                  <div
                    className="prose prose-invert prose-indigo max-w-none text-slate-200 text-sm leading-relaxed opd-markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>
              ) : (
                <div className="text-slate-600 italic text-xs py-8 text-center">
                  O artigo está vazio. Clique em Editar para começar a escrever!
                </div>
              )}

              {/* Barra de Categorias no Rodapé do Artigo (Estilo Fandom) */}
              <div className="mt-12 pt-4 border-t border-slate-800 flex items-center gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-400">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Categorias:</span>
                </div>
                <span className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded-md cursor-pointer transition">
                  Wiki Local
                </span>
                <span className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded-md cursor-pointer transition">
                  {currentWikiPath?.split("/").pop() || "Geral"}
                </span>
                <span className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded-md cursor-pointer transition">
                  Artigos
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Modal para Visualização Ampliada de Imagens */}
      {selectedLightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedLightboxImage(null)}
              className="absolute -top-10 right-0 p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-full transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedLightboxImage}
              alt="Ampliação"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </main>
  );
};
