#!/usr/bin/env python3
"""
AI Context Collector - Nautilus Extension
Adds context menu integration for GNOME's Nautilus file manager
"""

import os
import subprocess
from gi import require_version
require_version('Nautilus', '4.0')
from gi.repository import Nautilus, GObject

class AIContextCollectorExtension(GObject.GObject, Nautilus.MenuProvider):
    """Nautilus extension for AI Context Collector integration"""
    
    def __init__(self):
        super().__init__()
        self.app_path = self._find_app_path()
    
    def _find_app_path(self):
        """Find the AI Context Collector executable"""
        # Common installation paths
        possible_paths = [
            '/usr/bin/ai-context-collector',
            '/usr/local/bin/ai-context-collector',
            os.path.expanduser('~/.local/bin/ai-context-collector'),
            '/opt/ai-context-collector/ai-context-collector',
        ]
        
        # Check PATH
        which_result = subprocess.run(
            ['which', 'ai-context-collector'],
            capture_output=True,
            text=True
        )
        if which_result.returncode == 0:
            return which_result.stdout.strip()
        
        # Check common paths
        for path in possible_paths:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
        
        return None
    
    def get_file_items(self, *args):
        """Return menu items for file/folder context menu"""
        # Handle both Nautilus 3.x and 4.x API
        if len(args) == 2:
            # Nautilus 3.x: (window, files)
            files = args[1]
        else:
            # Nautilus 4.x: (files,)
            files = args[0]
        
        if not files:
            return []
        
        if not self.app_path:
            return []
        
        # Create menu item
        item = Nautilus.MenuItem(
            name='AIContextCollector::SendTo',
            label='Send to AI Context Collector',
            tip='Open selected files/folders in AI Context Collector',
            icon='document-send'
        )
        
        item.connect('activate', self._on_menu_activate, files)
        
        return [item]
    
    def get_background_items(self, *args):
        """Return menu items for folder background context menu"""
        # Handle both Nautilus 3.x and 4.x API
        if len(args) == 2:
            # Nautilus 3.x: (window, file)
            current_folder = args[1]
        else:
            # Nautilus 4.x: (file,)
            current_folder = args[0]
        
        if not current_folder:
            return []
        
        if not self.app_path:
            return []
        
        # Create menu item
        item = Nautilus.MenuItem(
            name='AIContextCollector::SendToBackground',
            label='Send Current Folder to AI Context Collector',
            tip='Open current folder in AI Context Collector',
            icon='folder-open'
        )
        
        item.connect('activate', self._on_menu_activate, [current_folder])
        
        return [item]
    
    def _on_menu_activate(self, menu, files):
        """Handle menu item activation"""
        if not files:
            return
        
        # Get file paths
        paths = []
        for file_info in files:
            # Handle both URI and path
            uri = file_info.get_uri()
            if uri.startswith('file://'):
                path = uri[7:]  # Remove 'file://' prefix
                paths.append(path)
        
        if not paths:
            return
        
        # Launch the application with file paths
        try:
            cmd = [self.app_path] + paths
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
        except Exception as e:
            print(f"Error launching AI Context Collector: {e}")
