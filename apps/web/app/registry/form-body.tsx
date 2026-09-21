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

export function AgencyFormBody() {
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
      title="Register an agency"
      description="Register the operating agency or society that runs facilities on the ground."
    >
      <OrganisationForm
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
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
      title="Register a scheme"
      description="Register a welfare scheme or programme that facilities participate in."
    >
      <ProgrammeForm
        states={states}
        districts={districts}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
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
      title="Invite an inspector"
      description="Create a field inspector account and assign their operating jurisdiction."
    >
      <InspectorForm
        jurisdictions={jurisdictions}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
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
      title="Invite an official"
      description="Grant system access: role, authority and jurisdiction. Highest-privilege registration."
    >
      <OfficialForm
        jurisdictions={jurisdictions}
        onSuccess={(title, message) => setSuccess({ title, message })}
      />
    </FormShell>
  );
}