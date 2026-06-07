import type { Artifact, ArtifactSection, Project } from './types';

type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

type ScoreRow = {
  label: string;
  value: number;
};

type PresentationSections = {
  sourceArtifacts: Artifact[];
  strongestEvidence: ArtifactSection[];
  tradeoffs: ArtifactSection[];
  comparison: ArtifactSection[];
  risks: string[];
  openQuestions: string[];
  nextSteps: string[];
};

const finalStageId = 'leadership-package';

const finalPresentationTypes = new Set(['Executive Decision Brief', 'Leadership Presentation Deck']);

const fallback = {
  recommendation: 'יש לאשר את כיוון ההחלטה, לסגור אחריות ביצועית, ולהגדיר את הראיות הנדרשות לפני התחייבות מלאה.',
  summary: 'חבילת ההנהלה לא כללה תקציר מפורש, ולכן המצגת מציגה את נקודות ההחלטה המרכזיות מתוך החומרים הזמינים.',
  evidence: 'לא נמצאה שכבת ראיות ייעודית. יש להשתמש בתקציר ובהשוואות הקיימות כסימני החלטה ראשוניים.',
  tradeoffs: 'לא נמצא סעיף פשרות מפורש. יש לבחון את ההשוואה ואת הסיכונים לפני החלטה סופית.',
  comparison: 'לא נמצאו ציונים מובנים, ולכן המצגת מציגה את ההשוואה באופן איכותני במקום להמציא מספרים.',
  risk: 'לא תועדו סיכונים מפורשים בחבילת ההנהלה.',
  question: 'לא תועדו שאלות פתוחות מפורשות.',
  step: 'לאשר בעל החלטה, מועד החלטה, וראיות משלימות נדרשות לפני התחייבות.',
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'presentation';
}

function plainText(value: string | string[]) {
  return Array.isArray(value) ? value.join(' ') : value;
}

function sectionItems(section: ArtifactSection) {
  return Array.isArray(section.body)
    ? section.body
    : section.body
        .split(/\n+/)
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean);
}

function bodyHtml(body: string | string[]) {
  if (Array.isArray(body)) {
    return `<ul>${body.map((item) => `<li dir="auto">${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '';

  if (lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line))) {
    return `<ul>${lines.map((line) => `<li dir="auto">${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
  }

  return lines.map((line) => `<p dir="auto">${escapeHtml(line.replace(/^[-*]\s+/, ''))}</p>`).join('');
}

function sectionMatches(section: ArtifactSection, patterns: RegExp[]) {
  const haystack = `${section.heading}\n${plainText(section.body)}`;
  return patterns.some((pattern) => pattern.test(haystack));
}

function headingMatches(section: ArtifactSection, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(section.heading));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueArtifacts(artifacts: Artifact[]) {
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    if (seen.has(artifact.id)) return false;
    seen.add(artifact.id);
    return true;
  });
}

function splitMarkdownRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isDividerRow(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseMarkdownTables(markdown: string): MarkdownTable[] {
  const lines = markdown.split('\n');
  const tables: MarkdownTable[] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes('|') || !isDividerRow(lines[index + 1])) continue;

    const headers = splitMarkdownRow(lines[index]);
    const rows: string[][] = [];
    index += 2;

    while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
      rows.push(splitMarkdownRow(lines[index]));
      index += 1;
    }

    if (headers.length > 1 && rows.length) tables.push({ headers, rows });
  }

  return tables;
}

function numericValue(value: string) {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function scoreRowsFromTables(tables: MarkdownTable[]): ScoreRow[] {
  for (const table of tables) {
    const numericColumns = table.headers
      .map((_, index) => index)
      .filter((index) => table.rows.some((row) => numericValue(row[index] ?? '') !== undefined));

    if (!numericColumns.length) continue;

    const labelColumn = table.headers.findIndex((header) => /(vendor|solution|option|path|name|provider|ספק|פתרון|אפשרות)/i.test(header));
    const firstColumn = labelColumn >= 0 ? labelColumn : 0;
    const valueColumn =
      numericColumns.find((index) => /(score|rating|fit|weighted|total|rank|ציון|דירוג|סה)/i.test(table.headers[index])) ?? numericColumns[0];

    const rows = table.rows
      .map((row) => {
        const label = row[firstColumn]?.trim();
        const value = numericValue(row[valueColumn] ?? '');
        return label && value !== undefined ? { label, value } : undefined;
      })
      .filter((row): row is ScoreRow => Boolean(row))
      .slice(0, 6);

    if (rows.length >= 2) return rows;
  }

  return [];
}

function localizeHeader(header: string) {
  if (/(vendor|provider|name)/i.test(header)) return 'ספק';
  if (/(solution|option|path)/i.test(header)) return 'פתרון';
  if (/(score|rating|weighted|total|rank)/i.test(header)) return 'ציון';
  if (/(fit|alignment)/i.test(header)) return 'התאמה';
  if (/(risk)/i.test(header)) return 'סיכון';
  if (/(cost|price|budget)/i.test(header)) return 'עלות';
  if (/(effort|implementation)/i.test(header)) return 'מאמץ יישום';
  return header;
}

function comparisonTableHtml(table?: MarkdownTable) {
  if (!table) return '';

  const headers = table.headers.slice(0, 5);
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(localizeHeader(header))}</th>`).join('')}</tr></thead>
    <tbody>
      ${table.rows
        .slice(0, 6)
        .map((row) => `<tr>${headers.map((_, index) => `<td dir="auto">${escapeHtml(row[index] ?? '')}</td>`).join('')}</tr>`)
        .join('')}
    </tbody>
  </table>`;
}

function barChartSvg(rows: ScoreRow[]) {
  if (rows.length < 2) return '';
  const max = Math.max(...rows.map((row) => row.value), 1);
  const width = 900;
  const rowHeight = 58;
  const labelWidth = 250;
  const chartX = labelWidth;
  const chartWidth = 510;
  const height = rows.length * rowHeight + 30;

  return `<svg class="bar-chart" viewBox="0 0 ${width} ${height}" direction="ltr" role="img" aria-label="תרשים השוואת ציונים">
    ${rows
      .map((row, index) => {
        const y = index * rowHeight + 18;
        const barWidth = Math.max(10, (row.value / max) * chartWidth);
        return `<g>
          <text x="0" y="${y + 24}" text-anchor="start">${escapeHtml(row.label)}</text>
          <rect x="${chartX}" y="${y}" width="${chartWidth}" height="30" rx="5" class="bar-track"></rect>
          <rect x="${chartX}" y="${y}" width="${barWidth}" height="30" rx="5" class="bar-fill"></rect>
          <text x="${chartX + chartWidth + 24}" y="${y + 23}" text-anchor="middle" class="bar-value">${escapeHtml(String(row.value))}</text>
        </g>`;
      })
      .join('')}
  </svg>`;
}

function attentionLabel(risk: string) {
  if (/(critical|severe|material|blocker|security|privacy|legal|compliance|high|קריטי|גבוה|חמור)/i.test(risk)) return 'גבוה';
  if (/(medium|moderate|dependency|integration|timeline|cost|data|בינוני|תלות|לו״ז|עלות|נתונים)/i.test(risk)) return 'בינוני';
  return 'מעקב';
}

function collectPresentationSections(artifact: Artifact, artifacts: Artifact[]): PresentationSections {
  const finalArtifacts = artifacts.filter((item) => item.stageId === finalStageId);
  const sourceArtifacts = uniqueArtifacts([artifact, ...finalArtifacts, ...artifacts].filter(Boolean));
  const sections = sourceArtifacts.flatMap((item) => item.sections);
  const risks = uniqueStrings(sourceArtifacts.flatMap((item) => item.risks)).slice(0, 7);
  const openQuestions = uniqueStrings(sourceArtifacts.flatMap((item) => item.openQuestions)).slice(0, 6);
  const nextStepSections = sections.filter((section) => headingMatches(section, [/next/i, /implementation/i, /timeline/i, /path/i, /ask/i, /יישום|צעדים|מסלול|בקשות|החלטה/]));
  const explicitNextSteps = uniqueStrings(nextStepSections.flatMap(sectionItems));
  const nextSteps = (explicitNextSteps.length ? explicitNextSteps : uniqueStrings(sourceArtifacts.map((item) => item.recommendedNextAction).filter(Boolean))).slice(0, 4);

  return {
    sourceArtifacts,
    strongestEvidence: sections.filter((section) => sectionMatches(section, [/evidence/i, /insight/i, /why/i, /finding/i, /proof/i, /ראי|תובנ|ממצא|הוכח|למה/])).slice(0, 4),
    tradeoffs: sections.filter((section) => sectionMatches(section, [/trade[- ]?off/i, /decision/i, /criteria/i, /pros/i, /cons/i, /פשר|החלט|קריטרי|יתרונ|חסרונ/])).slice(0, 4),
    comparison: sections.filter((section) => sectionMatches(section, [/vendor/i, /solution/i, /comparison/i, /score/i, /matrix/i, /ספק|פתרון|השווא|ציון|מטריצ/])).slice(0, 4),
    risks,
    openQuestions,
    nextSteps,
  };
}

function cardHtml(sections: ArtifactSection[], fallbackHeading: string, fallbackBody: string, limit = 3) {
  const cards =
    sections.length === 1 && Array.isArray(sections[0].body) && sections[0].body.length > 1
      ? sections[0].body.slice(0, limit).map((item) => ({ heading: item, body: '' }))
      : sections.length
        ? sections
        : [{ heading: fallbackHeading, body: fallbackBody }];
  return cards
    .slice(0, limit)
    .map(
      (section, index) => `<article class="card">
        <small>${String(index + 1).padStart(2, '0')}</small>
        <h3 dir="auto">${escapeHtml(section.heading)}</h3>
        ${bodyHtml(section.body)}
      </article>`,
    )
    .join('');
}

function listHtml(items: string[], fallbackText: string, className = 'list-grid', limit = 6) {
  const values = items.length ? items.slice(0, limit) : [fallbackText];
  return `<ul class="${className}">
    ${values.map((item, index) => `<li><span>${index + 1}</span><p dir="auto">${escapeHtml(item)}</p></li>`).join('')}
  </ul>`;
}

function riskHtml(risks: string[]) {
  const values = risks.length ? risks.slice(0, 4) : [fallback.risk];
  return `<ul class="risk-list">
    ${values.map((risk) => `<li><strong>${escapeHtml(attentionLabel(risk))}</strong><p dir="auto">${escapeHtml(risk)}</p></li>`).join('')}
  </ul>`;
}

function sourceHtml(artifacts: Artifact[]) {
  const values = artifacts.slice(0, 8);
  if (!values.length) return '<article class="source-card"><strong>אין מקורות</strong><p>לא נמצאו ארטיפקטים זמינים להצגה.</p></article>';

  return values
    .map(
      (artifact) => `<article class="source-card">
        <strong dir="auto">${escapeHtml(artifact.artifactType)}</strong>
        <p dir="auto">${escapeHtml(artifact.summary || artifact.recommendedNextAction || 'מקור זמין ללא תקציר.')}</p>
      </article>`,
    )
    .join('');
}

function projectMeta(project: Project, generatedAt: string) {
  const items = [
    ['נותן חסות', project.sponsor || 'לא הוגדר'],
    ['מועד החלטה', project.decisionDeadline || 'לא הוגדר'],
    ['נוצר', generatedAt],
  ];

  return items.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong dir="auto">${escapeHtml(value)}</strong></div>`).join('');
}

function slide(number: number, eyebrow: string, title: string, body: string, dark = false) {
  return `<section class="slide ${dark ? 'dark ' : ''}${number === 1 ? 'active' : ''}" data-slide>
    <header class="slide-head"><span class="slide-no">${String(number).padStart(2, '0')}</span></header>
    <div class="content">
      <div class="title-block">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${body}
    </div>
  </section>`;
}

export function isFinalPresentationArtifact(artifact: Artifact) {
  return artifact.stageId === finalStageId && finalPresentationTypes.has(artifact.artifactType);
}

export function presentationFileName(project: Project, artifact: Artifact) {
  return `${slugify(project.name)}-${slugify(artifact.artifactType)}.html`;
}

export function buildPresentationHtml(project: Project, artifact: Artifact, artifacts: Artifact[]) {
  const sections = collectPresentationSections(artifact, artifacts);
  const tables = artifacts.flatMap((item) => parseMarkdownTables(item.content));
  const scoreRows = scoreRowsFromTables(tables);
  const comparisonTable = tables.find((table) => table.headers.length > 1 && table.rows.length);
  const chart = barChartSvg(scoreRows);
  const generatedAt = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const recommendation = artifact.recommendedNextAction || artifact.summary || fallback.recommendation;
  const summary = artifact.summary || fallback.summary;
  const comparisonNarrative = cardHtml(sections.comparison, 'השוואה איכותנית', fallback.comparison, 2);
  const slideCount = 9;
  const slides = [
    `<section class="slide dark active" data-slide>
      <header class="slide-head"><span class="slide-no">01</span></header>
      <div class="content">
        <div class="hero-grid">
          <div>
            <p class="eyebrow">המלצה ניהולית</p>
            <h1 dir="auto">${escapeHtml(recommendation)}</h1>
            <p class="lead" dir="auto">${escapeHtml(summary)}</p>
          </div>
          <aside class="hero-panel">
            <strong>חבילת החלטה</strong>
            <p dir="auto">${escapeHtml(project.name)}</p>
            <div class="meta">${projectMeta(project, generatedAt)}</div>
          </aside>
        </div>
      </div>
    </section>`,
    slide(
      2,
      'תמונת החלטה',
      'מה צריך להיות ברור לפני שמתקדמים',
      `<div class="decision-grid">
        <article class="callout strong"><span>המלצה</span><p dir="auto">${escapeHtml(recommendation)}</p></article>
        <article class="callout"><span>בעיה עסקית</span><p dir="auto">${escapeHtml(project.problemStatement || summary)}</p></article>
        <article class="callout"><span>אילוצים</span><p dir="auto">${escapeHtml(project.constraints || 'לא הוגדרו אילוצים מפורשים.')}</p></article>
        <article class="callout"><span>בעלי עניין</span><p dir="auto">${escapeHtml(project.stakeholders || 'לא הוגדרו בעלי עניין.')}</p></article>
      </div>`,
    ),
    slide(
      3,
      'ראיות ותובנות',
      'הסיבות החזקות ביותר לתמוך בהחלטה',
      `<div class="cards">${cardHtml(sections.strongestEvidence, 'ראיה מרכזית', fallback.evidence, 4)}</div>
       <article class="wide-note"><span>קריאה ניהולית</span><p dir="auto">${escapeHtml(summary)}</p></article>`,
    ),
    slide(
      4,
      'השוואת חלופות',
      'איפה הפתרונות נפרדים אחד מהשני',
      `<div class="visual-grid">
        <div class="visual-panel">${chart || `<div class="narrative">${comparisonNarrative}</div>`}</div>
        <div class="visual-panel">${comparisonTable ? comparisonTableHtml(comparisonTable) : comparisonNarrative}</div>
      </div>`,
    ),
    slide(
      5,
      'פשרות והחלטות',
      'מה מרוויחים, על מה מוותרים, ומה לא כדאי לטשטש',
      `<div class="cards">${cardHtml(sections.tradeoffs, 'פשרה מרכזית', fallback.tradeoffs, 4)}</div>
       <div class="two-column">
        <article class="wide-note"><span>חלופות</span>${comparisonNarrative}</article>
        <article class="wide-note"><span>סימן החלטה</span><p dir="auto">${escapeHtml(recommendation)}</p></article>
       </div>`,
    ),
    slide(
      6,
      'סיכונים ובקרות',
      'מה חייב להיסגר לפני התחייבות',
      `<div class="two-column risk-column">
        ${riskHtml(sections.risks)}
        ${listHtml(sections.openQuestions, fallback.question, 'question-list', 4)}
      </div>`,
    ),
    slide(
      7,
      'מסלול יישום',
      'צעדים מיידיים אחרי החלטה',
      `${listHtml(sections.nextSteps, fallback.step, 'timeline', 4)}
       <article class="wide-note"><span>תוצאת יעד</span><p dir="auto">${escapeHtml(recommendation)}</p></article>`,
    ),
    slide(
      8,
      'בקשות מהנהלה',
      'מה צריך לקבל מהחדר כדי להתקדם',
      `<div class="decision-grid">
        <article class="callout strong"><span>אישור</span><p dir="auto">${escapeHtml(recommendation)}</p></article>
        <article class="callout"><span>בעלות</span><p>מינוי בעל החלטה ובעל יישום לכל שלב המשך.</p></article>
        <article class="callout"><span>בדיקת סיכונים</span><p>הסכמה על הסיכונים שיש לסגור לפני התחייבות מלאה.</p></article>
        <article class="callout"><span>המשך עבודה</span><p>אישור צעדי היישום, לוחות הזמנים והראיות החסרות.</p></article>
      </div>`,
    ),
    slide(
      9,
      'מקורות ושקיפות',
      'החומרים שהוזנו למצגת ההנהלה',
      `<div class="source-grid">${sourceHtml(sections.sourceArtifacts)}</div>`,
    ),
  ];

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(project.name)} | מצגת הנהלה</title>
  <style>
    :root {
      color: #172026;
      background: #eef2f4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --ink: #172026;
      --muted: #66727c;
      --line: #d8e0e6;
      --paper: #fbfcfd;
      --canvas: #eef2f4;
      --teal: #087569;
      --teal-soft: #e0f1ed;
      --blue: #244f91;
      --blue-soft: #e7eef9;
      --amber: #9a6a05;
      --amber-soft: #fff0c4;
      --red: #ad3c32;
      --red-soft: #ffe8e2;
    }

    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      margin: 0;
      overflow: hidden;
      background: var(--canvas);
      color: var(--ink);
      direction: rtl;
    }

    .deck {
      position: relative;
      display: grid;
      place-items: center;
      width: 100vw;
      height: 100vh;
      padding: 32px;
    }

    .slide {
      display: none;
      position: relative;
      width: min(calc(100vw - 64px), calc((100vh - 96px) * 16 / 9), 1440px);
      aspect-ratio: 16 / 9;
      min-height: 0;
      padding: clamp(38px, 5vw, 78px);
      background: var(--paper);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      box-shadow: 0 26px 80px rgba(32, 43, 51, 0.18);
      overflow: hidden;
    }

    .slide::before {
      content: "";
      position: absolute;
      inset-inline-end: 0;
      top: 0;
      width: 12px;
      height: 100%;
      background: linear-gradient(180deg, var(--teal), var(--blue));
    }

    .slide::after {
      content: "";
      position: absolute;
      inset-inline-start: 48px;
      bottom: 48px;
      width: 140px;
      height: 6px;
      background: var(--amber);
      border-radius: 999px;
      opacity: 0.9;
    }

    .slide.active { display: block; }
    .slide.dark {
      color: #f8fbfc;
      background: linear-gradient(135deg, #182631 0%, #122029 52%, #0d161d 100%);
      border-color: rgba(255, 255, 255, 0.08);
    }
    .slide.dark::before { background: linear-gradient(180deg, #79d8ca, #f0c45f); }
    .slide.dark::after { background: #79d8ca; }
    .slide.dark h1,
    .slide.dark h2,
    .slide.dark p { color: #f8fbfc; }
    .slide.dark .eyebrow { color: #91e0d3; }

    .slide-head {
      position: absolute;
      z-index: 2;
      top: clamp(40px, 5vw, 72px);
      inset-inline-start: clamp(52px, 6vw, 84px);
      direction: ltr;
    }

    .slide-no {
      display: inline-grid;
      min-width: 46px;
      height: 34px;
      place-items: center;
      color: var(--teal);
      background: var(--teal-soft);
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 850;
    }

    .dark .slide-no {
      color: #122029;
      background: #91e0d3;
    }

    .content {
      display: grid;
      align-content: start;
      gap: clamp(18px, 2.4vw, 32px);
      height: 100%;
      min-width: 0;
      padding-top: clamp(72px, 6.5vw, 104px);
      overflow: auto;
    }

    .dark .content {
      align-content: center;
      padding-top: 0;
    }

    .eyebrow {
      margin: 0 0 10px;
      color: var(--teal);
      font-size: 0.82rem;
      font-weight: 850;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1, h2, h3, p { margin-top: 0; letter-spacing: 0; }
    h1 {
      max-width: 980px;
      margin-bottom: 24px;
      font-size: clamp(2.5rem, 5vw, 5.4rem);
      line-height: 1.02;
      text-wrap: balance;
      unicode-bidi: plaintext;
    }
    h2 {
      max-width: 1040px;
      margin-bottom: 0;
      font-size: clamp(2rem, 3.5vw, 3.7rem);
      line-height: 1.04;
      text-wrap: balance;
    }
    h3 { margin-bottom: 10px; font-size: clamp(1.05rem, 1.5vw, 1.45rem); }
    p, li, td, th { color: #2e3944; line-height: 1.5; }
    .lead {
      max-width: 900px;
      color: #d8e4e8;
      font-size: clamp(1.08rem, 1.7vw, 1.52rem);
      line-height: 1.45;
      unicode-bidi: plaintext;
    }
    .hero-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr); gap: 38px; align-items: center; }
    .hero-panel {
      display: grid;
      gap: 18px;
      padding: 28px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
    }
    .hero-panel strong { color: #91e0d3; font-size: 0.9rem; text-transform: uppercase; }
    .hero-panel p { margin: 0; font-size: 1.35rem; font-weight: 800; }
    .meta { display: grid; gap: 10px; }
    .meta div {
      display: grid;
      gap: 4px;
      padding: 13px 15px;
      background: rgba(255, 255, 255, 0.88);
      border-radius: 8px;
    }
    .meta span { color: var(--muted); font-size: 0.72rem; font-weight: 850; text-transform: uppercase; }
    .meta strong { color: var(--ink); font-size: 0.96rem; }
    .title-block { display: grid; justify-items: end; text-align: right; }
    .cards, .decision-grid, .source-grid { display: grid; gap: 16px; }
    .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .decision-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .source-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .risk-column { align-items: start; gap: 18px; }
    .card,
    .callout,
    .wide-note,
    .visual-panel,
    .source-card,
    .risk-list li,
    .question-list li,
    .timeline li {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(33, 47, 58, 0.08);
    }
    .card, .callout, .wide-note, .visual-panel, .source-card { padding: 24px; }
    .card { min-height: 220px; }
    .card small {
      display: inline-grid;
      width: 44px;
      height: 34px;
      margin-bottom: 18px;
      place-items: center;
      color: var(--teal);
      background: var(--teal-soft);
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 850;
    }
    .card p, .card li, .callout p, .wide-note p, .source-card p { unicode-bidi: plaintext; }
    .card ul { margin: 0; padding-inline-start: 22px; }
    .callout span,
    .wide-note span {
      display: block;
      margin-bottom: 10px;
      color: var(--teal);
      font-size: 0.78rem;
      font-weight: 850;
      text-transform: uppercase;
    }
    .callout.strong { background: var(--teal-soft); border-color: #b8ddd6; }
    .callout p, .wide-note p { margin-bottom: 0; font-size: clamp(1rem, 1.25vw, 1.18rem); }
    .visual-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr); gap: 18px; align-items: stretch; }
    .visual-panel { overflow: auto; }
    .bar-chart { display: block; width: 100%; min-width: 580px; height: auto; }
    .bar-chart text { fill: var(--ink); font-size: 17px; font-weight: 780; }
    .bar-track { fill: #edf2f5; }
    .bar-fill { fill: var(--teal); }
    .bar-value { fill: var(--blue); }
    table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 8px; }
    th, td { padding: 13px 14px; border-bottom: 1px solid var(--line); text-align: right; vertical-align: top; }
    th { color: #23313d; background: var(--blue-soft); font-size: 0.8rem; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    .risk-list, .question-list, .timeline { margin: 0; padding: 0; list-style: none; }
    .risk-list, .question-list { display: grid; gap: 12px; }
    .timeline { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .risk-list li,
    .question-list li,
    .timeline li {
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 12px;
      align-items: start;
      padding: 14px;
    }
    .risk-list strong {
      display: grid;
      min-height: 36px;
      place-items: center;
      color: var(--red);
      background: var(--red-soft);
      border-radius: 6px;
      font-size: 0.82rem;
      text-transform: uppercase;
    }
    .question-list span,
    .timeline span {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      color: #fff;
      background: var(--blue);
      border-radius: 999px;
      font-weight: 850;
    }
    .risk-list p, .question-list p, .timeline p { margin: 0; font-size: clamp(0.95rem, 1.2vw, 1.18rem); unicode-bidi: plaintext; }
    .source-card { min-height: 150px; }
    .source-card strong { display: block; margin-bottom: 10px; color: var(--blue); }
    .source-card p { margin: 0; font-size: 0.94rem; }
    .controls {
      position: fixed;
      z-index: 5;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px;
      color: #172026;
      background: rgba(251, 252, 253, 0.88);
      border: 1px solid rgba(216, 224, 230, 0.9);
      border-radius: 999px;
      box-shadow: 0 10px 32px rgba(32, 43, 51, 0.15);
      backdrop-filter: blur(12px);
      direction: ltr;
    }
    .controls button {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 0;
      border-radius: 999px;
      color: #172026;
      background: transparent;
      font-size: 1.15rem;
      cursor: pointer;
    }
    .controls button:hover { background: #e8eef2; }
    .counter { min-width: 62px; color: #52606b; font-size: 0.8rem; font-weight: 780; text-align: center; }

    @media (max-width: 1050px) {
      body { overflow: auto; background: #eef3f6; }
      .deck { height: auto; min-height: 100vh; padding: 12px; }
      .slide {
        position: relative;
        width: 100%;
        aspect-ratio: auto;
        min-height: calc(100vh - 24px);
        padding: 28px;
      }
      .content { padding-top: 86px; }
      .cards, .decision-grid, .source-grid, .two-column, .visual-grid, .timeline, .hero-grid { grid-template-columns: 1fr; }
      .controls { position: sticky; margin: 12px auto 0; transform: none; }
    }

    @media print {
      body { overflow: visible; background: #fff; }
      .deck { height: auto; padding: 0; }
      .slide {
        display: block !important;
        position: relative;
        width: 100%;
        aspect-ratio: auto;
        min-height: 100vh;
        page-break-after: always;
        box-shadow: none;
        border-radius: 0;
      }
      .controls { display: none; }
    }
  </style>
</head>
<body>
  <main class="deck" aria-live="polite">
    ${slides.join('\n')}
    <nav class="controls" aria-label="ניווט שקפים">
      <button type="button" id="prev" aria-label="שקף קודם">‹</button>
      <span class="counter" id="counter">1 / ${slideCount}</span>
      <button type="button" id="next" aria-label="שקף הבא">›</button>
    </nav>
  </main>
  <script>
    const slides = Array.from(document.querySelectorAll('[data-slide]'));
    const counter = document.getElementById('counter');
    let index = 0;

    function show(nextIndex) {
      index = Math.max(0, Math.min(slides.length - 1, nextIndex));
      slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
      counter.textContent = String(index + 1) + ' / ' + String(slides.length);
      if (location.hash !== '#' + String(index + 1)) history.replaceState(null, '', '#' + String(index + 1));
    }

    document.getElementById('prev').addEventListener('click', () => show(index - 1));
    document.getElementById('next').addEventListener('click', () => show(index + 1));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === ' ' || event.key === 'PageDown') show(index + 1);
      if (event.key === 'ArrowRight' || event.key === 'PageUp') show(index - 1);
      if (event.key === 'Home') show(0);
      if (event.key === 'End') show(slides.length - 1);
    });
    const initial = Number(location.hash.replace('#', ''));
    show(Number.isFinite(initial) && initial > 0 ? initial - 1 : 0);
  </script>
</body>
</html>`;
}
