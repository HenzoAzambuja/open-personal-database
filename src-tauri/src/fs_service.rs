use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Lê recursivamente a estrutura de arquivos e pastas do diretório especificado
pub fn read_dir_recursive(dir_path: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Falha ao ler diretório '{}': {}", dir_path.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Erro ao ler entrada de arquivo: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Ignorar arquivos e pastas ocultos (como .git, .vscode, etc.)
        if file_name.starts_with('.') {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|e| format!("Erro ao obter tipo de arquivo para '{}': {}", file_name, e))?;

        if file_type.is_dir() {
            let children = read_dir_recursive(&path)?;
            nodes.push(FileNode {
                name: file_name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
            });
        } else if file_type.is_file() {
            // Incluir apenas arquivos Markdown (.md)
            if let Some(ext) = path.extension() {
                if ext.eq_ignore_ascii_case("md") {
                    nodes.push(FileNode {
                        name: file_name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: false,
                        children: None,
                    });
                }
            }
        }
    }

    // Ordenação: pastas primeiro, seguidas de arquivos, ambos em ordem alfabética
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

#[tauri::command]
pub fn read_wiki_directory(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("O diretório '{}' não existe.", path));
    }
    if !root.is_dir() {
        return Err(format!("O caminho '{}' não é um diretório.", path));
    }

    // Garantir que a subpasta /assets exista para mídias
    let assets_dir = root.join("assets");
    if !assets_dir.exists() {
        let _ = fs::create_dir_all(&assets_dir);
    }

    read_dir_recursive(root)
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("Arquivo não encontrado: '{}'", path));
    }
    fs::read_to_string(file_path)
        .map_err(|e| format!("Falha ao ler o arquivo '{}': {}", path, e))
}

#[tauri::command]
pub fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Falha ao criar pasta pai '{}': {}", parent.display(), e))?;
        }
    }
    fs::write(file_path, content.as_bytes())
        .map_err(|e| format!("Falha ao salvar o arquivo '{}': {}", path, e))
}

#[tauri::command]
pub fn create_new_page(parent_path: String, title: String) -> Result<String, String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("O título da página não pode estar vazio.".to_string());
    }

    let file_name = if trimmed_title.to_lowercase().ends_with(".md") {
        trimmed_title.to_string()
    } else {
        format!("{}.md", trimmed_title)
    };

    let parent = Path::new(&parent_path);
    if !parent.exists() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Falha ao criar diretório '{}': {}", parent_path, e))?;
    }

    let file_path = parent.join(&file_name);
    if file_path.exists() {
        return Err(format!("A página '{}' já existe neste local.", file_name));
    }

    let raw_title = if trimmed_title.to_lowercase().ends_with(".md") {
        &trimmed_title[..trimmed_title.len() - 3]
    } else {
        trimmed_title
    };

    let initial_content = format!("# {}\n\n", raw_title);
    fs::write(&file_path, initial_content.as_bytes())
        .map_err(|e| format!("Falha ao criar o arquivo '{}': {}", file_path.display(), e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_new_folder(parent_path: String, folder_name: String) -> Result<String, String> {
    let trimmed = folder_name.trim();
    if trimmed.is_empty() {
        return Err("O nome da pasta não pode estar vazio.".to_string());
    }

    let parent = Path::new(&parent_path);
    let new_dir_path = parent.join(trimmed);

    if new_dir_path.exists() {
        return Err(format!("A pasta '{}' já existe neste local.", trimmed));
    }

    fs::create_dir_all(&new_dir_path)
        .map_err(|e| format!("Falha ao criar diretório '{}': {}", new_dir_path.display(), e))?;

    Ok(new_dir_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file_or_folder(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(format!("O caminho '{}' não foi encontrado.", path));
    }

    if target.is_dir() {
        fs::remove_dir_all(target)
            .map_err(|e| format!("Falha ao remover diretório '{}': {}", path, e))
    } else {
        fs::remove_file(target)
            .map_err(|e| format!("Falha ao remover arquivo '{}': {}", path, e))
    }
}

#[tauri::command]
pub fn create_new_wiki(parent_path: String, wiki_name: String) -> Result<String, String> {
    let trimmed_name = wiki_name.trim();
    if trimmed_name.is_empty() {
        return Err("O nome da wiki não pode estar vazio.".to_string());
    }

    // Caracteres inválidos em nomes de pasta no sistema de arquivos
    let invalid_chars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    if trimmed_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("O nome da wiki contém caracteres inválidos (como /, \\, :, *, ?, \", <, >, |).".to_string());
    }

    let parent = Path::new(&parent_path);
    if !parent.exists() {
        return Err(format!("A pasta de destino '{}' não existe.", parent_path));
    }

    let wiki_dir = parent.join(trimmed_name);
    if wiki_dir.exists() {
        return Err(format!("Já existe uma pasta chamada '{}' neste local.", trimmed_name));
    }

    fs::create_dir_all(&wiki_dir)
        .map_err(|e| format!("Falha ao criar diretório da wiki: {}", e))?;

    let assets_dir = wiki_dir.join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Falha ao criar diretório /assets: {}", e))?;

    let home_file = wiki_dir.join("Início.md");
    let initial_content = format!(
        ":::infobox\ntitle: {}\ncaption: Enciclopédia Local\n[Informações Gerais]\nTipo: Wiki Pessoal Fandom\nFilosofia: Local-First\nFormato: Markdown (.md)\nMídias: Subpasta /assets\nStatus: Ativa\n:::\n\n:::notice tipo=\"info\" titulo=\"Bem-vindo à sua Wiki Fandom!\"\nEsta base de conhecimento possui interface inspirada no **Fandom**, com suporte a **Infoboxes laterais**, caixas de destaque, citações e **WikiLinks** navegáveis!\n:::\n\n# Início - {}\n\nBem-vindo à sua nova enciclopédia pessoal! Todos os seus dados são salvos diretamente no seu computador em formato Markdown.\n\n:::quote autor=\"Open Personal Database\"\n\"O conhecimento conectado é o alicerce de grandes criações.\"\n:::\n\n## 🚀 Recursos Fandom Disponíveis\n- **Infoboxes Laterais:** Crie fichas estruturadas de personagens, locais e tópicos usando o botão **Infobox**.\n- **Inserção de Imagens:** Clique em **Imagem** para escolher fotos do seu computador e salvá-las na pasta `assets/`.\n- **WikiLinks:** Conecte anotações usando [[Primeiras Ideias]] e navegue clicando sobre elas.\n- **Caixas de Aviso e Citações:** Adicione alertas de spoiler e citações memoráveis.\n- **Exportação:** Gere pacotes compactados `.opd` a qualquer momento para backup ou compartilhamento.\n",
        trimmed_name, trimmed_name
    );

    fs::write(&home_file, initial_content.as_bytes())
        .map_err(|e| format!("Falha ao criar a página inicial 'Início.md': {}", e))?;

    Ok(wiki_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn copy_image_to_assets(
    wiki_path: String,
    source_file_path: String,
) -> Result<String, String> {
    let wiki_dir = Path::new(&wiki_path);
    if !wiki_dir.exists() {
        return Err(format!("Diretório da wiki não encontrado: '{}'", wiki_path));
    }

    let source_path = Path::new(&source_file_path);
    if !source_path.exists() {
        return Err(format!("Arquivo de imagem de origem não encontrado: '{}'", source_file_path));
    }

    let assets_dir = wiki_dir.join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Falha ao criar diretório /assets: {}", e))?;
    }

    let original_filename = source_path
        .file_name()
        .ok_or_else(|| "Nome de arquivo inválido".to_string())?
        .to_string_lossy()
        .to_string();

    let file_stem = source_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let file_ext = source_path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut target_filename = original_filename.clone();
    let mut counter = 1;

    // Se já existir imagem com esse nome em /assets, renomeia com sufixo numérico
    while assets_dir.join(&target_filename).exists() {
        if file_ext.is_empty() {
            target_filename = format!("{}_{}", file_stem, counter);
        } else {
            target_filename = format!("{}_{}.{}", file_stem, counter, file_ext);
        }
        counter += 1;
    }

    let target_path = assets_dir.join(&target_filename);
    fs::copy(source_path, &target_path)
        .map_err(|e| format!("Falha ao copiar imagem para pasta /assets: {}", e))?;

    Ok(format!("assets/{}", target_filename))
}

#[tauri::command]
pub fn get_asset_data_url(wiki_path: String, relative_path: String) -> Result<String, String> {
    let wiki_dir = Path::new(&wiki_path);
    let full_path = wiki_dir.join(&relative_path);
    if !full_path.exists() {
        return Err(format!("Arquivo não encontrado: '{}'", full_path.display()));
    }

    let bytes = fs::read(&full_path)
        .map_err(|e| format!("Falha ao ler arquivo: {}", e))?;

    let ext = full_path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}



