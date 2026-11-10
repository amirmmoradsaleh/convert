import { getDb, isPrismaHealthy } from '@/lib/db';
import { getAllTools } from '@/lib/tools';
import { DashboardStats } from '../types';
import { getAuditLogs } from './audit.service';

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();
  const allTools = getAllTools();

  try {
    const [
      totalAdminUsers,
      publishedPages,
      draftPages,
      totalPages,
      customizedTools,
      auditResult,
    ] = await Promise.all([
      db.adminUser.count().catch((err: any) => {
        console.warn('[Stats] adminUser.count fallback:', err?.message || err);
        return 1;
      }),
      db.page.count({ where: { status: 'PUBLISHED' } }).catch((err: any) => {
        console.warn('[Stats] page.count (published) fallback:', err?.message || err);
        return 0;
      }),
      db.page.count({ where: { status: 'DRAFT' } }).catch((err: any) => {
        console.warn('[Stats] page.count (draft) fallback:', err?.message || err);
        return 0;
      }),
      db.page.count().catch((err: any) => {
        console.warn('[Stats] page.count fallback:', err?.message || err);
        return 0;
      }),
      db.toolContent.count().catch((err: any) => {
        console.warn('[Stats] toolContent.count fallback:', err?.message || err);
        return 0;
      }),
      getAuditLogs({ limit: 6 }).catch((err: any) => {
        console.warn('[Stats] getAuditLogs fallback:', err?.message || err);
        return { logs: [], total: 0 };
      }),
    ]);

    const databaseStatus = isPrismaHealthy() ? 'connected' : 'fallback_memory';

    return {
      totalAdminUsers: typeof totalAdminUsers === 'number' ? totalAdminUsers : 1,
      publishedPages: typeof publishedPages === 'number' ? publishedPages : 0,
      draftPages: typeof draftPages === 'number' ? draftPages : 0,
      totalPages: typeof totalPages === 'number' ? totalPages : 0,
      customizedTools: typeof customizedTools === 'number' ? customizedTools : 0,
      totalTools: allTools.length,
      publishedBlogPosts: 0,
      draftBlogPosts: 0,
      recentAuditLogs: auditResult?.logs || [],
      databaseStatus,
    };
  } catch (err: unknown) {
    console.error('[Dashboard Service] Error in getDashboardStats:', err);
    const databaseStatus = isPrismaHealthy() ? 'connected' : 'fallback_memory';
    return {
      totalAdminUsers: 1,
      publishedPages: 0,
      draftPages: 0,
      totalPages: 0,
      customizedTools: 0,
      totalTools: allTools.length,
      publishedBlogPosts: 0,
      draftBlogPosts: 0,
      recentAuditLogs: [],
      databaseStatus,
    };
  }
}
