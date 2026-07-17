use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, State, WindowEvent, Wry};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const REPO_RELEASES_BASE: &str = "https://github.com/Hunter52302/life-calendar/releases/download";

/// Evicts any PWA service worker a previous build left in the webview.
///
/// The desktop build no longer registers one (src/main.jsx), but a worker left
/// by a build that predates that change outlives the app update: it lives in
/// the webview's data directory, which the installer does not touch. Left alone it
/// keeps serving its precached copy of the OLD frontend, so a freshly updated
/// binary renders the previous release's UI — the bug where About reported
/// v1.2.8 while the .exe on disk was already v1.2.11.
///
/// This runs on every page load and is a no-op once no worker is registered.
const EVICT_SERVICE_WORKER_JS: &str = r#"
(async () => {
  try {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return;
    await Promise.all(regs.map(r => r.unregister()));
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // Unregistering does not release a page the worker already controls, so the
    // stale bundle stays on screen until a reload re-fetches it from the Tauri
    // asset protocol. The early return above is the loop guard: the reloaded
    // page has no registrations left, so it does not reload again.
    location.reload();
  } catch (err) {
    console.warn('Service worker eviction failed:', err);
  }
})();
"#;

/// Handles to the tray bits the frontend updates as the next event changes.
struct TrayState {
    next_item: MenuItem<Wry>,
}

/// Show + focus the main window (used by the tray menu and icon click).
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Update the tray's "next event" menu line, tooltip, and (optionally) the
/// inline menu-bar title. Called from the frontend (which alone can decrypt
/// event labels) whenever the next upcoming event changes. The label text stays
/// on the desktop — never sent anywhere.
///
/// `title` is the text shown *inline* next to the tray icon. On macOS this sits
/// permanently in the menu bar; on Windows/Linux `set_title` is unsupported and
/// silently does nothing (the hover tooltip covers those platforms instead).
/// An empty string clears the inline title.
///
/// The title is always passed as `Some`, never `None`, even when clearing it:
/// tray-icon's macOS `set_title_inner` is a no-op for `None` (it only calls
/// `button.setTitle` inside `if let Some(title)`), so `None` leaves the previous
/// text sitting in the menu bar forever. `Some("")` sets an empty NSString,
/// which is what actually clears it — this is why turning off "Show event name
/// in menu bar" appeared to do nothing on macOS.
#[tauri::command]
fn update_next_event(
    app: AppHandle,
    state: State<'_, TrayState>,
    label: String,
    tooltip: String,
    title: String,
) -> Result<(), String> {
    state.next_item.set_text(label).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
        let _ = tray.set_title(Some(title));
    }
    Ok(())
}

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
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            check_for_update,
            install_update,
            revert_update,
            update_next_event
        ])
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = webview.eval(EVICT_SERVICE_WORKER_JS);
            }
        })
        .on_window_event(|window, event| {
            // Hide to tray instead of quitting when the window is closed, so the
            // "next event" reminder stays in the menubar. Quit via the tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            // ── System tray with a live "next event" line ──────────────────
            let next_item = MenuItem::with_id(app, "next", "No upcoming events", false, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Open PLS Calendar", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit PLS Calendar", true, None::<&str>)?;
            let menu = MenuBuilder::new(app)
                .item(&next_item)
                .separator()
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            app.manage(TrayState { next_item: next_item.clone() });

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("PLS Calendar")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
