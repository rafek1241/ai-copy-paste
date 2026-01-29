import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "@/components/Sidebar";

describe("Sidebar", () => {
    it("renders core navigation icons", () => {
        render(<Sidebar />);

        // Check for navigation buttons by testid since they use icon components
        expect(screen.getByTestId("nav-files")).toBeInTheDocument();
        expect(screen.getByTestId("nav-prompt")).toBeInTheDocument();
        expect(screen.getByTestId("nav-history")).toBeInTheDocument();
        expect(screen.getByTestId("nav-settings")).toBeInTheDocument();
    });

    it("handles tab switching", () => {
        const onTabChange = vi.fn();
        render(<Sidebar onTabChange={onTabChange} activeTab="files" />);

        const promptBtn = screen.getByTestId("nav-prompt");
        fireEvent.click(promptBtn);

        expect(onTabChange).toHaveBeenCalledWith("prompt");
    });

    it("renders with correct width class", () => {
        render(<Sidebar />);
        const sidebar = screen.getByTestId("sidebar");

        expect(sidebar).toHaveClass("w-10");
    });

    it("highlights active tab", () => {
        render(<Sidebar activeTab="history" />);
        const historyBtn = screen.getByTestId("nav-history");

        expect(historyBtn).toHaveClass("text-white");
    });
});
