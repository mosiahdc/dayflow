import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Highlight {
  id: string;
  documentId: string;
  documentTitle: string;
  text: string;
  note: string | null;
  color: string;
  page: number | null;       // PDF
  spineIndex: number | null; // EPUB
  createdAt: string;
}

export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#FBBF24' },
  { label: 'Green',  value: '#34D399' },
  { label: 'Blue',   value: '#60A5FA' },
  { label: 'Pink',   value: '#F472B6' },
  { label: 'Purple', value: '#A78BFA' },
];

interface HighlightStore {
  highlights: Highlight[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchForDoc: (documentId: string) => Promise<void>;
  addHighlight: (h: Omit<Highlight, 'id' | 'createdAt'>) => Promise<Highlight | null>;
  updateNote: (id: string, note: string) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
}

const mapRow = (r: Record<string, unknown>): Highlight => ({
  id:            r.id as string,
  documentId:    r.document_id as string,
  documentTitle: r.document_title as string,
  text:          r.text as string,
  note:          r.note as string | null,
  color:         r.color as string,
  page:          r.page as number | null,
  spineIndex:    r.spine_index as number | null,
  createdAt:     r.created_at as string,
});

export const useHighlightStore = create<HighlightStore>((set, get) => ({
  highlights: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('document_highlights')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) set({ highlights: data.map(mapRow) });
    set({ loading: false });
  },

  fetchForDoc: async (documentId) => {
    const { data, error } = await supabase
      .from('document_highlights')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const fetched = data.map(mapRow);
      set((s) => ({
        highlights: [
          ...s.highlights.filter((h) => h.documentId !== documentId),
          ...fetched,
        ],
      }));
    }
  },

  addHighlight: async (h) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('document_highlights')
      .insert({
        user_id:        user.id,
        document_id:    h.documentId,
        document_title: h.documentTitle,
        text:           h.text,
        note:           h.note,
        color:          h.color,
        page:           h.page,
        spine_index:    h.spineIndex,
      })
      .select()
      .single();
    if (error || !data) return null;
    const hl = mapRow(data);
    set((s) => ({ highlights: [hl, ...s.highlights] }));
    return hl;
  },

  updateNote: async (id, note) => {
    await supabase.from('document_highlights').update({ note }).eq('id', id);
    set((s) => ({
      highlights: s.highlights.map((h) => h.id === id ? { ...h, note } : h),
    }));
  },

  deleteHighlight: async (id) => {
    await supabase.from('document_highlights').delete().eq('id', id);
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
  },
}));
