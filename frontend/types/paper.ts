export interface Hyperparameter {
  name: string;
  value: string;
  source: string;
  description?: string;
}

export interface Dataset {
  name: string;
  split: string;
  size: string;
}

export interface PaperMethod {
  architecture: string | null;
  loss_function: string | null;
  training_procedure: string | null;
  key_equations: string[];
}

export interface PaperExtraction {
  title: string | null;
  authors: string[];
  year: number | null;
  core_contribution: string | null;
  method: PaperMethod | null;
  hyperparameters: Hyperparameter[];
  datasets: Dataset[];
  architecture_components: string[];
  ambiguities: string[];
}

export interface CodeScaffold {
  model_py: string;
  train_py: string;
  config_yaml: string;
  requirements_txt: string;
}

export interface ReproducibilityItem {
  label: string;
  category: string;
  provided: boolean;
  value: string | null;
  suggested_default: string | null;
}

// ── Flowchart / Learn tab ─────────────────────────────────────────────────────

export interface FlowchartNode {
  id: string;
  label: string;
  type: "input" | "process" | "output" | "data";
  description: string;
  math: string | null;
  details: string;
  code_ref: string;
  code_file: "model.py" | "train.py";
  layer: number;
}

export interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CodeAnnotation {
  name: string;
  signature: string;
  explanation: string;
  component_id: string | null;
}

export interface FileAnnotations {
  overview: string;
  functions: CodeAnnotation[];
}

export interface FlowchartData {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  annotations: Record<string, FileAnnotations>;
}

export interface PaperRecord {
  paper_id: string;
  arxiv_id: string | null;
  title: string | null;
  authors: string[] | null;
  uploaded_at: string;
  status: "processing" | "complete" | "failed";
  extraction: PaperExtraction | null;
  code_scaffold: CodeScaffold | null;
  reproducibility: ReproducibilityItem[] | null;
  flowchart: FlowchartData | null;
  error_message: string | null;
}

export interface PaperSummary {
  paper_id: string;
  title: string | null;
  authors: string[] | null;
  uploaded_at: string;
  status: "processing" | "complete" | "failed";
}
