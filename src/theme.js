import './theme.css';

export function setupTheme(){
 const control=document.createElement('button');
 control.type='button';control.className='auth-theme theme-toggle';control.dataset.themeToggle='';
 document.querySelector('.auth-card').prepend(control);
 let theme='dark';
 try{theme=localStorage.getItem('sonix-theme')|| (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch{}
 function apply(value){
  theme=value==='light'?'light':'dark';document.documentElement.dataset.theme=theme;
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
   button.textContent=theme==='dark'?'☀':'☾';
   button.title=button.ariaLabel=`Switch to ${theme==='dark'?'light':'dark'} mode`;
   button.setAttribute('aria-pressed',String(theme==='light'));
  });
 }
 apply(theme);
 document.addEventListener('click',event=>{
  if(!event.target.closest('[data-theme-toggle]'))return;
  apply(theme==='dark'?'light':'dark');try{localStorage.setItem('sonix-theme',theme);}catch{}
 });
}
