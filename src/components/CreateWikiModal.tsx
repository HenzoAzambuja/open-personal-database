import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder, X, Sparkles, Check, AlertCircle } from "lucide-react";

interface CreateWikiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWiki: (parentPath: string, wikiName: string) => Promise<void>;
}

export const CreateWikiModal: React.FC<CreateWikiModalProps> = ({
  isOpen,
  onClose,
  onCreateWiki,
}) => {
  const [wikiName, setWikiName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Selecione o local onde a pasta da nova Wiki será criada",
      });

      if (selected && typeof selected === "string") {
        setParentPath(selected);
        setErrorMessage(null);
      }
    } catch (err: unknown) {
      console.error("Erro ao selecionar diretório:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = wikiName.trim();

    if (!trimmedName) {
      setErrorMessage("Por favor, insira um nome para a sua wiki.");
      return;
    }

    if (!parentPath) {
      setErrorMessage("Por favor, selecione uma pasta de destino no seu computador.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onCreateWiki(parentPath, trimmedName);
      setWikiName("");
      setParentPath("");
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : (err as Error).message;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Caminho previsto de saída
  const previewPath =
    parentPath && wikiName.trim()
      ? `${parentPath.replace(/\\/g, "/")}/${wikiName.trim()}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-none">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Criar Nova Wiki</h3>
              <p className="text-xs text-slate-400">
                Configure sua base de dados local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Campo: Nome da Wiki */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome da Wiki
            </label>
            <input
              type="text"
              autoFocus
              value={wikiName}
              onChange={(e) => {
                setWikiName(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Ex: Minha Wiki, Projetos 2026, Anotações Pessoais"
              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 text-xs text-slate-100 rounded-xl px-3.5 py-2.5 outline-none transition placeholder-slate-500"
            />
          </div>

          {/* Campo: Local no Disco */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pasta de Destino
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 truncate font-mono"
                title={parentPath || "Nenhuma pasta selecionada"}
              >
                {parentPath ? (
                  <span className="text-slate-200">{parentPath}</span>
                ) : (
                  <span className="text-slate-500 italic">
                    Nenhum diretório selecionado...
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-medium text-slate-200 border border-slate-700 rounded-xl transition shrink-0"
              >
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                <span>Escolher</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Uma pasta com o nome da wiki será criada dentro deste diretório.
            </p>
          </div>

          {/* Pré-visualização do Caminho e Arquivos */}
          {previewPath && (
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1.5 text-xs">
              <div className="text-[11px] font-semibold text-slate-400">
                Estrutura criada:
              </div>
              <div className="font-mono text-[11px] text-indigo-300 truncate">
                📁 {previewPath}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 pl-3">
                <span>📄 Início.md</span>
                <span>📁 assets/</span>
              </div>
            </div>
          )}

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Rodapé / Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !wikiName.trim() || !parentPath}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md shadow-indigo-600/30"
            >
              {isSubmitting ? (
                <span>Criando...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Criar Wiki</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
