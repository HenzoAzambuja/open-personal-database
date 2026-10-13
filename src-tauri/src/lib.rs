mod archive_service;
mod fs_service;

use archive_service::{export_wiki_to_opd, import_opd_wiki};
use fs_service::{
    copy_image_to_assets, create_new_folder, create_new_page, create_new_wiki,
    delete_file_or_folder, get_asset_data_url, read_markdown_file, read_wiki_directory,
    save_markdown_file,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_wiki_directory,
            read_markdown_file,
            save_markdown_file,
            create_new_page,
            create_new_folder,
            delete_file_or_folder,
            create_new_wiki,
            copy_image_to_assets,
            get_asset_data_url,
            export_wiki_to_opd,
            import_opd_wiki
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
