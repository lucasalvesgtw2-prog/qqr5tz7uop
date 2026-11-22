// ─────────────────────────────────────────────────────────────
//  Einstellungen der Familien-App
// ─────────────────────────────────────────────────────────────

// 1) Firebase-Verbindung (Online-Datenbank für die ganze Familie).
//    Solange hier nichts eingetragen ist, läuft die App im
//    Demo-Modus: Alles wird nur auf dem eigenen Gerät gespeichert.
//    Anleitung: siehe README.md → „Datenbank einrichten“.
//    (Diese Werte sind nicht geheim – sie dürfen öffentlich sein.)
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// 2) Zugangscode.
//    Der Code selbst steht absichtlich NICHT hier, weil dieses
//    Repository öffentlich ist. Gespeichert ist nur ein Prüfwert,
//    aus dem sich der Code nicht zurückrechnen lässt.
//    Aus dem Code wird außerdem der geheime Speicherort der
//    Familien-Daten abgeleitet.
export const ACCESS = {
  salt: "familien-app/v1",
  iterations: 300000,
  verifier: "c0fdc9b7534d2a5350a20d8bcc99d425ec016da1a31e85dd4dca01ba21a36127",
};

export const FIREBASE_VERSION = "12.6.0";
export const APP_VERSION = "1.0";
