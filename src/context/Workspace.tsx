import { createContext, useContext, type ReactNode } from "react";
import { useCloudSave } from "../hooks/useCloudSave";
import { useConversion } from "../hooks/useConversion";
import { useSettings } from "../hooks/useSettings";

function useWorkspaceState() {
  const settings = useSettings();
  const conversion = useConversion(settings);
  const cloud = useCloudSave({ playlist: conversion.playlist, format: settings.format, title: conversion.fileName });
  return { settings, conversion, cloud };
}

type Workspace = ReturnType<typeof useWorkspaceState>;

const WorkspaceContext = createContext<Workspace | null>(null);

/**
 * Holds the current document, its processing and its audio above the pages, so
 * switching between Create and Library doesn't cancel or lose work in progress.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}
