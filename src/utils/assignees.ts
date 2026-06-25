import { normalizeText } from './normalizeText';

export interface AssigneeName {
  label: string;
  normalized: string;
}

export function splitAssignees(value: string): AssigneeName[] {
  const seen = new Set<string>();
  const people: AssigneeName[] = [];

  for (const rawPart of value.split(',')) {
    const label = rawPart.trim().replace(/\s+/g, ' ');
    const normalized = normalizeText(label);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    people.push({ label, normalized });
  }

  return people;
}

export function assigneeTextMatches(value: string, selectedAssignees: Set<string>): boolean {
  if (selectedAssignees.size === 0) {
    return true;
  }

  return splitAssignees(value).some((person) => selectedAssignees.has(person.normalized));
}
