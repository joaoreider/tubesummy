import type { Summary } from "../lib/types";

interface SummaryDisplayProps {
  summary: Summary | null;
}

export function SummaryDisplay({ summary }: SummaryDisplayProps) {
  if (!summary) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 14, lineHeight: 1.5 }}>{summary.paragraph}</p>
      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 14 }}>
        {summary.topics.map((topic) => (
          <li key={`${topic.timestamp}-${topic.title}`} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 600, marginRight: 6 }}>
              [{topic.timestamp}]
            </span>
            <span>{topic.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}


