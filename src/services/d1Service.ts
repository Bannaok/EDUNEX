import { SchoolAdminAccount, MemberAccount } from '../types';

export interface D1StatusResponse {
  isOnline: boolean;
  isD1Available: boolean;
  message: string;
}

export class D1Service {
  private static API_URL = '/api/d1';

  /**
   * Test connection to Cloudflare D1
   */
  static async testConnection(): Promise<D1StatusResponse> {
    try {
      const res = await fetch(`${this.API_URL}?action=ping`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        return {
          isOnline: false,
          isD1Available: false,
          message: `API responded with HTTP status ${res.status}`
        };
      }

      const json = await res.json();
      return {
        isOnline: json.status === 'success',
        isD1Available: Boolean(json.isD1Available),
        message: json.message || 'Connected to D1 API'
      };
    } catch (e: any) {
      return {
        isOnline: false,
        isD1Available: false,
        message: 'D1 endpoint not reachable (running in standard client preview mode)'
      };
    }
  }

  /**
   * Fetch all Developer data (admins, members, years) from Cloudflare D1
   */
  static async fetchAll(): Promise<{
    success: boolean;
    data?: {
      developer?: { username: string; password: string };
      admins: SchoolAdminAccount[];
      members: MemberAccount[];
      academicYears: string[];
    };
    message?: string;
  }> {
    try {
      const res = await fetch(`${this.API_URL}?action=getAll`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return { success: true, data: json.data };
      }
      return { success: false, message: json.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Update Developer (Airfan) password in D1
   */
  static async updateDeveloperPassword(password: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=updateDevPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save School Admin to D1
   */
  static async saveAdmin(admin: SchoolAdminAccount): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=saveAdmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admin)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete School Admin and cascade members from D1
   */
  static async deleteAdmin(adminId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=deleteAdmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: adminId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save Member to D1
   */
  static async saveMember(member: MemberAccount): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=saveMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete Member from D1
   */
  static async deleteMember(memberId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=deleteMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save Academic Year to D1
   */
  static async saveYear(year: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=saveYear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete Academic Year from D1
   */
  static async deleteYear(year: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.API_URL}?action=deleteYear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
