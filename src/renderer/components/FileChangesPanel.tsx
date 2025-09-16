import React, { useState } from "react";
import { GitBranch, Plus, Minus, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { useToast } from "../hooks/use-toast";
import { useFileChanges, type FileChange } from "../hooks/useFileChanges";
import FileTypeIcon from "./ui/file-type-icon";

interface FileChangesPanelProps {
  workspaceId: string; // Actually the workspace path
  className?: string;
}

export const FileChangesPanel: React.FC<FileChangesPanelProps> = ({
  workspaceId,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const { fileChanges, isLoading, error, refreshChanges } =
    useFileChanges(workspaceId);
  const { toast } = useToast();

  const getStatusChip = (status: FileChange["status"]) => {
    const map: Record<FileChange["status"], { text: string; cls: string; icon: JSX.Element }> = {
      added: {
        text: "added",
        cls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        icon: <Plus className="w-3 h-3" />,
      },
      modified: {
        text: "modified",
        cls: "bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
        icon: <FileText className="w-3 h-3" />,
      },
      deleted: {
        text: "deleted",
        cls: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        icon: <Minus className="w-3 h-3" />,
      },
      renamed: {
        text: "renamed",
        cls: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        icon: <GitBranch className="w-3 h-3" />,
      },
    };
    const v = map[status];
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${v.cls}`}>
        {v.icon}
        {v.text}
      </span>
    );
  };

  const renderPath = (p: string) => {
    const last = p.lastIndexOf("/");
    const dir = last >= 0 ? p.slice(0, last + 1) : "";
    const base = last >= 0 ? p.slice(last + 1) : p;
    return (
      <span className="truncate">
        {dir && <span className="text-gray-500 dark:text-gray-400">{dir}</span>}
        <span className="text-gray-900 dark:text-gray-100 font-medium">{base}</span>
      </span>
    );
  };

  const totalChanges = fileChanges.reduce(
    (acc, change) => ({
      additions: acc.additions + change.additions,
      deletions: acc.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 }
  );

  if (isLoading) {
    return null;
  }

  if (fileChanges.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-sm ${className}`}
    >
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-auto text-gray-600 dark:text-gray-300"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {fileChanges.length} files changed
              </span>
              <div className="flex items-center space-x-1 text-xs">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  +{totalChanges.additions}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  -{totalChanges.deletions}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              disabled={isCreatingPR}
              onClick={async () => {
                setIsCreatingPR(true);
                try {
                  // 1) Commit and push changes (create feature branch if on default)
                  const commitRes = await window.electronAPI.gitCommitAndPush({
                    workspacePath: workspaceId,
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
                    workspacePath: workspaceId,
                    fill: true,
                  });
                  if (res?.success) {
                    await refreshChanges();
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
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {fileChanges.map((change, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="inline-flex items-center justify-center w-4 h-4 text-gray-500">
                  <FileTypeIcon path={change.path} type={change.status === 'deleted' ? 'file' : 'file'} size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {renderPath(change.path)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {getStatusChip(change.status)}
                {change.additions > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                    +{change.additions}
                  </span>
                )}
                {change.deletions > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                    -{change.deletions}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileChangesPanel;
