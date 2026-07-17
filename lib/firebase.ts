import { initializeApp, getApps } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseApp = isFirebaseConfigured
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

export type AppRole = "teacher" | "student";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: AppRole;
  teacherId?: string;
  teacherName?: string;
  teacherCode?: string;
  connectionCode?: string;
  grade?: number;
  classNumber?: number;
}

export interface AdmissionPlan {
  university: string;
  department: string;
  track: string;
  minimum: string;
  memo: string;
}

export interface ConsultationRecord {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  date: string;
  topic: string;
  summary: string;
  plans: AdmissionPlan[];
}

export interface Announcement {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  publishedAt?: { toDate?: () => Date };
}

export async function googleLogin() {
  if (!auth) throw new Error("Firebase 설정이 필요합니다.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logout() {
  if (auth) await signOut(auth);
}

export async function getOrCreateProfile(user: User): Promise<UserProfile> {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  const normalizedEmail = (user.email ?? "").toLowerCase();
  const teacherAccess = normalizedEmail
    ? await getDoc(doc(db, "teacherAllowlist", normalizedEmail))
    : null;
  const allowedRole: AppRole = teacherAccess?.exists() ? "teacher" : "student";
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const newProfile = {
      displayName: user.displayName ?? "이름 미등록",
      email: normalizedEmail,
      photoURL: user.photoURL ?? "",
      role: allowedRole,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    return { uid: user.uid, ...newProfile };
  }
  const existing = snapshot.data() as Omit<UserProfile, "uid">;
  if (allowedRole === "teacher" && existing.role !== "teacher") {
    await updateDoc(ref, { role: "teacher" });
    return { uid: user.uid, ...existing, role: "teacher" };
  }
  return { uid: user.uid, ...existing };
}

export async function ensureTeacherConnectionCode(profile: UserProfile): Promise<UserProfile> {
  if (!db || profile.role !== "teacher" || profile.connectionCode) return profile;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
    const codeRef = doc(db, "teacherCodes", code);
    if ((await getDoc(codeRef)).exists()) continue;
    const batch = writeBatch(db);
    batch.set(codeRef, { teacherId: profile.uid, teacherName: profile.displayName, createdAt: serverTimestamp() });
    batch.update(doc(db, "users", profile.uid), { connectionCode: code });
    await batch.commit();
    return { ...profile, connectionCode: code };
  }
  throw new Error("연결 코드를 만들지 못했습니다. 다시 시도해 주세요.");
}

export async function connectStudentToTeacher(profile: UserProfile, rawCode: string): Promise<UserProfile> {
  if (!db || profile.role !== "student") throw new Error("학생 계정에서만 연결할 수 있습니다.");
  const code = rawCode.trim().toUpperCase();
  const codeSnapshot = await getDoc(doc(db, "teacherCodes", code));
  if (!codeSnapshot.exists()) throw new Error("연결 코드를 확인해 주세요.");
  const teacher = codeSnapshot.data() as { teacherId: string; teacherName: string };
  await updateDoc(doc(db, "users", profile.uid), {
    teacherId: teacher.teacherId,
    teacherName: teacher.teacherName,
    teacherCode: code,
  });
  return { ...profile, teacherId: teacher.teacherId, teacherName: teacher.teacherName, teacherCode: code };
}

export function subscribeConsultations(profile: UserProfile, callback: (rows: ConsultationRecord[]) => void): Unsubscribe {
  if (!db) return () => undefined;
  const scope = profile.role === "teacher"
    ? where("teacherId", "==", profile.uid)
    : where("studentId", "==", profile.uid);
  return onSnapshot(query(collection(db, "consultations"), scope, orderBy("date", "desc")), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ConsultationRecord)));
  });
}

export function subscribeAnnouncements(callback: (rows: Announcement[]) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, "announcements"), orderBy("publishedAt", "desc")), snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Announcement)));
  });
}

export function subscribeStudents(teacherId: string, callback: (rows: UserProfile[]) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, "users"), where("teacherId", "==", teacherId), where("role", "==", "student")), snapshot => {
    callback(snapshot.docs.map(item => ({ uid: item.id, ...item.data() } as UserProfile)));
  });
}

export async function createConsultation(input: Omit<ConsultationRecord, "id">) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  await addDoc(collection(db, "consultations"), { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function createAnnouncement(input: Omit<Announcement, "id" | "publishedAt">) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  await addDoc(collection(db, "announcements"), { ...input, publishedAt: serverTimestamp() });
}
