use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[tauri::command]
pub fn export_wiki_to_opd(
    wiki_folder_path: String,
    output_file_path: String,
) -> Result<(), String> {
    let wiki_path = Path::new(&wiki_folder_path);
    if !wiki_path.exists() || !wiki_path.is_dir() {
        return Err(format!(
            "O diretório da wiki não existe ou não é uma pasta: '{}'",
            wiki_folder_path
        ));
    }

    let mut final_output_path = output_file_path.clone();
    if !final_output_path.to_lowercase().ends_with(".opd") {
        final_output_path.push_str(".opd");
    }

    let out_file_path = Path::new(&final_output_path);
    if let Some(parent) = out_file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Falha ao criar diretório de saída '{}': {}",
                    parent.display(),
                    e
                )
            })?;
        }
    }

    let file = File::create(out_file_path).map_err(|e| {
        format!(
            "Falha ao criar arquivo de pacote '{}': {}",
            final_output_path, e
        )
    })?;

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let mut buffer = Vec::new();

    for entry in WalkDir::new(wiki_path) {
        let entry = entry.map_err(|e| format!("Erro ao percorrer pasta da wiki: {}", e))?;
        let entry_path = entry.path();

        // Pular a raiz
        if entry_path == wiki_path {
            continue;
        }

        let relative_path = entry_path
            .strip_prefix(wiki_path)
            .map_err(|e| format!("Erro ao calcular caminho relativo: {}", e))?;

        let relative_str = relative_path.to_string_lossy().replace('\\', "/");
        if relative_str.is_empty() {
            continue;
        }

        if entry.file_type().is_dir() {
            zip.add_directory(&relative_str, options).map_err(|e| {
                format!(
                    "Falha ao compactar pasta '{}': {}",
                    relative_str, e
                )
            })?;
        } else if entry.file_type().is_file() {
            zip.start_file(&relative_str, options).map_err(|e| {
                format!(
                    "Falha ao criar registro de arquivo '{}': {}",
                    relative_str, e
                )
            })?;

            let mut f = File::open(entry_path).map_err(|e| {
                format!("Falha ao abrir arquivo '{}': {}", entry_path.display(), e)
            })?;
            f.read_to_end(&mut buffer).map_err(|e| {
                format!("Falha ao ler arquivo '{}': {}", entry_path.display(), e)
            })?;
            zip.write_all(&buffer).map_err(|e| {
                format!(
                    "Falha ao gravar conteúdo do arquivo '{}': {}",
                    relative_str, e
                )
            })?;
            buffer.clear();
        }
    }

    zip.finish()
        .map_err(|e| format!("Falha ao finalizar arquivo de pacote .opd: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn import_opd_wiki(
    opd_file_path: String,
    target_extract_path: String,
) -> Result<String, String> {
    let opd_path = Path::new(&opd_file_path);
    if !opd_path.exists() {
        return Err(format!("Arquivo .opd não encontrado: '{}'", opd_file_path));
    }

    let extract_dir = Path::new(&target_extract_path);
    if !extract_dir.exists() {
        fs::create_dir_all(extract_dir).map_err(|e| {
            format!(
                "Falha ao criar diretório de destino '{}': {}",
                target_extract_path, e
            )
        })?;
    }

    let file = File::open(opd_path)
        .map_err(|e| format!("Falha ao abrir o arquivo .opd '{}': {}", opd_file_path, e))?;

    let mut archive = ZipArchive::new(file).map_err(|e| {
        format!(
            "Falha ao ler o pacote .opd (arquivo corrompido ou formato inválido): {}",
            e
        )
    })?;

    for i in 0..archive.len() {
        let mut item = archive.by_index(i)
            .map_err(|e| format!("Falha ao ler item #{} do pacote: {}", i, e))?;

        let enclosed_name = match item.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue, // Prevenção contra vulnerabilidade ZipSlip
        };

        let outpath = extract_dir.join(enclosed_name);

        let is_dir = item.is_dir()
            || item.name().map(|n| n.ends_with('/')).unwrap_or(false);

        if is_dir {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Falha ao criar diretório extraído '{}': {}", outpath.display(), e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent).map_err(|e| {
                        format!("Falha ao criar pasta pai '{}': {}", parent.display(), e)
                    })?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| {
                format!("Falha ao criar arquivo de extração '{}': {}", outpath.display(), e)
            })?;
            io::copy(&mut item, &mut outfile).map_err(|e| {
                format!("Falha ao descompactar conteúdo em '{}': {}", outpath.display(), e)
            })?;
        }
    }

    Ok(extract_dir.to_string_lossy().to_string())
}

