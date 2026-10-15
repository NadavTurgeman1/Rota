import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import type { WorkspaceUser } from "../workspace/workspace";

export function accessLabel(lang: Lang, access: WorkspaceUser["access"]): string {
  const t = copy[lang];
  return access === "owner" ? t.accessOwner : access === "write" ? t.accessWrite : t.accessRead;
}
