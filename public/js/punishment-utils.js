// Punishment System Utilities for Member Pages
// Digunakan di halaman kursus dan materi member untuk check status punishment

/**
 * Check punishment status untuk user di course tertentu
 * @param {string} courseId - UUID course
 * @returns {Promise<Object>} - { status, consecutive_absence, canAccess, message }
 */
async function checkPunishmentStatus(courseId) {
  try {
    const userId = window.currentUser?.id;
    if (!userId) return { canAccess: true };

    const response = await fetch(`/api/attendance/punishment/${userId}/${courseId}`);
    const result = await response.json();

    if (result.success && result.punishment) {
      const { punishment_status, consecutive_absence } = result.punishment;
      
      return {
        status: punishment_status,
        consecutive_absence,
        canAccess: punishment_status !== 'suspended',
        message: getPunishmentMessage(punishment_status, consecutive_absence)
      };
    }

    return { canAccess: true };
  } catch (error) {
    console.error('Error checking punishment status:', error);
    return { canAccess: true };
  }
}

/**
 * Check apakah member bisa akses material tertentu
 * @param {string} materialId - UUID material
 * @returns {Promise<Object>} - { canAccess, restriction }
 */
async function checkMaterialAccess(materialId) {
  try {
    const userId = window.currentUser?.id;
    if (!userId) return { canAccess: false };

    const response = await fetch(`/api/attendance/material-access/${userId}/${materialId}`);
    const result = await response.json();

    if (result.success) {
      return {
        canAccess: result.can_access,
        restriction: result.restriction
      };
    }

    return { canAccess: false };
  } catch (error) {
    console.error('Error checking material access:', error);
    return { canAccess: false };
  }
}

/**
 * Get punishment message berdasarkan status
 */
function getPunishmentMessage(status, consecutiveAbsence) {
  const messages = {
    warning_1: `⚠️ Peringatan 1: Anda telah tidak hadir sebanyak ${consecutiveAbsence}x berturut-turut. Harap hadir pada pertemuan berikutnya.`,
    warning_2: `⚠️ PERINGATAN 2: Anda telah tidak hadir sebanyak ${consecutiveAbsence}x berturut-turut! Satu kali absen lagi, Anda akan di-suspend dari kursus ini.`,
    suspended: `🚫 SUSPENDED: Anda telah di-suspend karena tidak hadir sebanyak 3x berturut-turut. Silakan hubungi lecturer untuk mengaktifkan kembali akun Anda.`,
    none: ''
  };

  return messages[status] || '';
}

/**
 * Display punishment notification banner
 */
function displayPunishmentBanner(courseId, containerId = 'punishment-banner-container') {
  checkPunishmentStatus(courseId).then(result => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (result.status && result.status !== 'none') {
      const colors = {
        warning_1: 'bg-yellow-50 border-yellow-400 text-yellow-800',
        warning_2: 'bg-orange-50 border-orange-400 text-orange-800',
        suspended: 'bg-red-50 border-red-400 text-red-800'
      };

      const icons = {
        warning_1: '⚠️',
        warning_2: '⚠️',
        suspended: '🚫'
      };

      container.innerHTML = `
        <div class="border-l-4 ${colors[result.status]} p-4 rounded mb-6 shadow-md">
          <div class="flex items-start">
            <span class="text-3xl mr-3">${icons[result.status]}</span>
            <div class="flex-1">
              <h3 class="font-bold text-lg mb-1">
                ${result.status === 'suspended' ? 'AKUN ANDA DI-SUSPEND' : 'PERINGATAN ABSENSI'}
              </h3>
              <p class="text-sm">${result.message}</p>
              ${result.status === 'suspended' ? `
                <p class="text-sm mt-2 font-semibold">
                  Anda tidak dapat mengakses materi kursus ini. Hubungi lecturer untuk mengaktifkan kembali.
                </p>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  });
}

/**
 * Lock material jika tidak bisa diakses
 * Menampilkan overlay dan pesan
 */
async function lockMaterialIfRestricted(materialId, materialCardElement) {
  const result = await checkMaterialAccess(materialId);
  
  if (!result.canAccess && result.restriction) {
    // Tambahkan overlay locked
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10 rounded-lg';
    overlay.innerHTML = `
      <div class="text-center text-white p-6">
        <i class="fas fa-lock text-5xl mb-3"></i>
        <h3 class="font-bold text-xl mb-2">Materi Terkunci</h3>
        <p class="text-sm">Anda tidak bisa mengakses materi ini karena tidak hadir di meeting terkait.</p>
        ${result.restriction.meeting ? `
          <p class="text-xs mt-2 opacity-90">Meeting: ${result.restriction.meeting.title}</p>
        ` : ''}
      </div>
    `;

    // Disable link
    materialCardElement.style.position = 'relative';
    materialCardElement.style.cursor = 'not-allowed';
    materialCardElement.onclick = (e) => {
      e.preventDefault();
      alert('Anda tidak dapat mengakses materi ini karena tidak hadir pada meeting terkait. Silakan hubungi lecturer jika ada kesalahan.');
      return false;
    };

    materialCardElement.appendChild(overlay);
  }
}

/**
 * Check punishment sebelum redirect ke materi
 */
async function checkBeforeAccessMaterial(materialId, materialUrl) {
  const result = await checkMaterialAccess(materialId);
  
  if (result.canAccess) {
    window.location.href = materialUrl;
  } else {
    alert('Anda tidak dapat mengakses materi ini karena tidak hadir pada meeting terkait.');
  }
}

/**
 * Initialize punishment check untuk halaman kursus
 */
function initPunishmentCheck(courseId) {
  // Display banner
  displayPunishmentBanner(courseId);

  // Check all materials
  document.querySelectorAll('[data-material-id]').forEach(async (element) => {
    const materialId = element.getAttribute('data-material-id');
    if (materialId) {
      await lockMaterialIfRestricted(materialId, element);
    }
  });
}

// Export functions untuk digunakan di halaman lain
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkPunishmentStatus,
    checkMaterialAccess,
    displayPunishmentBanner,
    lockMaterialIfRestricted,
    checkBeforeAccessMaterial,
    initPunishmentCheck
  };
}
