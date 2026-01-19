import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/event", () => ({
    listen: vi.fn(() => Promise.resolve(() => { })),
    emit: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("App Layout", () => {
    it("renders the sidebar and main content area", () => {
        const { container } = render(<App />);

        // Check for Sidebar (aside)
        const aside = container.querySelector("aside");
        expect(aside).toBeInTheDocument();
        expect(aside).toHaveClass("w-10");

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
