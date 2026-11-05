type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

/** Fresh, deterministically ordered query per page; never publish a partial result. */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const pageSize = 500;
  const rows: T[] = [];
  let expected: number | undefined;
  for (let from = 0; ; from += pageSize) {
    const page = await query(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    if (!page.data) return { data: null, error: new Error('Resposta incompleta; tente novamente.') };
    if (page.count != null) {
      if (expected != null && expected !== page.count) {
        return { data: null, error: new Error('Os registros mudaram durante a consulta; tente novamente.') };
      }
      expected = page.count;
    }
    rows.push(...page.data);
    if (page.data.length < pageSize || (expected != null && rows.length >= expected)) {
      if (expected != null && rows.length !== expected) {
        return { data: null, error: new Error('Consulta incompleta; tente novamente.') };
      }
      return { data: rows, error: null };
    }
  }
}