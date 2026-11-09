import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import RequestError from "./RequestError";

it("announces a safe message and retries only when requested", () => {
  const retry = vi.fn();
  render(<RequestError message={"Error\n at fn (/private/secret.js:1)"} onRetry={retry} />);
  expect(screen.getByRole("alert")).not.toHaveTextContent("secret");
  expect(retry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});