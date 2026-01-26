import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Footer from "@/components/Footer";

describe("Footer", () => {
    it("renders Copy Context button and token info", () => {
        const onCopy = vi.fn();
        render(<Footer onCopy={onCopy} tokenCount={1000} tokenLimit={10000} version="0.1.0" />);

        const copyButton = screen.getByText("Copy Context");
        expect(copyButton).toBeInTheDocument();

        // Check for icon
        expect(screen.getByText("content_copy")).toBeInTheDocument();

        // Check for token count display
        expect(screen.getByText("1,000 / 10,000 tokens")).toBeInTheDocument();

        // Check for version with 'v' prefix
        expect(screen.getByText("v0.1.0")).toBeInTheDocument();

        // Check click
        fireEvent.click(copyButton);
        expect(onCopy).toHaveBeenCalled();
    });

    it("shows green indicator when under 80% token usage", () => {
        const onCopy = vi.fn();
        const { container } = render(<Footer onCopy={onCopy} tokenCount={5000} tokenLimit={10000} version="0.1.0" />);

        const indicator = container.querySelector(".bg-green-500");
        expect(indicator).toBeInTheDocument();
    });

    it("shows orange indicator when at 80-99% token usage", () => {
        const onCopy = vi.fn();
        const { container } = render(<Footer onCopy={onCopy} tokenCount={8500} tokenLimit={10000} version="0.1.0" />);

        const indicator = container.querySelector(".bg-orange-500");
        expect(indicator).toBeInTheDocument();
    });

    it("shows red indicator when at or over 100% token usage", () => {
        const onCopy = vi.fn();
        const { container } = render(<Footer onCopy={onCopy} tokenCount={10000} tokenLimit={10000} version="0.1.0" />);

        const indicator = container.querySelector(".bg-red-500");
        expect(indicator).toBeInTheDocument();
    });
});
