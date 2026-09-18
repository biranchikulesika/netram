/**
 * Named repository-layer error classes (packages/data §9).
 *
 * Application services may catch these to produce domain-appropriate
 * responses (e.g. AppError.notFound) without coupling to generic Error
 * messages. All extend Error so they remain throwable and catchable as-is
 * if the caller does not discriminate.
 */

/** Thrown when a required row is absent after an insert — indicates a DB/constraint issue. */
export class RepositoryInsertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryInsertError";
  }
}

/** Thrown when a mutation targets a row that no longer exists. */
export class RepositoryNotFoundError extends Error {
  readonly entity: string;
  readonly entityId: string | null;

  constructor(entity: string, id?: string) {
    super(id ? `${entity} not found: ${id}` : `${entity} not found`);
    this.name = "RepositoryNotFoundError";
    this.entity = entity;
    this.entityId = id ?? null;
  }
}
