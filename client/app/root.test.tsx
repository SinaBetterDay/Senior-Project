import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ErrorBoundary } from "./root";

it("never renders exception messages or stacks", () => {
  const error = new Error("Secret database details");
  error.stack = "Error at /private/server.ts:42";
  render(<ErrorBoundary error={error} params={{}} />);
  expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("Secret");
  expect(document.body).not.toHaveTextContent("/private");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});