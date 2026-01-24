import { screen, fireEvent } from "@testing-library/react";
import { render } from "./test/test-utils";
import { describe, it, expect } from "vitest";
import App from "./App";

import { mockInvoke } from "./test/setup";

describe("App Tab Switching", () => {
    it("switches between Files and Prompt tabs", async () => {
        mockInvoke.mockResolvedValue([]);
        render(<App />);

        // Initially Files tab should be active and FileTree should be visible
        expect(screen.getByText("Files")).toHaveClass("text-white");
        expect(screen.queryByTestId("prompt-builder")).not.toBeInTheDocument();

        // Click Prompt tab
        fireEvent.click(screen.getByText("Prompt"));

        // Prompt tab should be active
        expect(screen.getByText("Prompt")).toHaveClass("text-white");
        expect(screen.getByText("Files")).not.toHaveClass("text-white");

        // Verify PromptBuilder is visible
        expect(screen.getByTestId("prompt-builder")).toBeInTheDocument();
    });
});
