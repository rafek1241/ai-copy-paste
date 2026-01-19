import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
    it("renders correctly with specified icons and structure", () => {
        const { container } = render(<Sidebar />);

        // Check main container
        const aside = container.querySelector("aside");
        expect(aside).toBeInTheDocument();
        expect(aside).toHaveClass("w-10");
        expect(aside).toHaveClass("bg-[#010409]");

        // Check icons (Material Symbols)
        const terminalIcon = screen.getByText("terminal");
        const folderIcon = screen.getByText("folder");
        const listIcon = screen.getByText("list_alt");
        const historyIcon = screen.getByText("history");
        const settingsIcon = screen.getByText("settings");

        expect(terminalIcon).toBeInTheDocument();
        expect(folderIcon).toBeInTheDocument();
        expect(listIcon).toBeInTheDocument();
        expect(historyIcon).toBeInTheDocument();
        expect(settingsIcon).toBeInTheDocument();

        // Check if terminal icon is in a primary colored div
        expect(terminalIcon.closest("div")).toHaveClass("text-primary");
    });
});
