

## Liberar Acesso de Comercial para Editar Escala

### Mudança

Uma única linha em `src/contexts/AuthContext.tsx`:

**Antes:**
```typescript
const canEditEscala = userRole === 'admin' || userRole === 'coordenador';
```

**Depois:**
```typescript
const canEditEscala = userRole === 'admin' || userRole === 'coordenador' || userRole === 'comercial';
```

Isso libera os botões de importar imagem/texto, adicionar, editar e excluir escalas para usuários com role `comercial`.

