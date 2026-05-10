// ============================================================
// Tests for the role hierarchy + hasRole helper.
//
// We don't spin up Fastify here — the decorator behavior is a thin
// wrapper around hasRole. If the hierarchy comparator is right,
// the decorator behaves correctly by construction.
// ============================================================
import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, hasRole } from '../modules/admin/auth.middleware.js';

describe('ROLE_HIERARCHY', () => {
  it('orders owner > admin > staff', () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.staff);
  });
});

describe('hasRole', () => {
  describe('owner', () => {
    it('passes owner-required checks', () => {
      expect(hasRole('owner', 'owner')).toBe(true);
    });
    it('passes admin-required checks (inheritance)', () => {
      expect(hasRole('owner', 'admin')).toBe(true);
    });
    it('passes staff-required checks (inheritance)', () => {
      expect(hasRole('owner', 'staff')).toBe(true);
    });
  });

  describe('admin', () => {
    it('fails owner-required checks', () => {
      expect(hasRole('admin', 'owner')).toBe(false);
    });
    it('passes admin-required checks', () => {
      expect(hasRole('admin', 'admin')).toBe(true);
    });
    it('passes staff-required checks (inheritance)', () => {
      expect(hasRole('admin', 'staff')).toBe(true);
    });
  });

  describe('staff', () => {
    it('fails owner-required checks', () => {
      expect(hasRole('staff', 'owner')).toBe(false);
    });
    it('fails admin-required checks', () => {
      expect(hasRole('staff', 'admin')).toBe(false);
    });
    it('passes staff-required checks', () => {
      expect(hasRole('staff', 'staff')).toBe(true);
    });
  });

  describe('unknown roles', () => {
    it('rejects unknown actor roles', () => {
      expect(hasRole('superuser', 'staff')).toBe(false);
      expect(hasRole('', 'staff')).toBe(false);
    });
  });
});
