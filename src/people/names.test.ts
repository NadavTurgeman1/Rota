import { describe, expect, it } from "vitest";
import { filterNames } from "./names";

describe("name search", () => {
  const people = [{ name: "דנה" }, { name: "דוד" }, { name: "יוסי" }, { name: "Dana" }];

  it("narrows the list with each added letter", () => {
    expect(filterNames(people, "").map((person) => person.name)).toEqual(["דנה", "דוד", "יוסי", "Dana"]);
    expect(filterNames(people, "ד").map((person) => person.name)).toEqual(["דנה", "דוד"]);
    expect(filterNames(people, "דנ").map((person) => person.name)).toEqual(["דנה"]);
    expect(filterNames(people, "דנה").map((person) => person.name)).toEqual(["דנה"]);
    expect(filterNames(people, "דנק")).toEqual([]);
    expect(filterNames(people, "da").map((person) => person.name)).toEqual(["Dana"]);
    expect(filterNames(people, "  דנ  ").map((person) => person.name)).toEqual(["דנה"]);
  });
});
