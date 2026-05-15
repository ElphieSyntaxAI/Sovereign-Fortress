/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
const fs = require('fs');
const path = require('path');

const monorepoRoot = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(monorepoRoot, '.env') });
require('dotenv').config({ path: path.join(monorepoRoot, '.env.local'), override: true });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });

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