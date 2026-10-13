import React, { useState } from 'react';
import { buildStory } from './travel.js';

export default function StoryDialog({ entries, onSave, onClose }) {
  const existing = entries.find(e => e.story)?.story;
  const [answers, setAnswers] = useState(existing?.answers || { company: '', mood: '', highlight: '', detail: '' });
  const [draft, setDraft] = useState(existing?.text || ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const questions = [['company', 'Who were you with?', 'My sister, a friend, or just myself'], ['mood', 'How did this day feel to you?', 'Relaxed, excited, tired — in your own words'], ['highlight', 'What moment stayed with you?', 'The little moment you want to remember'], ['detail', 'What did the photos miss?', 'A sound, a conversation, a surprise…']];
  async function save() {
    setBusy(true); setError('');
    try { await onSave({ text: draft.trim(), answers }); onClose(); }
    catch { setError('Could not save your story. Try again.'); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><section className="dialog story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-title"><button className="close" onClick={onClose} disabled={busy} aria-label="Close story">×</button><p className="eyebrow">A SCRAPBOOK WITH YOUR VOICE</p><h2 id="story-title">Tell the story behind the day.</h2><p>{entries[0].date} · {entries.map(e => e.place).join(' → ')}</p><div className="story-photo-strip">{entries.flatMap(e => e.photos).map((p, i) => <figure key={i}><img src={p.url} alt={p.caption || p.name}/>{p.caption && <figcaption>{p.caption}</figcaption>}</figure>)}</div><p className="muted">Look through your pictures as you answer. Photos cannot reliably tell us how you felt, so your mood comes from you. This local draft uses your places and answers; it does not perform AI image analysis.</p>{questions.map(([key, label, placeholder]) => <label key={key}>{label}<input value={answers[key]} maxLength="1500" onChange={e => setAnswers({ ...answers, [key]: e.target.value })} placeholder={placeholder}/></label>)}<button className="secondary" onClick={() => setDraft(buildStory(entries, answers))}>Create scrapbook draft</button>{draft && <><label className="story-draft">Review and edit your story<textarea rows="9" value={draft} maxLength="15000" onChange={e => setDraft(e.target.value)}/></label><p className="muted">Only save words that feel true to your experience.</p></>}{error && <p className="error" role="alert">{error}</p>}<button className="primary save" disabled={!draft.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Save my story ↗'}</button></section></div>;
}
