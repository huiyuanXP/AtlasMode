import { fetchNotes } from './notes.js';
export function NotesView() {
  return <span>{fetchNotes()}</span>;
}
