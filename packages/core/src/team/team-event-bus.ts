import type { TeamEvent, TeamEventPayloadMap, TeamEventType } from "../types.js";
import { nowIso } from "../utils/id.js";

export type TeamEventHandler = (event: TeamEvent) => void;

export class TeamEventBus {
  private readonly handlers = new Set<TeamEventHandler>();
  private readonly teamCounters = new Map<string, number>();

  on(handler: TeamEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit<T extends TeamEventType>(
    teamId: string,
    type: T,
    payload: TeamEventPayloadMap[T]
  ): TeamEvent<T> {
    const event = this.createEvent(teamId, type, payload);
    for (const handler of this.handlers) {
      handler(event);
    }
    return event;
  }

  private createEvent<T extends TeamEventType>(
    teamId: string,
    type: T,
    payload: TeamEventPayloadMap[T]
  ): TeamEvent<T> {
    const nextEventId = (this.teamCounters.get(teamId) ?? 0) + 1;
    this.teamCounters.set(teamId, nextEventId);

    return {
      event_id: nextEventId,
      teamId,
      type,
      payload,
      timestamp: nowIso()
    };
  }
}

