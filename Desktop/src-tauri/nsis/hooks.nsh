; ─────────────────────────────────────────────
; SyncDesk – NSIS installer hooks
; ─────────────────────────────────────────────
; This file is referenced from tauri.conf.json → bundle.windows.nsis.installerHooks
; and supplies macros that Tauri's generated installer.nsi will !insertmacro into
; the appropriate sections.

; Hook: runs AFTER standard uninstall logic has finished.
; At this point $DeleteAppDataCheckboxState is 1 when the user ticked
; "Remove user data" in the uninstaller, and $UpdateMode is 1 during
; a silent update-uninstall (where we must NOT delete user data).
!macro NSIS_HOOK_POSTUNINSTALL
  ; Only delete user data when user opted-in and this is NOT an update
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RMDir /r "$APPDATA\com.syncdesk.desktop"
    RMDir /r "$LOCALAPPDATA\com.syncdesk.desktop"

    ; Clean up local database and cache directories inside install folder
    RMDir /r "$INSTDIR\Index"
    RMDir /r "$INSTDIR\Data"

    ; Clean up install directory if now empty
    RMDir "$INSTDIR"
  ${EndIf}
!macroend
