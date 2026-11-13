import React, { useEffect, useState } from "react";
import { X, Image as ImageIcon, Check, Loader2, FolderOpen } from "lucide-react";
import { listAssets } from "../utils/browserStorage";

interface AssetBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (assetPath: string) => void;
  onUploadNew?: () => Promise<string | null>;
}

export const AssetBrowserModal: React.FC<AssetBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  onUploadNew,
}) => {
  const [assets, setAssets] = useState<{ path: string; name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const items = await listAssets();
      setAssets(items);
      if (items.length > 0 && !selectedPath) {
        setSelectedPath(items[0].path);
      }
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadAssets();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedPath) {
      onSelectImage(selectedPath);
      onClose();
    }
  };

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopyFeedback(path);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleUpload = async () => {
    if (onUploadNew) {
      const newPath = await onUploadNew();
      if (newPath) {
        await loadAssets();
        setSelectedPath(newPath);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Biblioteca de Imagens (/assets)</h3>
              <p className="text-[11px] text-slate-400">
                Selecione uma imagem já presente na wiki ou faça upload de uma nova
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Carregando imagens...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">Nenhuma imagem na pasta /assets</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Faça upload de uma imagem do seu computador para começar.</p>
              </div>
              {onUploadNew && (
                <button
                  onClick={handleUpload}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition mt-2 shadow-sm shadow-indigo-600/30"
                >
                  Importar Nova Imagem
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {assets.map((asset) => {
                const isSelected = selectedPath === asset.path;
                return (
                  <div
                    key={asset.path}
                    onClick={() => setSelectedPath(asset.path)}
                    className={`group relative rounded-xl border p-2 cursor-pointer transition flex flex-col items-center justify-between text-center select-none ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-950/50"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="w-full h-24 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center mb-2 border border-slate-800/50">
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[11px] text-slate-300 truncate w-full font-mono mb-1" title={asset.path}>
                      {asset.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(asset.path, e)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                      title="Copiar caminho para usar em infobox ou markdown"
                    >
                      {copyFeedback === asset.path ? "Copiado!" : "Copiar caminho"}
                    </button>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-2">
          <div>
            {onUploadNew && (
              <button
                onClick={handleUpload}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition border border-slate-700"
              >
                + Enviar do Computador
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPath}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition shadow-md shadow-indigo-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Inserir na Página</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
