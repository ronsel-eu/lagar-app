# Lagar app

Lagar as an on-device app: your wine cellar lives on your phone, with no server or account.
Built with Vite, TypeScript and Svelte. It is a PWA first and will later be wrapped with Capacitor for Android and iOS.

The original Python version lives in the `lagar` repository and is the reference for the drinking-advice logic.

## Run it

```
npm install
npm run dev
```

Open the address it prints. On your phone (same Wi-Fi) use the "Network" address.

## Build

```
npm run build
```

The result is in `dist/`. Pushing to `main` publishes it to GitHub Pages (see `.github/workflows/deploy.yml`).
