import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TestResults {
  timestamp: string;
  environment: {
    hasSupabaseUrl: boolean;
    hasSupabaseKey: boolean;
    supabaseUrl: string;
    nodeEnv?: string;
  };
  tests: Record<string, { success: boolean; message?: string; error?: string; hint?: string }>;
  error?: string;
  message?: string;
}

export async function GET() {
  try {
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const tests: TestResults = {
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: hasUrl,
        hasSupabaseKey: hasKey,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
        nodeEnv: process.env.NODE_ENV
      },
      tests: {}
    };

    if (!hasUrl || !hasKey) {
      tests.error = 'Supabase not configured';
      tests.message = 'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local';
      return NextResponse.json(tests, { status: 200 });
    }

    // Test 1: Create Supabase client
    let supabase;
    try {
      supabase = await createClient();
      tests.tests.clientCreation = { success: true, message: 'Supabase client created' };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      tests.tests.clientCreation = { success: false, error: err };
      return NextResponse.json(tests, { status: 200 });
    }

    // Test 2: Check if users table exists
    try {
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        tests.tests.usersTable = { 
          success: false, 
          error: error.message,
          hint: 'Run supabase-schema.sql in Supabase SQL Editor'
        };
      } else {
        tests.tests.usersTable = { success: true, message: 'users table exists' };
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      tests.tests.usersTable = { success: false, error: err };
    }

    // Test 3: Check Row Level Security
    try {
      const { error } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      tests.tests.rls = { 
        success: !error, 
        message: error ? `RLS may be blocking: ${error.message}` : 'Database accessible',
        hint: error ? 'This is expected - RLS is working. Auth will bypass this.' : undefined
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      tests.tests.rls = { success: false, error: err };
    }

    return NextResponse.json(tests, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error)
    }, { status: 500 });
  }
}

