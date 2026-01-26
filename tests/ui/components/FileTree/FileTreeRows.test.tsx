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

    it("renders rows with Material Symbols icons", async () => {
        // Mock get_tree_roots to return a file and a folder
        mockInvoke.mockImplementation((cmd) => {
            if (cmd === 'get_tree_roots') {
                return Promise.resolve([
                    { id: 1, name: 'src', path: '/src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null },
                    { id: 2, name: 'main.ts', path: '/src/main.ts', is_dir: false, size: 1024, mtime: null, token_count: null, fingerprint: null }
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

        // Check for Material Symbols icons
        // Folders use "folder" icon
        expect(screen.getByText("folder")).toHaveClass("material-symbols-outlined");

        // .ts files use "terminal" icon (my implementation choice)
        expect(screen.getByText("terminal")).toHaveClass("material-symbols-outlined");

        // Check for chevron icon (there are multiple - one visible for folder, one invisible for file alignment)
        const chevrons = screen.getAllByText("chevron_right");
        expect(chevrons[0]).toHaveClass("material-symbols-outlined");
    });
});
