export type ReactionType = "like" | "helpful" | "concern";

export type ReportComment = {
  id: string;
  uid: string;
  displayName: string;
  /** Initials seed or remote photo URL */
  photoURL: string | null;
  text: string;
  createdAt: string;
};

export type ReportReaction = {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  type: ReactionType;
  createdAt: string;
};

export type ReactionCounts = Record<ReactionType, number>;

export const EMPTY_REACTION_COUNTS: ReactionCounts = {
  like: 0,
  helpful: 0,
  concern: 0,
};

export const REACTION_META: {
  type: ReactionType;
  label: string;
}[] = [
  { type: "like", label: "Like" },
  { type: "helpful", label: "Helpful" },
  { type: "concern", label: "Concern" },
];
