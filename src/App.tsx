import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  FileJson,
  FileText,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { runStage } from './adkClient';
import { artifactFileName, download } from './format';
import { clearState, loadState, saveState } from './storage';
import type { AppState, Artifact, Project, Stage } from './types';
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

function updateProject(project: Project, key: keyof Project, value: string): Project {
  return { ...project, [key]: value };
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
      <div className="gate-row">
        <div>
          <p className="eyebrow">Human Gate</p>
          <h2>Research Plan Approval</h2>
        </div>
        <button
          type="button"
          className={state.approvedResearchPlan ? 'secondary success' : 'secondary'}
          disabled={!state.artifacts.some((artifact) => artifact.artifactType === 'Intelligence Collection Plan')}
          onClick={() => setState((current) => ({ ...current, approvedResearchPlan: !current.approvedResearchPlan }))}
        >
          <Check size={17} />
          {state.approvedResearchPlan ? 'Approved' : 'Approve'}
        </button>
      </div>
      <div className="gate-row solution-gate">
        <div>
          <p className="eyebrow">Human Gate</p>
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
}: {
  artifact?: Artifact;
  onUpdate: (artifact: Artifact) => void;
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

  useEffect(() => saveState(state), [state]);

  const activeStage = stages.find((stage) => stage.id === state.activeStageId) ?? stages[0];
  const selectedArtifact = useMemo(() => state.artifacts.find((artifact) => artifact.id === state.selectedArtifactId) ?? state.artifacts.at(-1), [state.artifacts, state.selectedArtifactId]);
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

        <section className="workspace">
          <div className="board">
            <div className="board-header">
              <div>
                <p className="eyebrow">Workflow Board</p>
                <h2>{activeStage.title}</h2>
              </div>
              <StatusPill status={projectReady ? 'ready' : 'locked'} />
            </div>
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

          <aside className="side-panel">
            <ArtifactList
              artifacts={state.artifacts}
              selectedId={selectedArtifact?.id}
              onSelect={(artifactId) => setState((current) => ({ ...current, selectedArtifactId: artifactId }))}
            />
            <ArtifactPanel
              artifact={selectedArtifact}
              onUpdate={(artifact) =>
                setState((current) => ({
                  ...current,
                  artifacts: current.artifacts.map((item) => (item.id === artifact.id ? artifact : item)),
                }))
              }
            />
          </aside>
        </section>
      </div>
    </main>
  );
}
