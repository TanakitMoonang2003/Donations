/** โปรดักชัน: เรียก API บนโดเมนเดียวกัน (ว่าง = relative URL) */
export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : "");
