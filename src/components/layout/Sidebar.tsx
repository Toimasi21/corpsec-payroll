'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  GitFork,
  MapPin,
  FileText,
  CalendarCheck,
  CalendarDays,
  Banknote,
  Receipt,
  FileSpreadsheet,
  UserCircle,
  Settings,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  UserPlus,
  FileCheck,
  Briefcase,
  Network,
  UserCheck,
  CreditCard,
  MessageSquare,
  Bell,
  LifeBuoy,
  Clock,
  LucideIcon,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { UserSession } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'gold' | 'neutral' | 'success' | 'info';
  children?: {
    label: string;
    href: string;
    badge?: string;
  }[];
}

export function Sidebar({
  session,
  isOpen,
  onClose,
}: {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'HR & Organization': true,
    Payroll: false,
    Attendance: false,
    Leave: false,
    'System & Security': true,
  });

  const toggleSection = (name: string) => {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const navGroups: { groupTitle: string; items: NavItem[] }[] = [
    {
      groupTitle: 'OVERVIEW',
      items: [
        {
          label: 'Dashboard',
          href: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      groupTitle: 'ORGANIZATION & HR',
      items: [
        {
          label: 'HR & Lifecycle',
          href: '/hr',
          icon: Users,
          children: [
            { label: 'HR Command Center', href: '/hr' },
            { label: 'Employee Directory', href: '/hr/employees' },
            { label: 'Add Employee', href: '/hr/employees/new' },
            { label: 'Onboarding Hub', href: '/hr/onboarding', badge: 'Lifecycle' },
            { label: 'Offboarding & Clearance', href: '/hr/offboarding', badge: 'Lifecycle' },
            { label: 'Contracts & Renewals', href: '/hr/contracts' },
            { label: 'Probation Pipeline', href: '/hr/probation' },
            { label: 'Org Structure Tree', href: '/hr/organization' },
            { label: 'Operating Branches', href: '/hr/branches' },
            { label: 'Departments', href: '/hr/departments' },
            { label: 'Guarding Stations', href: '/hr/stations' },
            { label: 'Job Positions', href: '/hr/positions' },
            { label: 'Document Vault', href: '/hr/documents' },
            { label: 'Employee HR Requests', href: '/hr/requests' },
            { label: 'HR Workforce Analytics', href: '/hr/analytics', badge: 'Analytics' },
          ],
        },
        {
          label: 'Attendance & Time',
          href: '/attendance',
          icon: CalendarCheck,
          children: [
            { label: 'Attendance Dashboard', href: '/attendance' },
            { label: 'Daily Attendance Board', href: '/attendance/daily', badge: 'Live' },
            { label: 'Visual Duty Roster', href: '/attendance/roster' },
            { label: 'Shift Definitions', href: '/attendance/shifts' },
            { label: 'Work Schedules', href: '/attendance/schedules' },
            { label: 'Overtime Claims', href: '/attendance/overtime' },
            { label: 'Public Holidays', href: '/attendance/holidays' },
            { label: 'Adjustment Audit', href: '/attendance/corrections' },
            { label: 'CSV / Device Import', href: '/attendance/import' },
            { label: 'Attendance Reports', href: '/attendance/reports' },
            { label: 'Station Commander View', href: '/manager/attendance' },
          ],
        },
        {
          label: 'Leave Management',
          href: '/leave',
          icon: CalendarDays,
          children: [
            { label: 'Leave Overview', href: '/leave' },
            { label: 'Leave Applications', href: '/leave/requests' },
            { label: 'Approvals Desk', href: '/leave/approvals' },
            { label: 'Balances Matrix', href: '/leave/balances' },
            { label: 'Staff Calendar', href: '/leave/calendar' },
            { label: 'Types & Policies', href: '/leave/types' },
          ],
        },
      ],
    },
    {
      groupTitle: 'FINANCE & PAYROLL',
      items: [
        {
          label: 'Payroll',
          href: '/payroll',
          icon: Banknote,
          badge: 'Phase 9 Live',
          badgeVariant: 'gold',
          children: [
            { label: 'Command Center', href: '/payroll' },
            { label: 'Disbursements Desk', href: '/payroll/disbursements', badge: 'Phase 9' },
            { label: 'Payment History', href: '/payroll/payment-history', badge: 'Phase 9' },
            { label: 'Reconciliation Center', href: '/payroll/reconciliation', badge: 'Phase 9' },
            { label: 'Payslips Vault', href: '/payroll/payslips', badge: 'Live' },
            { label: 'Payroll Register', href: '/payroll/register', badge: 'Live' },
            { label: 'Financial Summary', href: '/payroll/summary', badge: 'Live' },
            { label: 'Statutory Returns', href: '/payroll/statutory-reports', badge: 'Live' },
            { label: 'Employer Labor Cost', href: '/payroll/employer-costs', badge: 'Live' },
            { label: 'Payroll Runs & Calc', href: '/payroll/runs' },
            { label: 'Payroll Periods', href: '/payroll/periods' },
            { label: 'Salary Structures', href: '/payroll/salaries' },
            { label: 'Allowances Catalog', href: '/payroll/allowances' },
            { label: 'Deductions & Recoveries', href: '/payroll/deductions' },
            { label: 'Kenya Statutory Rules', href: '/payroll/statutory' },
          ],
        },
        {
          label: 'HR Reports',
          href: '/reports',
          icon: FileSpreadsheet,
          badge: 'Phase 12',
          badgeVariant: 'neutral',
        },
      ],
    },
    {
      groupTitle: 'EMPLOYEE SELF-SERVICE',
      items: [
        {
          label: 'Employee Portal',
          href: '/employee',
          icon: UserCheck,
          badge: 'Phase 10 Live',
          badgeVariant: 'gold',
          children: [
            { label: 'Portal Command Center', href: '/employee' },
            { label: 'My Profile', href: '/employee/profile' },
            { label: 'My Payslips', href: '/employee/payslips' },
            { label: 'My Payments', href: '/employee/payments' },
            { label: 'My Leave', href: '/employee/leave' },
            { label: 'My Attendance', href: '/employee/attendance' },
            { label: 'HR Requests Desk', href: '/employee/requests' },
            { label: 'My Documents', href: '/employee/documents' },
            { label: 'Notifications', href: '/employee/notifications' },
          ],
        },
      ],
    },
    {
      groupTitle: 'SYSTEM & SECURITY',
      items: [
        {
          label: 'System Settings',
          href: '/settings',
          icon: Settings,
          children: [
            { label: 'Company Profile', href: '/settings' },
            { label: 'Attendance & Shift Rules', href: '/settings/attendance' },
          ],
        },
        {
          label: 'User Management',
          href: '/users',
          icon: Shield,
        },
        {
          label: 'Audit Logs',
          href: '/audit-logs',
          icon: ShieldAlert,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 17, 40, 0.7)',
            zIndex: 40,
            display: 'block',
          }}
        />
      )}

      <aside
        style={{
          width: '270px',
          backgroundColor: 'var(--bg-sidebar)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'var(--corp-navy-950)',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--corp-gold-500)',
              color: 'var(--corp-navy-950)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.125rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            CS
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '0.02em', color: '#ffffff' }}>
              CorpSec HR
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', letterSpacing: '0.03em' }}>
              PAYROLL SYSTEM
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  padding: '0 0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                {group.groupTitle}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const hasChildren = item.children && item.children.length > 0;
                  const isParentActive =
                    pathname === item.href ||
                    (item.children && item.children.some((c) => pathname.startsWith(c.href)));
                  const isExpanded = openSections[item.label] ?? isParentActive;

                  if (hasChildren) {
                    return (
                      <div key={itemIdx}>
                        <button
                          type="button"
                          onClick={() => toggleSection(item.label)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '6px',
                            backgroundColor: isParentActive ? 'var(--bg-sidebar-active)' : 'transparent',
                            color: isParentActive ? '#ffffff' : '#cbd5e1',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: isParentActive ? 600 : 500,
                            transition: 'all 0.15s ease',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            if (!isParentActive) e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isParentActive) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {item.badge && (
                              <span
                                style={{
                                  fontSize: '0.625rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(255,255,255,0.1)',
                                  color: '#94a3b8',
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              marginLeft: '1.5rem',
                              paddingLeft: '0.75rem',
                              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                              marginTop: '0.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                            }}
                          >
                            {item.children?.map((child, childIdx) => {
                              const isChildActive = pathname === child.href;
                              return (
                                <Link
                                  key={childIdx}
                                  href={child.href}
                                  onClick={onClose}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '5px',
                                    fontSize: '0.78125rem',
                                    color: isChildActive ? '#ffffff' : '#94a3b8',
                                    backgroundColor: isChildActive
                                      ? 'rgba(212, 163, 75, 0.2)'
                                      : 'transparent',
                                    fontWeight: isChildActive ? 600 : 400,
                                    textDecoration: 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isChildActive) e.currentTarget.style.color = '#ffffff';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isChildActive) e.currentTarget.style.color = '#94a3b8';
                                  }}
                                >
                                  <span>{child.label}</span>
                                  {child.badge && (
                                    <span
                                      style={{
                                        fontSize: '0.625rem',
                                        padding: '0.05rem 0.35rem',
                                        borderRadius: '3px',
                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                        color: '#cbd5e1',
                                      }}
                                    >
                                      {child.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                        color: isActive ? '#ffffff' : '#cbd5e1',
                        fontSize: '0.8125rem',
                        fontWeight: isActive ? 600 : 500,
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: '#94a3b8',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Phase 7 Badge Footer */}
        <div
          style={{
            padding: '0.875rem 1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600 }}>
              Phase 1 - 7: Payroll Engine Live
            </span>
          </div>
          <span style={{ fontSize: '0.625rem', color: '#64748b' }}>v7.0.0</span>
        </div>
      </aside>
    </>
  );
}

