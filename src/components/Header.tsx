import React from "react";
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
} from "lucide-react";

interface HeaderProps {
  currentWikiPath: string | null;
  wikiName: string | null;
  pageCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
  onSearchChange,
  onOpenWiki,
  onOpenCreateWiki,
  onExportOpd,
  onImportOpd,
  onRefresh,
  isDirty,
}) => {
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
            type="text"
            placeholder={
              currentWikiPath
                ? "Filtrar páginas ou notas..."
                : "Abra uma wiki para buscar..."
            }
            value={searchQuery}
            disabled={!currentWikiPath}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/80 focus:border-indigo-500 text-xs text-slate-200 rounded-lg pl-9 pr-8 py-2 outline-none transition placeholder-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 rounded"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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

