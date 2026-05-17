/**
 * Test script for ALLOWED_MCP_TOOLS configuration
 * This script tests the MCP tool filtering functionality
 */

import { config } from '../src/config/environment.js';
import { mcpManager } from '../src/mcp/mcpClientManager.js';
import { convertMCPToolsToLangChain } from '../src/mcp/mcpToolAdapter.js';
import { Logger } from '../src/utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMCPToolFiltering() {
  console.log('\n=== Testing MCP Tool Filtering ===\n');
  
  // Display current configuration
  console.log('Current ALLOWED_MCP_TOOLS configuration:', config.mcp.allowedTools || '(not set - all tools allowed)');
  console.log('');

  const servers = [
    {
      name: 'webmcp',
      config: {
        command: 'node',
        args: ['src/MCPServerWrapper.js'],
        cwd: path.join(__dirname, '../third/webmcp')
      }
    },
    {
      name: 'legal-mcp',
      config: {
        command: 'node',
        args: ['build/index.js'],
        cwd: path.join(__dirname, '../third/legal-mcp/js_legal')
      }
    }
  ];

  // Connect to MCP servers
  console.log('Connecting to MCP servers...');
  for (const server of servers) {
    try {
      await mcpManager.connect(server.name, server.config);
      console.log(`✓ Connected to ${server.name}`);
    } catch (error) {
      console.error(`✗ Failed to connect to ${server.name}:`, (error as Error).message);
    }
  }
  console.log('');

  // Get all available tools
  const allTools = await mcpManager.getAllTools();
  console.log(`Total available MCP tools: ${allTools.length}`);
  allTools.forEach(tool => {
    console.log(`  - ${tool.serverName}_${tool.name}`);
  });
  console.log('');

  // Convert to LangChain tools (with filtering applied)
  console.log('Converting MCP tools to LangChain tools (with filtering)...');
  const langchainTools = await convertMCPToolsToLangChain();
  console.log(`Converted tools count: ${langchainTools.length}`);
  langchainTools.forEach(tool => {
    console.log(`  - ${tool.name}`);
  });
  console.log('');

  // Verify filtering
  if (config.mcp.allowedTools && config.mcp.allowedTools.length > 0) {
    console.log('✓ Filtering is enabled');
    console.log(`  Allowed tools: ${config.mcp.allowedTools.join(', ')}`);
    
    const filteredCount = allTools.length - langchainTools.length;
    console.log(`  Filtered out: ${filteredCount} tools`);
    
    // Check if all converted tools are in the allowed list
    const allAllowed = langchainTools.every(tool => 
      config.mcp.allowedTools!.includes(tool.name)
    );
    
    if (allAllowed) {
      console.log('✓ All converted tools are in the allowed list');
    } else {
      console.log('✗ ERROR: Some converted tools are NOT in the allowed list');
    }
  } else {
    console.log('✓ No filtering configured - all tools are allowed');
    if (langchainTools.length === allTools.length) {
      console.log('✓ All available tools were converted');
    } else {
      console.log('✗ WARNING: Not all tools were converted');
    }
  }

  // Cleanup
  console.log('\nCleaning up...');
  await mcpManager.disconnectAll();
  console.log('✓ Disconnected from all MCP servers\n');
}

// Run the test
testMCPToolFiltering().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
