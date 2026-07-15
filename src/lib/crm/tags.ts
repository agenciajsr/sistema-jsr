// Paleta FECHADA das tags do CRM (modal "Criar novo Lead", imagem 08).
// Módulo comum (NÃO 'use server'): usado pela action (validação da chave) e
// pela UI (classes das badges). No banco vai só a CHAVE ('violet', 'green'...),
// nunca classe/hex — trocar o visual da paleta não exige migration.

export const CORES_TAG = {
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  lime: 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const

export type CorTag = keyof typeof CORES_TAG

export const CORES_TAG_KEYS = Object.keys(CORES_TAG) as CorTag[]

/** Classes da badge para a chave salva no banco; chave desconhecida → slate. */
export function classesCorTag(cor: string): string {
  return CORES_TAG[cor as CorTag] ?? CORES_TAG.slate
}
