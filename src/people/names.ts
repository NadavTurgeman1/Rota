/** Narrow a name list as each letter is typed. Matching is case-insensitive. */
export function filterNames<T extends { name: string }>(people: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return people;
  return people.filter((person) => person.name.toLocaleLowerCase().includes(needle));
}
