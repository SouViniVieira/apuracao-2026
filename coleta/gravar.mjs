// Cópia local de segurança. O gravador principal roda no GitHub Actions (gravar-nuvem.mjs);
// com SO_LOCAL=1 este aqui só guarda o arquivo bruto, sem mexer em data/historico.json nem publicar.
// Grava o histórico da apuração: consulta o site publicado (que usa o cache da Vercel, então
// não gera consultas extras ao TSE) a cada 30 s e guarda uma linha por parcial nova.
// A cada 6 minutos, se houver parciais novas, gera data/historico.json e publica (commit + push),
// para todo mundo ver a curva desde o começo. Para 20 minutos depois de chegar a 100%.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// GRAVAR_TESTE=<pasta>: ensaio com o 1º turno, grava naquela pasta e não publica.
const TESTE = process.env.GRAVAR_TESTE;
const URL_API = 'https://apuracao-vini.vercel.app/api/apuracao' + (TESTE ? '?e=6257' : '');
const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(AQUI, '..');
const ARQ = TESTE ? join(TESTE, 'teste.ndjson') : join(AQUI, 'apuracao-2t.ndjson');
const SAIDA = TESTE ? join(TESTE, 'historico-teste.json') : join(REPO, 'data', 'historico.json');
const FIM = Date.parse('2026-10-26T06:00:00Z');
const PUBLICAR_A_CADA = 6 * 60e3;
const hora = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const lerLinhas = () => existsSync(ARQ) ? readFileSync(ARQ, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

let ultimaChave = null, chegou100 = null, linhas = 0, publicadas = 0, ultimoEnvio = 0;
{
  const l = lerLinhas(); linhas = l.length;
  if (linhas) { const j = l[linhas - 1]; ultimaChave = j.brasil.apuradas_pct + '|' + j.brasil.hora; }
  if (existsSync(SAIDA)) { try { publicadas = JSON.parse(readFileSync(SAIDA, 'utf8')).pontos.length; } catch {} }
}
console.log(`${hora()} gravando em ${ARQ} (${linhas} parciais já salvas, ${publicadas} publicadas)`);

// Formato compacto: por local, [% de seções apuradas, votos Flávio, votos Lula, eleitorado já apurado].
function montarHistorico() {
  const l = lerLinhas();
  const eleitorado = {};
  const pontos = l.map((j) => {
    const e = {};
    for (const d of [j.brasil, ...j.estados]) {
      if (!d || !d.flavio || !d.lula) continue;
      eleitorado[d.uf] = d.eleitorado;
      e[d.uf] = [d.apuradas_pct, d.flavio.votos, d.lula.votos, d.eleitorado_apurado];
    }
    return { t: j.gravado_em, h: j.brasil.hora, e };
  });
  return { sobre: 'Parciais do 2º turno de 2026 gravadas a cada 30 s a partir da API pública do TSE.', atualizado_em: new Date().toISOString(), eleitorado, pontos };
}

function publicar(motivo) {
  if (process.env.SO_LOCAL) return;
  const l = linhas;
  if (l === publicadas) return;
  try {
    const hist = montarHistorico();
    writeFileSync(SAIDA, JSON.stringify(hist));
    if (TESTE) { publicadas = l; console.log(`ensaio: ${hist.pontos.length} parciais em ${SAIDA}`); return; }
    const ult = hist.pontos[hist.pontos.length - 1], a = ult.e.BR ? ult.e.BR[0] : '?';
    const git = (...args) => execFileSync('git', args, { cwd: REPO, stdio: 'pipe' }).toString();
    git('add', 'data/historico.json');
    git('-c', 'user.name=Vinicius Vieira', 'commit', '-q', '-m', `Histórico: ${hist.pontos.length} parciais, ${a}% apurado (TSE ${ult.h})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, '--', 'data/historico.json');
    git('push', '-q');
    publicadas = l; ultimoEnvio = Date.now();
    console.log(`${hora()} publicado (${motivo}): ${hist.pontos.length} parciais, ${a}% apurado`);
  } catch (e) {
    console.log(`${hora()} não consegui publicar agora: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
  }
}

async function tick() {
  try {
    const r = await fetch(URL_API, { cache: 'no-store' });
    const j = await r.json();
    const b = j.brasil;
    if (!r.ok || !b) throw new Error(j.erro || r.status);
    if (b.apuradas_pct > 0) {
      const chave = b.apuradas_pct + '|' + b.hora;
      if (chave !== ultimaChave) {
        appendFileSync(ARQ, JSON.stringify({ gravado_em: new Date().toISOString(), ...j }) + '\n');
        ultimaChave = chave; linhas++;
        console.log(`${hora()} #${linhas} ${b.apuradas_pct}% apurado (TSE ${b.hora}) Flávio ${b.flavio.pct} x Lula ${b.lula.pct}`);
        // A primeira parcial sai logo; depois, no máximo a cada 6 minutos.
        if (publicadas === 0) publicar('primeiras parciais');
      }
      if (b.apuradas_pct >= 100 && !chegou100) chegou100 = Date.now();
    }
  } catch (e) {
    console.log(`${hora()} falhou: ${e.message}`);
  }
  if (Date.now() - ultimoEnvio >= PUBLICAR_A_CADA) publicar('rotina');
  if ((chegou100 && Date.now() - chegou100 > 20 * 60e3) || Date.now() > FIM) {
    publicar('final');
    console.log(`${hora()} fim da gravação, ${linhas} parciais`);
    process.exit(0);
  }
}
await tick();
if (TESTE) { publicar('ensaio'); process.exit(0); }
setInterval(tick, 30e3);
