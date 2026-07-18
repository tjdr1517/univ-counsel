export type Role = "teacher" | "student";
export type AccountStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
  status: AccountStatus;
  teacherId: string | null;
  studentNumber: number | null;
  createdAt?: string;
};

export type InterestUniversity = {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  university: string;
  department: string;
  track: string;
  minimum: string;
  schoolGrade: string;
  cutoff2023: string;
  cutoff2024: string;
  cutoff2025: string;
  priority: number;
  memo: string;
  createdAt: string;
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
  interests: InterestUniversity[];
  announcements: Announcement[];
  students: User[];
  pendingStudents: User[];
};
