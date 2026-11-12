# Application Turf bundle

The browser loads `lib/vendor/turf.min.js` as a classic script exposing `turf`.
Only these eight functions are exported: `point`, `polygon`, `bbox`, `bboxPolygon`,
`area`, `booleanPointInPolygon`, `booleanIntersects`, and `buffer`.

Turf is pinned to 7.4.0; `package-lock.json` pins transitive dependencies and
esbuild. The previous CDN script was Turf 6.5.0. The browser does not require npm
or any build tool, and fetches the generated file in one request.

To regenerate from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/turf
npm run build --prefix tools/turf
node tests/turf-subset.cjs
```

Commit the generated bundle and `lib/vendor/turf.LICENSE.txt` alongside changes
to the entry point/lockfile. Build output reports uncompressed and gzip sizes;
gzip size is a comparison metric, not a guarantee of production transfer size.

`build.cjs` collects licenses from packages included by esbuild. JSTS's EDL text
is retained locally because the npm package omits it. Its source is
https://raw.githubusercontent.com/bjornharrtell/jsts/2.7.1/LICENSE_EDLv1.txt
(the `@turf/jsts` package includes a subset of JSTS).

The focused regression test uses the generated bundle, checks holes, boundaries,
MultiPolygon/FeatureCollection inputs, and exercises the application's viewport,
indoor anchor, and linear extrusion consumers. It also checks that application
Turf calls have matching exports, so new functions cannot be silently omitted.
