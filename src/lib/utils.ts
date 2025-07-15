import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatToDecimal = (num: string | number | undefined | null, precision: number = 1): string | null => {
  const n = num == null || num === '' ? NaN : Number(num);
  return isNaN(n) ? null : n.toFixed(precision);
};