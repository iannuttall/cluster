import React, { useState } from 'react'
import { Repo, Run } from '../types'
import RunLauncher from './RunLauncher'
import RunList from './RunList'
import { FolderOpen, Github, Globe } from 'lucide-react'

interface MainContentProps {
  selectedRepo: Repo | null
  runs: Run[]
  selectedRun: Run | null
  onRunSelect: (run: Run) => void
  onCreateRun: (config: any) => void
}

const MainContent: React.FC<MainContentProps> = ({
  selectedRepo,
  runs,
  selectedRun,
  onRunSelect,
  onCreateRun,
}) => {
  const [showRunLauncher, setShowRunLauncher] = useState(false)

  const handleCreateRun = (config: any) => {
    onCreateRun(config)
    setShowRunLauncher(false)
  }

  if (!selectedRepo) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-white mb-4" style={{
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              textShadow: '2px 2px 0px #000'
            }}>
              cluster
            </h1>
            <h2 className="text-2xl text-gray-400">Codex</h2>
          </div>

          <div className="flex gap-6 justify-center">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors">
              <div className="flex justify-center mb-3">
                <FolderOpen className="h-12 w-12 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Open Project</h3>
              <p className="text-gray-400 text-sm">Select a repository to get started</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-900 flex flex-col">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {selectedRepo.path.split('/').pop()}
            </h2>
            <p className="text-sm text-gray-400">{selectedRepo.origin}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => setShowRunLauncher(true)}
            >
              Start Run
            </button>
            <button className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors">
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {runs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-white mb-2">No runs yet</h3>
              <p className="text-gray-400 mb-4">Start your first coding agent run</p>
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setShowRunLauncher(true)}
              >
                Create Run
              </button>
            </div>
          </div>
        ) : (
          <RunList
            runs={runs}
            selectedRun={selectedRun}
            onRunSelect={onRunSelect}
          />
        )}
      </div>

      {showRunLauncher && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <RunLauncher
            repo={selectedRepo}
            onCreateRun={handleCreateRun}
            onCancel={() => setShowRunLauncher(false)}
          />
        </div>
      )}
    </div>
  )
}

export default MainContent
