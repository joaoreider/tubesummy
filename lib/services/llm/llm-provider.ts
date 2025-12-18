import { Language, Summary } from "../../types";

export interface LLMProvider {
  generateSummary(params: {
    transcript: string;
    language: Language;
  }): Promise<Summary>;
}


