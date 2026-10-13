import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  FolderArchive,
  Plus,
  Sparkles,
} from "lucide-react";
import { FileNode } from "../types/wiki";

interface SidebarProps {
  wikiPath: string | null;
  wikiName: string | null;
  fileTree: FileNode[];
  activeFilePath: string | null;
  searchQuery: string;
  onSelectPage: (path: string) => void;
  onCreatePage: (parentPath?: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onDeleteItem: (path: string, name: string) => void;
  onOpenWiki: () => void;
  onOpenCreateWiki: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  activeFilePath: string | null;
  searchQuery: string;
  onSelectPage: (path: string) => void;
  onCreatePage: (parentPath?: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onDeleteItem: (path: string, name: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  activeFilePath,
  searchQuery,
  onSelectPage,
  onCreatePage,
  onCreateFolder,
  onDeleteItem,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Filtro de busca recursivo
  const matchesSearch = (item: FileNode, q: string): boolean => {
    if (!q) return true;
    if (item.name.toLowerCase().includes(q.toLowerCase())) return true;
    if (item.children) {
      return item.children.some((child) => matchesSearch(child, q));
    }
    return false;
  };

  if (searchQuery && !matchesSearch(node, searchQuery)) {
    return null;
  }

  const isSelected = activeFilePath === node.path;
  const paddingLeft = `${level * 16 + 12}px`;

  if (node.is_dir) {
    return (
      <div className="select-none">
        <div
          className="group flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/80 rounded-md cursor-pointer transition text-slate-300 text-xs font-medium"
          style={{ paddingLeft }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-slate-500 hover:text-slate-300 transition">
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
            </span>
            {isOpen ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500/80 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {/* Ações contextuais na pasta (visíveis ao passar o mouse) */}
          <div
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onCreatePage(node.path)}
              className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/80 rounded transition"
              title={`Criar página em "${node.name}"`}
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onCreateFolder(node.path)}
              className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-700/80 rounded transition"
              title={`Criar subpasta em "${node.name}"`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteItem(node.path, node.name)}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/80 rounded transition"
              title={`Excluir pasta "${node.name}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isOpen && node.children && (
          <div>
            {node.children.length === 0 ? (
              <div
                className="py-1 text-[11px] text-slate-500 italic"
                style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
              >
                (pasta vazia)
              </div>
            ) : (
              node.children.map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  level={level + 1}
                  activeFilePath={activeFilePath}
                  searchQuery={searchQuery}
                  onSelectPage={onSelectPage}
                  onCreatePage={onCreatePage}
                  onCreateFolder={onCreateFolder}
                  onDeleteItem={onDeleteItem}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Nó de Arquivo Markdown
  const displayName = node.name.replace(/\.md$/i, "");

  return (
    <div
      className={`group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition text-xs select-none ${
        isSelected
          ? "bg-indigo-600/20 text-indigo-200 border-l-2 border-indigo-500 font-medium"
          : "text-slate-300 hover:bg-slate-800/70 hover:text-slate-100"
      }`}
      style={{ paddingLeft }}
      onClick={() => onSelectPage(node.path)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText
          className={`w-3.5 h-3.5 shrink-0 ${
            isSelected ? "text-indigo-400" : "text-slate-400"
          }`}
        />
        <span className="truncate">{displayName}</span>
      </div>

      <div
        className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onDeleteItem(node.path, node.name)}
          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/80 rounded transition"
          title={`Excluir página "${displayName}"`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  wikiPath,
  wikiName,
  fileTree,
  activeFilePath,
  searchQuery,
  onSelectPage,
  onCreatePage,
  onCreateFolder,
  onDeleteItem,
  onOpenWiki,
  onOpenCreateWiki,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <aside className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 select-none shrink-0 transition-all">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          title="Expandir Barra Lateral"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        {wikiPath ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => onCreatePage()}
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
              title="Nova Página na Raiz"
            >
              <FilePlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onCreateFolder()}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
              title="Nova Pasta na Raiz"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={onOpenCreateWiki}
              className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
              title="Criar Nova Wiki"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenWiki}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Abrir Pasta Existente"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col select-none shrink-0 transition-all h-full overflow-hidden">
      {/* Cabeçalho da Barra Lateral */}
      <div className="h-12 border-b border-slate-800/80 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FolderArchive className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider truncate">
            {wikiName || "Navegação"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {wikiPath && (
            <>
              <button
                onClick={() => onCreatePage()}
                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition"
                title="Nova Página na Raiz"
              >
                <FilePlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => onCreateFolder()}
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition"
                title="Nova Pasta na Raiz"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition ml-1"
            title="Recolher Barra Lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo da Árvore */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        {!wikiPath ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-900/60 to-cyan-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-3 shadow-md shadow-indigo-950/40">
              <Sparkles className="w-6 h-6 text-indigo-300" />
            </div>
            <p className="text-xs font-semibold text-slate-200 mb-1">
              Nenhuma Wiki Aberta
            </p>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Crie sua própria wiki do zero ou abra um diretório existente.
            </p>
            <div className="w-full space-y-2">
              <button
                onClick={onOpenCreateWiki}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 rounded-xl transition shadow-md shadow-indigo-600/30"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                Criar Nova Wiki
              </button>
              <button
                onClick={onOpenWiki}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 rounded-xl transition"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                Abrir Pasta Existente
              </button>
            </div>
          </div>
        ) : fileTree.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center">
            <p className="text-xs text-slate-400 mb-2">Wiki vazia</p>
            <button
              onClick={() => onCreatePage()}
              className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar primeira página
            </button>
          </div>
        ) : (
          fileTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              activeFilePath={activeFilePath}
              searchQuery={searchQuery}
              onSelectPage={onSelectPage}
              onCreatePage={onCreatePage}
              onCreateFolder={onCreateFolder}
              onDeleteItem={onDeleteItem}
            />
          ))
        )}
      </div>
    </aside>
  );
};

