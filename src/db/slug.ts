const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A unique slug. Hebrew names keep their digits and gain part of the id. */
export function orgSlug(name: string, id: string): string {
  const ascii = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const suffix = id.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 8) || "id";
  const slug = `${ascii || "org"}-${suffix}`;
  return SLUG.test(slug) ? slug : `org-${suffix}`;
}
