export const appVersion = `v${__APP_VERSION__}`;
const imagePath = (name: string) => `${import.meta.env.BASE_URL}images/${name}.png`;
export function Branding() {
  return <a href="#/" className="brand" aria-label="runKLMrun — Accueil">
    <span className="brand-title-group">
      <img className="brand-title" src={imagePath('titre')} alt="runKLMrun" />
      <span className="brand-version">{appVersion}</span>
    </span>
  </a>;
}
export function SplashScreen() {
  return <div className="splash-screen" role="status" aria-label="Bienvenue dans runKLMrun">
    <div className="splash-window">
    <div className="splash-photo">
      <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="runKLMrun : coureur en mouvement" />
      <span className="splash-version">{appVersion}</span>
    </div>
    </div>
  </div>;
}
