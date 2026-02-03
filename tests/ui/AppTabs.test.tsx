import { screen, fireEvent } from "@testing-library/react";
import { render } from "./test-utils";
import { describe, it, expect } from "vitest";
import App from "@/App";

import { mockInvoke } from "./setup";

describe("App Tab Switching", () => {
    it("switches between Files and Prompt tabs", async () => {
        mockInvoke.mockImplementation((cmd) => {
            if (cmd === 'get_tree_roots') return Promise.resolve([]);
            if (cmd === 'get_children') return Promise.resolve([]);
            if (cmd === 'get_templates') return Promise.resolve([]);
            return Promise.resolve([]);
        });
        render(<App />);

        // Initially Files tab should be active
        expect(screen.getByText("Files")).toHaveClass("text-white");
        
        // Both components should be in document but one hidden
        expect(screen.getByTestId("file-tree-container").parentElement).not.toHaveClass("hidden");
        expect(screen.getByTestId("prompt-builder").parentElement).toHaveClass("hidden");

        // Click Prompt tab
        fireEvent.click(screen.getByText("Prompt"));

        // Prompt tab should be active
        expect(screen.getByText("Prompt")).toHaveClass("text-white");
        expect(screen.getByText("Files")).not.toHaveClass("text-white");

        // Verify visibilities flipped
        expect(screen.getByTestId("file-tree-container").parentElement).toHaveClass("hidden");
        expect(screen.getByTestId("prompt-builder").parentElement).not.toHaveClass("hidden");
    });
});
