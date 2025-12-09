// Controller untuk Attendance & Punishment System
// File: attendanceController.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Membuat meeting baru
 */
async function createMeeting(req, res) {
  try {
    const { course_id, title, description, meet_link, scheduled_date, duration_minutes } = req.body;
    const created_by = res.locals.user?.id;

    // Validasi
    if (!course_id || !title || !scheduled_date) {
      return res.status(400).json({ error: 'course_id, title, dan scheduled_date wajib diisi' });
    }

    // Insert meeting
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        course_id,
        title,
        description,
        meet_link,
        scheduled_date,
        duration_minutes: duration_minutes || 60,
        created_by
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-create attendance records untuk semua enrolled members
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', course_id)
      .eq('status', 'active');

    if (!enrollError && enrollments && enrollments.length > 0) {
      const attendanceRecords = enrollments.map(e => ({
        meeting_id: data.id,
        user_id: e.user_id,
        course_id: course_id,
        status: 'absent' // default absent, lecturer akan mark present
      }));

      await supabase.from('attendance').insert(attendanceRecords);
    }

    res.json({ success: true, meeting: data });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete meeting
 */
async function deleteMeeting(req, res) {
  try {
    const { meeting_id } = req.params;
    const user_id = res.locals.user?.id;

    // Check if meeting exists and user is authorized
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('created_by, course_id')
      .eq('id', meeting_id)
      .single();

    if (fetchError) throw fetchError;
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting tidak ditemukan' });
    }

    // Check authorization (only creator or admin can delete)
    if (meeting.created_by !== user_id && res.locals.user?.role_id !== 1) {
      return res.status(403).json({ error: 'Tidak memiliki izin untuk menghapus meeting ini' });
    }

    // Delete meeting (cascade will delete related attendance records)
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meeting_id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Meeting berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get semua meetings untuk course tertentu
 */
async function getMeetingsByCourse(req, res) {
  try {
    const { course_id } = req.params;

    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        creator:created_by(full_name, email)
      `)
      .eq('course_id', course_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, meetings: data });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get attendance untuk meeting tertentu
 */
async function getAttendanceByMeeting(req, res) {
  try {
    const { meeting_id } = req.params;

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        user:user_id(full_name, email, avatar_url),
        marker:marked_by(full_name)
      `)
      .eq('meeting_id', meeting_id)
      .order('status', { ascending: true });

    if (error) throw error;

    res.json({ success: true, attendance: data });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Mark attendance (present/absent/permitted)
 * Ini yang trigger punishment logic via database trigger
 */
async function markAttendance(req, res) {
  try {
    const { meeting_id, user_id, status } = req.body;
    const marked_by = res.locals.user?.id;

    // Validasi
    if (!meeting_id || !user_id || !status) {
      return res.status(400).json({ error: 'meeting_id, user_id, dan status wajib diisi' });
    }

    if (!['present', 'absent', 'permitted', 'sick'].includes(status)) {
      return res.status(400).json({ error: 'Status harus: present, absent, permitted, atau sick' });
    }

    // Get course_id dari meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('course_id')
      .eq('id', meeting_id)
      .single();

    if (meetingError) throw meetingError;

    // Update or insert attendance
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        meeting_id,
        user_id,
        course_id: meeting.course_id,
        status,
        marked_by
      }, {
        onConflict: 'meeting_id,user_id'
      })
      .select()
      .single();

    if (error) throw error;

    // === MANUALLY UPDATE PUNISHMENT (jangan rely on trigger yang mungkin error) ===
    // Get current enrollment
    const { data: currentEnrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('id, consecutive_absence, punishment_status')
      .eq('user_id', user_id)
      .eq('course_id', meeting.course_id)
      .single();

    if (!enrollError && currentEnrollment) {
      let newConsecutiveAbsence = currentEnrollment.consecutive_absence || 0;
      let newPunishmentStatus = currentEnrollment.punishment_status || 'none';

      if (status === 'absent') {
        // Increment consecutive absence
        newConsecutiveAbsence += 1;
        
        // Determine new punishment status
        if (newConsecutiveAbsence === 1) {
          newPunishmentStatus = 'warning_1';
        } else if (newConsecutiveAbsence === 2) {
          newPunishmentStatus = 'warning_2';
        } else if (newConsecutiveAbsence >= 3) {
          newPunishmentStatus = 'suspended';
        }
      } else if (status === 'present' || status === 'permitted' || status === 'sick') {
        // Reset consecutive absence
        newConsecutiveAbsence = 0;
        newPunishmentStatus = 'none';
      }

      // Update enrollment with new punishment status
      await supabase
        .from('enrollments')
        .update({
          consecutive_absence: newConsecutiveAbsence,
          punishment_status: newPunishmentStatus,
          punishment_updated_at: new Date().toISOString()
        })
        .eq('id', currentEnrollment.id);

      // Log to punishment_logs for audit trail
      if (newPunishmentStatus !== currentEnrollment.punishment_status) {
        await supabase
          .from('punishment_logs')
          .insert({
            user_id,
            course_id: meeting.course_id,
            enrollment_id: currentEnrollment.id,
            action: newPunishmentStatus,
            consecutive_absence: newConsecutiveAbsence,
            triggered_by: marked_by,
            notes: 'Auto-triggered by attendance system'
          });
      }
    }

    // Jika absent, tambahkan material restriction untuk materi terkait meeting ini
    if (status === 'absent') {
      // Ambil materials yang terkait dengan meeting ini (berdasarkan ordinal/urutan)
      const { data: materials } = await supabase
        .from('materials')
        .select('id')
        .eq('course_id', meeting.course_id);

      if (materials && materials.length > 0) {
        // Buat restriction untuk material yang sesuai dengan meeting ini
        const restrictions = materials.map(m => ({
          user_id,
          course_id: meeting.course_id,
          material_id: m.id,
          meeting_id,
          reason: 'absent_from_meeting'
        }));

        // Insert dengan ignore conflicts
        await supabase
          .from('material_access_restrictions')
          .upsert(restrictions, { onConflict: 'user_id,material_id', ignoreDuplicates: true });
      }
    } else if (status === 'present' || status === 'permitted' || status === 'sick') {
      // Lift restriction untuk meeting ini (hadir/izin/sakit)
      await supabase
        .from('material_access_restrictions')
        .update({ lifted_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .eq('meeting_id', meeting_id)
        .is('lifted_at', null);
    }

    // Get updated punishment status
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('consecutive_absence, punishment_status')
      .eq('user_id', user_id)
      .eq('course_id', meeting.course_id)
      .single();

    console.log(`[DEBUG MARK ATTENDANCE] After marking - enrollment: consecutive_absence=${enrollment?.consecutive_absence}, punishment_status=${enrollment?.punishment_status}`);

    res.json({ 
      success: true, 
      attendance: data,
      punishment: enrollment
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Bulk mark attendance (untuk mark semua sekaligus)
 */
async function bulkMarkAttendance(req, res) {
  try {
    const { meeting_id, attendance_list } = req.body;
    // attendance_list: [{ user_id, status, notes }]
    
    const marked_by = res.locals.user?.id;

    if (!meeting_id || !Array.isArray(attendance_list)) {
      return res.status(400).json({ error: 'meeting_id dan attendance_list wajib diisi' });
    }

    // Get course_id
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('course_id')
      .eq('id', meeting_id)
      .single();

    if (meetingError) throw meetingError;

    // Prepare records
    const records = attendance_list.map(a => ({
      meeting_id,
      user_id: a.user_id,
      course_id: meeting.course_id,
      status: a.status,
      marked_by,
      notes: a.notes || null
    }));

    // Bulk upsert
    const { data, error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'meeting_id,user_id' })
      .select();

    if (error) throw error;

    // Update meeting status to completed
    await supabase
      .from('meetings')
      .update({ status: 'completed' })
      .eq('id', meeting_id);

    res.json({ success: true, updated_count: data.length });
  } catch (error) {
    console.error('Error bulk marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Reset punishment untuk member tertentu
 * Hanya bisa dilakukan oleh lecturer/admin
 */
async function resetPunishment(req, res) {
  try {
    const { user_id, course_id, notes } = req.body;
    const reset_by = res.locals.user?.id;

    if (!user_id || !course_id) {
      return res.status(400).json({ error: 'user_id dan course_id wajib diisi' });
    }

    // Call database function
    const { data, error } = await supabase.rpc('fn_reset_punishment', {
      p_user_id: user_id,
      p_course_id: course_id,
      p_reset_by: reset_by,
      p_notes: notes || 'Manual reset by lecturer/admin'
    });

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Enrollment tidak ditemukan' });
    }

    res.json({ success: true, message: 'Punishment berhasil di-reset' });
  } catch (error) {
    console.error('Error resetting punishment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get punishment status untuk member di course tertentu
 */
async function getPunishmentStatus(req, res) {
  try {
    const { user_id, course_id } = req.params;

    // First, recalculate punishment status dari attendance records
    // untuk memastikan data selalu akurat
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, scheduled_date')
      .eq('course_id', course_id)
      .order('scheduled_date', { ascending: false });

    if (!meetingsError && meetings && meetings.length > 0) {
      // Get attendance records untuk user di semua meetings
      const { data: attendances, error: attendError } = await supabase
        .from('attendance')
        .select('status, meeting_id')
        .eq('user_id', user_id)
        .in('meeting_id', meetings.map(m => m.id));

      if (!attendError && attendances) {
        // Calculate consecutive absence dari attendance records yang terakhir
        let consecutiveAbsence = 0;
        
        // Iterate dari meeting terbaru ke yang lama
        for (const meeting of meetings) {
          const attendance = attendances.find(a => a.meeting_id === meeting.id);
          
          if (attendance && attendance.status === 'absent') {
            consecutiveAbsence++;
          } else if (attendance && (attendance.status === 'present' || attendance.status === 'permitted' || attendance.status === 'sick')) {
            // Stop counting ketika ada yang hadir
            break;
          }
        }

        // Determine punishment status based on calculated consecutive absence
        let calculatedStatus = 'none';
        if (consecutiveAbsence === 1) {
          calculatedStatus = 'warning_1';
        } else if (consecutiveAbsence === 2) {
          calculatedStatus = 'warning_2';
        } else if (consecutiveAbsence >= 3) {
          calculatedStatus = 'suspended';
        }

        // Update enrollment dengan nilai yang benar
        if (consecutiveAbsence > 0 || calculatedStatus !== 'none') {
          await supabase
            .from('enrollments')
            .update({
              consecutive_absence: consecutiveAbsence,
              punishment_status: calculatedStatus,
              punishment_updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id)
            .eq('course_id', course_id);

          console.log(`[DEBUG RECALC PUNISHMENT] User ${user_id} in course ${course_id}: recalculated consecutive_absence=${consecutiveAbsence}, punishment_status=${calculatedStatus}`);
        }
      }
    }

    // Now fetch the updated enrollment data
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        consecutive_absence,
        punishment_status,
        punishment_updated_at,
        status
      `)
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .single();

    if (error) throw error;

    console.log(`[DEBUG PUNISHMENT] User ${user_id} in course ${course_id}: consecutive_absence=${data?.consecutive_absence}, punishment_status=${data?.punishment_status}`);
    const { data: logs } = await supabase
      .from('punishment_logs')
      .select('*')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ 
      success: true, 
      punishment: data,
      logs: logs || []
    });
  } catch (error) {
    console.error('Error fetching punishment status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get semua students dengan punishment status untuk lecturer dashboard
 */
async function getStudentsPunishmentStatus(req, res) {
  try {
    const { course_id } = req.params;

    const { data, error } = await supabase
      .from('vw_student_punishment_status')
      .select('*')
      .eq('course_id', course_id)
      .order('consecutive_absence', { ascending: false });

    if (error) throw error;

    res.json({ success: true, students: data });
  } catch (error) {
    console.error('Error fetching students punishment status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Check apakah member bisa akses material tertentu
 */
async function checkMaterialAccess(req, res) {
  try {
    const { user_id, material_id } = req.params;

    // First, check if user has explicit access via progress table
    // (this means admin/lecturer gave them access manually)
    const { data: progressRecord, error: progressError } = await supabase
      .from('progress')
      .select('id')
      .eq('user_id', user_id)
      .eq('material_id', material_id)
      .maybeSingle();

    if (!progressError && progressRecord) {
      // User has explicit access - can access material
      return res.json({ 
        success: true, 
        can_access: true,
        reason: 'manual_access_granted'
      });
    }

    // If no explicit access, check attendance
    // Get the material's course
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('course_id')
      .eq('id', material_id)
      .single();

    if (materialError || !material) {
      return res.json({ 
        success: true, 
        can_access: false,
        reason: 'material_not_found'
      });
    }

    // Check if user has any attendance with status:
    // - 'present' (hadir) - can access
    // - 'permitted' (izin) - can access
    // - 'sick' (sakit) - can access
    // - 'absent' (tidak hadir) - cannot access
    
    const { data: attendances, error: attendError } = await supabase
      .from('attendance')
      .select('status, meeting:meeting_id(id)')
      .eq('user_id', user_id)
      .eq('course_id', material.course_id)
      .in('status', ['present', 'permitted', 'sick', 'absent']);

    console.log(`[DEBUG MATERIAL ACCESS] User: ${user_id}, Material: ${material_id}, Course: ${material.course_id}`);
    console.log(`[DEBUG ATTENDANCE DATA] Found ${attendances?.length || 0} attendance records:`, 
      attendances?.map(a => ({ status: a.status, meeting_id: a.meeting?.id })) || []);

    if (attendError) {
      console.error('Error checking attendance:', attendError);
      return res.json({ 
        success: true, 
        can_access: false,
        reason: 'no_attendance_record'
      });
    }

    // Check if user has ANY hadir/izin/sakit status
    // If yes, allow access. If all are absent or no records, deny access
    const hasValidAttendance = attendances && attendances.some(a => 
      a.status === 'present' || a.status === 'permitted' || a.status === 'sick'
    );

    console.log(`[DEBUG VALID ATTENDANCE] Result: ${hasValidAttendance}`);

    if (hasValidAttendance) {
      return res.json({ 
        success: true, 
        can_access: true,
        reason: 'valid_attendance'
      });
    }

    // Get restriction details jika ada
    let restriction = null;
    const { data: restrictionData } = await supabase
      .from('material_access_restrictions')
      .select(`
        *,
        meeting:meeting_id(title, scheduled_date)
      `)
      .eq('user_id', user_id)
      .eq('material_id', material_id)
      .is('lifted_at', null)
      .maybeSingle();

    restriction = restrictionData;

    res.json({ 
      success: true, 
      can_access: false,
      reason: 'absent_no_access',
      restriction: restriction
    });
  } catch (error) {
    console.error('Error checking material access:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get punishment history/logs
 */
async function getPunishmentLogs(req, res) {
  try {
    const { course_id } = req.params;
    const { user_id, limit } = req.query;

    let query = supabase
      .from('punishment_logs')
      .select(`
        *,
        user:user_id(full_name, email),
        course:course_id(title),
        triggered:triggered_by(full_name)
      `)
      .eq('course_id', course_id)
      .order('created_at', { ascending: false });

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, logs: data });
  } catch (error) {
    console.error('Error fetching punishment logs:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Auto-mark attendance ketika member join live class
 */
async function autoMarkAttendanceOnJoin(req, res) {
  try {
    const user_id = res.locals.user?.id;
    const { course_id } = req.params;

    if (!user_id || !course_id) {
      return res.status(400).json({ success: false, error: 'User ID dan Course ID wajib diisi' });
    }

    // Cek apakah user enrolled di course ini
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .eq('status', 'active')
      .single();

    if (enrollError || !enrollment) {
      return res.status(403).json({ success: false, error: 'User tidak terdaftar di kursus ini' });
    }

    // Cari meeting terbaru untuk course ini (yang belum selesai atau baru dimulai)
    let { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, status, scheduled_date, created_at, duration_minutes')
      .eq('course_id', course_id)
      .in('status', ['scheduled', 'ongoing'])
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .single();

    if (meetingError || !meeting) {
      // Jika tidak ada meeting ongoing/scheduled, cari meeting terakhir (completed)
      const { data: lastMeeting, error: lastError } = await supabase
        .from('meetings')
        .select('id, status, scheduled_date, created_at, duration_minutes')
        .eq('course_id', course_id)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .single();

      if (lastError || !lastMeeting) {
        return res.status(404).json({ success: false, error: 'Tidak ada meeting untuk kursus ini' });
      }

      meeting = lastMeeting;
    }

    // Cek batas waktu: 2 jam setelah meeting dibuat
    const meetingCreatedTime = new Date(meeting.created_at);
    const currentTime = new Date();
    const timeLimit = 2 * 60 * 60 * 1000; // 2 jam dalam milliseconds
    const timeDiff = currentTime - meetingCreatedTime;

    if (timeDiff > timeLimit) {
      return res.json({ 
        success: false, 
        error: 'Batas waktu absensi otomatis telah berakhir (2 jam setelah pertemuan dibuat)',
        status: 'time_expired'
      });
    }

    // Cek apakah sudah ada attendance record untuk user ini di meeting ini
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id, status')
      .eq('meeting_id', meeting.id)
      .eq('user_id', user_id)
      .single();

    if (existingAttendance) {
      // Jika sudah ada, cek statusnya
      if (existingAttendance.status === 'present') {
        // Sudah hadir, return success
        return res.json({ success: true, message: 'User sudah tercatat hadir', status: 'already_marked' });
      } else if (existingAttendance.status !== 'absent') {
        // Jika status bukan absent (misal izin/sakit), jangan ubah
        return res.json({ success: true, message: 'Status attendance sudah diset', status: 'already_set', currentStatus: existingAttendance.status });
      }
    }

    // Update attendance record menjadi present
    const { error: updateError } = await supabase
      .from('attendance')
      .update({ 
        status: 'present',
        updated_at: new Date().toISOString()
      })
      .eq('meeting_id', meeting.id)
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error marking attendance:', updateError);
      return res.status(500).json({ success: false, error: 'Gagal menandai kehadiran' });
    }

    // Update enrollment stats (reset consecutive absence jika ada)
    const { data: currentEnrollment } = await supabase
      .from('enrollments')
      .select('consecutive_absence')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .single();

    if (currentEnrollment && currentEnrollment.consecutive_absence > 0) {
      // Reset consecutive absence karena user hadir
      await supabase
        .from('enrollments')
        .update({ 
          consecutive_absence: 0,
          punishment_status: 'none'
        })
        .eq('user_id', user_id)
        .eq('course_id', course_id);
    }

    return res.json({ 
      success: true, 
      message: 'Kehadiran berhasil dicatat otomatis',
      status: 'marked_present'
    });

  } catch (error) {
    console.error('Error in autoMarkAttendanceOnJoin:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get students enrolled in a course (for attendance list)
 */
async function getStudentsByCourse(req, res) {
  try {
    const { course_id } = req.params;

    // Get enrolled students
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        user_id,
        users:user_id(id, full_name, email)
      `)
      .eq('course_id', course_id)
      .eq('status', 'active');

    if (enrollError) throw enrollError;

    if (!enrollments || enrollments.length === 0) {
      return res.json({ success: true, students: [] });
    }

    const students = enrollments.map(enrollment => ({
      id: enrollment.user_id,
      user_id: enrollment.user_id,
      full_name: enrollment.users.full_name,
      email: enrollment.users.email
    }));

    res.json({ success: true, students });
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get materials linked to a meeting
 */
async function getMeetingMaterials(req, res) {
  try {
    const { meeting_id } = req.params;

    const { data, error } = await supabase
      .from('meeting_materials')
      .select(`
        material_id,
        materials(id, title, ordinal)
      `)
      .eq('meeting_id', meeting_id)
      .order('unlock_order', { ascending: true });

    if (error && error.code !== '42P01') throw error;

    res.json({ 
      success: true, 
      materials: data ? data.map(m => m.materials).filter(Boolean) : [] 
    });
  } catch (error) {
    console.error('Error fetching meeting materials:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Link materials to a meeting (admin/lecturer only)
 */
async function linkMaterialsToMeeting(req, res) {
  try {
    const { meeting_id, material_ids } = req.body;

    if (!meeting_id || !Array.isArray(material_ids)) {
      return res.status(400).json({ 
        success: false, 
        message: 'meeting_id and material_ids array required' 
      });
    }

    // Delete existing links
    const { error: deleteError } = await supabase
      .from('meeting_materials')
      .delete()
      .eq('meeting_id', meeting_id);

    // Ignore if table doesn't exist (migration not run yet)
    if (deleteError && deleteError.code !== '42P01') throw deleteError;

    // Insert new links
    if (material_ids.length > 0) {
      const linksToCreate = material_ids.map((materialId, idx) => ({
        meeting_id,
        material_id: materialId,
        unlock_order: idx + 1
      }));

      const { error: insertError } = await supabase
        .from('meeting_materials')
        .insert(linksToCreate);

      if (insertError) {
        if (insertError.code === '42P01') {
          // Table doesn't exist - migration not run
          return res.status(503).json({ 
            success: false, 
            message: 'Migration belum dijalankan. Jalankan create_meeting_materials.sql di Supabase terlebih dahulu.',
            error: insertError.message
          });
        }
        throw insertError;
      }
    }

    res.json({ 
      success: true, 
      message: `${material_ids.length} materials linked to meeting` 
    });
  } catch (error) {
    console.error('Error linking materials to meeting:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Unlink material from meeting
 */
async function unlinkMaterialFromMeeting(req, res) {
  try {
    const { meeting_id, material_id } = req.params;

    const { error } = await supabase
      .from('meeting_materials')
      .delete()
      .eq('meeting_id', meeting_id)
      .eq('material_id', material_id);

    if (error && error.code !== '42P01') throw error;

    res.json({ success: true, message: 'Material unlinked from meeting' });
  } catch (error) {
    console.error('Error unlinking material:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createMeeting,
  deleteMeeting,
  getMeetingsByCourse,
  getAttendanceByMeeting,
  getStudentsByCourse,
  markAttendance,
  bulkMarkAttendance,
  autoMarkAttendanceOnJoin,
  resetPunishment,
  getPunishmentStatus,
  getStudentsPunishmentStatus,
  checkMaterialAccess,
  getPunishmentLogs,
  getMeetingMaterials,
  linkMaterialsToMeeting,
  unlinkMaterialFromMeeting
};
