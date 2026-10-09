import { useSyncExternalStore } from 'react';
import { themeStore } from '../themes/theme-store';
import { GROUPS, THEMES, type Theme } from '../themes/themes';
const labels: Record<keyof Theme, string> = { BG: 'Fond', PANEL: 'Panneau', FIELD: 'Champ', FG: 'Texte', FIELD_FG: 'Texte du champ', ACCENT: 'Accent' };
export function Appearance() {
  const { theme, storageUnavailable } = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return <section className="panel settings-panel" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Apparence</h2>
    <label className="theme-picker" htmlFor="theme-select">Thème
      <select id="theme-select" value={theme.name} onChange={event => themeStore.select(event.target.value)}>
        {GROUPS.map(group => <optgroup key={group} label={group}>
          {THEMES.filter(option => option.group === group).map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
        </optgroup>)}
      </select>
    </label>
    <ul className="theme-preview" aria-label={`Couleurs de ${theme.name}`}>
      {(Object.entries(theme.colors) as [keyof Theme, string][]).map(([key, color]) => <li key={key}>
        <span className="theme-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
        <span>{labels[key]}</span><code>{color}</code>
      </li>)}
    </ul>
    <button type="button" className="button" onClick={themeStore.reset}>Revenir au thème par défaut</button>
    <p role="status">{storageUnavailable ? 'Thème appliqué pour cette session. La préférence ne peut pas être enregistrée dans ce navigateur.' : 'Le thème est appliqué immédiatement et mémorisé dans ce navigateur.'}</p>
  </section>;
}
