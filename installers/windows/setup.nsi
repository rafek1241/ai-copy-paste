; AI Context Collector - NSIS Installer Script
; This script creates a Windows installer with context menu integration

; ============================================================================
; Includes
; ============================================================================
!include "MUI2.nsh"
!include "FileFunc.nsh"

; ============================================================================
; General Settings
; ============================================================================
Name "AI Context Collector"
OutFile "ai-context-collector-setup.exe"
InstallDir "$PROGRAMFILES\AI Context Collector"
InstallDirRegKey HKLM "Software\AIContextCollector" "InstallDir"
RequestExecutionLevel admin

; ============================================================================
; Version Information
; ============================================================================
VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "AI Context Collector"
VIAddVersionKey "FileDescription" "AI Context Collector Installer"
VIAddVersionKey "FileVersion" "0.1.0.0"
VIAddVersionKey "ProductVersion" "0.1.0"
VIAddVersionKey "LegalCopyright" "© 2024 AI Context Collector Team"

; ============================================================================
; Modern UI Configuration
; ============================================================================
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"

; ============================================================================
; Installer Sections
; ============================================================================
Section "Main Application" SecMain
  SectionIn RO  ; Read-only, always installed
  
  SetOutPath "$INSTDIR"
  
  ; Copy application files
  ; NOTE: These paths should be updated to match your actual build output
  File /r "..\..\src-tauri\target\release\ai-context-collector.exe"
  
  ; Write installation directory to registry
  WriteRegStr HKLM "Software\AIContextCollector" "InstallDir" "$INSTDIR"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Add uninstall information to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                   "DisplayName" "AI Context Collector"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                   "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                   "DisplayIcon" "$INSTDIR\ai-context-collector.exe,0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                   "Publisher" "AI Context Collector Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                   "DisplayVersion" "0.1.0"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                     "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                     "NoRepair" 1
  
  ; Calculate installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector" \
                     "EstimatedSize" "$0"
  
SectionEnd

Section "Context Menu Integration" SecContextMenu
  ; Add context menu registry entries
  
  ; File context menu
  WriteRegStr HKCR "*\shell\AIContextCollector" "" "Send to AI Context Collector"
  WriteRegStr HKCR "*\shell\AIContextCollector" "Icon" "$INSTDIR\ai-context-collector.exe,0"
  WriteRegStr HKCR "*\shell\AIContextCollector\command" "" '"$INSTDIR\ai-context-collector.exe" "%1"'
  
  ; Directory context menu
  WriteRegStr HKCR "Directory\shell\AIContextCollector" "" "Send to AI Context Collector"
  WriteRegStr HKCR "Directory\shell\AIContextCollector" "Icon" "$INSTDIR\ai-context-collector.exe,0"
  WriteRegStr HKCR "Directory\shell\AIContextCollector\command" "" '"$INSTDIR\ai-context-collector.exe" "%1"'
  
  ; Directory background context menu
  WriteRegStr HKCR "Directory\Background\shell\AIContextCollector" "" "Send Current Folder to AI Context Collector"
  WriteRegStr HKCR "Directory\Background\shell\AIContextCollector" "Icon" "$INSTDIR\ai-context-collector.exe,0"
  WriteRegStr HKCR "Directory\Background\shell\AIContextCollector\command" "" '"$INSTDIR\ai-context-collector.exe" "%V"'
  
SectionEnd

Section "Start Menu Shortcuts" SecStartMenu
  CreateDirectory "$SMPROGRAMS\AI Context Collector"
  CreateShortcut "$SMPROGRAMS\AI Context Collector\AI Context Collector.lnk" \
                 "$INSTDIR\ai-context-collector.exe"
  CreateShortcut "$SMPROGRAMS\AI Context Collector\Uninstall.lnk" \
                 "$INSTDIR\uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
  CreateShortcut "$DESKTOP\AI Context Collector.lnk" "$INSTDIR\ai-context-collector.exe"
SectionEnd

; ============================================================================
; Section Descriptions
; ============================================================================
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "Core application files (required)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecContextMenu} "Adds 'Send to AI Context Collector' to Explorer right-click menu"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Creates Start Menu shortcuts"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Creates a Desktop shortcut"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ============================================================================
; Uninstaller Section
; ============================================================================
Section "Uninstall"
  ; Remove application files
  Delete "$INSTDIR\ai-context-collector.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  
  ; Remove context menu registry entries
  DeleteRegKey HKCR "*\shell\AIContextCollector"
  DeleteRegKey HKCR "Directory\shell\AIContextCollector"
  DeleteRegKey HKCR "Directory\Background\shell\AIContextCollector"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\AI Context Collector\AI Context Collector.lnk"
  Delete "$SMPROGRAMS\AI Context Collector\Uninstall.lnk"
  RMDir "$SMPROGRAMS\AI Context Collector"
  
  ; Remove Desktop shortcut
  Delete "$DESKTOP\AI Context Collector.lnk"
  
  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIContextCollector"
  DeleteRegKey HKLM "Software\AIContextCollector"
  
SectionEnd
