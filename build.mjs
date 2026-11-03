// Builds the published copy of the site into dist/.
// The repo keeps the commented, readable source; dist/ gets the same files
// with comments and extra whitespace stripped. GitHub Actions runs this on
// every push to main and publishes dist/ (see .github/workflows/deploy.yml).
//
//   npm run build     build dist/
//   npm run preview   build, then serve dist/ at http://localhost:8001

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';

const OUT = 'dist';

// Only files committed to git get published, same as before the build step.
// These are tooling, not site files.
const SKIP = new Set(['package.json', 'package-lock.json', 'build.mjs', '.gitignore']);
const skip = f => SKIP.has(f) || f.startsWith('.github/') || f.startsWith('_') || f.endsWith('.md');

const htmlOptions = {
  removeComments: true,
  collapseWhitespace: true,
  conservativeCollapse: true, // keep one space where spaces matter between inline elements
  minifyCSS: true,
  minifyJS: true,
};

const files = execSync('git ls-files -z', { encoding: 'utf8' }).split('\0').filter(f => f && !skip(f));

rmSync(OUT, { recursive: true, force: true });

let saved = 0;
for (const file of files) {
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });

  if (file.endsWith('.html')) {
    const src = readFileSync(file, 'utf8');
    const out = await minifyHtml(src, htmlOptions);
    writeFileSync(dest, out);
    saved += src.length - out.length;
  } else if (file.endsWith('.css')) {
    const src = readFileSync(file, 'utf8');
    const out = new CleanCSS({ level: 1 }).minify(src);
    if (out.errors.length) throw new Error(`${file}: ${out.errors.join(', ')}`);
    writeFileSync(dest, out.styles);
    saved += src.length - out.styles.length;
  } else if (file.endsWith('.js') && !file.endsWith('.min.js')) {
    const src = readFileSync(file, 'utf8');
    const out = await minifyJs(src, { compress: true, mangle: true });
    writeFileSync(dest, out.code);
    saved += src.length - out.code.length;
  } else {
    copyFileSync(file, dest);
  }
}

console.log(`Built ${files.length} files into ${OUT}/, ${(saved / 1024).toFixed(0)} KB smaller`);
