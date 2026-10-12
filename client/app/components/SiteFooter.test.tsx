import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

it("preserves the brand and destination links in the shared-width footer", () => {
  render(<MemoryRouter><SiteFooter /></MemoryRouter>);
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Financial Accountability & Interest Review");
  for (const [name, href] of [["Conflict flags", "/conflicts"], ["Public officials", "/politicians"], ["About", "/about"], ["Admin", "/admin/login"]]) {
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  }
});