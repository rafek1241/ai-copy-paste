import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
    it("renders core navigation icons", () => {
        render(<Sidebar />);

        expect(screen.getByText("terminal")).toBeInTheDocument();
        expect(screen.getByText("folder")).toBeInTheDocument();
        expect(screen.getByText("auto_awesome")).toBeInTheDocument();
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

    it("expands on hover", () => {
        render(<Sidebar />);
        const sidebar = screen.getByTestId("sidebar");

        expect(sidebar).toHaveClass("w-[42px]");

        fireEvent.mouseEnter(sidebar);
        expect(sidebar).toHaveClass("w-48");

        fireEvent.mouseLeave(sidebar);
        expect(sidebar).toHaveClass("w-[42px]");
    });
});
