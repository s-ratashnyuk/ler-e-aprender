import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/hooks/useAppDispatch";
import { useAppSelector } from "../../store/hooks/useAppSelector";
import { readerSlice } from "../../store/readerSlice";
import type { rootState } from "../../types/rootState";
import type { bookEntry } from "../../types/bookEntry";
import { fetchBookCatalog } from "../../api/books";

const buildProgressLabel = (progress?: number): string => {
  if (!progress || progress <= 0) {
    return "Novo";
  }
  if (progress >= 0.98) {
    return "Concluido";
  }
  return `${Math.round(progress * 100)}% lido`;
};

const buildActionLabel = (book: bookEntry, activeBookId: string, progress?: number): string => {
  if (book.id === activeBookId) {
    return progress && progress > 0 ? "Continuar" : "Comecar";
  }
  return progress && progress > 0 ? "Continuar" : "Comecar";
};

export const BookSelectionScreen = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const books = useAppSelector((state: rootState) => state.reader.books);
  const activeBookId = useAppSelector((state: rootState) => state.reader.activeBookId);
  const progressByBook = useAppSelector((state: rootState) => state.reader.progressByBook);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");

  const totalProgress = useMemo(() => {
    const values = Object.values(progressByBook);
    if (values.length === 0) {
      return 0;
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }, [progressByBook]);

  useEffect(() => {
    let isMounted = true;
    setLoadStatus("loading");
    fetchBookCatalog()
      .then((catalog) => {
        if (!isMounted) {
          return;
        }
        dispatch(readerSlice.actions.setBooks(catalog));
        setLoadStatus("idle");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setLoadStatus("error");
        if (error instanceof Error && error.message === "Unauthorized") {
          navigate("/login", { replace: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [dispatch, navigate]);

  const handleSelectBook = useCallback(
    (bookId: string) => {
      dispatch(readerSlice.actions.setActiveBook(bookId));
      navigate("/reader");
    },
    [dispatch, navigate]
  );

  return (
    <div className="page library-page">
      <div className="library-shell">
        <header className="library-header">
          <div className="library-title-group">
            <span className="library-eyebrow">Sua estante</span>
            <h1 className="library-heading">Escolha um livro para ler hoje</h1>
            <p className="library-subtitle">
              Cada livro traz uma descricao curta e uma capa unica para ajudar voce a retomar a
              leitura rapidamente.
            </p>
          </div>
          <div className="library-stats">
            <div className="library-stat">
              <span className="library-stat__label">Livros</span>
              <span className="library-stat__value">{books.length}</span>
            </div>
            <div className="library-stat">
              <span className="library-stat__label">Progresso medio</span>
              <span className="library-stat__value">{Math.round(totalProgress * 100)}%</span>
            </div>
          </div>
        </header>
        <div className="library-grid">
          {books.length === 0 ? (
            <div className="library-empty">
              {loadStatus === "loading"
                ? "Carregando livros..."
                : loadStatus === "error"
                  ? "Nao foi possivel carregar os livros."
                  : "Nenhum livro disponivel."}
            </div>
          ) : (
            books.map((book) => {
              const progress = progressByBook[book.id] ?? 0;
              const isActive = book.id === activeBookId;
              const actionLabel = buildActionLabel(book, activeBookId, progress);
              const coverImage = book.coverImage?.trim();
              const coverGradient = book.cover?.gradient;
              const coverStyle = coverImage
                ? { backgroundImage: `url(${coverImage})` }
                : coverGradient
                  ? { backgroundImage: coverGradient }
                  : undefined;
              const hasCover = Boolean(coverImage || coverGradient);
              const hasCoverImage = Boolean(coverImage);
              const showDecorations = !coverImage && book.cover;

              return (
                <article className={`book-card${isActive ? " is-active" : ""}`} key={book.id}>
                  <div
                    className={`book-cover${hasCover ? " has-cover" : " is-empty"}${
                      hasCoverImage ? " has-image" : ""
                    }`}
                    style={coverStyle}
                    aria-hidden="true"
                  >
                    {showDecorations ? (
                      <>
                        <div className="book-cover__label">{book.cover?.label}</div>
                        <div className="book-cover__motif">{book.cover?.motif}</div>
                        <span className="book-cover__badge" />
                      </>
                    ) : null}
                    {!hasCover ? (
                      <div className="book-cover__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M6 5.5h9.5a3.5 3.5 0 0 1 3.5 3.5v9.5H8.5A2.5 2.5 0 0 0 6 21V5.5Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M6 18.5h10.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    ) : null}
                  </div>
                  <div className="book-body">
                    <div className="book-title-row">
                      <h2 className="book-title">{book.title}</h2>
                      {isActive ? <span className="book-current">Atual</span> : null}
                    </div>
                    <p className="book-description">{book.description}</p>
                    <div className="book-meta">
                      <div className="book-meta__details">
                        <span className="book-progress">{buildProgressLabel(progress)}</span>
                      </div>
                      <button
                        className="book-action"
                        type="button"
                        onClick={() => handleSelectBook(book.id)}
                      >
                        {actionLabel}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
