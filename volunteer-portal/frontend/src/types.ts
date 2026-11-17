export type UserRole = "volunteer" | "admin" | "member";
export type TaskStatus = "available" | "claimed" | "completed";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  inquiryCategories: InquiryCategory[];
}

export interface Session {
  token: string;
  user: User;
}

export interface VolunteerTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  claimedBy: string | null;
}

export type InquiryCategory = "volunteer" | "sponsor" | "speaker";
export type InquiryStatus = "new" | "in_progress" | "contacted" | "closed";

export interface Inquiry {
  id: string;
  category: InquiryCategory;
  name: string;
  email: string;
  organization: string;
  receivedAt: string;
  message: string;
  status: InquiryStatus;
  ownerId: string | null;
  followUpNote: string;
}