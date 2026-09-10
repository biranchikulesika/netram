import type { UUID } from "./common.js";

export interface Country {
  id: UUID;
  code: string;
  name: string;
}

export interface State {
  id: UUID;
  countryId: UUID;
  code: string;
  name: string;
}

export interface District {
  id: UUID;
  stateId: UUID;
  code: string;
  name: string;
}

export interface GeographyRef {
  countryId: UUID;
  stateId: UUID;
  districtId: UUID;
}
