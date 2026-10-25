// Proxy para a API pública de resultados do TSE.
// Busca Brasil + 27 UFs + exterior, normaliza e devolve num JSON só.
// A CDN da Vercel guarda a resposta por 20s (vercel.json), então o TSE
// recebe no máximo ~3 rodadas por minuto, não importa quantas pessoas abram a página.

const BASE = 'https://resultados.tse.jus.br/oficial';
const UFS = ['br','ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to','zz'];
let cacheEleicao = null;

const num = (s) => s == null ? null : Number(String(s).replace(/\./g, '').replace(',', '.'));
const pctNum = (s) => s == null ? null : Number(String(s).replace(',', '.'));

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'apuracao-2026 (painel pessoal)' } });
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  return r.json();
}

// Descobre o código da eleição do 2º turno federal de 2026 no config do TSE.
async function descobrirEleicao(ano) {
  if (process.env.TSE_ELEICAO) return process.env.TSE_ELEICAO;
  if (cacheEleicao) return cacheEleicao;
  const cfg = await getJSON(`${BASE}/comum/config/ele-c.json`);
  const todas = [];
  (cfg.pl || []).forEach(p => (p.e || []).forEach(e => todas.push({ ...e, dtPl: p.dt })));
  const candidatas = todas.filter(e =>
    String(e.t) === '2' &&
    String(e.dtPl || e.dt || '').includes(String(ano)) &&
    /federal|presid/i.test(String(e.nm || '')));
  const escolhida = candidatas[0] || todas.find(e => String(e.t) === '2' && String(e.dtPl || '').includes(String(ano)));
  if (!escolhida) throw new Error('Não achei o 2º turno de ' + ano + ' no config do TSE. Defina TSE_ELEICAO nas variáveis da Vercel.');
  cacheEleicao = String(escolhida.cd);
  return cacheEleicao;
}

// Formato de 2026 ("-u.json"): candidatos em carg[0].agr[].par[].cand[];
// seções apuradas em s, eleitorado/abstenção em e, brancos e nulos em v.
function normalizar(uf, j) {
  const cargo = (j.carg || [])[0] || {};
  const cands = [];
  (cargo.agr || []).forEach(a => (a.par || []).forEach(p => (p.cand || []).forEach(c => cands.push({
    numero: String(c.n), nome: c.nmu || c.nm, votos: num(c.vap), pct: pctNum(c.pvap)
  }))));
  const lula = cands.find(c => c.numero === '13' || /LULA/i.test(c.nome || ''));
  const flavio = cands.find(c => c.numero === '22') || cands.find(c => c !== lula);
  const s = j.s || {}, e = j.e || {}, v = j.v || {};
  return {
    uf: uf.toUpperCase(),
    apuradas_pct: pctNum(s.pst),
    hora: j.hg || null,
    data: j.dg || null,
    flavio: flavio ? { votos: flavio.votos, pct: flavio.pct } : null,
    lula: lula ? { votos: lula.votos, pct: lula.pct } : null,
    abstencao_pct: pctNum(e.pa),
    brancos_pct: pctNum(v.pvb),
    nulos_pct: pctNum(v.ptvn)
  };
}

export default async function handler(req, res) {
  const ano = process.env.TSE_ANO || '2026';
  try {
    const cd = req.query.e || await descobrirEleicao(ano);
    const pad = String(cd).padStart(6, '0');
    const resultados = await Promise.allSettled(UFS.map(uf =>
      // Em 2026 o TSE trocou "dados-simplificados/...-r.json" por "dados/...-u.json" (cargo 0001 = Presidente).
      getJSON(`${BASE}/ele${ano}/${cd}/dados/${uf}/${uf}-c0001-e${pad}-u.json`).then(j => normalizar(uf, j))
    ));
    const ok = resultados.filter(r => r.status === 'fulfilled').map(r => r.value);
    const falhas = resultados.map((r, i) => r.status === 'rejected' ? { uf: UFS[i], erro: String(r.reason && r.reason.message || r.reason) } : null).filter(Boolean);
    res.status(200).json({
      eleicao: cd,
      consultado_em: new Date().toISOString(),
      brasil: ok.find(x => x.uf === 'BR') || null,
      estados: ok.filter(x => x.uf !== 'BR'),
      falhas
    });
  } catch (err) {
    res.status(502).json({ erro: String(err.message || err) });
  }
}
