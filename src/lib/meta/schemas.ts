import { z } from 'zod'

// Schema para um item de acao (actions array)
export const metaActionSchema = z.object({
  action_type: z.string(),
  value: z.string(),
})

// Schema para uma conta de anuncio retornada pelo endpoint /owned_ad_accounts ou /client_ad_accounts
export const metaAdAccountSchema = z.object({
  id: z.string(), // formato "act_123456789"
  name: z.string(),
  account_status: z.number(),
  currency: z.string().optional().default('BRL'),
})

export const metaAdAccountsResponseSchema = z.object({
  data: z.array(metaAdAccountSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional(),
    }).optional(),
    next: z.string().optional(),
  }).optional(),
})

// Schema para um insight de campanha.
// Com time_increment '1' na requisicao (ver fetchCampaignInsights), cada item
// representa UM dia: date_start === date_stop = a data daquela linha diaria.
export const metaInsightSchema = z.object({
  campaign_id: z.string(),
  campaign_name: z.string(),
  spend: z.string().default('0'),
  impressions: z.string().default('0'),
  clicks: z.string().default('0'),
  reach: z.string().default('0'),
  cpc: z.string().optional(),
  cpm: z.string().optional(),
  ctr: z.string().optional(),
  actions: z.array(metaActionSchema).optional().default([]),
  action_values: z.array(metaActionSchema).optional().default([]),
  date_start: z.string(),
  date_stop: z.string(),
})

export const metaInsightsResponseSchema = z.object({
  data: z.array(metaInsightSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional(),
    }).optional(),
    next: z.string().optional(),
  }).optional(),
})

// Schema para insight nível anúncio (ad-level)
export const metaAdInsightSchema = z.object({
  ad_id: z.string(),
  ad_name: z.string().default(''),
  adset_id: z.string().default(''),
  adset_name: z.string().default(''),
  campaign_id: z.string().default(''),
  campaign_name: z.string().default(''),
  spend: z.string().default('0'),
  impressions: z.string().default('0'),
  clicks: z.string().default('0'),
  reach: z.string().default('0'),
  frequency: z.string().optional(),
  actions: z.array(metaActionSchema).optional().default([]),
  action_values: z.array(metaActionSchema).optional().default([]),
  date_start: z.string(),
  date_stop: z.string(),
})

export const metaAdInsightsResponseSchema = z.object({
  data: z.array(metaAdInsightSchema),
  paging: z.object({
    cursors: z.object({
      before: z.string().optional(),
      after: z.string().optional(),
    }).optional(),
    next: z.string().optional(),
  }).optional(),
})
