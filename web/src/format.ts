export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function absoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Timestamp span that the shell's 30s ticker keeps fresh. */
export function timeSpan(iso: string, className = ""): string {
  return `<span class="${className}" data-ts="${escapeHtml(iso)}" title="${escapeHtml(
    absoluteTime(iso),
  )}">${escapeHtml(relativeTime(iso))}</span>`;
}

export function refreshTimestamps(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-ts]").forEach((node) => {
    const iso = node.dataset.ts;
    if (iso) node.textContent = relativeTime(iso);
  });
}

/**
 * Render stored argument text (markdown-ish plain text) to safe HTML:
 * fenced code blocks, bullet/ordered lists, headings (downgraded to bold),
 * links (http/https only), paragraphs, inline code, bold, italics.
 */
export function renderRich(content: string): string {
  const parts = content.replace(/\r\n/g, "\n").split(/```([^\n]*)\n?/);
  let html = "";
  // split() alternates prose / fence-info / fenced body / prose / ...
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 3 === 2) {
      html += `<pre><code>${escapeHtml(parts[i].replace(/\n$/, ""))}</code></pre>`;
    } else if (i % 3 === 0) {
      html += proseToHtml(parts[i]);
    }
  }
  return html;
}

function inline(text: string): string {
  let safe = escapeHtml(text);
  // Code spans first so their contents are never linkified or emphasized.
  const codeSpans: string[] = [];
  safe = safe.replace(/`([^`\n]+)`/g, (_, body: string) => {
    codeSpans.push(`<code>${body}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  safe = safe.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  safe = safe
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  return safe.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codeSpans[Number(index)]);
}

function proseToHtml(text: string): string {
  let html = "";
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;
    if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) {
      // Agents emit markdown headings; downgrade to bold so transcript hierarchy stays typographic.
      html += `<p><strong>${inline(lines[0].replace(/^#{1,6}\s+/, ""))}</strong></p>`;
    } else if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`)
        .join("");
      html += `<ul>${items}</ul>`;
    } else if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      // Preserve the author's numbering: blank-line-separated numbered points
      // arrive as separate blocks, so carry the start index through.
      const start = Number(lines[0].match(/^\s*(\d+)/)?.[1] ?? "1");
      const items = lines
        .map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`)
        .join("");
      html += `<ol${start !== 1 ? ` start="${start}"` : ""}>${items}</ol>`;
    } else {
      html += `<p>${lines.map(inline).join("<br>")}</p>`;
    }
  }
  return html;
}

export const isMacPlatform: boolean =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const SLUG_STOPWORDS = new Set(["the", "a", "an", "is", "are", "of", "for", "to", "in", "and", "or"]);

export function slugify(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 5);
  while (words.length > 2 && SLUG_STOPWORDS.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join("-").slice(0, 40);
}

/** First sentence of a longer summary, for a one-line preview. Falls back to the whole string. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

function trimClause(text: string): string {
  return text.trim().replace(/[\s;,]+$/, "");
}

/**
 * A one-line summary of *what was concluded*, extracted from an agent-authored
 * resolution summary. Handles the two shapes the agents produce:
 *   - Labeled: "Common ground: … ; Remaining differences: …" → the consensus clause.
 *   - Numbered: "Agreement on X. (1) LABEL: <substance>. (2) …" → the first
 *     substantive point, dropping the vague opener and the point's ALL-CAPS label.
 * Falls back to the first sentence (minus a vague "Agreement…" preamble).
 * CSS clamps the result to a single line; the full summary stays available on hover.
 */
export function conclusionSummary(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  const labeled = normalized.match(
    /\b(?:common ground|consensus|shared conclusion|conclusion)\b\s*[:—-]\s*(.+)/i,
  );
  if (labeled) {
    const clause = labeled[1].split(
      /\s*[;.]\s+(?=remaining (?:differences|disagreement)\b|key assumptions\b|remaining\b|differences\b)/i,
    )[0];
    return trimClause(clause);
  }

  const firstPoint = normalized.match(/\(1\)\s*(.+?)(?=\s*\(2\)|$)/);
  if (firstPoint) {
    return trimClause(firstPoint[1].replace(/^[A-Z][A-Z0-9 /,-]{2,}?:\s*/, ""));
  }

  const stripped = normalized.replace(
    /^(?:agreement|agreed|consensus|both agents? agree|we agree)[^.:]*[.:]\s*/i,
    "",
  );
  return trimClause(firstSentence(stripped || normalized));
}

export function participantName(sender: string): string {
  if (sender === "claude") return "Claude";
  if (sender === "codex") return "Codex";
  if (sender === "moderator") return "Moderator";
  return sender;
}
