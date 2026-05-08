-- Expose p4_author_signal to Supabase Realtime so clients can subscribe with tenant filters.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'p4_author_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.p4_author_signal;
  END IF;
END $$;
