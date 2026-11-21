use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use crate::app_state::AppState;
use sha2::{Digest, Sha256};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthListenerInfo {
    pub port: u16,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthCallbackPayload {
    pub token: String,
    pub refresh_token: Option<String>,
    pub user_id: Option<String>,
    pub username: Option<String>,
}

static LISTENER_CANCEL_FLAG: parking_lot::Mutex<Option<Arc<AtomicBool>>> = parking_lot::Mutex::new(None);

#[tauri::command]
pub fn start_auth_listener(app: AppHandle) -> Result<AuthListenerInfo, String> {
    // Generate random cryptographic state/nonce
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(timestamp.to_le_bytes());
    hasher.update(b"syncd-desktop-auth-salt");
    let state_nonce = format!("{:x}", hasher.finalize())[..24].to_string();

    // 1. Try dynamic port first on loopback (127.0.0.1:0)
    let listener = TcpListener::bind("127.0.0.1:0")
        .or_else(|_| {
            // Fallback ports if dynamic port allocation is restricted
            for port in 48291..=48295 {
                if let Ok(l) = TcpListener::bind(format!("127.0.0.1:{}", port)) {
                    return Ok(l);
                }
            }
            TcpListener::bind("127.0.0.1:0")
        })
        .map_err(|e| format!("Failed to bind loopback listener: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local address: {}", e))?
        .port();

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut global_flag = LISTENER_CANCEL_FLAG.lock();
        if let Some(prev) = global_flag.take() {
            prev.store(true, Ordering::SeqCst);
        }
        *global_flag = Some(cancel_flag.clone());
    }

    let expected_state = state_nonce.clone();
    let app_handle = app.clone();

    // Spawn listener thread with timeout
    thread::spawn(move || {
        let start_time = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(120);

        while !cancel_flag.load(Ordering::SeqCst) && start_time.elapsed() < timeout {
            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    let mut buffer = [0u8; 4096];
                    let bytes_read = stream.read(&mut buffer).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                    // Handle CORS preflight OPTIONS
                    if request.starts_with("OPTIONS") {
                        let response = "HTTP/1.1 204 No Content\r\n\
                                        Access-Control-Allow-Origin: *\r\n\
                                        Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                                        Access-Control-Allow-Headers: Content-Type\r\n\
                                        Access-Control-Max-Age: 86400\r\n\
                                        Connection: close\r\n\r\n";
                        let _ = stream.write_all(response.as_bytes());
                        let _ = stream.flush();
                        continue;
                    }

                    // Parse request for token, refreshToken, state
                    let (token, refresh_token, state_param) = parse_auth_request(&request);

                    if let Some(tok) = token {
                        let state_matches = match &state_param {
                            Some(st) => st.is_empty() || st == &expected_state,
                            None => true,
                        };

                        if state_matches {
                            // Success response with clean HTML
                            let html = "<html><head><title>SyncD Desktop</title></head><body style='font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'><div style='text-align:center;padding:24px;border-radius:16px;background:#18181b;border:1px solid #27272a;max-width:360px;'><div style='width:48px;height:48px;background:#f59e0b22;border:1px solid #f59e0b44;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#f59e0b;font-size:24px;'>&#10003;</div><h2 style='margin:0 0 8px;font-size:18px;'>Connected to SyncD Desktop</h2><p style='margin:0;font-size:13px;color:#a1a1aa;'>You can close this tab and return to the application.</p></div></body></html>";
                            let response = format!(
                                "HTTP/1.1 200 OK\r\n\
                                 Content-Type: text/html; charset=utf-8\r\n\
                                 Access-Control-Allow-Origin: *\r\n\
                                 Content-Length: {}\r\n\
                                 Connection: close\r\n\r\n{}",
                                html.len(),
                                html
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.flush();

                            let payload = AuthCallbackPayload {
                                token: tok,
                                refresh_token,
                                user_id: None,
                                username: None,
                            };

                            let _ = app_handle.emit("auth:callback", &payload);

                            // Auto-focus main application window
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.set_focus();
                            }
                            break;
                        }
                    }

                    // Invalid state or bad request
                    let err_response = "HTTP/1.1 400 Bad Request\r\n\
                                        Content-Type: text/plain\r\n\
                                        Access-Control-Allow-Origin: *\r\n\
                                        Connection: close\r\n\r\nInvalid authentication state";
                    let _ = stream.write_all(err_response.as_bytes());
                    let _ = stream.flush();
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    Ok(AuthListenerInfo {
        port,
        state: state_nonce,
    })
}

#[tauri::command]
pub fn cancel_auth_listener() -> Result<(), String> {
    let mut flag = LISTENER_CANCEL_FLAG.lock();
    if let Some(f) = flag.take() {
        f.store(true, Ordering::SeqCst);
    }
    Ok(())
}

fn parse_auth_request(req: &str) -> (Option<String>, Option<String>, Option<String>) {
    // 1. Check query parameters if GET /auth-callback?token=...&state=...
    if let Some(first_line) = req.lines().next() {
        if let Some(path_start) = first_line.find("GET ") {
            let path_part = &first_line[path_start + 4..];
            if let Some(path_end) = path_part.find(" HTTP/") {
                let url = &path_part[..path_end];
                if let Some(query_start) = url.find('?') {
                    let query = &url[query_start + 1..];
                    let mut token = None;
                    let mut refresh_token = None;
                    let mut state = None;

                    for pair in query.split('&') {
                        let mut kv = pair.splitn(2, '=');
                        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                            let val = urlencoding_decode(v);
                            match k {
                                "token" => token = Some(val),
                                "refreshToken" | "refresh_token" => refresh_token = Some(val),
                                "state" => state = Some(val),
                                _ => {}
                            }
                        }
                    }

                    if token.is_some() {
                        return (token, refresh_token, state);
                    }
                }
            }
        }
    }

    // 2. Check JSON body if POST
    if let Some(body_start) = req.find("\r\n\r\n") {
        let body = &req[body_start + 4..];
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
            let token = val.get("token").and_then(|v| v.as_str()).map(|s| s.to_string());
            let refresh = val.get("refreshToken").or_else(|| val.get("refresh_token")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let state = val.get("state").and_then(|v| v.as_str()).map(|s| s.to_string());
            return (token, refresh, state);
        }
    }

    (None, None, None)
}

fn urlencoding_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(byte) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                result.push(byte as char);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    result
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAuthSession {
    pub token: Option<String>,
    pub refresh_token: Option<String>,
    pub user_id: Option<String>,
    pub username: Option<String>,
    pub is_authenticated: bool,
}

#[tauri::command]
pub fn save_auth_credentials(
    state: State<'_, AppState>,
    token: String,
    refresh_token: Option<String>,
    user_id: Option<String>,
    username: Option<String>,
) -> Result<(), String> {
    let db = state.user_db.lock();
    
    // Save token and profile to user_account
    let id = user_id.unwrap_or_else(|| "user".to_string());
    let name = username.unwrap_or_else(|| "User".to_string());
    
    let account = crate::database::UserAccount {
        id,
        username: name,
        email: None,
        avatar_url: None,
        is_logged_in: true,
        auth_token: Some(token.clone()),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    db.set_user_account(&account)
        .map_err(|e| format!("Failed to save account: {}", e))?;

    // Save refresh token in settings
    if let Some(rt) = refresh_token {
        db.set_setting("auth_refresh_token", &rt)
            .map_err(|e| format!("Failed to save refresh token: {}", e))?;
    }
    
    // Save active token in settings as well for fast retrieval
    db.set_setting("auth_session_token", &token)
        .map_err(|e| format!("Failed to save session token: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_auth_credentials(state: State<'_, AppState>) -> Result<StoredAuthSession, String> {
    let db = state.user_db.lock();
    let account = db.get_user_account().map_err(|e| format!("Failed to read account: {}", e))?;
    let refresh_token = db.get_setting("auth_refresh_token").unwrap_or(None);
    let session_token = db.get_setting("auth_session_token").unwrap_or(None).or(account.auth_token.clone());

    Ok(StoredAuthSession {
        token: session_token,
        refresh_token,
        user_id: if account.is_logged_in { Some(account.id) } else { None },
        username: if account.is_logged_in { Some(account.username) } else { None },
        is_authenticated: account.is_logged_in,
    })
}

#[tauri::command]
pub fn clear_auth_credentials(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.user_db.lock();
    
    // Mark account logged out and clear token
    let mut account = db.get_user_account().unwrap_or_else(|_| crate::database::UserAccount {
        id: "guest".to_string(),
        username: "Guest User".to_string(),
        email: None,
        avatar_url: None,
        is_logged_in: false,
        auth_token: None,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    });
    account.is_logged_in = false;
    account.auth_token = None;
    let _ = db.set_user_account(&account);

    // Clear tokens in settings
    let _ = db.set_setting("auth_session_token", "");
    let _ = db.set_setting("auth_refresh_token", "");

    Ok(())
}

#[tauri::command]
pub fn open_browser_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Use rundll32 with url.dll,FileProtocolHandler to safely open the full URL
        // without cmd.exe interpreting '&' as a command separator.
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| format!("Failed to open system browser: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open system browser: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open system browser: {}", e))?;
    }
    Ok(())
}
