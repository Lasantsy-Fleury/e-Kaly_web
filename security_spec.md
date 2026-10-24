# Security Specification for e-Kaly

## 1. Data Invariants

1. **User Identity & Role Elevation Guard**: Users can only register their own profile (`request.auth.uid == userId`). Non-admin users cannot elevate their role to `admin` or mark their status as `approved` upon creation or update.
2. **Bootstrapped Admin Trust**: The owner email `tokiniainanarivelosoa@gmail.com` (with `email_verified == true`) and documents in `/admins/{uid}` are authoritative administrators.
3. **Pointers Gating**: Only users with status `approved` and role `pointer` (or `admin`) are permitted to read student records, fetch distributions, or submit meal attendance scans. Suspended, pending, or rejected users have zero operational access.
4. **Attendance Scan Integrity**: An attendance check-in submitted by a pointer must have `pointeurId == request.auth.uid`. Attendance records cannot be freely modified or deleted by non-administrators.
5. **Matricule & Student Data Immutability**: Student records can only be created, imported, updated, or deleted by authorized administrators.
6. **Audit Trail Immutability**: Audit logs cannot be modified or deleted once created (`allow update, delete: if false`).

## 2. The "Dirty Dozen" Threat Payloads

1. **Payload 1 (Self-Elevation Attack)**: Unapproved user attempts to write `{ "role": "admin", "status": "approved" }` on their own `/users/{uid}`.
   -> Expectation: PERMISSION_DENIED.
2. **Payload 2 (Unverified Admin Email Spoofing)**: Attacker connects with `email: "tokiniainanarivelosoa@gmail.com"` but `email_verified: false` and attempts to read `/students`.
   -> Expectation: PERMISSION_DENIED.
3. **Payload 3 (Suspended Pointer Scan Write)**: A user marked with status `suspended` sends a POST/create to `/attendance/att123`.
   -> Expectation: PERMISSION_DENIED.
4. **Payload 4 (Identity Impersonation in Attendance)**: Pointer `uid_A` submits an attendance record with `pointeurId: "uid_B"`.
   -> Expectation: PERMISSION_DENIED.
5. **Payload 5 (Unauthenticated Student Data Leak)**: Anonymous or unauthenticated request to `/students/{studentId}`.
   -> Expectation: PERMISSION_DENIED.
6. **Payload 6 (Shadow Field Injection in User Profile)**: User submits `{ "email": "test@test.com", "role": "pointer", "status": "pending", "superAdminBackdoor": true }`.
   -> Expectation: PERMISSION_DENIED.
7. **Payload 7 (Student Record Tampering by Pointer)**: An approved pointer tries to update student name or matricule at `/students/s1`.
   -> Expectation: PERMISSION_DENIED.
8. **Payload 8 (Distribution Deletion by Non-Admin)**: An approved pointer tries to delete a distribution at `/distributions/d1`.
   -> Expectation: PERMISSION_DENIED.
9. **Payload 9 (Audit Log Erasure)**: An administrator tries to `delete` an audit log record at `/auditLogs/log1`.
   -> Expectation: PERMISSION_DENIED.
10. **Payload 10 (Oversized ID Poisoning)**: An attacker creates a student or attendance document with a 2048-byte corrupted ID.
   -> Expectation: PERMISSION_DENIED.
11. **Payload 11 (Blanket Collection Scraping by Non-Owner)**: A user queries `/users` collection without admin rights.
   -> Expectation: PERMISSION_DENIED.
12. **Payload 12 (Attendance In-Place Tampering)**: A pointer attempts to update the status or timestamp of an existing attendance scan from `valid` to `cancelled`.
   -> Expectation: PERMISSION_DENIED.
