import { describe, expect, it } from "vitest";
import { cleanProfile } from "./profile";

describe("employee card", () => {
  it("keeps a filled card and drops an empty one", () => {
    expect(
      cleanProfile({
        nationalId: " 123456782 ",
        birthDate: "1990-04-02",
        gender: "female",
        city: "חיפה",
        maritalStatus: "married",
        startedOn: "2024-02-31",
        employeeNumber: " 1042 ",
        bankAccount: "123456",
      }),
    ).toEqual({
      nationalId: "123456782",
      birthDate: "1990-04-02",
      gender: "female",
      mobile: "",
      city: "חיפה",
      street: "",
      houseNumber: "",
      zip: "",
      startedOn: "",
      endedOn: "",
      employeeNumber: "1042",
      department: "",
      maritalStatus: "married",
      bankName: "",
      bankBranch: "",
      bankAccount: "123456",
    });
    expect(cleanProfile({ gender: "other", birthDate: "nope" })).toBeUndefined();
    expect(cleanProfile(null)).toBeUndefined();
  });
});
