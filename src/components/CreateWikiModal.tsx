import React, { useEffect, useState, useRef } from "react";
import { chooseParentDirectory, isFileSystemAccessSupported } from "../utils/browserStorage";
import { Folder, X, Sparkles, Check, AlertCircle, Palette, Image as ImageIcon, Trash2, Eye } from "lucide-react";

interface CreateWikiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWiki: (
    parentPath: string,
    wikiName: string,
    themeOptions?: { themeColor?: string; bgImageFile?: File | null; bgOpacity?: number }
  ) => Promise<void>;
}

const PRESET_COLORS = [
  { name: "Indigo Fandom", value: "#6366f1" },
  { name: "Ciano Sci-Fi", value: "#06b6d4" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Roxo Místico", value: "#8b5cf6" },
  { name: "Âmbar Dourado", value: "#f59e0b" },
  { name: "Carmesim", value: "#ef4444" },
  { name: "Rosa Cyber", value: "#ec4899" },
  { name: "Ardósia Dark", value: "#64748b" },
];

export const CreateWikiModal: React.FC<CreateWikiModalProps> = ({
  isOpen,
  onClose,
  onCreateWiki,
}) => {
  const [wikiName, setWikiName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(null);
  const [bgOpacity, setBgOpacity] = useState(0.2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportsFolderPicker = isFileSystemAccessSupported();

  useEffect(() => {
    if (isOpen && !supportsFolderPicker) {
      setParentPath("Armazenamento local do navegador");
    }
  }, [isOpen, supportsFolderPicker]);

  // Limpeza de URL de pré-visualização ao desmontar ou trocar arquivo
  useEffect(() => {
    if (bgImageFile) {
      const url = URL.createObjectURL(bgImageFile);
      setBgImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBgImagePreview(null);
    }
  }, [bgImageFile]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await chooseParentDirectory();
      if (selected) {
        setParentPath(selected.name);
        setErrorMessage(null);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível selecionar a pasta.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, etc.).");
      return;
    }

    setBgImageFile(file);
    setErrorMessage(null);
  };

  const handleRemoveImage = () => {
    setBgImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = wikiName.trim();

    if (!trimmedName) {
      setErrorMessage("Por favor, insira um nome para a sua wiki.");
      return;
    }

    if (!parentPath) {
      setErrorMessage("Por favor, selecione uma pasta de destino.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onCreateWiki(parentPath, trimmedName, {
        themeColor,
        bgImageFile,
        bgOpacity,
      });
      setWikiName("");
      setParentPath("");
      setBgImageFile(null);
      setThemeColor("#6366f1");
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : (err as Error).message;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-none my-8">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all"
              style={{ backgroundColor: themeColor }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Criar Nova Wiki</h3>
              <p className="text-xs text-slate-400">
                Personalize as cores, tema e plano de fundo da sua wiki
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
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
              placeholder="Ex: Minha Wiki, Universo Fantasia, Anotações Pessoais"
              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 text-xs text-slate-100 rounded-xl px-3.5 py-2.5 outline-none transition placeholder-slate-500"
            />
          </div>

          {/* Local de armazenamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {supportsFolderPicker ? "Pasta de Destino" : "Armazenamento"}
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
              {supportsFolderPicker && (
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-medium text-slate-200 border border-slate-700 rounded-xl transition shrink-0"
                >
                  <Folder className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Escolher</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {supportsFolderPicker
                ? "A pasta da wiki será criada dentro do diretório selecionado com sua estrutura Markdown e assets."
                : "A wiki será salva de forma persistente no armazenamento local do navegador (IndexedDB)."}
            </p>
          </div>

          {/* Seção de Cor do Tema */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cor do Tema da Wiki</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400 uppercase">{themeColor}</span>
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                  title="Escolher cor personalizada"
                />
              </div>
            </div>

            {/* Paleta com cores predefinidas */}
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((preset) => {
                const isSelected = themeColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setThemeColor(preset.value)}
                    className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                      isSelected
                        ? "border-slate-400 bg-slate-800 text-white font-medium shadow-sm"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shadow-inner shrink-0"
                      style={{ backgroundColor: preset.value }}
                    />
                    <span className="text-[11px]">{preset.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção de Imagem de Fundo (Wallpaper) */}
          <div className="pt-2 border-t border-slate-800/60">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Imagem de Fundo da Wiki (Wallpaper)</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            {bgImagePreview ? (
              <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-950 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {bgImageFile?.name || "Imagem de Fundo Selecionada"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {bgImageFile ? `${(bgImageFile.size / 1024).toFixed(0)} KB` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/60 rounded-lg transition"
                    title="Remover imagem de fundo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mini-preview com opacidade */}
                <div
                  className="h-20 w-full rounded-lg bg-cover bg-center border border-slate-800/80 relative overflow-hidden flex items-end p-2"
                  style={{ backgroundImage: `url(${bgImagePreview})` }}
                >
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
                  <span className="relative z-10 text-[10px] bg-black/60 px-2 py-0.5 rounded text-slate-300">
                    Prévia do wallpaper
                  </span>
                </div>

                {/* Controle de Opacidade do Fundo */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Intensidade / Opacidade:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.05"
                      max="0.6"
                      step="0.05"
                      value={bgOpacity}
                      onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                      className="w-28 accent-indigo-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-slate-300 w-8 text-right">
                      {(bgOpacity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 px-4 border border-dashed border-slate-700 hover:border-indigo-500/70 hover:bg-slate-800/50 rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-center group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-slate-300 group-hover:text-white transition">
                  Clique para escolher uma imagem de fundo
                </span>
                <span className="text-[11px] text-slate-500">
                  PNG, JPG, WEBP ou GIF (será copiada para a pasta /assets da wiki)
                </span>
              </button>
            )}
          </div>

          {/* Pré-visualização ao Vivo do Tema */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Pré-visualização do Estilo da Wiki:</span>
            </div>

            <div
              className="relative rounded-xl border border-slate-800 p-4 overflow-hidden bg-slate-950 flex flex-col gap-2"
              style={{
                borderColor: `${themeColor}40`,
              }}
            >
              {bgImagePreview && (
                <div
                  className="absolute inset-0 bg-cover bg-center pointer-events-none"
                  style={{
                    backgroundImage: `url(${bgImagePreview})`,
                    opacity: bgOpacity,
                  }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: themeColor }}
                  />
                  <span className="text-xs font-bold text-white tracking-wide">
                    {wikiName.trim() || "Minha Nova Wiki"}
                  </span>
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${themeColor}20`,
                    borderColor: `${themeColor}60`,
                    color: themeColor,
                  }}
                >
                  Fandom Theme
                </span>
              </div>
              <p className="relative z-10 text-[11px] text-slate-400 leading-relaxed">
                Página inicial com infoboxes, dados estruturados e fundo personalizado.
              </p>
            </div>
          </div>

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
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-lg"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 4px 14px ${themeColor}40`,
              }}
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
