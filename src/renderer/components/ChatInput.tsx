import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { ChevronsUpDown, ArrowRight } from "lucide-react";
import openaiLogo from "../../assets/images/openai.png";
import claudeLogo from "../../assets/images/claude.png";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  isCodexInstalled: boolean | null;
  agentCreated: boolean;
  disabled?: boolean;
  workspacePath?: string;
}

import { useFileIndex } from "../hooks/useFileIndex";
import FileTypeIcon from "./ui/file-type-icon";

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  isCodexInstalled,
  agentCreated,
  disabled = false,
  workspacePath,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [provider, setProvider] = useState<"codex" | "claude-code">("codex");
  const providerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // File index for @ mention
  const { search } = useFileIndex(workspacePath);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Memoize results to avoid recomputing on every render while typing
  const mentionResults = React.useMemo(
    () => (mentionOpen ? search(mentionQuery, 12) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentionOpen, mentionQuery]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setIsProviderOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (unless Shift)
    if (e.key === "Enter" && !e.shiftKey && !mentionOpen) {
      e.preventDefault();
      onSend();
      return;
    }

    // Mention navigation
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, Math.max(mentionResults.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const pick = mentionResults[mentionIndex];
        if (pick) applyMention(pick.path);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }
  };

  function openMention(start: number, query: string) {
    setMentionStart(start);
    setMentionQuery(query);
    setMentionIndex(0);
    setMentionOpen(true);
  }

  function closeMention() {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    setMentionIndex(0);
  }

  function detectMention(nextValue: string, caret: number) {
    // Find the nearest '@' to the left of caret that starts a token
    // Token continues until whitespace or line break
    let i = caret - 1;
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === "@") break;
      if (/\s/.test(ch)) return closeMention();
      i--;
    }
    if (i < 0 || nextValue[i] !== "@") return closeMention();

    const start = i; // position of '@'
    const query = nextValue.slice(start + 1, caret);
    openMention(start, query);
  }

  function applyMention(pickPath: string) {
    if (mentionStart == null) return;
    const el = textareaRef.current;
    const caret = el ? el.selectionStart : value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    // Keep leading '@', insert selected relative path
    const next = `${before}@${pickPath}${after}`;
    onChange(next);
    closeMention();
    // Restore caret after inserted text
    requestAnimationFrame(() => {
      if (el) {
        const pos = before.length + 1 + pickPath.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      }
    });
  }

  const getPlaceholder = () => {
    if (!isCodexInstalled) {
      return "Codex CLI not installed...";
    }
    if (!agentCreated) {
      return "Initializing...";
    }
    return "Tell agent what to do...";
  };

  const isDisabled =
    disabled || isLoading || !isCodexInstalled || !agentCreated;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div
          className={`relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md transition-shadow duration-200 ${
            isFocused ? "shadow-2xl" : "shadow-lg"
          }`}
        >
          <div className="p-4">
            <textarea
              ref={textareaRef}
              className="w-full resize-none border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 text-sm placeholder-gray-500 dark:placeholder-gray-400"
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                onChange(next);
                const caret = e.target.selectionStart ?? next.length;
                detectMention(next, caret);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={getPlaceholder()}
              rows={2}
              disabled={isDisabled}
              style={{ minHeight: "56px" }}
            />
            {/* Mention dropdown */}
            {mentionOpen && mentionResults.length > 0 && (
              <div className="absolute left-4 bottom-40 z-20 w-[520px] max-w-[calc(100%-2rem)] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {mentionResults.map((item, idx) => (
                    <button
                      key={`${item.type}:${item.path}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention(item.path);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        idx === mentionIndex ? "bg-gray-100 dark:bg-gray-700" : ""
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-4 h-4 text-gray-500">
                        <FileTypeIcon path={item.path} type={item.type} size={14} />
                      </span>
                      <span className="truncate text-gray-800 dark:text-gray-200">{item.path}</span>
                    </button>
                  ))}
                </div>
                <div className="px-3 py-1 text-[10px] text-gray-500 border-t border-gray-200 dark:border-gray-700">
                  Type to filter files and folders • ↑/↓ to navigate • Enter to insert
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-b-xl">
            <div className="relative inline-block w-[9.5rem]" ref={providerRef}>
              <motion.button
                type="button"
                onClick={() => setIsProviderOpen((o) => !o)}
                className="flex items-center gap-2 h-9 px-3 w-full rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <img
                  src={provider === "claude-code" ? claudeLogo : openaiLogo}
                  alt={provider === "claude-code" ? "Claude" : "OpenAI"}
                  className="w-4 h-4 shrink-0"
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate text-left">
                  {provider === "claude-code" ? "Claude Code" : "Codex"}
                </span>
                <ChevronsUpDown className="w-4 h-4 text-gray-500 shrink-0 ml-auto" />
              </motion.button>

              <AnimatePresence>
                {isProviderOpen && (
                  <motion.div
                    className="absolute left-0 bottom-full mb-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md overflow-hidden z-10"
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, scale: 0.98, y: 4 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      shouldReduceMotion
                        ? { opacity: 1, scale: 1, y: 0 }
                        : { opacity: 0, scale: 0.98, y: 4 }
                    }
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.15, ease: "easeOut" }
                    }
                  >
                    {provider !== "codex" && (
                      <motion.button
                        type="button"
                        onClick={() => {
                          setProvider("codex");
                          setIsProviderOpen(false);
                        }}
                        className="w-full h-9 flex items-center gap-2 px-3 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer text-left"
                      >
                        <img src={openaiLogo} alt="Codex" className="w-4 h-4" />
                        <span className="text-gray-700 dark:text-gray-200">Codex</span>
                      </motion.button>
                    )}
                    {provider !== "claude-code" && (
                      <motion.button
                        type="button"
                        onClick={() => {
                          setProvider("claude-code");
                          setIsProviderOpen(false);
                        }}
                        className="w-full h-9 flex items-center gap-2 px-3 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer text-left"
                      >
                        <img src={claudeLogo} alt="Claude Code" className="w-4 h-4" />
                        <span className="text-gray-700 dark:text-gray-200">Claude Code</span>
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              onClick={onSend}
              disabled={!value.trim() || isDisabled}
              className="h-9 w-9 p-0 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50"
              aria-label="Send"
            >
              {isLoading ? <Spinner size="sm" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
