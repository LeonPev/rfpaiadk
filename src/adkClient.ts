import { artifactToMarkdown, parsedFromUnknown } from './format';
import type { Artifact, ArtifactChatMessage, ParsedArtifact, Project, ProposedArtifact, Stage } from './types';
import { fallbackByArtifactType, userId } from './workflow';

type RunResult = {
  artifacts: Artifact[];
  events: unknown[];
  prompt: string;
};

export type ArtifactEditResult = {
  assistantMessage: string;
  needsMoreInput: boolean;
  proposal?: {
    changeSummary: string;
    revisedArtifact: ProposedArtifact;
  };
  events: unknown[];
  prompt: string;
  rawText: string;
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractText(events: unknown[]) {
  const texts: string[] = [];
  for (const event of events) {
    const parts = (event as { content?: { parts?: unknown[] } }).content?.parts ?? [];
    for (const part of parts) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim()) texts.push(text);
    }
  }
  return texts.at(-1) ?? '';
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function parseArtifacts(text: string, fallbackType: string): ParsedArtifact[] {
  try {
    const parsed = JSON.parse(stripCodeFence(text));
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { artifacts?: unknown[] }).artifacts)) {
      return (parsed as { artifacts: unknown[] }).artifacts
        .map((artifact) => parsedFromUnknown(artifact, fallbackType))
        .filter((artifact): artifact is ParsedArtifact => Boolean(artifact));
    }
    const artifact = parsedFromUnknown(parsed, fallbackType);
    return artifact ? [artifact] : [];
  } catch {
    return [];
  }
}

function createRawArtifact(stage: Stage, agentApp: string, rawText: string): Artifact {
  const fallbackType = stage.artifactTypes.at(-1) ?? 'Artifact';
  const fallback = fallbackByArtifactType[fallbackType] ?? {
    artifactTitle: fallbackType,
    artifactType: fallbackType,
    summary: 'The agent response could not be parsed as strict JSON. The raw response is preserved below.',
    sections: [{ heading: 'Raw Response', body: rawText }],
    risks: ['Review this response before using it downstream.'],
    openQuestions: [],
    recommendedNextAction: 'Retry the agent or edit this artifact manually.',
  };

  return {
    ...fallback,
    id: newId('artifact'),
    stageId: stage.id,
    agentApp,
    createdAt: new Date().toISOString(),
    content: rawText || artifactToMarkdown(fallback),
    rawText,
    parseStatus: 'raw',
  };
}

function createArtifact(stage: Stage, agentApp: string, parsed: ParsedArtifact, rawText: string): Artifact {
  return {
    ...parsed,
    id: newId('artifact'),
    stageId: stage.id,
    agentApp,
    createdAt: new Date().toISOString(),
    content: artifactToMarkdown(parsed),
    rawText,
    parseStatus: 'parsed',
  };
}

function artifactContext(artifacts: Artifact[]) {
  if (!artifacts.length) return 'No upstream artifacts yet.';
  return artifacts
    .map((artifact) => `## ${artifact.artifactType}\n${artifact.content}`)
    .join('\n\n---\n\n');
}

function projectContext(project: Project) {
  return `Project: ${project.name}
Sponsor: ${project.sponsor || 'Unspecified'}
Decision deadline: ${project.decisionDeadline || 'Unspecified'}
Problem statement: ${project.problemStatement || 'Unspecified'}
Stakeholders: ${project.stakeholders || 'Unspecified'}
Constraints: ${project.constraints || 'Unspecified'}`;
}

function chatContext(messages: ArtifactChatMessage[]) {
  if (!messages.length) return 'No artifact edit conversation yet.';
  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
}

function parseArtifactEditResponse(text: string, fallbackArtifact: Artifact): Omit<ArtifactEditResult, 'events' | 'prompt' | 'rawText'> {
  try {
    const parsed = JSON.parse(stripCodeFence(text)) as {
      assistantMessage?: unknown;
      needsMoreInput?: unknown;
      proposal?: {
        changeSummary?: unknown;
        revisedArtifact?: unknown;
      };
    };
    const assistantMessage =
      typeof parsed.assistantMessage === 'string' && parsed.assistantMessage.trim()
        ? parsed.assistantMessage.trim()
        : 'I reviewed the artifact edit request.';
    const artifact = parsed.proposal?.revisedArtifact
      ? parsedFromUnknown(parsed.proposal.revisedArtifact, fallbackArtifact.artifactType)
      : undefined;

    if (!artifact) {
      return {
        assistantMessage,
        needsMoreInput: Boolean(parsed.needsMoreInput),
      };
    }

    const record = parsed.proposal?.revisedArtifact as { content?: unknown };
    const content = typeof record.content === 'string' && record.content.trim() ? record.content : artifactToMarkdown(artifact);
    return {
      assistantMessage,
      needsMoreInput: false,
      proposal: {
        changeSummary:
          typeof parsed.proposal?.changeSummary === 'string' && parsed.proposal.changeSummary.trim()
            ? parsed.proposal.changeSummary.trim()
            : 'Proposed artifact revision.',
        revisedArtifact: {
          ...artifact,
          content,
        },
      },
    };
  } catch {
    return {
      assistantMessage: text.trim() || 'The artifact editor did not return a readable response.',
      needsMoreInput: false,
    };
  }
}

export function buildPrompt(stage: Stage, agentApp: string, project: Project, artifacts: Artifact[], selectedSolutions: string[]) {
  const targetArtifacts = stage.artifactTypes.join(', ');
  const selected = selectedSolutions.length ? selectedSolutions.map((solution) => `- ${solution}`).join('\n') : 'None selected.';

  return `You are running the AYIT procurement workflow stage "${stage.title}" as ${agentApp}.

Generate the target artifact type(s): ${targetArtifacts}.

Core rule: agents do not talk directly to each other. Treat the upstream artifacts below as the source of truth.

Return strict JSON only. For a single artifact, return:
{
  "artifactTitle": "...",
  "artifactType": "${stage.artifactTypes.at(-1) ?? 'Artifact'}",
  "summary": "...",
  "sections": [{"heading": "...", "body": "... or array of strings"}],
  "risks": ["..."],
  "openQuestions": ["..."],
  "recommendedNextAction": "..."
}

If this stage requests multiple artifacts, return:
{
  "artifacts": [
    {
      "artifactTitle": "...",
      "artifactType": "...",
      "summary": "...",
      "sections": [{"heading": "...", "body": "... or array of strings"}],
      "risks": ["..."],
      "openQuestions": ["..."],
      "recommendedNextAction": "..."
    }
  ]
}

Project context:
${projectContext(project)}

Human-selected solutions:
${selected}

Upstream artifacts:
${artifactContext(artifacts)}`;
}

export function buildArtifactEditPrompt(project: Project, artifact: Artifact, messages: ArtifactChatMessage[]) {
  return `You are editing one AYIT procurement artifact through a human approval workflow.

Return strict JSON only using your artifact edit response contract.

Project context:
${projectContext(project)}

Current artifact metadata:
ID: ${artifact.id}
Artifact title: ${artifact.artifactTitle}
Artifact type: ${artifact.artifactType}
Stage ID: ${artifact.stageId}
Parse status: ${artifact.parseStatus}

Current artifact summary:
${artifact.summary || 'No summary.'}

Current artifact Markdown:
${artifact.content || 'No content.'}

Artifact edit conversation:
${chatContext(messages)}`;
}

async function createSession(appName: string, sessionId: string, state: Record<string, unknown>) {
  const response = await fetch(`/adk/apps/${appName}/users/${userId}/sessions/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    const text = await response.text();
    if (!text.includes('Session already exists')) {
      throw new Error(`ADK session failed: ${response.status} ${text}`);
    }
  }
}

async function runAgent(appName: string, sessionId: string, prompt: string) {
  const response = await fetch('/adk/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName,
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: prompt }],
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ADK run failed: ${response.status} ${text}`);
  }
  return (await response.json()) as unknown[];
}

export async function runStage(
  stage: Stage,
  project: Project,
  contextArtifacts: Artifact[],
  selectedSolutions: string[],
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  let rollingArtifacts = [...contextArtifacts];

  for (const agentApp of stage.agentApps) {
    const sessionId = `${stage.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const prompt = buildPrompt(stage, agentApp, project, rollingArtifacts, selectedSolutions);

    await createSession(agentApp, sessionId, {
      stageId: stage.id,
      projectName: project.name,
      selectedSolutions,
    });

    const events = await runAgent(agentApp, sessionId, prompt);
    const rawText = extractText(events);
    const parsed = parseArtifacts(rawText, stage.artifactTypes.at(-1) ?? 'Artifact');
    const artifacts = parsed.length
      ? parsed.map((artifact) => createArtifact(stage, agentApp, artifact, rawText))
      : [createRawArtifact(stage, agentApp, rawText)];

    rollingArtifacts = [...rollingArtifacts, ...artifacts];
    results.push({ artifacts, events, prompt });
  }

  return results;
}

export async function runArtifactEdit(project: Project, artifact: Artifact, messages: ArtifactChatMessage[]): Promise<ArtifactEditResult> {
  const agentApp = 'artifact_editor_agent';
  const sessionId = `artifact-edit-${artifact.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const prompt = buildArtifactEditPrompt(project, artifact, messages);

  await createSession(agentApp, sessionId, {
    artifactId: artifact.id,
    artifactType: artifact.artifactType,
    projectName: project.name,
  });

  const events = await runAgent(agentApp, sessionId, prompt);
  const rawText = extractText(events);
  return {
    ...parseArtifactEditResponse(rawText, artifact),
    events,
    prompt,
    rawText,
  };
}
