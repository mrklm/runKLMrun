export const appVersion = `v${__APP_VERSION__}`;
const imagePath = (name: string) => `${import.meta.env.BASE_URL}images/${name}.png`;
export function Branding() {
  return <a href="#/" className="brand" aria-label="runKLMrun — Accueil">
    <img className="brand-logo" src={imagePath('logo')} alt="Logo runKLMrun" />
    <img className="brand-title" src={imagePath('titre')} alt="runKLMrun" />
    <span className="brand-version">{appVersion}</span>
  </a>;
}
export function SplashScreen() {
  return <div className="splash-screen" role="status" aria-label="Bienvenue dans runKLMrun">
    <div className="splash-window">
    <img src={imagePath('splash')} alt="runKLMrun : un coureur sur les chemins, entre beffroi, château et chevalement" />
    <span className="splash-version">{appVersion}</span>
    </div>
  </div>;
}
