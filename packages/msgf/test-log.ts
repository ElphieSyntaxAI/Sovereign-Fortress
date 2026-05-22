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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load your .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing keys in .env.local!")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testLog() {
  console.log("🚀 Sending First Pulse to MSGF...")
  
  const { data, error } = await supabase
    .from('p4_narrative_logs')
    .insert([
      { 
        tenant_id: '44444444-4444-4444-8444-444444444444',
        action_type: 'INITIAL_PULSE',
        message: 'The Sovereign MSGF is alive.',
        severity: 'Info',
        metadata: { build_date: '2026-05-08' }
      }
    ])
    .select()

  if (error) {
    console.error("❌ Pulse Failed:", error.message)
  } else {
    console.log("✅ Pulse Successful! Data recorded:", data)
  }
}

testLog()
