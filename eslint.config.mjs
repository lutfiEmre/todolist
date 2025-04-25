import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Bazı global ayarlar eklemek isterseniz:
  // {
  //   linterOptions: {
  //     reportUnusedDisableDirectives: "error",
  //   },
  // },
  ...compat.extends(
      'next/core-web-vitals',
      'next/typescript'
  ),
];
