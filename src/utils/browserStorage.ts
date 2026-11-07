import { unzipSync, zipSync } from "./zipCompat";
import { FileNode } from "../types/wiki";

export interface IndexedDbWikiRoot {
  kind: "indexeddb";
  id: string;
  name: string;
}

export type WikiRoot = FileSystemDirectoryHandle | IndexedDbWikiRoot;
type DirHandle = FileSystemDirectoryHandle;
type StoredWiki = { id: string; name: string };
type StoredFile = { wikiId: string; path: string; data: ArrayBuffer; type: string };
type StoredDirectory = { wikiId: string; path: string };

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

function directoryEntries(dir: DirHandle) {
  return (dir as DirectoryHandleWithEntries).entries();
}

function asDirectoryHandle(handle: FileSystemHandle): FileSystemDirectoryHandle | null {
  return handle.kind === "directory" ? handle as FileSystemDirectoryHandle : null;
}

function asFileHandle(handle: FileSystemHandle): FileSystemFileHandle | null {
  return handle.kind === "file" ? handle as FileSystemFileHandle : null;
}

let wikiRoot: WikiRoot | null = null;
let pendingParent: DirHandle | null = null;
const imageUrls = new Map<string, string>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const databaseName = "open-personal-database";
let databasePromise: Promise<IDBDatabase> | null = null;

export function isFileSystemAccessSupported() {
  return typeof window.showDirectoryPicker === "function";
}

function isIndexedDbRoot(root: WikiRoot): root is IndexedDbWikiRoot {
  return "kind" in root && root.kind === "indexeddb";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    throw new Error("Este navegador não oferece armazenamento local persistente (IndexedDB).");
  }
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("wikis", { keyPath: "id" });
        db.createObjectStore("files", { keyPath: ["wikiId", "path"] });
        db.createObjectStore("directories", { keyPath: ["wikiId", "path"] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error("O armazenamento local está bloqueado por outra aba. Feche outras abas do aplicativo e tente novamente."));
      };
    });
  }
  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha no armazenamento local."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Operação no armazenamento local cancelada."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao consultar o armazenamento local."));
  });
}

export async function listStoredWikis(): Promise<StoredWiki[]> {
  const db = await openDatabase();
  const transaction = db.transaction("wikis", "readonly");
  const wikis = await requestResult(transaction.objectStore("wikis").getAll() as IDBRequest<StoredWiki[]>);
  await transactionDone(transaction);
  return wikis.sort((a, b) => a.name.localeCompare(b.name));
}

export async function chooseWikiDirectory(): Promise<WikiRoot | null> {
  if (isFileSystemAccessSupported()) {
    try {
      return await window.showDirectoryPicker!({ mode: "readwrite" });
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return null;
      throw error;
    }
  }

  const wikis = await listStoredWikis();
  if (wikis.length === 0) {
    window.alert("Ainda não há wikis salvas neste navegador. Crie uma wiki para começar.");
    return null;
  }
  const options = wikis.map((wiki, index) => `${index + 1}. ${wiki.name}`).join("\n");
  const selection = window.prompt(`Digite o número da wiki que deseja abrir:\n\n${options}`);
  if (selection === null) return null;
  const index = Number(selection.trim()) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= wikis.length) {
    throw new Error("Seleção inválida. Informe o número de uma wiki da lista.");
  }
  return { kind: "indexeddb", ...wikis[index] };
}

export async function chooseParentDirectory(): Promise<DirHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  pendingParent = await chooseWikiDirectory() as DirHandle | null;
  return pendingParent;
}

export function getPendingParent() {
  return pendingParent;
}

export function setRoot(handle: WikiRoot) {
  wikiRoot = handle;
  imageUrls.forEach(URL.revokeObjectURL);
  imageUrls.clear();
}

export function getRoot() {
  return wikiRoot;
}

export function rootName() {
  return wikiRoot?.name || "Wiki";
}

export function getAssetUrl(path: string) {
  return imageUrls.get(path.replace(/^\.\//, "")) || path;
}

function cleanPart(part: string) {
  const p = part.trim();
  if (!p || p === "." || p === ".." || /[\\/\0]/.test(p)) {
    throw new Error("Nome de arquivo ou pasta inválido.");
  }
  return p;
}

function parts(path: string) {
  return path.split("/").filter(Boolean).map(cleanPart);
}

export function relativePath(handlePath: string) {
  return handlePath.replace(/^\/+/, "");
}

async function directoryAt(path: string, create = false): Promise<DirHandle> {
  if (!wikiRoot || isIndexedDbRoot(wikiRoot)) throw new Error("Nenhuma wiki em pastas está aberta.");
  let dir = wikiRoot;
  for (const part of parts(path)) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}

async function parentAndName(path: string, create = false) {
  const pathParts = parts(path);
  const name = pathParts.pop();
  if (!name) throw new Error("Caminho inválido.");
  return { parent: await directoryAt(pathParts.join("/"), create), name };
}

async function createStoredWiki(name: string): Promise<IndexedDbWikiRoot> {
  const safe = cleanPart(name);
  const db = await openDatabase();
  const id = crypto.randomUUID();
  const transaction = db.transaction(["wikis", "files", "directories"], "readwrite");
  transaction.objectStore("wikis").add({ id, name: safe } satisfies StoredWiki);
  transaction.objectStore("directories").add({ wikiId: id, path: "assets" } satisfies StoredDirectory);
  transaction.objectStore("files").add({
    wikiId: id,
    path: "Início.md",
    data: encoder.encode(`# ${safe}\n\nBem-vindo à sua wiki!\n`).buffer,
    type: "text/markdown",
  } satisfies StoredFile);
  await transactionDone(transaction);
  return { kind: "indexeddb", id, name: safe };
}

export async function createWiki(name: string): Promise<WikiRoot> {
  const safe = cleanPart(name);
  if (!isFileSystemAccessSupported()) {
    const root = await createStoredWiki(safe);
    pendingParent = null;
    return root;
  }
  if (!pendingParent) throw new Error("Selecione a pasta onde a wiki será criada.");
  const root = await pendingParent.getDirectoryHandle(safe, { create: true });
  await root.getDirectoryHandle("assets", { create: true });
  const start = await root.getFileHandle("Início.md", { create: true });
  const writer = await start.createWritable();
  await writer.write(`# ${safe}\n\nBem-vindo à sua wiki!\n`);
  await writer.close();
  pendingParent = null;
  return root;
}

async function writeStoredFile(root: IndexedDbWikiRoot, path: string, data: ArrayBuffer, type: string) {
  const pathParts = parts(path);
  const name = pathParts.pop();
  if (!name) throw new Error("Caminho inválido.");
  const db = await openDatabase();
  const transaction = db.transaction(["files", "directories"], "readwrite");
  const directoryStore = transaction.objectStore("directories");
  let current = "";
  for (const part of pathParts) {
    current = current ? `${current}/${part}` : part;
    directoryStore.put({ wikiId: root.id, path: current } satisfies StoredDirectory);
  }
  transaction.objectStore("files").put({
    wikiId: root.id,
    path: [...pathParts, name].join("/"),
    data,
    type,
  } satisfies StoredFile);
  await transactionDone(transaction);
}

async function getStoredFiles(root: IndexedDbWikiRoot): Promise<StoredFile[]> {
  const db = await openDatabase();
  const transaction = db.transaction("files", "readonly");
  const files = await requestResult(
    transaction.objectStore("files").getAll() as IDBRequest<StoredFile[]>,
  );
  await transactionDone(transaction);
  return files.filter(file => file.wikiId === root.id);
}

export async function readText(path: string) {
  if (wikiRoot && isIndexedDbRoot(wikiRoot)) {
    const file = (await getStoredFiles(wikiRoot)).find(item => item.path === parts(path).join("/"));
    if (!file) throw new Error(`Arquivo não encontrado: ${path}`);
    return decoder.decode(file.data);
  }
  const { parent, name } = await parentAndName(path);
  return (await (await parent.getFileHandle(name)).getFile()).text();
}

export async function writeText(path: string, content: string) {
  if (wikiRoot && isIndexedDbRoot(wikiRoot)) {
    await writeStoredFile(wikiRoot, path, encoder.encode(content).buffer, "text/markdown");
    return;
  }
  const { parent, name } = await parentAndName(path, true);
  const file = await parent.getFileHandle(name, { create: true });
  const writer = await file.createWritable();
  await writer.write(content);
  await writer.close();
}

export async function makeDirectory(path: string) {
  if (wikiRoot && isIndexedDbRoot(wikiRoot)) {
    const root = wikiRoot;
    const db = await openDatabase();
    const transaction = db.transaction("directories", "readwrite");
    const store = transaction.objectStore("directories");
    let current = "";
    for (const part of parts(path)) {
      current = current ? `${current}/${part}` : part;
      store.put({ wikiId: root.id, path: current } satisfies StoredDirectory);
    }
    await transactionDone(transaction);
    return;
  }
  await directoryAt(path, true);
}

export async function removePath(path: string) {
  if (wikiRoot && isIndexedDbRoot(wikiRoot)) {
    const root = wikiRoot;
    const cleanPath = parts(path).join("/");
    const db = await openDatabase();
    const transaction = db.transaction(["files", "directories"], "readwrite");
    const filesStore = transaction.objectStore("files");
    const directoriesStore = transaction.objectStore("directories");
    const [files, directories] = await Promise.all([
      requestResult(filesStore.getAll() as IDBRequest<StoredFile[]>),
      requestResult(directoriesStore.getAll() as IDBRequest<StoredDirectory[]>),
    ]);
    files.filter(file => file.wikiId === root.id && (file.path === cleanPath || file.path.startsWith(`${cleanPath}/`)))
      .forEach(file => filesStore.delete([root.id, file.path]));
    directories.filter(dir => dir.wikiId === root.id && (dir.path === cleanPath || dir.path.startsWith(`${cleanPath}/`)))
      .forEach(dir => directoriesStore.delete([root.id, dir.path]));
    await transactionDone(transaction);
    imageUrls.forEach((url, key) => {
      if (key === cleanPath || key.startsWith(`${cleanPath}/`)) {
        URL.revokeObjectURL(url);
        imageUrls.delete(key);
      }
    });
    return;
  }
  const { parent, name } = await parentAndName(path);
  try {
    await parent.removeEntry(name, { recursive: true });
  } catch {
    throw new Error("Não foi possível excluir o item. Verifique se a pasta tem permissão de escrita.");
  }
}

function insertTreeNode(tree: FileNode[], path: string, isDirectory: boolean) {
  const segments = path.split("/");
  let nodes = tree;
  let currentPath = "";
  for (let index = 0; index < segments.length; index += 1) {
    const name = segments[index];
    currentPath = currentPath ? `${currentPath}/${name}` : name;
    const isLast = index === segments.length - 1;
    let node = nodes.find(item => item.name === name);
    if (!node) {
      node = { name, path: currentPath, is_dir: !isLast || isDirectory };
      if (node.is_dir) node.children = [];
      nodes.push(node);
    }
    if (!isLast) nodes = node.children ?? (node.children = []);
  }
}

function sortTree(nodes: FileNode[]) {
  nodes.sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name));
  nodes.forEach(node => {
    if (node.children) sortTree(node.children);
  });
}

export async function buildTree(): Promise<FileNode[]> {
  if (!wikiRoot) return [];
  if (isIndexedDbRoot(wikiRoot)) {
    const root = wikiRoot;
    const db = await openDatabase();
    const transaction = db.transaction("directories", "readonly");
    const directories = await requestResult(
      transaction.objectStore("directories").getAll() as IDBRequest<StoredDirectory[]>,
    );
    await transactionDone(transaction);
    const files = await getStoredFiles(root);
    const tree: FileNode[] = [];
    directories.filter(item => item.wikiId === root.id).forEach(item => insertTreeNode(tree, item.path, true));
    files.forEach(file => {
      insertTreeNode(tree, file.path, false);
      if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(file.path)) {
        const old = imageUrls.get(file.path);
        if (old) URL.revokeObjectURL(old);
        imageUrls.set(file.path, URL.createObjectURL(new Blob([file.data], { type: file.type })));
      }
    });
    sortTree(tree);
    return tree;
  }

  const walk = async (dir: DirHandle, prefix: string): Promise<FileNode[]> => {
    const nodes: FileNode[] = [];
    for await (const [name, handle] of directoryEntries(dir)) {
      if (name.startsWith(".")) continue;
      const path = prefix ? `${prefix}/${name}` : name;
      const childDirectory = asDirectoryHandle(handle);
      if (childDirectory) {
        nodes.push({ name, path, is_dir: true, children: await walk(childDirectory, path) });
      } else {
        const fileHandle = asFileHandle(handle);
        if (!fileHandle) continue;
        nodes.push({ name, path, is_dir: false });
        if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name)) {
          const file = await fileHandle.getFile();
          const old = imageUrls.get(path);
          if (old) URL.revokeObjectURL(old);
          imageUrls.set(path, URL.createObjectURL(file));
        }
      }
    }
    return nodes.sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name));
  };
  return walk(wikiRoot, "");
}

export async function importImage(): Promise<string | null> {
  if (!wikiRoot) throw new Error("Abra uma wiki primeiro.");
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  const file = await new Promise<File | null>(resolve => {
    picker.onchange = () => resolve(picker.files?.[0] || null);
    picker.click();
  });
  if (!file) return null;
  const base = file.name.replace(/[\\/:*?"<>|]/g, "_");
  if (isIndexedDbRoot(wikiRoot)) {
    const files = await getStoredFiles(wikiRoot);
    const existing = new Set(files.map(item => item.path));
    let filename = base;
    let index = 1;
    while (existing.has(`assets/${filename}`)) {
      filename = `${base.replace(/\.[^.]+$/, "")}-${index++}${base.includes(".") ? `.${base.split(".").pop()}` : ""}`;
    }
    const path = `assets/${filename}`;
    await writeStoredFile(wikiRoot, path, await file.arrayBuffer(), file.type);
    const old = imageUrls.get(path);
    if (old) URL.revokeObjectURL(old);
    imageUrls.set(path, URL.createObjectURL(file));
    return path;
  }
  const assets = await wikiRoot.getDirectoryHandle("assets", { create: true });
  let filename = base;
  let index = 1;
  while (true) {
    try {
      await assets.getFileHandle(filename);
      filename = `${base.replace(/\.[^.]+$/, "")}-${index++}${base.includes(".") ? `.${base.split(".").pop()}` : ""}`;
    } catch {
      break;
    }
  }
  const fileHandle = await assets.getFileHandle(filename, { create: true });
  const writer = await fileHandle.createWritable();
  await writer.write(file);
  await writer.close();
  const imagePath = `assets/${filename}`;
  const old = imageUrls.get(imagePath);
  if (old) URL.revokeObjectURL(old);
  imageUrls.set(imagePath, URL.createObjectURL(await fileHandle.getFile()));
  return imagePath;
}

export async function assetUrl(path: string): Promise<string> {
  if (!wikiRoot) return path;
  const key = path.replace(/^\.?\//, "");
  if (imageUrls.has(key)) return imageUrls.get(key)!;
  if (isIndexedDbRoot(wikiRoot)) {
    const file = (await getStoredFiles(wikiRoot)).find(item => item.path === key);
    if (!file) return path;
    const url = URL.createObjectURL(new Blob([file.data], { type: file.type }));
    imageUrls.set(key, url);
    return url;
  }
  const { parent, name } = await parentAndName(key);
  const file = await (await parent.getFileHandle(name)).getFile();
  const url = URL.createObjectURL(file);
  imageUrls.set(key, url);
  return url;
}

async function walkFiles(dir: DirHandle, prefix = ""): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for await (const [name, handle] of directoryEntries(dir)) {
    const path = prefix ? `${prefix}/${name}` : name;
    const childDirectory = asDirectoryHandle(handle);
    if (childDirectory) {
      Object.assign(out, await walkFiles(childDirectory, path));
    } else {
      const fileHandle = asFileHandle(handle);
      if (fileHandle) out[path] = new Uint8Array(await (await fileHandle.getFile()).arrayBuffer());
    }
  }
  return out;
}

async function allWikiFiles(): Promise<Record<string, Uint8Array>> {
  if (!wikiRoot) throw new Error("Nenhuma wiki aberta.");
  if (!isIndexedDbRoot(wikiRoot)) return walkFiles(wikiRoot);
  const files = await getStoredFiles(wikiRoot);
  return Object.fromEntries(files.map(file => [file.path, new Uint8Array(file.data)]));
}

export async function exportOpd() {
  if (!wikiRoot) throw new Error("Nenhuma wiki aberta.");
  const files = await allWikiFiles();
  const bytes = zipSync(files);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${wikiRoot.name}.opd`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importOpd(): Promise<WikiRoot | null> {
  const destination = isFileSystemAccessSupported() ? await chooseWikiDirectory() as DirHandle | null : null;
  if (isFileSystemAccessSupported() && !destination) return null;
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".opd,.zip,application/zip";
  const file = await new Promise<File | null>(resolve => {
    picker.onchange = () => resolve(picker.files?.[0] || null);
    picker.click();
  });
  if (!file) return null;
  const entries = await unzipSync(new Uint8Array(await file.arrayBuffer()));
  const base = file.name.replace(/\.(opd|zip)$/i, "").replace(/[\\/:*?"<>|]/g, "_") || "Wiki importada";
  const root: WikiRoot = destination
    ? await destination.getDirectoryHandle(base, { create: true })
    : await createStoredWiki(base);
  setRoot(root);
  for (const [rawPath, data] of Object.entries(entries)) {
    const path = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.split("/").some(part => !part || part === "." || part === "..")) continue;
    if (isIndexedDbRoot(root)) {
      await writeStoredFile(root, path, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), path.startsWith("assets/") ? "application/octet-stream" : "text/markdown");
      continue;
    }
    const segments = path.split("/");
    const filename = segments.pop()!;
    let dir = root;
    for (const segment of segments) dir = await dir.getDirectoryHandle(segment, { create: true });
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writer = await fileHandle.createWritable();
    await writer.write(data);
    await writer.close();
  }
  return root;
}
