
export interface WordResult {
  original: string;
  translation: string;
  partOfSpeech: string;
  exampleAr: string;
  exampleEn: string;
  definition: string;
  imageUrl?: string;
}

export interface SavedWord extends WordResult {
  id: string;
  timestamp: number;
}
