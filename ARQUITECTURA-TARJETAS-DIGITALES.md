# Arquitectura EliteCard + MascotBook (tarjeta pública)

Documento de referencia para **replicar o extender** el sistema de tarjetas digitales en este proyecto. Entregar este archivo al asistente junto con la petición concreta (p. ej. “replica esta arquitectura en otro repo” o “arregla la carga MascotBook”).

---

## 1. Producto en una sola página

| Modo | URL típica | Layout DOM | Fuente de datos Firestore (silo) |
|------|------------|------------|----------------------------------|
| **EliteCard** (personal) | `card.html?id={uid}` (sin `view=pet`) | `#layout-elite` | `usuarios/{uid}/personal_card/profile` |
| **MascotBook** (mascota) | `card.html?id={uid}&view=pet` (o `mascota` / `mascotbook`) | `#layout-mascot` | `usuarios/{uid}/mascot_card/profile` |

El **`id` de la URL es el UID del usuario** (dueño), igual en ambos modos. No confundir con un ID de documento en la colección `mascotas` para la **lectura principal** de la tarjeta pública: el flujo válido es el **mismo que EliteCard**, pero apuntando al silo `mascot_card`.

---

## 2. Rutas Firestore (silos)

Definidas en **`ec-silos.js`** → `window.EC_SILO`:

- `personalCardRef(db, uid)` → `usuarios/{uid}/personal_card/profile`
- `mascotCardRef(db, uid)` → `usuarios/{uid}/mascot_card/profile`
- `accountRef(db, uid)` → `usuarios/{uid}` (documento raíz; fallback legacy)
- `mascotLostScansRef(db, uid)` → subcolección para escaneos en modo mascota perdida

La colección **`mascotas/{uid}`** puede existir por el dashboard, contadores (`visitas` / `likes`) o scripts en `card.html`; **`card-public.js`** debe mantener coherencia con `__mascotCounterRef` hacia `mascotas/{uid}` si el incremento de visitas sigue ahí.

---

## 3. Flujo de carga en `card-public.js` (crítico)

### Inicialización

- Arranque tras **DOM listo** (`DOMContentLoaded` + ejecución inmediata si el documento ya cargó).
- Guard anti doble arranque (`__ecCardPublicDomReadyDone`).
- `window.__EC_CARD_UID = resolveUid()` desde query: `id`, `ID`, `user`, `uid` (+ hash opcional).

### Firebase

1. `firebase.initializeApp(FIREBASE_WEB_CONFIG)` (desde `firebase-config.js`).
2. `db = firebase.firestore()`.
3. `mascot = __MB_VIEW_IS_PET || view in (pet, mascota, mascotbook)`.
4. **Un solo `Promise.all`:**

```text
siloRef = mascot ? mascotCardRef(db, uid) : personalCardRef(db, uid)
rootRef = accountRef(db, uid)
Promise.all([siloRef.get(), rootRef.get()])
```

### Rama EliteCard (personal)

- Si existe silo → `normalizePersonalCard(data)` + `applyEliteAccountRules` → `renderElite`.
- Si no hay silo pero existe cuenta → `normalizePersonalCard(mapLegacyPersonal(raw))` + reglas → `renderElite`.
- Si no hay cuenta (y no es preview admin) → `showNotFound()` / loader según caso.

### Rama MascotBook (espejo del personal)

Función **`finishMascotBook(siloSnap, accountRaw)`** (misma filosofía que `finishMascotOrElite`):

- `showLoading(false)`, ocultar `#layout-elite`, preparar `#layout-mascot`.
- Logs obligatorios en éxito de silo: `console.log("SNAP:", siloSnap.exists)` y `console.log("DATA:", data)`.
- **Si `siloSnap.exists`:** `normalizeMascotCard(siloSnap.data())` → `renderMascotUnlessPreviewSuperseded` (objeto con `__mascotFirestoreDocExists = true`).
- **Si no hay silo pero hay `usuarios/{uid}`:** `mapLegacyMascot(raw)` → `normalizeMascotCard` → render.
- **Sin datos:** `showNotFound()` (o loader en preview admin).

**No** usar un flujo distinto solo con `mascotas/{id}` como única fuente si el dashboard y `config.js` definen el silo `mascot_card` como contrato.

### Render mascota

- **`renderMascot`** aplica tema Pro + superficie (`mb-theme--*`, `mb-surface--*`), acentos, **`applyDoc`** (texto + imágenes), galería, bloques salud, modo perdido, meta, capa `#card-render.ec-mb-content-layer`.
- **`applyDoc`:** `setText` / `setImage` defensivos; sin fallback “Sin nombre”; imágenes con `fotoPerfilUrl` / `avatar`, `fotoCabeceraUrl` / `portada`; forzar visibilidad cuando hay URL.

### Preview admin (iframe)

- Query `ec_admin_preview=1` + postMessage `EC_MASCOTBOOK_PREVIEW` puede fijar datos sin pisar Firestore si está bloqueado el preview.

---

## 4. `config.js` (contrato de datos)

- **`DEFAULT_PERSONAL_CARD`** y **`DEFAULT_MASCOT_CARD`**: forma esperada de los documentos en silo.
- **`normalizeMascotCard` / `normalizePersonalCard`**: única normalización antes de render (no duplicar mapeos manuales grandes en `card-public.js`).
- Temas: `MASCOT_PRO_THEME_IDS`, `MASCOT_SURFACE_THEME_IDS`, helpers legacy tema ↔ pro.

---

## 5. `card.html` (orden de scripts, sin tocar salvo necesidad)

Orden típico al final del body:

1. `firebase-config.js`
2. `config.js`
3. `ec-silos.js`
4. `elite-mail-sig.js`
5. SDK Firebase compat (app, auth, firestore)
6. Script inline opcional (p. ej. incremento visitas si `view=pet`)
7. **`card-public.js`**

**No** incluir `admin.js` en la vista pública.

---

## 6. Reglas y despliegue

- Reglas en **`firestore.rules`** y **`storage.rules`**: la lectura pública del silo `mascot_card` / `personal_card` debe estar permitida para anónimos según el modelo de negocio.
- Deploy completo: `npx firebase-tools deploy` (o `npm run deploy` si está en `package.json`).
- Hosting sirve desde la raíz del repo (`firebase.json` → `"public": "."`).

---

## 7. Checklist al replicar en otro proyecto

- [ ] Copiar / adaptar `ec-silos.js`, `config.js` (normalizers + defaults), `firebase-config.js`.
- [ ] Unificar **un solo** `Promise.all([silo, account])` con rama `mascot` vs personal.
- [ ] `finishMascotBook` espejo de `finishMascotOrElite` (misma estructura de ramas).
- [ ] Contadores: decidir si `mascotas/{uid}` o campo en silo; alinear `card.html` y `mascotProfileRef`.
- [ ] Probar: `card.html?id=…&view=pet` y `card.html?id=…` sin view.
- [ ] Consola: sin errores; datos y tema coherentes con el dashboard.

---

## 8. Archivos clave (mapa rápido)

| Archivo | Rol |
|---------|-----|
| `card-public.js` | Carga Firestore, render Elite / Mascot, preview |
| `card.html` | Shell DOM, capas loading / not-found / layouts |
| `ec-silos.js` | Referencias a subcolecciones silo |
| `config.js` | Defaults + `normalizeMascotCard` / `normalizePersonalCard` |
| `admin.html` | Dashboard; debe escribir en los mismos silos que lee la pública |
| `firestore.rules` | Lectura/escritura pública o por auth |

---

*Última alineación verificada: flujo MascotBook = mismo patrón que tarjeta personal (`mascot_card` + `usuarios/{uid}`), sin depender solo de `mascotas/{id}` para el render principal.*
