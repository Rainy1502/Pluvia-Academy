// Client-side placeholder for Pluvia Academy
console.log('Pluvia Academy public JS loaded');

// --- merged from root js/app.js ---
// Minimal JS for scaffold: mobile nav toggle and year
document.addEventListener('DOMContentLoaded',function(){
	const nav = document.getElementById('siteNav');
	const toggle = document.getElementById('navToggle');
	const year = document.getElementById('year');
	if(toggle && nav){
		toggle.addEventListener('click',()=>{
			const isOpen = nav.style.display === 'block';
			nav.style.display = isOpen ? '' : 'block';
		});
	}
	if(year) year.textContent = new Date().getFullYear();
});

// Header scroll state: add .scrolled when page is scrolled
(function(){
    const header = document.querySelector('.site-header');
    if(!header) return;
    function onScroll(){
        if(window.scrollY > 20) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
})();

// Toggle password visibility for inputs with .password-field and .toggle-password button
(function(){
	function toggleHandler(e){
		const btn = e.currentTarget;
		const wrapper = btn.closest('.input-with-icon');
		if(!wrapper) return;
		const input = wrapper.querySelector('.password-field');
		if(!input) return;
		const icon = btn.querySelector('img');
		if(input.type === 'password'){
			input.type = 'text';
			btn.setAttribute('aria-label','Sembunyikan password');
			btn.title = 'Sembunyikan password';
			btn.classList.add('visible');
			if(icon && icon.dataset.open) icon.src = icon.dataset.open;
		} else {
			input.type = 'password';
			btn.setAttribute('aria-label','Tampilkan password');
			btn.title = 'Tampilkan password';
			btn.classList.remove('visible');
			if(icon && icon.dataset.closed) icon.src = icon.dataset.closed;
		}
	}

	document.addEventListener('DOMContentLoaded', function(){
		const toggles = document.querySelectorAll('.toggle-password');
		toggles.forEach(btn => btn.addEventListener('click', toggleHandler));
	});
})();

// Animate a single card when triggered (no auto-run on page load)
(function(){
	function animateCard(card, idx){
		if(!card) return;
		card.classList.add('card-animate');
		const innerDelayBase = 80 + (idx || 0) * 30; // ms
		const innerEls = card.querySelectorAll('.form-control, .login-meta, .otp-row, .btn-primary');
		innerEls.forEach((el, i)=>{
			el.style.setProperty('--d', `${innerDelayBase + i*40}ms`);
		});
		// reveal with a small stagger
		setTimeout(()=>{ card.classList.add('in'); }, 80 + (idx||0)*80);
	}

	document.addEventListener('DOMContentLoaded', ()=>{
		const cards = Array.from(document.querySelectorAll('.login-card, .register-card'));
		cards.forEach((card, idx)=>{
			const btn = card.querySelector('.btn-primary');
			const form = card.querySelector('form');
			if(!btn) return;
			btn.addEventListener('click', function(e){
				// prevent immediate submit so animation can play
				if(form && form.tagName === 'FORM') e.preventDefault();

				// if already animated, submit immediately
				if(card.classList.contains('anim-played')){
					form && form.submit();
					return;
				}

				// play badge animation if present
				const badge = card.querySelector('.card-badge');
				if(badge){
					badge.classList.remove('badge-animate');
					// force reflow to restart animation
					void badge.offsetWidth;
					badge.classList.add('badge-animate');
				}

				animateCard(card, idx);
				card.classList.add('anim-played');

				// submit after animation finishes (match CSS transition ~420ms + badge animation); small buffer
				setTimeout(()=>{ form && form.submit(); }, 700);
			});
		});
	});
})();

// OTP Handler: Kirim kode OTP via AJAX
(function(){
	document.addEventListener('DOMContentLoaded', function(){
		const otpBtn = document.querySelector('.otp-btn');
		if(!otpBtn) return;

		otpBtn.addEventListener('click', async function(e){
			e.preventDefault();

			// Ambil nilai email dan username dari form
			const form = otpBtn.closest('form');
			if(!form) return;

			const emailInput = form.querySelector('input[name="email"]');
			const usernameInput = form.querySelector('input[name="username"]');

			if(!emailInput || !emailInput.value){
				if (typeof toast !== 'undefined') {
					toast.warning('Email wajib diisi terlebih dahulu');
				} else {
					alert('Email wajib diisi terlebih dahulu');
				}
				emailInput && emailInput.focus();
				return;
			}

			const email = emailInput.value.trim();
			const username = usernameInput ? usernameInput.value.trim() : '';

			// Disable button dan ubah text
			otpBtn.disabled = true;
			const originalText = otpBtn.textContent;
			otpBtn.textContent = 'Mengirim...';

			try {
				const response = await fetch('/api/otp/send', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email, username }),
				});

				const data = await response.json();

				if(response.ok && data.success){
					if (typeof toast !== 'undefined') {
						toast.success('Kode OTP telah dikirim ke email Anda!');
					} else {
						alert('Kode OTP telah dikirim ke email Anda');
					}
					// Focus ke input OTP
					const otpInput = form.querySelector('input[name="otp"]');
					otpInput && otpInput.focus();
				} else {
					const errorMsg = data.error || 'Gagal mengirim kode OTP';
					if (typeof toast !== 'undefined') {
						toast.error(errorMsg);
					} else {
						alert(errorMsg);
					}
				}
			} catch(error){
				console.error('Error sending OTP:', error);
				if (typeof toast !== 'undefined') {
					toast.error('Terjadi kesalahan saat mengirim OTP');
				} else {
					alert('Terjadi kesalahan saat mengirim OTP');
				}
			} finally {
				// Re-enable button
				otpBtn.disabled = false;
				otpBtn.textContent = originalText;
			}
		});
	});
})();

// Edit Profile Form Handler
(function(){
	const editForm = document.getElementById('editProfileForm');
	if(!editForm) return;

	// Toggle password visibility for edit profile form
	const passwordToggles = editForm.querySelectorAll('.toggle-password-btn');
	passwordToggles.forEach(function(btn){
		btn.addEventListener('click', function(){
			const passwordGroup = this.closest('.password-group');
			const input = passwordGroup.querySelector('.password-field');
			const icon = this.querySelector('.eye-icon');
			
			if(input.type === 'password'){
				input.type = 'text';
				icon.src = '/img/eye-open.png';
				this.setAttribute('aria-label', 'Sembunyikan password');
			} else {
				input.type = 'password';
				icon.src = '/img/eye-closed.png';
				this.setAttribute('aria-label', 'Tampilkan password');
			}
		});
	});

	// File upload preview
	const fileInput = document.getElementById('profilePicture');
	const uploadText = document.querySelector('.upload-text');
	const imagePreview = document.getElementById('imagePreview');
	const removeImageBtn = document.getElementById('removeImageBtn');
	const imagePreviewContainer = document.getElementById('imagePreviewContainer');
	const avatarPlaceholderEdit = document.getElementById('avatarPlaceholderEdit');
	
	// Toggle remove button on image click
	if(imagePreviewContainer){
		imagePreviewContainer.addEventListener('click', function(e){
			// Don't toggle if clicking the remove button itself
			if(e.target.id === 'removeImageBtn' || e.target.closest('#removeImageBtn')){
				return;
			}
			this.classList.toggle('show-remove');
		});
		
		// Close remove button when clicking outside
		document.addEventListener('click', function(e){
			if(!imagePreviewContainer.contains(e.target)){
				imagePreviewContainer.classList.remove('show-remove');
			}
		});
	}
	
	if(fileInput && uploadText){
		fileInput.addEventListener('change', function(){
			if(this.files && this.files[0]){
				// Reset removeAvatar flag when new file selected
				const removeAvatarInput = document.getElementById('removeAvatar');
				if(removeAvatarInput) removeAvatarInput.value = 'false';
				
				const file = this.files[0];
				uploadText.textContent = file.name;
				
				// Show image preview
				const reader = new FileReader();
				reader.onload = function(e){
					// Remove existing content
					imagePreviewContainer.innerHTML = '';
					imagePreviewContainer.classList.remove('show-remove');
					
					// Create new image
					const img = document.createElement('img');
					img.src = e.target.result;
					img.className = 'image-preview';
					img.id = 'imagePreview';
					imagePreviewContainer.appendChild(img);
					
					// Add remove button
					const removeBtn = document.createElement('button');
					removeBtn.type = 'button';
					removeBtn.className = 'remove-image-btn';
					removeBtn.id = 'removeImageBtn';
					removeBtn.textContent = 'Hapus';
					imagePreviewContainer.appendChild(removeBtn);
					
					// Add remove handler
					removeBtn.addEventListener('click', handleRemoveImage);
				};
				reader.readAsDataURL(file);
			} else {
				uploadText.textContent = 'Pilih Gambar Profile';
			}
		});
	}
	
	// Handle remove image - disabled, using modal confirmation in edit_profile.hbs instead
	function handleRemoveImage(e){
		e.stopPropagation();
		// Modal confirmation handled by edit_profile.hbs showDeletePhotoConfirm()
		return;
		
		// Old code below - kept for reference but not executed
		if(false){
			// Set hidden input to indicate avatar should be removed
			const removeAvatarInput = document.getElementById('removeAvatar');
			if(removeAvatarInput) removeAvatarInput.value = 'true';
			
			// Clear file input
			if(fileInput) fileInput.value = '';
			
			// Reset upload text
			if(uploadText) uploadText.textContent = 'Pilih Gambar Profile';
			
			// Reset preview to placeholder
			imagePreviewContainer.innerHTML = '';
			imagePreviewContainer.classList.remove('show-remove');
			
			const placeholder = document.createElement('div');
			placeholder.className = 'avatar-placeholder-edit';
			placeholder.id = 'avatarPlaceholderEdit';
			
			// Get initial from form (first letter of email)
			const emailInput = document.getElementById('email');
			const initial = emailInput && emailInput.value ? emailInput.value.charAt(0).toUpperCase() : 'U';
			
			placeholder.innerHTML = '<span class="avatar-initial-edit">' + initial + '</span>';
			imagePreviewContainer.appendChild(placeholder);
			
			// Add remove button back (hidden)
			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.className = 'remove-image-btn';
			removeBtn.id = 'removeImageBtn';
			removeBtn.textContent = 'Hapus';
			imagePreviewContainer.appendChild(removeBtn);
			removeBtn.addEventListener('click', handleRemoveImage);
		}
	}
	
	// Add click handler for existing remove button
	if(removeImageBtn){
		removeImageBtn.addEventListener('click', handleRemoveImage);
	}

	// Form validation
	editForm.addEventListener('submit', function(e){
		const password = document.getElementById('password').value;
		const confirmPassword = document.getElementById('confirmPassword').value;

		// Validate password match if password is being changed
		if(password || confirmPassword){
			if(password !== confirmPassword){
				e.preventDefault();
				alert('Password dan Konfirmasi Password tidak cocok!');
				return false;
			}
		}

		// If validation passes, form will submit normally
		return true;
	});
})();
