# Specification - Refactor Frontend UI

## Overview
Refactor the entire frontend UI to match the provided HTML design. The goal is to achieve a professional, dark-themed "Grouped Context Dashboard" aesthetic.

## Visual Design Reference

The following HTML represents the target design:

```html
<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Grouped Context Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#3b82f6",
                        "background-dark": "#0d1117",
                        "card-dark": "#161b22",
                        "border-dark": "#30363d"
                    },
                    fontFamily: {
                        "sans": ["Inter", "system-ui", "sans-serif"]
                    },
                },
            },
        }
    </script>
<style type="text/tailwindcss">
        @layer base {
            body {
                @apply bg-background-dark text-[#c9d1d9] antialiased overflow-hidden;
                font-size: 11px;
            }
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #30363d;
        }
        .compact-table-row {
            @apply border-b border-border-dark/30 hover:bg-white/[0.02] transition-colors flex items-center px-2 py-0.5 min-h-[22px];
        }
        .directory-header {
            @apply bg-[#161b22]/90 backdrop-blur-sm border-b border-border-dark flex items-center px-2 py-1 sticky top-0 z-10;
        }.custom-checkbox {
            @apply rounded-sm size-2.5 bg-transparent border-border-dark text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer;
        }
    </style>
<style>
        body {
            min-height: max(600px, 100dvh);
        }#tab-files:checked ~ .tab-content-files { display: flex; }
        #tab-prompt:checked ~ .tab-content-prompt { display: flex; }
        #tab-files:checked ~ .tab-nav label[for="tab-files"] { 
            color: white; 
            border-bottom-color: #3b82f6; 
        }
        #tab-prompt:checked ~ .tab-nav label[for="tab-prompt"] { 
            color: white; 
            border-bottom-color: #3b82f6; 
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="flex h-screen w-screen border-t border-white/5">
<aside class="w-10 flex-shrink-0 bg-[#010409] border-r border-border-dark flex flex-col items-center py-2 gap-4">
<div class="text-primary mb-2">
<span class="material-symbols-outlined text-[20px]">terminal</span>
</div>
<button class="text-white/40 hover:text-white">
<span class="material-symbols-outlined text-[18px]">folder</span>
</button>
<button class="text-white/40 hover:text-white">
<span class="material-symbols-outlined text-[18px]">list_alt</span>
</button>
<button class="text-white/40 hover:text-white">
<span class="material-symbols-outlined text-[18px]">history</span>
</button>
<div class="mt-auto flex flex-col gap-4">
<button class="text-white/40 hover:text-white">
<span class="material-symbols-outlined text-[18px]">settings</span>
</button>
</div>
</aside>
<div class="flex-1 flex flex-col min-w-0 relative">
<input checked="" class="hidden" id="tab-files" name="tabs" type="radio"/>
<input class="hidden" id="tab-prompt" name="tabs" type="radio"/>
<header class="h-10 flex items-center justify-between px-3 border-b border-border-dark bg-[#0d1117]">
<div class="flex items-center gap-2 overflow-hidden">
<span class="text-[10px] font-bold text-white/50 uppercase tracking-tighter">Project:</span>
<span class="truncate font-semibold text-white">backend-api-v2</span>
<span class="material-symbols-outlined text-[12px] text-white/30">expand_more</span>
</div>
<div class="flex items-center gap-2">
<span class="text-[10px] font-mono text-white/40">1,452 tokens</span>
<button class="size-6 flex items-center justify-center rounded hover:bg-white/10">
<span class="material-symbols-outlined text-[16px]">search</span>
</button>
</div>
</header>
<div class="tab-nav h-9 flex items-end px-3 gap-5 border-b border-border-dark bg-[#161b22] sticky top-0 z-20">
<label class="pb-2 text-[11px] font-medium text-white/50 hover:text-white cursor-pointer border-b-2 border-transparent transition-all" for="tab-files">Files</label>
<label class="pb-2 text-[11px] font-medium text-white/50 hover:text-white cursor-pointer border-b-2 border-transparent transition-all" for="tab-prompt">Prompt</label>
</div>
<div class="tab-content-files hidden flex-1 flex-col overflow-hidden bg-[#0d1117]">
<div class="h-8 flex items-center px-2 justify-between border-b border-border-dark bg-[#0d1117]">
<div class="flex items-center gap-1">
<button class="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">ALL</button>
<button class="px-2 py-0.5 rounded text-white/40 text-[10px] hover:bg-white/5">SRC</button>
<button class="px-2 py-0.5 rounded text-white/40 text-[10px] hover:bg-white/5">DOCS</button>
</div>
<div class="flex items-center gap-3">
<button class="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
<span>Name</span>
<span class="material-symbols-outlined text-[12px]">arrow_drop_down</span>
</button>
<button class="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
<span>Size</span>
<span class="material-symbols-outlined text-[12px]">unfold_more</span>
</button>
</div>
</div>
<div class="flex-1 overflow-y-auto custom-scrollbar">
<div class="directory-section">
<div class="directory-header">
<span class="material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer">expand_more</span>
<div class="w-5 flex justify-center mr-1">
<input class="custom-checkbox" type="checkbox"/>
</div>
<span class="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2">folder</span>
<span class="text-[10px] font-medium text-white/70 truncate">src/internal/api/auth</span>
</div>
<div class="pl-4">
<div class="compact-table-row">
<div class="w-5 flex justify-center mr-1">
<input checked="" class="custom-checkbox" type="checkbox"/>
</div>
<div class="flex-1 min-w-0 flex items-center gap-2">
<span class="material-symbols-outlined text-[13px] text-blue-400">description</span>
<span class="truncate text-white">auth_controller.go</span>
</div>
<div class="px-2">
<span class="text-[9px] font-mono text-white/30">4.2kb</span>
</div>
</div>
<div class="compact-table-row">
<div class="w-5 flex justify-center mr-1">
<input checked="" class="custom-checkbox" type="checkbox"/>
</div>
<div class="flex-1 min-w-0 flex items-center gap-2">
<span class="material-symbols-outlined text-[13px] text-blue-400">description</span>
<span class="truncate text-white">middleware.go</span>
</div>
<div class="px-2">
<span class="text-[9px] font-mono text-white/30">1.5kb</span>
</div>
</div>
</div>
</div>
<div class="directory-section">
<div class="directory-header">
<span class="material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer">expand_more</span>
<div class="w-5 flex justify-center mr-1">
<input class="custom-checkbox" type="checkbox"/>
</div>
<span class="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2">folder</span>
<span class="text-[10px] font-medium text-white/70 truncate">services/user</span>
</div>
<div class="pl-4">
<div class="compact-table-row">
<div class="w-5 flex justify-center mr-1">
<input checked="" class="custom-checkbox" type="checkbox"/>
</div>
<div class="flex-1 min-w-0 flex items-center gap-2">
<span class="material-symbols-outlined text-[13px] text-yellow-500">code</span>
<span class="truncate text-white">user_service.py</span>
</div>
<div class="px-2">
<span class="text-[9px] font-mono text-white/30">12kb</span>
</div>
</div>
</div>
</div>
<div class="directory-section">
<div class="directory-header">
<span class="material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer">expand_more</span>
<div class="w-5 flex justify-center mr-1">
<input class="custom-checkbox" type="checkbox"/>
</div>
<span class="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2">folder</span>
<span class="text-[10px] font-medium text-white/70 truncate">config/environments</span>
</div>
<div class="pl-4">
<div class="compact-table-row">
<div class="w-5 flex justify-center mr-1">
<input checked="" class="custom-checkbox" type="checkbox"/>
</div>
<div class="flex-1 min-w-0 flex items-center gap-2">
<span class="material-symbols-outlined text-[13px] text-green-400">data_object</span>
<span class="truncate text-white">config.json</span>
</div>
<div class="px-2">
<span class="text-[9px] font-mono text-white/30">2.4kb</span>
</div>
</div>
</div>
</div>
<div class="directory-section">
<div class="directory-header">
<span class="material-symbols-outlined text-[14px] text-white/20 mr-1 cursor-pointer">chevron_right</span>
<div class="w-5 flex justify-center mr-1">
<input class="custom-checkbox" type="checkbox"/>
</div>
<span class="material-symbols-outlined text-[14px] text-white/20 mr-2">folder_open</span>
<span class="text-[10px] font-medium text-white/40 truncate">root (collapsed)</span>
</div>
</div>
<div class="directory-section">
<div class="directory-header">
<span class="material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer">expand_more</span>
<div class="w-5 flex justify-center mr-1">
<input class="custom-checkbox" type="checkbox"/>
</div>
<span class="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2">folder</span>
<span class="text-[10px] font-medium text-white/70 truncate">ui/styles</span>
</div>
<div class="pl-4">
<div class="compact-table-row">
<div class="w-5 flex justify-center mr-1">
<input checked="" class="custom-checkbox" type="checkbox"/>
</div>
<div class="flex-1 min-w-0 flex items-center gap-2">
<span class="material-symbols-outlined text-[13px] text-blue-400">css</span>
<span class="truncate text-white">global.css</span>
</div>
<div class="px-2">
<span class="text-[9px] font-mono text-white/30">1.8kb</span>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="tab-content-prompt hidden flex-1 flex-col overflow-y-auto custom-scrollbar bg-[#0d1117] p-3 gap-4">
<div class="flex flex-col gap-2">
<label class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Custom Instructions</label>
<div class="relative">
<textarea class="w-full h-32 bg-[#161b22] border border-border-dark rounded-md p-3 text-white/90 placeholder-white/20 font-mono text-[11px] leading-relaxed resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="Describe how the context should be processed..."></textarea>
<div class="absolute bottom-2 right-2 flex gap-1">
<button class="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white" title="Insert Variable">
<span class="material-symbols-outlined text-[14px]">data_object</span>
</button>
</div>
</div>
</div>
<div class="flex flex-col gap-2">
<div class="flex items-center justify-between">
<label class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Templates</label>
<button class="text-[10px] text-primary hover:text-primary/80">Manage</button>
</div>
<div class="grid grid-cols-2 gap-2">
<button class="flex flex-col gap-1 p-2 rounded border border-border-dark bg-[#161b22]/50 hover:bg-[#161b22] hover:border-white/20 transition-all text-left group">
<div class="flex items-center gap-1.5 text-blue-400 group-hover:text-blue-300">
<span class="material-symbols-outlined text-[16px]">bug_report</span>
<span class="text-[10px] font-semibold">Find Bugs</span>
</div>
<p class="text-[9px] text-white/40 line-clamp-2">Analyze code for potential runtime errors and edge cases.</p>
</button>
<button class="flex flex-col gap-1 p-2 rounded border border-border-dark bg-[#161b22]/50 hover:bg-[#161b22] hover:border-white/20 transition-all text-left group">
<div class="flex items-center gap-1.5 text-green-400 group-hover:text-green-300">
<span class="material-symbols-outlined text-[16px]">architecture</span>
<span class="text-[10px] font-semibold">Refactor</span>
</div>
<p class="text-[9px] text-white/40 line-clamp-2">Suggest improvements for readability and performance.</p>
</button>
<button class="flex flex-col gap-1 p-2 rounded border border-border-dark bg-[#161b22]/50 hover:bg-[#161b22] hover:border-white/20 transition-all text-left group">
<div class="flex items-center gap-1.5 text-purple-400 group-hover:text-purple-300">
<span class="material-symbols-outlined text-[16px]">menu_book</span>
<span class="text-[10px] font-semibold">Explain Code</span>
</div>
<p class="text-[9px] text-white/40 line-clamp-2">Generate detailed documentation for selected functions.</p>
</button>
<button class="flex flex-col gap-1 p-2 rounded border border-border-dark bg-[#161b22]/50 hover:bg-[#161b22] hover:border-white/20 transition-all text-left group">
<div class="flex items-center gap-1.5 text-yellow-400 group-hover:text-yellow-300">
<span class="material-symbols-outlined text-[16px]">security</span>
<span class="text-[10px] font-semibold">Security Audit</span>
</div>
<p class="text-[9px] text-white/40 line-clamp-2">Check for common vulnerabilities and unsafe patterns.</p>
</button>
</div>
</div>
<div class="mt-2 p-2 rounded border border-dashed border-border-dark flex items-center justify-center gap-2 text-white/30 hover:text-white/50 hover:border-white/20 cursor-pointer transition-colors">
<span class="material-symbols-outlined text-[14px]">add_circle</span>
<span class="text-[10px]">Create New Template</span>
</div>
</div>
<footer class="p-2 border-t border-border-dark bg-[#0d1117] z-30">
<button class="w-full h-9 bg-primary hover:bg-primary/90 text-white font-bold rounded flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]">
<span class="material-symbols-outlined text-[16px]">content_copy</span>
<span class="text-[11px] uppercase tracking-wider">Copy Context</span>
</button>
<div class="mt-2 flex justify-between items-center px-1">
<div class="flex items-center gap-1.5">
<div class="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
<span class="text-[9px] font-medium text-white/40 uppercase">Ready to Paste</span>
</div>
<div class="text-[9px] text-white/20">v1.0.4-stable</div>
</div>
</footer>
</div>

</body></html>
```

## Key Requirements

1.  **Typography**: Use 'Inter', 'system-ui', 'sans-serif'. Base font size `11px`.
2.  **Colors**:
    *   Primary: `#3b82f6`
    *   Background Dark: `#0d1117`
    *   Card Dark: `#161b22`
    *   Border Dark: `#30363d`
3.  **Layout**:
    *   Left Sidebar (`w-10`, `bg-[#010409]`).
    *   Main Content Area with Tab Navigation (Files, Prompt).
    *   Sticky Header (`h-10`, `px-3`).
    *   Tab Navigation (`h-9`, `sticky top-0`).
    *   Footer with "Copy Context" button.
4.  **Files Tab**:
    *   Filter buttons (ALL, SRC, DOCS).
    *   Compact table rows for files.
    *   Path disambiguation (as per previous track requirements, but styled to match this new design).
5.  **Prompt Tab**:
    *   Custom Instructions text area.
    *   Templates grid (Find Bugs, Refactor, etc.).
6.  **Icons**: Use Google Material Symbols (`Material Symbols Outlined`).

