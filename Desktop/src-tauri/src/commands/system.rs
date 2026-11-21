use serde::Serialize;
use tauri::State;
use crate::app_state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub install_dir: String,
    pub database_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemHealth {
    pub status: String,
    pub database_ok: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn get_app_info(state: State<'_, AppState>) -> Result<AppInfo, String> {
    Ok(AppInfo {
        name: "SyncD Desktop".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        install_dir: state.install_dir.to_string_lossy().to_string(),
        database_path: state.db_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_system_health(state: State<'_, AppState>) -> Result<SystemHealth, String> {
    let mut db_lock = state.db.lock();
    let db_ok = db_lock.conn().query_row("SELECT 1;", [], |_| Ok(())).is_ok();

    Ok(SystemHealth {
        status: if db_ok { "healthy".to_string() } else { "degraded".to_string() },
        database_ok: db_ok,
        message: Some("Native Core and SQLite operational in WAL mode".to_string()),
    })
}

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.user_db.lock();
    db.get_setting(&key)
        .map_err(|e| format!("Failed to read setting '{}': {}", key, e))
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let db = state.user_db.lock();
    db.set_setting(&key, &value)
        .map_err(|e| format!("Failed to save setting '{}': {}", key, e))
}

#[tauri::command]
pub fn get_all_settings(state: State<'_, AppState>) -> Result<std::collections::HashMap<String, String>, String> {
    let db = state.user_db.lock();
    db.get_all_settings()
        .map_err(|e| format!("Failed to read all settings: {}", e))
}

#[tauri::command]
pub fn get_user_account(state: State<'_, AppState>) -> Result<crate::database::UserAccount, String> {
    let db = state.user_db.lock();
    db.get_user_account()
        .map_err(|e| format!("Failed to read user account: {}", e))
}

#[tauri::command]
pub fn set_user_account(state: State<'_, AppState>, account: crate::database::UserAccount) -> Result<(), String> {
    let db = state.user_db.lock();
    db.set_user_account(&account)
        .map_err(|e| format!("Failed to save user account: {}", e))
}

#[tauri::command]
pub fn get_artwork_dir(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.install_dir.join("Data").join("artwork").to_string_lossy().to_string())
}


