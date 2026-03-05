import process from "node:process";

let buffer = Buffer.alloc(0);

function writeMessage(payload) {
  const body = JSON.stringify(payload);
  const frame = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
  process.stdout.write(frame);
}

function onRequest(request) {
  const { id, method, params } = request ?? {};
  if (typeof id !== "number" || typeof method !== "string") {
    return;
  }

  if (method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: "okk-mock-mcp",
          version: "0.0.1"
        }
      }
    });
    return;
  }

  if (method === "tools/list") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "echo",
            description: "Echo tool for smoke tests",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string" }
              },
              required: ["text"]
            }
          }
        ]
      }
    });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    if (name !== "echo") {
      writeMessage({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Unknown tool"
        }
      });
      return;
    }
    const text = typeof params?.arguments?.text === "string" ? params.arguments.text : "";
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `echo:${text}`
          }
        ]
      }
    });
    return;
  }

  if (method === "resources/list") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          {
            uri: "memo://hello",
            name: "hello",
            description: "mock resource",
            mimeType: "text/plain"
          }
        ]
      }
    });
    return;
  }

  if (method === "resources/read") {
    const uri = typeof params?.uri === "string" ? params.uri : "";
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        contents: [
          {
            uri: uri || "memo://hello",
            mimeType: "text/plain",
            text: "hello from mock mcp"
          }
        ]
      }
    });
    return;
  }

  writeMessage({
    jsonrpc: "2.0",
    id,
    result: {}
  });
}

function handleBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      return;
    }

    const headerRaw = buffer.slice(0, headerEnd).toString("utf8");
    const match = /content-length:\s*(\d+)/i.exec(headerRaw);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const size = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + size;
    if (buffer.length < bodyEnd) {
      return;
    }

    const raw = buffer.slice(bodyStart, bodyEnd).toString("utf8");
    buffer = buffer.slice(bodyEnd);

    try {
      const parsed = JSON.parse(raw);
      onRequest(parsed);
    } catch {
      // ignore malformed request
    }
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  handleBuffer();
});
