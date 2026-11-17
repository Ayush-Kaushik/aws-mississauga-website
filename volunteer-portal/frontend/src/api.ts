import type { FollowUpActivity, Inquiry, InquiryStatus, Session, User } from "./types";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

interface ApiErrorBody {
  error?: string;
}

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

export const api = {
  signIn: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/signin", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  users: (token: string) => request<User[]>("/users", token),
  inquiryCategories: (token: string) => request<string[]>("/inquiry-categories", token),
  createInquiryCategory: (token: string, category: string) =>
    request<{ category: string }>("/inquiry-categories", token, {
      method: "POST",
      body: JSON.stringify({ category }),
    }),
  setReviewerCategories: (token: string, userId: string, inquiryCategories: string[]) =>
    request<User>(`/users/${userId}/inquiry-categories`, token, {
      method: "PUT",
      body: JSON.stringify({ inquiryCategories }),
    }),
  inquiries: (token: string) => request<Inquiry[]>("/inquiries", token),
  updateInquiry: (token: string, id: string, changes: { status: InquiryStatus; ownerId: string | null }) =>
    request<Inquiry>(`/inquiries/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  addFollowUp: (token: string, id: string, note: string) =>
    request<FollowUpActivity>(`/inquiries/${id}/follow-ups`, token, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};

export type { Session };