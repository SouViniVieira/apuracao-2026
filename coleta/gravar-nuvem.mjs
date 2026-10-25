// Gravador que roda no GitHub Actions (.github/workflows/gravar.yml), sem depender de nenhum computador.
// Consulta o site publicado a cada 30 s (o cache da Vercel evita consultas extras ao TSE), acrescenta
// cada parcial nova em data/historico.json e publica a cada 6 minutos. Retoma de onde parou se o job
// for reiniciado e para 20 minutos depois de chegar a 100%.
// SECO=1 testa sem commit; URL_API troca a fonte (ex.: ...?e=6257 para ensaiar com o 1º turno).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const URL_API = process.env.URL_API || 'https://apuracao-vini.vercel.app/api/apuracao';
const SAIDA = process.env.SAIDA || 'data/historico.json';
const SECO = !!process.env.SECO;
const LIMITE = Date.now() + Number(process.env.MINUTOS || 340) * 60e3;
const PUBLICAR_A_CADA = 6 * 60e3, APOS_100 = 20 * 60e3;
const hora = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const git = (...a) => execFileSync('git', a, { stdio: 'pipe' }).toString();

const hist = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : {};
hist.eleitorado ||= {}; hist.pontos ||= [];
const chave = (p) => p.e.BR[0] + '|' + p.h;
let ultima = hist.pontos.length ? chave(hist.pontos.at(-1)) : null;
let pendentes = 0, ultimoEnvio = Date.now(), chegou100 = null;

const ult = hist.pontos.at(-1);
if (ult && ult.e.BR[0] >= 100) {
  chegou100 = Date.parse(ult.t);
  if (Date.now() - chegou100 > APOS_100) { console.log('Apuração já encerrada no histórico. Nada a fazer.'); process.exit(0); }
}
console.log(`${hora()} começando com ${hist.pontos.length} parciais já publicadas`);

function publicar(motivo) {
  if (!pendentes) return true;
  hist.atualizado_em = new Date().toISOString();
  writeFileSync(SAIDA, JSON.stringify(hist));
  const u = hist.pontos.at(-1);
  if (SECO) { console.log(`${hora()} [seco] ${hist.pontos.length} parciais (${motivo})`); pendentes = 0; return true; }
  try {
    git('add', SAIDA);
    git('commit', '-q', '-m', `Histórico: ${hist.pontos.length} parciais, ${u.e.BR[0]}% apurado (TSE ${u.h})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`);
    git('pull', '-q', '--rebase');
    git('push', '-q');
    pendentes = 0; ultimoEnvio = Date.now();
    console.log(`${hora()} publicado (${motivo}): ${hist.pontos.length} parciais, ${u.e.BR[0]}% apurado`);
    return true;
  } catch (e) {
    console.log(`${hora()} não consegui publicar: ${String(e.stderr || e.message).trim().slice(0, 300)}`);
    return false;
  }
}

async function tick() {
  try {
    const r = await fetch(URL_API, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !j.brasil) throw new Error(j.erro || r.status);
    if (j.brasil.apuradas_pct > 0) {
      const e = {};
      for (const d of [j.brasil, ...j.estados]) {
        if (!d || !d.flavio || !d.lula) continue;
        hist.eleitorado[d.uf] = d.eleitorado;
        e[d.uf] = [d.apuradas_pct, d.flavio.votos, d.lula.votos, d.eleitorado_apurado];
      }
      const p = { t: new Date().toISOString(), h: j.brasil.hora, e };
      if (chave(p) !== ultima) {
        hist.pontos.push(p); ultima = chave(p); pendentes++;
        console.log(`${hora()} #${hist.pontos.length} ${e.BR[0]}% apurado (TSE ${p.h})`);
        if (hist.pontos.length === 1) publicar('primeiras parciais');
      }
      if (e.BR[0] >= 100 && !chegou100) chegou100 = Date.now();
    }
  } catch (e) {
    console.log(`${hora()} falhou: ${e.message}`);
  }
}

while (true) {
  await tick();
  if (Date.now() - ultimoEnvio >= PUBLICAR_A_CADA) publicar('rotina');
  const acabou = chegou100 && Date.now() - chegou100 > APOS_100;
  if (acabou || Date.now() > LIMITE) {
    // Tenta algumas vezes antes de sair, para não perder as últimas parciais.
    for (let i = 0; i < 5 && !publicar(acabou ? 'final' : 'fim do turno do job'); i++) await new Promise((r) => setTimeout(r, 15e3));
    console.log(`${hora()} encerrando: ${hist.pontos.length} parciais`);
    break;
  }
  await new Promise((r) => setTimeout(r, Number(process.env.INTERVALO || 30e3)));
}
