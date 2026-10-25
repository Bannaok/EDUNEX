import { Role, UserSession, SchoolAdminAccount } from '../types';
import { StorageService } from '../services/storage';

/**
 * ============================================================================
 * RBAC & MULTI-TENANT ISOLATION MIDDLEWARE
 * ============================================================================
 * 1. Developer (Level 1):
 *    - Manages system-level accounts (Admins & Members) and Academic Years.
 *    - STRICTLY FORBIDDEN from viewing or modifying internal school/Admin content.
 * 2. Admin (Level 2):
 *    - Manages ONLY their own assigned school (`school_id`).
 *    - Strict Multi-Tenant Data Isolation: Cannot access any other school's data.
 * 3. Member (Level 3):
 *    - Operates ONLY within their assigned school (`school_id`).
 *    - Submits tasks and documents assigned by their school's Admin.
 */

export interface AuthContext {
  user: UserSession;
  schoolId: string | null;
}

export interface MiddlewareResult {
  authorized: boolean;
  status: 200 | 401 | 403;
  error?: string;
  context?: AuthContext;
}

/**
 * 1. Verify Active Session & Role Permission
 */
export function authorizeRole(
  session: UserSession | null,
  allowedRoles: Role[]
): MiddlewareResult {
  if (!session || !session.isLoggedIn) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized: กรุณาเข้าสู่ระบบก่อนใช้งาน'
    };
  }

  // SECURITY CONSTRAINT: Developer is strictly blocked from accessing Admin/Member internal workspace
  if (
    session.role === 'developer' &&
    !allowedRoles.includes('developer')
  ) {
    return {
      authorized: false,
      status: 403,
      error:
        'Forbidden: Developer มีสิทธิ์จัดการเฉพาะโครงสร้างบัญชีและปีการศึกษาระดับระบบ ห้ามเข้าถึงหรือดูเนื้อหาภายในของฝั่ง Admin/โรงเรียนโดยเด็ดขาด'
    };
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      authorized: false,
      status: 403,
      error: `Forbidden: สิทธิ์ของคุณ (${session.role}) ไม่ได้รับอนุญาตให้เข้าถึงส่วนนี้`
    };
  }

  return {
    authorized: true,
    status: 200,
    context: {
      user: session,
      schoolId: session.role === 'developer' ? null : (session.schoolId || null)
    }
  };
}

/**
 * 2. Multi-Tenant School Isolation Guard
 * Prevents Admin/Member of School A from accessing or modifying School B's resources.
 * Also strictly blocks Developer from accessing internal school data routes.
 */
export function authorizeTenantAccess(
  session: UserSession | null,
  targetSchoolId: string
): MiddlewareResult {
  if (!session || !session.isLoggedIn) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized: กรุณาเข้าสู่ระบบ'
    };
  }

  // Strictly block Developer from accessing tenant internal data
  if (session.role === 'developer') {
    return {
      authorized: false,
      status: 403,
      error:
        'Security Constraint Violation: ห้าม Developer เข้าถึงหรือดูข้อมูลภายในโรงเรียนของฝั่ง Admin เป็นอันขาด'
    };
  }

  if (!session.schoolId || session.schoolId !== targetSchoolId) {
    return {
      authorized: false,
      status: 403,
      error:
        'Multi-Tenant Isolation Violation: คุณไม่มีสิทธิ์เข้าถึงหรือแก้ไขข้อมูลข้ามโรงเรียน'
    };
  }

  return {
    authorized: true,
    status: 200,
    context: {
      user: session,
      schoolId: session.schoolId
    }
  };
}

/**
 * 3. Developer-Only Action: Cascade Delete Academic Year
 * Permanently deletes the Academic Year and ALL associated tasks, submissions,
 * documents, grades, attendance, savings, and tracking records across the system.
 */
export function executeDeveloperCascadeDeleteYear(
  session: UserSession | null,
  academicYear: string
) {
  const auth = authorizeRole(session, ['developer']);
  if (!auth.authorized) {
    throw new Error(auth.error);
  }

  return StorageService.deleteAcademicYear(academicYear);
}

/**
 * 4. Developer-Only Action: Create School Admin with Mandatory Isolated Google Sheet
 * Every time an Admin is created, a dedicated Google Sheet is automatically provisioned
 * to guarantee 100% physical data isolation per school.
 */
export async function createAdminWithDedicatedSheet(
  session: UserSession | null,
  payload: {
    username: string;
    password: string;
    fullName: string;
    schoolName: string;
    schoolCode?: string;
    affiliation?: string;
    directorName?: string;
  }
): Promise<{ admin: SchoolAdminAccount; sheetCreated: boolean; message: string }> {
  const auth = authorizeRole(session, ['developer']);
  if (!auth.authorized) {
    throw new Error(auth.error);
  }

  const adminId = 'admin-' + Date.now().toString(36);
  const sheetRes = await StorageService.createSchoolGoogleSheet(
    payload.schoolName.trim(),
    payload.schoolCode?.trim(),
    adminId
  );

  const newAdmin: SchoolAdminAccount = {
    id: adminId,
    username: payload.username.trim(),
    password: payload.password.trim() || '123456',
    fullName: payload.fullName.trim() || `ผู้ดูแลระบบ ${payload.schoolName.trim()}`,
    schoolName: payload.schoolName.trim(),
    schoolCode: payload.schoolCode?.trim() || undefined,
    affiliation: payload.affiliation?.trim() || 'สพป.',
    directorName: payload.directorName?.trim() || undefined,
    googleSheetId: sheetRes.spreadsheetId,
    googleSheetUrl: sheetRes.spreadsheetUrl,
    createdAt: new Date().toISOString().split('T')[0]
  };

  StorageService.saveAdmin(newAdmin);

  return {
    admin: newAdmin,
    sheetCreated: sheetRes.success,
    message: sheetRes.message
  };
}
