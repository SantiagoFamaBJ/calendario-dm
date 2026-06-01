CREATE TABLE IF NOT EXISTS cal_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('curso_dm', 'curso_externo', 'congreso', 'viaje')),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NOT NULL,
  vendedor text NOT NULL,
  dictante text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cal_activities DISABLE ROW LEVEL SECURITY;
