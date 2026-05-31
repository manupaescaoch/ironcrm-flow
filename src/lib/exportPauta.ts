import DOMPurify from 'dompurify';

function safeFilename(name: string) {
  return name.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!looksLikeHtml) return html;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  // Convert block-level elements to newlines, tables to tab-separated rows
  wrapper.querySelectorAll('br').forEach((el) => el.replaceWith('\n'));
  wrapper.querySelectorAll('li').forEach((el) => {
    el.prepend(document.createTextNode('- '));
    el.append(document.createTextNode('\n'));
  });
  wrapper.querySelectorAll('tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim());
    tr.replaceWith(document.createTextNode(cells.join(' | ') + '\n'));
  });
  wrapper.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,blockquote').forEach((el) => {
    el.append(document.createTextNode('\n'));
  });

  const text = wrapper.textContent || '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

interface PautaContext {
  tipo: string;
  data: string; // dd/mm/yyyy
  unidade: string;
  responsavel: string | null;
  participantes: string[];
  pauta: string;
  feedback?: string | null;
}

export function exportPautaToTxt(ctx: PautaContext) {
  const lines = [
    `REUNIÃO — ${ctx.tipo.toUpperCase()}`,
    `Data: ${ctx.data}`,
    `Unidade: ${ctx.unidade}`,
    ctx.responsavel ? `Responsável: ${ctx.responsavel}` : null,
    `Participantes: ${ctx.participantes.join(', ') || '—'}`,
    '',
    '=== PAUTA ===',
    htmlToPlainText(ctx.pauta || '') || '—',
  ];
  if (ctx.feedback) {
    lines.push('', '=== FEEDBACK ===', htmlToPlainText(ctx.feedback));
  }
  const blob = new Blob([lines.filter((l) => l !== null).join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pauta_${safeFilename(ctx.tipo)}_${safeFilename(ctx.data)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportPautaToPdf(ctx: PautaContext) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(ctx.pauta || '');
  const pautaHtml = looksLikeHtml
    ? DOMPurify.sanitize(ctx.pauta || '', { USE_PROFILES: { html: true } })
    : `<p>${(ctx.pauta || '').replace(/\n/g, '<br/>')}</p>`;

  const container = document.createElement('div');
  container.style.cssText = 'padding:32px;font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color:#111; max-width:780px;';
  container.innerHTML = `
    <div style="border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:16px;">
      <h1 style="font-size:20px; margin:0 0 6px 0;">Pauta da reunião — ${ctx.tipo}</h1>
      <div style="font-size:12px; color:#555;">
        <div><strong>Data:</strong> ${ctx.data} &nbsp;•&nbsp; <strong>Unidade:</strong> ${ctx.unidade}</div>
        ${ctx.responsavel ? `<div><strong>Responsável:</strong> ${ctx.responsavel}</div>` : ''}
        <div><strong>Participantes:</strong> ${ctx.participantes.join(', ') || '—'}</div>
      </div>
    </div>
    <div class="pauta-body" style="font-size:13px; line-height:1.55;">
      ${pautaHtml || '<p style="color:#888">—</p>'}
    </div>
    ${ctx.feedback ? `
      <h2 style="font-size:14px; margin-top:24px; border-top:1px solid #ddd; padding-top:10px;">Feedback</h2>
      <div style="font-size:13px; line-height:1.55;">${
        looksLikeHtml
          ? DOMPurify.sanitize(ctx.feedback, { USE_PROFILES: { html: true } })
          : `<p>${ctx.feedback.replace(/\n/g, '<br/>')}</p>`
      }</div>
    ` : ''}
    <style>
      .pauta-body table { width:100%; border-collapse:collapse; margin:8px 0; }
      .pauta-body th, .pauta-body td { border:1px solid #999; padding:6px 8px; vertical-align:top; font-size:12px; }
      .pauta-body th { background:#f1f1f1; text-align:left; }
      .pauta-body h2 { font-size:16px; margin:14px 0 6px; }
      .pauta-body h3 { font-size:14px; margin:12px 0 4px; }
      .pauta-body ul, .pauta-body ol { padding-left:20px; margin:6px 0; }
      .pauta-body blockquote { border-left:3px solid #999; padding-left:10px; color:#555; margin:6px 0; }
      .pauta-body p { margin:4px 0; }
    </style>
  `;
  // Required by html2canvas: element must be in DOM
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#fff';
  document.body.appendChild(container);

  try {
    const mod: any = await import('html2pdf.js');
    const html2pdf = mod.default || mod;
    await (html2pdf as any)()
      .from(container)
      .set({
        margin: [10, 10, 10, 10],
        filename: `pauta_${safeFilename(ctx.tipo)}_${safeFilename(ctx.data)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .save();
  } finally {
    container.remove();
  }
}
