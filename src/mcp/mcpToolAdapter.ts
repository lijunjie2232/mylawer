import { DynamicStructuredTool } from '@langchain/core/tools';
import { mcpManager } from './mcpClientManager.js';
import { Logger } from '../utils/logger.js';
import { z } from 'zod';
import { config } from '../config/environment.js';

/**
 * Convert MCP tools to LangChain structured tools.
 *
 * DynamicStructuredTool を使うことで、モデルには JSON Schema が渡され、
 * 引数はオブジェクトとして受け取れる（以前の「JSON 文字列をパースする」処理が不要）。
 */
export async function convertMCPToolsToLangChain(): Promise<DynamicStructuredTool[]> {
  const langchainTools: DynamicStructuredTool[] = [];

  try {
    const mcpTools = await mcpManager.getAllTools();
    const allowedTools = config.mcp.allowedTools;

    for (const mcpTool of mcpTools) {
      const fullToolName = `${mcpTool.serverName}_${mcpTool.name}`;
      if (allowedTools?.length && !allowedTools.includes(fullToolName)) {
        continue;
      }

      const tool = createLangChainToolFromMCP(mcpTool);
      if (tool) {
        langchainTools.push(tool);
      }
    }

    Logger.info('Converted MCP tools to LangChain tools', {
      count: langchainTools.length,
      tools: langchainTools.map(t => t.name),
      filtered: !!allowedTools?.length,
    });

    return langchainTools;
  } catch (error) {
    Logger.error('Failed to convert MCP tools', {
      error: (error as Error).message
    });
    return [];
  }
}

function createLangChainToolFromMCP(mcpTool: {
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: any;
}): DynamicStructuredTool | null {
  try {
    const { serverName, name: toolName, description, inputSchema } = mcpTool;

    return new DynamicStructuredTool({
      name: `${serverName}_${toolName}`,
      description: `[${serverName}] ${description || 'MCP tool'}`,
      schema: jsonSchemaToZod(inputSchema) as any,
      func: async (input: Record<string, any>) => {
        const result = await mcpManager.callTool(serverName, toolName, input ?? {});

        if (Array.isArray(result?.content)) {
          const text = result.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          return text || JSON.stringify(result);
        }

        return typeof result === 'string' ? result : JSON.stringify(result);
      }
    });
  } catch (error) {
    Logger.error('Failed to create LangChain tool from MCP', {
      toolName: mcpTool.name,
      error: (error as Error).message
    });
    return null;
  }
}

/**
 * Convert JSON Schema to Zod schema.
 */
function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || schema.type !== 'object') {
    return z.object({});
  }

  const properties = schema.properties || {};
  const required: string[] = schema.required || [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const zodType = jsonSchemaPropertyToZod(prop as any);
    shape[key] = required.includes(key) ? zodType : zodType.optional();
  }

  return z.object(shape);
}

function jsonSchemaPropertyToZod(prop: any): z.ZodTypeAny {
  const desc = typeof prop?.description === 'string' && prop.description.trim() ? prop.description.trim() : undefined;
  let zodType: z.ZodTypeAny;

  if (Array.isArray(prop?.enum) && prop.enum.length > 0 && prop.enum.every((v: unknown) => typeof v === 'string')) {
    zodType = z.enum(prop.enum as [string, ...string[]]);
  } else {
    switch (prop?.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        zodType = z.array(prop.items ? jsonSchemaPropertyToZod(prop.items) : z.any());
        break;
      case 'object':
        zodType = prop.properties ? jsonSchemaToZod(prop) : z.record(z.string(), z.any());
        break;
      default:
        zodType = z.any();
        break;
    }
  }

  return desc ? zodType.describe(desc) : zodType;
}
