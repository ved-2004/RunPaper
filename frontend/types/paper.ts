export interface Hyperparameter {
  name: string;
  value: string;
  source: string;
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
  error_message: string | null;
}

export interface PaperSummary {
  paper_id: string;
  title: string | null;
  authors: string[] | null;
  uploaded_at: string;
  status: "processing" | "complete" | "failed";
}
