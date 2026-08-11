const tools = [
  {
    name: "add",
    description: "Add two numbers.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number." },
        b: { type: "number", description: "The second number." },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "subtract",
    description: "Subtract the second number from the first number.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number." },
        b: { type: "number", description: "The second number." },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "multiply",
    description: "Multiply two numbers.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number." },
        b: { type: "number", description: "The second number." },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "divide",
    description: "Divide the first number by the second number.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "The numerator." },
        b: { type: "number", description: "The denominator." },
      },
      required: ["a", "b"],
    },
  },
];

const writeMessage = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const errorResponse = (id, code, message) =>
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });

const toolResult = (value) => ({
  content: [{ type: "text", text: String(value) }],
  structuredContent: { result: value },
});

const toolError = (message) => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

function readNumber(args, key) {
  const value = args?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Argument ${key} must be a finite number.`);
  }
  return value;
}

function callTool(name, args) {
  const a = readNumber(args, "a");
  const b = readNumber(args, "b");

  switch (name) {
    case "add":
      return toolResult(a + b);
    case "subtract":
      return toolResult(a - b);
    case "multiply":
      return toolResult(a * b);
    case "divide":
      if (b === 0) return toolError("Cannot divide by zero.");
      return toolResult(a / b);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleMessage(message) {
  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "MCP Math Server", version: "1.0.0" },
        instructions: "Use the arithmetic tools to solve numeric problems.",
      },
    });
    return;
  }

  if (message.method === "tools/list") {
    writeMessage({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const result = callTool(message.params?.name, message.params?.arguments);
      writeMessage({ jsonrpc: "2.0", id: message.id, result });
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        result: toolError(error instanceof Error ? error.message : "Math tool failed."),
      });
    }
    return;
  }

  if (message.method === "ping") {
    writeMessage({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }

  if (message.id !== undefined) {
    errorResponse(message.id, -32601, `Unsupported method: ${message.method}`);
  }
}

let inputBuffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk;
  let newlineIndex = inputBuffer.indexOf("\n");

  while (newlineIndex !== -1) {
    const line = inputBuffer.slice(0, newlineIndex).trim();
    inputBuffer = inputBuffer.slice(newlineIndex + 1);
    newlineIndex = inputBuffer.indexOf("\n");

    if (!line) continue;
    try {
      void handleMessage(JSON.parse(line));
    } catch {
      errorResponse(null, -32700, "Invalid JSON.");
    }
  }
});
