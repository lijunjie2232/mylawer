#!/usr/bin/env node
/**
 * MCP Server Diagnostic Tool
 * This script helps diagnose MCP server connection issues
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${result.status}] ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
  console.log();
}

async function testFileExists(name: string, filePath: string): Promise<TestResult> {
  try {
    const exists = fs.existsSync(filePath);
    return {
      name,
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? `File exists: ${filePath}` : `File not found: ${filePath}`,
      details: { path: filePath, exists }
    };
  } catch (error) {
    return {
      name,
      status: 'FAIL',
      message: `Error checking file: ${(error as Error).message}`,
      details: { path: filePath, error: (error as Error).message }
    };
  }
}

async function testNodeExecutable(): Promise<TestResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--version']);
    let output = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({
        name: 'Node.js Executable',
        status: code === 0 ? 'PASS' : 'FAIL',
        message: code === 0 ? `Node.js version: ${output.trim()}` : 'Failed to execute node',
        details: { exitCode: code, output: output.trim() }
      });
    });
    
    proc.on('error', (error) => {
      resolve({
        name: 'Node.js Executable',
        status: 'FAIL',
        message: `Error executing node: ${error.message}`,
        details: { error: error.message }
      });
    });
  });
}

async function testMCPServerStartup(name: string, cwd: string, scriptPath: string, timeoutMs: number = 10000): Promise<TestResult> {
  return new Promise((resolve) => {
    console.log(`Testing ${name} startup...`);
    
    const proc = spawn('node', [scriptPath], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    let hasOutput = false;
    let resolved = false;
    
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({
          name: `${name} Startup`,
          status: 'WARNING',
          message: `Server started but no initialization detected within ${timeoutMs}ms`,
          details: { stdout: stdout.trim(), stderr: stderr.trim() }
        });
      }
    }, timeoutMs);
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      hasOutput = true;
      console.log(`  [${name} stdout] ${text.trim()}`);
      
      // Check for common success indicators
      if (text.includes('ready') || text.includes('initialized') || text.includes('listening') || text.includes('started')) {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve({
            name: `${name} Startup`,
            status: 'PASS',
            message: `Server started successfully`,
            details: { stdout: stdout.trim() }
          });
        }
      }
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.log(`  [${name} stderr] ${text.trim()}`);
    });
    
    proc.on('error', (error) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({
          name: `${name} Startup`,
          status: 'FAIL',
          message: `Failed to spawn process: ${error.message}`,
          details: { error: error.message }
        });
      }
    });
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({
          name: `${name} Startup`,
          status: code === 0 || hasOutput ? 'WARNING' : 'FAIL',
          message: code === 0 ? 'Process exited cleanly' : `Process exited with code ${code}`,
          details: { exitCode: code, stdout: stdout.trim(), stderr: stderr.trim() }
        });
      }
    });
  });
}

async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('MCP Server Diagnostic Tool');
  console.log('='.repeat(60));
  console.log();
  
  // Test Node.js
  const nodeTest = await testNodeExecutable();
  results.push(nodeTest);
  logResult(nodeTest);
  
  // Test webmcp
  const webmcpPath = path.join(__dirname, '../third/webmcp');
  const webmcpScript = path.join(webmcpPath, 'src/SearchMCPServer.js');
  
  const webmcpExists = await testFileExists('webmcp Script', webmcpScript);
  results.push(webmcpExists);
  logResult(webmcpExists);
  
  if (webmcpExists.status === 'PASS') {
    const webmcpStartup = await testMCPServerStartup('webmcp', webmcpPath, 'src/SearchMCPServer.js');
    results.push(webmcpStartup);
    logResult(webmcpStartup);
  }
  
  // Test legal-mcp
  const legalMcpPath = path.join(__dirname, '../third/legal-mcp/js_legal');
  const legalMcpScript = path.join(legalMcpPath, 'build/index.js');
  
  const legalMcpExists = await testFileExists('legal-mcp Script', legalMcpScript);
  results.push(legalMcpExists);
  logResult(legalMcpExists);
  
  if (legalMcpExists.status === 'PASS') {
    const legalMcpStartup = await testMCPServerStartup('legal-mcp', legalMcpPath, 'build/index.js');
    results.push(legalMcpStartup);
    logResult(legalMcpStartup);
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARNING').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Warnings: ${warnCount}`);
  console.log();
  
  if (failCount > 0) {
    console.log('❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('⚠️  Some tests have warnings. Review the details above.');
    process.exit(0);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

runDiagnostics().catch(error => {
  console.error('Diagnostic tool error:', error);
  process.exit(1);
});
