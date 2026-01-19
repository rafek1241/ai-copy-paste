import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
    it("renders Copy Context button and status indicators", () => {
        const onCopy = vi.fn();
        render(<Footer onCopy={onCopy} status="ready" version="0.1.0" />);

        const copyButton = screen.getByText("Copy Context");
        expect(copyButton).toBeInTheDocument();

        // Check for icon
        expect(screen.getByText("content_copy")).toBeInTheDocument();

        // Check for status indicator
        expect(screen.getByText("Ready to Paste")).toBeInTheDocument();

        // Check for version
        expect(screen.getByText("v0.1.0")).toBeInTheDocument();

        // Check click
        fireEvent.click(copyButton);
        expect(onCopy).toHaveBeenCalled();
    });
});
