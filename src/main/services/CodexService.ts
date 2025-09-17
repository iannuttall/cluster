import { spawn, exec, execFile, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface CodexAgent {
  id: string;
  workspaceId: string;
  worktreePath: string;
  status: 'idle' | 'running' | 'error';
  lastMessage?: string;
  lastResponse?: string;
}

export interface CodexResponse {
  success: boolean;
  output?: string;
  error?: string;
  agentId: string;
}

export class CodexService extends EventEmitter {
  private agents: Map<string, CodexAgent> = new Map();
  private isCodexInstalled: boolean | null = null;
  private runningProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();
  private streamLogWriters: Map<string, WriteStream> = new Map();
  private pendingCancellationLogs: Set<string> = new Set();

  constructor() {
    super();
    this.checkCodexInstallation();
  }

  private getStreamLogPath(agent: CodexAgent): string {
    return path.join(agent.worktreePath, 'codex-stream.log');
  }

  private initializeStreamLog(workspaceId: string, agent: CodexAgent, prompt: string): void {
    const logPath = this.getStreamLogPath(agent);
    const directory = path.dirname(logPath);

    this.pendingCancellationLogs.delete(workspaceId);

    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    const existing = this.streamLogWriters.get(workspaceId);
    if (existing && !existing.destroyed) {
      existing.end();
    }

    const header = [
      `=== Codex Stream ${new Date().toISOString()} ===`,
      `Workspace ID: ${workspaceId}`,
      `Worktree: ${agent.worktreePath}`,
      'Prompt:',
      prompt,
      '',
      '--- Output ---',
      '',
    ].join('\n');

    const stream = createWriteStream(logPath, { flags: 'w', encoding: 'utf8' });
    stream.on('error', (error) => {
      console.error('Failed to write codex stream log:', error);
    });

    stream.write(header);
    this.streamLogWriters.set(workspaceId, stream);
  }

  private appendStreamLog(workspaceId: string, content: string): void {
    const writer = this.streamLogWriters.get(workspaceId);
    if (!writer || writer.destroyed) {
      return;
    }

    writer.write(content);
  }

  private finalizeStreamLog(workspaceId: string): void {
    this.pendingCancellationLogs.delete(workspaceId);

    const writer = this.streamLogWriters.get(workspaceId);
    if (!writer) {
      return;
    }

    if (!writer.destroyed) {
      writer.end();
    }

    this.streamLogWriters.delete(workspaceId);
  }

  /**
   * Check if Codex CLI is installed
   */
  private async checkCodexInstallation(): Promise<boolean> {
    try {
      await execAsync('codex --version');
      this.isCodexInstalled = true;
      console.log('Codex CLI is installed');
      return true;
    } catch (error) {
      this.isCodexInstalled = false;
      console.log('Codex CLI is not installed');
      return false;
    }
  }

  /**
   * Get installation status
   */
  public async getInstallationStatus(): Promise<boolean> {
    if (this.isCodexInstalled === null) {
      return await this.checkCodexInstallation();
    }
    return this.isCodexInstalled;
  }

  /**
   * Create a new Codex agent for a workspace
   */
  public async createAgent(workspaceId: string, worktreePath: string): Promise<CodexAgent> {
    const agentId = `agent-${workspaceId}-${Date.now()}`;

    const agent: CodexAgent = {
      id: agentId,
      workspaceId,
      worktreePath,
      status: 'idle',
    };

    this.agents.set(agentId, agent);
    console.log(`Created Codex agent ${agentId} for workspace ${workspaceId}`);

    return agent;
  }

  /**
   * Send message to a Codex agent with streaming output
   */
  public async sendMessageStream(workspaceId: string, message: string): Promise<void> {
    // Find agent for this workspace
    const agent = Array.from(this.agents.values()).find((a) => a.workspaceId === workspaceId);

    if (!agent) {
      this.emit('codex:error', { workspaceId, error: 'No agent found for this workspace' });
      return;
    }

    if (!this.isCodexInstalled) {
      // Initialize a log so the user can read the failure in the stream file too
      this.initializeStreamLog(workspaceId, agent, message);
      this.appendStreamLog(
        workspaceId,
        '\n[ERROR] Codex CLI is not installed. Please install it with: npm install -g @openai/codex\n'
      );
      this.finalizeStreamLog(workspaceId);
      this.emit('codex:error', {
        workspaceId,
        error: 'Codex CLI is not installed. Please install it with: npm install -g @openai/codex',
      });
      return;
    }

    // If a stream is already running for this workspace, stop it first
    if (this.runningProcesses.has(workspaceId)) {
      await this.stopMessageStream(workspaceId);
    }

    // Update agent status
    agent.status = 'running';
    agent.lastMessage = message;
    agent.lastResponse = agent.lastResponse || '';

    try {
      // Spawn codex directly with args to avoid shell quoting issues (backticks, quotes, etc.)
      const args = ['exec', '--sandbox', 'workspace-write', message];
      console.log(
        `Executing: codex ${args.map((a) => (a.includes(' ') ? '"' + a + '"' : a)).join(' ')} in ${agent.worktreePath}`
      );

      this.initializeStreamLog(workspaceId, agent, message);

      const child = spawn('codex', args, {
        cwd: agent.worktreePath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.runningProcesses.set(workspaceId, child);

      // Stream stdout
      child.stdout.on('data', (data) => {
        const output = data.toString();
        // Append to log and accumulate latest streaming output
        this.appendStreamLog(workspaceId, output);
        agent.lastResponse = (agent.lastResponse || '') + output;
        this.emit('codex:output', { workspaceId, output, agentId: agent.id });
      });

      // Stream stderr
      child.stderr.on('data', (data) => {
        const error = data.toString();
        this.appendStreamLog(workspaceId, `\n[ERROR] ${error}\n`);
        this.emit('codex:error', { workspaceId, error, agentId: agent.id });
      });

      // Handle completion
      child.on('close', (code) => {
        this.runningProcesses.delete(workspaceId);
        agent.status = 'idle';
        console.log(`Codex completed with code ${code} in ${agent.worktreePath}`);
        const exitCode = code !== null && code !== undefined ? code : 'null';
        this.appendStreamLog(workspaceId, `\n[COMPLETE] exit code ${exitCode}\n`);
        if (!this.pendingCancellationLogs.has(workspaceId)) {
          this.finalizeStreamLog(workspaceId);
        }
        this.emit('codex:complete', { workspaceId, exitCode: code, agentId: agent.id });
      });

      // Handle errors
      child.on('error', (error) => {
        agent.status = 'error';
        console.error(`Error executing Codex in ${agent.worktreePath}:`, error.message);
        this.runningProcesses.delete(workspaceId);
        this.appendStreamLog(workspaceId, `\n[ERROR] ${error.message}\n`);
        this.pendingCancellationLogs.delete(workspaceId);
        this.finalizeStreamLog(workspaceId);
        this.emit('codex:error', { workspaceId, error: error.message, agentId: agent.id });
      });
    } catch (error: any) {
      agent.status = 'error';
      console.error(`Error executing Codex in ${agent.worktreePath}:`, error.message);
      this.runningProcesses.delete(workspaceId);
      this.appendStreamLog(workspaceId, `\n[ERROR] ${error.message}\n`);
      this.pendingCancellationLogs.delete(workspaceId);
      this.finalizeStreamLog(workspaceId);
      this.emit('codex:error', { workspaceId, error: error.message, agentId: agent.id });
    }
  }

  public async stopMessageStream(workspaceId: string): Promise<boolean> {
    const process = this.runningProcesses.get(workspaceId);
    if (!process) {
      console.log('[CodexService] stopMessageStream: no running process for', workspaceId);
      this.pendingCancellationLogs.delete(workspaceId);
      return true;
    }

    const agent = Array.from(this.agents.values()).find((a) => a.workspaceId === workspaceId);
    this.pendingCancellationLogs.add(workspaceId);

    const result = await new Promise<boolean>((resolve, reject) => {
      console.log('[CodexService] stopMessageStream: attempting to stop process', workspaceId);
      const cleanup = () => {
        process.removeListener('close', handleClose);
        process.removeListener('error', handleError);
      };

      const handleClose = () => {
        console.log('[CodexService] stopMessageStream: process closed', workspaceId);
        this.appendStreamLog(workspaceId, '\n[CANCELLED] Codex stream stopped by user\n');
        this.pendingCancellationLogs.delete(workspaceId);
        this.finalizeStreamLog(workspaceId);
        cleanup();
        resolve(true);
      };

      const handleError = (error: Error) => {
        console.error('[CodexService] stopMessageStream: process error', workspaceId, error);
        this.pendingCancellationLogs.delete(workspaceId);
        cleanup();
        reject(error);
      };

      process.once('close', handleClose);
      process.once('error', handleError);

      try {
        const killed = process.kill('SIGINT');
        if (!killed) {
          console.warn('[CodexService] stopMessageStream: SIGINT not delivered, sending SIGTERM', workspaceId);
          process.kill('SIGTERM');
        }
      } catch (err: any) {
        if (err && typeof err === 'object' && err.code === 'ESRCH') {
          console.warn('[CodexService] stopMessageStream: process already exited', workspaceId);
          cleanup();
          resolve(true);
          return;
        }
        console.error('[CodexService] stopMessageStream: error sending signal', workspaceId, err);
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
    }).catch((error) => {
      console.error('Failed to stop Codex stream:', error);
      return false;
    });

    this.runningProcesses.delete(workspaceId);
    if (agent) {
      agent.status = 'idle';
    }

    return result;
  }

  /**
   * Send a message to a Codex agent (non-streaming)
   */
  public async sendMessage(workspaceId: string, message: string): Promise<CodexResponse> {
    // Find agent for this workspace
    const agent = Array.from(this.agents.values()).find((a) => a.workspaceId === workspaceId);

    if (!agent) {
      return {
        success: false,
        error: 'No agent found for this workspace',
        agentId: '',
      };
    }

    if (!this.isCodexInstalled) {
      return {
        success: false,
        error: 'Codex CLI is not installed. Please install it with: npm install -g @openai/codex',
        agentId: agent.id,
      };
    }

    // Update agent status
    agent.status = 'running';
    agent.lastMessage = message;

    try {
      const args = ['exec', '--sandbox', 'workspace-write', message];
      console.log(
        `Executing: codex ${args.map((a) => (a.includes(' ') ? '"' + a + '"' : a)).join(' ')} in ${agent.worktreePath}`
      );

      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile('codex', args, { cwd: agent.worktreePath, timeout: 60000 }, (error, stdout, stderr) => {
          if (error) {
            (error as any).stderr = stderr;
            (error as any).stdout = stdout;
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });

      agent.status = 'idle';
      agent.lastResponse = stdout;

      console.log(`Codex completed in ${agent.worktreePath}`);
      console.log('Codex stdout:', stdout);
      console.log('Codex stderr:', stderr);

      return {
        success: true,
        output: stdout,
        agentId: agent.id,
      };
    } catch (error: any) {
      agent.status = 'error';

      let errorMessage = 'Unknown error occurred';
      if (error.code === 'ENOENT') {
        errorMessage = 'Codex CLI not found. Please install it with: npm install -g @openai/codex';
      } else if (error.code === 'TIMEOUT') {
        errorMessage = 'Codex command timed out';
      } else if (error.stderr) {
        errorMessage = error.stderr;
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error(`Error executing Codex in ${agent.worktreePath}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        agentId: agent.id,
      };
    }
  }

  /**
   * Get agent status
   */
  public getAgentStatus(workspaceId: string): CodexAgent | null {
    return Array.from(this.agents.values()).find((a) => a.workspaceId === workspaceId) || null;
  }

  /**
   * Get all agents
   */
  public getAllAgents(): CodexAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Remove an agent
   */
  public removeAgent(workspaceId: string): boolean {
    const agent = Array.from(this.agents.values()).find((a) => a.workspaceId === workspaceId);
    if (agent) {
      this.agents.delete(agent.id);
      console.log(`Removed agent ${agent.id} for workspace ${workspaceId}`);
      return true;
    }
    return false;
  }

  /**
   * Get installation instructions
   */
  public getInstallationInstructions(): string {
    return `To install Codex CLI, run one of these commands:

npm install -g @openai/codex

or

brew install codex

After installation, authenticate with:
codex

Then try again!`;
  }
}

// Singleton instance
export const codexService = new CodexService();
