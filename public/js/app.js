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
