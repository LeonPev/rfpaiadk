import type { AppState, ParsedArtifact, Project, Stage } from './types';

export const userId = 'ayit-local-user';

export const stages: Stage[] = [
  {
    id: 'discovery',
    step: '1',
    title: 'Discovery',
    agentApps: ['discovery_agent'],
    artifactTypes: ['Problem Definition Canvas'],
    dependsOnArtifacts: [],
    description: 'Human answers are converted into a shared problem frame.',
  },
  {
    id: 'requirements',
    step: '2',
    title: 'Requirements',
    agentApps: ['brief_builder_agent'],
    artifactTypes: ['Procurement Research Charter'],
    dependsOnArtifacts: ['Problem Definition Canvas'],
    description: 'The canvas becomes a research-ready procurement charter.',
  },
  {
    id: 'research-planning',
    step: '2.5',
    title: 'Research Planning',
    agentApps: ['research_planner_agent'],
    artifactTypes: ['Intelligence Collection Plan'],
    dependsOnArtifacts: ['Procurement Research Charter'],
    description: 'The charter becomes an intelligence collection plan.',
  },
  {
    id: 'market-research',
    step: '3',
    title: 'Market Research',
    agentApps: ['market_research_agent'],
    artifactTypes: ['Market Landscape Canvas'],
    dependsOnArtifacts: ['Intelligence Collection Plan'],
    description: 'The research plan drives grounded market landscape work.',
    usesSearch: true,
  },
  {
    id: 'solution-generation',
    step: '4',
    title: 'Solution Generation',
    agentApps: ['solution_architect_agent'],
    artifactTypes: ['Solution Decision Matrix'],
    dependsOnArtifacts: ['Market Landscape Canvas'],
    description: 'Market findings become a decision matrix of solution paths.',
  },
  {
    id: 'vendor-research',
    step: '5',
    title: 'Vendor Research',
    agentApps: ['vendor_intelligence_agent'],
    artifactTypes: ['Vendor Evaluation Scorecard'],
    dependsOnArtifacts: ['Solution Decision Matrix'],
    description: 'The solution decision matrix focuses vendor evaluation.',
    usesSearch: true,
  },
  {
    id: 'quality-review',
    step: '5.5',
    title: 'Quality Review',
    agentApps: ['evidence_agent', 'red_team_agent'],
    artifactTypes: ['Evidence Review Notes', 'Procurement Review Memo'],
    dependsOnArtifacts: ['Vendor Evaluation Scorecard'],
    description: 'Evidence is checked, then assumptions and risks are red-teamed.',
    usesSearch: true,
  },
  {
    id: 'leadership-package',
    step: '6',
    title: 'Leadership Package',
    agentApps: ['executive_packaging_agent'],
    artifactTypes: ['Executive Decision Brief', 'Leadership Presentation Deck'],
    dependsOnArtifacts: ['Procurement Review Memo'],
    description: 'All artifacts are packaged for leadership decision and presentation.',
  },
];

export const defaultProject: Project = {
  name: 'AYIT Procurement Decision',
  sponsor: '',
  decisionDeadline: '',
  problemStatement: '',
  stakeholders: '',
  constraints: '',
};

export const fallbackByArtifactType: Record<string, ParsedArtifact> = {
  'Problem Definition Canvas': {
    artifactTitle: 'Problem Definition Canvas',
    artifactType: 'Problem Definition Canvas',
    summary: 'A structured framing of the procurement problem, stakeholders, success criteria, and constraints.',
    sections: [
      { heading: 'Problem', body: 'Capture the operational problem in one sentence.' },
      { heading: 'Stakeholders', body: 'List decision makers, affected teams, and subject-matter experts.' },
      { heading: 'Success Criteria', body: ['Decision can be defended', 'Tradeoffs are visible', 'Evidence is traceable'] },
    ],
    risks: ['The initial problem frame may be too broad for vendor comparison.'],
    openQuestions: ['Which constraint is non-negotiable?'],
    recommendedNextAction: 'Generate the procurement research charter.',
  },
  'Procurement Research Charter': {
    artifactTitle: 'Procurement Research Charter',
    artifactType: 'Procurement Research Charter',
    summary: 'A research charter defining scope, evaluation questions, data needs, and decision criteria.',
    sections: [
      { heading: 'Research Questions', body: ['What solution categories are viable?', 'What evidence is needed for leadership?'] },
      { heading: 'Evaluation Criteria', body: ['Fit', 'Risk', 'Cost', 'Implementation effort', 'Vendor maturity'] },
    ],
    risks: ['Criteria may need weighting before final vendor scoring.'],
    openQuestions: ['Who owns the final decision?'],
    recommendedNextAction: 'Plan the intelligence collection work.',
  },
  'Intelligence Collection Plan': {
    artifactTitle: 'Intelligence Collection Plan',
    artifactType: 'Intelligence Collection Plan',
    summary: 'A plan for collecting market, vendor, evidence, and risk intelligence.',
    sections: [
      { heading: 'Sources', body: ['Vendor documentation', 'Analyst reports', 'Customer evidence', 'Security and compliance pages'] },
      { heading: 'Collection Tasks', body: ['Map categories', 'Identify candidate vendors', 'Capture evidence quality'] },
    ],
    risks: ['Research may over-index on vendor claims without corroboration.'],
    openQuestions: ['Which sources are acceptable for use?'],
    recommendedNextAction: 'Continue to market research.',
  },
};

export const initialState: AppState = {
  project: defaultProject,
  artifacts: [],
  runs: [],
  selectedSolutions: [],
  agentPromptOverrides: {},
  activeStageId: 'discovery',
  errors: {},
  artifactChats: {},
  artifactEditProposals: [],
};

export function stageHasArtifact(state: AppState, stage: Stage): boolean {
  return stage.artifactTypes.every((type) => state.artifacts.some((artifact) => artifact.artifactType === type));
}

export function hasArtifactType(state: AppState, artifactType: string): boolean {
  return state.artifacts.some((artifact) => artifact.artifactType === artifactType);
}

export function isProjectReady(project: Project): boolean {
  return Boolean(project.name.trim() && project.problemStatement.trim());
}

export function isStageReady(state: AppState, stage: Stage): boolean {
  if (stageHasArtifact(state, stage)) return true;
  if (stage.id === 'discovery') return isProjectReady(state.project);
  if (!stage.dependsOnArtifacts.every((artifactType) => hasArtifactType(state, artifactType))) return false;
  return true;
}

export function getStageStatus(state: AppState, stage: Stage, runningStageId?: string) {
  if (runningStageId === stage.id) return 'running';
  if (stageHasArtifact(state, stage)) return 'complete';
  if (state.errors[stage.id]) return 'error';
  return isStageReady(state, stage) ? 'ready' : 'locked';
}

export function getContextArtifacts(state: AppState, stage: Stage) {
  if (stage.id === 'quality-review') return state.artifacts.filter((artifact) => artifact.artifactType !== 'Procurement Review Memo');
  if (stage.id === 'leadership-package') return state.artifacts;
  return state.artifacts.filter((artifact) => stage.dependsOnArtifacts.includes(artifact.artifactType));
}
