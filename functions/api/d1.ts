/**
 * Cloudflare Pages Function: /api/d1
 * Edge API endpoint for Cloudflare D1 SQL operations
 */

interface Env {
  DB?: any; // Cloudflare D1 binding
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'ping';

  // Return CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json;charset=UTF-8'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if D1 binding is present
  if (!env.DB) {
    return new Response(
      JSON.stringify({
        status: 'simulated',
        message: 'Cloudflare D1 binding (env.DB) is not attached yet. Local preview mode is active.',
        isD1Available: false
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const db = env.DB;

    if (action === 'ping') {
      const result = await db.prepare('SELECT 1 as isOnline').first();
      return new Response(
        JSON.stringify({ status: 'success', message: 'Cloudflare D1 is online', isD1Available: true, result }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getAll') {
      const [devsRes, adminsRes, membersRes, yearsRes] = await Promise.all([
        db.prepare('SELECT * FROM developers WHERE username = ? LIMIT 1').bind('airfan').all(),
        db.prepare('SELECT * FROM school_admins ORDER BY created_at DESC').all(),
        db.prepare('SELECT * FROM members ORDER BY created_at DESC').all(),
        db.prepare('SELECT * FROM academic_years ORDER BY year_code DESC').all()
      ]);

      const devRow: any = (devsRes.results || [])[0];
      const developer = devRow ? {
        username: devRow.username || 'airfan',
        password: devRow.password || '456789'
      } : { username: 'airfan', password: '456789' };

      const admins = (adminsRes.results || []).map((row: any) => ({
        id: row.id,
        username: row.username,
        password: row.password,
        fullName: row.full_name,
        schoolName: row.school_name,
        schoolCode: row.school_code,
        affiliation: row.affiliation,
        directorName: row.director_name,
        googleSheetId: row.google_sheet_id,
        googleSheetUrl: row.google_sheet_url,
        driveFolderId: row.drive_folder_id,
        isSuspended: Boolean(row.is_suspended),
        createdAt: row.created_at
      }));

      const members = (membersRes.results || []).map((row: any) => ({
        id: row.id,
        schoolId: row.school_id,
        username: row.username,
        password: row.password,
        prefix: row.prefix,
        fullName: row.full_name,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role || 'member',
        gradeLevel: row.grade_level,
        position: row.position,
        learningGroup: row.learning_group,
        avatarUrl: row.avatar_url,
        isSuspended: Boolean(row.is_suspended)
      }));

      const academicYears = (yearsRes.results || []).map((row: any) => row.year_code);

      return new Response(
        JSON.stringify({
          status: 'success',
          isD1Available: true,
          data: { developer, admins, members, academicYears }
        }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getRealtimeState') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS realtime_kv_store (
          store_key TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run();

      const kvRes = await db.prepare('SELECT store_key, payload, updated_at FROM realtime_kv_store').all();
      const store: Record<string, any> = {};
      const timestamps: Record<string, number> = {};
      let maxTs = 1;

      for (const row of (kvRes.results || []) as any[]) {
        try {
          store[row.store_key] = JSON.parse(row.payload);
          const ts = Number(row.updated_at) || Date.now();
          timestamps[row.store_key] = ts;
          if (ts > maxTs) maxTs = ts;
        } catch {
          // skip malformed
        }
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          isD1Available: true,
          rev: maxTs,
          store,
          timestamps
        }),
        { headers: corsHeaders }
      );
    }

    if (request.method === 'POST') {
      const body: any = await request.json();

      if (action === 'saveRealtimeState') {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS realtime_kv_store (
            store_key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `).run();

        const now = Date.now();
        if (body.updates && typeof body.updates === 'object') {
          const timestamps = body.timestamps || {};
          for (const [k, v] of Object.entries(body.updates)) {
            const ts = Number(timestamps[k]) || now;
            await db.prepare(`
              INSERT INTO realtime_kv_store (store_key, payload, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(store_key) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            `).bind(k, JSON.stringify(v), ts).run();
          }
        } else if (body.key) {
          const ts = Number(body.updatedAt) || now;
          await db.prepare(`
            INSERT INTO realtime_kv_store (store_key, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(store_key) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at
          `).bind(body.key, JSON.stringify(body.value), ts).run();
        }

        return new Response(JSON.stringify({ status: 'success', rev: now }), { headers: corsHeaders });
      }

      if (action === 'updateDevPassword') {
        const { password } = body;
        await db.prepare(`
          INSERT INTO developers (id, username, password, full_name)
          VALUES ('dev-01', 'airfan', ?, 'System Developer (Airfan)')
          ON CONFLICT(id) DO UPDATE SET password = excluded.password
        `).bind(password || '456789').run();
        return new Response(JSON.stringify({ status: 'success', message: 'Updated developer password in D1' }), { headers: corsHeaders });
      }

      if (action === 'saveAdmin') {
        const { id, username, password, fullName, schoolName, schoolCode, affiliation, directorName, googleSheetId, googleSheetUrl, driveFolderId, isSuspended } = body;
        await db.prepare(`
          INSERT INTO school_admins (id, username, password, full_name, school_name, school_code, affiliation, director_name, google_sheet_id, google_sheet_url, drive_folder_id, is_suspended)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username=excluded.username,
            password=excluded.password,
            full_name=excluded.full_name,
            school_name=excluded.school_name,
            school_code=excluded.school_code,
            affiliation=excluded.affiliation,
            director_name=excluded.director_name,
            google_sheet_id=excluded.google_sheet_id,
            google_sheet_url=excluded.google_sheet_url,
            drive_folder_id=excluded.drive_folder_id,
            is_suspended=excluded.is_suspended
        `).bind(
          id, username, password || '123456', fullName, schoolName,
          schoolCode || null, affiliation || null, directorName || null,
          googleSheetId || null, googleSheetUrl || null, driveFolderId || null,
          isSuspended ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ status: 'success', message: 'Saved admin to D1' }), { headers: corsHeaders });
      }

      if (action === 'deleteAdmin') {
        const { id } = body;
        await db.prepare('DELETE FROM members WHERE school_id = ?').bind(id).run();
        await db.prepare('DELETE FROM school_admins WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Deleted admin and members from D1' }), { headers: corsHeaders });
      }

      if (action === 'saveMember') {
        const { id, schoolId, username, password, prefix, fullName, firstName, lastName, role, gradeLevel, position, learningGroup, avatarUrl, isSuspended } = body;
        await db.prepare(`
          INSERT INTO members (id, school_id, username, password, prefix, full_name, first_name, last_name, role, grade_level, position, learning_group, avatar_url, is_suspended)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            school_id=excluded.school_id,
            username=excluded.username,
            password=excluded.password,
            prefix=excluded.prefix,
            full_name=excluded.full_name,
            first_name=excluded.first_name,
            last_name=excluded.last_name,
            role=excluded.role,
            grade_level=excluded.grade_level,
            position=excluded.position,
            learning_group=excluded.learning_group,
            avatar_url=excluded.avatar_url,
            is_suspended=excluded.is_suspended
        `).bind(
          id, schoolId, username, password || '123456', prefix || 'ครู', fullName,
          firstName || null, lastName || null, role || 'member', gradeLevel || null,
          position || 'ครูประจำชั้น', learningGroup || null, avatarUrl || null,
          isSuspended ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ status: 'success', message: 'Saved member to D1' }), { headers: corsHeaders });
      }

      if (action === 'deleteMember') {
        const { id } = body;
        await db.prepare('DELETE FROM members WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Deleted member from D1' }), { headers: corsHeaders });
      }

      if (action === 'saveYear') {
        const { year } = body;
        await db.prepare('INSERT OR IGNORE INTO academic_years (year_code) VALUES (?)').bind(year).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Saved year to D1' }), { headers: corsHeaders });
      }

      if (action === 'deleteYear') {
        const { year } = body;
        await db.prepare('DELETE FROM academic_years WHERE year_code = ?').bind(year).run();
        return new Response(JSON.stringify({ status: 'success', message: 'Deleted year from D1' }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ status: 'error', message: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message || String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
};
