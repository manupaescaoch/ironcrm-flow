import { test, expect } from 'bun:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');
const guards = [
  ['AdminRoute', 'admin', ['admin']],
  ['AdminOrComercialRoute', 'commercial', ['admin', 'comercial', 'gerente']],
  ['AdminOrCoordenadorRoute', 'management', ['admin', 'coordenador', 'gerente']],
] as const;

for (const [name, label, allowed] of guards) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  if (start < 0 || end <= start) throw new Error(`Missing guard ${name}`);
  const code = ts.transpile(source.slice(start, end), {
    jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
  });
  const Navigate = Symbol('navigate');
  const React = { createElement: (type: unknown, props: unknown) => ({ type, props }), Fragment: Symbol('fragment') };
  for (const role of [null, 'admin', 'recepcao', 'comercial', 'coordenador', 'gerente']) {
    test(`${label}: ${role ?? 'missing role'} cannot bypass the declared role gate`, () => {
      const guard = new Function('React', 'Navigate', 'useAuth', `${code};return ${name}`)(
        React, Navigate, () => ({ user: { id: 'fictional' }, loading: false, userRole: role, isAdmin: role === 'admin' }),
      );
      const result = guard({ children: 'protected' });
      expect(result.type === React.Fragment).toBe((allowed as readonly (string | null)[]).includes(role));
    });
  }
}