import { mcpManager } from './mcpClientManager.js';
import { convertMCPToolsToLangChain } from './mcpToolAdapter.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize MCP servers
 */
export async function initializeMCPServers(): Promise<void> {
  Logger.info('=== MCP SERVERS INITIALIZATION START ===', {
    timestamp: new Date().toISOString()
  });

  const servers = [
    {
      name: 'webmcp',
      path: path.join(__dirname, '../../third/webmcp'),
      scriptPath: path.join(__dirname, '../../third/webmcp', 'src/MCPServerWrapper.js'),
      config: {
        command: 'node',
        args: ['src/MCPServerWrapper.js'],
        cwd: path.join(__dirname, '../../third/webmcp')
      }
    },
    {
      name: 'legal-mcp',
      path: path.join(__dirname, '../../third/legal-mcp/js_legal'),
      scriptPath: path.join(__dirname, '../../third/legal-mcp/js_legal', 'build/index.js'),
      config: {
        command: 'node',
        args: ['build/index.js'],
        cwd: path.join(__dirname, '../../third/legal-mcp/js_legal')
      }
    }
  ];

  Logger.info('MCP servers configuration', {
    serverCount: servers.length,
    servers: servers.map(s => ({
      name: s.name,
      // Mask script path for security
      scriptPath: '********' + s.scriptPath.slice(-4),
      command: s.config.command,
      args: s.config.args
    }))
  });

  const successfulServers: string[] = [];
  const failedServers: Array<{ name: string; error: string }> = [];

  for (const server of servers) {
    try {
      Logger.info(`=== INITIALIZING MCP SERVER: ${server.name} ===`, {
        timestamp: new Date().toISOString()
      });

      Logger.debug(`Checking ${server.name} server files`, {
        path: '********' + server.path.slice(-4),
        scriptPath: '********' + server.scriptPath.slice(-4),
        exists: fs.existsSync(server.scriptPath)
      });
      
      if (!fs.existsSync(server.scriptPath)) {
        throw new Error(`${server.name} script not found at ${server.scriptPath}`);
      }
      
      Logger.info(`Connecting to ${server.name} server`, {
        path: '********' + server.path.slice(-4),
        command: server.config.command,
        args: server.config.args,
        cwd: '********' + server.config.cwd.slice(-4)
      });
      
      const startTime = Date.now();
      await mcpManager.connect(server.name, server.config);
      const duration = Date.now() - startTime;
      
      Logger.info(`${server.name} server connected successfully`, {
        duration: `${duration}ms`
      });
      successfulServers.push(server.name);
      
      Logger.info(`=== MCP SERVER ${server.name} INITIALIZED ===`, {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      });
    } catch (error) {
      const errorMsg = (error as Error).message;
      Logger.error(`=== FAILED TO INITIALIZE ${server.name} SERVER ===`, {
        error: errorMsg,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString()
      });
      failedServers.push({ name: server.name, error: errorMsg });
    }
  }

  // Log summary
  Logger.info('=== MCP SERVERS INITIALIZATION SUMMARY ===', {
    total: servers.length,
    successful: successfulServers.length,
    failed: failedServers.length,
    successfulServers,
    failedServers: failedServers.map(f => ({ name: f.name, error: f.error })),
    timestamp: new Date().toISOString()
  });

  if (successfulServers.length === 0) {
    Logger.warn('No MCP servers were successfully initialized. Agent will run without MCP tools.');
  } else if (failedServers.length > 0) {
    Logger.warn(`Some MCP servers failed to initialize. Using ${successfulServers.length}/${servers.length} servers.`);
  }
}

/**
 * Get all MCP tools as LangChain tools
 */
export async function getMCPTools() {
  return await convertMCPToolsToLangChain();
}

/**
 * Cleanup MCP connections
 */
export async function cleanupMCPServers(): Promise<void> {
  Logger.info('Cleaning up MCP servers...');
  await mcpManager.disconnectAll();
}
