import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Diagnostic endpoint to check which routes exist in deployment
 * GET /api/diagnostics/routes
 */
export async function GET() {
  try {
    const routes = [
      '/api/ai/score-leads',
      '/api/ai/auto-create-opportunities',
      '/api/ai/classify-stage',
      '/api/settings/lead-scoring'
    ];

    const checks = routes.map(route => {
      const routePath = route.replace('/api/', 'src/app/api/') + '/route.ts';
      const exists = fs.existsSync(path.join(process.cwd(), routePath));
      
      return {
        route,
        path: routePath,
        exists,
        status: exists ? 'FOUND' : 'MISSING'
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
      nodeVersion: process.version,
      routes: checks,
      summary: {
        total: routes.length,
        found: checks.filter(c => c.exists).length,
        missing: checks.filter(c => !c.exists).length
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Diagnostic failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

