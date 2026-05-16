import { DynamicTool } from '@langchain/core/tools';
import { mcpManager } from './mcpClientManager.js';
import { Logger } from '../utils/logger.js';
import { z } from 'zod';
import { config } from '../config/environment.js';

/**
 * Convert MCP tools to LangChain tools
 */
export async function convertMCPToolsToLangChain(): Promise<DynamicTool[]> {
  const langchainTools: DynamicTool[] = [];
  
  try {
    const mcpTools = await mcpManager.getAllTools();
    
    // Get allowed tools from config
    const allowedTools = config.mcp.allowedTools;
    
    if (allowedTools && allowedTools.length > 0) {
      Logger.info('Filtering MCP tools based on ALLOWED_MCP_TOOLS configuration', {
        allowedTools,
        totalAvailable: mcpTools.length
      });
    }
    
    for (const mcpTool of mcpTools) {
      // Create the full tool name (serverName_toolName)
      const fullToolName = `${mcpTool.serverName}_${mcpTool.name}`;
      
      // Check if tool is allowed
      if (allowedTools && allowedTools.length > 0) {
        if (!allowedTools.includes(fullToolName)) {
          Logger.debug(`Skipping MCP tool (not in allowed list): ${fullToolName}`);
          continue;
        }
      }
      
      const tool = createLangChainToolFromMCP(mcpTool);
      if (tool) {
        langchainTools.push(tool);
      }
    }
    
    Logger.info('Converted MCP tools to LangChain tools', {
      count: langchainTools.length,
      tools: langchainTools.map(t => t.name),
      filtered: allowedTools && allowedTools.length > 0
    });
    
    return langchainTools;
  } catch (error) {
    Logger.error('Failed to convert MCP tools', {
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * Create a LangChain tool from an MCP tool definition
 */
function createLangChainToolFromMCP(mcpTool: any): DynamicTool | null {
  try {
    const serverName = mcpTool.serverName;
    const toolName = mcpTool.name;
    const description = mcpTool.description || 'MCP tool';
    const inputSchema = mcpTool.inputSchema;
    
    // Create zod schema from JSON schema
    const zodSchema = jsonSchemaToZod(inputSchema);
    
    return new DynamicTool({
      name: `${serverName}_${toolName}`,
      description: `[${serverName}] ${description}`,
      func: async (input: string) => {
        try {
          Logger.info('=== LANGCHAIN TOOL INVOCATION ===', {
            toolName: `${serverName}_${toolName}`,
            serverName,
            rawInput: input,
            inputLength: input.length,
            timestamp: new Date().toISOString()
          });
          
          // Parse input string to JSON if needed
          let parsedInput: Record<string, any>;
          
          if (typeof input === 'string') {
            // Check if it looks like JSON (starts with { or [)
            const trimmedInput = input.trim();
            if (trimmedInput.startsWith('{') || trimmedInput.startsWith('[')) {
              try {
                parsedInput = JSON.parse(input);
                Logger.debug('Parsed JSON input for MCP tool', {
                  serverName,
                  toolName,
                  parsedInputKeys: Object.keys(parsedInput)
                });
              } catch (parseError) {
                Logger.warn('Input appears to be JSON but failed to parse, wrapping as query', {
                  serverName,
                  toolName,
                  parseError: (parseError as Error).message,
                  inputPreview: input.substring(0, 100)
                });
                parsedInput = { query: input };
              }
            } else {
              // Plain text input - wrap directly without attempting JSON parse
              Logger.debug('Plain text input detected, wrapping as query', {
                serverName,
                toolName,
                inputLength: input.length
              });
              parsedInput = { query: input };
            }
          } else {
            // Already an object
            parsedInput = input;
            Logger.debug('Object input received for MCP tool', {
              serverName,
              toolName,
              inputKeys: Object.keys(parsedInput)
            });
          }
          
          // Validate input against schema if available
          if (zodSchema && inputSchema) {
            try {
              const validationResult = zodSchema.safeParse(parsedInput);
              if (!validationResult.success) {
                Logger.warn('Input validation failed, using fallback', {
                  serverName,
                  toolName,
                  validationErrors: validationResult.error.errors,
                  input: parsedInput
                });
                // Try to fix common issues - if schema expects 'query' but it's missing
                if (inputSchema.properties?.query && !parsedInput.query) {
                  parsedInput = { query: typeof input === 'string' ? input : JSON.stringify(input) };
                  Logger.info('Applied fallback to add query parameter', {
                    serverName,
                    toolName
                  });
                }
              } else {
                Logger.debug('Input validation passed', {
                  serverName,
                  toolName
                });
              }
            } catch (validationError) {
              Logger.debug('Schema validation skipped due to error', {
                serverName,
                toolName,
                error: (validationError as Error).message
              });
            }
          }
          
          const result = await mcpManager.callTool(serverName, toolName, parsedInput);
          
          Logger.info('=== LANGCHAIN TOOL RESULT RECEIVED ===', {
            toolName: `${serverName}_${toolName}`,
            serverName,
            resultType: typeof result,
            hasContent: !!result?.content,
            isError: !!result?.isError,
            timestamp: new Date().toISOString()
          });
          
          // Format the result based on content type
          let formattedResult: string;
          if (result.content && Array.isArray(result.content)) {
            // MCP returns content as array of text/image blocks
            const textContent = result.content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');
            
            formattedResult = textContent || JSON.stringify(result);
            
            Logger.debug('Formatted text content from MCP result', {
              serverName,
              toolName,
              contentBlocksCount: result.content.length,
              textBlocksCount: result.content.filter((b: any) => b.type === 'text').length,
              formattedLength: formattedResult.length,
              preview: formattedResult.substring(0, 300) + (formattedResult.length > 300 ? '...' : '')
            });
          } else {
            formattedResult = typeof result === 'string' ? result : JSON.stringify(result);
            
            Logger.debug('Direct result formatting', {
              serverName,
              toolName,
              resultIsString: typeof result === 'string',
              formattedLength: formattedResult.length
            });
          }
          
          Logger.info('=== LANGCHAIN TOOL RETURNING RESULT ===', {
            toolName: `${serverName}_${toolName}`,
            serverName,
            resultLength: formattedResult.length,
            timestamp: new Date().toISOString()
          });
          
          return formattedResult;
        } catch (error) {
          Logger.error('=== LANGCHAIN TOOL EXECUTION FAILED ===', {
            toolName: `${serverName}_${toolName}`,
            serverName,
            error: (error as Error).message,
            stack: (error as Error).stack,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
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
 * Convert JSON Schema to Zod schema
 */
function jsonSchemaToZod(schema: any): any {
  if (!schema || schema.type !== 'object') {
    return z.object({});
  }
  
  const properties = schema.properties || {};
  const required = schema.required || [];
  const shape: Record<string, any> = {};
  
  for (const [key, prop] of Object.entries(properties)) {
    const zodType = jsonSchemaPropertyToZod(prop as any);
    shape[key] = required.includes(key) 
      ? zodType 
      : zodType.optional();
  }
  
  return z.object(shape);
}

/**
 * Convert a single JSON Schema property to Zod type
 */
function jsonSchemaPropertyToZod(prop: any): any {
  switch (prop.type) {
    case 'string':
      return z.string().describe(prop.description || '');
    case 'number':
    case 'integer':
      return z.number().describe(prop.description || '');
    case 'boolean':
      return z.boolean().describe(prop.description || '');
    case 'array':
      if (prop.items) {
        const itemType = jsonSchemaPropertyToZod(prop.items);
        return z.array(itemType).describe(prop.description || '');
      }
      return z.array(z.any()).describe(prop.description || '');
    case 'object':
      if (prop.properties) {
        return jsonSchemaToZod(prop).describe(prop.description || '');
      }
      return z.record(z.string(), z.any()).describe(prop.description || '');
    default:
      return z.any().describe(prop.description || '');
  }
}
