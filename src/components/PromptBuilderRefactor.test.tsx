import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptBuilder } from "./PromptBuilder";
import { mockInvoke } from "../test/setup";

describe("PromptBuilder Refactor", () => {
    beforeEach(() => {
        mockInvoke.mockClear();
    });

    it("renders custom instructions textarea with new styling", () => {
        mockInvoke.mockResolvedValue([]); // Default for any calls
        render(<PromptBuilder selectedFileIds={[1]} />);

        const textarea = screen.getByTestId("custom-instructions");
        expect(textarea).toHaveClass("bg-white/5");
        expect(textarea).toHaveClass("border-white/10");
    });

    it("renders templates in a 2x2 grid", async () => {
        // Mock get_templates
        mockInvoke.mockImplementation((cmd) => {
            if (cmd === 'get_templates') {
                return Promise.resolve([
                    { id: 'agent', name: 'AI Agent', description: 'desc' },
                    { id: 'refactor', name: 'Refactor', description: 'desc' },
                    { id: 'test', name: 'Test Generation', description: 'desc' },
                    { id: 'explain', name: 'Code Explanation', description: 'desc' }
                ]);
            }
            return Promise.resolve([]);
        });

        render(<PromptBuilder selectedFileIds={[1]} />);

        // Wait for templates to load
        const templateGrid = await screen.findByTestId("templates-grid");
        expect(templateGrid).toHaveClass("grid-cols-2");

        expect(screen.getByText("AI Agent")).toBeInTheDocument();
        expect(screen.getByText("Refactor")).toBeInTheDocument();
        expect(screen.getByText("Test Generation")).toBeInTheDocument();
        expect(screen.getByText("Code Explanation")).toBeInTheDocument();
    });
});
