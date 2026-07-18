import { z } from 'zod'

// Schemas Zod das respostas da API do Google (OAuth + Calendar).
// TODA resposta externa passa por um destes .parse() antes de ser usada.

// Resposta do endpoint de token (/token) — troca de code e refresh.
// No refresh a resposta pode NÃO trazer refresh_token (preservamos o antigo).
export const googleTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
})

// Resposta de /oauth2/v2/userinfo — usada só para descobrir o e-mail (best-effort).
export const googleUserinfoSchema = z.object({
  email: z.string().optional(),
})

// Data/hora de um evento. Eventos "dia inteiro" usam `date` (YYYY-MM-DD);
// eventos com horário usam `dateTime` (RFC3339).
export const googleEventDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
})

// Um evento do Google Calendar (campos que usamos).
export const googleEventSchema = z.object({
  id: z.string().optional(),
  summary: z.string().optional().default('(sem título)'),
  description: z.string().optional(),
  location: z.string().optional(),
  htmlLink: z.string().optional(),
  // Link do Google Meet quando o evento nasce com conferência (createRequest).
  hangoutLink: z.string().optional(),
  start: googleEventDateTimeSchema.optional().default({}),
  end: googleEventDateTimeSchema.optional().default({}),
})

// Lista de eventos (events.list).
export const googleEventsListSchema = z.object({
  items: z.array(googleEventSchema).optional().default([]),
})

export type GoogleTokenResponse = z.infer<typeof googleTokenResponseSchema>
export type GoogleUserinfo = z.infer<typeof googleUserinfoSchema>
export type GoogleEventDateTime = z.infer<typeof googleEventDateTimeSchema>
export type GoogleEvent = z.infer<typeof googleEventSchema>
export type GoogleEventsList = z.infer<typeof googleEventsListSchema>
