CREATE TABLE calendar_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    date_str    text        NOT NULL,
    title       text        NOT NULL,
    description text,
    created_at  timestamptz DEFAULT now()
);

-- Note: RLS policies (adjust to your auth schema as needed)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" 
ON calendar_events FOR ALL 
USING (auth.role() = 'authenticated');
