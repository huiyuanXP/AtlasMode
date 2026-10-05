import fs from 'node:fs';
import path from 'node:path';
import tseslint from 'typescript-eslint';

const structure = JSON.parse(
  fs.readFileSync(
    new URL('./.codemap/structure.json', import.meta.url),
    'utf8',
  ),
);
const root = path.dirname(new URL(import.meta.url).pathname);
const boundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary:
        'Import {{source}} violates the public-entry or workspace dependency boundary.',
    },
  },
  create(context) {
    const filename = context.filename;
    const current = structure.workspaceRules.find((rule) =>
      filename.startsWith(path.join(root, rule.path) + path.sep),
    );
    if (!current) return {};
    function check(node, source) {
      if (typeof source !== 'string') return;
      const internal = source.startsWith('@codemap/');
      const packageName = source.split('/').slice(0, 2).join('/');
      const crossesRelativeBoundary =
        source.startsWith('.') &&
        !path
          .resolve(path.dirname(filename), source)
          .startsWith(path.join(root, current.path) + path.sep);
      if (
        (internal &&
          (source !== packageName ||
            !current.allowedWorkspaceDependencies.includes(packageName))) ||
        crossesRelativeBoundary
      ) {
        context.report({ node, messageId: 'boundary', data: { source } });
      }
    }
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) =>
        node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'artifacts/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    plugins: { architecture: { rules: { boundaries } } },
    rules: { 'architecture/boundaries': 'error' },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['node:*', 'react', 'react-dom', 'fastify'] },
      ],
    },
  },
);
