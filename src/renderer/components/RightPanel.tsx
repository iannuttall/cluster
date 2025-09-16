import React, { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { Spinner } from "./ui/spinner";
import { Run } from "../types";

interface RightPanelProps {
  selectedRun: Run | null;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedRun }) => {
  const { toast } = useToast();
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "diff" | "terminal">(
    "logs"
  );
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (selectedRun) {
      // Set up event listener for run events
      const handleRunEvent = (event: any) => {
        if (event.runId === selectedRun.id) {
          setLogs((prev) => [...prev, event]);
        }
      };

      window.electronAPI.onRunEvent(handleRunEvent);

      return () => {
        window.electronAPI.removeRunEventListeners();
      };
    }
  }, [selectedRun]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case "llm":
        return "🤖";
      case "tool":
        return "🔧";
      case "bash":
        return "💻";
      case "git":
        return "📝";
      case "diff":
        return "📊";
      case "error":
        return "❌";
      default:
        return "📄";
    }
  };

  if (!selectedRun) {
    return (
      <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <p>Select a run to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Run Details</h3>
          <div className="flex gap-1">
            <button
              className={`px-2 py-1 text-xs rounded-md border ${
                activeTab === "logs"
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              }`}
              onClick={() => setActiveTab("logs")}
            >
              Logs
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-md border ${
                activeTab === "diff"
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              }`}
              onClick={() => setActiveTab("diff")}
            >
              Diff
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-md border ${
                activeTab === "terminal"
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              }`}
              onClick={() => setActiveTab("terminal")}
            >
              Terminal
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div>Branch: {selectedRun.branch}</div>
          <div>Provider: {selectedRun.provider}</div>
          <div>Status: {selectedRun.status}</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "logs" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <div className="text-2xl mb-2">📝</div>
                  <p>No logs yet</p>
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getEventIcon(log.kind)}</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {log.kind.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {typeof log.payload === "string"
                        ? log.payload
                        : JSON.stringify(log.payload, null, 2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "diff" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <div className="text-2xl mb-2">📊</div>
              <p>Diff view coming soon</p>
            </div>
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <div className="text-2xl mb-2">💻</div>
              <p>Terminal view coming soon</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <button
            className="flex-1 px-3 py-2 bg-gray-900 text-white rounded hover:bg-black transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreatingPR}
            onClick={async () => {
              if (!selectedRun) return;
              setIsCreatingPR(true);
              try {
                // 1) Commit and push changes (create feature branch if on default)
                const commitRes = await window.electronAPI.gitCommitAndPush({
                  workspacePath: selectedRun.worktreePath,
                  commitMessage: 'chore: apply workspace changes',
                  createBranchIfOnDefault: true,
                  branchPrefix: 'orch'
                })

                if (!commitRes?.success) {
                  toast({
                    title: "Commit/Push Failed",
                    description: commitRes?.error || "Unable to push changes.",
                    variant: "destructive",
                  });
                  return;
                }

                // 2) Create PR via GitHub CLI
                const res = await window.electronAPI.createPullRequest({
                  workspacePath: selectedRun.worktreePath,
                  fill: true,
                });
                if (res?.success) {
                  toast({
                    title: "Pull Request Created",
                    description: res.url || "PR created successfully.",
                  });
                } else {
                  toast({
                    title: "Failed to Create PR",
                    description: res?.error || "Unknown error",
                    variant: "destructive",
                  });
                }
              } finally {
                setIsCreatingPR(false);
              }
            }}
          >
            {isCreatingPR ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              "Create PR"
            )}
          </button>
          {selectedRun.status === "running" && (
            <button className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
