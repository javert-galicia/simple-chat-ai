// src/components/WikipediaUtils.ts

// Devuelve true si la pregunta es académica o histórica
export function isAcademicOrHistoricalQuestion(text: string) {
  const keywords = [
    'historia', 'histórico', 'histórica', 'histórico', 'año', 'siglo', 'descubrimiento', 'guerra', 'revolución',
    'quién', 'qué', 'cuándo', 'dónde', 'por qué', 'cómo', 'explica', 'define', 'describe',
    'matemática', 'física', 'química', 'biología', 'geografía', 'filosofía', 'literatura', 'ciencia', 'científico',
    'evento', 'acontecimiento', 'personaje', 'fecha', 'época', 'civilización', 'imperio', 'rey', 'presidente',
    'academia', 'universidad', 'investigador', 'premio nobel', 'teoría', 'ley', 'concepto', 'fundamento',
    'historia de', 'biografía', 'vida de', 'obra de', 'descubrimiento de', 'invención de', 'fundación de',
    // Palabras clave para natalicio
    'natalicio', 'fecha de nacimiento', 'nació', 'nacido', 'nacimiento', 'cumpleaños', 'birthdate', 'born', 'birthday'
  ]
  const lower = text.toLowerCase()
  return keywords.some(k => lower.includes(k))
}

// Obtiene el resumen exacto de Wikipedia
export async function fetchWikipediaSummary(query: string): Promise<string | null> {
  try {
    const apiUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    const res = await fetch(apiUrl)
    if (!res.ok) return null
    const data = await res.json()
    if (data.extract) return data.extract
    return null
  } catch {
    return null
  }
}

// Búsqueda avanzada: toma los 10 títulos y elige el más relevante
export async function fetchWikipediaSmartSummary(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const searchResults = searchData?.query?.search || [];
    if (searchResults.length === 0) return null;
    // Tomar hasta 10 títulos
    const titles = searchResults.slice(0, 10).map((r: any) => r.title);
    // Evaluar relevancia: más coincidencias de palabras significativas
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !['que','los','las','una','por','con','del','los','las','una','sus','para','este','esta','son','the','and','for','was','are','but','not','you','all','any','can','had','her','his','its','our','out','use','who','how','why','when','donde','cual','cuales','como','donde','dónde','qué','cuál','cuáles','por','qué','quién','quiénes'].includes(w));
    let bestTitle = titles[0];
    let bestScore = -1;
    for (const title of titles) {
      const titleWords = title.toLowerCase().split(/\W+/);
      const score = queryWords.reduce((acc, w) => acc + (titleWords.includes(w) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestTitle = title;
      }
    }
    // 2. Obtener el resumen del título más relevante
    if (bestTitle) {
      const summaryUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok) return null;
      const summaryData = await summaryRes.json();
      if (summaryData.extract) return summaryData.extract;
    }
    return null;
  } catch {
    return null;
  }
}
