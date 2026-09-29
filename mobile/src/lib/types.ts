// Mirrors the response shape of the server's POST /analyze.

export interface Source {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  citedBy: number | null;
  origin: 'openalex' | 'crossref' | 'web';
}

export interface Suggestion {
  source: Source;
  strength: 'strong' | 'possible';
  explanation: string;
  apa: string;
  mla: string;
}

export type ClaimCategory =
  | 'statistic'
  | 'fact'
  | 'quotation'
  | 'research_finding'
  | 'historical'
  | 'paraphrased_idea';

export interface Claim {
  quote: string;
  reason: string;
  category: ClaimCategory;
  searchQuery: string;
  suggestions: Suggestion[];
}

/** A sentence found in stage 1, before sources are searched. */
export type DraftClaim = Omit<Claim, 'suggestions'>;

export interface AnalysisResult {
  title: string;
  claims: Claim[];
  /** Whether advanced (web) search was used - a Pro feature. Missing on older saved results. */
  advanced?: boolean;
}

/** An analysis saved on the device, shown in the History tab. */
export interface SavedAnalysis extends AnalysisResult {
  id: string;
  createdAt: string;
  fileName: string;
  sourceKind: 'scan' | 'file';
}

/** A file ready to upload. `data` is base64. */
export interface UploadFile {
  name: string;
  mimeType: string;
  data: string;
}
