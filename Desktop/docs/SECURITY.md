# SyncD Desktop — Security Architecture & Threat Model

## 1. Security Philosophy & Principles

SyncD Desktop operates under a strict **defense-in-depth, least-privilege security model**. As a native application interacting with the local filesystem, low-level audio hardware, and an external cloud backend, it enforces strict isolation boundaries between:
1. The **Renderer Process** (React in Tauri Webview).
2. The **Native Host Process** (Rust Core).
3. The **Local Operating System & Filesystem** (Windows).
4. The **Remote SyncD Social Backend** (Clerk + Node.js API).

---

## 2. Tauri 2 Capability ACLs & IPC Hardening

Tauri 2 replaces legacy unrestricted IPC with explicit, fine-grained **Capabilities**.

### 2.1 Restrictive Capability Configuration (`src-tauri/capabilities/default.json`)
The desktop client drops all default ambient permissions and grants only strictly scoped APIs:
- **Filesystem Access:** Bounded strictly to read operations within user-selected indexed folders, and read/write within `%USERPROFILE%\Desktop\SyncD\Data\`.
- **Dialog Access:** Only standard native file/folder pickers (`dialog:open` for music directories).
- **Shell Access:** **Completely Disabled.** The frontend cannot execute shell scripts, launch external processes, or invoke command lines.
- **Remote Origins:** External navigation in the Webview is disabled. CSP restricts script and connect origins to `self` and verified backend endpoints.

### 2.2 Content Security Policy (CSP)
```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' asset: https://*.ytimg.com https://*.ggpht.com data:;
connect-src 'self' https://api.syncd.com wss://api.syncd.com http://localhost:5000 ws://localhost:5000;
media-src 'self' asset:;
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'none';
frame-ancestors 'none';
```

---

## 3. Secure Credential Storage

### 3.1 Zero Plain-Text Secrets Rule
- Authentication tokens (Clerk JWTs, session tokens, refresh tokens) are **strictly forbidden** from being stored in:
  - `settings.json`
  - Browser `localStorage` / `sessionStorage` in plain text
  - Unencrypted application SQLite tables
- **Platform Keyring Integration:** SyncD Desktop stores authentication credentials using the Windows Credential Manager via the Rust `keyring` crate (leveraging the Windows Data Protection API - DPAPI).
  ```rust
  use keyring::Entry;

  pub fn store_auth_token(token: &str) -> Result<(), SecurityError> {
      let entry = Entry::new("SyncD Desktop", "session_token")?;
      entry.set_password(token)?;
      Ok(())
  }
  ```

### 3.2 In-Memory Token Hygiene & Sanitization
- Memory tokens are held in bounded heap memory and cleared upon logout.
- Application logs (`%USERPROFILE%\Desktop\SyncD\Data\logs\`) pass through an automatic redaction regex filter before hitting disk, stripping tokens, passwords, and sensitive Clerk credentials.

---

## 4. Filesystem & Path Traversal Protections

### 4.1 Path Canonicalization & Boundary Verification
The renderer process is never allowed to specify an arbitrary string path that the native core blindly opens. Every filesystem command executes a strict boundary check:

```rust
pub fn validate_safe_path(requested_path: &Path, allowed_roots: &[PathBuf]) -> Result<PathBuf, SecurityError> {
    // 1. Resolve symlinks and relative traversal (..)
    let canonical = requested_path.canonicalize()
        .map_err(|_| SecurityError::InvalidPath)?;

    // 2. Enforce that canonical path is a prefix descendant of an authorized folder
    let is_authorized = allowed_roots.iter().any(|root| {
        if let Ok(canonical_root) = root.canonicalize() {
            canonical.starts_with(&canonical_root)
        } else {
            false
        }
    });

    if !is_authorized {
        return Err(SecurityError::AccessDenied("Path outside authorized folders".into()));
    }

    Ok(canonical)
}
```

### 4.2 Immutable In-Place Indexing
- Adding external music folders creates index entries pointing to the file's canonical path.
- SyncD Desktop **never copies, moves, renames, or deletes** external user files without explicit, destructive-confirmation user consent.

---

## 5. Untrusted Media & Metadata Hardening

Parsing arbitrary user-supplied binary files (MP3 tags, FLAC headers, JPEG/PNG album covers) is a known attack vector for memory corruption in native players.

### 5.1 Memory-Safe Parsers (Rust Ecosystem)
- SyncD uses **Lofty** and **Symphonia**, both written in 100% memory-safe Rust with bounds-checked buffer slices and zero unsafe C dependencies.
- Buffer overflows, use-after-free, and out-of-bounds reads inherent in legacy C libraries (like LibAV or TagLib) are eliminated at compile time.

### 5.2 Artwork & Thumbnail Decompression Bombs
- Extracted album covers are restricted to a maximum resolution of $2048 \times 2048$ and max decoded buffer of $16\text{ MB}$.
- Decompression bombs or corrupt header dimensions are rejected before thumbnail caching.

---

## 6. Social Protocol & Remote Authority Boundaries

### 6.1 Backend Authoritative Enforcement
- The desktop renderer is treated as an untrusted client by the backend.
- Room permissions (host actions, queue reordering, track selection) are strictly verified on the server via `assertHost` and database checks. Desktop does not rely on local UI state for security.
- `videoId` and `thumbnailUrl` attributes broadcast by rooms are sanitized against YouTube domain suffixes to prevent SSRF and IP harvesting.

