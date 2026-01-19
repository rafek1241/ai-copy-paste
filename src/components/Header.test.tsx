import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Header from "./Header";

describe("Header", () => {
    it("renders project name and token count correctly", () => {
        render(<Header projectName="my-cool-project" tokenCount={1337} />);

        // Check Project Name
        expect(screen.getByText("my-cool-project")).toBeInTheDocument();

        // Check Token Count
        expect(screen.getByText("1,337 tokens")).toBeInTheDocument();

        // Check icons
        expect(screen.getByText("expand_more")).toBeInTheDocument();
        expect(screen.getByText("search")).toBeInTheDocument();
    });
});
