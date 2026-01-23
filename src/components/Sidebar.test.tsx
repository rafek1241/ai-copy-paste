import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
    it("renders core navigation icons", () => {
        render(<Sidebar />);

        expect(screen.getByText("terminal")).toBeInTheDocument();
        expect(screen.getByText("folder")).toBeInTheDocument();
        expect(screen.getByText("list_alt")).toBeInTheDocument(); // Prompt icon
        expect(screen.getByText("history")).toBeInTheDocument();
        expect(screen.getByText("settings")).toBeInTheDocument();
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
