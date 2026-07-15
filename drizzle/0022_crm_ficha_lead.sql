-- 0022: ficha completa do lead (quick 260715-h9z)
-- foto do lead + atividades agendaveis (inicio/fim/prioridade) + bucket de fotos.
ALTER TABLE "crm_contatos" ADD COLUMN "foto_url" text;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD COLUMN "data_inicio" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD COLUMN "data_fim" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD COLUMN "prioridade" text;--> statement-breakpoint
-- Bucket PUBLICO de proposito: o avatar do lead nao pode depender de signed URL
-- que expira — a URL publica fica gravada em crm_contatos.foto_url.
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-fotos', 'crm-fotos', true) ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
CREATE POLICY "crm_fotos_leitura_publica" ON storage.objects FOR SELECT USING (bucket_id = 'crm-fotos');--> statement-breakpoint
CREATE POLICY "crm_fotos_escrita_autenticada" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'crm-fotos');--> statement-breakpoint
CREATE POLICY "crm_fotos_atualizacao_autenticada" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'crm-fotos');
