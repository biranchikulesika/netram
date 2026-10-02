import { describe, expect, it } from "vitest";
import { formatDistrict, getAuthorityName, getOrganisationName } from "./presentation";

describe("getOrganisationName", () => {
  it("uses the name joined by the API", () => {
    expect(getOrganisationName("Nilachal Seva Pratisthan")).toBe("Nilachal Seva Pratisthan");
  });

  it("does not invent a committee name when no organisation is assigned", () => {
    // Village-type targets legitimately have no implementing organisation.
    expect(getOrganisationName(null)).toBe("No managing organisation");
  });
});

describe("getAuthorityName", () => {
  it("uses the name joined by the API", () => {
    expect(
      getAuthorityName(
        "bbbbbbbb-0000-4000-8000-000000000002",
        "District Social Welfare Office, Cuttack",
      ),
    ).toBe("District Social Welfare Office, Cuttack");
  });

  it("does not default an unassigned authority to a department", () => {
    expect(getAuthorityName(null, null)).toBe("No authority assigned");
  });

  it("still labels an authority id whose name was not resolved", () => {
    expect(getAuthorityName("bbbbbbbb-0000-4000-8000-000000000002", null)).toBe(
      "Assigned authority",
    );
  });
});

describe("formatDistrict", () => {
  it("composes district and state from the joined names", () => {
    expect(formatDistrict("Khordha", "Odisha")).toBe("Khordha, Odisha");
  });

  it("omits the state when only a district name was joined", () => {
    // Inspections and complaints resolve their district through their project.
    expect(formatDistrict("Khordha", null)).toBe("Khordha");
  });

  it("does not guess a district when none was resolved", () => {
    expect(formatDistrict(null, null)).toBe("Unknown district");
  });
});
