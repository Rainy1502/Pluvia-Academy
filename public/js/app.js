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
				alert('Email wajib diisi terlebih dahulu');
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
					alert('Kode OTP telah dikirim ke email Anda. Silakan cek inbox atau folder spam.');
					// Focus ke input OTP
					const otpInput = form.querySelector('input[name="otp"]');
					otpInput && otpInput.focus();
				} else {
					alert(data.error || 'Gagal mengirim kode OTP');
				}
			} catch(error){
				console.error('Error sending OTP:', error);
				alert('Terjadi kesalahan saat mengirim OTP');
			} finally {
				// Re-enable button
				otpBtn.disabled = false;
				otpBtn.textContent = originalText;
			}
		});
	});
})();
