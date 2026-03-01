import { randomUUID } from "node:crypto";

export const generateId = (): string => randomUUID();

export const nowIso = (): string => new Date().toISOString();
