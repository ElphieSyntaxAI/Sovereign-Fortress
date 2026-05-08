const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase URL/key. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (or SUPABASE_URL / SUPABASE_ANON_KEY in .env).'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Points to the .msgf folder in the same directory
const PILLARS_DIR = path.join(__dirname, '.msgf');

async function scanPillars() {
  console.log("🚀 Starting Day-Zero Sweep from Root...");

  const pillars = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  for (const pillar of pillars) {
    const filePath = path.join(PILLARS_DIR, pillar);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Safety check for those 0-byte files we saw earlier
      if (content.length === 0) {
        console.log(`⚠️  Skipping ${pillar}: File is empty.`);
        continue;
      }

      console.log(`Reading ${pillar}... (${content.length} bytes)`);

      const { error } = await supabase
        .from('pillar_vectors')
        .upsert({ 
          content: content, 
          metadata: { 
            pillar: pillar, 
            type: 'architectural_pillar',
            scanned_at: new Date().toISOString() 
          } 
        }, { onConflict: 'id' });

      if (error) console.error(`❌ Error uploading ${pillar}:`, error.message);
      else console.log(`✅ ${pillar} indexed in Brain.`);
    } else {
      console.log(`❓ ${pillar} not found in .msgf folder.`);
    }
  }

  console.log("✨ Day-Zero Sweep Complete.");
}

scanPillars();