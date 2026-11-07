import { useState, useCallback, useEffect, useRef } from 'react';
import { FileNode, WikiState } from '../types/wiki';
import * as storage from '../utils/browserStorage';

export function useWiki() {
  const [state, setState] = useState<WikiState>({ currentWikiPath:null, wikiName:null, fileTree:[], activeFilePath:null, activeFileContent:'', activeFileTitle:null, isDirty:false, isLoading:false, searchQuery:'', metadata:null });
  const [notification,setNotification] = useState<{type:'success'|'error'|'info';message:string}|null>(null);
  const notificationTimeoutRef = useRef<number|null>(null);
  const showNotification = useCallback((message:string,type:'success'|'error'|'info'='info')=>{ if(notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current); setNotification({message,type}); notificationTimeoutRef.current=window.setTimeout(()=>setNotification(null),4000); },[]);
  const countPages = (nodes:FileNode[]):number => nodes.reduce((n,node)=>n+(node.is_dir?countPages(node.children||[]):(/\.md$/i.test(node.name)?1:0)),0);
  const [contentMatches, setContentMatches] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const query = state.searchQuery.trim().toLocaleLowerCase();
    if (!query || !storage.getRoot()) {
      setContentMatches({});
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeout = window.setTimeout(async () => {
      const paths: string[] = [];
      const collectPaths = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          if (node.is_dir) collectPaths(node.children || []);
          else if (/\.md$/i.test(node.name)) paths.push(node.path);
        });
      };
      collectPaths(state.fileTree);

      try {
        const entries = await Promise.all(paths.map(async path => {
          const text = path === state.activeFilePath && state.isDirty
            ? state.activeFileContent
            : await storage.readText(path);
          const index = text.toLocaleLowerCase().indexOf(query);
          if (index < 0) return null;
          const start = Math.max(0, index - 45);
          const end = Math.min(text.length, index + query.length + 75);
          const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
          return [path, `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`] as const;
        }));
        if (!cancelled) {
          setContentMatches(Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)));
          setIsSearching(false);
        }
      } catch (error) {
        if (!cancelled) {
          setContentMatches({});
          setIsSearching(false);
          showNotification(`Falha ao buscar no conteúdo das páginas: ${(error as Error).message}`, "error");
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [state.searchQuery, state.fileTree, state.activeFilePath, state.activeFileContent, state.isDirty, showNotification]);

  const refreshTree = useCallback(async()=>{ if(!storage.getRoot())return; try { const tree=await storage.buildTree(); setState(p=>({...p,fileTree:tree,metadata:p.metadata?{...p.metadata,pageCount:countPages(tree)}:null})); } catch(e) { showNotification(`Falha ao atualizar árvore: ${(e as Error).message}`,'error'); } },[showNotification]);
  const selectPage = useCallback(async(path:string)=>{
    if(state.isDirty && state.activeFilePath && state.activeFilePath!==path) { try { await storage.writeText(state.activeFilePath,state.activeFileContent); } catch(e){ showNotification(`Falha ao salvar página anterior: ${(e as Error).message}`,'error'); return; } }
    setState(p=>({...p,isLoading:true})); try { const content=await storage.readText(path); const name=path.split('/').pop()||''; setState(p=>({...p,activeFilePath:path,activeFileContent:content,activeFileTitle:name.replace(/\.md$/i,''),isDirty:false,isLoading:false})); } catch(e) { showNotification(`Erro ao abrir arquivo: ${(e as Error).message}`,'error'); setState(p=>({...p,isLoading:false})); }
  },[state.isDirty,state.activeFilePath,state.activeFileContent,showNotification]);
  const loadRoot = useCallback(async(root:storage.WikiRoot,selectFirst=true)=>{ storage.setRoot(root); setState(p=>({...p,isLoading:true,currentWikiPath:root.name,wikiName:root.name,activeFilePath:null,activeFileContent:'',activeFileTitle:null,isDirty:false})); try { const tree=await storage.buildTree(); setState(p=>({...p,fileTree:tree,metadata:{name:root.name,path:root.name,pageCount:countPages(tree),lastOpened:new Date().toLocaleString()},isLoading:false})); if(selectFirst){ const find=(nodes:FileNode[]):FileNode|null=>{for(const n of nodes){if(!n.is_dir&&/\.md$/i.test(n.name))return n;if(n.children){const x=find(n.children);if(x)return x;}}return null;};const first=find(tree);if(first)await selectPage(first.path); } } catch(e){showNotification(`Erro ao carregar wiki: ${(e as Error).message}`,'error');setState(p=>({...p,isLoading:false}));}},[selectPage,showNotification]);
  const openWikiFolder = useCallback(async()=>{try{const root=await storage.chooseWikiDirectory();if(root){await loadRoot(root);showNotification('Wiki aberta com sucesso!','success');}}catch(e){showNotification((e as Error).message,'error');}},[loadRoot,showNotification]);
  const createNewWiki = useCallback(async(_parentPath:string,wikiName:string)=>{setState(p=>({...p,isLoading:true}));try{const root=await storage.createWiki(wikiName.trim());await loadRoot(root);showNotification(`Wiki "${wikiName.trim()}" criada com sucesso!`,'success');}catch(e){setState(p=>({...p,isLoading:false}));showNotification((e as Error).message,'error');throw e;}},[loadRoot,showNotification]);
  const updateContent=useCallback((content:string)=>setState(p=>({...p,activeFileContent:content,isDirty:true})),[]);
  const saveCurrentPage=useCallback(async(content?:string)=>{if(!state.activeFilePath)return;const value=content??state.activeFileContent;try{await storage.writeText(state.activeFilePath,value);setState(p=>({...p,activeFileContent:value,isDirty:false}));showNotification('Página salva com sucesso!','success');}catch(e){showNotification(`Erro ao salvar: ${(e as Error).message}`,'error');}},[state.activeFilePath,state.activeFileContent,showNotification]);
  const createNewPage=useCallback(async(parentPath?:string,titlePrompt?:string)=>{const title=(titlePrompt!==undefined?titlePrompt:window.prompt('Digite o título da nova página:'))?.trim();if(!title)return;if(/[\\/]/.test(title)||title==='.'||title==='..'){showNotification('O título não pode conter barras.','error');return;}const path=[parentPath||'',`${title}.md`].filter(Boolean).join('/');try{await storage.writeText(path,`# ${title}\n\n`);await refreshTree();await selectPage(path);showNotification(`Página "${title}" criada!`,'success');}catch(e){showNotification(`Erro ao criar página: ${(e as Error).message}`,'error');}},[refreshTree,selectPage,showNotification]);
  const createNewFolder=useCallback(async(parentPath?:string,folderPrompt?:string)=>{const name=(folderPrompt!==undefined?folderPrompt:window.prompt('Digite o nome da nova pasta:'))?.trim();if(!name)return;try{const path=[parentPath||'',name].filter(Boolean).join('/');await storage.makeDirectory(path);await refreshTree();showNotification(`Pasta "${name}" criada!`,'success');}catch(e){showNotification(`Erro ao criar pasta: ${(e as Error).message}`,'error');}},[refreshTree,showNotification]);
  const deleteItem=useCallback(async(path:string,name:string)=>{if(!window.confirm(`Tem certeza de que deseja excluir "${name}"? Esta ação não pode ser desfeita.`))return;try{await storage.removePath(path);if(state.activeFilePath===path)setState(p=>({...p,activeFilePath:null,activeFileContent:'',activeFileTitle:null,isDirty:false}));await refreshTree();showNotification(`"${name}" foi excluído.`,'success');}catch(e){showNotification(`Erro ao excluir: ${(e as Error).message}`,'error');}},[state.activeFilePath,refreshTree,showNotification]);
  const insertImage=useCallback(async()=>{try{const path=await storage.importImage();if(path)showNotification(`Imagem importada: ${path}`,'success');return path;}catch(e){showNotification((e as Error).message,'error');return null;}},[showNotification]);
  const exportOpd=useCallback(async()=>{try{if(state.isDirty)await saveCurrentPage();await storage.exportOpd();showNotification('Exportação .opd iniciada.','success');}catch(e){showNotification(`Erro na exportação: ${(e as Error).message}`,'error');}},[state.isDirty,saveCurrentPage,showNotification]);
  const importOpd=useCallback(async()=>{try{const root=await storage.importOpd();if(root){await loadRoot(root);showNotification('Wiki importada com sucesso!','success');}}catch(e){showNotification(`Erro na importação .opd: ${(e as Error).message}`,'error');}},[loadRoot,showNotification]);
  const navigateToPageByName=useCallback(async(name:string)=>{const clean=name.trim().replace(/^\[\[|\]\]$/g,'');const find=(nodes:FileNode[]):FileNode|null=>{for(const n of nodes){if(!n.is_dir&&n.name.replace(/\.md$/i,'').toLowerCase()===clean.toLowerCase())return n;if(n.children){const f=find(n.children);if(f)return f;}}return null;};const found=find(state.fileTree);if(found){await selectPage(found.path);return;}if(window.confirm(`A página "[[${clean}]]" ainda não existe. Deseja criá-la agora?`))await createNewPage('',clean);},[state.fileTree,selectPage,createNewPage]);
  const setSearchQuery=useCallback((searchQuery:string)=>setState(p=>({...p,searchQuery})),[]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(state.activeFilePath&&state.isDirty)void saveCurrentPage();}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[state.activeFilePath,state.isDirty,saveCurrentPage]);
  return {state,notification,contentMatches,isSearching,openWikiFolder,createNewWiki,insertImage,selectPage,updateContent,saveCurrentPage,createNewPage,createNewFolder,deleteItem,exportOpd,importOpd,refreshTree,navigateToPageByName,setSearchQuery,showNotification};
}
