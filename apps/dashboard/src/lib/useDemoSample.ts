'use client';
// Overlay sample office data for unpaid Free / demo accounts.
// Paid + promo-trial tenants never see this — they get live rows only.
import { useMemo } from 'react';
import { usePlan } from './usePlan';
import { useVertical } from './useVertical';
import { useToast } from '@/components/ui/toast';
import {
  buildDemoSample,
  fillDemoList,
  isDemoSampleId,
  DEMO_READ_ONLY_MESSAGE,
  type DemoSampleData,
  type DemoFillResult,
} from './demo-sample-data';

export function useDemoSample() {
  const { isDemoAccount, loading: planLoading } = usePlan();
  const vertical = useVertical();
  const sample = useMemo(() => buildDemoSample(vertical), [vertical]);

  function fill<T>(
    realItems: T[] | undefined,
    sampleItems: T[],
    opts?: { listLoading?: boolean; realTotal?: number },
  ): DemoFillResult<T> {
    return fillDemoList({
      isDemoAccount,
      planLoading,
      ...(opts?.listLoading !== undefined && { listLoading: opts.listLoading }),
      realItems,
      ...(opts?.realTotal !== undefined && { realTotal: opts.realTotal }),
      sampleItems,
    });
  }

  return {
    isDemoAccount,
    planLoading,
    sample,
    fill,
    isSampleId: isDemoSampleId,
    readOnlyMessage: DEMO_READ_ONLY_MESSAGE,
  };
}

/** Toast + block mutations against `demo-*` rows. */
export function useDemoReadOnlyGuard() {
  const toast = useToast();
  return (id?: string | null): boolean => {
    if (!isDemoSampleId(id)) return false;
    toast.info(DEMO_READ_ONLY_MESSAGE);
    return true;
  };
}

export type { DemoSampleData };
