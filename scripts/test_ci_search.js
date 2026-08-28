const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zdxiqteujtbobjyqbzhh.supabase.co';
const supabaseKey = 'sb_publishable_VvPNFM5mTbRF-h0caytHXQ_stnOILkq';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFullQuery() {
  const ci = '8639300';
  console.log(`Testing Full Search for CI: ${ci}...`);

  // Fetch catalog
  const { data: cat } = await supabase.from('ciclos_formativos').select('*');
  const cicMap = new Map();
  if (cat) cat.forEach(c => cicMap.set(c.id, c));

  // Query inscripcion_ciclo
  const { data: list } = await supabase
    .from('inscripcion_ciclo')
    .select('*, cursos(*)')
    .eq('participante_ci', ci);

  console.log(`Total courses found for CI ${ci}:`, list?.length);

  if (list) {
    list.forEach((item, i) => {
      const c = item.cursos || {};
      const cf = cicMap.get(c.ciclo_id) || {};
      console.log(`--- Course ${i + 1} (ID: ${c.id}) ---`);
      console.log('  Costo:', c.costo, 'Bs');
      console.log('  Ciclo Nombre:', cf.nombre || c.ciclo_nombre || c.grupo_nombre);
      console.log('  Área Formativa:', cf.area_formativa || c.area_formativa || c.ciclo_grupo);
      console.log('  Tema 1:', c.tema1 || cf.tema1);
      console.log('  Tema 2:', c.tema2 || cf.tema2);
    });
  }
}

testFullQuery();
