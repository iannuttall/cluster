import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  
  // PTY management
  ptyStart: (opts: { id: string; cwd?: string; shell?: string; env?: Record<string, string>; cols?: number; rows?: number; }) =>
    ipcRenderer.invoke('pty:start', opts),
  ptyInput: (args: { id: string; data: string }) =>
    ipcRenderer.send('pty:input', args),
  ptyResize: (args: { id: string; cols: number; rows: number }) =>
    ipcRenderer.send('pty:resize', args),
  ptyKill: (id: string) => ipcRenderer.send('pty:kill', { id }),
  
  onPtyData: (id: string, listener: (data: string) => void) => {
    const channel = `pty:data:${id}`
    const wrapped = (_: Electron.IpcRendererEvent, data: string) => listener(data)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  onPtyExit: (id: string, listener: (info: { exitCode: number; signal?: number }) => void) => {
    const channel = `pty:exit:${id}`
    const wrapped = (_: Electron.IpcRendererEvent, info: { exitCode: number; signal?: number }) => listener(info)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },

  // Worktree management
  worktreeCreate: (args: { projectPath: string; workspaceName: string; projectId: string }) =>
    ipcRenderer.invoke('worktree:create', args),
  worktreeList: (args: { projectPath: string }) =>
    ipcRenderer.invoke('worktree:list', args),
  worktreeRemove: (args: { projectPath: string; worktreeId: string }) =>
    ipcRenderer.invoke('worktree:remove', args),
  worktreeStatus: (args: { worktreePath: string }) =>
    ipcRenderer.invoke('worktree:status', args),
  worktreeMerge: (args: { projectPath: string; worktreeId: string }) =>
    ipcRenderer.invoke('worktree:merge', args),
  worktreeGet: (args: { worktreeId: string }) =>
    ipcRenderer.invoke('worktree:get', args),
  worktreeGetAll: () =>
    ipcRenderer.invoke('worktree:getAll'),

  // Project management
  openProject: () => ipcRenderer.invoke('project:open'),
  getGitInfo: (projectPath: string) => ipcRenderer.invoke('git:getInfo', projectPath),
  getGitStatus: (workspacePath: string) => ipcRenderer.invoke('git:get-status', workspacePath),
  gitCommitAndPush: (args: { workspacePath: string; commitMessage?: string; createBranchIfOnDefault?: boolean; branchPrefix?: string }) =>
    ipcRenderer.invoke('git:commit-and-push', args),
  createPullRequest: (args: { workspacePath: string; title?: string; body?: string; base?: string; head?: string; draft?: boolean; web?: boolean; fill?: boolean }) =>
    ipcRenderer.invoke('git:create-pr', args),
  connectToGitHub: (projectPath: string) => ipcRenderer.invoke('github:connect', projectPath),
  
  // Repository management
  scanRepos: () => ipcRenderer.invoke('repos:scan'),
  addRepo: (path: string) => ipcRenderer.invoke('repos:add', path),
  
  // Filesystem
  fsList: (root: string, opts?: { includeDirs?: boolean; maxEntries?: number }) =>
    ipcRenderer.invoke('fs:list', { root, ...(opts || {}) }),
  fsRead: (root: string, relPath: string, maxBytes?: number) =>
    ipcRenderer.invoke('fs:read', { root, relPath, maxBytes }),
  
  // Run management
  createRun: (config: any) => ipcRenderer.invoke('runs:create', config),
  cancelRun: (runId: string) => ipcRenderer.invoke('runs:cancel', runId),
  getRunDiff: (runId: string) => ipcRenderer.invoke('runs:diff', runId),
  onRunEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('run:event', (_, event) => callback(event))
  },
  removeRunEventListeners: () => {
    ipcRenderer.removeAllListeners('run:event')
  },
  
  // GitHub integration
  githubAuth: () => ipcRenderer.invoke('github:auth'),
  githubIsAuthenticated: () => ipcRenderer.invoke('github:isAuthenticated'),
  githubGetUser: () => ipcRenderer.invoke('github:getUser'),
  githubGetRepositories: () => ipcRenderer.invoke('github:getRepositories'),
  githubCloneRepository: (repoUrl: string, localPath: string) => ipcRenderer.invoke('github:cloneRepository', repoUrl, localPath),
  githubLogout: () => ipcRenderer.invoke('github:logout'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  
  // Database methods
  getProjects: () => ipcRenderer.invoke('db:getProjects'),
  saveProject: (project: any) => ipcRenderer.invoke('db:saveProject', project),
  getWorkspaces: (projectId?: string) => ipcRenderer.invoke('db:getWorkspaces', projectId),
  saveWorkspace: (workspace: any) => ipcRenderer.invoke('db:saveWorkspace', workspace),
  deleteProject: (projectId: string) => ipcRenderer.invoke('db:deleteProject', projectId),
  deleteWorkspace: (workspaceId: string) => ipcRenderer.invoke('db:deleteWorkspace', workspaceId),

  // Conversation management
  saveConversation: (conversation: any) => ipcRenderer.invoke('db:saveConversation', conversation),
  getConversations: (workspaceId: string) => ipcRenderer.invoke('db:getConversations', workspaceId),
  getOrCreateDefaultConversation: (workspaceId: string) => ipcRenderer.invoke('db:getOrCreateDefaultConversation', workspaceId),
  saveMessage: (message: any) => ipcRenderer.invoke('db:saveMessage', message),
  getMessages: (conversationId: string) => ipcRenderer.invoke('db:getMessages', conversationId),
  deleteConversation: (conversationId: string) => ipcRenderer.invoke('db:deleteConversation', conversationId),

  // Codex integration
  codexCheckInstallation: () => ipcRenderer.invoke('codex:check-installation'),
  codexCreateAgent: (workspaceId: string, worktreePath: string) => ipcRenderer.invoke('codex:create-agent', workspaceId, worktreePath),
  codexSendMessage: (workspaceId: string, message: string) => ipcRenderer.invoke('codex:send-message', workspaceId, message),
  codexSendMessageStream: (workspaceId: string, message: string) => ipcRenderer.invoke('codex:send-message-stream', workspaceId, message),
  codexGetAgentStatus: (workspaceId: string) => ipcRenderer.invoke('codex:get-agent-status', workspaceId),
  codexGetAllAgents: () => ipcRenderer.invoke('codex:get-all-agents'),
  codexRemoveAgent: (workspaceId: string) => ipcRenderer.invoke('codex:remove-agent', workspaceId),
  codexGetInstallationInstructions: () => ipcRenderer.invoke('codex:get-installation-instructions'),
  
  // Streaming event listeners
  onCodexStreamOutput: (listener: (data: { workspaceId: string; output: string; agentId: string }) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: { workspaceId: string; output: string; agentId: string }) => listener(data)
    ipcRenderer.on('codex:stream-output', wrapped)
    return () => ipcRenderer.removeListener('codex:stream-output', wrapped)
  },
  onCodexStreamError: (listener: (data: { workspaceId: string; error: string; agentId: string }) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: { workspaceId: string; error: string; agentId: string }) => listener(data)
    ipcRenderer.on('codex:stream-error', wrapped)
    return () => ipcRenderer.removeListener('codex:stream-error', wrapped)
  },
  onCodexStreamComplete: (listener: (data: { workspaceId: string; exitCode: number; agentId: string }) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: { workspaceId: string; exitCode: number; agentId: string }) => listener(data)
    ipcRenderer.on('codex:stream-complete', wrapped)
    return () => ipcRenderer.removeListener('codex:stream-complete', wrapped)
  },
})

// Type definitions for the exposed API
export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  
  // PTY management
  ptyStart: (opts: { id: string; cwd?: string; shell?: string; env?: Record<string, string>; cols?: number; rows?: number; }) => Promise<{ ok: boolean }>
  ptyInput: (args: { id: string; data: string }) => void
  ptyResize: (args: { id: string; cols: number; rows: number }) => void
  ptyKill: (id: string) => void
  onPtyData: (id: string, listener: (data: string) => void) => () => void
  onPtyExit: (id: string, listener: (info: { exitCode: number; signal?: number }) => void) => () => void
  // Worktree management
  worktreeCreate: (args: { projectPath: string; workspaceName: string; projectId: string }) => Promise<{ success: boolean; worktree?: any; error?: string }>
  worktreeList: (args: { projectPath: string }) => Promise<{ success: boolean; worktrees?: any[]; error?: string }>
  worktreeRemove: (args: { projectPath: string; worktreeId: string }) => Promise<{ success: boolean; error?: string }>
  worktreeStatus: (args: { worktreePath: string }) => Promise<{ success: boolean; status?: any; error?: string }>
  worktreeMerge: (args: { projectPath: string; worktreeId: string }) => Promise<{ success: boolean; error?: string }>
  worktreeGet: (args: { worktreeId: string }) => Promise<{ success: boolean; worktree?: any; error?: string }>
  worktreeGetAll: () => Promise<{ success: boolean; worktrees?: any[]; error?: string }>

  // Project management
  openProject: () => Promise<{ success: boolean; path?: string; error?: string }>
  getGitInfo: (projectPath: string) => Promise<{ isGitRepo: boolean; remote?: string; branch?: string; path?: string; error?: string }>
  getGitStatus: (workspacePath: string) => Promise<{ success: boolean; changes?: Array<{ path: string; status: string; additions: number; deletions: number; diff?: string }>; error?: string }>
  gitCommitAndPush: (args: { workspacePath: string; commitMessage?: string; createBranchIfOnDefault?: boolean; branchPrefix?: string }) => Promise<{ success: boolean; branch?: string; output?: string; error?: string }>
  createPullRequest: (args: { workspacePath: string; title?: string; body?: string; base?: string; head?: string; draft?: boolean; web?: boolean; fill?: boolean }) => Promise<{ success: boolean; url?: string; output?: string; error?: string }>
  connectToGitHub: (projectPath: string) => Promise<{ success: boolean; repository?: string; branch?: string; error?: string }>

  
  // Repository management
  scanRepos: () => Promise<any[]>
  addRepo: (path: string) => Promise<any>
  
  // Filesystem
  fsList: (root: string, opts?: { includeDirs?: boolean; maxEntries?: number }) => Promise<{ success: boolean; items?: Array<{ path: string; type: 'file' | 'dir' }>; error?: string }>
  fsRead: (root: string, relPath: string, maxBytes?: number) => Promise<{ success: boolean; path?: string; size?: number; truncated?: boolean; content?: string; error?: string }>
  
  // Run management
  createRun: (config: any) => Promise<string>
  cancelRun: (runId: string) => Promise<void>
  getRunDiff: (runId: string) => Promise<any>
  onRunEvent: (callback: (event: any) => void) => void
  removeRunEventListeners: () => void
  
  // GitHub integration
  githubAuth: () => Promise<{ success: boolean; token?: string; user?: any; error?: string }>
  githubIsAuthenticated: () => Promise<boolean>
  githubGetUser: () => Promise<any>
  githubGetRepositories: () => Promise<any[]>
  githubCloneRepository: (repoUrl: string, localPath: string) => Promise<{ success: boolean; error?: string }>
  githubLogout: () => Promise<void>
  
  // Settings
  getSettings: () => Promise<any>
  updateSettings: (settings: any) => Promise<void>
  
  // Database methods
  getProjects: () => Promise<any[]>
  saveProject: (project: any) => Promise<{ success: boolean; error?: string }>
  getWorkspaces: (projectId?: string) => Promise<any[]>
  saveWorkspace: (workspace: any) => Promise<{ success: boolean; error?: string }>
  deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>
  deleteWorkspace: (workspaceId: string) => Promise<{ success: boolean; error?: string }>

  // Conversation management
  saveConversation: (conversation: any) => Promise<{ success: boolean; error?: string }>
  getConversations: (workspaceId: string) => Promise<{ success: boolean; conversations?: any[]; error?: string }>
  getOrCreateDefaultConversation: (workspaceId: string) => Promise<{ success: boolean; conversation?: any; error?: string }>
  saveMessage: (message: any) => Promise<{ success: boolean; error?: string }>
  getMessages: (conversationId: string) => Promise<{ success: boolean; messages?: any[]; error?: string }>
  deleteConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>

  // Codex integration
  codexCheckInstallation: () => Promise<{ success: boolean; isInstalled?: boolean; error?: string }>
  codexCreateAgent: (workspaceId: string, worktreePath: string) => Promise<{ success: boolean; agent?: any; error?: string }>
  codexSendMessage: (workspaceId: string, message: string) => Promise<{ success: boolean; response?: any; error?: string }>
  codexSendMessageStream: (workspaceId: string, message: string) => Promise<{ success: boolean; error?: string }>
  codexGetAgentStatus: (workspaceId: string) => Promise<{ success: boolean; agent?: any; error?: string }>
  codexGetAllAgents: () => Promise<{ success: boolean; agents?: any[]; error?: string }>
  codexRemoveAgent: (workspaceId: string) => Promise<{ success: boolean; removed?: boolean; error?: string }>
  codexGetInstallationInstructions: () => Promise<{ success: boolean; instructions?: string; error?: string }>
  
  // Streaming event listeners
  onCodexStreamOutput: (listener: (data: { workspaceId: string; output: string; agentId: string }) => void) => () => void
  onCodexStreamError: (listener: (data: { workspaceId: string; error: string; agentId: string }) => void) => () => void
  onCodexStreamComplete: (listener: (data: { workspaceId: string; exitCode: number; agentId: string }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
