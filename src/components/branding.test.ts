import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Branding, SplashScreen, appVersion } from './Branding';
it('utilise la version du projet pour les deux présentations', () => {
  expect(appVersion).toBe(`v${JSON.parse(readFileSync('package.json', 'utf8')).version}`);
  for (const component of [Branding, SplashScreen]) expect(renderToStaticMarkup(createElement(component))).toContain(appVersion);
});
it('conserve les images originales et le lien accessible vers l’accueil', () => {
  const html = renderToStaticMarkup(createElement(Branding));
  expect(html).not.toContain('images/logo.png'); expect(html).toContain('images/titre.png');
  expect(html).toContain('href="#/"'); expect(html).toContain('alt="runKLMrun"');
  expect(renderToStaticMarkup(createElement(SplashScreen))).toContain('images/splash.png');
});
