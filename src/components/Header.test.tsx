import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Header from "./Header";

describe("Header", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

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

    describe("Search Tooltip", () => {
        it("shows tooltip when search input is empty", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Tooltip should be visible when search is empty
            expect(screen.getByTestId("search-tooltip")).toBeInTheDocument();
            expect(screen.getByText(/Advanced search:/)).toBeInTheDocument();
        });

        it("hides tooltip when user starts typing", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Type in search input
            const input = screen.getByTestId("file-tree-search");
            fireEvent.change(input, { target: { value: "test" } });

            // Tooltip should be hidden
            expect(screen.queryByTestId("search-tooltip")).not.toBeInTheDocument();
        });

        it("shows tooltip again after clearing search", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Type in search input
            const input = screen.getByTestId("file-tree-search");
            fireEvent.change(input, { target: { value: "test" } });

            // Clear search
            fireEvent.click(screen.getByTestId("clear-search-btn"));

            // Tooltip should be visible again
            expect(screen.getByTestId("search-tooltip")).toBeInTheDocument();
        });
    });

    describe("Enter Key Behavior", () => {
        it("blurs input when Enter key is pressed", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Get the input and type something
            const input = screen.getByTestId("file-tree-search");
            fireEvent.change(input, { target: { value: "test" } });

            // Verify input has focus initially (after expansion)
            expect(input).toHaveFocus();

            // Press Enter
            fireEvent.keyDown(input, { key: "Enter" });

            // Input should lose focus
            expect(input).not.toHaveFocus();
        });

        it("keeps search query visible after Enter", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Get the input and type something
            const input = screen.getByTestId("file-tree-search");
            fireEvent.change(input, { target: { value: "file:App" } });

            // Press Enter
            fireEvent.keyDown(input, { key: "Enter" });

            // Search query should still be visible
            expect(input).toHaveValue("file:App");
            // Search input should still be expanded (because there's a query)
            expect(screen.getByTestId("file-tree-search")).toBeInTheDocument();
        });
    });

    describe("Search Callback", () => {
        it("calls onSearch with the current query", () => {
            const onSearch = vi.fn();
            render(<Header onSearch={onSearch} />);

            // Click search toggle to expand
            fireEvent.click(screen.getByTestId("search-toggle-btn"));

            // Type in search input
            const input = screen.getByTestId("file-tree-search");
            fireEvent.change(input, { target: { value: "file:App dir:src" } });

            // Should call onSearch with the query
            expect(onSearch).toHaveBeenCalledWith("file:App dir:src");
        });
    });
});
