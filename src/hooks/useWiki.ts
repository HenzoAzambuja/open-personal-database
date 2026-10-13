import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { FileNode, WikiMetadata, WikiState } from "../types/wiki";

export function useWiki() {
  const [state, setState] = useState<WikiState>({
    currentWikiPath: null,
    wikiName: null,
    fileTree: [],
    activeFilePath: null,
    activeFileContent: "",
    activeFileTitle: null,
    isDirty: false,
    isLoading: false,
    searchQuery: "",
    metadata: null,
  });

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Armazena timeout da notificação para limpeza
  const notificationTimeoutRef = useRef<number | null>(null);

  const showNotification = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      setNotification({ message, type });
      notificationTimeoutRef.current = window.setTimeout(() => {
        setNotification(null);
      }, 4000);
    },
    []
  );

  // Conta total de páginas Markdown na árvore recursivamente
  const countPages = (nodes: FileNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.is_dir && node.children) {
        count += countPages(node.children);
      } else if (!node.is_dir && node.name.toLowerCase().endsWith(".md")) {
        count += 1;
      }
    }
    return count;
  };

  // Carrega a árvore de arquivos de uma pasta
  const loadWikiTree = useCallback(
    async (folderPath: string, selectFirstPage = false) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const tree = await invoke<FileNode[]>("read_wiki_directory", {
          path: folderPath,
        });

        const normalizedName = folderPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "Wiki";
        const pageTotal = countPages(tree);

        const metadata: WikiMetadata = {
          name: normalizedName,
          path: folderPath,
          pageCount: pageTotal,
          lastOpened: new Date().toLocaleTimeString(),
        };

        setState((prev) => ({
          ...prev,
          currentWikiPath: folderPath,
          wikiName: normalizedName,
          fileTree: tree,
          metadata,
          isLoading: false,
        }));

        // Se solicitado, seleciona a primeira página disponível
        if (selectFirstPage) {
          const findFirstPage = (nodes: FileNode[]): FileNode | null => {
            for (const node of nodes) {
              if (!node.is_dir && node.name.toLowerCase().endsWith(".md")) {
                return node;
              }
              if (node.is_dir && node.children) {
                const found = findFirstPage(node.children);
                if (found) return found;
              }
            }
            return null;
          };

          const firstPage = findFirstPage(tree);
          if (firstPage) {
            await selectPage(firstPage.path);
          }
        }
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao carregar wiki: ${errorMsg}`, "error");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showNotification]
  );

  // Recarrega a árvore atual mantendo a página ativa
  const refreshTree = useCallback(async () => {
    if (!state.currentWikiPath) return;
    try {
      const tree = await invoke<FileNode[]>("read_wiki_directory", {
        path: state.currentWikiPath,
      });
      const pageTotal = countPages(tree);

      setState((prev) => ({
        ...prev,
        fileTree: tree,
        metadata: prev.metadata
          ? { ...prev.metadata, pageCount: pageTotal }
          : null,
      }));
    } catch (err: unknown) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      showNotification(`Falha ao atualizar árvore: ${errorMsg}`, "error");
    }
  }, [state.currentWikiPath, showNotification]);

  // Abre diálogo nativo para selecionar pasta da wiki
  const openWikiFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Selecione a Pasta da Wiki",
      });

      if (selected && typeof selected === "string") {
        await loadWikiTree(selected, true);
        showNotification(`Wiki aberta com sucesso!`, "success");
      }
    } catch (err: unknown) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      showNotification(`Erro ao abrir pasta: ${errorMsg}`, "error");
    }
  }, [loadWikiTree, showNotification]);

  // Cria uma nova wiki personalizada do zero
  const createNewWiki = useCallback(
    async (parentPath: string, wikiName: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const newWikiPath = await invoke<string>("create_new_wiki", {
          parentPath,
          wikiName: wikiName.trim(),
        });

        await loadWikiTree(newWikiPath, true);
        showNotification(`Wiki "${wikiName.trim()}" criada com sucesso!`, "success");
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao criar wiki: ${errorMsg}`, "error");
        setState((prev) => ({ ...prev, isLoading: false }));
        throw err;
      }
    },
    [loadWikiTree, showNotification]
  );

  // Seleciona uma imagem do computador, copia para /assets e retorna o caminho relativo
  const insertImage = useCallback(async (): Promise<string | null> => {
    if (!state.currentWikiPath) {
      showNotification("Abra uma wiki primeiro antes de inserir imagens.", "info");
      return null;
    }

    try {
      const selected = await open({
        filters: [
          {
            name: "Imagens",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
          },
        ],
        multiple: false,
        title: "Selecione uma imagem para importar para a wiki",
      });

      if (!selected || typeof selected !== "string") {
        return null;
      }

      const relativePath = await invoke<string>("copy_image_to_assets", {
        wikiPath: state.currentWikiPath,
        sourceFilePath: selected,
      });

      showNotification(`Imagem importada com sucesso: ${relativePath}`, "success");
      return relativePath;
    } catch (err: unknown) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      showNotification(`Erro ao importar imagem: ${errorMsg}`, "error");
      return null;
    }
  }, [state.currentWikiPath, showNotification]);

  // Seleciona e carrega uma página Markdown
  const selectPage = useCallback(
    async (path: string) => {
      // Se há alterações não salvas na página atual, salvar antes de trocar
      if (state.isDirty && state.activeFilePath && state.activeFilePath !== path) {
        try {
          await invoke<void>("save_markdown_file", {
            path: state.activeFilePath,
            content: state.activeFileContent,
          });
        } catch (e) {
          console.error("Falha ao salvar página anterior automaticamente:", e);
        }
      }

      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const content = await invoke<string>("read_markdown_file", { path });
        const name = path.replace(/\\/g, "/").split("/").pop() || "";
        const title = name.toLowerCase().endsWith(".md")
          ? name.slice(0, -3)
          : name;

        setState((prev) => ({
          ...prev,
          activeFilePath: path,
          activeFileContent: content,
          activeFileTitle: title,
          isDirty: false,
          isLoading: false,
        }));
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao abrir arquivo: ${errorMsg}`, "error");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [state.isDirty, state.activeFilePath, state.activeFileContent, showNotification]
  );

  // Atualiza o conteúdo no estado local marcando como sujo
  const updateContent = useCallback((newContent: string) => {
    setState((prev) => ({
      ...prev,
      activeFileContent: newContent,
      isDirty: true,
    }));
  }, []);

  // Salva o conteúdo no disco
  const saveCurrentPage = useCallback(
    async (content?: string) => {
      if (!state.activeFilePath) return;
      const textToSave = content !== undefined ? content : state.activeFileContent;

      try {
        await invoke<void>("save_markdown_file", {
          path: state.activeFilePath,
          content: textToSave,
        });

        setState((prev) => ({
          ...prev,
          activeFileContent: textToSave,
          isDirty: false,
        }));
        showNotification("Página salva com sucesso!", "success");
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao salvar arquivo: ${errorMsg}`, "error");
      }
    },
    [state.activeFilePath, state.activeFileContent, showNotification]
  );

  // Cria uma nova página
  const createNewPage = useCallback(
    async (parentPath?: string, titlePrompt?: string) => {
      const targetParent = parentPath || state.currentWikiPath;
      if (!targetParent) {
        showNotification("Abra uma wiki primeiro antes de criar páginas.", "info");
        return;
      }

      const title =
        titlePrompt !== undefined
          ? titlePrompt
          : prompt("Digite o título da nova página:");

      if (!title || !title.trim()) return;

      try {
        const newFilePath = await invoke<string>("create_new_page", {
          parentPath: targetParent,
          title: title.trim(),
        });

        await refreshTree();
        await selectPage(newFilePath);
        showNotification(`Página "${title.trim()}" criada!`, "success");
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao criar página: ${errorMsg}`, "error");
      }
    },
    [state.currentWikiPath, refreshTree, selectPage, showNotification]
  );

  // Cria uma nova pasta
  const createNewFolder = useCallback(
    async (parentPath?: string, folderPrompt?: string) => {
      const targetParent = parentPath || state.currentWikiPath;
      if (!targetParent) {
        showNotification("Abra uma wiki primeiro antes de criar pastas.", "info");
        return;
      }

      const folderName =
        folderPrompt !== undefined
          ? folderPrompt
          : prompt("Digite o nome da nova pasta:");

      if (!folderName || !folderName.trim()) return;

      try {
        await invoke<string>("create_new_folder", {
          parentPath: targetParent,
          folderName: folderName.trim(),
        });

        await refreshTree();
        showNotification(`Pasta "${folderName.trim()}" criada!`, "success");
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao criar pasta: ${errorMsg}`, "error");
      }
    },
    [state.currentWikiPath, refreshTree, showNotification]
  );

  // Remove arquivo ou pasta
  const deleteItem = useCallback(
    async (targetPath: string, itemName: string) => {
      const confirmed = window.confirm(
        `Tem certeza de que deseja excluir "${itemName}"? Esta ação não pode ser desfeita.`
      );
      if (!confirmed) return;

      try {
        await invoke<void>("delete_file_or_folder", { path: targetPath });

        if (state.activeFilePath === targetPath) {
          setState((prev) => ({
            ...prev,
            activeFilePath: null,
            activeFileContent: "",
            activeFileTitle: null,
            isDirty: false,
          }));
        }

        await refreshTree();
        showNotification(`"${itemName}" foi excluído.`, "success");
      } catch (err: unknown) {
        const errorMsg = typeof err === "string" ? err : (err as Error).message;
        showNotification(`Erro ao excluir: ${errorMsg}`, "error");
      }
    },
    [state.activeFilePath, refreshTree, showNotification]
  );

  // Exporta a wiki atual para um pacote .opd
  const exportOpd = useCallback(async () => {
    if (!state.currentWikiPath) {
      showNotification("Nenhuma wiki aberta para exportar.", "info");
      return;
    }

    try {
      const defaultFilename = `${state.wikiName || "wiki"}.opd`;
      const savePath = await save({
        filters: [{ name: "Pacote Open Personal Database (*.opd)", extensions: ["opd"] }],
        defaultPath: defaultFilename,
        title: "Exportar Wiki como Pacote .opd",
      });

      if (!savePath) return;

      showNotification("Exportando pacote .opd...", "info");
      await invoke<void>("export_wiki_to_opd", {
        wikiFolderPath: state.currentWikiPath,
        outputFilePath: savePath,
      });

      showNotification(`Wiki exportada com sucesso em: ${savePath}`, "success");
    } catch (err: unknown) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      showNotification(`Erro na exportação .opd: ${errorMsg}`, "error");
    }
  }, [state.currentWikiPath, state.wikiName, showNotification]);

  // Importa pacote .opd e extrai para um diretório escolhido
  const importOpd = useCallback(async () => {
    try {
      // 1. Seleciona o arquivo .opd
      const opdFile = await open({
        filters: [{ name: "Pacote Open Personal Database (*.opd)", extensions: ["opd"] }],
        multiple: false,
        title: "Selecione o Pacote .opd para Importar",
      });

      if (!opdFile || typeof opdFile !== "string") return;

      // 2. Seleciona o diretório de destino da extração
      const extractDest = await open({
        directory: true,
        multiple: false,
        title: "Selecione a Pasta de Destino onde a Wiki será descompactada",
      });

      if (!extractDest || typeof extractDest !== "string") return;

      showNotification("Importando e extraindo pacote .opd...", "info");
      const extractedPath = await invoke<string>("import_opd_wiki", {
        opdFilePath: opdFile,
        targetExtractPath: extractDest,
      });

      // 3. Abre a wiki recém-extraída automaticamente
      await loadWikiTree(extractedPath, true);
      showNotification("Wiki importada com sucesso!", "success");
    } catch (err: unknown) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      showNotification(`Erro na importação .opd: ${errorMsg}`, "error");
    }
  }, [loadWikiTree, showNotification]);

  // Navega para uma página a partir de um WikiLink ([[Nome da Página]])
  const navigateToPageByName = useCallback(
    async (pageName: string) => {
      const cleanName = pageName.trim().replace(/^\[\[|\]\]$/g, "");
      if (!cleanName) return;

      // Procura recursivamente pelo nome do arquivo na árvore atual
      const findPage = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (!node.is_dir) {
            const nodeTitle = node.name.replace(/\.md$/i, "");
            if (nodeTitle.toLowerCase() === cleanName.toLowerCase()) {
              return node;
            }
          }
          if (node.is_dir && node.children) {
            const found = findPage(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const foundPage = findPage(state.fileTree);
      if (foundPage) {
        await selectPage(foundPage.path);
        showNotification(`Navegado para: ${cleanName}`, "info");
      } else {
        // Se a página não existir, oferece criar automaticamente!
        const shouldCreate = window.confirm(
          `A página "[[${cleanName}]]" ainda não existe. Deseja criá-la agora?`
        );
        if (shouldCreate && state.currentWikiPath) {
          await createNewPage(state.currentWikiPath, cleanName);
        }
      }
    },
    [state.fileTree, state.currentWikiPath, selectPage, createNewPage, showNotification]
  );

  // Atalho global de teclado Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (state.activeFilePath && state.isDirty) {
          saveCurrentPage();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.activeFilePath, state.isDirty, saveCurrentPage]);

  // Atualiza busca
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  return {
    state,
    notification,
    openWikiFolder,
    createNewWiki,
    insertImage,
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
    showNotification,
  };
}

