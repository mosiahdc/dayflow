import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface DocBookmark {
  id: string;
  documentId: string;
  label: string;
  // PDF: page number. EPUB: CFI string. One is always set.
  page: number | null;
  cfi: string | null;
  createdAt: string;
}

interface BookmarkStore {
  // bookmarks keyed by documentId for fast lookup
  byDoc: Record<string, DocBookmark[]>;
  fetchForDoc: (documentId: string) => Promise<void>;
  addBookmark: (documentId: string, label: string, page: number | null, cfi: string | null) => Promise<void>;
  deleteBookmark: (id: string, documentId: string) => Promise<void>;
}

const mapRow = (r: Record<string, unknown>): DocBookmark => ({
  id: r.id as string,
  documentId: r.document_id as string,
  label: r.label as string,
  page: r.page as number | null,
  cfi: r.cfi as string | null,
  createdAt: r.created_at as string,
});

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  byDoc: {},

  fetchForDoc: async (documentId) => {
    const { data, error } = await supabase
      .from('document_bookmarks')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      set((s) => ({ byDoc: { ...s.byDoc, [documentId]: data.map(mapRow) } }));
    }
  },

  addBookmark: async (documentId, label, page, cfi) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('document_bookmarks')
      .insert({ document_id: documentId, user_id: user.id, label, page, cfi })
      .select()
      .single();
    if (!error && data) {
      const bm = mapRow(data);
      set((s) => ({
        byDoc: {
          ...s.byDoc,
          [documentId]: [...(s.byDoc[documentId] ?? []), bm],
        },
      }));
    }
  },

  deleteBookmark: async (id, documentId) => {
    await supabase.from('document_bookmarks').delete().eq('id', id);
    set((s) => ({
      byDoc: {
        ...s.byDoc,
        [documentId]: (s.byDoc[documentId] ?? []).filter((b) => b.id !== id),
      },
    }));
  },
}));
