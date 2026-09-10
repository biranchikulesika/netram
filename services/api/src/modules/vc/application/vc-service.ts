import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { VcRepositoryPort } from "./ports/vc-repository.js";
import type { VcProviderPort } from "./ports/vc-provider-port.js";
import type {
  CreateVcSessionInput,
  ListVcSessionsFilter,
  VcSessionWithParticipants,
  VcJoinDetails,
  VcParticipantRole,
} from "@netram/types";
import {
  validateVcTransition,
  isSessionJoinable,
  determineParticipantRole,
} from "../domain/vc-session.js";

const VC_READ = "vc_session:read" as const;
const VC_CREATE = "vc_session:create" as const;
const VC_MANAGE = "vc_session:manage" as const;

export class VcService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly vcRepo: VcRepositoryPort,
    private readonly vcProvider: VcProviderPort,
  ) {}

  async createSession(
    ctx: RequestUserContext,
    input: CreateVcSessionInput,
  ): Promise<VcSessionWithParticipants> {
    this.authz.requirePermission(ctx, VC_CREATE);

    const tempId = crypto.randomUUID();
    const { roomName } = await this.vcProvider.createRoom({
      id: tempId,
      title: input.title,
    });

    const session = await this.vcRepo.create(
      {
        id: tempId,
        title: input.title,
        inspectionId: input.inspectionId,
        projectId: input.projectId,
        hostUserId: ctx.user.id,
        roomName,
        provider: input.provider ?? "webrtc",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        metadata: input.metadata,
        participants: input.participants,
      },
      {
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        auditAction: "vc.session_created",
        auditMetadata: {
          title: input.title,
          inspectionId: input.inspectionId,
          projectId: input.projectId,
          roomName,
        },
        eventType: "vc_session.created",
        eventPayload: {
          title: input.title,
          inspectionId: input.inspectionId,
          projectId: input.projectId,
          roomName,
          hostUserId: ctx.user.id,
        },
      },
    );

    return session;
  }

  async listSessions(
    ctx: RequestUserContext,
    filter: ListVcSessionsFilter = {},
  ): Promise<{
    items: VcSessionWithParticipants[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, VC_READ);

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    const result = await this.vcRepo.list({
      page,
      pageSize,
      inspectionId: filter.inspectionId,
      projectId: filter.projectId,
      status: filter.status,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  async getSession(ctx: RequestUserContext, id: string): Promise<VcSessionWithParticipants> {
    this.authz.requirePermission(ctx, VC_READ);

    const session = await this.vcRepo.findById(id);
    if (!session) {
      throw AppError.notFound("Video conference session not found.");
    }

    return session;
  }

  async startSession(ctx: RequestUserContext, id: string): Promise<VcSessionWithParticipants> {
    const session = await this.vcRepo.findById(id);
    if (!session) {
      throw AppError.notFound("Video conference session not found.");
    }

    const isHost = session.hostUserId === ctx.user.id;
    const hasManage = ctx.permissions.has(VC_MANAGE);
    if (!isHost && !hasManage) {
      throw AppError.forbidden(
        "Only the host or an authorized manager can start the video session.",
      );
    }

    validateVcTransition(session.status, "active");

    const now = new Date();
    return this.vcRepo.updateStatus(
      id,
      "active",
      { startedAt: now },
      {
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        auditAction: "vc.session_started",
        auditMetadata: {
          sessionId: id,
          title: session.title,
          roomName: session.roomName,
        },
        eventType: "vc_session.started",
        eventPayload: {
          sessionId: id,
          title: session.title,
          roomName: session.roomName,
          startedAt: now.toISOString(),
          inspectionId: session.inspectionId,
        },
      },
    );
  }

  async endSession(ctx: RequestUserContext, id: string): Promise<VcSessionWithParticipants> {
    const session = await this.vcRepo.findById(id);
    if (!session) {
      throw AppError.notFound("Video conference session not found.");
    }

    const isHost = session.hostUserId === ctx.user.id;
    const hasManage = ctx.permissions.has(VC_MANAGE);
    if (!isHost && !hasManage) {
      throw AppError.forbidden("Only the host or an authorized manager can end the video session.");
    }

    validateVcTransition(session.status, "completed");

    const now = new Date();
    return this.vcRepo.updateStatus(
      id,
      "completed",
      { endedAt: now },
      {
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        auditAction: "vc.session_ended",
        auditMetadata: {
          sessionId: id,
          title: session.title,
        },
        eventType: "vc_session.ended",
        eventPayload: {
          sessionId: id,
          title: session.title,
          endedAt: now.toISOString(),
          inspectionId: session.inspectionId,
        },
      },
    );
  }

  async joinSession(
    ctx: RequestUserContext,
    id: string,
    requestedRole?: VcParticipantRole,
  ): Promise<VcJoinDetails> {
    this.authz.requirePermission(ctx, VC_READ);

    const session = await this.vcRepo.findById(id);
    if (!session) {
      throw AppError.notFound("Video conference session not found.");
    }

    if (!isSessionJoinable(session.status)) {
      throw AppError.badRequest(`Cannot join session with status '${session.status}'`);
    }

    const isInspector = ctx.permissions.has("observation:create");
    const isOrganisationRep = ctx.assignments.some((a) => a.roleCode === "institution_admin");

    const role = determineParticipantRole(
      ctx.user.id,
      session.hostUserId,
      requestedRole,
      isInspector,
      isOrganisationRep,
    );

    await this.vcRepo.recordParticipantJoin(id, ctx.user.id, role, {
      actorUserId: ctx.user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      auditAction: "vc.participant_joined",
      auditMetadata: { sessionId: id, userId: ctx.user.id, role },
      eventType: "vc_session.participant_joined",
      eventPayload: { sessionId: id, userId: ctx.user.id, role },
    });

    return this.vcProvider.generateJoinDetails(session, ctx.user, role);
  }

  async leaveSession(ctx: RequestUserContext, id: string): Promise<void> {
    this.authz.requirePermission(ctx, VC_READ);

    const session = await this.vcRepo.findById(id);
    if (!session) {
      throw AppError.notFound("Video conference session not found.");
    }

    await this.vcRepo.recordParticipantLeave(id, ctx.user.id, {
      actorUserId: ctx.user.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      auditAction: "vc.participant_left",
      auditMetadata: { sessionId: id, userId: ctx.user.id },
      eventType: "vc_session.participant_left",
      eventPayload: { sessionId: id, userId: ctx.user.id },
    });
  }
}
