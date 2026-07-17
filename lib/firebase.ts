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
  where,
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
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const newProfile = {
      displayName: user.displayName ?? "이름 미등록",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      role: "student" as const,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    return { uid: user.uid, ...newProfile };
  }
  return { uid: user.uid, ...(snapshot.data() as Omit<UserProfile, "uid">) };
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
