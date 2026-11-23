export type Priority = 'high' | 'normal' | 'low';

/** A task as parsed from speech or text, before it is saved. */
export interface ParsedTask {
  title: string;
  /** YYYY-MM-DD in the user's time zone, or null when no date was said */
  due: string | null;
  /** HH:mm (24-hour), or null when no time was said */
  time: string | null;
  /** iCalendar RRULE body, e.g. "FREQ=MONTHLY;BYDAY=2SA", or null */
  repeat: string | null;
  priority: Priority;
  tags: string[];
  /** 0–1: how sure the parser is that it understood this task */
  confidence: number;
  /** Set when something was unclear and the user should check it */
  question?: string | null;
}

export interface SavedTask extends ParsedTask {
  id: string;
  done: boolean;
  createdAt: string;
  doneAt?: string | null;
  source: 'device' | 'ai' | 'typed';
}

export type ParseSource = 'device' | 'gemini' | 'groq' | 'sample';

export interface ParseResult {
  tasks: ParsedTask[];
  source: ParseSource;
  ms: number;
}

export const TAGS = ['Bills', 'Family', 'Health', 'Work', 'Home', 'Errands'] as const;
