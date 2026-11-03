// The AI voice: a log in small gray machine type that evaluates the candidate in real time (lines approved 25 Oct 2026,
// ai_voice_v1.txt). Sessions: open, 10-14 random lines (match score and rank almost always), archive, next candidate.
window.AIVOICE = (() => {
  const L = [
    ['> session open · candidate #{id}', '> sesión abierta · candidato #{id}'],
    ['parsing resume … ok', 'analizando currículum … ok'],
    ['extracting text layer … {ch} characters', 'extrayendo capa de texto … {ch} caracteres'],
    ['photo detected · ignored', 'foto detectada · ignorada'],
    ['keywords found: {k}/40', 'palabras clave encontradas: {k}/40'],
    ['match score: {pct}%', 'puntaje de compatibilidad: {pct}%'],
    ['recalculating match …', 'recalculando compatibilidad …'],
    ['culture fit: estimated', 'ajuste cultural: estimado'],
    ['confidence: {c}', 'confianza: {c}'],
    ['employment gap detected · {d} days', 'hueco laboral detectado · {d} días'],
    ['tone of cover letter: neutral', 'tono de la carta: neutral'],
    ['years of experience required: 5 · entry level', 'años de experiencia requeridos: 5 · puesto de entrada'],
    ['comparing with {n} applicants …', 'comparando con {n} aspirantes …'],
    ['rank: {r} of {n}', 'posición: {r} de {n}'],
    ['moving candidate down the queue', 'moviendo candidato hacia abajo en la fila'],
    ['human review: skipped', 'revisión humana: omitida'],
    ['recruiter availability: 0', 'disponibilidad del reclutador: 0'],
    ['status: under review', 'estado: en revisión'],
    ['status: still under review', 'estado: sigue en revisión'],
    ['response time: undefined', 'tiempo de respuesta: indefinido'],
    ['reason for decision: not disclosed', 'motivo de la decisión: no revelado'],
    ['sending automatic email … sent', 'enviando correo automático … enviado'],
    ['"we will keep your profile on file"', '"conservaremos tu perfil en nuestra base"'],
    ['similar profiles in database: {n}', 'perfiles similares en la base: {n}'],
    ['personality score inferred from writing', 'puntaje de personalidad inferido por la escritura'],
    ['enthusiasm level: insufficient', 'nivel de entusiasmo: insuficiente'],
    ['overqualified: possible · underqualified: possible', 'sobrecalificado: posible · subcalificado: posible'],
    ['re-reading resume … same result', 'releyendo currículum … mismo resultado'],
    ['ranking model updated · previous results discarded', 'modelo de ranking actualizado · resultados previos descartados'],
    ['vacancy status: open · hiring: paused', 'vacante: abierta · contratación: en pausa'],
    ['posting refreshed · new applicants: {n}', 'vacante republicada · nuevos aspirantes: {n}'],
    ['ghosting timer: {s} s', 'temporizador de silencio: {s} s'],
    ['scanning …', 'escaneando …'],
    ['scan complete · nothing new', 'escaneo completo · nada nuevo'],
    ['candidate profile archived', 'perfil del candidato archivado'],
    ['> next candidate', '> siguiente candidato'],
  ];
  const SCAN = 32;
  function make(seed) {
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const fmt = (x, l) => x.toLocaleString(l === 1 ? 'es-MX' : 'en-US');
    let queue = [], id = 0;
    function session() {
      id = ri(10000, 99999);
      const pool = []; for (let i = 1; i <= 33; i++) pool.push(i);
      for (let i = pool.length - 1; i > 0; i--) { const j = ri(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      let pick = pool.slice(0, ri(10, 14));
      if (!pick.includes(5) && rnd() < .85) pick.push(5);
      if (!pick.includes(13) && rnd() < .85) pick.push(13);
      if (!pick.includes(SCAN)) pick.push(SCAN);
      pick.sort((a, b) => a - b);                       // keeps the order of the list: parsing first, verdicts later
      if (pick.includes(SCAN + 1)) { pick = pick.filter(x => x !== SCAN + 1); pick.splice(pick.indexOf(SCAN) + 1, 0, SCAN + 1); }
      queue = [0, ...pick, 34, 35];
    }
    // one line = its index + the numbers drawn for it, so it can be rewritten in the other language
    function next() {
      if (!queue.length) session();
      const i = queue.shift(), n = ri(180, 9000);
      return { i, v: { id, ch: ri(4800, 6200), k: ri(0, 14), pct: ri(3, 97), c: (ri(10, 99) / 100).toFixed(2), d: ri(30, 900),
                       n, r: ri(Math.floor(n * .2), n), s: ri(60, 99999) } };
    }
    function text(line, lang) {
      const l = lang === 'es' ? 1 : 0;
      return L[line.i][l].replace(/\{(\w+)\}/g, (_, k) => typeof line.v[k] === 'number' && k !== 'id' ? fmt(line.v[k], l) : line.v[k]);
    }
    return { next, text, isScan: line => line.i === SCAN };
  }
  return { make };
})();
