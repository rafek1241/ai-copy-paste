import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

import { mockInvoke } from "./test/setup";

describe("App Layout", () => {
    it("renders the sidebar and main content area", async () => {
        mockInvoke.mockResolvedValue([]);
        const { container } = render(<App />);

        // Check for Sidebar (aside)
        const aside = container.querySelector("aside");
        expect(aside).toBeInTheDocument();
        expect(aside).toHaveClass("w-[42px]");

        // Check for main content container
        const mainContent = container.querySelector(".flex-1.flex.flex-col");
        expect(mainContent).toBeInTheDocument();

        // Check for Header
        const header = screen.getByRole("banner");
        expect(header).toBeInTheDocument();
        expect(header).toHaveClass("h-10");

        // Check for Tabs navigation labels
        expect(screen.getByText("Files")).toBeInTheDocument();
        expect(screen.getByText("Prompt")).toBeInTheDocument();

        // Check for Footer
        const footer = screen.getByRole("contentinfo");
        expect(footer).toBeInTheDocument();
    });
});
