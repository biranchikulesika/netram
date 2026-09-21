"use client";

import { useState } from "react";
import type { DistrictView, JurisdictionView, StateView } from "@netram/types";
import {
  FormShell,
  InspectorForm,
  OfficialForm,
  OrganisationForm,
  ProgrammeForm,
  SuccessPanel,
} from "./form-views";

interface Success {
  title: string;
  message: string;
}

/**
 * Each registration page body owns the success state: the form renders until
 * submit succeeds, then the shell swaps to a SuccessPanel. "Register another"
 * resets to a fresh form.
 */

/* ---------------- Agency ---------------- */

export function AgencyFormBody({ districts }: { districts: DistrictView[] }) {
  const [success, setSuccess] = useState<Success | null>(null);

  if (success) {
    return (
      <SuccessPanel
        title={success.title}
        message={success.message}
        onAnother={() => setSuccess(null)}
        anotherLabel="Register another agency"
        backHref="/registry"
      />
    );
  }

  return (
    <FormShell
      kind="Agency / Society"
      title="Register an agency"
      description="Register the operating agency or society that runs facilities on the ground."
      backHref="/registry"
      aside={<AgencyAside />}
    >
      <OrganisationForm
        districts={districts}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
  );
}

function AgencyAside() {
  return (
    <div className="reg-summary">
      <div className="reg-summary-title">Before you register</div>
      <ul className="reg-aside-list">
        <li>The code is the agency's permanent registry identifier.</li>
        <li>Category reflects the legal form of the society or trust.</li>
        <li>Home district is optional — only for locally operating agencies.</li>
      </ul>
      <div className="registry-form-note">
        Agencies go live immediately. Facilities are linked to an agency when the
        facility is registered.
      </div>
    </div>
  );
}

/* ---------------- Scheme ---------------- */

export function SchemeFormBody({
  states,
  districts,
}: {
  states: StateView[];
  districts: DistrictView[];
}) {
  const [success, setSuccess] = useState<Success | null>(null);

  if (success) {
    return (
      <SuccessPanel
        title={success.title}
        message={success.message}
        onAnother={() => setSuccess(null)}
        anotherLabel="Register another scheme"
        backHref="/registry"
      />
    );
  }

  return (
    <FormShell
      kind="Scheme / Programme"
      title="Register a scheme"
      description="Register a welfare scheme or programme that facilities participate in."
      backHref="/registry"
      aside={<SchemeAside />}
    >
      <ProgrammeForm
        states={states}
        districts={districts}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
  );
}

function SchemeAside() {
  return (
    <div className="reg-summary">
      <div className="reg-summary-title">Scheme scope</div>
      <ul className="reg-aside-list">
        <li><strong>National</strong> — any facility may link the scheme.</li>
        <li><strong>State</strong> — only facilities inside the chosen state.</li>
        <li><strong>District</strong> — only facilities in that district.</li>
      </ul>
      <div className="registry-form-note">
        Scope is enforced server-side at link time: a facility outside the
        scheme's territory cannot participate.
      </div>
    </div>
  );
}

/* ---------------- Inspector ---------------- */

export function InspectorFormBody({ jurisdictions }: { jurisdictions: JurisdictionView[] }) {
  const [success, setSuccess] = useState<Success | null>(null);

  if (success) {
    return (
      <SuccessPanel
        title={success.title}
        message={success.message}
        onAnother={() => setSuccess(null)}
        anotherLabel="Invite another inspector"
        backHref="/registry"
      />
    );
  }

  return (
    <FormShell
      kind="Inspector"
      title="Invite an inspector"
      description="Create a field inspector account and assign their operating jurisdiction."
      backHref="/registry"
      aside={<InspectorAside />}
    >
      <InspectorForm
        jurisdictions={jurisdictions}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
  );
}

function InspectorAside() {
  return (
    <div className="reg-summary">
      <div className="reg-summary-title">What happens next</div>
      <ul className="reg-aside-list">
        <li>The account is created <strong>suspended</strong> — no password is set.</li>
        <li>The inspector activates it by signing in through the official flow.</li>
        <li>Their jurisdiction limits which inspections they can be assigned.</li>
      </ul>
    </div>
  );
}

/* ---------------- Official ---------------- */

export function OfficialFormBody({ jurisdictions }: { jurisdictions: JurisdictionView[] }) {
  const [success, setSuccess] = useState<Success | null>(null);

  if (success) {
    return (
      <SuccessPanel
        title={success.title}
        message={success.message}
        onAnother={() => setSuccess(null)}
        anotherLabel="Invite another official"
        backHref="/registry"
      />
    );
  }

  return (
    <FormShell
      kind="Authority Official / Admin"
      title="Invite an official"
      description="Grant system access: role, authority and jurisdiction. Highest-privilege registration."
      backHref="/registry"
      aside={<OfficialAside />}
    >
      <OfficialForm
        jurisdictions={jurisdictions}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
  );
}

function OfficialAside() {
  return (
    <div className="reg-summary">
      <div className="reg-summary-title">Access grants</div>
      <ul className="reg-aside-list">
        <li><strong>Authority Official</strong> verifies registrations and reviews findings.</li>
        <li><strong>District Officer</strong> oversees one district only.</li>
        <li><strong>Institution Admin</strong> registers facilities for their organisation.</li>
      </ul>
      <div className="registry-form-note registry-form-note-warn">
        National scope grants reach across all jurisdictions. Grants are audited.
      </div>
    </div>
  );
}
