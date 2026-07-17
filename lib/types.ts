export type Role = "teacher" | "student";
export type AccountStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  teacherId: string | null;
  grade: number | null;
  classNumber: number | null;
  createdAt?: string;
};

export type AdmissionPlan = {
  university: string;
  department: string;
  track: string;
  minimum: string;
  memo: string;
};

export type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
};

export type Consultation = {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  date: string;
  topic: string;
  summary: string;
  plans: AdmissionPlan[];
  attachments: Attachment[];
};

export type Announcement = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  publishedAt: string;
  attachments: Attachment[];
};

export type DashboardData = {
  user: User;
  consultations: Consultation[];
  announcements: Announcement[];
  students: User[];
  pendingStudents: User[];
};
