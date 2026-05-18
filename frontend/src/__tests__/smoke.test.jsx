import "./setup.js";
import { test, expect } from "bun:test";

test("smoke test - test runner works", () => {
  expect(1 + 1).toBe(2);
});
