#!/bin/bash

# AI Context Collector - Linux Installer Script
# Installs context menu integration for various Linux file managers

set -e

echo "============================================"
echo "AI Context Collector - Linux Installer"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ai-context-collector"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Function to detect desktop environment
detect_desktop_environment() {
    if [ "$XDG_CURRENT_DESKTOP" != "" ]; then
        echo "$XDG_CURRENT_DESKTOP" | tr '[:upper:]' '[:lower:]'
    elif [ "$DESKTOP_SESSION" != "" ]; then
        echo "$DESKTOP_SESSION" | tr '[:upper:]' '[:lower:]'
    elif [ "$(command -v gnome-shell)" ]; then
        echo "gnome"
    elif [ "$(command -v plasma-desktop)" ]; then
        echo "kde"
    elif [ "$(command -v cinnamon)" ]; then
        echo "cinnamon"
    else
        echo "unknown"
    fi
}

# Function to check if application is installed
check_app_installed() {
    if command -v "$APP_NAME" &> /dev/null; then
        APP_PATH=$(which "$APP_NAME")
        print_success "Found $APP_NAME at: $APP_PATH"
        return 0
    else
        print_error "$APP_NAME not found in PATH"
        print_info "Please install the application first or add it to PATH"
        return 1
    fi
}

# Function to install Nautilus extension (GNOME Files)
install_nautilus_extension() {
    print_info "Installing Nautilus extension..."
    
    # Check if Nautilus is installed
    if ! command -v nautilus &> /dev/null; then
        print_info "Nautilus not found, skipping..."
        return
    fi
    
    # Determine Nautilus version
    NAUTILUS_VERSION=$(nautilus --version | grep -oP '\d+\.\d+' | cut -d. -f1)
    
    # Check for python-nautilus package
    if ! python3 -c "import gi; gi.require_version('Nautilus', '4.0')" 2>/dev/null && \
       ! python3 -c "import gi; gi.require_version('Nautilus', '3.0')" 2>/dev/null; then
        print_error "python-nautilus not installed"
        print_info "Install with: sudo apt install python3-nautilus  # Debian/Ubuntu"
        print_info "         or: sudo dnf install nautilus-python  # Fedora"
        print_info "         or: sudo pacman -S python-nautilus  # Arch"
        return 1
    fi
    
    # Create extension directory
    EXT_DIR="$HOME/.local/share/nautilus-python/extensions"
    mkdir -p "$EXT_DIR"
    
    # Copy extension file
    cp "$SCRIPT_DIR/nautilus-extension.py" "$EXT_DIR/ai-context-collector.py"
    chmod +x "$EXT_DIR/ai-context-collector.py"
    
    print_success "Nautilus extension installed"
    print_info "Restart Nautilus: nautilus -q && nautilus &"
}

# Function to install Dolphin service menu (KDE)
install_dolphin_menu() {
    print_info "Installing Dolphin service menu..."
    
    # Check if Dolphin is installed
    if ! command -v dolphin &> /dev/null; then
        print_info "Dolphin not found, skipping..."
        return
    fi
    
    # Create service menu directory
    MENU_DIR="$HOME/.local/share/kservices5/ServiceMenus"
    if [ ! -d "$MENU_DIR" ]; then
        # Try KDE 6 location
        MENU_DIR="$HOME/.local/share/kio/servicemenus"
    fi
    mkdir -p "$MENU_DIR"
    
    # Copy service menu file
    cp "$SCRIPT_DIR/dolphin.desktop" "$MENU_DIR/ai-context-collector.desktop"
    
    print_success "Dolphin service menu installed"
}

# Function to install Nemo action (Cinnamon)
install_nemo_action() {
    print_info "Installing Nemo action..."
    
    # Check if Nemo is installed
    if ! command -v nemo &> /dev/null; then
        print_info "Nemo not found, skipping..."
        return
    fi
    
    # Create action directory
    ACTION_DIR="$HOME/.local/share/nemo/actions"
    mkdir -p "$ACTION_DIR"
    
    # Copy action file
    cp "$SCRIPT_DIR/nemo.nemo_action" "$ACTION_DIR/ai-context-collector.nemo_action"
    
    print_success "Nemo action installed"
}

# Function to install for all supported file managers
install_all() {
    install_nautilus_extension
    install_dolphin_menu
    install_nemo_action
}

# Function to uninstall
uninstall() {
    print_info "Uninstalling AI Context Collector integrations..."
    
    # Remove Nautilus extension
    rm -f "$HOME/.local/share/nautilus-python/extensions/ai-context-collector.py"
    print_success "Removed Nautilus extension"
    
    # Remove Dolphin service menu
    rm -f "$HOME/.local/share/kservices5/ServiceMenus/ai-context-collector.desktop"
    rm -f "$HOME/.local/share/kio/servicemenus/ai-context-collector.desktop"
    print_success "Removed Dolphin service menu"
    
    # Remove Nemo action
    rm -f "$HOME/.local/share/nemo/actions/ai-context-collector.nemo_action"
    print_success "Removed Nemo action"
    
    echo ""
    print_success "Uninstallation complete"
    print_info "You may need to restart your file manager"
}

# Main installation logic
main() {
    echo "Detected desktop environment: $(detect_desktop_environment)"
    echo ""
    
    # Check if app is installed
    if ! check_app_installed; then
        echo ""
        print_error "Installation aborted"
        exit 1
    fi
    
    echo ""
    
    # Parse command line arguments
    case "${1:-auto}" in
        nautilus)
            install_nautilus_extension
            ;;
        dolphin)
            install_dolphin_menu
            ;;
        nemo)
            install_nemo_action
            ;;
        all)
            install_all
            ;;
        uninstall)
            uninstall
            exit 0
            ;;
        auto)
            # Auto-detect and install for current desktop environment
            DE=$(detect_desktop_environment)
            case "$DE" in
                *gnome*|*ubuntu*)
                    install_nautilus_extension
                    ;;
                *kde*|*plasma*)
                    install_dolphin_menu
                    ;;
                *cinnamon*)
                    install_nemo_action
                    ;;
                *)
                    print_info "Could not auto-detect desktop environment"
                    print_info "Installing for all supported file managers..."
                    install_all
                    ;;
            esac
            ;;
        *)
            echo "Usage: $0 [nautilus|dolphin|nemo|all|auto|uninstall]"
            echo ""
            echo "  nautilus   - Install for GNOME Files (Nautilus)"
            echo "  dolphin    - Install for KDE Dolphin"
            echo "  nemo       - Install for Cinnamon Nemo"
            echo "  all        - Install for all supported file managers"
            echo "  auto       - Auto-detect and install (default)"
            echo "  uninstall  - Remove all integrations"
            echo ""
            exit 1
            ;;
    esac
    
    echo ""
    echo "============================================"
    print_success "Installation complete!"
    echo "============================================"
    echo ""
    echo "Next steps:"
    echo "1. Restart your file manager"
    echo "2. Right-click on a file or folder"
    echo "3. Look for 'Send to AI Context Collector'"
    echo ""
}

# Run main function
main "$@"
