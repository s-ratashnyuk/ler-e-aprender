export type bookEntry = {
  id: string;
  title: string;
  description: string;
  language: string;
  author?: string;
  coverImage?: string;
  cover?: {
    label: string;
    motif: string;
    gradient: string;
  };
};
