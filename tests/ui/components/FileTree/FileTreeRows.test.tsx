import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileTree } from "@/components/FileTree/FileTree";
import { mockInvoke } from "../../setup";

// Mock virtualizer to just render everything
vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: (options: any) => ({
        getVirtualItems: () => Array.from({ length: options.count }, (_, i) => ({
            index: i,
            key: i,
            start: i * 28,
            size: 28,
        })),
        getTotalSize: () => options.count * 28,
        measureElement: () => { },
    }),
}));

describe("FileTree Rows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders rows with Lucide icons", async () => {
        // Mock get_tree_roots to return a file and a folder
        mockInvoke.mockImplementation((cmd, args) => {
            if (cmd === 'get_children' && args?.parentPath === null) {
                return Promise.resolve([
                    { path: '/src', parent_path: null, name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
                    { path: '/main.ts', parent_path: null, name: 'main.ts', is_dir: false, size: 1024, mtime: null, token_count: null, fingerprint: null, child_count: null }
                ]);
            }
            return Promise.resolve([]);
        });

        render(<FileTree />);

        // Wait for rows to render
        const srcFolder = await screen.findByText("src");
        const mainFile = await screen.findByText("main.ts");

        expect(srcFolder).toBeInTheDocument();
        expect(mainFile).toBeInTheDocument();

        // Check for Lucide icons (folders)
        // Folders use "lucide-folder" class on the SVG
        const folderIcon = document.querySelector('.lucide-folder');
        expect(folderIcon).toBeInTheDocument();

        // Check for Lucide icons (files)
        // We can look for the file row and check its icon
        const fileRow = mainFile.closest('[role="treeitem"]');
        const fileIcon = fileRow?.querySelector('[data-testid="tree-icon"] svg');
        expect(fileIcon).toBeInTheDocument();
        expect(fileIcon?.getAttribute("class") || "").toContain("lucide-");

        // Check for chevron icon
        const chevron = document.querySelector('.lucide-chevron-right');
        expect(chevron).toBeInTheDocument();
    });
});
