export const IO_CHANNELS = {
  qa: "desktop:io:qa",
  knowledge: "desktop:io:knowledge",
  repos: "desktop:io:repos",
  agents: "desktop:io:agents",
  skills: "desktop:io:skills"
} as const;

export type IOProviderName = keyof typeof IO_CHANNELS;

export const FILE_DROP_INVOKE_CHANNEL = "desktop:files:dropped:invoke";
export const FILE_DROP_EVENT_CHANNEL = "desktop:files:dropped:event";
export const FILE_PICK_INVOKE_CHANNEL = "desktop:files:pick:invoke";
export const SEARCH_FOCUS_MAIN_CHANNEL = "desktop:search:focus-main";
export const SEARCH_QUERY_EVENT_CHANNEL = "desktop:search:query";
export const DESKTOP_RUNTIME_GET_STATE_CHANNEL = "desktop:runtime:get-state";
export const DESKTOP_RUNTIME_RESTART_CHANNEL = "desktop:runtime:restart";
export const DESKTOP_RUNTIME_OPEN_LOGS_CHANNEL = "desktop:runtime:open-logs";
export const DESKTOP_RUNTIME_STATE_EVENT_CHANNEL = "desktop:runtime:state";
