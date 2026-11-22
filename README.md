# 🏠 Familien-App

Eine kleine App für die ganze Familie: läuft im Browser auf Handy, Tablet und PC und wird kostenlos über **GitHub Pages** veröffentlicht.

## Was die App kann

| Bereich | Funktionen |
|---|---|
| 💬 **Chat** | Alle aus der Familie schreiben in einen gemeinsamen Chat. @Namen werden hervorgehoben, eigene Nachrichten lassen sich löschen. |
| 🛒 **Einkaufsliste** | Titel (max. 70 Zeichen) + Beschreibung (max. 500 Zeichen). Abhaken → verschwindet von der Liste und landet unter „Gekauft“. Bearbeiten, löschen, kommentieren. |
| 🏡 **Haushalt** | Wer macht was, wie lange, wie oft (z. B. „@Max macht das alle 3 Wochen“, wird automatisch erkannt). Wiederkehrende Aufgaben springen nach dem Erledigen auf den nächsten Termin. Filter pro Person. |
| ⏰ **Tagesablauf** | Plan pro Wochentag, z. B. „Isabella · Bad · 7:05–7:15“. Zeitleiste pro Raum und **Warnung bei Überschneidungen**, damit es mit einem Bad für fünf Personen klappt. |
| ✅ **To-Do** | Gemeinsame To-Do-Liste mit Zuständigen, Fälligkeitsdatum und Kommentaren. |
| 🔒 **Notizen** | Private Notizen, die nur man selbst sieht. |
| ⚙️ **Einstellungen** | Name und Farbe ändern, helles/dunkles Design, Familienmitglieder, Abmelden. |

Zum Öffnen braucht man den **Familien-Code**. Beim ersten Mal gibt jede Person ihren Namen ein; er bleibt gespeichert und lässt sich in den Einstellungen ändern.

> Der Code steht absichtlich nirgends im Quelltext. Gespeichert ist nur ein Prüfwert, aus dem sich der Code nicht zurückrechnen lässt.

---

## 1. App veröffentlichen (GitHub Pages)

1. Im Repository auf **Settings → Pages** gehen.
2. Bei **Source** „Deploy from a branch“ wählen, Branch **main**, Ordner **/ (root)**, dann **Save**.
3. Nach 1–2 Minuten ist die App erreichbar unter:
   **https://lucasalvesgtw2-prog.github.io/qqr5tz7uop/**

Ohne Datenbank läuft die App im **Demo-Modus**: Alles funktioniert, wird aber nur auf dem jeweiligen Gerät gespeichert.

## 2. Datenbank einrichten (damit alle dasselbe sehen)

GitHub Pages kann nur Dateien anzeigen, aber keine gemeinsamen Daten speichern. Dafür nutzt die App **Firebase** von Google. Der kostenlose „Spark“-Tarif reicht für eine Familie locker, eine Kreditkarte ist nicht nötig.

1. **Projekt anlegen:** Auf <https://console.firebase.google.com> mit einem Google-Konto anmelden → **Projekt erstellen** → Name z. B. `familien-app` → Google Analytics kann aus bleiben.
2. **Anmeldung aktivieren:** Links **Build → Authentication** → **Jetzt starten** → Reiter **Sign-in method** → **Anonym** aktivieren → Speichern.
3. **Datenbank anlegen:** Links **Build → Firestore Database** → **Datenbank erstellen** → Standort z. B. `europe-west3 (Frankfurt)` → **Produktionsmodus** starten.
4. **Regeln eintragen:** In Firestore auf den Reiter **Regeln** → alles löschen → den Inhalt der Datei [`firestore.rules`](firestore.rules) einfügen → **Veröffentlichen**.
5. **Web-App registrieren:** Zahnrad → **Projekteinstellungen** → unten bei „Meine Apps“ auf das **`</>`**-Symbol → Spitzname z. B. `Familien-App` → **App registrieren**. Es erscheint ein Block `const firebaseConfig = { … }`.
6. **Werte eintragen:** Diese Werte in [`js/config.js`](js/config.js) bei `firebaseConfig` eintragen und speichern (direkt auf GitHub mit dem Stift-Symbol oder lokal). *Diese Werte sind nicht geheim und dürfen öffentlich im Repository stehen.*
7. **Domain erlauben:** In **Authentication → Settings → Autorisierte Domains** `lucasalvesgtw2-prog.github.io` hinzufügen.

Danach steht in der App unter *Einstellungen → Verbindung* „Online-Datenbank verbunden“.

> Daten aus dem Demo-Modus werden nicht automatisch in die Datenbank übernommen.

## Gut zu wissen

- **Aufs Handy legen:** Seite im Browser öffnen → „Zum Startbildschirm hinzufügen“. Dann sieht sie aus wie eine richtige App.
- **Private Notizen** sind an das Gerät bzw. den Browser gebunden. Wer die Browserdaten löscht oder das Handy wechselt, sieht sie dort nicht mehr.
- **Gleicher Name auf mehreren Geräten:** Beim Anmelden auf einem zweiten Gerät einfach auf den eigenen Namen tippen („Schon dabei?“).
- **Code ändern:** Ein neuer Code bedeutet einen neuen, leeren Datenbereich. Dafür muss der Prüfwert in `js/config.js` neu berechnet werden.

## Technik

Reines HTML, CSS und JavaScript ohne Build-Schritt. Firebase (Auth + Firestore) wird nur geladen, wenn `js/config.js` ausgefüllt ist.

```
index.html           Startseite
css/style.css        Aussehen (hell/dunkel, Handy/PC)
js/app.js            Anmeldung, Navigation
js/config.js         Firebase-Werte + Prüfwert des Codes
js/store.js          Datenbank (Firebase oder Demo)
js/views/*.js        Chat, Listen, Tagesablauf, Notizen, Einstellungen
firestore.rules      Sicherheitsregeln für Firebase
```

Lokal testen: im Ordner `python -m http.server 8123` ausführen und <http://localhost:8123> öffnen.
