# Portales

Landing 3D del portafolio. En esta rama, el santuario de las casas del zodiaco: cada proyecto custodia una casa y su puerta es el portal.

La asignación proyecto → casa vive en `HOUSES`, dentro de `src/houses/main.js`.

## Ejecutar

```bash
pnpm install
pnpm dev        # http://localhost:4000
pnpm build      # genera dist/
pnpm preview    # sirve dist/ en http://localhost:4000
```

## Proyectos y URLs

Los portales salen de `src/projects.js`. Cada URL se puede sobrescribir con una variable `VITE_URL_<ID>` en un `.env`, por ejemplo `VITE_URL_LEO=https://leo.midominio.com`.

`?portal=<id>` cruza ese portal al terminar la entrada. En `pnpm dev`, `?portal=<id>&at=0.6` congela la inmersión en ese instante.
