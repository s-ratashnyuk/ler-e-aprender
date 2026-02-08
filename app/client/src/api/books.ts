import type { bookEntry } from "../types/bookEntry";
import type { bookDetail } from "../types/bookDetail";
import type { bookApiEntry } from "../types/bookApiEntry";
import type { bookApiListResponse } from "../types/bookApiListResponse";
import type { bookApiDetailResponse } from "../types/bookApiDetailResponse";
import type { bookApiContentResponse } from "../types/bookApiContentResponse";
import type { bookContentChunk } from "../types/bookContentChunk";

const normalizeCoverImage = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const mapEntryFromApi = (entry: bookApiEntry): bookEntry => {
  return {
    id: entry.Id,
    title: entry.Title,
    author: entry.Author,
    description: entry.Description,
    language: entry.Language,
    coverImage: normalizeCoverImage(entry.CoverImage)
  };
};

const mapDetailFromApi = (payload: bookApiDetailResponse): bookDetail => {
  return {
    id: payload.Id,
    title: payload.Title,
    author: payload.Author,
    description: payload.Description,
    language: payload.Language,
    coverImage: normalizeCoverImage(payload.CoverImage),
    contentLength: payload.ContentLength ?? payload.Content?.length ?? 0,
    textHash: payload.TextHash
  };
};

const mapContentChunkFromApi = (payload: bookApiContentResponse): bookContentChunk => {
  return {
    bookId: payload.Id,
    offset: payload.Offset,
    length: payload.Length,
    totalLength: payload.TotalLength,
    content: payload.Content
  };
};

const get = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, {
    method: "GET",
    credentials: "include"
  });

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  const data = (await response.json().catch(() => null)) as T | { Error?: string } | null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "Error" in data && data.Error
        ? data.Error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!data) {
    throw new Error("Unexpected empty response.");
  }

  return data as T;
};

export const fetchBookCatalog = async (): Promise<bookEntry[]> => {
  const data = await get<bookApiListResponse>("/api/books");
  return Array.isArray(data.Books) ? data.Books.map(mapEntryFromApi) : [];
};

export const fetchBookMeta = async (bookId: string): Promise<bookDetail> => {
  const data = await get<bookApiDetailResponse>(
    `/api/books/${encodeURIComponent(bookId)}?includeContent=false`
  );
  return mapDetailFromApi(data);
};

export const fetchBookChunk = async (
  bookId: string,
  offset: number,
  length: number
): Promise<bookContentChunk> => {
  const params = new URLSearchParams({
    offset: String(offset),
    length: String(length)
  });
  const data = await get<bookApiContentResponse>(
    `/api/books/${encodeURIComponent(bookId)}/content?${params.toString()}`
  );
  return mapContentChunkFromApi(data);
};
