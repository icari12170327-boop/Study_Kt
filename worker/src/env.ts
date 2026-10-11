export interface Env {
  USAGE: KVNamespace;
  FAMILY: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  FAMILY_TOKEN: string;
  ALLOWED_ORIGINS: string;
  REALTIME_MODEL: string;
  TEXT_MODEL: string;
  TRANSCRIBE_MODEL?: string;
  TRANSCRIBE_LIMIT_DAY?: string;
  TRANSCRIBE_MINUTES_DAY?: string;
  TALK_MINUTES_kid1: string;
  TALK_MINUTES_kid2: string;
  TALK_MINUTES_parent: string;
  TALK_MINUTES_MONTH_TOTAL: string;
  GENERATE_LIMIT_DAY_TOTAL: string;
  KRW_PER_TALK_MINUTE: string;
}
