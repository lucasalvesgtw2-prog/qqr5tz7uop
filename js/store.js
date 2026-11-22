// Datenschicht: Firebase (gemeinsam für die Familie) oder Demo (nur dieses Gerät).
// Beide bieten dieselben Funktionen, damit die Oberfläche nichts davon wissen muss.
import { firebaseConfig, FIREBASE_VERSION } from "./config.js";
import { ls } from "./storage.js";
import { newId } from "./ui.js";

let errorHandler = (e) => console.error(e);
export function onStoreError(fn) {
  errorHandler = fn;
}
const fail = (e) => {
  console.error(e);
  errorHandler(e);
};

export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function connect(familyId) {
  return hasFirebaseConfig() ? connectFirebase(familyId) : connectDemo(familyId);
}

// Entfernt undefined-Werte (Firestore mag die nicht).
function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Firebase ─────────────────────────────────────────────────
async function connectFirebase(familyId) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  const [appMod, authMod, fs] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);

  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await authMod.signInAnonymously(auth);

  let db;
  try {
    db = fs.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn("Offline-Speicher nicht verfügbar:", e);
    db = fs.getFirestore(app);
  }

  const col = (path) => fs.collection(db, "families", familyId, ...path);
  const ref = (path, id) => fs.doc(db, "families", familyId, ...path, id);

  return {
    mode: "firebase",
    uid: auth.currentUser.uid,
    watch(path, cb, opts = {}) {
      const parts = [fs.orderBy(opts.orderBy || "createdAt")];
      if (opts.limitLast) parts.push(fs.limitToLast(opts.limitLast));
      return fs.onSnapshot(
        fs.query(col(path), ...parts),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        fail
      );
    },
    add(path, data) {
      const r = fs.doc(col(path));
      fs.setDoc(r, clean(data)).catch(fail);
      return r.id;
    },
    set(path, id, data) {
      return fs.setDoc(ref(path, id), clean(data), { merge: true }).catch(fail);
    },
    update(path, id, patch) {
      return fs.updateDoc(ref(path, id), clean(patch)).catch(fail);
    },
    remove(path, id) {
      return fs.deleteDoc(ref(path, id)).catch(fail);
    },
    arrayAdd(path, id, field, value) {
      return fs.updateDoc(ref(path, id), { [field]: fs.arrayUnion(clean(value)) }).catch(fail);
    },
    arrayRemove(path, id, field, value) {
      return fs.updateDoc(ref(path, id), { [field]: fs.arrayRemove(clean(value)) }).catch(fail);
    },
  };
}

// ── Demo (localStorage) ──────────────────────────────────────
function connectDemo(familyId) {
  let uid = ls.get("fa-demo-uid");
  if (!uid) {
    uid = newId();
    ls.set("fa-demo-uid", uid);
  }
  const key = (path) => `fa-demo:${familyId}:${path.join("/")}`;
  const listeners = new Map();
  const read = (k) => ls.get(k, {}) || {};
  const emit = (k) => listeners.get(k)?.forEach((fn) => fn());
  const write = (k, obj) => {
    ls.set(k, obj);
    emit(k);
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Änderungen aus anderen Tabs übernehmen
  window.addEventListener("storage", (e) => {
    if (e.key && listeners.has(e.key)) emit(e.key);
  });

  function mutate(path, id, fn) {
    const k = key(path);
    const all = read(k);
    if (!all[id]) return Promise.resolve();
    fn(all[id]);
    write(k, all);
    return Promise.resolve();
  }

  return Promise.resolve({
    mode: "demo",
    uid,
    watch(path, cb, opts = {}) {
      const k = key(path);
      const field = opts.orderBy || "createdAt";
      const fn = () => {
        let arr = Object.entries(read(k)).map(([id, d]) => ({ id, ...d }));
        arr.sort((a, b) => (a[field] ?? 0) - (b[field] ?? 0));
        if (opts.limitLast) arr = arr.slice(-opts.limitLast);
        cb(arr);
      };
      if (!listeners.has(k)) listeners.set(k, new Set());
      listeners.get(k).add(fn);
      queueMicrotask(fn);
      return () => listeners.get(k)?.delete(fn);
    },
    add(path, data) {
      const id = newId();
      const k = key(path);
      const all = read(k);
      all[id] = clean(data);
      write(k, all);
      return id;
    },
    set(path, id, data) {
      const k = key(path);
      const all = read(k);
      all[id] = { ...(all[id] || {}), ...clean(data) };
      write(k, all);
      return Promise.resolve();
    },
    update(path, id, patch) {
      return mutate(path, id, (doc) => Object.assign(doc, clean(patch)));
    },
    remove(path, id) {
      const k = key(path);
      const all = read(k);
      delete all[id];
      write(k, all);
      return Promise.resolve();
    },
    arrayAdd(path, id, field, value) {
      return mutate(path, id, (doc) => {
        const arr = Array.isArray(doc[field]) ? doc[field] : [];
        if (!arr.some((x) => same(x, value))) arr.push(clean(value));
        doc[field] = arr;
      });
    },
    arrayRemove(path, id, field, value) {
      return mutate(path, id, (doc) => {
        doc[field] = (doc[field] || []).filter((x) => !same(x, value));
      });
    },
  });
}

export function errorText(e) {
  const code = e?.code || "";
  if (code.includes("permission-denied")) return "Keine Berechtigung – sind die Datenbank-Regeln eingerichtet?";
  if (code.includes("unavailable")) return "Keine Verbindung – Änderungen werden später gespeichert.";
  if (code.includes("operation-not-allowed") || code.includes("admin-restricted"))
    return "Anonyme Anmeldung ist in Firebase noch nicht aktiviert.";
  return "Etwas ist schiefgelaufen. Bitte nochmal versuchen.";
}
