import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

type Role = "volunteer" | "admin" | "member";
type TaskStatus = "available" | "claimed" | "completed";
type InquiryCategory = "volunteer" | "sponsor" | "speaker";
type InquiryStatus = "new" | "in_progress" | "contacted" | "closed";

interface User {
  id: string;
  email: string;
  password: string;
  role: Role;
  inquiryCategories: InquiryCategory[];
}

interface VolunteerTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  claimedBy: string | null;
}

interface Inquiry {
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

interface AuthenticatedRequest extends Request {
  user?: Omit<User, "password">;
}

const users: User[] = [
  { id: "volunteer-alex", email: "alex.volunteer@example.com", password: "Volunteer123!", role: "volunteer", inquiryCategories: ["volunteer", "sponsor"] },
  { id: "volunteer-sam", email: "sam.volunteer@example.com", password: "Volunteer123!", role: "volunteer", inquiryCategories: ["speaker"] },
  { id: "admin-1", email: "admin@example.com", password: "Admin123!", role: "admin", inquiryCategories: [] },
  { id: "member-1", email: "member@example.com", password: "Member123!", role: "member", inquiryCategories: [] },
];

const tasks: VolunteerTask[] = [
  { id: "task-welcome-table", title: "Welcome table host", description: "Greet attendees, help them check in, and point first-time guests toward the refreshments.", status: "available", claimedBy: null },
  { id: "task-speaker-support", title: "Speaker support", description: "Coordinate with the evening's speaker and help them get settled before the session.", status: "available", claimedBy: null },
  { id: "task-photo-recap", title: "Community photo recap", description: "Capture a few candid moments during the meetup for the post-event community recap.", status: "claimed", claimedBy: "volunteer-alex" },
  { id: "task-room-reset", title: "Room reset", description: "Help return the venue to its original layout after the meetup wraps up.", status: "completed", claimedBy: null },
];

const inquiries: Inquiry[] = [
  { id: "inquiry-volunteer-priya", category: "volunteer", name: "Priya Shah", email: "priya.shah@example.com", organization: "", receivedAt: "2026-11-16", message: "I would love to help welcome attendees and support the next community meetup.", status: "new", ownerId: "volunteer-alex", followUpNote: "" },
  { id: "inquiry-volunteer-marcus", category: "volunteer", name: "Marcus Lee", email: "marcus.lee@example.com", organization: "", receivedAt: "2026-11-14", message: "I have event photography experience and can help with the recap.", status: "in_progress", ownerId: "admin-1", followUpNote: "Asked about availability for the December event." },
  { id: "inquiry-volunteer-elena", category: "volunteer", name: "Elena Rossi", email: "elena.rossi@example.com", organization: "", receivedAt: "2026-11-11", message: "I am interested in helping with check-in and event setup.", status: "contacted", ownerId: null, followUpNote: "" },
  { id: "inquiry-sponsor-northstar", category: "sponsor", name: "Jordan Kim", email: "jordan.kim@northstar.io", organization: "Northstar Labs", receivedAt: "2026-11-15", message: "Our team is interested in sponsoring an upcoming meetup and meeting local cloud builders.", status: "in_progress", ownerId: "admin-1", followUpNote: "Sent the sponsorship overview; waiting for preferred dates." },
  { id: "inquiry-sponsor-maple", category: "sponsor", name: "Aisha Patel", email: "aisha.patel@mapleworks.ca", organization: "MapleWorks", receivedAt: "2026-11-12", message: "Could you share the available sponsorship options for the winter series?", status: "new", ownerId: "volunteer-alex", followUpNote: "" },
  { id: "inquiry-sponsor-orbit", category: "sponsor", name: "Noah Chen", email: "noah.chen@orbitdata.com", organization: "Orbit Data", receivedAt: "2026-11-08", message: "We would like to contribute refreshments for a future event.", status: "closed", ownerId: "admin-1", followUpNote: "Refreshment contribution confirmed for December." },
  { id: "inquiry-speaker-fatima", category: "speaker", name: "Fatima Hassan", email: "fatima.hassan@example.com", organization: "CloudPath", receivedAt: "2026-11-16", message: "I can present a practical session on observability for serverless systems.", status: "new", ownerId: "volunteer-sam", followUpNote: "" },
  { id: "inquiry-speaker-daniel", category: "speaker", name: "Daniel Wright", email: "daniel.wright@example.com", organization: "Independent", receivedAt: "2026-11-13", message: "Interested in sharing lessons from a recent cloud migration project.", status: "contacted", ownerId: "admin-1", followUpNote: "Requested a short abstract and speaker bio." },
  { id: "inquiry-speaker-mei", category: "speaker", name: "Mei Tanaka", email: "mei.tanaka@example.com", organization: "Data North", receivedAt: "2026-11-10", message: "I would be happy to lead a hands-on introduction to data lakes on AWS.", status: "in_progress", ownerId: null, followUpNote: "" },
];

const sessions = new Map<string, Omit<User, "password">>();
const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "16kb" }));

function authenticate(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const user = sessions.get(token);
  if (!user) {
    response.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  request.user = user;
  next();
}

function requireRole(role: Role) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (request.user?.role !== role) {
      response.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}

function getTask(id: string, response: Response): VolunteerTask | undefined {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) response.status(404).json({ error: "Task not found." });
  return task;
}

function taskId(request: Request): string {
  return request.params.id as string;
}

function canAccessInquiry(user: Omit<User, "password">, inquiry: Inquiry): boolean {
  return user.role === "admin" || (user.role === "volunteer" && user.inquiryCategories.includes(inquiry.category));
}

app.post("/auth/signin", (request: Request, response: Response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const user = users.find((candidate) => candidate.email === email && candidate.password === password);
  if (!user) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = randomUUID();
  const safeUser = { id: user.id, email: user.email, role: user.role, inquiryCategories: user.inquiryCategories };
  sessions.set(token, safeUser);
  response.json({ token, user: safeUser });
});

app.get("/users", authenticate, (request: AuthenticatedRequest, response: Response) => {
  if (request.user?.role === "member") {
    response.status(403).json({ error: "Members do not have access to inquiry management." });
    return;
  }
  response.json(users.map(({ id, email, role, inquiryCategories }) => ({ id, email, role, inquiryCategories })));
});

app.get("/inquiries", authenticate, (request: AuthenticatedRequest, response: Response) => {
  const user = request.user!;
  if (user.role === "member") {
    response.status(403).json({ error: "Members do not have access to inquiries." });
    return;
  }
  response.json(inquiries.filter((inquiry) => canAccessInquiry(user, inquiry)));
});

app.patch("/inquiries/:id", authenticate, (request: AuthenticatedRequest, response: Response) => {
  const user = request.user!;
  if (user.role === "member") {
    response.status(403).json({ error: "Members do not have access to inquiries." });
    return;
  }
  const inquiry = inquiries.find((candidate) => candidate.id === request.params.id);
  if (!inquiry) {
    response.status(404).json({ error: "Inquiry not found." });
    return;
  }
  if (!canAccessInquiry(user, inquiry)) {
    response.status(403).json({ error: "You do not have access to this inquiry category." });
    return;
  }

  const { status, ownerId, followUpNote } = request.body ?? {};
  if (status !== undefined) {
    if (!["new", "in_progress", "contacted", "closed"].includes(status)) {
      response.status(400).json({ error: "Status must be new, in_progress, contacted, or closed." });
      return;
    }
  }
  if (ownerId !== undefined) {
    if (ownerId !== null && !users.some((candidate) => candidate.id === ownerId && (candidate.role === "admin" || (candidate.role === "volunteer" && candidate.inquiryCategories.includes(inquiry.category))))) {
      response.status(400).json({ error: "Assigned owner must be an administrator or a reviewer assigned to this category." });
      return;
    }
  }
  if (followUpNote !== undefined) {
    if (typeof followUpNote !== "string" || followUpNote.length > 2000) {
      response.status(400).json({ error: "Follow-up note must be text up to 2000 characters." });
      return;
    }
  }

  if (status !== undefined) inquiry.status = status as InquiryStatus;
  if (ownerId !== undefined) inquiry.ownerId = ownerId;
  if (followUpNote !== undefined) inquiry.followUpNote = followUpNote.trim();
  response.json(inquiry);
});

app.get("/tasks", authenticate, (request: AuthenticatedRequest, response: Response) => {
  const user = request.user!;
  const visibleTasks = user.role === "admin"
    ? tasks
    : tasks.filter((task) => task.status === "available" || (task.status === "claimed" && task.claimedBy === user.id));
  response.json(visibleTasks);
});

app.post("/tasks", authenticate, requireRole("admin"), (request: AuthenticatedRequest, response: Response) => {
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
  if (!title || !description || title.length > 120 || description.length > 1000) {
    response.status(400).json({ error: "A title (up to 120 characters) and description (up to 1000 characters) are required." });
    return;
  }
  const task: VolunteerTask = { id: randomUUID(), title, description, status: "available", claimedBy: null };
  tasks.push(task);
  response.status(201).json(task);
});

app.put("/tasks/:id", authenticate, requireRole("admin"), (request: AuthenticatedRequest, response: Response) => {
  const task = getTask(taskId(request), response);
  if (!task) return;
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
  if (!title || !description || title.length > 120 || description.length > 1000) {
    response.status(400).json({ error: "A title (up to 120 characters) and description (up to 1000 characters) are required." });
    return;
  }
  task.title = title;
  task.description = description;
  response.json(task);
});

app.delete("/tasks/:id", authenticate, requireRole("admin"), (request: AuthenticatedRequest, response: Response) => {
  const taskIndex = tasks.findIndex((task) => task.id === taskId(request));
  if (taskIndex === -1) {
    response.status(404).json({ error: "Task not found." });
    return;
  }
  tasks.splice(taskIndex, 1);
  response.json({ success: true });
});

app.patch("/tasks/:id/claim", authenticate, requireRole("volunteer"), (request: AuthenticatedRequest, response: Response) => {
  const task = getTask(taskId(request), response);
  if (!task) return;
  if (task.status !== "available") {
    response.status(409).json({ error: "This task is no longer available." });
    return;
  }
  task.status = "claimed";
  task.claimedBy = request.user!.id;
  response.json(task);
});

app.patch("/tasks/:id/unclaim", authenticate, requireRole("volunteer"), (request: AuthenticatedRequest, response: Response) => {
  const task = getTask(taskId(request), response);
  if (!task) return;
  if (task.status !== "claimed" || task.claimedBy !== request.user!.id) {
    response.status(409).json({ error: "You can only unclaim a task that you claimed." });
    return;
  }
  task.status = "available";
  task.claimedBy = null;
  response.json(task);
});

app.patch("/tasks/:id/status", authenticate, requireRole("admin"), (request: AuthenticatedRequest, response: Response) => {
  const task = getTask(taskId(request), response);
  if (!task) return;
  const status = request.body?.status as TaskStatus;
  if (!["available", "claimed", "completed"].includes(status)) {
    response.status(400).json({ error: "Status must be available, claimed, or completed." });
    return;
  }
  if (status === "claimed" && !task.claimedBy) {
    response.status(400).json({ error: "A task must be claimed by a volunteer before it can have claimed status." });
    return;
  }
  task.status = status;
  if (status === "available" || status === "completed") task.claimedBy = null;
  response.json(task);
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Volunteer Portal API listening on http://localhost:${port}`);
});