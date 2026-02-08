export type bookApiDetailResponse = {
  Id: string;
  Title: string;
  Author: string;
  Description: string;
  Language: string;
  CoverImage?: string;
  Content?: string;
  ContentLength: number;
  TextHash?: string;
};
