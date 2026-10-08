import {
  STAFF_RANK_ORDER,
  type StaffMember,
  type StaffRank,
} from "@/lib/staff/types";

export type StaffTreeNode = {
  member: StaffMember;
  children: StaffTreeNode[];
};

export function sortStaff(a: StaffMember, b: StaffMember): number {
  const ra = STAFF_RANK_ORDER[a.rank as StaffRank] ?? 99;
  const rb = STAFF_RANK_ORDER[b.rank as StaffRank] ?? 99;
  if (ra !== rb) return ra - rb;
  return a.displayName.localeCompare(b.displayName);
}

/** Build org trees. Roots = no parent or parent missing in the set. */
export function buildStaffForest(members: StaffMember[]): StaffTreeNode[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const children = new Map<string, StaffMember[]>();

  for (const m of members) {
    const parent =
      m.reportsToId && byId.has(m.reportsToId) ? m.reportsToId : null;
    if (!parent) continue;
    const list = children.get(parent) ?? [];
    list.push(m);
    children.set(parent, list);
  }

  function nodeFor(m: StaffMember): StaffTreeNode {
    const kids = (children.get(m.id) ?? []).sort(sortStaff);
    return { member: m, children: kids.map(nodeFor) };
  }

  const roots = members
    .filter(
      (m) => !m.reportsToId || !byId.has(m.reportsToId),
    )
    .sort(sortStaff);

  return roots.map(nodeFor);
}

export function flattenTree(nodes: StaffTreeNode[]): StaffMember[] {
  const out: StaffMember[] = [];
  function walk(n: StaffTreeNode) {
    out.push(n.member);
    for (const c of n.children) walk(c);
  }
  for (const n of nodes) walk(n);
  return out;
}

export function depthOf(
  memberId: string,
  members: StaffMember[],
): number {
  const byId = new Map(members.map((m) => [m.id, m]));
  let depth = 0;
  let cur = byId.get(memberId);
  const seen = new Set<string>();
  while (cur?.reportsToId && byId.has(cur.reportsToId)) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    depth += 1;
    cur = byId.get(cur.reportsToId);
  }
  return depth;
}
