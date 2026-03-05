import type { WebSocket } from "ws";
import type { OkkCore } from "../core/types.js";

function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

export class TeamGateway {
  constructor(private readonly core: OkkCore) {}

  onConnection(socket: WebSocket, teamId: string): void {
    const unsubscribe = this.core.team.subscribe(teamId, (event) => {
      sendJson(socket, event);
    });

    socket.on("close", () => {
      unsubscribe();
    });
  }
}
