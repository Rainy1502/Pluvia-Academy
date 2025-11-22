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
	
	// OTP button: send OTP without submitting whole form
	const otpBtn = document.querySelector('.otp-btn');
	if (otpBtn) {
		otpBtn.addEventListener('click', async function (e) {
			e.preventDefault();
			const form = otpBtn.closest('.register-form');
			if (!form) return;
			const username = form.querySelector('input[name="username"]')?.value || '';
			const phone = form.querySelector('input[name="phone"]')?.value || '';
			const email = form.querySelector('input[name="email"]')?.value || '';

			const password = form.querySelector('input[name="password"]')?.value || '';
			const passwordConfirm = form.querySelector('input[name="passwordConfirm"]')?.value || '';

			// basic client-side validation
			if (!password || !passwordConfirm) {
				showRegisterMessage('Isi password dan konfirmasi password sebelum meminta OTP.', 'error');
				return;
			}
			if (password !== passwordConfirm) {
				showRegisterMessage('Password dan konfirmasi tidak cocok.', 'error');
				return;
			}

			const payload = { full_name: username, username, phone, email, password, passwordConfirm };

			otpBtn.disabled = true;
			const oldText = otpBtn.textContent;
			otpBtn.textContent = 'Mengirim...';

			try {
				const resp = await fetch('/api/auth/resend-otp', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = await resp.json();
				showRegisterMessage(data.message || (data.error || (resp.ok ? 'Kode OTP dikirim' : 'Gagal mengirim')) , resp.ok ? 'success' : 'error');
			} catch (err) {
				console.error('OTP send failed', err);
				showRegisterMessage('Gagal mengirim kode. Coba lagi.', 'error');
			} finally {
				otpBtn.disabled = false;
				otpBtn.textContent = oldText;
			}
		});
	}

	function showRegisterMessage(text, type) {
		const container = document.querySelector('.register-card');
		if (!container) return;
		let msg = container.querySelector('.form-message');
		if (!msg) {
			msg = document.createElement('div');
			msg.className = 'form-message';
			container.insertBefore(msg, container.querySelector('.register-form'));
		}
		msg.textContent = text;
		msg.classList.remove('msg-success', 'msg-error');
		if (type === 'success') msg.classList.add('msg-success');
		if (type === 'error') msg.classList.add('msg-error');
	}
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
