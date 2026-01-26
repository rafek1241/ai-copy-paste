import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Header from "@/components/Header";

describe("Header", () => {
    it("renders header with controls", () => {
        const onSearch = vi.fn();
        render(<Header onSearch={onSearch} />);

        // Check header exists
        expect(screen.getByTestId("app-header")).toBeInTheDocument();

        // Check Add Context button
        expect(screen.getByTestId("add-folder-btn")).toBeInTheDocument();
        expect(screen.getByText("Add Context")).toBeInTheDocument();

        // Check Clear button
        expect(screen.getByTestId("clear-context-btn")).toBeInTheDocument();
        expect(screen.getByText("Clear")).toBeInTheDocument();

        // Check search toggle button
        expect(screen.getByTestId("search-toggle-btn")).toBeInTheDocument();
    });

    it("calls onAddFolder when Add Context button is clicked", () => {
        const onAddFolder = vi.fn();
        const onSearch = vi.fn();
        render(<Header onAddFolder={onAddFolder} onSearch={onSearch} />);

        fireEvent.click(screen.getByTestId("add-folder-btn"));
        expect(onAddFolder).toHaveBeenCalled();
    });

    it("calls onClear when Clear button is clicked", () => {
        const onClear = vi.fn();
        const onSearch = vi.fn();
        render(<Header onClear={onClear} onSearch={onSearch} />);

        fireEvent.click(screen.getByTestId("clear-context-btn"));
        expect(onClear).toHaveBeenCalled();
    });

    it("expands search input when search button is clicked", () => {
        const onSearch = vi.fn();
        render(<Header onSearch={onSearch} />);

        // Initially search input should not be visible
        expect(screen.queryByTestId("file-tree-search")).not.toBeInTheDocument();

        // Click search toggle
        fireEvent.click(screen.getByTestId("search-toggle-btn"));

        // Now search input should be visible
        expect(screen.getByTestId("file-tree-search")).toBeInTheDocument();
    });
});
