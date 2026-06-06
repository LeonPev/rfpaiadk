export type StageStatus = 'locked' | 'ready' | 'running' | 'complete' | 'error';

export type ArtifactSection = {
  heading: string;
  body: string | string[];
};

export type ParsedArtifact = {
  artifactTitle: string;
  artifactType: string;
  summary: string;
  sections: ArtifactSection[];
  risks: string[];
  openQuestions: string[];
  recommendedNextAction: string;
};

export type Artifact = ParsedArtifact & {
  id: string;
  stageId: string;
  agentApp: string;
  createdAt: string;
  content: string;
  rawText: string;
  parseStatus: 'parsed' | 'raw';
};

export type ArtifactChatMessage = {
  id: string;
  artifactId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ProposedArtifact = ParsedArtifact & {
  content: string;
};

export type ArtifactEditProposal = {
  id: string;
  artifactId: string;
  status: 'pending' | 'approved' | 'rejected';
  changeSummary: string;
  revisedArtifact: ProposedArtifact;
  createdAt: string;
};

export type Project = {
  name: string;
  sponsor: string;
  decisionDeadline: string;
  problemStatement: string;
  stakeholders: string;
  constraints: string;
};

export type AgentRun = {
  id: string;
  stageId: string;
  agentApp: string;
  status: 'success' | 'error';
  createdAt: string;
  prompt: string;
  events: unknown[];
  error?: string;
};

export type AppState = {
  project: Project;
  artifacts: Artifact[];
  runs: AgentRun[];
  approvedResearchPlan: boolean;
  selectedSolutions: string[];
  activeStageId: string;
  selectedArtifactId?: string;
  errors: Record<string, string>;
  artifactChats: Record<string, ArtifactChatMessage[]>;
  artifactEditProposals: ArtifactEditProposal[];
};

export type Stage = {
  id: string;
  step: string;
  title: string;
  agentApps: string[];
  artifactTypes: string[];
  dependsOnArtifacts: string[];
  requiresResearchApproval?: boolean;
  requiresSolutionSelection?: boolean;
  humanGate?: 'research-approval' | 'solution-selection';
  description: string;
  usesSearch?: boolean;
};
