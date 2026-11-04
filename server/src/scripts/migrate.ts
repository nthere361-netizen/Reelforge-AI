import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runMigration() {
  console.log('🚀 Connecting to Supabase Cloud PostgreSQL...');
  console.log(`📡 URL: ${supabaseUrl}`);

  const possiblePaths = [
    path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql'),
    path.resolve(process.cwd(), '../supabase/migrations/001_initial_schema.sql'),
  ];
  const migrationFilePath = possiblePaths.find((p) => fs.existsSync(p));

  if (!migrationFilePath) {
    console.error('❌ Migration file 001_initial_schema.sql not found in expected locations');
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFilePath, 'utf-8');
  console.log(`📄 Loaded migration file: ${path.basename(migrationFilePath)} (${(sql.length / 1024).toFixed(1)} KB)`);

  // Attempt 1: Execute via Supabase Management RPC if available
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (!error) {
      console.log('✅ Migration applied successfully via exec_sql RPC!');
      return;
    }
  } catch {
    // Continue to alternative methods
  }

  // Attempt 2: Direct REST execution or prompt with CLI instruction
  console.log('\n========================================================================');
  console.log('📋 SUPABASE DIRECT MIGRATION INSTRUCTIONS');
  console.log('========================================================================');
  console.log('Because direct raw DDL queries over Supabase PostgREST are restricted');
  console.log('for security unless a SQL function is exposed, choose one of these:');
  console.log('\nOption 1: Paste directly into Supabase SQL Editor (Recommended - 1 Click)');
  console.log('  1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql');
  console.log('  2. Click "New Query"');
  console.log(`  3. Copy and paste the contents of:`);
  console.log(`     ${migrationFilePath}`);
  console.log('  4. Click "Run"');
  console.log('\nOption 2: Using Supabase CLI (if installed):');
  console.log('  npx supabase db push');
  console.log('========================================================================\n');
}

runMigration().catch((err) => {
  console.error('❌ Migration script encountered an error:', err);
  process.exit(1);
});

