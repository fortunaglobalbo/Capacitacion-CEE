const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zdxiqteujtbobjyqbzhh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VvPNFM5mTbRF-h0caytHXQ_stnOILkq';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importUnidadesEducativas() {
  const filePath = 'C:\\Users\\CHAVARRIA\\Desktop\\Monitoreo SIE\\Unidades_Educativas_SantaCruz.xlsx';
  console.log('📖 Leyendo archivo Excel:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('❌ Archivo no encontrado en la ruta especificada.');
    return;
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);

  console.log(`📊 Total de filas encontradas en Excel: ${rows.length}`);

  const records = [];

  for (let i = 0; i < rows.length; i++) {
    const rawText = (rows[i]['Unidad Educativa'] || '').toString().trim();
    if (!rawText) continue;

    const match = rawText.match(/^([^:]+):/);
    const code = match ? match[1].trim() : `UE_${i + 1}`;

    records.push({
      codigo_sie: code,
      unidad_educativa: rawText // Mantiene todo unido exactamente como en el Excel
    });
  }

  console.log(`✅ Procesados ${records.length} registros listos para insertar manteniendo todo el texto unido.`);

  // Insertar en lotes de 200
  const BATCH_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('sie_ue')
      .upsert(batch, { onConflict: 'codigo_sie' });

    if (error) {
      console.error(`❌ Error en lote ${i} - ${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`🚀 Insertados: ${inserted} / ${records.length}`);
    }
  }

  console.log(`🎉 ¡Importación completada con éxito! Total en Supabase: ${inserted} Unidades Educativas.`);
}

importUnidadesEducativas().catch(console.error);
