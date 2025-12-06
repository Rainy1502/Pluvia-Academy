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
    warning_1: `Anda telah tidak hadir sebanyak <strong>${consecutiveAbsence}x</strong> berturut-turut.`,
    warning_2: `Anda telah tidak hadir sebanyak <strong>${consecutiveAbsence}x</strong> berturut-turut!`,
    suspended: `Anda telah di-suspend karena tidak hadir sebanyak <strong>3x berturut-turut</strong>.`,
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
      const bannerStyles = {
        warning_1: {
          bgColor: '#FEF3C7',
          borderColor: '#FBBF24',
          titleColor: '#D97706',
          textColor: '#92400E',
          icon: '⚠️'
        },
        warning_2: {
          bgColor: '#FED7AA',
          borderColor: '#FB923C',
          titleColor: '#DC2626',
          textColor: '#7C2D12',
          icon: '⚠️'
        },
        suspended: {
          bgColor: '#FEE2E2',
          borderColor: '#F87171',
          titleColor: '#DC2626',
          textColor: '#7F1D1D',
          icon: '🚫'
        }
      };

      const style = bannerStyles[result.status];
      const title = result.status === 'suspended' ? 'AKUN ANDA DI-SUSPEND' : 
                    result.status === 'warning_2' ? 'PERINGATAN ABSENSI - LEVEL 2' :
                    'PERINGATAN ABSENSI';
      
      const subtitle = result.status === 'suspended' ? 'Silakan hubungi lecturer untuk mengaktifkan kembali akun Anda.' :
                       result.status === 'warning_2' ? 'Satu kali absen lagi, Anda akan di-suspend dari kursus ini.' :
                       'Harap hadir pada pertemuan berikutnya.';

      container.innerHTML = `
        <div style="
          background-color: ${style.bgColor};
          border-left: 6px solid ${style.borderColor};
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        ">
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          ">
            <span style="
              font-size: 3.5rem;
              margin-bottom: 12px;
              display: block;
            ">${style.icon}</span>
            
            <h3 style="
              color: ${style.titleColor};
              font-weight: 700;
              font-size: 1.25rem;
              margin: 0 0 8px 0;
              letter-spacing: 0.5px;
            ">
              ${title}
            </h3>
            
            <p style="
              color: ${style.textColor};
              font-size: 0.95rem;
              margin: 8px 0;
              line-height: 1.6;
              max-width: 500px;
            ">
              ${result.message}
            </p>
            
            <p style="
              color: ${style.textColor};
              font-size: 0.9rem;
              font-weight: 600;
              margin: 12px 0 0 0;
              line-height: 1.5;
            ">
              ${subtitle}
            </p>
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
