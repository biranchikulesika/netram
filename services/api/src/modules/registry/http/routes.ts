import type { FastifyInstance } from "fastify";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import type { Container } from "../../../infrastructure/container.js";
import {
  createOrganisationSchema,
  createProgrammeSchema,
  districtViewSchema,
  organisationSchema,
  programmeSchema,
  registerInspectorSchema,
  registerOfficialSchema,
  registryUserViewSchema,
  stateViewSchema,
} from "@netram/validation";
import type {
  CreateOrganisationInput,
  CreateProgrammeInput,
  RegisterInspectorInput,
  RegisterOfficialInput,
} from "@netram/types";
import { z } from "zod";

export async function registerRegistryRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const registryService = container.registryService;

  app.get(
    "/registry/organisations",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("OrganisationList", z.array(organisationSchema)) },
      },
    },
    async (request) => {
      return registryService.listOrganisations(request.netram!);
    },
  );

  app.post(
    "/registry/organisations",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateOrganisationBody", createOrganisationSchema),
        response: { 201: toJsonSchema("Organisation", organisationSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateOrganisationInput;
      const org = await registryService.createOrganisation(request.netram!, body);
      reply.code(201);
      return org;
    },
  );

  app.get(
    "/registry/programmes",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("ProgrammeList", z.array(programmeSchema)) },
      },
    },
    async (request) => {
      return registryService.listProgrammes(request.netram!);
    },
  );

  app.post(
    "/registry/programmes",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateProgrammeBody", createProgrammeSchema),
        response: { 201: toJsonSchema("Programme", programmeSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateProgrammeInput;
      const programme = await registryService.createProgramme(request.netram!, body);
      reply.code(201);
      return programme;
    },
  );

  app.get(
    "/registry/states",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("StateList", z.array(stateViewSchema)) },
      },
    },
    async (request) => {
      return registryService.listStates(request.netram!);
    },
  );

  app.get(
    "/registry/districts",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema("DistrictList", z.array(districtViewSchema)) },
      },
    },
    async (request) => {
      return registryService.listDistricts(request.netram!);
    },
  );

  app.post(
    "/registry/inspectors",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("RegisterInspectorBody", registerInspectorSchema),
        response: { 201: toJsonSchema("RegistryUserView", registryUserViewSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as RegisterInspectorInput;
      const user = await registryService.registerInspector(request.netram!, body);
      reply.code(201);
      return user;
    },
  );

  app.post(
    "/registry/officials",
    {
      schema: {
        tags: ["registry"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("RegisterOfficialBody", registerOfficialSchema),
        response: { 201: toJsonSchema("RegistryUserView", registryUserViewSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as RegisterOfficialInput;
      const user = await registryService.registerOfficial(request.netram!, body);
      reply.code(201);
      return user;
    },
  );
}
