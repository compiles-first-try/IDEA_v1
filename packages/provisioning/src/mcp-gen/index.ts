import type { AuditLogger } from "@rsf/foundation";

export interface McpToolDef {
  name: string;
  description: string;
  method: string;
  path: string;
  zodSchema: string;
  parameters: { name: string; type: string; required: boolean; location: string }[];
}

export interface McpGenResult {
  serverCode: string;
  tools: McpToolDef[];
}

interface McpGenDeps {
  auditLogger: AuditLogger;
}

export interface McpGenerator {
  generate: (openApiSpec: Record<string, unknown>) => Promise<McpGenResult>;
}

function mapOpenApiTypeToZod(schema: Record<string, unknown>): string {
  const type = schema.type as string;
  switch (type) {
    case "string": return "z.string()";
    case "integer": return "z.number().int()";
    case "number": return "z.number()";
    case "boolean": return "z.boolean()";
    case "array": {
      const items = schema.items as Record<string, unknown> | undefined;
      const inner = items ? mapOpenApiTypeToZod(items) : "z.unknown()";
      return `z.array(${inner})`;
    }
    case "object": {
      const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
      const required = (schema.required as string[]) ?? [];
      if (!props) return "z.object({})";
      const fields = Object.entries(props).map(([key, val]) => {
        const zodType = mapOpenApiTypeToZod(val);
        const isRequired = required.includes(key);
        return `  ${key}: ${zodType}${isRequired ? "" : ".optional()"}`;
      });
      return `z.object({\n${fields.join(",\n")}\n})`;
    }
    default: return "z.unknown()";
  }
}

/**
 * Parse an OpenAPI 3.0 spec into MCP tool definitions.
 */
export function parseOpenApiToTools(
  spec: Record<string, unknown>
): McpToolDef[] {
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const tools: McpToolDef[] = [];

  for (const [pathStr, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== "object" || !operation) continue;
      const op = operation as Record<string, unknown>;
      const operationId = op.operationId as string;
      if (!operationId) continue;

      const description = (op.summary as string) ?? operationId;
      const parameters: McpToolDef["parameters"] = [];
      const zodFields: string[] = [];

      // Path/query parameters
      const params = (op.parameters as Record<string, unknown>[]) ?? [];
      for (const param of params) {
        const name = param.name as string;
        const location = param.in as string;
        const schema = param.schema as Record<string, unknown>;
        const required = (param.required as boolean) ?? false;
        const zodType = schema ? mapOpenApiTypeToZod(schema) : "z.string()";

        parameters.push({ name, type: schema?.type as string ?? "string", required, location });
        zodFields.push(`  ${name}: ${zodType}${required ? "" : ".optional()"}`);
      }

      // Request body (for POST/PUT)
      const requestBody = op.requestBody as Record<string, unknown> | undefined;
      if (requestBody) {
        const content = requestBody.content as Record<string, Record<string, unknown>>;
        const jsonContent = content?.["application/json"];
        if (jsonContent?.schema) {
          const bodySchema = jsonContent.schema as Record<string, unknown>;
          const props = bodySchema.properties as Record<string, Record<string, unknown>> ?? {};
          const required = (bodySchema.required as string[]) ?? [];
          for (const [key, val] of Object.entries(props)) {
            const zodType = mapOpenApiTypeToZod(val);
            const isRequired = required.includes(key);
            parameters.push({ name: key, type: val.type as string ?? "string", required: isRequired, location: "body" });
            zodFields.push(`  ${key}: ${zodType}${isRequired ? "" : ".optional()"}`);
          }
        }
      }

      const zodSchema = zodFields.length > 0
        ? `z.object({\n${zodFields.join(",\n")}\n})`
        : "z.object({})";

      tools.push({ name: operationId, description, method: method.toUpperCase(), path: pathStr, zodSchema, parameters });
    }
  }

  return tools;
}

/**
 * Generate a complete MCP server from an OpenAPI spec using
 * the @modelcontextprotocol/sdk.
 */
export function createMcpGenerator(deps: McpGenDeps): McpGenerator {
  const { auditLogger } = deps;

  async function generate(
    openApiSpec: Record<string, unknown>
  ): Promise<McpGenResult> {
    const start = Date.now();
    const tools = parseOpenApiToTools(openApiSpec);
    const info = openApiSpec.info as Record<string, string> | undefined;
    const title = info?.title ?? "Generated API";

    const toolRegistrations = tools.map((tool) => `
  server.tool(
    "${tool.name}",
    "${tool.description}",
    ${tool.zodSchema.replace(/^z\.object/, "").replace(/\n/g, "\n    ")},
    async (params) => {
      // TODO: implement ${tool.method} ${tool.path}
      const response = await fetch(\`\${BASE_URL}${tool.path.replace(/\{(\w+)\}/g, "${params.$1}")}\`, {
        method: "${tool.method}",${tool.method === "POST" || tool.method === "PUT" ? `
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),` : ""}
      });
      const data = await response.json();
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    }
  );`).join("\n");

    const serverCode = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const server = new McpServer({
  name: "${title}",
  version: "1.0.0",
});
${toolRegistrations}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`;

    await auditLogger.log({
      agentId: "mcp-generator",
      agentType: "PROVISIONING",
      actionType: "CODE_GENERATE",
      phase: "LAYER_5_PROVISIONING",
      inputs: { spec_title: title, endpoint_count: tools.length },
      outputs: { code_length: serverCode.length, tool_count: tools.length },
      durationMs: Date.now() - start,
      status: "SUCCESS",
    });

    return { serverCode, tools };
  }

  return { generate };
}
