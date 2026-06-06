import type { Artifact, ArtifactSection, ParsedArtifact } from './types';

function bodyToMarkdown(body: string | string[]) {
  if (Array.isArray(body)) {
    return body.map((item) => `- ${item}`).join('\n');
  }
  return body;
}

export function artifactToMarkdown(artifact: ParsedArtifact) {
  const sections = artifact.sections
    .map((section) => `## ${section.heading}\n${bodyToMarkdown(section.body)}`)
    .join('\n\n');

  const risks = artifact.risks.length ? artifact.risks.map((risk) => `- ${risk}`).join('\n') : '- None captured';
  const questions = artifact.openQuestions.length
    ? artifact.openQuestions.map((question) => `- ${question}`).join('\n')
    : '- None captured';

  return `# ${artifact.artifactTitle}

${artifact.summary}

${sections}

## Risks
${risks}

## Open Questions
${questions}

## Recommended Next Action
${artifact.recommendedNextAction}
`;
}

export function normalizeSections(value: unknown): ArtifactSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((section, index) => {
    if (typeof section === 'string') {
      return { heading: `Section ${index + 1}`, body: section };
    }
    const record = section as Record<string, unknown>;
    const heading = String(record.heading ?? record.title ?? `Section ${index + 1}`);
    const body = record.body ?? record.content ?? '';
    if (Array.isArray(body)) return { heading, body: body.map(String) };
    return { heading, body: String(body) };
  });
}

export function parsedFromUnknown(value: unknown, fallbackType: string): ParsedArtifact | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const artifactTitle = String(record.artifactTitle ?? record.title ?? fallbackType);
  const artifactType = String(record.artifactType ?? record.type ?? fallbackType);
  const sections = normalizeSections(record.sections);
  return {
    artifactTitle,
    artifactType,
    summary: String(record.summary ?? ''),
    sections,
    risks: Array.isArray(record.risks) ? record.risks.map(String) : [],
    openQuestions: Array.isArray(record.openQuestions) ? record.openQuestions.map(String) : [],
    recommendedNextAction: String(record.recommendedNextAction ?? ''),
  };
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function artifactFileName(artifact: Artifact, extension: string) {
  return `${artifact.artifactType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`;
}
