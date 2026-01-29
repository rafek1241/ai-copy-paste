import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileTree } from "@/components/FileTree/FileTree";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: vi.fn(() => Promise.resolve(() => { })),
    emit: vi.fn(),
}));

describe("FileTree Filters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(invoke).mockImplementation((cmd) => {
            if (cmd === 'get_tree_roots') return Promise.resolve([]);
            return Promise.resolve([]);
        });
    });

    it("renders ALL, SRC, DOCS filter buttons", async () => {
        render(<FileTree />);
        
        // Wait for initial load to prevent act() warnings
        await waitFor(() => expect(invoke).toHaveBeenCalled());

        expect(screen.getByText("ALL")).toBeInTheDocument();
        expect(screen.getByText("SRC")).toBeInTheDocument();
        expect(screen.getByText("DOCS")).toBeInTheDocument();
    });

    it("toggles filter buttons when clicked", async () => {
        render(<FileTree />);

        // Wait for initial load
        await waitFor(() => expect(invoke).toHaveBeenCalled());

        const srcButton = screen.getByText("SRC");
        const allButton = screen.getByText("ALL");

        // Initially ALL should be active (uses bg-primary/20 for active state)
        expect(allButton).toHaveClass("bg-primary/20");

        fireEvent.click(srcButton);
        expect(srcButton).toHaveClass("bg-primary/20");
        expect(allButton).not.toHaveClass("bg-primary/20");
    });
});
