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

/** Sub-district unit (tehsil/block). Needed for village-based audit targets. */
export interface Block {
  id: UUID;
  districtId: UUID;
  code: string;
  name: string;
}

/** Gram Panchayat under a block. */
export interface GramPanchayat {
  id: UUID;
  blockId: UUID;
  code: string;
  name: string;
}

/** Revenue village under a gram panchayat. */
export interface Village {
  id: UUID;
  gramPanchayatId: UUID;
  code: string;
  name: string;
}

export interface GeographyRef {
  countryId: UUID;
  stateId: UUID;
  districtId: UUID;
}
