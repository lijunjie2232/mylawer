import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MCPServerConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  serverName: string;
}

/**
 * MCP Manager - Singleton class to manage MCP server connections
 */
class MCPManager {
  private static instance: MCPManager;
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Connect to an MCP server
   */
  async connect(name: string, config: MCPServerConfig): Promise<void> {
    if (this.clients.has(name)) {
      Logger.warn(`MCP server ${name} already connected, disconnecting first`);
      await this.disconnect(name);
    }

    Logger.info(`Connecting to MCP server: ${name}`, {
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      // Mask sensitive env vars
      env: Object.keys(config.env || {}).map(key => {
        const value = config.env?.[key];
        if (value && (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret'))) {
          return `${key}=********${value.slice(-4)}`;
        }
        return `${key}=${value}`;
      })
    });

    // Create stdio transport
    const env: Record<string, string> = {};
    
    // Copy process.env, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    
    // Add custom env vars
    if (config.env) {
      Object.assign(env, config.env);
    }

    Logger.debug(`Creating StdioClientTransport for ${name}`, {
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      // Mask sensitive env var keys
      envKeys: Object.keys(env).map(key => {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
          return `${key}=********`;
        }
        return key;
      })
    });

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      cwd: config.cwd,
      env
    });

    // Note: StdioClientTransport doesn't have an .on() method
    // Error handling is done through the client connection process

    // Create MCP client
    const client = new Client(
      {
        name: `law-assistant-${name}`,
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    Logger.debug(`MCP client created for ${name}, attempting connection...`);

    // Connect to server with timeout and error handling
    try {
      const connectPromise = client.connect(transport);
      
      // Set a timeout for connection
      const timeoutMs = 30000; // 30 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      Logger.info(`Successfully connected to MCP server: ${name}`);
    } catch (connectError) {
      Logger.error(`Failed to connect to MCP server: ${name}`, {
        error: (connectError as Error).message,
        stack: (connectError as Error).stack,
        command: config.command,
        args: config.args,
        cwd: config.cwd
      });
      throw connectError;
    }

    // Get available tools
    Logger.debug(`Listing tools from MCP server: ${name}`);
    try {
      const toolsResponse = await client.listTools();
      Logger.info(`MCP server ${name} provides ${toolsResponse.tools.length} tools`, {
        tools: toolsResponse.tools.map(t => t.name)
      });

      // Register tools with server name
      for (const toolDef of toolsResponse.tools) {
        const tool: MCPTool = {
          name: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.inputSchema,
          serverName: name
        };
        this.tools.set(`${name}_${toolDef.name}`, tool);
      }
    } catch (toolsError) {
      Logger.error(`Failed to list tools from MCP server: ${name}`, {
        error: (toolsError as Error).message,
        stack: (toolsError as Error).stack
      });
      throw toolsError;
    }

    // Store client
    this.clients.set(name, client);

    Logger.info(`Successfully connected to MCP server: ${name}`);
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      try {
        await client.close();
        Logger.info(`Disconnected from MCP server: ${name}`);
      } catch (error) {
        Logger.error(`Error disconnecting from ${name}`, {
          error: (error as Error).message
        });
      }
      this.clients.delete(name);
      
      // Remove tools from this server
      for (const [key, tool] of this.tools.entries()) {
        if (tool.serverName === name) {
          this.tools.delete(key);
        }
      }
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    Logger.info('Disconnecting from all MCP servers');
    
    for (const name of this.clients.keys()) {
      await this.disconnect(name);
    }
  }

  /**
   * Get all tools from all servers
   */
  async getAllTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values());
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not connected`);
    }

    Logger.info('=== MCP TOOL CALL START ===', {
      serverName,
      toolName,
      arguments: args,
      timestamp: new Date().toISOString()
    });

    try {
      const startTime = Date.now();
      
      Logger.debug('Sending request to MCP server', {
        serverName,
        toolName,
        argsLength: JSON.stringify(args).length
      });

      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      const duration = Date.now() - startTime;

      Logger.info('=== MCP TOOL CALL COMPLETE ===', {
        serverName,
        toolName,
        duration: `${duration}ms`,
        resultType: typeof result,
        hasContent: !!result?.content,
        contentLength: result?.content ? (Array.isArray(result.content) ? result.content.length : 'N/A') : 'N/A',
        timestamp: new Date().toISOString()
      });

      // Log detailed result for debugging
      Logger.debug('MCP tool result details', {
        serverName,
        toolName,
        resultPreview: JSON.stringify(result).substring(0, 500) + (JSON.stringify(result).length > 500 ? '...' : '')
      });

      return result;
    } catch (error) {
      Logger.error('=== MCP TOOL CALL FAILED ===', {
        serverName,
        toolName,
        arguments: args,
        error: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }
}

// Export singleton instance
export const mcpManager = MCPManager.getInstance();
