import { useMemo, useState } from "react";
import { useWiki } from "./hooks/useWiki";
import { Header, type SearchResult } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { CreateWikiModal } from "./components/CreateWikiModal";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { FileNode } from "./types/wiki";

export function App() {
  const {
    state,
    notification,
    contentMatches,
    isSearching,
    openWikiFolder,
    createNewWiki,
    selectPage,
    updateContent,
    saveCurrentPage,
    createNewPage,
    createNewFolder,
    deleteItem,
    exportOpd,
    importOpd,
    refreshTree,
    navigateToPageByName,
    setSearchQuery,
    insertImage,
  } = useWiki();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateWikiModalOpen, setIsCreateWikiModalOpen] = useState(false);
  const searchResults = useMemo(() => {
    const query = state.searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];

    const results: SearchResult[] = [];
    const collectResults = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.is_dir) {
          collectResults(node.children || []);
          return;
        }

        if (!/\.md$/i.test(node.name)) return;
        const title = node.name.replace(/\.md$/i, "");
        const titleMatches = title.toLocaleLowerCase().includes(query);
        const snippet = contentMatches[node.path];
        if (!titleMatches && !snippet) return;

        const separatorIndex = Math.max(node.path.lastIndexOf("/"), node.path.lastIndexOf("\\"));
        results.push({
          path: node.path,
          title,
          folder: separatorIndex >= 0 ? node.path.slice(0, separatorIndex) : "",
          snippet,
          matchType: titleMatches ? "title" : "content",
        });
      });
    };

    collectResults(state.fileTree);
    return results
      .sort((a, b) => {
        const aRank = a.matchType === "title" ? (a.title.toLocaleLowerCase().startsWith(query) ? 0 : 1) : 2;
        const bRank = b.matchType === "title" ? (b.title.toLocaleLowerCase().startsWith(query) ? 0 : 1) : 2;
        return aRank - bRank || a.title.localeCompare(b.title);
      })
  }, [contentMatches, state.fileTree, state.searchQuery]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Barra Superior Header */}
      <Header
        currentWikiPath={state.currentWikiPath}
        wikiName={state.wikiName}
        pageCount={state.metadata?.pageCount || 0}
        searchQuery={state.searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        onSearchChange={setSearchQuery}
        onSelectPage={selectPage}
        onOpenWiki={openWikiFolder}
        onOpenCreateWiki={() => setIsCreateWikiModalOpen(true)}
        onExportOpd={exportOpd}
        onImportOpd={importOpd}
        onRefresh={refreshTree}
        isDirty={state.isDirty}
      />

      {/* Layout Mestre: Sidebar + Editor */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Barra Lateral de Navegação */}
        <Sidebar
          wikiPath={state.currentWikiPath}
          wikiName={state.wikiName}
          fileTree={state.fileTree}
          activeFilePath={state.activeFilePath}
          searchQuery={state.searchQuery}
          contentMatches={contentMatches}
          onSelectPage={selectPage}
          onCreatePage={(parent) => createNewPage(parent)}
          onCreateFolder={(parent) => createNewFolder(parent)}
          onDeleteItem={deleteItem}
          onOpenWiki={openWikiFolder}
          onOpenCreateWiki={() => setIsCreateWikiModalOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Área Central: Editor e Visualizador de Markdown com WikiLinks */}
        <Editor
          currentWikiPath={state.currentWikiPath}
          activeFilePath={state.activeFilePath}
          activeFileTitle={state.activeFileTitle}
          content={state.activeFileContent}
          isDirty={state.isDirty}
          onContentChange={updateContent}
          onSave={() => saveCurrentPage()}
          onNavigateWikiLink={navigateToPageByName}
          onCreatePage={() => createNewPage()}
          onOpenCreateWiki={() => setIsCreateWikiModalOpen(true)}
          onInsertImage={insertImage}
        />

        {/* Indicador de Carregamento Flutuante */}
        {state.isLoading && (
          <div className="absolute top-3 right-4 z-50 flex items-center gap-2 bg-slate-900/90 text-slate-300 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-lg text-xs backdrop-blur-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>Processando...</span>
          </div>
        )}

        {/* Modal para Criação de Nova Wiki */}
        <CreateWikiModal
          isOpen={isCreateWikiModalOpen}
          onClose={() => setIsCreateWikiModalOpen(false)}
          onCreateWiki={createNewWiki}
        />

        {/* Notificação Toast */}
        {notification && (
          <div
            className={`absolute bottom-4 right-4 z-50 max-w-sm flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              notification.type === "success"
                ? "bg-emerald-950/90 border-emerald-800/80 text-emerald-200 shadow-emerald-950/40"
                : notification.type === "error"
                ? "bg-red-950/90 border-red-800/80 text-red-200 shadow-red-950/40"
                : "bg-slate-900/90 border-slate-800 text-slate-200 shadow-slate-950/40"
            }`}
          >
            {notification.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            {notification.type === "error" && (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            {notification.type === "info" && (
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span className="truncate">{notification.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
