import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  FileJson,
  FileText,
  MessageSquare,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { runArtifactEdit, runStage } from './adkClient';
import { artifactFileName, artifactToMarkdown, download } from './format';
import { clearState, loadState, saveState } from './storage';
import type { AppState, Artifact, ArtifactChatMessage, ArtifactEditProposal, Project, Stage } from './types';
import {
  getContextArtifacts,
  getStageStatus,
  initialState,
  isProjectReady,
  isStageReady,
  stages,
} from './workflow';

const isLocalDev = import.meta.env.DEV;
const hasGeminiKey = isLocalDev ? __AYIT_HAS_GEMINI_KEY__ : true;

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updateProject(project: Project, key: keyof Project, value: string): Project {
  return { ...project, [key]: value };
}

function changedRows(artifact: Artifact, proposal: ArtifactEditProposal) {
  const proposed = proposal.revisedArtifact;
  const rows = [
    { label: 'Title', current: artifact.artifactTitle, proposed: proposed.artifactTitle },
    { label: 'Type', current: artifact.artifactType, proposed: proposed.artifactType },
    { label: 'Summary', current: artifact.summary, proposed: proposed.summary },
    { label: 'Artifact Markdown', current: artifact.content, proposed: proposed.content },
  ];
  return rows.filter((row) => row.current.trim() !== row.proposed.trim());
}

function displayValue(value: string) {
  return value.trim() || 'Empty';
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ProjectPanel({
  project,
  onChange,
  onReset,
}: {
  project: Project;
  onChange: (project: Project) => void;
  onReset: () => void;
}) {
  return (
    <section className="project-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Human User</p>
          <h1>AYIT Workflow</h1>
        </div>
        <IconButton label="Reset workspace" onClick={onReset}>
          <RotateCcw size={18} />
        </IconButton>
      </div>
      <div className="project-grid">
        <label>
          Project
          <input value={project.name} onChange={(event) => onChange(updateProject(project, 'name', event.target.value))} />
        </label>
        <label>
          Sponsor
          <input value={project.sponsor} onChange={(event) => onChange(updateProject(project, 'sponsor', event.target.value))} />
        </label>
        <label>
          Decision deadline
          <input
            type="date"
            value={project.decisionDeadline}
            onChange={(event) => onChange(updateProject(project, 'decisionDeadline', event.target.value))}
          />
        </label>
      </div>
      <label>
        Problem statement
        <textarea
          rows={3}
          value={project.problemStatement}
          onChange={(event) => onChange(updateProject(project, 'problemStatement', event.target.value))}
        />
      </label>
      <div className="project-grid two">
        <label>
          Stakeholders
          <textarea
            rows={3}
            value={project.stakeholders}
            onChange={(event) => onChange(updateProject(project, 'stakeholders', event.target.value))}
          />
        </label>
        <label>
          Constraints
          <textarea
            rows={3}
            value={project.constraints}
            onChange={(event) => onChange(updateProject(project, 'constraints', event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

function StageCard({
  stage,
  status,
  active,
  hasKey,
  error,
  onOpen,
  onRun,
  onRetry,
}: {
  stage: Stage;
  status: string;
  active: boolean;
  hasKey: boolean;
  error?: string;
  onOpen: () => void;
  onRun: () => void;
  onRetry: () => void;
}) {
  const canRun = status === 'ready' && hasKey;
  return (
    <article className={`stage-card ${active ? 'active' : ''}`}>
      <button className="stage-main" type="button" onClick={onOpen}>
        <span className="step">{stage.step}</span>
        <span>
          <strong>{stage.title}</strong>
          <small>{stage.description}</small>
        </span>
        <ChevronRight size={18} />
      </button>
      <div className="stage-meta">
        <StatusPill status={status} />
        {stage.usesSearch ? (
          <span className="search-tag">
            <Search size={14} />
            search
          </span>
        ) : null}
      </div>
      <div className="agent-list">
        {stage.agentApps.map((agent) => (
          <span key={agent}>{agent.replace(/_/g, ' ')}</span>
        ))}
      </div>
      {error ? (
        <p className="stage-error">
          <AlertCircle size={15} />
          {error}
        </p>
      ) : null}
      <button className="run-button" type="button" onClick={status === 'error' ? onRetry : onRun} disabled={!canRun && status !== 'error'}>
        {status === 'error' ? <RefreshCw size={17} /> : <Play size={17} />}
        {status === 'error' ? 'Retry' : 'Run'}
      </button>
    </article>
  );
}

function GatePanel({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const matrix = state.artifacts.find((artifact) => artifact.artifactType === 'Solution Decision Matrix');
  const [solution, setSolution] = useState('');

  return (
    <section className="gate-panel">
      <div className="gate-row solution-gate">
        <div>
          <p className="eyebrow">Optional Focus</p>
          <h2>Preferred Solutions</h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = solution.trim();
            if (!trimmed) return;
            setState((current) => ({ ...current, selectedSolutions: [...current.selectedSolutions, trimmed] }));
            setSolution('');
          }}
        >
          <input disabled={!matrix} value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Option or solution path" />
          <button type="submit" disabled={!matrix || !solution.trim()}>
            <Save size={17} />
            Add
          </button>
        </form>
      </div>
      <div className="chips">
        {state.selectedSolutions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() =>
              setState((current) => ({
                ...current,
                selectedSolutions: current.selectedSolutions.filter((selected) => selected !== item),
              }))
            }
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function ArtifactList({
  artifacts,
  selectedId,
  onSelect,
}: {
  artifacts: Artifact[];
  selectedId?: string;
  onSelect: (artifactId: string) => void;
}) {
  return (
    <section className="artifact-list">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Artifacts</p>
          <h2>{artifacts.length}</h2>
        </div>
      </div>
      {artifacts.map((artifact) => (
        <button key={artifact.id} className={selectedId === artifact.id ? 'artifact-item selected' : 'artifact-item'} type="button" onClick={() => onSelect(artifact.id)}>
          <FileText size={17} />
          <span>
            <strong>{artifact.artifactType}</strong>
            <small>{artifact.agentApp.replace(/_/g, ' ')}</small>
          </span>
        </button>
      ))}
    </section>
  );
}

function ArtifactPanel({
  artifact,
  onUpdate,
  messages,
  pendingProposal,
  editError,
  isEditing,
  onSendEdit,
  onApplyProposal,
  onRejectProposal,
}: {
  artifact?: Artifact;
  onUpdate: (artifact: Artifact) => void;
  messages: ArtifactChatMessage[];
  pendingProposal?: ArtifactEditProposal;
  editError?: string;
  isEditing: boolean;
  onSendEdit: (artifact: Artifact, message: string) => void;
  onApplyProposal: (artifact: Artifact, proposal: ArtifactEditProposal) => void;
  onRejectProposal: (proposal: ArtifactEditProposal) => void;
}) {
  if (!artifact) {
    return (
      <section className="artifact-panel empty">
        <FileText size={34} />
        <h2>No artifact selected</h2>
      </section>
    );
  }

  return (
    <section className="artifact-panel">
      <div className="artifact-toolbar">
        <div>
          <p className="eyebrow">{artifact.parseStatus}</p>
          <h2>{artifact.artifactTitle}</h2>
        </div>
        <div className="toolbar-actions">
          <IconButton label="Download Markdown" onClick={() => download(artifactFileName(artifact, 'md'), artifact.content, 'text/markdown')}>
            <Download size={18} />
          </IconButton>
          <IconButton label="Download JSON" onClick={() => download(artifactFileName(artifact, 'json'), JSON.stringify(artifact, null, 2), 'application/json')}>
            <FileJson size={18} />
          </IconButton>
          <IconButton label="Print" onClick={() => window.print()}>
            <Printer size={18} />
          </IconButton>
        </div>
      </div>
      <label>
        Summary
        <textarea
          rows={3}
          value={artifact.summary}
          onChange={(event) => onUpdate({ ...artifact, summary: event.target.value })}
        />
      </label>
      <label className="editor">
        Artifact Markdown
        <textarea
          rows={18}
          value={artifact.content}
          onChange={(event) => onUpdate({ ...artifact, content: event.target.value })}
        />
      </label>
      <ArtifactEditChat
        artifact={artifact}
        messages={messages}
        pendingProposal={pendingProposal}
        error={editError}
        isRunning={isEditing}
        onSend={onSendEdit}
        onApply={onApplyProposal}
        onReject={onRejectProposal}
      />
    </section>
  );
}

function ProposalDiff({ artifact, proposal }: { artifact: Artifact; proposal: ArtifactEditProposal }) {
  const rows = changedRows(artifact, proposal);
  if (!rows.length) {
    return <p className="empty-copy">The proposal does not change the current artifact text.</p>;
  }

  return (
    <div className="proposal-diff">
      {rows.map((row) => (
        <div className="diff-row" key={row.label}>
          <h3>{row.label}</h3>
          <div className="diff-columns">
            <div>
              <span>Current</span>
              <pre>{displayValue(row.current)}</pre>
            </div>
            <div>
              <span>Proposed</span>
              <pre>{displayValue(row.proposed)}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtifactEditChat({
  artifact,
  messages,
  pendingProposal,
  error,
  isRunning,
  onSend,
  onApply,
  onReject,
}: {
  artifact: Artifact;
  messages: ArtifactChatMessage[];
  pendingProposal?: ArtifactEditProposal;
  error?: string;
  isRunning: boolean;
  onSend: (artifact: Artifact, message: string) => void;
  onApply: (artifact: Artifact, proposal: ArtifactEditProposal) => void;
  onReject: (proposal: ArtifactEditProposal) => void;
}) {
  const [draft, setDraft] = useState('');
  const canSend = Boolean(draft.trim()) && !isRunning;

  return (
    <section className="artifact-chat">
      <div className="chat-heading">
        <div>
          <p className="eyebrow">Artifact Edit Chat</p>
          <h2>Review before applying</h2>
        </div>
        <MessageSquare size={20} />
      </div>

      <div className="chat-log" aria-live="polite">
        {messages.length ? (
          messages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <span>{message.role === 'user' ? 'You' : 'Editor'}</span>
              <p>{message.content}</p>
            </div>
          ))
        ) : (
          <p className="empty-copy">Ask for a focused edit, then review the proposed changes before they touch the artifact.</p>
        )}
        {isRunning ? (
          <div className="chat-message assistant">
            <span>Editor</span>
            <p>Reviewing the artifact...</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="stage-error artifact-edit-error">
          <AlertCircle size={15} />
          {error}
        </p>
      ) : null}

      {pendingProposal ? (
        <section className="proposal-review">
          <div className="proposal-heading">
            <div>
              <p className="eyebrow">Pending Review</p>
              <h2>{pendingProposal.changeSummary}</h2>
            </div>
            <div className="proposal-actions">
              <button className="secondary" type="button" onClick={() => onReject(pendingProposal)}>
                <X size={17} />
                Reject
              </button>
              <button className="run-button" type="button" onClick={() => onApply(artifact, pendingProposal)}>
                <Check size={17} />
                Apply
              </button>
            </div>
          </div>
          <ProposalDiff artifact={artifact} proposal={pendingProposal} />
        </section>
      ) : null}

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSend) return;
          onSend(artifact, draft);
          setDraft('');
        }}
      >
        <textarea
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Describe the artifact edit to propose"
          disabled={isRunning}
        />
        <button className="run-button" type="submit" disabled={!canSend}>
          <Send size={17} />
          Send
        </button>
      </form>
    </section>
  );
}

function ApiNotice({ hasKey }: { hasKey: boolean }) {
  if (!isLocalDev) {
    return (
      <aside className="api-notice ready">
        <Check size={18} />
        Running in deployed mode. Agent credentials are read from server environment.
      </aside>
    );
  }

  if (hasKey) {
    return (
      <aside className="api-notice ready">
        <Check size={18} />
        Gemini key detected in local env. Start ADK with <code>npm run adk</code>.
      </aside>
    );
  }
  return (
    <aside className="api-notice warning">
      <AlertCircle size={18} />
      Add <code>GOOGLE_API_KEY</code> or <code>GEMINI_API_KEY</code> to <code>.env</code>, then restart Vite.
    </aside>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [runningStageId, setRunningStageId] = useState<string>();
  const [runningArtifactEditId, setRunningArtifactEditId] = useState<string>();
  const [artifactEditErrors, setArtifactEditErrors] = useState<Record<string, string>>({});
  const [isWorkflowBoardCollapsed, setIsWorkflowBoardCollapsed] = useState(false);

  useEffect(() => saveState(state), [state]);

  const activeStage = stages.find((stage) => stage.id === state.activeStageId) ?? stages[0];
  const selectedArtifact = useMemo(() => state.artifacts.find((artifact) => artifact.id === state.selectedArtifactId) ?? state.artifacts.at(-1), [state.artifacts, state.selectedArtifactId]);
  const selectedMessages = selectedArtifact ? state.artifactChats[selectedArtifact.id] ?? [] : [];
  const selectedPendingProposal = selectedArtifact
    ? [...state.artifactEditProposals].reverse().find((proposal) => proposal.artifactId === selectedArtifact.id && proposal.status === 'pending')
    : undefined;
  const projectReady = isProjectReady(state.project);

  async function executeStage(stage: Stage) {
    if (!hasGeminiKey) {
      setState((current) => ({
        ...current,
        errors: {
          ...current.errors,
          [stage.id]: 'Gemini key missing in local dev. Configure .env and restart Vite.',
        },
      }));
      return;
    }
    if (!isStageReady(state, stage)) return;

    setRunningStageId(stage.id);
    setState((current) => ({ ...current, errors: { ...current.errors, [stage.id]: '' }, activeStageId: stage.id }));

    try {
      const contextArtifacts = getContextArtifacts(state, stage);
      const results = await runStage(stage, state.project, contextArtifacts, state.selectedSolutions);
      const artifacts = results.flatMap((result) => result.artifacts);
      const runs = results.map((result, index) => ({
        id: `${stage.id}-${Date.now()}-${index}`,
        stageId: stage.id,
        agentApp: stage.agentApps[index],
        status: 'success' as const,
        createdAt: new Date().toISOString(),
        prompt: result.prompt,
        events: result.events,
      }));

      setState((current) => ({
        ...current,
        artifacts: [
          ...current.artifacts.filter((artifact) => !stage.artifactTypes.includes(artifact.artifactType)),
          ...artifacts,
        ],
        runs: [...current.runs, ...runs],
        selectedArtifactId: artifacts.at(-1)?.id ?? current.selectedArtifactId,
        errors: { ...current.errors, [stage.id]: '' },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ADK error';
      setState((current) => ({
        ...current,
        errors: { ...current.errors, [stage.id]: message },
        runs: [
          ...current.runs,
          {
            id: `${stage.id}-${Date.now()}`,
            stageId: stage.id,
            agentApp: stage.agentApps.at(-1) ?? stage.id,
            status: 'error',
            createdAt: new Date().toISOString(),
            prompt: '',
            events: [],
            error: message,
          },
        ],
      }));
    } finally {
      setRunningStageId(undefined);
    }
  }

  async function sendArtifactEdit(artifact: Artifact, message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!hasGeminiKey) {
      setArtifactEditErrors((current) => ({
        ...current,
        [artifact.id]: 'Gemini key missing in local dev. Configure .env and restart Vite.',
      }));
      return;
    }

    const userMessage: ArtifactChatMessage = {
      id: newId('artifact-chat'),
      artifactId: artifact.id,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const transcript = [...(state.artifactChats[artifact.id] ?? []), userMessage];

    setRunningArtifactEditId(artifact.id);
    setArtifactEditErrors((current) => ({ ...current, [artifact.id]: '' }));
    setState((current) => ({
      ...current,
      artifactChats: {
        ...current.artifactChats,
        [artifact.id]: [...(current.artifactChats[artifact.id] ?? []), userMessage],
      },
    }));

    try {
      const result = await runArtifactEdit(state.project, artifact, transcript);
      const assistantMessage: ArtifactChatMessage = {
        id: newId('artifact-chat'),
        artifactId: artifact.id,
        role: 'assistant',
        content: result.assistantMessage,
        createdAt: new Date().toISOString(),
      };
      const proposal: ArtifactEditProposal | undefined = result.proposal
        ? {
            id: newId('artifact-proposal'),
            artifactId: artifact.id,
            status: 'pending',
            changeSummary: result.proposal.changeSummary,
            revisedArtifact: result.proposal.revisedArtifact,
            createdAt: new Date().toISOString(),
          }
        : undefined;

      setState((current) => ({
        ...current,
        artifactChats: {
          ...current.artifactChats,
          [artifact.id]: [...(current.artifactChats[artifact.id] ?? []), assistantMessage],
        },
        artifactEditProposals: proposal
          ? [
              ...current.artifactEditProposals.map((item) =>
                item.artifactId === artifact.id && item.status === 'pending' ? { ...item, status: 'rejected' as const } : item,
              ),
              proposal,
            ]
          : current.artifactEditProposals,
        runs: [
          ...current.runs,
          {
            id: newId('run'),
            stageId: 'artifact-edit',
            agentApp: 'artifact_editor_agent',
            status: 'success' as const,
            createdAt: new Date().toISOString(),
            prompt: result.prompt,
            events: result.events,
          },
        ],
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown artifact editor error';
      setArtifactEditErrors((current) => ({ ...current, [artifact.id]: errorMessage }));
      setState((current) => ({
        ...current,
        runs: [
          ...current.runs,
          {
            id: newId('run'),
            stageId: 'artifact-edit',
            agentApp: 'artifact_editor_agent',
            status: 'error',
            createdAt: new Date().toISOString(),
            prompt: '',
            events: [],
            error: errorMessage,
          },
        ],
      }));
    } finally {
      setRunningArtifactEditId(undefined);
    }
  }

  function applyArtifactProposal(artifact: Artifact, proposal: ArtifactEditProposal) {
    const revised = proposal.revisedArtifact;
    const updated: Artifact = {
      ...artifact,
      ...revised,
      content: revised.content || artifactToMarkdown(revised),
      rawText: JSON.stringify(revised, null, 2),
      parseStatus: 'parsed',
    };

    setState((current) => ({
      ...current,
      artifacts: current.artifacts.map((item) => (item.id === artifact.id ? updated : item)),
      artifactEditProposals: current.artifactEditProposals.map((item) =>
        item.id === proposal.id ? { ...item, status: 'applied' as const } : item,
      ),
    }));
  }

  function rejectArtifactProposal(proposal: ArtifactEditProposal) {
    setState((current) => ({
      ...current,
      artifactEditProposals: current.artifactEditProposals.map((item) =>
        item.id === proposal.id ? { ...item, status: 'rejected' as const } : item,
      ),
    }));
  }

  return (
    <main>
      <div className="app-shell">
        <ProjectPanel
          project={state.project}
          onChange={(project) => setState((current) => ({ ...current, project }))}
          onReset={() => {
            clearState();
            setState(initialState);
          }}
        />
        <ApiNotice hasKey={hasGeminiKey} />

        <section className={isWorkflowBoardCollapsed ? 'workspace workflow-collapsed' : 'workspace'}>
          <div className={isWorkflowBoardCollapsed ? 'board collapsed' : 'board'}>
            <div className="board-header">
              <div>
                <p className="eyebrow">Workflow Board</p>
                <h2>{activeStage.title}</h2>
              </div>
              <div className="board-actions">
                <StatusPill status={projectReady ? 'ready' : 'locked'} />
                <button
                  className="icon-button board-toggle"
                  type="button"
                  aria-label={isWorkflowBoardCollapsed ? 'Expand workflow board' : 'Collapse workflow board'}
                  aria-expanded={!isWorkflowBoardCollapsed}
                  title={isWorkflowBoardCollapsed ? 'Expand workflow board' : 'Collapse workflow board'}
                  onClick={() => setIsWorkflowBoardCollapsed((current) => !current)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            {isWorkflowBoardCollapsed ? null : (
              <div className="board-body">
                <div className="stage-grid">
                  {stages.map((stage) => {
                    const status = getStageStatus(state, stage, runningStageId);
                    return (
                      <StageCard
                        key={stage.id}
                        stage={stage}
                        status={status}
                        active={stage.id === activeStage.id}
                        hasKey={hasGeminiKey}
                        error={state.errors[stage.id]}
                        onOpen={() => setState((current) => ({ ...current, activeStageId: stage.id }))}
                        onRun={() => executeStage(stage)}
                        onRetry={() => executeStage(stage)}
                      />
                    );
                  })}
                </div>
                <GatePanel state={state} setState={setState} />
              </div>
            )}
          </div>

          <aside className="side-panel">
            <ArtifactList
              artifacts={state.artifacts}
              selectedId={selectedArtifact?.id}
              onSelect={(artifactId) => setState((current) => ({ ...current, selectedArtifactId: artifactId }))}
            />
            <ArtifactPanel
              artifact={selectedArtifact}
              messages={selectedMessages}
              pendingProposal={selectedPendingProposal}
              editError={selectedArtifact ? artifactEditErrors[selectedArtifact.id] : undefined}
              isEditing={Boolean(selectedArtifact && runningArtifactEditId === selectedArtifact.id)}
              onUpdate={(artifact) =>
                setState((current) => ({
                  ...current,
                  artifacts: current.artifacts.map((item) => (item.id === artifact.id ? artifact : item)),
                }))
              }
              onSendEdit={sendArtifactEdit}
              onApplyProposal={applyArtifactProposal}
              onRejectProposal={rejectArtifactProposal}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}
