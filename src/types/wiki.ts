export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface WikiMetadata {
  name: string;
  path: string;
  pageCount: number;
  lastOpened?: string;
}

export interface WikiState {
  currentWikiPath: string | null;
  wikiName: string | null;
  fileTree: FileNode[];
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileTitle: string | null;
  isDirty: boolean;
  isLoading: boolean;
  searchQuery: string;
  metadata: WikiMetadata | null;
}

