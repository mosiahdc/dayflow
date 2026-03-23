import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Document } from '@/types';

// Get local date as YYYY-MM-DD (avoids UTC offset shifting day for PH/Asia timezones)
function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const mapDoc = (t: Record<string, unknown>): Document => ({
  id: t.id as string,
  userId: t.user_id as string,
  title: t.title as string,
  filePath: (() => {
    const fp = t.file_path as string | null;
    if (!fp || fp === 'deleted' || fp === 'manual') return '';
    return fp;
  })(),
  fileSizeBytes: t.file_size_bytes as number,
  pageCount: t.page_count as number | null,
  lastPage: (t.last_page as number) ?? 1,
  fileType: t.file_type as 'pdf' | 'epub',
  createdAt: t.created_at as string,
  status: ((t.status as string) ?? 'queue') as 'queue' | 'reading' | 'finished',
  author: t.author as string | null ?? null,
  coverUrl: t.cover_url as string | null ?? null,
  startedAt: t.started_at as string | null ?? null,
  finishedAt: t.finished_at as string | null ?? null,
  updatedAt: t.updated_at as string ?? t.created_at as string,
});

interface DocumentStore {
  documents: Document[];
  loading: boolean;
  uploading: boolean;
  fetchAll: () => Promise<void>;
  uploadDocument: (file: File, title: string, author?: string, onProgress?: (pct: number) => void) => Promise<Document | null>;
  createManualBook: (title: string, author: string, pageCount: number, coverDataUrl: string | null) => Promise<Document | null>;
  fetchReadingDates: () => Promise<string[]>;
  fetchPagesThisWeek: (weekStart: string) => Promise<number>;
  updateLastPage: (id: string, page: number) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  deleteFileOnly: (id: string) => Promise<void>;
  getSignedUrl: (filePath: string) => Promise<string | null>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loading: false,
  uploading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      set({ documents: data.map(mapDoc), loading: false });
    } else {
      set({ loading: false });
    }
  },

  uploadDocument: async (file: File, title: string, author?: string, onProgress?: (pct: number) => void): Promise<Document | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    set({ uploading: true });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const fileType = ext === 'epub' ? 'epub' : 'pdf';
    const uuid = crypto.randomUUID();
    const filePath = `${user.id}/${uuid}.${ext}`;

    // Use XHR so we get upload progress events
    const uploadError = await new Promise<string | null>((resolve) => {
      supabase.storage.from('documents').createSignedUploadUrl(filePath).then(({ data: signedData, error: signedErr }) => {
        if (signedErr || !signedData) { resolve(signedErr?.message ?? 'No signed URL'); return; }

        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedData.signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(null);
          else resolve(`HTTP ${xhr.status}`);
        };
        xhr.onerror = () => resolve('Network error');
        xhr.send(file);
      });
    });

    if (uploadError) {
      set({ uploading: false });
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title,
        author: author || null,
        file_path: filePath,
        file_size_bytes: file.size,
        file_type: fileType,
        last_page: 1,
        page_count: null,
        status: 'queue',
      })
      .select()
      .single();

    set({ uploading: false });

    if (dbError || !data) {
      console.error('DB insert error:', dbError);
      return null;
    }

    const mapped = mapDoc(data);
    set((s) => ({ documents: [mapped, ...s.documents] }));
    return mapped;
  },

  fetchPagesThisWeek: async (weekStart: string): Promise<number> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // Get all sessions from this week
    const { data: thisWeek } = await supabase
      .from('reading_sessions')
      .select('document_id, date, pages_reached')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .order('date', { ascending: true });

    if (!thisWeek || thisWeek.length === 0) return 0;

    // Get unique document IDs from this week
    const docIds = [...new Set(thisWeek.map(r => r.document_id))];

    // For each book, get the last session BEFORE this week as baseline
    const { data: prevSessions } = await supabase
      .from('reading_sessions')
      .select('document_id, pages_reached')
      .eq('user_id', user.id)
      .lt('date', weekStart)
      .in('document_id', docIds)
      .order('date', { ascending: false });

    // Build baseline: last known page before this week per book
    const baseline: Record<string, number> = {};
    if (prevSessions) {
      for (const row of prevSessions) {
        if (!(row.document_id in baseline)) {
          baseline[row.document_id] = row.pages_reached ?? 0;
        }
      }
    }

    // Group this week's sessions by book, find max pages reached
    const maxThisWeek: Record<string, number> = {};
    for (const row of thisWeek) {
      const cur = row.pages_reached ?? 0;
      if (!(row.document_id in maxThisWeek) || cur > maxThisWeek[row.document_id]) {
        maxThisWeek[row.document_id] = cur;
      }
    }

    // Pages read this week = max this week - baseline (last page before this week)
    let total = 0;
    for (const [docId, maxPage] of Object.entries(maxThisWeek)) {
      const base = baseline[docId] ?? 0;
      total += Math.max(0, maxPage - base);
    }
    return total;
  },

  fetchReadingDates: async (): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('reading_sessions')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (error) { console.error('fetchReadingDates error:', error); return []; }
    // Return distinct dates (multiple books same day = one streak day)
    const unique = [...new Set(data?.map((r: { date: string }) => r.date) ?? [])];
    return unique;
  },

  createManualBook: async (title, author, pageCount, coverDataUrl) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title,
        author: author || null,
        file_path: 'manual',      // sentinel — no real file
        file_size_bytes: 0,
        file_type: 'pdf',
        last_page: 1,
        page_count: pageCount || null,
        status: 'reading',
        started_at: now,
        cover_url: coverDataUrl,
      })
      .select()
      .single();

    if (error || !data) { console.error('createManualBook error:', error); return null; }
    const mapped = mapDoc(data);
    set((s) => ({ documents: [mapped, ...s.documents] }));
    return mapped;
  },

  updateLastPage: async (id: string, page: number) => {
    const now = new Date().toISOString();
    const todayDate = localDateStr(); // local date, not UTC — avoids off-by-one in PH/Asia
    await supabase.from('documents').update({ last_page: page, updated_at: now }).eq('id', id);
    // Upsert a reading session for today — one row per book per day
    await supabase.from('reading_sessions').upsert(
      { user_id: (await supabase.auth.getUser()).data.user?.id, document_id: id, date: todayDate, pages_reached: page },
      { onConflict: 'user_id,document_id,date' }
    );
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, lastPage: page, updatedAt: now } : d)),
    }));
  },

  updateTitle: async (id: string, title: string) => {
    await supabase.from('documents').update({ title }).eq('id', id);
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, title } : d)),
    }));
  },

  deleteDocument: async (id: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) return;
    // Delete from storage
    await supabase.storage.from('documents').remove([doc.filePath]);
    // Delete from DB
    await supabase.from('documents').delete().eq('id', id);
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },

  deleteFileOnly: async (id: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc || !doc.filePath) return;
    await supabase.storage.from('documents').remove([doc.filePath]);
    // Use sentinel 'deleted' so non-nullable columns still work
    await supabase.from('documents').update({ file_path: 'deleted' }).eq('id', id);
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, filePath: '' } : d
      ),
    }));
  },

  updateStatus: async (id, status, extra = {}) => {
    const now = new Date().toISOString();
    const todayDate = localDateStr(); // local date, not UTC
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (extra.startedAt !== undefined) patch.started_at = extra.startedAt;
    if (extra.finishedAt !== undefined) patch.finished_at = extra.finishedAt;
    await supabase.from('documents').update(patch).eq('id', id);
    // When finishing a book, record a final session for today
    if (status === 'finished') {
      const doc = get().documents.find(d => d.id === id);
      if (doc) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('reading_sessions').upsert(
            { user_id: user.id, document_id: id, date: todayDate, pages_reached: doc.lastPage },
            { onConflict: 'user_id,document_id,date' }
          );
        }
      }
    }
    set((s) => ({
      documents: s.documents.map((d) => d.id === id ? {
        ...d, status, updatedAt: now,
        startedAt: extra.startedAt !== undefined ? extra.startedAt ?? null : d.startedAt,
        finishedAt: extra.finishedAt !== undefined ? extra.finishedAt ?? null : d.finishedAt,
      } : d),
    }));
  },

  updateDates: async (id, startedAt, finishedAt) => {
    await supabase.from('documents').update({ started_at: startedAt, finished_at: finishedAt }).eq('id', id);
    set((s) => ({
      documents: s.documents.map((d) => d.id === id ? { ...d, startedAt, finishedAt } : d),
    }));
  },

  updateAuthor: async (id, author) => {
    await supabase.from('documents').update({ author }).eq('id', id);
    set((s) => ({
      documents: s.documents.map((d) => d.id === id ? { ...d, author } : d),
    }));
  },

  updatePageCountAndCover: async (id, pageCount, coverDataUrl) => {
    // Store the base64 data URL directly in cover_url — avoids storage bucket
    // permissions issues. The thumbnail is ~15-30KB so well within column limits.
    const coverUrl = coverDataUrl ?? null;
    const safePageCount = pageCount > 0 ? pageCount : null;

    await supabase.from('documents').update({
      page_count: safePageCount,
      cover_url: coverUrl,
    }).eq('id', id);

    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, pageCount: safePageCount, coverUrl } : d
      ),
    }));
  },

  getSignedUrl: async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // 1 hour
    if (error || !data) return null;
    return data.signedUrl;
  },
}));
