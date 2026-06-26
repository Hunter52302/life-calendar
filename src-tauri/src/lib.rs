use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const REPO_RELEASES_BASE: &str = "https://github.com/Hunter52302/life-calendar/releases/download";

#[derive(Clone, serde::Serialize)]
struct UpdateInfo {
    version: String,
    current_version: String,
    body: String,
}

/// Checks the default updater endpoint (the repo's `latest.json`) for a newer version.
#[tauri::command]
async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    Ok(update.map(|u| UpdateInfo {
        version: u.version,
        current_version: u.current_version,
        body: u.body.unwrap_or_default(),
    }))
}

/// Downloads and installs whatever update is currently available, then the
/// frontend relaunches the app to apply it.
#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;
    update
        .download_and_install(|_chunk_len, _total_len| {}, || {})
        .await
        .map_err(|e| e.to_string())
}

/// Reinstalls a specific older version by pointing the updater at that
/// release's own `latest.json` (every tagged release publishes one — see
/// .github/workflows/desktop-release.yml) and bypassing the normal
/// "only update if newer" version check, since this is an intentional
/// downgrade for rollback purposes.
#[tauri::command]
async fn revert_update(app: AppHandle, version: String) -> Result<(), String> {
    let endpoint = Url::parse(&format!(
        "{REPO_RELEASES_BASE}/v{version}/latest.json"
    ))
    .map_err(|e| e.to_string())?;

    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .version_comparator(|_current, _remote| true)
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Could not find release v{version}"))?;

    update
        .download_and_install(|_chunk_len, _total_len| {}, || {})
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_for_update,
            install_update,
            revert_update
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(updater) = handle.updater() {
                    if let Ok(Some(update)) = updater.check().await {
                        // Emit to frontend so React can show the update banner
                        // and decide whether to auto-install it.
                        let _ = handle.emit(
                            "update-available",
                            serde_json::json!({
                                "version": update.version,
                                "current_version": update.current_version,
                                "body": update.body.clone().unwrap_or_default(),
                            }),
                        );
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
