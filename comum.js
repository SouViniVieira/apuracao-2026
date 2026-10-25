// Dados e contas usados pelas páginas de apuração e de histórico.
const UF_NOME = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins', ZZ: 'Exterior', BR: 'Brasil' };

// Participação de Flávio considerando só os dois (no 1º turno havia outros candidatos).
const doisLados = (d) => d && d.flavio && d.lula && (d.flavio.votos + d.lula.votos) > 0 ? 100 * d.flavio.votos / (d.flavio.votos + d.lula.votos) : null;
const temVotos = (d) => d && d.flavio && d.lula && d.apuradas_pct > 0 && (d.flavio.votos + d.lula.votos) > 0;

// Tendência do resultado final, estado a estado. Em cada estado, o que falta apurar segue o que
// já foi apurado lá; estados sem votos seguem o 1º turno (só os dois) mais a mudança média dos
// estados que já começaram. Corrige a ordem de chegada entre estados, não a de dentro de cada um.
function tendencia(atual, prim) {
  if (!atual || !prim || !temVotos(atual.brasil)) return null;
  const linhas = [];
  let somaMud = 0, pesoMud = 0, comVotos = 0;
  for (const uf of Object.keys(UF_NOME)) {
    if (uf === 'BR') continue;
    const d = (atual.estados || []).find((e) => e.uf === uf), p = (prim.estados || []).find((e) => e.uf === uf);
    if (!p || doisLados(p) == null) continue;
    const frac = d && d.eleitorado ? d.eleitorado_apurado / d.eleitorado : 0;
    const tem = temVotos(d) && frac > 0;
    if (tem) { const peso = d.flavio.votos + d.lula.votos; somaMud += (doisLados(d) - doisLados(p)) * peso; pesoMud += peso; comVotos++; }
    linhas.push({ d, p, frac, tem });
  }
  const mud = pesoMud ? somaMud / pesoMud : 0;
  let total = 0, flavio = 0;
  for (const x of linhas) {
    const base = x.p.validos || (x.p.flavio.votos + x.p.lula.votos);
    // Com menos de 10% apurado, a conta "votos / fração" oscila demais: usa o tamanho do 1º turno.
    const esperado = x.tem && x.frac >= 0.1 ? (x.d.flavio.votos + x.d.lula.votos) / x.frac : base;
    const share = x.tem ? doisLados(x.d) : Math.min(100, Math.max(0, doisLados(x.p) + mud));
    total += esperado; flavio += esperado * share / 100;
  }
  return total ? { f: 100 * flavio / total, mud, comVotos, estados: linhas.length } : null;
}

// data/historico.json guarda, por local, [% apurado, votos Flávio, votos Lula, eleitorado apurado].
// Converte um ponto desse arquivo para o mesmo formato que a API devolve.
function expandirPonto(ponto, eleitorado) {
  const local = (uf) => {
    const v = ponto.e[uf]; if (!v) return null;
    const [a, fv, lv, est] = v, tot = fv + lv;
    return { uf, apuradas_pct: a, eleitorado: eleitorado[uf], eleitorado_apurado: est,
      flavio: { votos: fv, pct: tot ? 100 * fv / tot : 0 }, lula: { votos: lv, pct: tot ? 100 * lv / tot : 0 } };
  };
  return { brasil: local('BR'), estados: Object.keys(ponto.e).filter((u) => u !== 'BR').map(local) };
}

// Pontos do histórico publicado já com a tendência de cada momento.
async function carregarHistorico(prim) {
  try {
    const r = await fetch('data/historico.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j.pontos.map((p) => {
      const atual = expandirPonto(p, j.eleitorado), b = atual.brasil, t = prim ? tendencia(atual, prim) : null;
      return { quando: p.t, h: p.h, a: b.apuradas_pct, f: b.flavio.pct, l: b.lula.pct, t: t ? t.f : null, atual };
    }).filter((p) => p.a > 0);
  } catch { return null; }
}
