// Routes untuk Attendance & Punishment System
// File: attendance.js

const express = require('express');
const router = express.Router();
const attendanceController = require('../controller/attendanceController');

// Middleware untuk cek authentication
function requireAuth(req, res, next) {
  if (!res.locals.user || !res.locals.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Middleware untuk cek role lecturer atau admin
function requireLecturerOrAdmin(req, res, next) {
  const roleId = res.locals.user?.role_id;
  if (!roleId || (roleId !== 5 && roleId !== 10)) {
    return res.status(403).json({ error: 'Forbidden: Hanya lecturer atau admin yang bisa akses' });
  }
  next();
}

// ============================================
// MEETING ROUTES
// ============================================

// Create meeting (lecturer/admin only)
router.post('/meetings', requireAuth, requireLecturerOrAdmin, attendanceController.createMeeting);

// Delete meeting (lecturer/admin only)
router.delete('/meetings/:meeting_id', requireAuth, requireLecturerOrAdmin, attendanceController.deleteMeeting);

// Get meetings by course
router.get('/meetings/course/:course_id', requireAuth, attendanceController.getMeetingsByCourse);

// ============================================
// MEETING MATERIALS ROUTES
// ============================================

// Get materials linked to a meeting
router.get('/meetings/:meeting_id/materials', requireAuth, attendanceController.getMeetingMaterials);

// Link materials to meeting (admin/lecturer only)
router.post('/meetings/:meeting_id/materials', requireAuth, requireLecturerOrAdmin, attendanceController.linkMaterialsToMeeting);

// Unlink material from meeting (admin/lecturer only)
router.delete('/meetings/:meeting_id/materials/:material_id', requireAuth, requireLecturerOrAdmin, attendanceController.unlinkMaterialFromMeeting);

// ============================================
// ATTENDANCE ROUTES
// ============================================

// Get attendance by meeting
router.get('/attendance/meeting/:meeting_id', requireAuth, attendanceController.getAttendanceByMeeting);

// Mark single attendance (lecturer/admin only)
router.post('/attendance/mark', requireAuth, requireLecturerOrAdmin, attendanceController.markAttendance);

// Bulk mark attendance (lecturer/admin only)
router.post('/attendance/bulk-mark', requireAuth, requireLecturerOrAdmin, attendanceController.bulkMarkAttendance);

// Auto-mark attendance when student joins live class (member only)
router.post('/attendance/auto-join/:course_id', requireAuth, attendanceController.autoMarkAttendanceOnJoin);

// Get students enrolled in course (for attendance list)
router.get('/students/course/:course_id', requireAuth, requireLecturerOrAdmin, attendanceController.getStudentsByCourse);

// ============================================
// PUNISHMENT ROUTES
// ============================================

// Get punishment status for specific member and course
router.get('/punishment/:user_id/:course_id', requireAuth, attendanceController.getPunishmentStatus);

// Get all students punishment status for a course (lecturer/admin only)
router.get('/punishment/course/:course_id', requireAuth, requireLecturerOrAdmin, attendanceController.getStudentsPunishmentStatus);

// Reset punishment (lecturer/admin only)
router.post('/punishment/reset', requireAuth, requireLecturerOrAdmin, attendanceController.resetPunishment);

// Get punishment logs
router.get('/punishment/logs/:course_id', requireAuth, requireLecturerOrAdmin, attendanceController.getPunishmentLogs);

// ============================================
// MATERIAL ACCESS ROUTES
// ============================================

// Check material access
router.get('/material-access/:user_id/:material_id', requireAuth, attendanceController.checkMaterialAccess);

module.exports = router;
