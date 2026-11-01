import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import * as api from "./api";
import { today as todayFn, type Month } from "./lib/dates";
import { periodOf } from "./lib/period";

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
export const useBalances = () => useQuery({ queryKey: ["balances"], queryFn: api.getBalances });
export const usePlanned = () => useQuery({ queryKey: ["planned"], queryFn: api.getPlanned });
export const useInvestments = () => useQuery({ queryKey: ["investments"], queryFn: api.getInvestments });

export const usePeriod = (period: Month | undefined, payday: number | undefined) =>
  useQuery({
    queryKey: ["period", period, payday],
    queryFn: () => api.getPeriod(period!, payday!),
    enabled: !!period && !!payday,
  });

export const useSpent = (start: string | undefined, end: string | undefined) =>
  useQuery({
    queryKey: ["spent", start, end],
    queryFn: () => api.getSpentInRange(start!, end!),
    enabled: !!start && !!end,
  });

/** Oggi, giorno dello stipendio e periodo corrente. */
export function useBase() {
  const settings = useSettings();
  const today = todayFn();
  const payday = settings.data?.payday;
  return { settings, today, payday, current: payday ? periodOf(today, payday) : undefined };
}

/** Stato complessivo di più query: in caricamento, in errore o pronte. */
export function combine(...qs: UseQueryResult<unknown>[]) {
  const error = qs.find((x) => x.error)?.error;
  return {
    loading: qs.some((x) => x.isPending),
    error,
    retry: () => qs.forEach((x) => x.error && x.refetch()),
  };
}
