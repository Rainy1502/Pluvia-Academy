/**
 * Toast Notification System
 * Modern, non-blocking notifications dengan auto-dismiss
 */

class Toast {
	constructor() {
		this.container = null;
	}

	/**
	 * Inisialisasi container untuk toast (lazy initialization)
	 */
	initContainer() {
		if (this.container) return;

		if (!document.body) {
			console.warn('Toast: document.body not available yet');
			return false;
		}

		this.container = document.createElement('div');
		this.container.className = 'toast-container';
		document.body.appendChild(this.container);
		return true;
	}

	/**
	 * Tampilkan toast notification
	 * @param {string} message - Pesan yang ditampilkan
	 * @param {string} type - Tipe: 'success', 'error', 'info', 'warning'
	 * @param {number} duration - Durasi tampil dalam ms (0 = tidak auto-dismiss)
	 * @param {boolean} dismissible - Bisa ditutup manual dengan tombol X
	 */
	show(message, type = 'info', duration = 4000, dismissible = true) {
		// Ensure container is initialized
		if (!this.container && !this.initContainer()) {
			console.error('Toast: Failed to initialize container');
			return null;
		}

		const icons = {
			success: '✓',
			error: '✕',
			info: 'ℹ',
			warning: '⚠'
		};

		const toast = document.createElement('div');
		toast.className = `toast ${type}`;
		toast.setAttribute('role', 'alert');

		const icon = document.createElement('span');
		icon.className = 'toast-icon';
		icon.textContent = icons[type] || icons.info;

		const messageEl = document.createElement('span');
		messageEl.className = 'toast-message';
		messageEl.textContent = message;

		toast.appendChild(icon);
		toast.appendChild(messageEl);

		if (dismissible) {
			const closeBtn = document.createElement('button');
			closeBtn.className = 'toast-close';
			closeBtn.textContent = '×';
			closeBtn.setAttribute('aria-label', 'Tutup notifikasi');
			closeBtn.addEventListener('click', () => this.remove(toast));
			toast.appendChild(closeBtn);
		}

		this.container.appendChild(toast);

		// Auto-dismiss
		if (duration > 0) {
			setTimeout(() => this.remove(toast), duration);
		}

		return toast;
	}

	/**
	 * Tampilkan toast sukses
	 */
	success(message, duration = 3000) {
		return this.show(message, 'success', duration);
	}

	/**
	 * Tampilkan toast error
	 */
	error(message, duration = 5000) {
		return this.show(message, 'error', duration);
	}

	/**
	 * Tampilkan toast info
	 */
	info(message, duration = 4000) {
		return this.show(message, 'info', duration);
	}

	/**
	 * Tampilkan toast warning
	 */
	warning(message, duration = 4000) {
		return this.show(message, 'warning', duration);
	}

	/**
	 * Hapus toast dengan animasi
	 */
	remove(toast) {
		toast.classList.add('removing');
		setTimeout(() => {
			toast.remove();
		}, 300);
	}

	/**
	 * Clear semua toast
	 */
	clearAll() {
		if (!this.container) return;
		const toasts = this.container.querySelectorAll('.toast');
		toasts.forEach(toast => this.remove(toast));
	}
}

// Inisialisasi global toast instance
let toast = new Toast();

// Initialize container saat DOM ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		toast.initContainer();
		console.log('Toast container initialized on DOMContentLoaded');
	});
} else {
	// DOM already loaded
	toast.initContainer();
	console.log('Toast container initialized immediately');
}
