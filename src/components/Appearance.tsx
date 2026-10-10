import { useSyncExternalStore } from 'react';
import { themeStore } from '../themes/theme-store';
import { GROUPS, THEMES } from '../themes/themes';
export function Appearance() {
  const { theme } = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return <section className="panel settings-panel appearance-panel" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Apparence</h2>
    <label className="theme-picker" htmlFor="theme-select">Thème
      <select id="theme-select" value={theme.name} onChange={event => themeStore.select(event.target.value)}>
        {GROUPS.map(group => <optgroup key={group} label={group}>
          {THEMES.filter(option => option.group === group).map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
        </optgroup>)}
      </select>
    </label>
  </section>;
}
