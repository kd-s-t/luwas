/**
 * Statutory barangay org chart (Local Government Code) with demo officer names.
 * Names are illustrative for Cup demos — not live DILG / COMELEC rolls.
 */

export type OrgPerson = {
  id: string;
  role: string;
  name: string;
  office: string;
};

/** One horizontal band of the hierarchy pyramid (top → bottom). */
export type PyramidLevel = {
  id: string;
  label: string;
  /** Width of this band as % of the pyramid base (visual taper). */
  widthPercent: number;
  people: OrgPerson[];
};

const FIRST = [
  "Maria",
  "Jose",
  "Ana",
  "Pedro",
  "Rosa",
  "Juan",
  "Elena",
  "Carlos",
  "Liza",
  "Miguel",
  "Grace",
  "Antonio",
  "Sofia",
  "Ramon",
  "Teresa",
  "Diego",
];

const LAST = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Mendoza",
  "Torres",
  "Villanueva",
  "Ramos",
  "Flores",
  "Gonzales",
  "Navarro",
  "Bautista",
  "Castillo",
  "Dela Cruz",
  "Aquino",
  "Lim",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function person(seed: string): string {
  const h = hash(seed);
  return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 8) % LAST.length]}`;
}

export function buildBarangayPyramid(
  lguName: string,
  barangayName: string,
): PyramidLevel[] {
  const base = `${lguName}/${barangayName}`;

  const kagawad: OrgPerson[] = Array.from({ length: 7 }, (_, i) => ({
    id: `kagawad-${i + 1}`,
    role: `Kagawad ${i + 1}`,
    name: person(`${base}/kagawad/${i}`),
    office: "Sangguniang Barangay",
  }));

  const skKagawad: OrgPerson[] = Array.from({ length: 7 }, (_, i) => ({
    id: `sk-kagawad-${i + 1}`,
    role: `SK Kagawad ${i + 1}`,
    name: person(`${base}/sk-kagawad/${i}`),
    office: "Sangguniang Kabataan",
  }));

  const tanods: OrgPerson[] = Array.from({ length: 4 }, (_, i) => ({
    id: `tanod-${i + 1}`,
    role: `Tanod ${i + 1}`,
    name: person(`${base}/tanod/${i}`),
    office: "Peace & order",
  }));

  return [
    {
      id: "apex",
      label: "Executive",
      widthPercent: 36,
      people: [
        {
          id: "captain",
          role: "Punong Barangay",
          name: person(`${base}/captain`),
          office: "Barangay hall",
        },
      ],
    },
    {
      id: "key",
      label: "Key officers",
      widthPercent: 58,
      people: [
        {
          id: "sk",
          role: "SK Chairperson",
          name: person(`${base}/sk-chair`),
          office: "Sangguniang Kabataan",
        },
        {
          id: "secretary",
          role: "Secretary",
          name: person(`${base}/secretary`),
          office: "Administration",
        },
        {
          id: "treasurer",
          role: "Treasurer",
          name: person(`${base}/treasurer`),
          office: "Finance",
        },
        {
          id: "bhw",
          role: "Health Worker",
          name: person(`${base}/bhw`),
          office: "Health",
        },
        {
          id: "tanod-chief",
          role: "Chief Tanod",
          name: person(`${base}/tanod-chief`),
          office: "Peace & order",
        },
      ],
    },
    {
      id: "sb",
      label: "Sangguniang Barangay",
      widthPercent: 78,
      people: kagawad,
    },
    {
      id: "sk-council",
      label: "Sangguniang Kabataan",
      widthPercent: 90,
      people: skKagawad,
    },
    {
      id: "tanods",
      label: "Barangay Tanod",
      widthPercent: 100,
      people: tanods,
    },
  ];
}
