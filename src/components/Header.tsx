import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  Archive,
  FolderInput,
  Search,
  Database,
  FileText,
  X,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface SearchResult {
  path: string;
  title: string;
  folder: string;
  snippet?: string;
  matchType: "title" | "content";
}

interface HeaderProps {
  currentWikiPath: string | null;
  wikiName: string | null;
  pageCount: number;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSearchChange: (query: string) => void;
  onSelectPage: (path: string) => void | Promise<void>;
  onOpenWiki: () => void;
  onOpenCreateWiki: () => void;
  onExportOpd: () => void;
  onImportOpd: () => void;
  onRefresh: () => void;
  isDirty: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentWikiPath,
  wikiName,
  pageCount,
  searchQuery,
  searchResults,
  isSearching,
  onSearchChange,
  onSelectPage,
  onOpenWiki,
  onOpenCreateWiki,
  onExportOpd,
  onImportOpd,
  onRefresh,
  isDirty,
}) => {
  const resultsPerPage = 5;
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [currentResultPage, setCurrentResultPage] = useState(0);
  const searchPageCount = Math.ceil(searchResults.length / resultsPerPage);
  const pageStartIndex = currentResultPage * resultsPerPage;
  const visibleResults = searchResults.slice(pageStartIndex, pageStartIndex + resultsPerPage);
  const isDropdownOpen = Boolean(currentWikiPath && isSearchFocused && searchQuery.trim());

  useEffect(() => {
    setActiveResultIndex(-1);
    setCurrentResultPage(0);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentResultPage((page) => Math.min(page, Math.max(0, searchPageCount - 1)));
  }, [searchPageCount]);

  const selectResult = (result: SearchResult) => {
    void onSelectPage(result.path);
    onSearchChange("");
    setIsSearchFocused(false);
    setActiveResultIndex(-1);
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 text-slate-100 flex items-center justify-between px-4 select-none shrink-0 gap-4 shadow-sm">
      {/* Lado Esquerdo: Marca do Aplicativo e Informações da Wiki */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-900/30">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">
                OPD
              </span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Open Personal Database
              </span>
            </div>
            {wikiName ? (
              <div
                className="text-xs text-indigo-300 font-medium truncate max-w-[220px] md:max-w-[320px] flex items-center gap-1.5"
                title={currentWikiPath || ""}
              >
                <span className="font-semibold text-slate-200">{wikiName}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  {pageCount} {pageCount === 1 ? "página" : "páginas"}
                </span>
                {isDirty && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Alterações não salvas" />
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Nenhuma wiki aberta
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Centro: Campo de Busca Rápida de Páginas */}
      <div className="flex-1 max-w-md mx-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="wiki-search"
            type="text"
            placeholder={
              currentWikiPath
                ? "Buscar por nome ou conteúdo..."
                : "Abra uma wiki para buscar..."
            }
            title="Busca nomes e conteúdo das páginas Markdown"
            value={searchQuery}
            disabled={!currentWikiPath}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={(event) => {
              if (!isDropdownOpen) return;
              if (event.key === "ArrowDown" && searchResults.length > 0) {
                event.preventDefault();
                const nextIndex = (activeResultIndex + 1) % searchResults.length;
                setCurrentResultPage(Math.floor(nextIndex / resultsPerPage));
                setActiveResultIndex(nextIndex);
              } else if (event.key === "ArrowUp" && searchResults.length > 0) {
                event.preventDefault();
                const nextIndex = activeResultIndex <= 0 ? searchResults.length - 1 : activeResultIndex - 1;
                setCurrentResultPage(Math.floor(nextIndex / resultsPerPage));
                setActiveResultIndex(nextIndex);
              } else if (event.key === "Enter" && searchResults.length > 0) {
                event.preventDefault();
                selectResult(searchResults[Math.max(activeResultIndex, 0)]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setIsSearchFocused(false);
              }
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isDropdownOpen}
            aria-controls={searchResults.length > 0 ? "wiki-search-results" : undefined}
            aria-activedescendant={activeResultIndex >= 0 ? `wiki-search-result-${activeResultIndex}` : undefined}
            className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/80 focus:border-indigo-500 text-xs text-slate-200 rounded-lg pl-9 pr-8 py-2 outline-none transition placeholder-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              onMouseDown={(event) => event.preventDefault()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 rounded"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
              {searchResults.length > 0 ? (
                <ul id="wiki-search-results" role="listbox" aria-label="Resultados da busca" className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
                  {visibleResults.map((result, index) => {
                    const resultIndex = pageStartIndex + index;
                    return (
                    <li
                      id={`wiki-search-result-${resultIndex}`}
                      key={result.path}
                      role="option"
                      aria-selected={activeResultIndex === resultIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveResultIndex(resultIndex)}
                      onClick={() => selectResult(result)}
                      className={`cursor-pointer rounded-lg px-3 py-2.5 transition ${
                        activeResultIndex === resultIndex ? "bg-indigo-600/20" : "hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-100">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                          <span className="truncate">{result.title}</span>
                        </span>
                        <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {result.matchType === "title" ? "Título" : "Conteúdo"}
                        </span>
                      </div>
                      {result.folder && (
                        <span className="mt-1 block truncate pl-[22px] text-[10px] text-slate-500">
                          {result.folder}
                        </span>
                      )}
                      {result.snippet && (
                        <span className="mt-1 block truncate pl-[22px] text-[10px] text-slate-400">
                          {result.snippet}
                        </span>
                      )}
                    </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-4 text-center text-xs text-slate-400">
                  {isSearching ? "Buscando nas páginas..." : "Nenhuma página encontrada."}
                </p>
              )}
              {isSearching && searchResults.length > 0 ? (
                <p className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
                  {searchResults.length} {searchResults.length === 1 ? "resultado encontrado" : "resultados encontrados"}; buscando também no conteúdo...
                </p>
              ) : searchResults.length > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-800 px-2 py-1.5">
                  <span className="text-[10px] text-slate-400">
                    {pageStartIndex + 1}–{Math.min(pageStartIndex + visibleResults.length, searchResults.length)} de {searchResults.length}
                  </span>
                  {searchPageCount > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Resultados anteriores"
                        title="Resultados anteriores"
                        disabled={currentResultPage === 0}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setCurrentResultPage((page) => page - 1);
                          setActiveResultIndex(-1);
                        }}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-[10px] text-slate-400">
                        {currentResultPage + 1}/{searchPageCount}
                      </span>
                      <button
                        type="button"
                        aria-label="Próximos resultados"
                        title="Próximos resultados"
                        disabled={currentResultPage >= searchPageCount - 1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setCurrentResultPage((page) => page + 1);
                          setActiveResultIndex(-1);
                        }}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <span className="hidden text-[10px] text-slate-500 sm:inline">
                    ↑ ↓ navega · Enter abre
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Lado Direito: Ações Principais */}
      <div className="flex items-center gap-2 shrink-0">
        {currentWikiPath && (
          <button
            onClick={onRefresh}
            title="Atualizar árvore de arquivos"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Nova Wiki */}
        <button
          onClick={onOpenCreateWiki}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 rounded-lg transition shadow-sm shadow-indigo-600/30"
          title="Criar uma nova wiki personalizada no computador"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
          <span className="hidden sm:inline">Nova Wiki</span>
        </button>

        {/* Abrir Wiki */}
        <button
          onClick={onOpenWiki}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg transition shadow-sm"
          title="Abrir pasta existente como Wiki local"
        >
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Abrir Wiki</span>
        </button>

        {/* Exportar .opd */}
        <button
          onClick={onExportOpd}
          disabled={!currentWikiPath}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          title="Compactar a wiki inteira em um pacote .opd"
        >
          <Archive className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Exportar .opd</span>
        </button>

        {/* Importar .opd */}
        <button
          onClick={onImportOpd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-100 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition shadow-sm shadow-indigo-600/30"
          title="Descompactar um arquivo .opd para uma pasta local"
        >
          <FolderInput className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Importar .opd</span>
        </button>
      </div>
    </header>
  );
};
